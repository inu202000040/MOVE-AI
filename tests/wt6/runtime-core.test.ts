import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCacheKeyV1,
  HybridLoaderV1,
  MemoryCacheBackendV1,
  providerPayloadDecoderV1,
  SingleFlightV1,
  VerifiedDataCacheV1,
  type ProviderPayloadV1,
} from "../../app/data/runtime/cache";
import {
  CACHE_CONTROL_V1,
  PROVIDER_EXECUTION_LIMITS_V1,
  PROVIDER_RETRY_POLICY_V1,
  assertAllowedProviderUrlV1,
  cacheControlForV1,
  parseServerDataModeV1,
} from "../../app/data/runtime/provider-policy";
import {
  ProviderHttpError,
  ProviderTimeoutError,
  parseRetryAfterMsV1,
  runProviderWithRetryV1,
  withAttemptTimeoutV1,
  type TimerApiV1,
} from "../../app/data/runtime/retry";
import {
  consumerIntegrationFixturesV1,
  fixturesForConsumerV1,
} from "../../app/data/runtime/consumer-fixtures";
import { exactKeys, finite, record } from "../../app/data/artifacts/decoder-core";

interface SampleData {
  readonly value: number;
}

function decodeSample(value: unknown): SampleData {
  const root = record(value, "$sample");
  exactKeys(root, ["value"], "$sample");
  return { value: finite(root.value, "$sample.value") };
}

function payload(value: number): ProviderPayloadV1<SampleData> {
  return {
    data: { value },
    source: "provider-sample",
    sourceUrl: "https://data-api.ecb.europa.eu/sample",
    asOf: "2026-08-13",
    fetchedAt: "2026-08-13T00:00:00+09:00",
    unit: "sample",
    isEstimate: false,
    attribution: "Sample provider",
    warnings: [],
    provider: "sample",
  };
}

test("cache keys are stable, mode-bound, and reject secret-bearing input", () => {
  const left = buildCacheKeyV1({
    domain: "market",
    normalizedRequest: { series: "fx", from: "2026-01-01", to: "2026-08-13" },
    providerVersion: 3,
    mode: "live",
  });
  const reordered = buildCacheKeyV1({
    domain: "market",
    normalizedRequest: { to: "2026-08-13", from: "2026-01-01", series: "fx" },
    providerVersion: 3,
    mode: "live",
  });
  const fixture = buildCacheKeyV1({
    domain: "market",
    normalizedRequest: { series: "fx", from: "2026-01-01", to: "2026-08-13" },
    providerVersion: 3,
    mode: "fixture",
  });
  assert.equal(left, reordered);
  assert.notEqual(left, fixture);
  assert.throws(
    () => buildCacheKeyV1({ domain: "market", normalizedRequest: { authorization: "secret" }, providerVersion: 3, mode: "live" }),
    /cannot be included/u,
  );
});

test("verified cache enforces digest, decoder, and fresh/stale/expired boundaries", () => {
  const backend = new MemoryCacheBackendV1();
  const cache = new VerifiedDataCacheV1(backend);
  const decoder = providerPayloadDecoderV1(decodeSample);
  cache.write({ key: "sample", value: payload(7), sourceAsOf: "2026-08-13", storedAt: 1_000, decoder });
  const policy = { freshForMs: 1_000, staleForMs: 2_000 };
  assert.equal(cache.read({ key: "sample", now: 2_000, policy, decoder }).kind, "fresh");
  assert.equal(cache.read({ key: "sample", now: 2_001, policy, decoder }).kind, "stale");
  assert.equal(cache.read({ key: "sample", now: 4_000, policy, decoder }).kind, "stale");
  assert.equal(cache.read({ key: "sample", now: 4_001, policy, decoder }).kind, "expired");

  cache.write({ key: "corrupt", value: payload(8), sourceAsOf: "2026-08-13", storedAt: 1_000, decoder });
  const stored = backend.entries.get("corrupt");
  assert.ok(stored);
  backend.entries.set("corrupt", { ...stored, payloadDigest: "0".repeat(64) });
  assert.deepEqual(
    cache.read({ key: "corrupt", now: 1_001, policy, decoder }),
    { kind: "corrupt", warning: "CACHE_CORRUPT" },
  );
  assert.equal(backend.entries.has("corrupt"), false);
});

test("hybrid revalidation order is fresh cache, live, stale cache, fixture, unavailable", async () => {
  const cache = new VerifiedDataCacheV1();
  const decoder = providerPayloadDecoderV1(decodeSample);
  cache.write({ key: "fresh", value: payload(1), sourceAsOf: "2026-08-13", storedAt: 1_000, decoder });
  const freshLoader = new HybridLoaderV1<SampleData>(cache);
  let liveCalls = 0;
  const fresh = await freshLoader.load({
    key: "fresh",
    now: 1_500,
    policy: { freshForMs: 1_000, staleForMs: 2_000 },
    decodeData: decodeSample,
    live: async () => { liveCalls += 1; return payload(2); },
  });
  assert.equal(fresh.kind, "success");
  assert.equal(fresh.kind === "success" ? fresh.mode : null, "cached");
  assert.equal(liveCalls, 0);

  cache.write({ key: "stale", value: payload(3), sourceAsOf: "2026-08-13", storedAt: 1_000, decoder });
  const stale = await freshLoader.load({
    key: "stale",
    now: 2_500,
    policy: { freshForMs: 1_000, staleForMs: 2_000 },
    decodeData: decodeSample,
    live: async () => { throw new TypeError("network reset"); },
  });
  assert.equal(stale.kind === "success" ? stale.mode : null, "cached");
  assert.equal(stale.kind === "success" ? stale.cache.stale : null, true);

  const fixture = await freshLoader.load({
    key: "fixture",
    now: 2_500,
    policy: { freshForMs: 1_000, staleForMs: 2_000 },
    decodeData: decodeSample,
    live: async () => { throw new TypeError("network reset"); },
    fixture: () => payload(4),
    fixtureStale: true,
  });
  assert.equal(fixture.kind === "success" ? fixture.mode : null, "fixture");
  assert.equal(fixture.kind === "success" ? fixture.cache.stale : null, true);

  const unavailable = await freshLoader.load({
    key: "unavailable",
    now: 2_500,
    policy: { freshForMs: 1_000, staleForMs: 2_000 },
    decodeData: decodeSample,
    live: async () => { throw new TypeError("network reset"); },
  });
  assert.equal(unavailable.kind, "unavailable");
});

