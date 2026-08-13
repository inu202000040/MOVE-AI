import assert from "node:assert/strict";
import test from "node:test";
import { GET as marketGet } from "../../app/api/freight-risk/market/route";
import { GET as newsGet } from "../../app/api/freight-risk/news/route";
import { POST as insightPost } from "../../app/api/freight-risk/insight/route";
import { GET as tuneGet, POST as tunePost } from "../../app/api/freight-risk/tune/route";
import { GET as portGet } from "../../app/api/globe-port-traffic/route";
import { GET as chokeGet } from "../../app/api/globe-chokepoint-traffic/route";
import { GET as globeSignalsGet } from "../../app/api/globe-signals/route";
import { GET as weatherGet } from "../../app/api/globe-weather/route";
import {
  adaptDataGatewayV1,
  createSameOriginDataGatewayV1,
  SameOriginHttpDataGateway,
  type SameOriginFetchV1,
} from "../../app/data/runtime/data-gateway.client";
import {
  createFixtureDataAccessV1,
  createFixtureDataGatewayV1,
  createSameOriginDataAccessV1,
} from "../../app/data/runtime/data-gateway.server";
import type { DataGatewayV1 } from "../../app/contracts/gateway";
import { FixtureDataGateway } from "../../app/data/runtime/fixture-gateway";
import { decodeInsightRequestV1, decodeTuneRequestV1 } from "../../app/data/runtime/domains";

type Handler = (request: Request) => Promise<Response>;

const fixtureContractProbe: DataGatewayV1 = createFixtureDataGatewayV1();
const httpContractProbe: DataGatewayV1 = createSameOriginDataGatewayV1();
const adaptedContractProbe: DataGatewayV1 = adaptDataGatewayV1(new FixtureDataGateway());
void fixtureContractProbe;
void httpContractProbe;
void adaptedContractProbe;

function validInsightRequest() {
  return decodeInsightRequestV1({
    route: { id: "KNEI", name: "유럽", asOf: "2026-08-03" }, current: { date: "2026-08-03", value: 4_884 },
    selectedHorizon: 1, direction: "보합", forecast: { date: "2026-08-10", value: 4_828.98, changePct: -1.1, lower: 4_482.47, upper: 5_175.49, coveragePct: 88.5 },
    forecastPath: [
      { horizon: 1, date: "2026-08-10", value: 4_828.98, lower: 4_482.47, upper: 5_175.49 },
      { horizon: 2, date: "2026-08-17", value: 4_800, lower: 4_400, upper: 5_200 },
      { horizon: 3, date: "2026-08-24", value: 4_780, lower: 4_350, upper: 5_210 },
      { horizon: 4, date: "2026-08-31", value: 4_760, lower: 4_300, upper: 5_220 },
    ],
    representativeModel: { name: "SARIMAX", mapePct: 3.6, mse: 1, mase: 0.037, totalScore: 1 },
    modelAgreement: { up: 1, down: 4, flat: 3, total: 8 }, news: [],
  });
}

function validTuneRequest() {
  const start = Date.UTC(2024, 0, 1);
  const dates = Array.from({ length: 108 }, (_, index) => new Date(start + index * 7 * 86_400_000).toISOString().slice(0, 10));
  return decodeTuneRequestV1({ routeCode: "KNEI", modelId: "sarimax", dates, values: dates.map((_, index) => 1_000 + index), trainingWindow: "expanding", evaluationOrigins: 36, parameters: { p: 1 } });
}

