import { ROUTE_IDS } from "../../../contracts/routes";

export type NetworkPointerSelection =
  | { readonly kind: "weather"; readonly id: string }
  | { readonly kind: "port"; readonly id: string }
  | { readonly kind: "chokepoint"; readonly id: string }
  | { readonly kind: "route"; readonly id: string }
  | { readonly kind: "overlap"; readonly routeIds: readonly string[] }
  | { readonly kind: "none" };

export interface PointHitCandidate {
  readonly id: string;
  readonly distance: number;
  readonly explicitTarget: boolean;
  readonly visualOrder: number;
}

export interface NetworkPointerHits {
  readonly weather: readonly PointHitCandidate[];
  readonly ports: readonly PointHitCandidate[];
  readonly chokepoints: readonly PointHitCandidate[];
  readonly routeIds: readonly string[];
}

function chooseNearest(
  candidates: readonly PointHitCandidate[],
): PointHitCandidate | undefined {
  return [...candidates].sort(
    (left, right) =>
      Number(right.explicitTarget) - Number(left.explicitTarget) ||
      left.distance - right.distance ||
      right.visualOrder - left.visualOrder ||
      left.id.localeCompare(right.id),
  )[0];
}

export function orderedUniqueRouteIds(routeIds: readonly string[]): readonly string[] {
  const routeOrder: ReadonlyMap<string, number> = new Map<string, number>(
    ROUTE_IDS.map((id, index) => [id, index]),
  );
  return [...new Set(routeIds)].sort((left, right) => {
    const leftOrder = routeOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = routeOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.localeCompare(right);
  });
}

export function resolveNetworkPointerIntent(
  hits: NetworkPointerHits,
): NetworkPointerSelection {
  const port = chooseNearest(hits.ports);
  if (port) return { kind: "port", id: port.id };

  const chokepoint = chooseNearest(hits.chokepoints);
  if (chokepoint) return { kind: "chokepoint", id: chokepoint.id };

  const weather = chooseNearest(hits.weather);
  if (weather) return { kind: "weather", id: weather.id };

  const routeIds = orderedUniqueRouteIds(hits.routeIds);
  if (routeIds.length === 1) return { kind: "route", id: routeIds[0]! };
  if (routeIds.length > 1) return { kind: "overlap", routeIds };
  return { kind: "none" };
}

export interface NetworkSelectionState {
  readonly navigationRouteId: string;
  readonly portId: string | null;
  readonly mapRouteId: string | null;
  readonly chokepointId: string | null;
  readonly weatherId: string | null;
  readonly overlapRouteIds: readonly string[];
}

export type NetworkSelectionAction =
  | { readonly type: "SELECT_PORT"; readonly portId: string; readonly routeId: string }
  | { readonly type: "SELECT_ROUTE"; readonly routeId: string }
  | { readonly type: "SELECT_CHOKEPOINT"; readonly chokepointId: string }
  | { readonly type: "SELECT_WEATHER"; readonly weatherId: string }
  | { readonly type: "SHOW_OVERLAP"; readonly routeIds: readonly string[] }
  | { readonly type: "SELECT_OVERLAP_ROUTE"; readonly routeId: string }
  | { readonly type: "CLOSE_WEATHER" }
  | { readonly type: "CLOSE_DETAIL" }
  | { readonly type: "CHANGE_NAVIGATION_ROUTE"; readonly routeId: string };

export function reduceNetworkSelection(
  state: NetworkSelectionState,
  action: NetworkSelectionAction,
): NetworkSelectionState {
  switch (action.type) {
    case "SELECT_PORT":
      return {
        ...state,
        portId: action.portId,
        mapRouteId: action.routeId,
        chokepointId: null,
        weatherId: null,
        overlapRouteIds: [],
      };
    case "SELECT_ROUTE":
      return {
        ...state,
        portId: null,
        mapRouteId: action.routeId,
        chokepointId: null,
        weatherId: null,
        overlapRouteIds: [],
      };
    case "SELECT_CHOKEPOINT":
      return {
        ...state,
        portId: null,
        mapRouteId: null,
        chokepointId: action.chokepointId,
        weatherId: null,
        overlapRouteIds: [],
      };
    case "SELECT_WEATHER":
      return { ...state, weatherId: action.weatherId };
    case "SHOW_OVERLAP":
      return {
        ...state,
        portId: null,
        mapRouteId: null,
        chokepointId: null,
        weatherId: null,
        overlapRouteIds: orderedUniqueRouteIds(action.routeIds),
      };
    case "SELECT_OVERLAP_ROUTE":
      return {
        ...state,
        portId: null,
        mapRouteId: action.routeId,
        chokepointId: null,
        weatherId: null,
        overlapRouteIds: [],
      };
    case "CLOSE_WEATHER":
      return { ...state, weatherId: null };
    case "CLOSE_DETAIL":
      return {
        ...state,
        portId: null,
        mapRouteId: null,
        chokepointId: null,
        weatherId: null,
        overlapRouteIds: [],
      };
    case "CHANGE_NAVIGATION_ROUTE":
      return { ...state, navigationRouteId: action.routeId };
  }
}

export type VisibleNetworkPanel =
  | { readonly kind: "weather"; readonly id: string }
  | { readonly kind: "port"; readonly id: string }
  | { readonly kind: "overlap"; readonly routeIds: readonly string[] }
  | { readonly kind: "route"; readonly id: string }
  | { readonly kind: "chokepoint"; readonly id: string }
  | { readonly kind: "none" };

export function visibleNetworkPanel(state: NetworkSelectionState): VisibleNetworkPanel {
  if (state.weatherId) return { kind: "weather", id: state.weatherId };
  if (state.portId) return { kind: "port", id: state.portId };
  if (state.overlapRouteIds.length > 0) {
    return { kind: "overlap", routeIds: state.overlapRouteIds };
  }
  if (state.mapRouteId) return { kind: "route", id: state.mapRouteId };
  if (state.chokepointId) return { kind: "chokepoint", id: state.chokepointId };
  return { kind: "none" };
}
