import assert from "node:assert/strict";
import test from "node:test";
import { GET as marketGet } from "../../app/api/freight-risk/market/route";
import { GET as newsGet } from "../../app/api/freight-risk/news/route";
import { POST as insightPost } from "../../app/api/freight-risk/insight/route";
import { GET as tuneGet, POST as tunePost } from "../../app/api/freight-risk/tune/route";
import { GET as portGet } from "../../app/api/globe-port-traffic/route";
import { GET as chokeGet } from "../../app/api/globe-chokepoint-traffic/route";
import { GET as weatherGet } from "../../app/api/globe-weather/route";
import {
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_DETAIL_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
} from "../../app/contracts/gateway";

type RouteHandler = (request: Request) => Promise<Response>;

async function call(handler: RouteHandler, url: string, init?: RequestInit) {
  const response = await handler(new Request(url, init));
  const body: unknown = await response.json();
  return { response, body };
}

function assertEnvelope(value: unknown): asserts value is {
  readonly state: string;
  readonly data: unknown;
  readonly meta: { readonly mode: string; readonly asOf: string | null; readonly unit: string | null; readonly cache: unknown };
  readonly error: null | { readonly code: string; readonly details: unknown };
} {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  const root = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(root), GATEWAY_ROOT_KEYS);
  assert.ok(typeof root.meta === "object" && root.meta !== null && !Array.isArray(root.meta));
  const meta = root.meta as Record<string, unknown>;
  assert.deepEqual(Object.keys(meta), GATEWAY_META_KEYS);
  assert.ok(typeof meta.cache === "object" && meta.cache !== null && !Array.isArray(meta.cache));
  assert.deepEqual(Object.keys(meta.cache), GATEWAY_CACHE_KEYS);
  if (root.error !== null) {
    assert.ok(typeof root.error === "object" && !Array.isArray(root.error));
    const error = root.error as Record<string, unknown>;
    assert.deepEqual(Object.keys(error), GATEWAY_ERROR_KEYS);
    assert.ok(typeof error.details === "object" && error.details !== null && !Array.isArray(error.details));
    assert.deepEqual(Object.keys(error.details), GATEWAY_ERROR_DETAIL_KEYS);
  }
}

