import type { GatewayResultV1 } from "../../../contracts";
import { isRouteId, type RouteId } from "../../../contracts";

import {
  type JsonObject,
  decodeFiniteNumber,
  decodeHttpUrl,
  decodeIsoDateOrTimestamp,
  decodeJsonRecord,
  decodeNonEmptyString,
  decodeNonNegativeInteger,
  decodeStringArray,
  hasExactKeys,
  isRecord,
  unreachable,
} from "./decode";
import { decodeGatewayResult } from "./gateway";

export type NewsGatewayState = "LIVE" | "UNAVAILABLE";
export type NewsDirectionCode = "UP" | "DOWN" | "MIXED" | "NEUTRAL";
export type NewsGrade = "S" | "A" | "B";
export type NewsProvenance = "VERIFIED" | "LIVE_SEARCH";

export const NEWS_IMPACT_SIGNALS = [
  "운임·할증료",
  "선복·결항",
  "운항·항만 차질",
  "연료·운항비",
  "컨테이너 장비",
  "수요 변화",
  "통상정책",
] as const;

export interface NewsArticleV1 {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly originalTitle: string;
  readonly source: string;
  readonly publishedAt: string;
  readonly effectiveAt: string | null;
  readonly url: string;
  readonly direction: "상승 압력" | "하락 압력" | "혼합 신호" | "방향 불확실";
  readonly directionCode: NewsDirectionCode;
  readonly factor: string;
  readonly relevance: "ROUTE";
  readonly impactScore: number;
  readonly impactSignals: readonly string[];
  readonly grade: NewsGrade;
  readonly gradeLabel: "S 직접 가격·운항" | "A 직접 운영 영향" | "B 시장 참고";
  readonly reason: string;
  readonly isBoundary: boolean;
  readonly provenance: NewsProvenance;
}

export interface NewsStatsV1 {
  readonly fetchedCandidates: number;
  readonly filteredCandidates: number;
  readonly duplicatesRemoved: number;
  readonly selectedArticles: number;
  readonly successfulProviders: number;
  readonly candidateBreakdown: {
    readonly directImpact: number;
    readonly contextual: number;
    readonly routeFallback: number;
  };
}

export interface NewsDataV1 {
  readonly routeId: RouteId;
  readonly stage: "FILTERED";
  readonly llmAnalyzed: false;
  readonly window: JsonObject;
  readonly policy: JsonObject;
  readonly stats: NewsStatsV1;
  readonly articles: readonly NewsArticleV1[];
  readonly attempts: readonly JsonObject[];
}

export type NewsResultV1 = GatewayResultV1<NewsDataV1, NewsGatewayState>;

const DATA_KEYS = ["routeId", "stage", "llmAnalyzed", "window", "policy", "stats", "articles", "attempts"] as const;
const ARTICLE_KEYS = [
  "id",
  "title",
  "summary",
  "originalTitle",
  "source",
  "publishedAt",
  "effectiveAt",
  "url",
  "direction",
  "directionCode",
  "factor",
  "relevance",
  "impactScore",
  "impactSignals",
  "grade",
  "gradeLabel",
  "reason",
  "isBoundary",
  "provenance",
] as const;
const STATS_KEYS = [
  "fetchedCandidates",
  "filteredCandidates",
  "duplicatesRemoved",
  "selectedArticles",
  "successfulProviders",
  "candidateBreakdown",
] as const;
const BREAKDOWN_KEYS = ["directImpact", "contextual", "routeFallback"] as const;

function decodeNewsState(value: unknown): NewsGatewayState | null {
  return value === "LIVE" || value === "UNAVAILABLE" ? value : null;
}

function decodeDirectionCode(value: unknown): NewsDirectionCode | null {
  switch (value) {
    case "UP":
    case "DOWN":
    case "MIXED":
    case "NEUTRAL":
      return value;
    default:
      return null;
  }
}

function directionLabel(code: NewsDirectionCode): NewsArticleV1["direction"] {
  switch (code) {
    case "UP":
      return "상승 압력";
    case "DOWN":
      return "하락 압력";
    case "MIXED":
      return "혼합 신호";
    case "NEUTRAL":
      return "방향 불확실";
    default:
      return unreachable(code);
  }
}

function decodeGrade(value: unknown): NewsGrade | null {
  return value === "S" || value === "A" || value === "B" ? value : null;
}

