import type { RouteId } from "../../../app/contracts";
import type { AllocationRepresentativeSource } from "../../../app/freight-risk/allocation";
import { KNEI_REPRESENTATIVE_SELECTION } from "../../../app/freight-risk/allocation/fixture";

export interface ValidatedAllocationSourceHarness {
  readonly source: AllocationRepresentativeSource;
  readonly publish: (routeId: RouteId) => void;
}

export function createValidatedAllocationSourceHarness(): ValidatedAllocationSourceHarness {
  const listeners = new Set<() => void>();
  let publishedRoute: RouteId = "KNEI";
  return {
    source: {
      read(routeId) {
        return routeId === publishedRoute && routeId === "KNEI"
          ? KNEI_REPRESENTATIVE_SELECTION
          : null;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    publish(routeId) {
      publishedRoute = routeId;
      listeners.forEach((listener) => listener());
    },
  };
}
