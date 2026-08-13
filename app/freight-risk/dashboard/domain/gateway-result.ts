import {
  DATA_MODES,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_DETAIL_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  GATEWAY_SCHEMA_VERSION,
  type DataModeV1,
  type GatewayCacheMetaV1,
  type GatewayErrorV1,
  type GatewayMetaV1,
  type GatewayResultV1,
  type RouteId,
} from "../../../contracts";

import {
  decodeFiniteNumber,
  decodeHttpUrl,
  decodeIsoDateOrTimestamp,
  decodeIsoTimestamp,
  decodeNonEmptyString,
  decodeNonNegativeInteger,
  decodeStringArray,
  hasExactKeys,
  isRecord,
  type Decoder,
} from "./decode";
import { decodeInsightData, type InsightDataV1 } from "./insight";
import { decodeMarketData, type MarketDataV1, type MarketGatewayResultV1, type MarketGatewayState, type MarketSeriesV1 } from "./market";
import { decodeNewsData, type NewsDataV1 } from "./news";

export type NewsGatewayState = "LIVE" | "UNAVAILABLE";
export type NewsGatewayResultV1 = GatewayResultV1<NewsDataV1, NewsGatewayState>;
export type InsightGatewayState = "LLM" | "DERIVED" | "UNAVAILABLE";
export type InsightGatewayResultV1 = GatewayResultV1<InsightDataV1, InsightGatewayState>;

type GatewayParts<TData, TState extends string> = {
  readonly state: TState;
  readonly data: TData | null;
  readonly meta: GatewayMetaV1;
  readonly error: GatewayErrorV1 | null;
};

function decodeDataMode(value: unknown): DataModeV1 | null {
  return DATA_MODES.find((mode) => mode === value) ?? null;
}

function decodeCacheMeta(value: unknown): GatewayCacheMetaV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_CACHE_KEYS)) {
    return null;
  }
  const ageSeconds = value.ageSeconds === null ? null : decodeFiniteNumber(value.ageSeconds);
  if (
    typeof value.hit !== "boolean"
    || typeof value.stale !== "boolean"
    || (value.ageSeconds !== null && (ageSeconds === null || ageSeconds < 0))
  ) {
    return null;
  }
  return { hit: value.hit, stale: value.stale, ageSeconds };
}

export function decodeGatewayMeta(value: unknown): GatewayMetaV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_META_KEYS)) {
    return null;
  }
  const mode = decodeDataMode(value.mode);
  const source = decodeNonEmptyString(value.source);
  const sourceUrl = value.sourceUrl === null ? null : decodeHttpUrl(value.sourceUrl);
  const asOf = value.asOf === null ? null : decodeIsoDateOrTimestamp(value.asOf);
  const fetchedAt = decodeIsoTimestamp(value.fetchedAt);
  const unit = value.unit === null ? null : decodeNonEmptyString(value.unit);
  const warnings = decodeStringArray(value.warnings);
  const provider = value.provider === null ? null : decodeNonEmptyString(value.provider);
  const cache = decodeCacheMeta(value.cache);
  if (
    mode === null
    || source === null
    || (value.sourceUrl !== null && sourceUrl === null)
    || (value.asOf !== null && asOf === null)
    || fetchedAt === null
    || (value.unit !== null && unit === null)
    || typeof value.isEstimate !== "boolean"
    || typeof value.attribution !== "string"
    || warnings === null
    || (value.provider !== null && provider === null)
    || cache === null
    || (mode === "cached" && !cache.hit)
  ) {
    return null;
  }
  return {
    mode,
    source,
    sourceUrl,
    asOf,
    fetchedAt,
    unit,
    isEstimate: value.isEstimate,
    attribution: value.attribution,
    warnings,
    provider,
    cache,
  };
}