function gradeLabel(grade: NewsGrade): NewsArticleV1["gradeLabel"] {
  switch (grade) {
    case "S":
      return "S 직접 가격·운항";
    case "A":
      return "A 직접 운영 영향";
    case "B":
      return "B 시장 참고";
    default:
      return unreachable(grade);
  }
}

function isImpactSignal(value: string): boolean {
  switch (value) {
    case "운임·할증료":
    case "선복·결항":
    case "운항·항만 차질":
    case "연료·운항비":
    case "컨테이너 장비":
    case "수요 변화":
    case "통상정책":
      return true;
    default:
      return false;
  }
}

function decodeNewsArticle(value: unknown): NewsArticleV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, ARTICLE_KEYS)) {
    return null;
  }
  const id = decodeNonEmptyString(value.id);
  const title = decodeNonEmptyString(value.title);
  const summary = decodeNonEmptyString(value.summary);
  const originalTitle = decodeNonEmptyString(value.originalTitle);
  const source = decodeNonEmptyString(value.source);
  const publishedAt = decodeIsoDateOrTimestamp(value.publishedAt);
  const effectiveAt = value.effectiveAt === null
    ? null
    : decodeIsoDateOrTimestamp(value.effectiveAt);
  const url = decodeHttpUrl(value.url);
  const directionCode = decodeDirectionCode(value.directionCode);
  const factor = decodeNonEmptyString(value.factor);
  const impactScore = decodeFiniteNumber(value.impactScore);
  const impactSignals = decodeStringArray(value.impactSignals);
  const grade = decodeGrade(value.grade);
  const reason = decodeNonEmptyString(value.reason);
  if (
    id === null
    || title === null
    || summary === null
    || originalTitle === null
    || source === null
    || publishedAt === null
    || (value.effectiveAt !== null && effectiveAt === null)
    || url === null
    || directionCode === null
    || value.direction !== directionLabel(directionCode)
    || factor === null
    || value.relevance !== "ROUTE"
    || impactScore === null
    || impactScore < 0
    || impactSignals === null
    || impactSignals.some((signal) => !isImpactSignal(signal))
    || grade === null
    || value.gradeLabel !== gradeLabel(grade)
    || reason === null
    || typeof value.isBoundary !== "boolean"
    || (value.provenance !== "VERIFIED" && value.provenance !== "LIVE_SEARCH")
  ) {
    return null;
  }
  return {
    id,
    title,
    summary,
    originalTitle,
    source,
    publishedAt,
    effectiveAt,
    url,
    direction: directionLabel(directionCode),
    directionCode,
    factor,
    relevance: "ROUTE",
    impactScore,
    impactSignals,
    grade,
    gradeLabel: gradeLabel(grade),
    reason,
    isBoundary: value.isBoundary,
    provenance: value.provenance,
  };
}

function decodeNewsStats(value: unknown): NewsStatsV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, STATS_KEYS)) {
    return null;
  }
  if (!isRecord(value.candidateBreakdown) || !hasExactKeys(value.candidateBreakdown, BREAKDOWN_KEYS)) {
    return null;
  }
  const fetchedCandidates = decodeNonNegativeInteger(value.fetchedCandidates);
  const filteredCandidates = decodeNonNegativeInteger(value.filteredCandidates);
  const duplicatesRemoved = decodeNonNegativeInteger(value.duplicatesRemoved);
  const selectedArticles = decodeNonNegativeInteger(value.selectedArticles);
  const successfulProviders = decodeNonNegativeInteger(value.successfulProviders);
  const directImpact = decodeNonNegativeInteger(value.candidateBreakdown.directImpact);
  const contextual = decodeNonNegativeInteger(value.candidateBreakdown.contextual);
  const routeFallback = decodeNonNegativeInteger(value.candidateBreakdown.routeFallback);
  if (
    fetchedCandidates === null
    || filteredCandidates === null
    || duplicatesRemoved === null
    || selectedArticles === null
    || selectedArticles > 5
    || successfulProviders === null
    || directImpact === null
    || contextual === null
    || routeFallback === null
  ) {
    return null;
  }
  return {
    fetchedCandidates,
    filteredCandidates,
    duplicatesRemoved,
    selectedArticles,
    successfulProviders,
    candidateBreakdown: { directImpact, contextual, routeFallback },
  };
}

