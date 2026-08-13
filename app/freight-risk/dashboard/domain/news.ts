import { isRouteId, type RouteId } from "../../../contracts";

import {
  decodeFiniteNumber,
  decodeHttpUrl,
  decodeIsoDateOrTimestamp,
  decodeNonEmptyString,
  decodeNonNegativeInteger,
  decodeStringArray,
  hasExactKeys,
  isRecord,
  unreachable,
} from "./decode";

export type NewsDirectionCode = "UP" | "DOWN" | "MIXED" | "NEUTRAL";
export type NewsGrade = "S" | "A" | "B";
export type NewsProvenance = "VERIFIED" | "LIVE_SEARCH";

export interface NewsQueryV1 {
  readonly route: RouteId;
  readonly asOf: "latest";
  readonly providerVersion: 18;
  readonly retry: 0 | 1;
  readonly refresh?: string;
}

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

export interface NewsWindowV1 {
  readonly requestedAsOf: "latest" | string;
  readonly primaryDays: 30;
  readonly fallbackDays: 90;
}

export interface NewsPolicyV1 {
  readonly providerVersion: 18;
  readonly maximumArticles: 5;
}

export interface NewsAttemptV1 {
  readonly provider: string;
  readonly resultCode: string;
  readonly elapsedMs: number;
}

export interface NewsDataV1 {
  readonly routeId: RouteId;
  readonly stage: "FILTERED";
  readonly llmAnalyzed: false;
  readonly window: NewsWindowV1;
  readonly policy: NewsPolicyV1;
  readonly stats: NewsStatsV1;
  readonly articles: readonly NewsArticleV1[];
  readonly attempts: readonly NewsAttemptV1[];
}

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
const WINDOW_KEYS = ["requestedAsOf", "primaryDays", "fallbackDays"] as const;
const POLICY_KEYS = ["providerVersion", "maximumArticles"] as const;
const ATTEMPT_KEYS = ["provider", "resultCode", "elapsedMs"] as const;

export function createNewsQuery(
  route: RouteId,
  retry: 0 | 1,
  refresh?: string,
): NewsQueryV1 {
  return {
    route,
    asOf: "latest",
    providerVersion: 18,
    retry,
    ...(refresh === undefined ? {} : { refresh }),
  };
}

function decodeNewsWindow(value: unknown): NewsWindowV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, WINDOW_KEYS)) {
    return null;
  }
  const requestedAsOf = value.requestedAsOf === "latest"
    ? "latest"
    : decodeIsoDateOrTimestamp(value.requestedAsOf);
  if (requestedAsOf === null || value.primaryDays !== 30 || value.fallbackDays !== 90) {
    return null;
  }
  return { requestedAsOf, primaryDays: 30, fallbackDays: 90 };
}

function decodeNewsPolicy(value: unknown): NewsPolicyV1 | null {
  if (
    !isRecord(value)
    || !hasExactKeys(value, POLICY_KEYS)
    || value.providerVersion !== 18
    || value.maximumArticles !== 5
  ) {
    return null;
  }
  return { providerVersion: 18, maximumArticles: 5 };
}

function decodeNewsAttempt(value: unknown): NewsAttemptV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, ATTEMPT_KEYS)) {
    return null;
  }
  const provider = decodeNonEmptyString(value.provider);
  const resultCode = decodeNonEmptyString(value.resultCode);
  const elapsedMs = decodeFiniteNumber(value.elapsedMs);
  if (provider === null || resultCode === null || elapsedMs === null || elapsedMs < 0) {
    return null;
  }
  return { provider, resultCode, elapsedMs };
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

export function decodeNewsData(value: unknown, expectedRoute?: RouteId): NewsDataV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, DATA_KEYS) || !isRouteId(value.routeId)) {
    return null;
  }
  const window = decodeNewsWindow(value.window);
  const policy = decodeNewsPolicy(value.policy);
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
  const attempts: NewsAttemptV1[] = [];
  for (const item of value.attempts) {
    const attempt = decodeNewsAttempt(item);
    if (attempt === null) {
      return null;
    }
    attempts.push(attempt);
  }
  if (stats.selectedArticles !== articles.length || new Set(articles.map((article) => article.id)).size !== articles.length) {
    return null;
  }
  const decoded: NewsDataV1 = {
    routeId: value.routeId,
    stage: "FILTERED",
    llmAnalyzed: false,
    window,
    policy,
    stats,
    articles,
    attempts,
  };
  return expectedRoute === undefined || decoded.routeId === expectedRoute ? decoded : null;
}

export type NewsRequestResolution =
  | { readonly kind: "READY"; readonly data: NewsDataV1 }
  | { readonly kind: "VERIFIED_EMPTY" | "ERROR"; readonly data: null };

export type NewsClientState =
  | { readonly status: "IDLE"; readonly retained: null; readonly error: null }
  | { readonly status: "LOADING"; readonly retained: null; readonly error: null }
  | { readonly status: "READY" | "CACHED"; readonly retained: NewsDataV1; readonly error: null }
  | { readonly status: "READY_EMPTY" | "ERROR"; readonly retained: null; readonly error: NewsRequestResolution }
  | { readonly status: "LOADING_CACHED"; readonly retained: NewsDataV1; readonly error: null }
  | { readonly status: "ERROR_CACHED"; readonly retained: NewsDataV1; readonly error: NewsRequestResolution };

export type NewsClientAction =
  | { readonly type: "ROUTE_CHANGED" }
  | { readonly type: "CACHE_HYDRATED"; readonly data: NewsDataV1 }
  | { readonly type: "COLLECT_STARTED" }
  | { readonly type: "REQUEST_RESOLVED"; readonly resolution: NewsRequestResolution };

export const INITIAL_NEWS_STATE: NewsClientState = { status: "IDLE", retained: null, error: null };

export function reduceNewsState(state: NewsClientState, action: NewsClientAction): NewsClientState {
  switch (action.type) {
    case "ROUTE_CHANGED":
      return INITIAL_NEWS_STATE;
    case "CACHE_HYDRATED":
      return action.data.articles.length > 0
        ? { status: "CACHED", retained: action.data, error: null }
        : state;
    case "COLLECT_STARTED":
      return state.retained === null
        ? { status: "LOADING", retained: null, error: null }
        : { status: "LOADING_CACHED", retained: state.retained, error: null };
    case "REQUEST_RESOLVED":
      if (action.resolution.kind === "READY") {
        return { status: "READY", retained: action.resolution.data, error: null };
      }
      if (state.retained !== null) {
        return { status: "ERROR_CACHED", retained: state.retained, error: action.resolution };
      }
      return action.resolution.kind === "VERIFIED_EMPTY"
        ? { status: "READY_EMPTY", retained: null, error: action.resolution }
        : { status: "ERROR", retained: null, error: action.resolution };
    default:
      return unreachable(action);
  }
}

export function chooseNewsRetryData(
  first: NewsDataV1,
  retried: NewsDataV1,
): NewsDataV1 {
  return retried.articles.length > first.articles.length ? retried : first;
}
