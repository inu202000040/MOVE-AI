import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_INSIGHT_STATE,
  INITIAL_NEWS_STATE,
  chooseNewsRetryResult,
  decodeInsightResult,
  decodeNewsResult,
  reduceInsightState,
  reduceNewsState,
} from "../../app/freight-risk/dashboard/domain";

function gatewayMeta(mode: "live" | "cached" | "fixture" | "reference" | "unavailable") {
  return {
    mode,
    source: "approved fixture",
    sourceUrl: null,
    asOf: "2026-08-03",
    fetchedAt: "2026-08-13T00:00:00.000Z",
    unit: null,
    isEstimate: false,
    cache: { hit: mode === "cached", stale: false, ageSeconds: mode === "cached" ? 10 : null },
  };
}

function article(id = "1") {
  return {
    id,
    title: "유럽 항로 운임 소식",
    summary: "승인된 요약입니다.",
    originalTitle: "Europe freight update",
    source: "Approved News",
    publishedAt: "2026-08-01T00:00:00.000Z",
    effectiveAt: null,
    url: `https://example.com/news/${id}`,
    direction: "상승 압력",
    directionCode: "UP",
    factor: "운임 인상",
    relevance: "ROUTE",
    impactScore: 10,
    impactSignals: ["운임·할증료"],
    grade: "S",
    gradeLabel: "S 직접 가격·운항",
    reason: "항로와 운임을 직접 언급",
    isBoundary: false,
    provenance: "VERIFIED",
  };
}

function liveNews(articleCount = 1, mode: "live" | "cached" = "live") {
  const articles = Array.from({ length: articleCount }, (_, index) => article(String(index + 1)));
  return {
    schemaVersion: "move-ai/gateway-v1",
    state: "LIVE",
    data: {
      routeId: "KNEI",
      stage: "FILTERED",
      llmAnalyzed: false,
      window: { requestedAsOf: "latest", primaryDays: 30, fallbackDays: 90 },
      policy: { providerVersion: 18, maximumArticles: 5 },
      stats: {
        fetchedCandidates: 8,
        filteredCandidates: 5,
        duplicatesRemoved: 2,
        selectedArticles: articleCount,
        successfulProviders: 2,
        candidateBreakdown: { directImpact: 2, contextual: 2, routeFallback: 1 },
      },
      articles,
      attempts: [{ provider: "approved fixture", resultCode: "OK", elapsedMs: 1 }],
    },
    error: null,
    meta: gatewayMeta(mode),
  };
}

function unavailableNews(code = "PROVIDER_UNAVAILABLE") {
  return {
    schemaVersion: "move-ai/gateway-v1",
    state: "UNAVAILABLE",
    data: null,
    error: { code, message: "뉴스를 사용할 수 없습니다.", retryable: true },
    meta: gatewayMeta("unavailable"),
  };
}

function insightResult(state: "LLM" | "DERIVED", mode: "live" | "cached" = "live") {
  const gemini = state === "LLM";
  return {
    schemaVersion: "move-ai/gateway-v1",
    state,
    data: {
      engine: gemini ? "GEMINI" : "RULE_FALLBACK",
      model: gemini ? "gemini-2.5-flash" : null,
      generatedAt: "2026-08-13T00:00:00.000Z",
      headline: "유럽 항로는 1주 후 보합권으로 전망됩니다.",
      summary: "정량 예측과 검증 뉴스를 함께 해석했습니다.",
      confidence: "보통",
      quantitativeBasis: ["PI90 80–110", "SARIMAX MAPE 9.0%", "모델 의견 상승 3·보합 3·하락 2"],
      upwardFactors: [{ factor: "운임 인상", evidenceId: "1" }],
      downwardFactors: [],
      caution: "뉴스는 예측값의 직접적인 인과 근거가 아닙니다.",
    },
    error: null,
    meta: gatewayMeta(mode),
  };
}

function unavailableInsight() {
  return {
    schemaVersion: "move-ai/gateway-v1",
    state: "UNAVAILABLE",
    data: null,
    error: { code: "INSIGHT_UNAVAILABLE", message: "해석을 사용할 수 없습니다.", retryable: true },
    meta: gatewayMeta("unavailable"),
  };
}

test("news decoder exhaustively validates and reconstructs the gateway payload", () => {
  const raw = liveNews();
  const decoded = decodeNewsResult(raw, "KNEI");
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded, raw);
  assert.notStrictEqual(decoded?.data, raw.data);
  assert.notStrictEqual(decoded?.data?.articles[0], raw.data.articles[0]);
  assert.deepEqual(decoded?.data?.articles[0].impactSignals, ["운임·할증료"]);

  raw.data.articles[0].impactSignals.push("통상정책");
  assert.deepEqual(decoded?.data?.articles[0].impactSignals, ["운임·할증료"]);
});

test("news decoder rejects malformed articles, literals, meta, and state compatibility", () => {
  const emptyArticle = liveNews();
  Reflect.set(emptyArticle.data, "articles", [{}]);
  assert.equal(decodeNewsResult(emptyArticle), null);

  const missingSignals = liveNews();
  Reflect.deleteProperty(missingSignals.data.articles[0], "impactSignals");
  assert.equal(decodeNewsResult(missingSignals), null);

  const badSignals = liveNews();
  badSignals.data.articles[0].impactSignals = ["invented signal"];
  assert.equal(decodeNewsResult(badSignals), null);

  const badLiteral = liveNews();
  badLiteral.data.articles[0].directionCode = "RISING";
  assert.equal(decodeNewsResult(badLiteral), null);

  const badMeta = liveNews();
  Reflect.set(badMeta.meta, "fetchedAt", 123);
  assert.equal(decodeNewsResult(badMeta), null);

  const wrongState = unavailableNews();
  Reflect.set(wrongState, "data", liveNews().data);
  assert.equal(decodeNewsResult(wrongState), null);
});