test("market route returns truthful HARPEX reference and exact public envelope", async () => {
  const { response, body } = await call(
    marketGet,
    "http://localhost/api/freight-risk/market?series=harpex&from=2026-07-01&to=2026-08-31&providerVersion=3",
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400");
  assertEnvelope(body);
  assert.equal(body.state, "REFERENCE");
  assert.equal(body.meta.mode, "fixture");
  assert.equal(body.meta.unit, "Index");
  assert.equal(body.error, null);
});

test("market exact query rejects missing, duplicate, extra, wrong version, and reversed date", async () => {
  const invalidUrls = [
    "?series=harpex&from=2026-07-01&to=2026-08-31",
    "?series=harpex&series=oil&from=2026-07-01&to=2026-08-31&providerVersion=3",
    "?series=harpex&from=2026-07-01&to=2026-08-31&providerVersion=3&extra=1",
    "?series=harpex&from=2026-07-01&to=2026-08-31&providerVersion=2",
    "?series=harpex&from=2026-09-01&to=2026-08-31&providerVersion=3",
    "?series=harpex&from=2026-02-31&to=2026-03-01&providerVersion=3",
  ];
  for (const query of invalidUrls) {
    const { response, body } = await call(marketGet, `http://localhost/api/freight-risk/market${query}`);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertEnvelope(body);
    assert.equal(body.state, "UNAVAILABLE");
    assert.equal(body.data, null);
    assert.equal(body.error?.code, "INVALID_REQUEST");
  }
});

test("news compatibility route normalizes legacy input but never fabricates articles", async () => {
  const { response, body } = await call(newsGet, "http://localhost/api/freight-risk/news?route=UNKNOWN&asOf=bad&providerVersion=7&unknown=1");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assertEnvelope(body);
  assert.equal(body.state, "UNAVAILABLE");
  assert.equal(body.data, null);
  assert.equal(body.meta.mode, "unavailable");
});

function validInsightBody() {
  return {
    route: { id: "KNEI", name: "유럽", asOf: "2026-08-03" },
    current: { date: "2026-08-03", value: 4_884 },
    selectedHorizon: 1,
    direction: "보합",
    forecast: { date: "2026-08-10", value: 4_828.98, changePct: -1.1, lower: 4_482.47, upper: 5_175.49, coveragePct: 88.5 },
    forecastPath: [1, 2, 3, 4].map((horizon) => ({ horizon, date: `2026-08-${String(3 + horizon * 7).padStart(2, "0")}`, value: 4_828.98, lower: 4_482.47, upper: 5_175.49 })),
    representativeModel: { name: "SARIMAX", mapePct: 3.6, mse: 1, mase: 0.037, totalScore: 1 },
    modelAgreement: { up: 1, down: 4, flat: 3, total: 8 },
    news: [],
  };
}

test("insight route validates exact body then returns deterministic no-store fallback", async () => {
  const { response, body } = await call(insightPost, "http://localhost/api/freight-risk/insight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validInsightBody()),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assertEnvelope(body);
  assert.equal(body.state, "DERIVED");
  assert.equal(body.meta.mode, "fixture");
  assert.equal((body.data as { engine: string }).engine, "RULE_FALLBACK");

  const malformed = { ...validInsightBody(), extra: true };
  const rejected = await call(insightPost, "http://localhost/api/freight-risk/insight", {
    method: "POST",
    body: JSON.stringify(malformed),
  });
  assert.equal(rejected.response.status, 400);
  assertEnvelope(rejected.body);
  assert.equal(rejected.body.data, null);
});

test("tuning health and valid run truthfully report deployed engine unavailable", async () => {
  const health = await call(tuneGet, "http://localhost/api/freight-risk/tune");
  assert.equal(health.response.status, 503);
  assertEnvelope(health.body);
  assert.equal(health.body.state, "UNAVAILABLE");
  assert.equal(health.body.error?.details !== null, true);

  const start = Date.UTC(2024, 0, 1);
  const dates = Array.from({ length: 108 }, (_, index) => new Date(start + index * 7 * 86_400_000).toISOString().slice(0, 10));
  const run = await call(tunePost, "http://localhost/api/freight-risk/tune", {
    method: "POST",
    body: JSON.stringify({ routeCode: "KNEI", modelId: "sarimax", dates, values: dates.map((_, index) => 1_000 + index), trainingWindow: "expanding", evaluationOrigins: 36, parameters: { p: 1 } }),
  });
  assert.equal(run.response.status, 503);
  assertEnvelope(run.body);
  assert.equal(run.body.state, "UNAVAILABLE");

  const invalid = await call(tunePost, "http://localhost/api/freight-risk/tune", { method: "POST", body: JSON.stringify({}) });
  assert.equal(invalid.response.status, 400);
  const unknownParameter = await call(tunePost, "http://localhost/api/freight-risk/tune", {
    method: "POST",
    body: JSON.stringify({ routeCode: "KNEI", modelId: "sarimax", dates, values: dates.map((_, index) => 1_000 + index), trainingWindow: "expanding", evaluationOrigins: 36, parameters: { totallyUnknownParameter: 1 } }),
  });
  assert.equal(unknownParameter.response.status, 400);
  assertEnvelope(unknownParameter.body);
  assert.equal(unknownParameter.body.error?.code, "INVALID_REQUEST");
});

test("port route exposes keyed stale fixture, detail boundaries, and exact query rejection", async () => {
  const summary = await call(portGet, "http://localhost/api/globe-port-traffic");
  assert.equal(summary.response.status, 200);
  assertEnvelope(summary.body);
  assert.equal(summary.body.state, "STALE");
  assert.equal(summary.body.meta.asOf, "2026-08-07");
  assert.deepEqual(summary.body.meta.cache, { hit: false, stale: true, ageSeconds: null });
  assert.equal(Object.keys((summary.body.data as { summaries: object }).summaries).length, 57);

  for (const query of ["?port=KUWI-LAX", "?days=90", "?id=KUWI-LAX&extra=1", "?id=UNKNOWN"]) {
    const rejected = await call(portGet, `http://localhost/api/globe-port-traffic${query}`);
    assert.equal(rejected.response.status, 400, query);
    assertEnvelope(rejected.body);
    assert.equal(rejected.body.data, null);
  }
  const detail = await call(portGet, "http://localhost/api/globe-port-traffic?id=KUWI-LAX&days=1");
  assert.equal(detail.response.status, 200);
  assert.equal((detail.body as { data: { detail: { points: unknown[] } } }).data.detail.points.length, 30);
});

test("chokepoint route rejects days and weather rejects every query key", async () => {
  const choke = await call(chokeGet, "http://localhost/api/globe-chokepoint-traffic");
  assert.equal(choke.response.status, 200);
  assertEnvelope(choke.body);
  assert.equal(choke.body.state, "STALE");
  assert.equal(choke.body.meta.asOf, "2026-08-09");
  assert.equal(Object.keys((choke.body.data as { summaries: object }).summaries).length, 11);

  const chokeInvalid = await call(chokeGet, "http://localhost/api/globe-chokepoint-traffic?id=korea-strait&days=90");
  assert.equal(chokeInvalid.response.status, 400);
  const weatherInvalid = await call(weatherGet, "http://localhost/api/globe-weather?days=1");
  assert.equal(weatherInvalid.response.status, 400);
  const weather = await call(weatherGet, "http://localhost/api/globe-weather");
  assert.equal(weather.response.status, 200);
  assertEnvelope(weather.body);
  assert.equal(weather.body.state, "UNAVAILABLE");
  assert.equal(weather.body.data, null);
});
