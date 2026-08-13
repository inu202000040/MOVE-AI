import { isRouteId, type RouteId } from "../../contracts";

import { produceModelsCore, type ProducedModelsCoreV1 } from "./core/producer";
import { validateRepresentativeSelection } from "./core/representative";
import {
  decodeRepresentativePayload,
  decodeTuningPayload,
  representativeStorageKey,
  tuningStorageKey,
  type StorageLikeV1,
} from "./core/storage";
import { RISK_MODEL_IDS } from "./core/types";
import { loadApprovedModelsCatalog } from "./reference-catalog";

export const MODELS_REPRESENTATIVE_EVENT_INTERNAL = "move-ai:models-representative-change" as const;

export type ModelsRepresentativeMutationReasonInternalV1 =
  | "manual"
  | "automatic"
  | "keep"
  | "rollback";

export interface ModelsRepresentativeEventTargetInternalV1 {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface ModelsRepresentativeDispatchTargetInternalV1
  extends ModelsRepresentativeEventTargetInternalV1 {
  dispatchEvent(event: Event): boolean;
}

export interface ModelsRepresentativeEventDetailInternalV1 {
  readonly route: RouteId;
  readonly reason: ModelsRepresentativeMutationReasonInternalV1;
  readonly outcome: "ready" | "unavailable";
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).toSorted();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

export function isModelsRepresentativeEventDetailInternal(
  value: unknown,
): value is ModelsRepresentativeEventDetailInternalV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return exactKeys(record, ["route", "reason", "outcome"])
    && isRouteId(record.route)
    && ["manual", "automatic", "keep", "rollback"].includes(String(record.reason))
    && (record.outcome === "ready" || record.outcome === "unavailable");
}

function assertStoredPayloads(storage: StorageLikeV1, route: RouteId): void {
  const representativeRaw = storage.getItem(representativeStorageKey(route));
  if (representativeRaw !== null && decodeRepresentativePayload(representativeRaw, route) === null) {
    throw new TypeError("Stored Models representative payload is invalid");
  }
  for (const modelId of RISK_MODEL_IDS) {
    const tuningRaw = storage.getItem(tuningStorageKey(route, modelId));
    if (tuningRaw !== null && decodeTuningPayload(tuningRaw, route, modelId) === null) {
      throw new TypeError(`Stored Models tuning payload is invalid for ${modelId}`);
    }
  }
}

export function getModelsProducedCoreInternal(
  route: RouteId,
  storage: StorageLikeV1,
): ProducedModelsCoreV1 {
  const routeSnapshot = loadApprovedModelsCatalog()[route];
  assertStoredPayloads(storage, route);
  const produced = produceModelsCore({
    route,
    currentObservation: routeSnapshot.currentObservation,
    baselineModels: routeSnapshot.models,
    storage,
  });
  if (!validateRepresentativeSelection(produced.representative)
    || produced.representative.route !== route) {
    throw new TypeError("Models representative failed strict validation");
  }
  return produced;
}

export function dispatchModelsRepresentativeEventInternal(
  target: ModelsRepresentativeDispatchTargetInternalV1,
  detail: ModelsRepresentativeEventDetailInternalV1,
): void {
  const event = new Event(MODELS_REPRESENTATIVE_EVENT_INTERNAL);
  Object.defineProperty(event, "detail", { configurable: false, enumerable: true, value: detail });
  target.dispatchEvent(event);
}
