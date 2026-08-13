import assert from "node:assert/strict";
import test from "node:test";
import portArtifact from "../../app/data/generated/port-traffic-fixture-v1.json";
import chokeArtifact from "../../app/data/generated/chokepoint-traffic-fixture-v1.json";
import {
  chokeFromArtifact,
  decodeInsightRequestV1,
  decodeMarketDataV1,
  decodeNewsDataV1,
  decodeTuneRequestV1,
  decodeTuneSuccessV1,
  decodeTuningHealthDataV1,
  portFromArtifact,
  type InsightRequestV1,
  type TuneRequestV1,
} from "../../app/data/runtime/domains";
import { fixtureDataGateway } from "../../app/data/runtime/fixture-gateway";
import {
  decodeInsightResultV1,
  decodeNewsResultV1,
  decodeChokepointSummaryResultV1,
  decodePortSummaryResultV1,
  decodeTuningHealthResultV1,
  decodeTuningRunResultV1,
} from "../../app/data/runtime/method-decoders";
import {
  decodePortDetailQueryV1,
  parseMarketQuery,
  parseNewsQuery,
  parsePortQuery,
} from "../../app/data/runtime/queries";
import { gatewaySuccess } from "../../app/data/runtime/result";

const FIXED_CLOCK = "2026-08-13T00:00:00+09:00";

function validInsightRequest(): InsightRequestV1 {
  return decodeInsightRequestV1({
    route: { id: "KNEI", name: "유럽", asOf: "2026-08-03" },
    current: { date: "2026-08-03", value: 4_884 },
    selectedHorizon: 1,
    direction: "보합",
    forecast: { date: "2026-08-10", value: 4_828.98, changePct: -1.1, lower: 4_482.47, upper: 5_175.49, coveragePct: 88.5 },
    forecastPath: [
      { horizon: 1, date: "2026-08-10", value: 4_828.98, lower: 4_482.47, upper: 5_175.49 },
      { horizon: 2, date: "2026-08-17", value: 4_800, lower: 4_400, upper: 5_200 },
      { horizon: 3, date: "2026-08-24", value: 4_780, lower: 4_350, upper: 5_210 },
      { horizon: 4, date: "2026-08-31", value: 4_760, lower: 4_300, upper: 5_220 },
    ],
    representativeModel: { name: "SARIMAX", mapePct: 3.6, mse: 1, mase: 0.037, totalScore: 1 },
    modelAgreement: { up: 1, down: 4, flat: 3, total: 8 },
    news: [{
      id: "n1", title: "검증 기사", summary: "검증 요약", source: "Provider", publishedAt: "2026-08-03T00:00:00Z",
      url: "https://example.com/article", directionCode: "UP", factor: "상방 압력", grade: "A", reason: "route evidence",
    }],
  });
}

function validTuneRequest(): TuneRequestV1 {
  const start = Date.UTC(2024, 0, 1);
  const dates = Array.from({ length: 108 }, (_, index) => new Date(start + index * 7 * 86_400_000).toISOString().slice(0, 10));
  return decodeTuneRequestV1({
    routeCode: "KNEI", modelId: "sarimax", dates, values: dates.map((_, index) => 1_000 + index),
    trainingWindow: "expanding", evaluationOrigins: 36, parameters: { p: 1 },
  });
}

function validNewsData() {
  return {
    routeId: "KNEI", stage: "FILTERED", llmAnalyzed: false,
    window: { from: "2026-07-15", to: "2026-08-13", days: 30 },
    policy: { providerVersion: 18, retry: 0 },
    stats: { fetchedCandidates: 1, filteredCandidates: 1, duplicatesRemoved: 0, selectedArticles: 1, successfulProviders: 1, candidateBreakdown: { directImpact: 1, contextual: 0, routeFallback: 0 } },
    articles: [{
      id: "1", title: "검증 기사", summary: "요약", originalTitle: "Original", source: "Provider",
      publishedAt: "2026-08-13T00:00:00+09:00", effectiveAt: null, url: "https://example.com/article",
      direction: "상승 압력", directionCode: "UP", factor: "상방", relevance: "ROUTE", impactScore: 1,
      impactSignals: ["route"], grade: "A", gradeLabel: "A 직접 운영 영향", reason: "verified",
      isBoundary: false, provenance: "VERIFIED",
    }],
    attempts: [{ provider: "Provider", resultCode: "OK", elapsedMs: 1, from: "2026-07-15", to: "2026-08-13" }],
  };
}

