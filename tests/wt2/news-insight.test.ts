import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_INSIGHT_STATE,
  INITIAL_NEWS_STATE,
  chooseNewsRetryData,
  decodeInsightData,
  decodeNewsData,
  reduceInsightState,
  reduceNewsState,
} from "../../app/freight-risk/dashboard/domain";

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

function newsData(articleCount = 1) {
  const articles = Array.from({ length: articleCount }, (_, index) => article(String(index + 1)));
  return {
    routeId: "KNEI",
    stage: "FILTERED",
    llmAnalyzed: false,
    window: { from: "2026-07-15", to: "2026-08-13", days: 30 },
    policy: { providerVersion: 18, retry: 0 },
    stats: {
      fetchedCandidates: 8,
      filteredCandidates: 5,
      duplicatesRemoved: 2,
      selectedArticles: articleCount,
      successfulProviders: 1,
      candidateBreakdown: { directImpact: 2, contextual: 2, routeFallback: 1 },
    },
    articles,
    attempts: [{ provider: "approved fixture", resultCode: "OK", elapsedMs: 1, from: "2026-07-15", to: "2026-08-13" }],
  };
}

function insightData(engine: "GEMINI" | "RULE_FALLBACK") {
  const gemini = engine === "GEMINI";
  return {
    engine,
    model: gemini ? "gemini-2.5-flash" : null,
    generatedAt: "2026-08-13T00:00:00.000Z",
    headline: "유럽 항로는 1주 후 보합권으로 전망됩니다.",
    summary: "정량 예측과 검증 뉴스를 함께 해석했습니다.",
    confidence: "보통",
    quantitativeBasis: ["PI90 80–110", "SARIMAX MAPE 9.0%", "모델 의견 상승 3·보합 3·하락 2"],
    upwardFactors: [{ factor: "운임 인상", evidenceId: "1" }],
    downwardFactors: [],
    caution: "뉴스는 예측값의 직접적인 인과 근거가 아닙니다.",
  };
}

test("news payload decoder exhaustively validates and reconstructs domain data", () => {
  const raw = newsData();
  const decoded = decodeNewsData(raw, "KNEI");
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded, raw);
  assert.notStrictEqual(decoded?.articles[0], raw.articles[0]);
  assert.deepEqual(decoded?.articles[0].impactSignals, ["운임·할증료"]);

  raw.articles[0].impactSignals.push("통상정책");
  assert.deepEqual(decoded?.articles[0].impactSignals, ["운임·할증료"]);
  assert.equal(decodeNewsData(newsData(), "KUEI"), null);
});

test("news payload decoder rejects malformed articles and literals", () => {
  const emptyArticle = newsData();
  Reflect.set(emptyArticle, "articles", [{}]);
  assert.equal(decodeNewsData(emptyArticle), null);

  const missingSignals = newsData();
  Reflect.deleteProperty(missingSignals.articles[0], "impactSignals");
  assert.equal(decodeNewsData(missingSignals), null);

  const badSignals = newsData();
  badSignals.articles[0].impactSignals = ["invented signal"];
  assert.equal(decodeNewsData(badSignals), null);

  const badLiteral = newsData();
  badLiteral.articles[0].directionCode = "RISING";
  assert.equal(decodeNewsData(badLiteral), null);

  const wrongCount = newsData();
  wrongCount.stats.selectedArticles = 5;
  assert.equal(decodeNewsData(wrongCount), null);
});

