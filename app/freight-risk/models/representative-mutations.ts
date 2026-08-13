import type { RouteId } from "../../contracts";

import { getModelsRepresentative, type ModelsRepresentativeUpdateV1 } from "./representative-consumer";
import {
  dispatchModelsRepresentativeEventInternal,
  type ModelsRepresentativeDispatchTargetInternalV1,
  type ModelsRepresentativeMutationReasonInternalV1,
} from "./representative-internal";
import {
  clearManualRepresentative,
  writeAcceptedTuning,
  writeManualRepresentative,
  type StorageLikeV1,
} from "./core/storage";
import { keepTuningCandidate, rollbackTuningCandidate, type TuningSessionStateV1 } from "./core/tuning";
import type { RepresentativeSelectionV1, RiskModelId } from "./core/types";

function unavailable(
  route: RouteId,
  reason: ModelsRepresentativeMutationReasonInternalV1,
): ModelsRepresentativeUpdateV1 {
  return {
    state: "UNAVAILABLE",
    route,
    reason,
    error: {
      code: "MODELS_REPRESENTATIVE_UNAVAILABLE",
      message: "The Models mutation could not publish a validated representative.",
      retryable: false,
    },
  };
}

function mutateValidateAndDispatch(
  target: ModelsRepresentativeDispatchTargetInternalV1,
  route: RouteId,
  storage: StorageLikeV1,
  reason: ModelsRepresentativeMutationReasonInternalV1,
  mutate: () => void,
  postcondition: (representative: RepresentativeSelectionV1) => boolean,
): ModelsRepresentativeUpdateV1 {
  let update: ModelsRepresentativeUpdateV1;
  try {
    mutate();
    const representative = getModelsRepresentative(route, storage);
    if (!postcondition(representative)) {
      throw new TypeError(`Models ${reason} mutation failed its validated postcondition`);
    }
    update = { state: "READY", route, reason, representative };
  } catch {
    update = unavailable(route, reason);
  }
  dispatchModelsRepresentativeEventInternal(target, {
    route,
    reason,
    outcome: update.state === "READY" ? "ready" : "unavailable",
  });
  return update;
}

export function setManualModelsRepresentativeInternal(
  target: ModelsRepresentativeDispatchTargetInternalV1,
  route: RouteId,
  storage: StorageLikeV1,
  modelId: RiskModelId,
  savedAt?: string,
): ModelsRepresentativeUpdateV1 {
  return mutateValidateAndDispatch(
    target,
    route,
    storage,
    "manual",
    () => writeManualRepresentative(storage, route, modelId, savedAt),
    (representative) => representative.selectionMode === "manual" && representative.modelId === modelId,
  );
}

export function restoreAutomaticModelsRepresentativeInternal(
  target: ModelsRepresentativeDispatchTargetInternalV1,
  route: RouteId,
  storage: StorageLikeV1,
): ModelsRepresentativeUpdateV1 {
  return mutateValidateAndDispatch(
    target,
    route,
    storage,
    "automatic",
    () => clearManualRepresentative(storage, route),
    (representative) => representative.selectionMode === "automatic"
      && representative.modelId === representative.automaticChampion.modelId,
  );
}

export interface KeepModelsTuningCandidateResultInternalV1 {
  readonly state: TuningSessionStateV1;
  readonly persisted: boolean;
  readonly warning: string | null;
  readonly update: ModelsRepresentativeUpdateV1;
}

export function keepModelsTuningCandidateInternal(
  target: ModelsRepresentativeDispatchTargetInternalV1,
  route: RouteId,
  storage: StorageLikeV1,
  state: TuningSessionStateV1,
  savedAt?: string,
): KeepModelsTuningCandidateResultInternalV1 {
  const kept = keepTuningCandidate(state);
  if (kept.accepted === null) {
    throw new Error("Kept tuning state must contain an accepted result");
  }
  const accepted = kept.accepted;
  const update = mutateValidateAndDispatch(
    target,
    route,
    storage,
    "keep",
    () => writeAcceptedTuning(storage, route, accepted, savedAt),
    (representative) => representative.modelAgreementByHorizon.every(({ members }) => {
      const member = members.find(({ modelId }) => modelId === accepted.result.modelId);
      return member?.forecastSource === "tuned" && member.tuningRunHash === accepted.tuningRunHash;
    }),
  );
  return {
    state: kept,
    persisted: update.state === "READY",
    warning: update.state === "READY" ? null : "The tuning result could not be saved in browser storage.",
    update,
  };
}

export interface RollbackModelsTuningCandidateResultInternalV1 {
  readonly state: TuningSessionStateV1;
  readonly update: ModelsRepresentativeUpdateV1;
}

export function rollbackModelsTuningCandidateInternal(
  target: ModelsRepresentativeDispatchTargetInternalV1,
  route: RouteId,
  storage: StorageLikeV1,
  state: TuningSessionStateV1,
): RollbackModelsTuningCandidateResultInternalV1 {
  const rolledBack = rollbackTuningCandidate(state);
  const update = mutateValidateAndDispatch(
    target,
    route,
    storage,
    "rollback",
    () => undefined,
    () => true,
  );
  return { state: rolledBack, update };
}
