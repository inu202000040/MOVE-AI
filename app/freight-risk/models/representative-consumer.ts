import type { RouteId } from "../../contracts";

import { isModelsStorageEventForRoute } from "./core/producer";
import type { StorageLikeV1 } from "./core/storage";
import type { RepresentativeSelectionV1 } from "./core/types";
import {
  getModelsProducedCoreInternal,
  isModelsRepresentativeEventDetailInternal,
  MODELS_REPRESENTATIVE_EVENT_INTERNAL,
  type ModelsRepresentativeEventTargetInternalV1,
} from "./representative-internal";

export type ModelsRepresentativeChangeReasonV1 =
  | "manual"
  | "automatic"
  | "keep"
  | "rollback"
  | "storage";

export interface ModelsRepresentativeReadyUpdateV1 {
  readonly state: "READY";
  readonly route: RouteId;
  readonly reason: ModelsRepresentativeChangeReasonV1;
  readonly representative: RepresentativeSelectionV1;
}

export interface ModelsRepresentativeUnavailableUpdateV1 {
  readonly state: "UNAVAILABLE";
  readonly route: RouteId;
  readonly reason: ModelsRepresentativeChangeReasonV1;
  readonly error: {
    readonly code: "MODELS_REPRESENTATIVE_UNAVAILABLE";
    readonly message: string;
    readonly retryable: false;
  };
}

export type ModelsRepresentativeUpdateV1 =
  | ModelsRepresentativeReadyUpdateV1
  | ModelsRepresentativeUnavailableUpdateV1;

export type ModelsRepresentativeEventTargetV1 = ModelsRepresentativeEventTargetInternalV1;

export type { RepresentativeSelectionV1, StorageLikeV1 };

export function getModelsRepresentative(
  route: RouteId,
  storage: StorageLikeV1,
): RepresentativeSelectionV1 {
  return getModelsProducedCoreInternal(route, storage).representative;
}

function unavailableUpdate(
  route: RouteId,
  reason: ModelsRepresentativeChangeReasonV1,
): ModelsRepresentativeUnavailableUpdateV1 {
  return {
    state: "UNAVAILABLE",
    route,
    reason,
    error: {
      code: "MODELS_REPRESENTATIVE_UNAVAILABLE",
      message: "The validated Models representative is unavailable.",
      retryable: false,
    },
  };
}

function resolveUpdate(
  route: RouteId,
  storage: StorageLikeV1,
  reason: ModelsRepresentativeChangeReasonV1,
  forcedUnavailable = false,
): ModelsRepresentativeUpdateV1 {
  try {
    const representative = getModelsRepresentative(route, storage);
    if (forcedUnavailable) return unavailableUpdate(route, reason);
    return { state: "READY", route, reason, representative };
  } catch {
    return unavailableUpdate(route, reason);
  }
}

export function subscribeModelsRepresentative(
  target: ModelsRepresentativeEventTargetV1,
  route: RouteId,
  storage: StorageLikeV1,
  listener: (update: ModelsRepresentativeUpdateV1) => void,
): () => void {
  const onPublication: EventListener = (event) => {
    const detail = (event as Event & { readonly detail?: unknown }).detail;
    if (!isModelsRepresentativeEventDetailInternal(detail) || detail.route !== route) return;
    listener(resolveUpdate(route, storage, detail.reason, detail.outcome === "unavailable"));
  };
  const onStorage: EventListener = (event) => {
    const key = (event as Event & { readonly key?: unknown }).key;
    if ((key === null || typeof key === "string") && isModelsStorageEventForRoute(key, route)) {
      listener(resolveUpdate(route, storage, "storage"));
    }
  };
  target.addEventListener(MODELS_REPRESENTATIVE_EVENT_INTERNAL, onPublication);
  target.addEventListener("storage", onStorage);
  return () => {
    target.removeEventListener(MODELS_REPRESENTATIVE_EVENT_INTERNAL, onPublication);
    target.removeEventListener("storage", onStorage);
  };
}
