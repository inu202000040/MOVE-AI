import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_GATEWAY_METHODS,
  DATA_MODES,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  GATEWAY_SCHEMA_VERSION,
} from "../../app/contracts";
import { acceptsExactQuery, acceptsGatewayResult } from "./lib/gateway-oracle";
import { readGoldenManifest } from "./lib/manifest";

const manifest = await readGoldenManifest();
const expected = manifest.contracts.gateway;

function meta(mode = "live") {
  return {
    mode,
    source: "qa-fixture",
    sourceUrl: null,
    asOf: "2026-08-03",
    fetchedAt: "2026-08-13T00:00:00+09:00",
    unit: "USD/FEU",
    isEstimate: false,
    attribution: "Approved QA fixture",
    warnings: [],
    provider: null,
    cache: { hit: mode === "cached", stale: false, ageSeconds: null },
  };
}

function validResult() {
  return {
    schemaVersion: "move-ai/gateway/v1",
    state: "LIVE",
    data: { zero: 0, missing: null },
    meta: meta(),
    error: null,
  };
}

const options = {
  states: new Set(["LIVE", "STALE", "UNAVAILABLE"]),
  staleStateSupported: true,
  decodeData(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Readonly<Record<string, unknown>>;
    return Object.keys(record).sort().join(",") === "missing,zero"
      && record.zero === 0
      && record.missing === null;
  },
};

test("shared contract exports match the approved WT2/WT3/WT6 gateway authority", () => {
  assert.equal(GATEWAY_SCHEMA_VERSION, expected.schemaVersion);
  assert.deepEqual(DATA_MODES, expected.dataModes);
  assert.deepEqual(GATEWAY_ROOT_KEYS, expected.rootKeys);
  assert.deepEqual(GATEWAY_META_KEYS, expected.metaKeys);
  assert.deepEqual(GATEWAY_CACHE_KEYS, expected.cacheKeys);
  assert.deepEqual(GATEWAY_ERROR_KEYS, expected.errorKeys);
  assert.deepEqual(DATA_GATEWAY_METHODS, expected.methods);
});

test("gateway oracle accepts exact success and unavailable envelopes without collapsing null and zero", () => {
  assert.equal(acceptsGatewayResult(validResult(), options), true);
  assert.equal(acceptsGatewayResult({
    schemaVersion: "move-ai/gateway/v1",
    state: "UNAVAILABLE",
    data: null,
    meta: meta("unavailable"),
    error: { code: "NO_VALID_DATA", message: "데이터를 불러올 수 없습니다.", retryable: true, upstreamStatus: null, details: null },
  }, options), true);
});

test("gateway oracle rejects every frozen malformed-envelope class", () => {
  const cases = [];
  cases.push({ ...validResult(), extra: true });
  cases.push({ ...validResult(), meta: { ...meta(), extra: true } });
  cases.push({ ...validResult(), meta: { ...meta(), cache: { ...meta().cache, extra: true } } });
  cases.push({ ...validResult(), state: "FORGED" });
  cases.push({ ...validResult(), state: "UNAVAILABLE", error: { code: "X", message: "x", retryable: false, upstreamStatus: null, details: null } });
  cases.push({ ...validResult(), error: { code: "X", message: "x", retryable: false, upstreamStatus: null, details: null, extra: true } });
  cases.push({ ...validResult(), state: "LIVE", meta: meta("fixture") });
  cases.push({ ...validResult(), meta: { ...meta("cached"), cache: { hit: false, stale: false, ageSeconds: 1 } } });
  cases.push({ ...validResult(), state: "STALE", meta: { ...meta("cached"), cache: { hit: true, stale: false, ageSeconds: 1 } } });
  for (const fixture of cases) assert.equal(acceptsGatewayResult(fixture, options), false);
});

test("exact query oracle rejects missing, duplicate, empty, and extra keys", () => {
  const marketAllowed = new Set(["series", "from", "to", "providerVersion"]);
  assert.equal(acceptsExactQuery(new URLSearchParams("series=fx&from=2026-01-01&to=2026-08-03&providerVersion=3"), marketAllowed, marketAllowed), true);
  assert.equal(acceptsExactQuery(new URLSearchParams("series=fx&from=2026-01-01&to=2026-08-03"), marketAllowed, marketAllowed), false);
  assert.equal(acceptsExactQuery(new URLSearchParams("series=fx&series=oil&from=2026-01-01&to=2026-08-03&providerVersion=3"), marketAllowed, marketAllowed), false);
  assert.equal(acceptsExactQuery(new URLSearchParams("series=&from=2026-01-01&to=2026-08-03&providerVersion=3"), marketAllowed, marketAllowed), false);
  assert.equal(acceptsExactQuery(new URLSearchParams("series=fx&from=2026-01-01&to=2026-08-03&providerVersion=3&extra=1"), marketAllowed, marketAllowed), false);

  assert.equal(acceptsExactQuery(new URLSearchParams("id=KUWI-LAX&days=180"), new Set(["id", "days"]), new Set(["id"])), true);
  assert.equal(acceptsExactQuery(new URLSearchParams("days=180"), new Set(["id", "days"]), new Set(["id"])), false);
  assert.equal(acceptsExactQuery(new URLSearchParams("id=suez-canal&days=180"), new Set(["id"]), new Set(["id"])), false);
});
