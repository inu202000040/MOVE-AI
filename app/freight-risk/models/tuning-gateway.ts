import {
  DATA_MODES,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_DETAIL_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  GATEWAY_SCHEMA_VERSION,
} from "../../contracts";

import type { TuneRequestV1 } from "./core/types";

type UnknownRecord = Readonly<Record<string, unknown>>;

export class TuningGatewayError extends Error {
  readonly code: "INVALID_ENVELOPE" | "UNAVAILABLE";

  constructor(code: TuningGatewayError["code"], message: string) {
    super(message);
    this.name = "TuningGatewayError";
    this.code = code;
  }
}

function fail(code: TuningGatewayError["code"], message: string): never {
  throw new TuningGatewayError(code, message);
}

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("INVALID_ENVELOPE", `${label} must be an object`);
  }
  return value as UnknownRecord;
}

function exactKeys(value: UnknownRecord, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).toSorted();
  const expected = [...keys].toSorted();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("INVALID_ENVELOPE", `${label} has unexpected fields`);
  }
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return fail("INVALID_ENVELOPE", `${label} must be nullable text`);
  return value;
}

function validateMeta(value: unknown): void {
  const meta = record(value, "gateway.meta");
  exactKeys(meta, GATEWAY_META_KEYS, "gateway.meta");
  if (typeof meta.mode !== "string" || !(DATA_MODES as readonly string[]).includes(meta.mode)) {
    fail("INVALID_ENVELOPE", "gateway.meta.mode is invalid");
  }
  for (const key of ["source", "fetchedAt", "attribution"] as const) {
    if (typeof meta[key] !== "string") fail("INVALID_ENVELOPE", `gateway.meta.${key} must be text`);
  }
  if (Number.isNaN(Date.parse(meta.fetchedAt as string))) {
    fail("INVALID_ENVELOPE", "gateway.meta.fetchedAt must be an ISO timestamp");
  }
  nullableString(meta.sourceUrl, "gateway.meta.sourceUrl");
  nullableString(meta.asOf, "gateway.meta.asOf");
  nullableString(meta.unit, "gateway.meta.unit");
  nullableString(meta.provider, "gateway.meta.provider");
  if (typeof meta.isEstimate !== "boolean" || !Array.isArray(meta.warnings) || meta.warnings.some((item) => typeof item !== "string")) {
    fail("INVALID_ENVELOPE", "gateway.meta fields are invalid");
  }
  const cache = record(meta.cache, "gateway.meta.cache");
  exactKeys(cache, GATEWAY_CACHE_KEYS, "gateway.meta.cache");
  if (typeof cache.hit !== "boolean" || typeof cache.stale !== "boolean") {
    fail("INVALID_ENVELOPE", "gateway.meta.cache flags are invalid");
  }
  if (cache.ageSeconds !== null && (typeof cache.ageSeconds !== "number" || !Number.isFinite(cache.ageSeconds) || cache.ageSeconds < 0)) {
    fail("INVALID_ENVELOPE", "gateway.meta.cache.ageSeconds is invalid");
  }
  if (meta.mode === "cached" && cache.hit !== true) {
    fail("INVALID_ENVELOPE", "cached gateway mode requires a cache hit");
  }
}

function validateError(value: unknown): void {
  const error = record(value, "gateway.error");
  exactKeys(error, GATEWAY_ERROR_KEYS, "gateway.error");
  if (typeof error.code !== "string" || typeof error.message !== "string" || typeof error.retryable !== "boolean") {
    fail("INVALID_ENVELOPE", "gateway.error fields are invalid");
  }
  if (error.upstreamStatus !== null && (!Number.isInteger(error.upstreamStatus) || (error.upstreamStatus as number) < 100)) {
    fail("INVALID_ENVELOPE", "gateway.error.upstreamStatus is invalid");
  }
  if (error.details !== null) {
    const details = record(error.details, "gateway.error.details");
    exactKeys(details, GATEWAY_ERROR_DETAIL_KEYS, "gateway.error.details");
    if (typeof details.reasonCode !== "string") {
      fail("INVALID_ENVELOPE", "gateway.error.details.reasonCode must be text");
    }
  }
}

export function decodeTuningGatewayResult(value: unknown): unknown {
  const root = record(value, "gateway");
  exactKeys(root, GATEWAY_ROOT_KEYS, "gateway");
  if (root.schemaVersion !== GATEWAY_SCHEMA_VERSION) {
    return fail("INVALID_ENVELOPE", "gateway schema version is invalid");
  }
  if (root.state !== "READY" && root.state !== "UNAVAILABLE") {
    return fail("INVALID_ENVELOPE", "tuning gateway state is invalid");
  }
  validateMeta(root.meta);
  if (root.state === "UNAVAILABLE") {
    if (root.data !== null || root.error === null || (root.meta as UnknownRecord).mode !== "unavailable") {
      return fail("INVALID_ENVELOPE", "unavailable tuning envelope is inconsistent");
    }
    validateError(root.error);
    return fail("UNAVAILABLE", "재측정 엔진에 연결할 수 없습니다. 기존 결과는 유지됩니다.");
  }
  if (root.data === null || root.error !== null || (root.meta as UnknownRecord).mode === "unavailable") {
    return fail("INVALID_ENVELOPE", "ready tuning envelope is inconsistent");
  }
  return root.data;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function fetchTuningEnvelope(
  fetcher: FetchLike,
  signal: AbortSignal,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher("/api/freight-risk/tune", { ...init, cache: "no-store", signal });
  } catch {
    return fail("UNAVAILABLE", "재측정 엔진에 연결할 수 없습니다. 기존 결과는 유지됩니다.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail("INVALID_ENVELOPE", "재측정 결과를 검증하지 못했습니다. 기존 결과는 유지됩니다.");
  }
  return decodeTuningGatewayResult(body);
}

export async function runTuningGateway(
  request: TuneRequestV1,
  signal: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<unknown> {
  await fetchTuningEnvelope(fetcher, signal);
  return fetchTuningEnvelope(fetcher, signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}
