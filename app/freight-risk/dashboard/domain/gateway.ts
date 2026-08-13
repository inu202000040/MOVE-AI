import {
  DATA_MODES,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  GATEWAY_SCHEMA_VERSION,
  type DataModeV1,
  type GatewayCacheMetaV1,
  type GatewayErrorV1,
  type GatewayMetaV1,
  type GatewayResultV1,
} from "../../../contracts";

import {
  type Decoder,
  decodeFiniteNumber,
  decodeHttpUrl,
  decodeIsoDateOrTimestamp,
  decodeIsoTimestamp,
  decodeNonEmptyString,
  hasExactKeys,
  isRecord,
} from "./decode";

function decodeDataMode(value: unknown): DataModeV1 | null {
  for (const mode of DATA_MODES) {
    if (value === mode) {
      return mode;
    }
  }
  return null;
}

function decodeGatewayCache(value: unknown): GatewayCacheMetaV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_CACHE_KEYS)) {
    return null;
  }
  const ageSeconds = value.ageSeconds === null
    ? null
    : decodeFiniteNumber(value.ageSeconds);
  if (
    typeof value.hit !== "boolean"
    || typeof value.stale !== "boolean"
    || (value.ageSeconds !== null && (ageSeconds === null || ageSeconds < 0))
  ) {
    return null;
  }
  return { hit: value.hit, stale: value.stale, ageSeconds };
}

function decodeGatewayMeta(value: unknown): GatewayMetaV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_META_KEYS)) {
    return null;
  }
  const mode = decodeDataMode(value.mode);
  const source = decodeNonEmptyString(value.source);
  const sourceUrl = value.sourceUrl === null ? null : decodeHttpUrl(value.sourceUrl);
  const asOf = value.asOf === null ? null : decodeIsoDateOrTimestamp(value.asOf);
  const fetchedAt = decodeIsoTimestamp(value.fetchedAt);
  const unit = value.unit === null ? null : decodeNonEmptyString(value.unit);
  const cache = decodeGatewayCache(value.cache);
  if (
    mode === null
    || source === null
    || (value.sourceUrl !== null && sourceUrl === null)
    || (value.asOf !== null && asOf === null)
    || fetchedAt === null
    || (value.unit !== null && unit === null)
    || typeof value.isEstimate !== "boolean"
    || cache === null
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
    cache,
  };
}

function decodeGatewayError(value: unknown): GatewayErrorV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_ERROR_KEYS)) {
    return null;
  }
  const code = decodeNonEmptyString(value.code);
  const message = decodeNonEmptyString(value.message);
  if (code === null || message === null || typeof value.retryable !== "boolean") {
    return null;
  }
  return { code, message, retryable: value.retryable };
}

export interface GatewayDecoderOptions<TData, TState extends string> {
  readonly decodeData: Decoder<TData>;
  readonly decodeState: Decoder<TState>;
  readonly unavailableState: TState;
  readonly isCompatible: (
    state: TState,
    data: TData | null,
    error: GatewayErrorV1 | null,
    meta: GatewayMetaV1,
  ) => boolean;
}

export function decodeGatewayResult<TData, TState extends string>(
  value: unknown,
  options: GatewayDecoderOptions<TData, TState>,
): GatewayResultV1<TData, TState> | null {
  if (!isRecord(value) || !hasExactKeys(value, GATEWAY_ROOT_KEYS)) {
    return null;
  }
  const state = options.decodeState(value.state);
  const meta = decodeGatewayMeta(value.meta);
  if (value.schemaVersion !== GATEWAY_SCHEMA_VERSION || state === null || meta === null) {
    return null;
  }

  const data = value.data === null ? null : options.decodeData(value.data);
  const error = value.error === null ? null : decodeGatewayError(value.error);
  if (
    (value.data !== null && data === null)
    || (value.error !== null && error === null)
    || (state === options.unavailableState
      ? data !== null || error === null || meta.mode !== "unavailable"
      : data === null || meta.mode === "unavailable")
    || !options.isCompatible(state, data, error, meta)
  ) {
    return null;
  }

  return {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state,
    data,
    error,
    meta,
  };
}