test("news reducer preserves validated cache through loading and failure", () => {
  const cached = decodeNewsData(newsData(), "KNEI");
  assert.notEqual(cached, null);
  if (cached === null) {
    return;
  }

  const hydrated = reduceNewsState(INITIAL_NEWS_STATE, { type: "CACHE_HYDRATED", data: cached });
  assert.equal(hydrated.status, "CACHED");
  const loading = reduceNewsState(hydrated, { type: "COLLECT_STARTED" });
  assert.equal(loading.status, "LOADING_CACHED");
  const retained = reduceNewsState(loading, {
    type: "REQUEST_RESOLVED",
    resolution: { kind: "ERROR", data: null },
  });
  assert.equal(retained.status, "ERROR_CACHED");
  assert.strictEqual(retained.retained, cached);
  assert.deepEqual(reduceNewsState(retained, { type: "ROUTE_CHANGED" }), INITIAL_NEWS_STATE);
});

test("news retry selection keeps the first payload on ties", () => {
  const first = decodeNewsData(newsData(1));
  const tied = decodeNewsData(newsData(1));
  const larger = decodeNewsData(newsData(2));
  assert.notEqual(first, null);
  assert.notEqual(tied, null);
  assert.notEqual(larger, null);
  if (first !== null && tied !== null && larger !== null) {
    assert.strictEqual(chooseNewsRetryData(first, tied), first);
    assert.strictEqual(chooseNewsRetryData(first, larger), larger);
  }
});

test("verified-empty news transitions separately from request failure", () => {
  assert.equal(
    reduceNewsState(INITIAL_NEWS_STATE, {
      type: "REQUEST_RESOLVED",
      resolution: { kind: "VERIFIED_EMPTY", data: null },
    }).status,
    "READY_EMPTY",
  );
  assert.equal(
    reduceNewsState(INITIAL_NEWS_STATE, {
      type: "REQUEST_RESOLVED",
      resolution: { kind: "ERROR", data: null },
    }).status,
    "ERROR",
  );
});

test("insight payload decoder enforces complete factors, basis, literals, and engine compatibility", () => {
  const raw = insightData("GEMINI");
  const decoded = decodeInsightData(raw);
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded, raw);

  for (const missing of ["quantitativeBasis", "upwardFactors", "downwardFactors"]) {
    const incomplete = insightData("GEMINI");
    Reflect.deleteProperty(incomplete, missing);
    assert.equal(decodeInsightData(incomplete), null);
  }

  const badFactor = insightData("GEMINI");
  Reflect.set(badFactor, "upwardFactors", [{ factor: "missing evidence id" }]);
  assert.equal(decodeInsightData(badFactor), null);

  const badConfidence = insightData("GEMINI");
  badConfidence.confidence = "확실";
  assert.equal(decodeInsightData(badConfidence), null);

  const mismatchedEngine = insightData("GEMINI");
  mismatchedEngine.engine = "RULE_FALLBACK";
  assert.equal(decodeInsightData(mismatchedEngine), null);
});

test("insight reducer hydrates only Gemini cache and retains it through unavailable refresh", () => {
  const cached = decodeInsightData(insightData("GEMINI"));
  const derived = decodeInsightData(insightData("RULE_FALLBACK"));
  assert.notEqual(cached, null);
  assert.notEqual(derived, null);
  if (cached === null || derived === null) {
    return;
  }

  const connected = reduceInsightState(INITIAL_INSIGHT_STATE, { type: "INPUT_CHANGED", hasNews: true });
  assert.equal(connected.status, "CONNECTING");
  const hydrated = reduceInsightState(connected, { type: "CACHE_HYDRATED", data: cached });
  assert.equal(hydrated.status, "CACHED");
  assert.equal(
    reduceInsightState(connected, { type: "CACHE_HYDRATED", data: derived }).status,
    "CONNECTING",
  );

  const loading = reduceInsightState(hydrated, { type: "REQUEST_STARTED" });
  assert.equal(loading.status, "LOADING");
  const retained = reduceInsightState(loading, { type: "REQUEST_RESOLVED", data: null });
  assert.equal(retained.status, "CACHED");
  assert.strictEqual(retained.retained, cached);
  assert.equal(
    reduceInsightState(connected, { type: "REQUEST_RESOLVED", data: derived }).status,
    "DERIVED",
  );
});
