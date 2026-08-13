import type { RouteId } from "../../../contracts";
import {
  getModelsRepresentative,
  subscribeModelsRepresentative,
  type ModelsRepresentativeEventTargetV1,
  type ModelsRepresentativeUpdateV1,
  type StorageLikeV1,
} from "../../models/representative-consumer";

import type { DashboardRepresentativeSourceV1 } from "./runtime-seams";

export function createModelsRepresentativeSource(
  target: ModelsRepresentativeEventTargetV1,
  storage: StorageLikeV1,
): DashboardRepresentativeSourceV1 {
  const snapshots = new Map<RouteId, unknown>();
  const read = (routeId: RouteId): unknown => {
    if (snapshots.has(routeId)) return snapshots.get(routeId) ?? null;
    try {
      const representative = getModelsRepresentative(routeId, storage);
      snapshots.set(routeId, representative);
      return representative;
    } catch {
      snapshots.set(routeId, null);
      return null;
    }
  };
  const accept = (update: ModelsRepresentativeUpdateV1): void => {
    snapshots.set(update.route, update.state === "READY" ? update.representative : null);
  };
  return Object.freeze({
    current(routeId: RouteId): unknown {
      return read(routeId);
    },
    subscribe(routeId: RouteId, listener: () => void): () => void {
      return subscribeModelsRepresentative(target, routeId, storage, (update) => {
        accept(update);
        listener();
      });
    },
  });
}

let browserSource: DashboardRepresentativeSourceV1 | null = null;

function getBrowserSource(): DashboardRepresentativeSourceV1 | null {
  if (typeof window === "undefined") return null;
  browserSource ??= createModelsRepresentativeSource(window, window.localStorage);
  return browserSource;
}

export const MODELS_REPRESENTATIVE_SOURCE: DashboardRepresentativeSourceV1 = Object.freeze({
  current(routeId: RouteId): unknown {
    return getBrowserSource()?.current(routeId) ?? null;
  },
  subscribe(routeId: RouteId, listener: () => void): () => void {
    return getBrowserSource()?.subscribe(routeId, listener) ?? (() => undefined);
  },
});