function decodeNewsData(value: unknown): NewsDataV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, DATA_KEYS) || !isRouteId(value.routeId)) {
    return null;
  }
  const window = decodeJsonRecord(value.window);
  const policy = decodeJsonRecord(value.policy);
  const stats = decodeNewsStats(value.stats);
  if (
    value.stage !== "FILTERED"
    || value.llmAnalyzed !== false
    || window === null
    || policy === null
    || stats === null
    || !Array.isArray(value.articles)
    || !Array.isArray(value.attempts)
    || value.articles.length > 5
  ) {
    return null;
  }
  const articles: NewsArticleV1[] = [];
  for (const item of value.articles) {
    const article = decodeNewsArticle(item);
    if (article === null) {
      return null;
    }
    articles.push(article);
  }
  const attempts: JsonObject[] = [];
  for (const item of value.attempts) {
    const attempt = decodeJsonRecord(item);
    if (attempt === null) {
      return null;
    }
    attempts.push(attempt);
  }
  if (stats.selectedArticles !== articles.length || new Set(articles.map((article) => article.id)).size !== articles.length) {
    return null;
  }
  return {
    routeId: value.routeId,
    stage: "FILTERED",
    llmAnalyzed: false,
    window,
    policy,
    stats,
    articles,
    attempts,
  };
}

export function decodeNewsResult(value: unknown, expectedRoute?: RouteId): NewsResultV1 | null {
  const decoded = decodeGatewayResult(value, {
    decodeData: decodeNewsData,
    decodeState: decodeNewsState,
    unavailableState: "UNAVAILABLE",
    isCompatible: (state, data, error, meta) => {
      if (meta.unit !== null) {
        return false;
      }
      if (state === "UNAVAILABLE") {
        return data === null && error !== null;
      }
      return data !== null
        && error === null
        && (expectedRoute === undefined || data.routeId === expectedRoute);
    },
  });
  if (decoded === null) {
    return null;
  }
  if (decoded.data !== null && expectedRoute !== undefined && decoded.data.routeId !== expectedRoute) {
    return null;
  }
  return decoded;
}

export type NewsClientState =
  | { readonly status: "IDLE"; readonly retained: null; readonly error: null }
  | { readonly status: "LOADING"; readonly retained: null; readonly error: null }
  | { readonly status: "READY" | "CACHED"; readonly retained: NewsResultV1; readonly error: null }
  | { readonly status: "READY_EMPTY" | "ERROR"; readonly retained: null; readonly error: NewsResultV1 }
  | { readonly status: "LOADING_CACHED"; readonly retained: NewsResultV1; readonly error: null }
  | { readonly status: "ERROR_CACHED"; readonly retained: NewsResultV1; readonly error: NewsResultV1 };

export type NewsClientAction =
  | { readonly type: "ROUTE_CHANGED" }
  | { readonly type: "CACHE_HYDRATED"; readonly result: NewsResultV1 }
  | { readonly type: "COLLECT_STARTED" }
  | { readonly type: "REQUEST_RESOLVED"; readonly result: NewsResultV1 };

export const INITIAL_NEWS_STATE: NewsClientState = { status: "IDLE", retained: null, error: null };

function isLiveWithArticles(result: NewsResultV1): boolean {
  return result.state === "LIVE" && result.data !== null && result.data.articles.length > 0;
}

function isVerifiedEmpty(result: NewsResultV1): boolean {
  return result.state === "UNAVAILABLE" && result.error?.code === "NO_VALID_DATA";
}

export function reduceNewsState(state: NewsClientState, action: NewsClientAction): NewsClientState {
  switch (action.type) {
    case "ROUTE_CHANGED":
      return INITIAL_NEWS_STATE;
    case "CACHE_HYDRATED":
      return isLiveWithArticles(action.result)
        ? { status: "CACHED", retained: action.result, error: null }
        : state;
    case "COLLECT_STARTED":
      return state.retained === null
        ? { status: "LOADING", retained: null, error: null }
        : { status: "LOADING_CACHED", retained: state.retained, error: null };
    case "REQUEST_RESOLVED":
      if (isLiveWithArticles(action.result)) {
        return { status: "READY", retained: action.result, error: null };
      }
      if (state.retained !== null) {
        return { status: "ERROR_CACHED", retained: state.retained, error: action.result };
      }
      return isVerifiedEmpty(action.result)
        ? { status: "READY_EMPTY", retained: null, error: action.result }
        : { status: "ERROR", retained: null, error: action.result };
    default:
      return unreachable(action);
  }
}

export function chooseNewsRetryResult(
  first: NewsResultV1,
  retried: NewsResultV1,
): NewsResultV1 {
  const firstCount = first.data?.articles.length ?? 0;
  const retriedCount = retried.data?.articles.length ?? 0;
  return retriedCount > firstCount ? retried : first;
}
