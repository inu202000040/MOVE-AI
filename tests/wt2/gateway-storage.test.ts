import assert from "node:assert/strict";
import test from "node:test";

import {
  INSIGHT_CACHE_SCHEMA_VERSION,
  NEWS_CACHE_SCHEMA_VERSION,
  createMarketQuery,
  decodeInsightGatewayResult,
  decodeMarketGatewayResult,
  decodeNewsGatewayResult,
  insightCacheKey,
  newsCacheKey,
  readInsightCache,
  readNewsCache,
  resolveNewsStorageEvent,
  writeInsightCache,
  writeNewsCache,
  type InsightCacheIdentityV1,
  type StorageLike,
} from "../../app/freight-risk/dashboard/domain";

const NOW = "2026-08-13T00:00:00.000Z";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function gatewayMeta(mode: "live" | "fixture" | "cached" | "unavailable" = "live") {
  return {
    mode,
    source: "approved fixture",
    sourceUrl: null,
    asOf: "2026-08-13",
    fetchedAt: NOW,
    unit: null,
    isEstimate: false,
    attribution: "approved data pack",
    warnings: [],
    provider: "fixture provider",
    cache: { hit: mode === "cached", stale: false, ageSeconds: mode === "cached" ? 3 : null },
  };
}

function gatewayError(code = "NO_VALID_DATA") {
  return {
    code,
    message: "검증 가능한 자료가 없습니다.",
    retryable: false,
    upstreamStatus: null,
    details: { reasonCode: "NO_APPROVED_ARTICLES" },
  };
}

