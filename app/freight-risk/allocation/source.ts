import type { RouteId } from "../../contracts";

import {
  adaptRepresentativeSelection,
  type RepresentativeSelectionV1,
} from "./representative";

export interface AllocationRepresentativeSource {
  readonly read: (routeId: RouteId) => unknown;
  readonly subscribe: (listener: () => void) => () => void;
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
