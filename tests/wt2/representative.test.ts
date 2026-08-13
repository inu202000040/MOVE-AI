import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_IDS,
  createInsightRequest,
  decodeNewsData,
  decodeRepresentativeSelection,
  selectRepresentativeHorizon,
} from "../../app/freight-risk/dashboard/domain";

const MEMBER_POINTS = [104, 96, 102, 100, 110, 90, 105, 99] as const;

function representativeFixture(): Record<string, unknown> {
  const forecasts = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    targetDate: `2026-08-${String(3 + horizonWeeks * 7).padStart(2, "0")}`,
    point: 96,
    lower90: 80 - horizonWeeks,
    upper90: 110 + horizonWeeks,
  }));
  const metricsByHorizon = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    mapePct: 8 + horizonWeeks,
    mse: 100 + horizonWeeks,
    rmse: 10 + horizonWeeks,
    mase: 0.9,
    mapeScore: 70,
    mseScore: 70,
    maseScore: 70,
    totalScore: 70,
    coverage: {
      pct: 90,
      hits: 45,
      total: 50,
      sampleSize: 52,
      target: 0.9,
      intervalMethod: "PI90",
    },
  }));
  const modelAgreementByHorizon = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    thresholdPct: 3,
    up: 3,
    down: 2,
    flat: 3,
    total: 8,
    members: MODEL_IDS.map((modelId, index) => {
      const point = MEMBER_POINTS[index];
      const changePct = point - 100;
      return {
        modelId,
        modelName: modelId === "sarimax" ? "SARIMAX" : modelId,
        modelVersion: modelId === "sarimax" ? "v1" : `${modelId}-v1`,
        forecastSource: "baseline",
        tuningRunHash: null,
        point,
        changePct,
        direction: changePct >= 3 ? "up" : changePct <= -3 ? "down" : "flat",
      };
    }),
  }));
  return {
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    modelId: "sarimax",
    modelName: "SARIMAX",
    modelVersion: "v1",
    score1w: 70,
    coverage1w: 90,
    selectionMode: "automatic",
    forecastSource: "baseline",
    tuningRunHash: null,
    evaluationProtocol: "rolling-origin-52",
    automaticChampion: {
      modelId: "sarimax",
      modelName: "SARIMAX",
      modelVersion: "v1",
      score1w: 70,
    },
    representativeRevision: `rep-v1:${"0".repeat(64)}`,
    forecasts,
    metricsByHorizon,
    modelAgreementByHorizon,
  };
}

test("representative decoder reconstructs the complete WT3 projection", () => {
  const raw = representativeFixture();
  const decoded = decodeRepresentativeSelection(raw, "KNEI");
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded, raw);
  assert.equal(decoded?.forecasts.length, 4);
  assert.equal(decoded?.metricsByHorizon.length, 4);
  assert.equal(decoded?.modelAgreementByHorizon[0].members.length, 8);

  if (decoded !== null) {
    const selected = selectRepresentativeHorizon(decoded, 4);
    assert.equal(selected.forecast.horizonWeeks, 4);
    assert.equal(selected.metrics.horizonWeeks, 4);
    assert.equal(selected.agreement.horizonWeeks, 4);
  }
});

test("representative decoder rejects route, tuple, arithmetic, and selected-model mismatches", () => {
  assert.equal(decodeRepresentativeSelection(representativeFixture(), "KCI"), null);

  const wrongOrder = representativeFixture();
  const forecasts = wrongOrder.forecasts;
  assert.equal(Array.isArray(forecasts), true);
  if (Array.isArray(forecasts)) {
    forecasts.reverse();
  }
  assert.equal(decodeRepresentativeSelection(wrongOrder), null);

  const wrongCounts = representativeFixture();
  const agreements = wrongCounts.modelAgreementByHorizon;
  if (Array.isArray(agreements) && typeof agreements[0] === "object" && agreements[0] !== null) {
    Reflect.set(agreements[0], "up", 4);
  }
  assert.equal(decodeRepresentativeSelection(wrongCounts), null);

  const mismatchedSelectedPoint = representativeFixture();
  const selectedForecasts = mismatchedSelectedPoint.forecasts;
  if (Array.isArray(selectedForecasts) && typeof selectedForecasts[0] === "object" && selectedForecasts[0] !== null) {
    Reflect.set(selectedForecasts[0], "point", 97);
  }
  assert.equal(decodeRepresentativeSelection(mismatchedSelectedPoint), null);
});

test("representative decoder rejects non-exact objects and invalid source identities", () => {
  const extraRoot = representativeFixture();
  extraRoot.unapproved = true;
  assert.equal(decodeRepresentativeSelection(extraRoot), null);

  const badRevision = representativeFixture();
  badRevision.representativeRevision = "rep-v1:not-a-revision";
  assert.equal(decodeRepresentativeSelection(badRevision), null);

  const badTuned = representativeFixture();
  badTuned.forecastSource = "tuned";
  assert.equal(decodeRepresentativeSelection(badTuned), null);
});

test("insight request consumes the selected representative row and excludes look-ahead news", () => {
  const selection = decodeRepresentativeSelection(representativeFixture(), "KNEI");
  const article = (id: string, publishedAt: string) => ({
    id,
    title: `검증 기사 ${id}`,
    summary: "승인된 요약",
    originalTitle: `Approved article ${id}`,
    source: "Approved News",
    publishedAt,
    effectiveAt: null,
    url: `https://example.com/news/${id}`,
    direction: "하락 압력",
    directionCode: "DOWN",
    factor: "수요 변화",
    relevance: "ROUTE",
    impactScore: 3,
    impactSignals: ["수요 변화"],
    grade: "B",
    gradeLabel: "B 시장 참고",
    reason: "항로와 시장을 직접 언급",
    isBoundary: false,
    provenance: "VERIFIED",
  });
  const news = decodeNewsData({
    routeId: "KNEI",
    stage: "FILTERED",
    llmAnalyzed: false,
    window: { requestedAsOf: "latest", primaryDays: 30, fallbackDays: 90 },
    policy: { providerVersion: 18, maximumArticles: 5 },
    stats: {
      fetchedCandidates: 2,
      filteredCandidates: 2,
      duplicatesRemoved: 0,
      selectedArticles: 2,
      successfulProviders: 1,
      candidateBreakdown: { directImpact: 0, contextual: 2, routeFallback: 0 },
    },
    articles: [article("past", "2026-08-01T00:00:00.000Z"), article("future", "2026-08-04T00:00:00.000Z")],
    attempts: [{ provider: "approved fixture", resultCode: "OK", elapsedMs: 1 }],
  }, "KNEI");
  assert.notEqual(selection, null);
  assert.notEqual(news, null);
  if (selection === null || news === null) {
    return;
  }
  const request = createInsightRequest(selection, 3, news);
  assert.equal(request.selectedHorizon, 3);
  assert.equal(request.forecast.value, selection.forecasts[2].point);
  assert.equal(request.forecast.coveragePct, selection.metricsByHorizon[2].coverage.pct);
  assert.deepEqual(request.modelAgreement, { up: 3, down: 2, flat: 3, total: 8 });
  assert.deepEqual(request.news.map((item) => item.id), ["past"]);
  assert.equal(request.direction, "하락");
});
