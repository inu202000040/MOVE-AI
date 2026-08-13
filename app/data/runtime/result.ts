import {
  DATA_MODES,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_DETAIL_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  GATEWAY_SCHEMA_VERSION,
  type DataModeV1,
  type GatewayErrorV1,
  type GatewayMetaV1,
  type GatewayResultV1,
} from "../../contracts/gateway";
import {
  boolean,
  exactKeys,
  integer,
  isoDate,
  isoTimestamp,
  nullableFinite,
  nullableString,
  oneOf,
  record,
  string,
  stringArray,
} from "../artifacts/decoder-core";

export type DomainDecoder<TData> = (value: unknown) => TData;
export type StateGuard<TState extends string> = (value: unknown) => value is TState;
export type StateDataCompatibility<TData, TState extends string> = (
  state: TState,
  data: TData,
  meta: GatewayMetaV1,
) => void;

function safeSourceUrl(value: unknown): string | null {
  const sourceUrl = nullableString(value, "$result.meta.sourceUrl");
  if (sourceUrl === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("Gateway sourceUrl must be a valid URL");
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
    throw new Error("Gateway sourceUrl must be a public http(s) URL without credentials");
  }
  return sourceUrl;
}

function safeAsOf(value: unknown): string | null {
  const asOf = nullableString(value, "$result.meta.asOf");
  if (asOf === null) return null;
  try {
    return isoDate(asOf, "$result.meta.asOf");
  } catch {
    return isoTimestamp(asOf, "$result.meta.asOf");
  }
}

function decodeMeta(value: unknown): GatewayMetaV1 {
  const meta = record(value, "$result.meta");
  exactKeys(meta, GATEWAY_META_KEYS, "$result.meta");
  const cache = record(meta.cache, "$result.meta.cache");
  exactKeys(cache, GATEWAY_CACHE_KEYS, "$result.meta.cache");
  const mode = oneOf(meta.mode, DATA_MODES, "$result.meta.mode");
  const hit = boolean(cache.hit, "$result.meta.cache.hit");
  const stale = boolean(cache.stale, "$result.meta.cache.stale");
  const ageSeconds = nullableFinite(cache.ageSeconds, "$result.meta.cache.ageSeconds");
  if (ageSeconds !== null && ageSeconds < 0) throw new Error("Cache age cannot be negative");
  if (mode === "cached" && !hit) throw new Error("Cached mode requires cache hit");
  return {
    mode,
    source: string(meta.source, "$result.meta.source"),
    sourceUrl: safeSourceUrl(meta.sourceUrl),
    asOf: safeAsOf(meta.asOf),
    fetchedAt: isoTimestamp(meta.fetchedAt, "$result.meta.fetchedAt"),
    unit: nullableString(meta.unit, "$result.meta.unit"),
    isEstimate: boolean(meta.isEstimate, "$result.meta.isEstimate"),
    attribution: string(meta.attribution, "$result.meta.attribution"),
    warnings: stringArray(meta.warnings, "$result.meta.warnings"),
    provider: nullableString(meta.provider, "$result.meta.provider"),
    cache: { hit, stale, ageSeconds },
  };
}

function decodeError(value: unknown): GatewayErrorV1 | null {
  if (value === null) return null;
  const error = record(value, "$result.error");
  exactKeys(error, GATEWAY_ERROR_KEYS, "$result.error");
  let details: GatewayErrorV1["details"] = null;
  if (error.details !== null) {
    const rawDetails = record(error.details, "$result.error.details");
    exactKeys(rawDetails, GATEWAY_ERROR_DETAIL_KEYS, "$result.error.details");
    details = { reasonCode: string(rawDetails.reasonCode, "$result.error.details.reasonCode") };
  }
  const upstreamStatus = error.upstreamStatus === null
    ? null
    : integer(error.upstreamStatus, "$result.error.upstreamStatus");
  return {
    code: string(error.code, "$result.error.code"),
    message: string(error.message, "$result.error.message"),
    retryable: boolean(error.retryable, "$result.error.retryable"),
    upstreamStatus,
    details,
  };
}

export function parseGatewayResultV1<TData, TState extends string>(
  value: unknown,
  decodeData: DomainDecoder<TData>,
  isState: StateGuard<TState>,
  assertCompatibility: StateDataCompatibility<TData, TState>,
): GatewayResultV1<TData, TState> {
  const root = record(value, "$result");
  exactKeys(root, GATEWAY_ROOT_KEYS, "$result");
  if (root.schemaVersion !== GATEWAY_SCHEMA_VERSION) throw new Error("Wrong gateway schema version");
  if (!isState(root.state)) throw new Error(`Wrong domain state ${String(root.state)}`);
  const meta = decodeMeta(root.meta);
  const error = decodeError(root.error);
  if (root.state === "UNAVAILABLE") {
    if (root.data !== null || error === null || meta.mode !== "unavailable") {
      throw new Error("Unavailable result invariant failed");
    }
    return { schemaVersion: GATEWAY_SCHEMA_VERSION, state: root.state, data: null, meta, error };
  }
  if (root.data === null || error !== null || meta.mode === "unavailable") {
    throw new Error("Successful result invariant failed");
  }
  const data = decodeData(root.data);
  assertCompatibility(root.state, data, meta);
  return {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state: root.state,
    data,
    meta,
    error: null,
  };
}

export function gatewaySuccess<TData, TState extends string>(input: {
  readonly state: TState;
  readonly data: TData;
  readonly mode: Exclude<DataModeV1, "unavailable">;
  readonly source: string;
  readonly asOf: string | null;
  readonly fetchedAt: string;
  readonly unit: string | null;
  readonly isEstimate: boolean;
  readonly attribution: string;
  readonly warnings?: readonly string[];
  readonly provider?: string | null;
  readonly stale?: boolean;
}): GatewayResultV1<TData, TState> {
  return {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state: input.state,
    data: input.data,
    meta: {
      mode: input.mode,
      source: input.source,
      sourceUrl: null,
      asOf: input.asOf,
      fetchedAt: input.fetchedAt,
      unit: input.unit,
      isEstimate: input.isEstimate,
      attribution: input.attribution,
      warnings: input.warnings ?? [],
      provider: input.provider ?? null,
      cache: { hit: false, stale: input.stale ?? false, ageSeconds: null },
    },
    error: null,
  };
}

export function gatewayUnavailable<TState extends "UNAVAILABLE">(input: {
  readonly state: TState;
  readonly code: string;
  readonly message: string;
  readonly reasonCode: string;
  readonly source: string;
  readonly fetchedAt: string;
  readonly attribution: string;
  readonly retryable?: boolean;
}): GatewayResultV1<never, TState> {
  return {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state: input.state,
    data: null,
    meta: {
      mode: "unavailable",
      source: input.source,
      sourceUrl: null,
      asOf: null,
      fetchedAt: input.fetchedAt,
      unit: null,
      isEstimate: false,
      attribution: input.attribution,
      warnings: [],
      provider: null,
      cache: { hit: false, stale: false, ageSeconds: null },
    },
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable ?? false,
      upstreamStatus: null,
      details: { reasonCode: input.reasonCode },
    },
  };
}