function newsArticle() {
  return {
    id: "1",
    title: "유럽 항로 운임 소식",
    summary: "승인된 요약입니다.",
    originalTitle: "Europe freight update",
    source: "Approved News",
    publishedAt: "2026-08-01T00:00:00.000Z",
    effectiveAt: null,
    url: "https://example.com/news/1",
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

function newsData() {
  return {
    routeId: "KNEI",
    stage: "FILTERED",
    llmAnalyzed: false,
    window: { requestedAsOf: "latest", primaryDays: 30, fallbackDays: 90 },
    policy: { providerVersion: 18, maximumArticles: 5 },
    stats: {
      fetchedCandidates: 3,
      filteredCandidates: 2,
      duplicatesRemoved: 1,
      selectedArticles: 1,
      successfulProviders: 1,
      candidateBreakdown: { directImpact: 1, contextual: 1, routeFallback: 0 },
    },
    articles: [newsArticle()],
    attempts: [{ provider: "approved fixture", resultCode: "OK", elapsedMs: 2 }],
  };
}

function newsResult() {
  return {
    schemaVersion: "move-ai/gateway/v1",
    state: "LIVE",
    data: newsData(),
    meta: gatewayMeta(),
    error: null,
  };
}

function insightData(engine: "GEMINI" | "RULE_FALLBACK" = "GEMINI") {
  return {
    engine,
    model: engine === "GEMINI" ? "gemini-2.5-flash" : null,
    generatedAt: NOW,
    headline: "유럽 항로는 보합권으로 전망됩니다.",
    summary: "승인된 정량 입력과 검증 뉴스를 함께 해석했습니다.",
    confidence: "보통",
    quantitativeBasis: ["현재 4,884 USD/FEU", "1주 4,829 USD/FEU"],
    upwardFactors: [{ factor: "운임 인상", evidenceId: "1" }],
    downwardFactors: [],
    caution: "뉴스는 예측값의 직접 인과 근거가 아닙니다.",
  };
}

function insightResult(engine: "GEMINI" | "RULE_FALLBACK" = "GEMINI") {
  return {
    schemaVersion: "move-ai/gateway/v1",
    state: engine === "GEMINI" ? "LLM" : "DERIVED",
    data: insightData(engine),
    meta: { ...gatewayMeta("fixture"), unit: "USD/FEU" },
    error: null,
  };
}

const insightIdentity: InsightCacheIdentityV1 = {
  routeId: "KNEI",
  currentDate: "2026-08-03",
  horizon: 1,
  modelId: "sarimax",
  newsFetchedAt: NOW,
};

test("gateway decoders reconstruct complete envelope and reject meta/state incompatibility", () => {
  const raw = newsResult();
  const decoded = decodeNewsGatewayResult(raw, "KNEI");
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded, raw);
  assert.notStrictEqual(decoded?.meta, raw.meta);
  assert.notStrictEqual(decoded?.data?.articles[0], raw.data.articles[0]);

  const wrongMetaType = newsResult();
  Reflect.set(wrongMetaType.meta, "fetchedAt", 123);
  assert.equal(decodeNewsGatewayResult(wrongMetaType, "KNEI"), null);

  const extraMetaKey = newsResult();
  Reflect.set(extraMetaKey.meta, "debug", true);
  assert.equal(decodeNewsGatewayResult(extraMetaKey, "KNEI"), null);

  const wrongMode = newsResult();
  wrongMode.meta.mode = "unavailable";
  assert.equal(decodeNewsGatewayResult(wrongMode, "KNEI"), null);

  const invalidCachedMode = newsResult();
  invalidCachedMode.meta.mode = "cached";
  assert.equal(decodeNewsGatewayResult(invalidCachedMode, "KNEI"), null);
});

test("news gateway decoder rejects malformed nested articles, attempts, and literals", () => {
  const emptyArticle = newsResult();
  Reflect.set(emptyArticle.data, "articles", [{}]);
  assert.equal(decodeNewsGatewayResult(emptyArticle, "KNEI"), null);

  const missingSignals = newsResult();
  Reflect.deleteProperty(missingSignals.data.articles[0], "impactSignals");
  assert.equal(decodeNewsGatewayResult(missingSignals, "KNEI"), null);

  const invalidAttempt = newsResult();
  Reflect.set(invalidAttempt.data.attempts[0], "elapsedMs", "fast");
  assert.equal(decodeNewsGatewayResult(invalidAttempt, "KNEI"), null);

  const invalidPolicy = newsResult();
  invalidPolicy.data.policy.providerVersion = 17;
  assert.equal(decodeNewsGatewayResult(invalidPolicy, "KNEI"), null);

  const unavailable = {
    schemaVersion: "move-ai/gateway/v1",
    state: "UNAVAILABLE",
    data: null,
    meta: { ...gatewayMeta("unavailable"), asOf: null, unit: null, provider: null },
    error: gatewayError(),
  };
  assert.notEqual(decodeNewsGatewayResult(unavailable, "KNEI"), null);
  Reflect.set(unavailable, "data", newsData());
  assert.equal(decodeNewsGatewayResult(unavailable, "KNEI"), null);
});

test("news initial storage read removes malformed cache without partial adoption", () => {
  const storage = new MemoryStorage();
  const key = newsCacheKey("KNEI");
  storage.setItem(key, JSON.stringify({
    schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
    savedAt: NOW,
    domainIdentity: { routeId: "KNEI" },
    result: newsResult(),
  }));
  const valid = readNewsCache(storage, "KNEI");
  assert.equal(valid?.result.data?.articles.length, 1);

  const malformed = newsResult();
  Reflect.set(malformed.data, "articles", [{}]);
  storage.setItem(key, JSON.stringify({
    schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
    savedAt: NOW,
    domainIdentity: { routeId: "KNEI" },
    result: malformed,
  }));
  assert.equal(readNewsCache(storage, "KNEI"), null);
  assert.equal(storage.getItem(key), null);
});

test("news StorageEvent path shares exhaustive decoder and removes malformed updates", () => {
  const storage = new MemoryStorage();
  const key = newsCacheKey("KNEI");
  const malformed = newsResult();
  Reflect.deleteProperty(malformed.data.articles[0], "impactSignals");
  storage.setItem(key, "previous");
  const rejected = resolveNewsStorageEvent(storage, "KNEI", {
    key,
    newValue: JSON.stringify({
      schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
      savedAt: NOW,
      domainIdentity: { routeId: "KNEI" },
      result: malformed,
    }),
  });
  assert.equal(rejected.kind, "CLEARED");
  assert.equal(storage.getItem(key), null);

  const accepted = resolveNewsStorageEvent(storage, "KNEI", {
    key,
    newValue: JSON.stringify({
      schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
      savedAt: NOW,
      domainIdentity: { routeId: "KNEI" },
      result: newsResult(),
    }),
  });
  assert.equal(accepted.kind, "HYDRATED");
});

test("insight gateway and cache reject missing arrays, wrong engine state, and identity mismatch", () => {
  const valid = insightResult();
  assert.notEqual(decodeInsightGatewayResult(valid), null);

  for (const field of ["quantitativeBasis", "upwardFactors", "downwardFactors"]) {
    const missing = insightResult();
    Reflect.deleteProperty(missing.data, field);
    assert.equal(decodeInsightGatewayResult(missing), null);
  }

  const wrongState = insightResult("RULE_FALLBACK");
  wrongState.state = "LLM";
  assert.equal(decodeInsightGatewayResult(wrongState), null);

  const storage = new MemoryStorage();
  assert.equal(writeInsightCache(storage, insightIdentity, valid, NOW), true);
  assert.equal(readInsightCache(storage, insightIdentity)?.result.state, "LLM");
  assert.equal(writeInsightCache(storage, insightIdentity, insightResult("RULE_FALLBACK"), NOW), false);

  const wrongIdentity = { ...insightIdentity, horizon: 2 as const };
  assert.equal(readInsightCache(storage, wrongIdentity), null);
  assert.equal(INSIGHT_CACHE_SCHEMA_VERSION, "move-ai/forecast-insight/v1");
  assert.equal(
    insightCacheKey(insightIdentity),
    `move-ai:forecast-insight:v1:KNEI:2026-08-03:1w:sarimax:${NOW}`,
  );
});

test("market query and gateway decoder enforce canonical series, unit, order, and state", () => {
  assert.deepEqual(createMarketQuery("fx", "2026-08-03"), {
    series: "fx",
    from: "2026-01-01",
    to: "2026-08-03",
    providerVersion: 3,
  });
  assert.equal(createMarketQuery("fx", "2025-12-31"), null);

  const result = {
    schemaVersion: "move-ai/gateway/v1",
    state: "REFERENCE",
    data: {
      series: "harpex",
      label: "HARPEX Index",
      unit: "Index",
      provider: "approved data pack",
      aggregation: "주별 마지막 관측",
      observationStart: "2026-07-17",
      observationEnd: "2026-08-07",
      points: [
        { date: "2026-07-17", week: "2026-W29", value: 2340 },
        { date: "2026-08-07", week: "2026-W32", value: 2346 },
      ],
      attempts: [{ provider: "approved fixture", resultCode: "OK", elapsedMs: 0 }],
    },
    meta: { ...gatewayMeta("fixture"), unit: "Index" },
    error: null,
  };
  assert.notEqual(decodeMarketGatewayResult(result, "harpex"), null);
  result.data.unit = "points";
  assert.equal(decodeMarketGatewayResult(result, "harpex"), null);
});

test("cache writers reject unavailable or malformed values and tolerate quota errors", () => {
  const storage = new MemoryStorage();
  assert.equal(writeNewsCache(storage, "KNEI", newsResult(), NOW), true);

  const unavailable = {
    schemaVersion: "move-ai/gateway/v1",
    state: "UNAVAILABLE",
    data: null,
    meta: { ...gatewayMeta("unavailable"), asOf: null, provider: null },
    error: gatewayError(),
  };
  assert.equal(writeNewsCache(storage, "KNEI", unavailable, NOW), false);

  const quotaStorage: StorageLike = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => { throw new Error("quota"); },
  };
  assert.equal(writeNewsCache(quotaStorage, "KNEI", newsResult(), NOW), false);
});
