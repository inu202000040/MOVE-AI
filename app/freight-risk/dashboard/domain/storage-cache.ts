import { STORAGE_KEYS, isRouteId, type RouteId, type StoredPayloadBaseV1 } from "../../../contracts";

import { decodeIsoDate, decodeIsoTimestamp, decodeNonEmptyString, hasExactKeys, isRecord } from "./decode";
import type { ForecastHorizon } from "./horizon";
import {
  decodeInsightGatewayResult,
  decodeNewsGatewayResult,
  type InsightGatewayResultV1,
  type NewsGatewayResultV1,
} from "./gateway-result";

export const NEWS_CACHE_SCHEMA_VERSION = "move-ai/route-news/v1" as const;
export const INSIGHT_CACHE_SCHEMA_VERSION = "move-ai/forecast-insight/v1" as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface NewsCacheIdentityV1 {
  readonly routeId: RouteId;
}

export interface NewsCachePayloadV1 extends StoredPayloadBaseV1<
  typeof NEWS_CACHE_SCHEMA_VERSION,
  NewsCacheIdentityV1
> {
  readonly result: NewsGatewayResultV1;
}

export interface InsightCacheIdentityV1 {
  readonly routeId: RouteId;
  readonly currentDate: string;
  readonly horizon: ForecastHorizon;
  readonly modelId: string;
  readonly newsFetchedAt: string;
}

export interface InsightCachePayloadV1 extends StoredPayloadBaseV1<
  typeof INSIGHT_CACHE_SCHEMA_VERSION,
  InsightCacheIdentityV1
> {
  readonly result: InsightGatewayResultV1;
}

export type NewsStorageEventResolution =
  | { readonly kind: "IGNORED" }
  | { readonly kind: "CLEARED" }
  | { readonly kind: "HYDRATED"; readonly payload: NewsCachePayloadV1 };

const CACHE_KEYS = ["schemaVersion", "savedAt", "domainIdentity", "result"] as const;
const NEWS_IDENTITY_KEYS = ["routeId"] as const;
const INSIGHT_IDENTITY_KEYS = ["routeId", "currentDate", "horizon", "modelId", "newsFetchedAt"] as const;

export function newsCacheKey(routeId: RouteId): string {
  return `${STORAGE_KEYS.routeNewsPrefix}${routeId}`;
}

export function insightCacheKey(identity: InsightCacheIdentityV1): string {
  return `${STORAGE_KEYS.forecastInsightPrefix}${identity.routeId}:${identity.currentDate}:${identity.horizon}w:${identity.modelId}:${identity.newsFetchedAt}`;
}

function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage availability must not break the deterministic dashboard.
  }
}