test("news reducer preserves validated cache through loading and request failure", () => {
  const cached = decodeNewsResult(liveNews(1, "cached"), "KNEI");
  const failed = decodeNewsResult(unavailableNews(), "KNEI");
  assert.notEqual(cached, null);
  assert.notEqual(failed, null);
  if (cached === null || failed === null) {
    return;
  }

  const hydrated = reduceNewsState(INITIAL_NEWS_STATE, { type: "CACHE_HYDRATED", result: cached });
  assert.equal(hydrated.status, "CACHED");
  const loading = reduceNewsState(hydrated, { type: "COLLECT_STARTED" });
  assert.equal(loading.status, "LOADING_CACHED");
  const retained = reduceNewsState(loading, { type: "REQUEST_RESOLVED", result: failed });
  assert.equal(retained.status, "ERROR_CACHED");
  assert.strictEqual(retained.retained, cached);
  assert.deepEqual(reduceNewsState(retained, { type: "ROUTE_CHANGED" }), INITIAL_NEWS_STATE);
});

test("news retry selection keeps the first result on ties and adopts only a larger retry", () => {
  const first = decodeNewsResult(liveNews(1));
  const tied = decodeNewsResult(liveNews(1));
  const larger = decodeNewsResult(liveNews(2));
  assert.notEqual(first, null);
  assert.notEqual(tied, null);
  assert.notEqual(larger, null);
  if (first !== null && tied !== null && larger !== null) {
    assert.strictEqual(chooseNewsRetryResult(first, tied), first);
    assert.strictEqual(chooseNewsRetryResult(first, larger), larger);
  }
});

test("cold verified-empty news transitions separately from provider failure", () => {
  const verifiedEmpty = decodeNewsResult(unavailableNews("NO_VALID_DATA"));
  const providerError = decodeNewsResult(unavailableNews());
  assert.notEqual(verifiedEmpty, null);
  assert.notEqual(providerError, null);
  if (verifiedEmpty !== null && providerError !== null) {
    assert.equal(
      reduceNewsState(INITIAL_NEWS_STATE, { type: "REQUEST_RESOLVED", result: verifiedEmpty }).status,
      "READY_EMPTY",
    );
    assert.equal(
      reduceNewsState(INITIAL_NEWS_STATE, { type: "REQUEST_RESOLVED", result: providerError }).status,
      "ERROR",
    );
  }
});

test("insight decoder enforces complete factors, basis, literals, and engine-state compatibility", () => {
  const decoded = decodeInsightResult(insightResult("LLM"));
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded?.data, insightResult("LLM").data);

  for (const missing of ["quantitativeBasis", "upwardFactors", "downwardFactors"]) {
    const raw = insightResult("LLM");
    Reflect.deleteProperty(raw.data, missing);
    assert.equal(decodeInsightResult(raw), null);
  }

  const badFactor = insightResult("LLM");
  Reflect.set(badFactor.data, "upwardFactors", [{ factor: "missing evidence id" }]);
  assert.equal(decodeInsightResult(badFactor), null);

  const badConfidence = insightResult("LLM");
  badConfidence.data.confidence = "확실";
  assert.equal(decodeInsightResult(badConfidence), null);

  const mismatchedEngine = insightResult("LLM");
  mismatchedEngine.data.engine = "RULE_FALLBACK";
  mismatchedEngine.data.model = null;
  assert.equal(decodeInsightResult(mismatchedEngine), null);
});

test("insight reducer hydrates only LLM cache and retains it through unavailable refresh", () => {
  const cached = decodeInsightResult(insightResult("LLM", "cached"));
  const unavailable = decodeInsightResult(unavailableInsight());
  assert.notEqual(cached, null);
  assert.notEqual(unavailable, null);
  if (cached === null || unavailable === null) {
    return;
  }
  const connected = reduceInsightState(INITIAL_INSIGHT_STATE, { type: "INPUT_CHANGED", hasNews: true });
  assert.equal(connected.status, "CONNECTING");
  const hydrated = reduceInsightState(connected, { type: "CACHE_HYDRATED", result: cached });
  assert.equal(hydrated.status, "CACHED");
  const loading = reduceInsightState(hydrated, { type: "REQUEST_STARTED" });
  assert.equal(loading.status, "LOADING");
  const retained = reduceInsightState(loading, { type: "REQUEST_RESOLVED", result: unavailable });
  assert.equal(retained.status, "CACHED");
  assert.strictEqual(retained.retained, cached);

  const derived = decodeInsightResult(insightResult("DERIVED"));
  assert.notEqual(derived, null);
  if (derived !== null) {
    assert.equal(
      reduceInsightState(connected, { type: "CACHE_HYDRATED", result: derived }).status,
      "CONNECTING",
    );
    assert.equal(
      reduceInsightState(connected, { type: "REQUEST_RESOLVED", result: derived }).status,
      "DERIVED",
    );
  }
});
