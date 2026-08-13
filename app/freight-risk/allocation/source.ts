import {
  GATEWAY_SCHEMA_VERSION,
  ROUTE_IDS,
  type DataGatewayV1,
  type RouteId,
} from "../../contracts";
import {
  getModelsRepresentative,
  subscribeModelsRepresentative,
} from "../models/representative-consumer";

import {
  adaptRepresentativeSelection,
  type RepresentativeSelectionV1,
} from "./representative";

export interface AllocationRepresentativeSource {
  readonly read: (routeId: RouteId) => unknown;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createGatewayBackedAllocationRepresentativeSource(
  gateway: DataGatewayV1,
  representativeSource: AllocationRepresentativeSource,
): AllocationRepresentativeSource {
  const listeners = new Set<() => void>();
  let abortController: AbortController | null = null;
  let generation = 0;
  let representativeUnsubscribe: (() => void) | null = null;
  let snapshotReady = false;

  const publish = (): void => {
    for (const listener of listeners) listener();
  };

  const loadSnapshot = (): void => {
    if (abortController !== null) return;
    const controller = new AbortController();
    const requestGeneration = ++generation;
    abortController = controller;
    void gateway.snapshot(controller.signal).then(
      (result) => {
        if (generation !== requestGeneration || controller.signal.aborted) return;
        snapshotReady =
          result.schemaVersion === GATEWAY_SCHEMA_VERSION &&
          result.state === "READY" &&
          result.data !== null &&
          result.error === null;
        publish();
      },
      () => {
        if (generation !== requestGeneration || controller.signal.aborted) return;
        snapshotReady = false;
        publish();
      },
    ).finally(() => {
      if (generation === requestGeneration) abortController = null;
    });
  };

  return Object.freeze({
    read(routeId: RouteId): unknown {
      return snapshotReady ? representativeSource.read(routeId) : null;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) {
        representativeUnsubscribe = representativeSource.subscribe(publish);
        loadSnapshot();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size !== 0) return;
        representativeUnsubscribe?.();
        representativeUnsubscribe = null;
        generation += 1;
        abortController?.abort();
        abortController = null;
        snapshotReady = false;
      };
    },
  });
}

export function readAllocationRepresentative(
  source: AllocationRepresentativeSource,
  routeId: RouteId,
): RepresentativeSelectionV1 {
  const representative = adaptRepresentativeSelection(source.read(routeId));
  if (representative.route !== routeId) {
    throw new TypeError("Representative route does not match the shared route");
  }
  return representative.selection;
}

export const UNAVAILABLE_ALLOCATION_REPRESENTATIVE_SOURCE: AllocationRepresentativeSource =
  Object.freeze({
    read: () => null,
    subscribe: () => () => undefined,
  });

export function createBrowserModelsAllocationRepresentativeSource(): AllocationRepresentativeSource {
  if (typeof window === "undefined") {
    return UNAVAILABLE_ALLOCATION_REPRESENTATIVE_SOURCE;
  }

  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return UNAVAILABLE_ALLOCATION_REPRESENTATIVE_SOURCE;
  }

  return Object.freeze({
    read(routeId: RouteId): unknown {
      return getModelsRepresentative(routeId, storage);
    },
    subscribe(listener: () => void): () => void {
      const unsubscribes = ROUTE_IDS.map((routeId) =>
        subscribeModelsRepresentative(window, routeId, storage, listener),
      );
      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe();
      };
    },
  });
}
