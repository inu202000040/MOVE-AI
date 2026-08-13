import { isRouteId, type RouteId } from "../../contracts";
import { produceModelsCore, type ProducedModelsCoreV1 } from "./core/producer";
import { validateRepresentativeSelection } from "./core/representative";
import { isModelsStorageEventForRoute } from "./core/producer";
import type { StorageLikeV1 } from "./core/storage";
import type { ModelsSnapshotRouteV1 } from "./snapshot-adapter";

export const MODELS_REPRESENTATIVE_PUBLICATION_EVENT = "move-ai:models-representative-change" as const;

export type ModelsRepresentativePublicationReasonV1 =
  | "manual"
  | "automatic"
  | "keep"
  | "rollback"
  | "storage";

export interface ModelsRepresentativePublicationV1 {
  readonly route: RouteId;
  readonly reason: Exclude<ModelsRepresentativePublicationReasonV1, "storage">;
}

export interface ModelsRepresentativeEventTargetV1 {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
}

function isPublication(value: unknown): value is ModelsRepresentativePublicationV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).toSorted();
  return keys.length === 2
    && keys[0] === "reason"
    && keys[1] === "route"
    && isRouteId(record.route)
    && ["manual", "automatic", "keep", "rollback"].includes(String(record.reason));
}

export function readValidatedModelsRepresentative(
  routeSnapshot: ModelsSnapshotRouteV1,
  storage: StorageLikeV1,
): ProducedModelsCoreV1 {
  const produced = produceModelsCore({
    route: routeSnapshot.route,
    currentObservation: routeSnapshot.currentObservation,
    baselineModels: routeSnapshot.models,
    storage,
  });
  if (!validateRepresentativeSelection(produced.representative)) {
    throw new TypeError("Models representative publication failed validation");
  }
  return produced;
}

export function publishModelsRepresentativeChange(
  target: ModelsRepresentativeEventTargetV1,
  route: RouteId,
  reason: Exclude<ModelsRepresentativePublicationReasonV1, "storage">,
): void {
  target.dispatchEvent(new CustomEvent<ModelsRepresentativePublicationV1>(
    MODELS_REPRESENTATIVE_PUBLICATION_EVENT,
    { detail: { route, reason } },
  ));
}

export function subscribeModelsRepresentativeChanges(
  target: ModelsRepresentativeEventTargetV1,
  route: RouteId,
  listener: (reason: ModelsRepresentativePublicationReasonV1) => void,
): () => void {
  const onPublication: EventListener = (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isPublication(detail) && detail.route === route) listener(detail.reason);
  };
  const onStorage: EventListener = (event) => {
    const key = (event as Event & { readonly key?: unknown }).key;
    if ((key === null || typeof key === "string") && isModelsStorageEventForRoute(key, route)) {
      listener("storage");
    }
  };
  target.addEventListener(MODELS_REPRESENTATIVE_PUBLICATION_EVENT, onPublication);
  target.addEventListener("storage", onStorage);
  return () => {
    target.removeEventListener(MODELS_REPRESENTATIVE_PUBLICATION_EVENT, onPublication);
    target.removeEventListener("storage", onStorage);
  };
}