export function decodeGatewayError(value: unknown): GatewayErrorV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_ERROR_KEYS)) {
    return null;
  }
  const code = decodeNonEmptyString(value.code);
  const message = decodeNonEmptyString(value.message);
  const upstreamStatus = value.upstreamStatus === null
    ? null
    : decodeNonNegativeInteger(value.upstreamStatus);
  let details: GatewayErrorV1["details"] = null;
  if (value.details !== null) {
    if (!isRecord(value.details) || !hasExactKeys(value.details, GATEWAY_ERROR_DETAIL_KEYS)) {
      return null;
    }
    const reasonCode = decodeNonEmptyString(value.details.reasonCode);
    if (reasonCode === null) {
      return null;
    }
    details = { reasonCode };
  }
  if (
    code === null
    || message === null
    || typeof value.retryable !== "boolean"
    || (value.upstreamStatus !== null && upstreamStatus === null)
  ) {
    return null;
  }
  return { code, message, retryable: value.retryable, upstreamStatus, details };
}

export function decodeGatewayResult<TData, TState extends string>(
  value: unknown,
  decodeData: Decoder<TData>,
  decodeState: Decoder<TState>,
  compatible: (parts: GatewayParts<TData, TState>) => boolean,
): GatewayResultV1<TData, TState> | null {
  if (
    !isRecord(value)
    || !hasExactKeys(value, GATEWAY_ROOT_KEYS)
    || value.schemaVersion !== GATEWAY_SCHEMA_VERSION
  ) {
    return null;
  }
  const state = decodeState(value.state);
  const meta = decodeGatewayMeta(value.meta);
  const error = value.error === null ? null : decodeGatewayError(value.error);
  const data = value.data === null ? null : decodeData(value.data);
  if (
    state === null
    || meta === null
    || (value.error !== null && error === null)
    || (value.data !== null && data === null)
    || !compatible({ state, data, meta, error })
  ) {
    return null;
  }
  return { schemaVersion: GATEWAY_SCHEMA_VERSION, state, data, meta, error };
}

function successOrUnavailable<TData, TState extends string>(
  parts: GatewayParts<TData, TState>,
): boolean {
  if (parts.state === "UNAVAILABLE") {
    return parts.data === null && parts.error !== null && parts.meta.mode === "unavailable";
  }
  return parts.data !== null && parts.error === null && parts.meta.mode !== "unavailable";
}

export function decodeNewsGatewayResult(value: unknown, expectedRoute?: RouteId): NewsGatewayResultV1 | null {
  return decodeGatewayResult(
    value,
    (data) => decodeNewsData(data, expectedRoute),
    (state) => state === "LIVE" || state === "UNAVAILABLE" ? state : null,
    (parts) => successOrUnavailable(parts)
      && (parts.state !== "LIVE" || (parts.data?.articles.length ?? 0) > 0),
  );
}

export function decodeInsightGatewayResult(value: unknown): InsightGatewayResultV1 | null {
  return decodeGatewayResult(
    value,
    decodeInsightData,
    (state) => state === "LLM" || state === "DERIVED" || state === "UNAVAILABLE" ? state : null,
    (parts) => successOrUnavailable(parts)
      && (parts.state === "UNAVAILABLE"
        || (parts.state === "LLM" && parts.data?.engine === "GEMINI")
        || (parts.state === "DERIVED" && parts.data?.engine === "RULE_FALLBACK")),
  );
}

export function decodeMarketGatewayResult(
  value: unknown,
  expectedSeries?: MarketSeriesV1,
): MarketGatewayResultV1 | null {
  return decodeGatewayResult<MarketDataV1, MarketGatewayState>(
    value,
    (data) => decodeMarketData(data, expectedSeries),
    (state) => state === "LIVE" || state === "REFERENCE" || state === "UNAVAILABLE" ? state : null,
    (parts) => successOrUnavailable(parts)
      && (parts.data === null || parts.meta.unit === parts.data.unit)
      && (parts.state !== "REFERENCE" || parts.data !== null)
      && (parts.data?.series !== "harpex" || parts.state === "REFERENCE"),
  );
}
