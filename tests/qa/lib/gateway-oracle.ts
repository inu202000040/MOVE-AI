type JsonRecord = Readonly<Record<string, unknown>>;

const MODES = new Set(["live", "fixture", "cached", "unavailable"]);
const ROOT_KEYS = ["schemaVersion", "state", "data", "meta", "error"];
const META_KEYS = [
  "mode", "source", "sourceUrl", "asOf", "fetchedAt", "unit", "isEstimate",
  "attribution", "warnings", "provider", "cache",
];
const CACHE_KEYS = ["hit", "stale", "ageSeconds"];
const ERROR_KEYS = ["code", "message", "retryable", "upstreamStatus", "details"];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: JsonRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isFiniteNullableNonnegative(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function validCache(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, CACHE_KEYS)) return false;
  return typeof value.hit === "boolean"
    && typeof value.stale === "boolean"
    && isFiniteNullableNonnegative(value.ageSeconds);
}

function validMeta(value: unknown): value is JsonRecord {
  if (!isRecord(value) || !hasExactKeys(value, META_KEYS)) return false;
  return typeof value.mode === "string"
    && MODES.has(value.mode)
    && typeof value.source === "string"
    && isNullableString(value.sourceUrl)
    && isNullableString(value.asOf)
    && typeof value.fetchedAt === "string"
    && isNullableString(value.unit)
    && typeof value.isEstimate === "boolean"
    && typeof value.attribution === "string"
    && Array.isArray(value.warnings)
    && value.warnings.every((warning) => typeof warning === "string")
    && isNullableString(value.provider)
    && validCache(value.cache);
}

function validError(value: unknown): value is JsonRecord {
  if (!isRecord(value) || !hasExactKeys(value, ERROR_KEYS)) return false;
  return typeof value.code === "string"
    && typeof value.message === "string"
    && typeof value.retryable === "boolean"
    && (value.upstreamStatus === null || (Number.isInteger(value.upstreamStatus) && Number(value.upstreamStatus) >= 100))
    && (value.details === null || isRecord(value.details));
}

export interface GatewayOracleOptions {
  readonly states: ReadonlySet<string>;
  readonly staleStateSupported: boolean;
  readonly decodeData: (value: unknown) => boolean;
}

export function acceptsGatewayResult(value: unknown, options: GatewayOracleOptions): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ROOT_KEYS)) return false;
  if (value.schemaVersion !== "move-ai/gateway/v1") return false;
  if (typeof value.state !== "string" || !options.states.has(value.state)) return false;
  if (!validMeta(value.meta)) return false;
  if (value.error !== null && !validError(value.error)) return false;

  if (value.state === "UNAVAILABLE") {
    if (value.data !== null || value.error === null || value.meta.mode !== "unavailable") return false;
  } else if (value.data === null || value.error !== null || !options.decodeData(value.data)) {
    return false;
  }

  const cache = value.meta.cache as JsonRecord;
  if (value.meta.mode === "cached" && cache.hit !== true) return false;
  if (cache.stale === true && options.staleStateSupported && value.state !== "STALE") return false;
  if (value.state === "STALE" && cache.stale !== true) return false;
  if (value.meta.mode === "fixture" && value.state === "LIVE") return false;
  return true;
}

export function acceptsExactQuery(
  query: URLSearchParams,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>();
  for (const [key, value] of query) {
    if (!allowedKeys.has(key) || seen.has(key) || value.length === 0) return false;
    seen.add(key);
  }
  return [...requiredKeys].every((key) => seen.has(key));
}