test("single-flight shares one provider promise for the same normalized key", async () => {
  const flight = new SingleFlightV1<number>();
  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const task = async () => { calls += 1; await gate; return 42; };
  const first = flight.run("same", task);
  const second = flight.run("same", task);
  assert.equal(calls, 1);
  release?.();
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
});

test("retry allowlist, bounded Retry-After, abort, timeout, and timer cleanup are executable", async () => {
  let attempts = 0;
  const recovered = await runProviderWithRetryV1({
    policy: { attemptTimeoutMs: 1_000, maximumAttempts: 3, backoffMs: [0, 0] },
    random: () => 0.5,
    operation: async () => {
      attempts += 1;
      if (attempts === 1) throw new ProviderHttpError(408);
      if (attempts === 2) throw new ProviderHttpError(503);
      return "ok";
    },
  });
  assert.equal(recovered, "ok");
  assert.equal(attempts, 3);

  attempts = 0;
  await assert.rejects(
    runProviderWithRetryV1({
      policy: { attemptTimeoutMs: 1_000, maximumAttempts: 3, backoffMs: [0, 0] },
      operation: async () => { attempts += 1; throw new ProviderHttpError(400); },
    }),
    (error: unknown) => error instanceof ProviderHttpError && error.status === 400,
  );
  assert.equal(attempts, 1);
  assert.equal(parseRetryAfterMsV1("90", 0, 30_000), 30_000);
  assert.equal(parseRetryAfterMsV1("invalid", 0, 30_000), null);

  let cleared = 0;
  const timer: TimerApiV1 = {
    set(callback) { queueMicrotask(callback); return setTimeout(() => undefined, 60_000); },
    clear(handle) { cleared += 1; clearTimeout(handle); },
  };
  await assert.rejects(
    withAttemptTimeoutV1({ timeoutMs: 7, timer, operation: async () => new Promise<never>(() => undefined) }),
    (error: unknown) => error instanceof ProviderTimeoutError && error.timeoutMs === 7,
  );
  assert.equal(cleared, 1);

  const controller = new AbortController();
  const aborting = runProviderWithRetryV1({
    policy: { attemptTimeoutMs: 1_000, maximumAttempts: 3, backoffMs: [500, 500] },
    signal: controller.signal,
    operation: async () => { throw new ProviderHttpError(503); },
  });
  setTimeout(() => controller.abort(new DOMException("cancelled", "AbortError")), 5);
  await assert.rejects(aborting, /cancelled/u);
});

test("provider/cache policy and consumer matrix remain exact", () => {
  assert.equal(parseServerDataModeV1(undefined), "hybrid");
  assert.equal(parseServerDataModeV1("fixture"), "fixture");
  assert.throws(() => parseServerDataModeV1("unknown"), /Unsupported/u);
  assert.equal(assertAllowedProviderUrlV1("https://api.met.no/weatherapi/locationforecast/2.0/compact").hostname, "api.met.no");
  assert.throws(() => assertAllowedProviderUrlV1("https://example.com/data"), /not allowlisted/u);
  assert.throws(() => assertAllowedProviderUrlV1("http://api.met.no/data"), /not allowlisted/u);

  assert.equal(cacheControlForV1({ domain: "market", state: "REFERENCE" }), CACHE_CONTROL_V1.market);
  assert.equal(cacheControlForV1({ domain: "news", state: "LIVE", articleCount: 4 }), "no-store");
  assert.equal(cacheControlForV1({ domain: "news", state: "LIVE", articleCount: 5 }), CACHE_CONTROL_V1.newsReady);
  assert.equal(cacheControlForV1({ domain: "port", state: "LIVE" }), CACHE_CONTROL_V1.portLiveSummary);
  assert.equal(cacheControlForV1({ domain: "port", state: "LIVE", detail: true }), CACHE_CONTROL_V1.portShort);
  assert.equal(cacheControlForV1({ domain: "weather", state: "PARTIAL" }), CACHE_CONTROL_V1.weatherAvailable);
  assert.equal(cacheControlForV1({ domain: "weather", state: "UNAVAILABLE" }), "no-store");
  assert.deepEqual(PROVIDER_RETRY_POLICY_V1.port.backoffMs, [350, 700]);
  assert.equal(PROVIDER_EXECUTION_LIMITS_V1.weather.marineChunkSize, 24);

  assert.deepEqual(Object.keys(consumerIntegrationFixturesV1), ["dashboard", "modelLab", "globe", "allocation"]);
  assert.deepEqual(fixturesForConsumerV1("dashboard").map((resource) => resource.method), ["snapshot", "market", "news", "insight"]);
  assert.deepEqual(fixturesForConsumerV1("modelLab").map((resource) => resource.method), ["snapshot", "tuningHealth", "tuningRun"]);
  assert.deepEqual(fixturesForConsumerV1("globe").map((resource) => resource.method), ["portSummary", "chokeSummary", "weather"]);
  assert.deepEqual(fixturesForConsumerV1("allocation").map((resource) => resource.method), ["snapshot"]);
});