function parseUnknown(raw: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function decodeNewsCachePayload(value: unknown, expectedRoute: RouteId): NewsCachePayloadV1 | null {
  if (
    !isRecord(value)
    || !hasExactKeys(value, CACHE_KEYS)
    || value.schemaVersion !== NEWS_CACHE_SCHEMA_VERSION
    || !isRecord(value.domainIdentity)
    || !hasExactKeys(value.domainIdentity, NEWS_IDENTITY_KEYS)
    || value.domainIdentity.routeId !== expectedRoute
  ) {
    return null;
  }
  const savedAt = decodeIsoTimestamp(value.savedAt);
  const result = decodeNewsGatewayResult(value.result, expectedRoute);
  if (savedAt === null || result?.state !== "LIVE" || result.data === null || result.data.articles.length === 0) {
    return null;
  }
  return {
    schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
    savedAt,
    domainIdentity: { routeId: expectedRoute },
    result,
  };
}

export function readNewsCache(storage: StorageLike, routeId: RouteId): NewsCachePayloadV1 | null {
  const key = newsCacheKey(routeId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  const decoded = decodeNewsCachePayload(parseUnknown(raw), routeId);
  if (decoded === null) {
    safeRemove(storage, key);
  }
  return decoded;
}

export function writeNewsCache(
  storage: StorageLike,
  routeId: RouteId,
  value: unknown,
  savedAt: string,
): boolean {
  const result = decodeNewsGatewayResult(value, routeId);
  const decodedSavedAt = decodeIsoTimestamp(savedAt);
  if (result?.state !== "LIVE" || result.data === null || result.data.articles.length === 0 || decodedSavedAt === null) {
    return false;
  }
  const payload: NewsCachePayloadV1 = {
    schemaVersion: NEWS_CACHE_SCHEMA_VERSION,
    savedAt: decodedSavedAt,
    domainIdentity: { routeId },
    result,
  };
  try {
    storage.setItem(newsCacheKey(routeId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function resolveNewsStorageEvent(
  storage: StorageLike,
  routeId: RouteId,
  event: Pick<StorageEvent, "key" | "newValue">,
): NewsStorageEventResolution {
  const key = newsCacheKey(routeId);
  if (event.key !== key) {
    return { kind: "IGNORED" };
  }
  if (event.newValue === null) {
    return { kind: "CLEARED" };
  }
  const payload = decodeNewsCachePayload(parseUnknown(event.newValue), routeId);
  if (payload === null) {
    safeRemove(storage, key);
    return { kind: "CLEARED" };
  }
  return { kind: "HYDRATED", payload };
}

export function decodeInsightCachePayload(
  value: unknown,
  expectedIdentity: InsightCacheIdentityV1,
): InsightCachePayloadV1 | null {
  if (
    !isRecord(value)
    || !hasExactKeys(value, CACHE_KEYS)
    || value.schemaVersion !== INSIGHT_CACHE_SCHEMA_VERSION
    || !isRecord(value.domainIdentity)
    || !hasExactKeys(value.domainIdentity, INSIGHT_IDENTITY_KEYS)
  ) {
    return null;
  }
  const routeId = isRouteId(value.domainIdentity.routeId) ? value.domainIdentity.routeId : null;
  const currentDate = decodeIsoDate(value.domainIdentity.currentDate);
  const horizon = value.domainIdentity.horizon === 1
    || value.domainIdentity.horizon === 2
    || value.domainIdentity.horizon === 3
    || value.domainIdentity.horizon === 4
    ? value.domainIdentity.horizon
    : null;
  const modelId = decodeNonEmptyString(value.domainIdentity.modelId);
  const newsFetchedAt = decodeIsoTimestamp(value.domainIdentity.newsFetchedAt);
  const savedAt = decodeIsoTimestamp(value.savedAt);
  const result = decodeInsightGatewayResult(value.result);
  if (
    routeId === null
    || currentDate === null
    || horizon === null
    || modelId === null
    || newsFetchedAt === null
    || routeId !== expectedIdentity.routeId
    || currentDate !== expectedIdentity.currentDate
    || horizon !== expectedIdentity.horizon
    || modelId !== expectedIdentity.modelId
    || newsFetchedAt !== expectedIdentity.newsFetchedAt
    || savedAt === null
    || result?.state !== "LLM"
    || result.data?.engine !== "GEMINI"
  ) {
    return null;
  }
  return {
    schemaVersion: INSIGHT_CACHE_SCHEMA_VERSION,
    savedAt,
    domainIdentity: { routeId, currentDate, horizon, modelId, newsFetchedAt },
    result,
  };
}

export function readInsightCache(
  storage: StorageLike,
  identity: InsightCacheIdentityV1,
): InsightCachePayloadV1 | null {
  const key = insightCacheKey(identity);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  const decoded = decodeInsightCachePayload(parseUnknown(raw), identity);
  if (decoded === null) {
    safeRemove(storage, key);
  }
  return decoded;
}

export function writeInsightCache(
  storage: StorageLike,
  identity: InsightCacheIdentityV1,
  value: unknown,
  savedAt: string,
): boolean {
  const result = decodeInsightGatewayResult(value);
  const decodedSavedAt = decodeIsoTimestamp(savedAt);
  if (result?.state !== "LLM" || result.data?.engine !== "GEMINI" || decodedSavedAt === null) {
    return false;
  }
  const payload: InsightCachePayloadV1 = {
    schemaVersion: INSIGHT_CACHE_SCHEMA_VERSION,
    savedAt: decodedSavedAt,
    domainIdentity: { ...identity },
    result,
  };
  try {
    storage.setItem(insightCacheKey(identity), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