function validTuningHealth() {
  const ids = ["naive", "sarimax", "lightgbm", "xgboost", "random_forest", "prophet", "timesfm", "chronos"];
  return {
    serviceVersion: "engine-v1",
    capabilities: ids.map((id) => ({ id, available: true, execution: "native", version: "1", reasonCode: null, checkedAt: FIXED_CLOCK, probeId: `probe-${id}`, probeStatus: "PASS" })),
  };
}

function validTuneSuccess(request: TuneRequestV1) {
  const origin = request.dates.at(-1) ?? "2026-01-01";
  const addWeeks = (date: string, weeks: number) => new Date(Date.parse(`${date}T00:00:00Z`) + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  const evaluationByHorizon = [1, 2, 3, 4].map((horizon) => ({
    horizon,
    records: Array.from({ length: 36 }, (_, index) => {
      const forecastOrigin = addWeeks("2024-01-01", index);
      return { forecastOrigin, targetDate: addWeeks(forecastOrigin, horizon), predicted: 100, actual: 100, difference: 0, absoluteError: 0, apePct: 0, lower90: 90, upper90: 110, covered90: true };
    }),
  }));
  return {
    status: "success", routeCode: request.routeCode, modelId: request.modelId, modelVersion: "1", forecastOrigin: origin,
    maseProtocol: "seasonal-naive-52-fixed", trainingWindow: request.trainingWindow, evaluationOrigins: 36, parameters: request.parameters,
    forecasts: [1, 2, 3, 4].map((horizon) => ({ horizon, date: addWeeks(origin, horizon), value: 100, lower90: 90, upper90: 110 })),
    metricsByHorizon: [1, 2, 3, 4].map((horizon) => ({ horizon, mapePct: 0, mse: 0, rmse: 0, mase: 0, coverage90Pct: 100, hits: 36, total: 36, sampleSize: 36 })),
    evaluationByHorizon, elapsedMs: 1, methodologyKo: "SARIMAX expanding window",
  };
}

test("traffic decoders reconstruct every nested record and enforce key, identity, counts, and detail", () => {
  const validPort = portFromArtifact(portArtifact);
  assert.equal(Object.keys(validPort.summaries).length, 57);
  const badPortRecord = structuredClone(validPort) as Record<string, unknown>;
  badPortRecord.summaries = { BAD: {} };
  assert.throws(() => decodePortSummaryResultV1(gatewaySuccess({ state: "STALE", data: badPortRecord, mode: "fixture", source: "port", asOf: "2026-08-07", fetchedAt: FIXED_CLOCK, unit: "metric_tons_estimated,calls", isEstimate: true, attribution: "PortWatch", stale: true })), /catalog IDs/u);

  const mismatchedPort = structuredClone(validPort);
  const firstPort = Object.keys(mismatchedPort.summaries)[0];
  Object.defineProperty(mismatchedPort.summaries[firstPort], "portId", { value: "BAD" });
  assert.throws(() => decodePortSummaryResultV1(gatewaySuccess({ state: "STALE", data: mismatchedPort, mode: "fixture", source: "port", asOf: "2026-08-07", fetchedAt: FIXED_CLOCK, unit: "metric_tons_estimated,calls", isEstimate: true, attribution: "PortWatch", stale: true })), /canonical|identity|portId/u);

  const badCount = structuredClone(validPort) as Record<string, unknown>;
  badCount.availableSeriesCount = 55;
  assert.throws(() => decodePortSummaryResultV1(gatewaySuccess({ state: "STALE", data: badCount, mode: "fixture", source: "port", asOf: "2026-08-07", fetchedAt: FIXED_CLOCK, unit: "metric_tons_estimated,calls", isEstimate: true, attribution: "PortWatch", stale: true })), /counts/u);

  const validChoke = chokeFromArtifact(chokeArtifact);
  const badChoke = structuredClone(validChoke) as Record<string, unknown>;
  badChoke.summaries = { BAD: {} };
  assert.throws(() => decodeChokepointSummaryResultV1(gatewaySuccess({ state: "STALE", data: badChoke, mode: "fixture", source: "choke", asOf: "2026-08-09", fetchedAt: FIXED_CLOCK, unit: "metric_tons_estimated,calls", isEstimate: true, attribution: "PortWatch", stale: true })), /catalog IDs/u);
});

test("insight request/output decoders reject malformed news, evidence, factor limits, and engine-state mismatch", async () => {
  const request = validInsightRequest();
  const result = await fixtureDataGateway.insight(request);
  assert.equal(decodeInsightResultV1(result, request).state, "DERIVED");
  assert.equal(result.data?.quantitativeBasis.length, 3);

  const badFactor = structuredClone(result);
  if (badFactor.data) Reflect.set(badFactor.data, "upwardFactors", [{}]);
  assert.throws(() => decodeInsightResultV1(badFactor, request), /keys/u);
  const wrongEvidence = structuredClone(result);
  if (wrongEvidence.data) Reflect.set(wrongEvidence.data, "upwardFactors", [{ factor: "x", evidenceId: "unknown" }]);
  assert.throws(() => decodeInsightResultV1(wrongEvidence, request), /request news/u);
  const shortBasis = structuredClone(result);
  if (shortBasis.data) Reflect.set(shortBasis.data, "quantitativeBasis", ["one"]);
  assert.throws(() => decodeInsightResultV1(shortBasis, request), /quantitativeBasis/u);

  const falseLlm = structuredClone(result);
  Reflect.set(falseLlm, "state", "LLM");
  assert.throws(() => decodeInsightResultV1(falseLlm, request), /Gemini/u);
  const tooManyNews = { ...request, news: Array.from({ length: 6 }, () => request.news[0]) };
  assert.throws(() => decodeInsightRequestV1(tooManyNews), /five/u);
  const badUrl = { ...request, news: [{ ...request.news[0], url: "file:///secret" }] };
  assert.throws(() => decodeInsightRequestV1(badUrl), /http/u);
  const future = { ...request, news: [{ ...request.news[0], publishedAt: "2026-08-04T00:00:00Z" }] };
  assert.throws(() => decodeInsightRequestV1(future), /future/u);
});

test("market/news parsing and method decoders enforce calendar, opaque refresh, nested payload, and request identity", () => {
  assert.throws(() => parseMarketQuery(new URLSearchParams("series=fx&from=2026-02-31&to=2026-03-01&providerVersion=3")), /ISO date/u);
  const query = parseNewsQuery(new URLSearchParams("route=KNEI&asOf=2026-08-13&providerVersion=18&retry=0&refresh=nonce-123"));
  assert.equal(query.refresh, "nonce-123");
  const news = validNewsData();
  assert.equal(decodeNewsDataV1(news).articles.length, 1);
  const envelope = gatewaySuccess({ state: "LIVE", data: news, mode: "live", source: "news", asOf: "2026-08-13", fetchedAt: FIXED_CLOCK, unit: "articles", isEstimate: false, attribution: "providers", provider: "NEWS_V18" });
  assert.equal(decodeNewsResultV1(envelope, query).state, "LIVE");
  const malformed = structuredClone(news) as { articles: Record<string, unknown>[] };
  malformed.articles[0].directionCode = "SIDEWAYS";
  assert.throws(() => decodeNewsDataV1(malformed), /directionCode/u);
  const future = structuredClone(news) as { articles: Record<string, unknown>[] };
  future.articles[0].publishedAt = "2026-08-14T00:00:00Z";
  assert.throws(() => decodeNewsDataV1(future), /Future/u);
  const attempt = { series: "fx", label: "FX", unit: "KRW/USD", provider: "ECB", aggregation: "weekly", observationStart: "2026-08-01", observationEnd: "2026-08-01", points: [{ date: "2026-08-01", week: "2026-W31", value: 1 }], attempts: [{ provider: "ECB", resultCode: "OK", elapsedMs: Number.NaN }] };
  assert.throws(() => decodeMarketDataV1(attempt), /finite/u);
});

test("port detail days use one round-and-clamp normalization policy", () => {
  assert.deepEqual(decodePortDetailQueryV1({ id: "KUWI-LAX", days: 180.4 }), { id: "KUWI-LAX", days: 180 });
  assert.deepEqual(decodePortDetailQueryV1({ id: "KUWI-LAX", days: 1 }), { id: "KUWI-LAX", days: 30 });
  assert.deepEqual(decodePortDetailQueryV1({ id: "KUWI-LAX", days: 900 }), { id: "KUWI-LAX", days: 730 });
  assert.deepEqual(decodePortDetailQueryV1({ id: "KUWI-LAX", days: Number.NaN }), { id: "KUWI-LAX", days: 180 });
  assert.deepEqual(parsePortQuery(new URLSearchParams("id=KUWI-LAX&days=180.4")), { kind: "detail", query: { id: "KUWI-LAX", days: 180 } });
  assert.deepEqual(parsePortQuery(new URLSearchParams("id=KUWI-LAX&days=1")), { kind: "detail", query: { id: "KUWI-LAX", days: 30 } });
  assert.deepEqual(parsePortQuery(new URLSearchParams("id=KUWI-LAX&days=900")), { kind: "detail", query: { id: "KUWI-LAX", days: 730 } });
  assert.deepEqual(parsePortQuery(new URLSearchParams("id=KUWI-LAX&days=not-finite")), { kind: "detail", query: { id: "KUWI-LAX", days: 180 } });
  assert.throws(() => decodePortDetailQueryV1({ id: "KUWI-LAX", days: "180" }), /number|숫자/u);
});

test("tuning request, health, and success decoders enforce exact model policy and tuple identities", () => {
  const request = validTuneRequest();
  const unknown = { ...request, parameters: { totallyUnknownParameter: 1 } };
  assert.throws(() => decodeTuneRequestV1(unknown), /Unknown parameter/u);
  assert.throws(() => decodeTuneRequestV1({ ...request, parameters: { p: 4 } }), /range/u);
  assert.throws(() => decodeTuneRequestV1({ ...request, parameters: { p: true } }), /number/u);
  const brokenDates = [...request.dates];
  brokenDates[2] = new Date(Date.parse(`${brokenDates[1]}T00:00:00Z`) + 8 * 86_400_000).toISOString().slice(0, 10);
  const brokenWeek = { ...request, dates: brokenDates };
  assert.throws(() => decodeTuneRequestV1(brokenWeek), /weekly/u);

  const health = validTuningHealth();
  assert.equal(decodeTuningHealthDataV1(health).capabilities.length, 8);
  const healthEnvelope = gatewaySuccess({ state: "LIVE", data: health, mode: "live", source: "tuning", asOf: null, fetchedAt: FIXED_CLOCK, unit: null, isEstimate: false, attribution: "engine", provider: "TUNING_ENGINE" });
  assert.equal(decodeTuningHealthResultV1(healthEnvelope).state, "LIVE");
  const badHealth = structuredClone(health) as { capabilities: Record<string, unknown>[] };
  badHealth.capabilities[0].id = "sarimax";
  assert.throws(() => decodeTuningHealthDataV1(badHealth), /id/u);

  const success = validTuneSuccess(request);
  assert.equal(decodeTuneSuccessV1(success).forecasts.length, 4);
  const successEnvelope = gatewaySuccess({ state: "READY", data: success, mode: "live", source: "tuning", asOf: success.forecastOrigin, fetchedAt: FIXED_CLOCK, unit: "USD/FEU", isEstimate: true, attribution: "engine", provider: "TUNING_ENGINE" });
  assert.equal(decodeTuningRunResultV1(successEnvelope, request).state, "READY");
  const shortTuple = structuredClone(success) as { forecasts: unknown[] };
  shortTuple.forecasts.pop();
  assert.throws(() => decodeTuneSuccessV1(shortTuple), /length/u);
});

test("state/meta coupling rejects fixture LIVE, stale without flag, unsafe URL, and malformed asOf", async () => {
  const port = await fixtureDataGateway.portSummary();
  const fixtureLive = structuredClone(port);
  Reflect.set(fixtureLive, "state", "LIVE");
  Reflect.set(fixtureLive.meta.cache, "stale", false);
  assert.throws(() => decodePortSummaryResultV1(fixtureLive), /Fixture port/u);
  const staleWithoutFlag = structuredClone(port);
  Reflect.set(staleWithoutFlag.meta.cache, "stale", false);
  assert.throws(() => decodePortSummaryResultV1(staleWithoutFlag), /STALE/u);
  const unsafeUrl = structuredClone(port);
  Reflect.set(unsafeUrl.meta, "sourceUrl", "https://user:password@example.com/data");
  assert.throws(() => decodePortSummaryResultV1(unsafeUrl), /credentials/u);
  const malformedAsOf = structuredClone(port);
  Reflect.set(malformedAsOf.meta, "asOf", "2026-02-31");
  assert.throws(() => decodePortSummaryResultV1(malformedAsOf), /date|timestamp/u);
});
