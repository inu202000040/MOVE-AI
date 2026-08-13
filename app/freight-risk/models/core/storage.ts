import { STORAGE_KEYS, isRouteId, type RouteId } from "../../../contracts";
import { computeTuningRunHash } from "./canonical";
import { isRiskModelId } from "./registry";
import { decodeTuneSuccess } from "./tuning";
import type { HashedTuneResultV1, RiskModelId } from "./types";

export const TUNING_STORAGE_SCHEMA_VERSION = "move-ai/tuning-store-v1" as const;
export const REPRESENTATIVE_STORAGE_SCHEMA_VERSION = "move-ai/representative-store-v1" as const;

export interface StorageLikeV1 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredTuningPayloadV1 {
  readonly schemaVersion: typeof TUNING_STORAGE_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly domainIdentity: {
    readonly routeCode: RouteId;
    readonly modelId: RiskModelId;
  };
  readonly data: HashedTuneResultV1;
}

export interface StoredRepresentativePayloadV1 {
  readonly schemaVersion: typeof REPRESENTATIVE_STORAGE_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly domainIdentity: {
    readonly routeCode: RouteId;
  };
  readonly data: {
    readonly modelId: RiskModelId;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function validSavedAt(value: unknown): value is string {
  return typeof value === "string" && value.includes("T") && !Number.isNaN(Date.parse(value));
}

export function tuningStorageKey(route: RouteId, modelId: RiskModelId): string {
  return `${STORAGE_KEYS.tuningPrefix}${route}:${modelId}`;
}

export function representativeStorageKey(route: RouteId): string {
  return `${STORAGE_KEYS.representativePrefix}${route}`;
}

export function encodeTuningPayload(
  route: RouteId,
  value: HashedTuneResultV1,
  savedAt: string,
): string {
  if (!validSavedAt(savedAt) || value.result.routeCode !== route
    || computeTuningRunHash(value.result) !== value.tuningRunHash) {
    throw new TypeError("Cannot encode an invalid tuning payload");
  }
  const payload: StoredTuningPayloadV1 = {
    schemaVersion: TUNING_STORAGE_SCHEMA_VERSION,
    savedAt,
    domainIdentity: { routeCode: route, modelId: value.result.modelId },
    data: value,
  };
  return JSON.stringify(payload);
}

export function decodeTuningPayload(
  serialized: string,
  expectedRoute: RouteId,
  expectedModel: RiskModelId,
): StoredTuningPayloadV1 | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || !exactKeys(parsed, ["schemaVersion", "savedAt", "domainIdentity", "data"])
      || parsed.schemaVersion !== TUNING_STORAGE_SCHEMA_VERSION || !validSavedAt(parsed.savedAt)
      || !isRecord(parsed.domainIdentity)
      || !exactKeys(parsed.domainIdentity, ["routeCode", "modelId"])
      || parsed.domainIdentity.routeCode !== expectedRoute || parsed.domainIdentity.modelId !== expectedModel
      || !isRecord(parsed.data) || !exactKeys(parsed.data, ["result", "tuningRunHash"])
      || typeof parsed.data.tuningRunHash !== "string") {
      return null;
    }
    const result = decodeTuneSuccess(parsed.data.result);
    if (result.routeCode !== expectedRoute || result.modelId !== expectedModel
      || computeTuningRunHash(result) !== parsed.data.tuningRunHash) {
      return null;
    }
    return {
      schemaVersion: TUNING_STORAGE_SCHEMA_VERSION,
      savedAt: parsed.savedAt,
      domainIdentity: { routeCode: expectedRoute, modelId: expectedModel },
      data: { result, tuningRunHash: parsed.data.tuningRunHash },
    };
  } catch {
    return null;
  }
}

export function encodeRepresentativePayload(
  route: RouteId,
  modelId: RiskModelId,
  savedAt: string,
): string {
  if (!validSavedAt(savedAt)) {
    throw new TypeError("Cannot encode a representative payload without a valid timestamp");
  }
  const payload: StoredRepresentativePayloadV1 = {
    schemaVersion: REPRESENTATIVE_STORAGE_SCHEMA_VERSION,
    savedAt,
    domainIdentity: { routeCode: route },
    data: { modelId },
  };
  return JSON.stringify(payload);
}

export function decodeRepresentativePayload(
  serialized: string,
  expectedRoute: RouteId,
): StoredRepresentativePayloadV1 | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || !exactKeys(parsed, ["schemaVersion", "savedAt", "domainIdentity", "data"])
      || parsed.schemaVersion !== REPRESENTATIVE_STORAGE_SCHEMA_VERSION || !validSavedAt(parsed.savedAt)
      || !isRecord(parsed.domainIdentity) || !exactKeys(parsed.domainIdentity, ["routeCode"])
      || parsed.domainIdentity.routeCode !== expectedRoute || !isRecord(parsed.data)
      || !exactKeys(parsed.data, ["modelId"]) || !isRiskModelId(parsed.data.modelId)) {
      return null;
    }
    return {
      schemaVersion: REPRESENTATIVE_STORAGE_SCHEMA_VERSION,
      savedAt: parsed.savedAt,
      domainIdentity: { routeCode: expectedRoute },
      data: { modelId: parsed.data.modelId },
    };
  } catch {
    return null;
  }
}

export function writeAcceptedTuning(
  storage: StorageLikeV1,
  route: RouteId,
  value: HashedTuneResultV1,
  savedAt = new Date().toISOString(),
): void {
  storage.setItem(
    tuningStorageKey(route, value.result.modelId),
    encodeTuningPayload(route, value, savedAt),
  );
}

export function writeManualRepresentative(
  storage: StorageLikeV1,
  route: RouteId,
  modelId: RiskModelId,
  savedAt = new Date().toISOString(),
): void {
  storage.setItem(
    representativeStorageKey(route),
    encodeRepresentativePayload(route, modelId, savedAt),
  );
}

export function clearManualRepresentative(storage: StorageLikeV1, route: RouteId): void {
  storage.removeItem(representativeStorageKey(route));
}

export interface ModelsStorageSnapshotV1 {
  readonly manualModelId: RiskModelId | null;
  readonly tuningByModel: Readonly<Partial<Record<RiskModelId, HashedTuneResultV1>>>;
}

export function readModelsStorage(storage: StorageLikeV1, route: RouteId): ModelsStorageSnapshotV1 {
  const representativeKey = representativeStorageKey(route);
  const representativeRaw = storage.getItem(representativeKey);
  let manualModelId: RiskModelId | null = null;
  if (representativeRaw !== null) {
    const decoded = decodeRepresentativePayload(representativeRaw, route);
    if (decoded === null) {
      storage.removeItem(representativeKey);
    } else {
      manualModelId = decoded.data.modelId;
    }
  }
  const tuningByModel: Partial<Record<RiskModelId, HashedTuneResultV1>> = {};
  for (const modelId of [
    "naive", "sarimax", "lightgbm", "xgboost", "random_forest", "prophet", "timesfm", "chronos",
  ] as const) {
    const key = tuningStorageKey(route, modelId);
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const decoded = decodeTuningPayload(raw, route, modelId);
    if (decoded === null) {
      storage.removeItem(key);
    } else {
      tuningByModel[modelId] = decoded.data;
    }
  }
  return { manualModelId, tuningByModel };
}

export function routeFromStorageDomain(value: unknown): RouteId | null {
  return isRouteId(value) ? value : null;
}