test("one exported factory supplies validated in-process snapshot/catalog and all seven same-origin APIs", async () => {
  const observed: string[] = [];
  const fetchSameOrigin: SameOriginFetchV1 = async (input, init) => {
    assert.match(input, /^\/api\//u);
    const request = new Request(`http://localhost${input}`, init);
    observed.push(`${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`);
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}`;
    const handlers: Readonly<Record<string, Handler>> = {
      "GET /api/freight-risk/market": marketGet,
      "GET /api/freight-risk/news": newsGet,
      "POST /api/freight-risk/insight": insightPost,
      "GET /api/freight-risk/tune": tuneGet,
      "POST /api/freight-risk/tune": tunePost,
      "GET /api/globe-port-traffic": portGet,
      "GET /api/globe-chokepoint-traffic": chokeGet,
      "GET /api/globe-signals": globeSignalsGet,
      "GET /api/globe-weather": weatherGet,
    };
    const handler = handlers[key];
    if (!handler) return Response.json({}, { status: 404 });
    return handler(request);
  };

  const access = await createSameOriginDataAccessV1(fetchSameOrigin);
  assert.equal((await access.gateway.snapshot()).state, "READY");
  assert.equal(access.artifacts.networkCatalog.routes.length, 13);
  assert.equal(access.artifacts.networkCatalogIdentity.catalogSeamSha256.length, 64);
  assert.equal(observed.length, 0, "snapshot/catalog must not create public HTTP requests");

  assert.equal((await access.gateway.market({ series: "harpex", from: "2026-07-01", to: "2026-08-31", providerVersion: 3 })).state, "REFERENCE");
  const previousMode = process.env.MOVE_AI_DATA_MODE;
  process.env.MOVE_AI_DATA_MODE = "fixture";
  try {
    assert.equal((await access.gateway.news({ route: "KNEI", asOf: "2026-08-13", providerVersion: 18, retry: 0, refresh: "nonce-123" })).state, "UNAVAILABLE");
  } finally {
    if (previousMode === undefined) delete process.env.MOVE_AI_DATA_MODE;
    else process.env.MOVE_AI_DATA_MODE = previousMode;
  }
  assert.equal((await access.gateway.insight({ ...validInsightRequest() })).state, "DERIVED");
  assert.equal((await access.gateway.tuningHealth()).state, "UNAVAILABLE");
  assert.equal((await access.gateway.tuningRun({ ...validTuneRequest() })).state, "UNAVAILABLE");
  assert.equal((await access.gateway.portSummary()).state, "STALE");
  assert.equal((await access.typedGateway.portDetail({ id: "KUWI-LAX", days: 30 })).data?.detail?.portId, "KUWI-LAX");
  assert.equal((await access.gateway.chokeSummary()).state, "STALE");
  assert.equal((await access.typedGateway.chokeDetail({ id: "korea-strait" })).data?.detail?.chokepointId, "korea-strait");
  const weather = await access.gateway.weather();
  assert.ok(["LIVE", "PARTIAL", "UNAVAILABLE"].includes(weather.state));
  if (weather.state === "UNAVAILABLE") {
    assert.equal(weather.data, null);
  } else {
    assert.equal((weather.data as { readonly locationCount: number }).locationCount, 82);
  }

  assert.ok(observed.some((entry) => entry.includes("refresh=nonce-123")));
  assert.deepEqual(new Set(observed.map((entry) => new URL(`http://localhost${entry.slice(entry.indexOf(" ") + 1)}`).pathname)), new Set([
    "/api/freight-risk/market", "/api/freight-risk/news", "/api/freight-risk/insight", "/api/freight-risk/tune",
    "/api/globe-signals", "/api/globe-weather",
  ]));

  const fixture = await createFixtureDataAccessV1();
  assert.equal((await fixture.gateway.snapshot()).state, "READY");
  assert.strictEqual(fixture.artifacts, access.artifacts);
});

test("same-origin client never blesses malformed HTTP JSON as caller-selected domain data", async () => {
  const malformed = new SameOriginHttpDataGateway(async () => Response.json({
    schemaVersion: "move-ai/gateway/v1", state: "LIVE", data: { arbitrary: true },
    meta: { mode: "live", source: "bad", sourceUrl: null, asOf: "2026-08-13", fetchedAt: "2026-08-13T00:00:00Z", unit: "KRW/USD", isEstimate: false, attribution: "bad", warnings: [], provider: "bad", cache: { hit: false, stale: false, ageSeconds: null } },
    error: null,
  }));
  await assert.rejects(
    malformed.market({ series: "fx", from: "2026-08-01", to: "2026-08-13", providerVersion: 3 }),
    /keys/u,
  );

  const canonicalFixture = createFixtureDataGatewayV1();
  await assert.rejects(
    canonicalFixture.market({ series: "harpex", from: "2026-07-01", to: "2026-08-31", providerVersion: 3, extra: true }),
    /keys/u,
  );
  const canonicalMarket = await canonicalFixture.market({ series: "harpex", from: "2026-07-01", to: "2026-08-31", providerVersion: 3 });
  assert.equal(canonicalMarket.state, "REFERENCE");
});

test("client snapshot is truthful UNAVAILABLE unless a validated provider is injected", async () => {
  const clientOnly = createSameOriginDataGatewayV1(async () => Response.json({}));
  const unavailable = await clientOnly.snapshot();
  assert.equal(unavailable.state, "UNAVAILABLE");
  assert.equal(unavailable.data, null);
  assert.equal(unavailable.meta.mode, "unavailable");

  const validated = await createSameOriginDataAccessV1(async () => Response.json({}));
  const injected = createSameOriginDataGatewayV1(async () => Response.json({}), () => validated.artifacts.snapshot);
  assert.equal((await injected.snapshot()).state, "READY");
});
