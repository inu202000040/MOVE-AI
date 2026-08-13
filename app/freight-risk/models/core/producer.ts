import type { RouteId } from "../../../contracts";
import { buildRepresentativeSelection, mergeAcceptedTunes } from "./representative";
import {
  readModelsStorage,
  representativeStorageKey,
  tuningStorageKey,
  writeAcceptedTuning,
  type ModelsStorageSnapshotV1,
  type StorageLikeV1,
} from "./storage";
import { keepTuningCandidate, rollbackTuningCandidate, type TuningSessionStateV1 } from "./tuning";
import {
  RISK_MODEL_IDS,
  type CurrentObservationV1,
  type EightTuple,
  type HashedTuneResultV1,
  type ModelProjectionV1,
  type RepresentativeSelectionV1,
  type RiskModelId,
} from "./types";

export interface ProduceModelsCoreInputV1 {
  readonly route: RouteId;
  readonly currentObservation: CurrentObservationV1;
  readonly baselineModels: EightTuple<ModelProjectionV1>;
  readonly storage: StorageLikeV1;
  readonly sessionTuningByModel?: Readonly<Partial<Record<RiskModelId, HashedTuneResultV1>>>;
  readonly manualModelIdOverride?: RiskModelId | null;
}

export interface ProducedModelsCoreV1 {
  readonly storageSnapshot: ModelsStorageSnapshotV1;
  readonly mergedModels: EightTuple<ModelProjectionV1>;
  readonly representative: RepresentativeSelectionV1;
}

export function produceModelsCore(input: ProduceModelsCoreInputV1): ProducedModelsCoreV1 {
  const storageSnapshot = readModelsStorage(input.storage, input.route);
  const tuningByModel = {
    ...storageSnapshot.tuningByModel,
    ...(input.sessionTuningByModel ?? {}),
  };
  const mergedModels = mergeAcceptedTunes(
    input.route,
    input.currentObservation,
    input.baselineModels,
    tuningByModel,
  );
  const representative = buildRepresentativeSelection({
    route: input.route,
    currentObservation: input.currentObservation,
    models: mergedModels,
    manualModelId: input.manualModelIdOverride === undefined
      ? storageSnapshot.manualModelId
      : input.manualModelIdOverride,
  });
  return { storageSnapshot, mergedModels, representative };
}

export interface KeepCandidateResultV1 {
  readonly state: TuningSessionStateV1;
  readonly persisted: boolean;
  readonly warning: string | null;
}

export function keepCandidateAndPersist(
  storage: StorageLikeV1,
  route: RouteId,
  state: TuningSessionStateV1,
  savedAt = new Date().toISOString(),
): KeepCandidateResultV1 {
  const kept = keepTuningCandidate(state);
  if (kept.accepted === null) {
    throw new Error("Kept tuning state must contain an accepted result");
  }
  try {
    writeAcceptedTuning(storage, route, kept.accepted, savedAt);
    return { state: kept, persisted: true, warning: null };
  } catch {
    return {
      state: kept,
      persisted: false,
      warning: "재측정 결과를 이 브라우저에 저장하지 못했습니다.",
    };
  }
}

export function rollbackCandidateWithoutStorageWrite(
  state: TuningSessionStateV1,
): TuningSessionStateV1 {
  return rollbackTuningCandidate(state);
}

export function isModelsStorageEventForRoute(key: string | null, route: RouteId): boolean {
  if (key === null) {
    return true;
  }
  if (key === representativeStorageKey(route)) {
    return true;
  }
  return RISK_MODEL_IDS.some((modelId) => key === tuningStorageKey(route, modelId));
}
