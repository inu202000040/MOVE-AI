import type { NetworkGeoJsonSourceId } from "./network-geojson";
import type { NetworkSelectionState } from "./selection";

export interface NetworkMapFeatureIdentifier {
  readonly source: NetworkGeoJsonSourceId;
  readonly id: string;
}

export interface NetworkFeatureStateMap {
  setFeatureState(
    feature: NetworkMapFeatureIdentifier,
    state: { readonly selected: true },
  ): void;
  removeFeatureState(
    feature: NetworkMapFeatureIdentifier,
    key: "selected",
  ): void;
}

export interface NetworkFeatureStateFailure {
  readonly operation: "select" | "clear";
  readonly feature: NetworkMapFeatureIdentifier;
  readonly error: unknown;
}

export interface NetworkFeatureStateController {
  readonly apply: (selection: NetworkSelectionState) => void;
  readonly dispose: () => void;
}

function featureKey(feature: NetworkMapFeatureIdentifier): string {
  return `${feature.source}\u0000${feature.id}`;
}

export function selectedNetworkMapFeatures(
  selection: NetworkSelectionState,
): readonly NetworkMapFeatureIdentifier[] {
  const features: NetworkMapFeatureIdentifier[] = [];
  if (selection.mapRouteId) {
    features.push({ source: "network-routes", id: selection.mapRouteId });
  }
  if (selection.portId) {
    features.push({ source: "network-ports", id: selection.portId });
  }
  if (selection.chokepointId) {
    features.push({ source: "network-chokepoints", id: selection.chokepointId });
  }
  if (selection.weatherId) {
    features.push({ source: "network-weather", id: selection.weatherId });
  }
  return features;
}

export function createNetworkFeatureStateController(
  map: NetworkFeatureStateMap,
  onFailure: (failure: NetworkFeatureStateFailure) => void,
): NetworkFeatureStateController {
  let disposed = false;
  const active = new Map<string, NetworkMapFeatureIdentifier>();

  const clearFeature = (feature: NetworkMapFeatureIdentifier): void => {
    try {
      map.removeFeatureState(feature, "selected");
    } catch (error) {
      onFailure({ operation: "clear", feature, error });
    }
  };

  return {
    apply: (selection) => {
      if (disposed) return;
      const next = new Map(
        selectedNetworkMapFeatures(selection).map((feature) => [
          featureKey(feature),
          feature,
        ]),
      );

      for (const [key, feature] of active) {
        if (!next.has(key)) clearFeature(feature);
      }
      for (const [key, feature] of next) {
        if (active.has(key)) continue;
        try {
          map.setFeatureState(feature, { selected: true });
        } catch (error) {
          onFailure({ operation: "select", feature, error });
        }
      }
      active.clear();
      for (const [key, feature] of next) active.set(key, feature);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const feature of active.values()) clearFeature(feature);
      active.clear();
    },
  };
}
