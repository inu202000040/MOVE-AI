import type {
  GeoJsonFeatureCollection,
  NetworkGeoJsonSourceId,
  NetworkGeoJsonSources,
} from "./network-geojson";
import type { NetworkMapLayer } from "./network-map-style";

export type MapControlPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface MapLibrePromotionMap {
  getSource(id: string): unknown;
  addSource(
    id: string,
    source: {
      readonly type: "geojson";
      readonly data: GeoJsonFeatureCollection;
      readonly promoteId: "id";
    },
  ): unknown;
  getLayer(id: string): unknown;
  addLayer(layer: NetworkMapLayer): unknown;
  addControl(control: unknown, position?: MapControlPosition): unknown;
}

export type MapPromotionStage =
  | "control"
  | "source"
  | "layer"
  | "interaction"
  | "expose";

export interface MapPromotionDegradation {
  readonly stage: MapPromotionStage;
  readonly id: string;
  readonly error: unknown;
}

export interface NetworkMapPromotionOptions {
  readonly sources: NetworkGeoJsonSources;
  readonly layers: readonly NetworkMapLayer[];
  readonly createNavigationControl: () => unknown;
  readonly createScaleControl: () => unknown;
  readonly installInteractions: (map: MapLibrePromotionMap) => void;
  readonly exposeMap: (map: MapLibrePromotionMap) => void;
  readonly onDegradation: (degradation: MapPromotionDegradation) => void;
}

export interface NetworkMapPromotion {
  readonly promote: (map: MapLibrePromotionMap) => boolean;
  readonly promoted: () => boolean;
  readonly dispose: () => void;
}

function report(
  options: NetworkMapPromotionOptions,
  stage: MapPromotionStage,
  id: string,
  error: unknown,
): void {
  options.onDegradation({ stage, id, error });
}

function installControls(
  map: MapLibrePromotionMap,
  options: NetworkMapPromotionOptions,
): void {
  const controls = [
    {
      id: "navigation",
      position: "top-right" as const,
      create: options.createNavigationControl,
    },
    {
      id: "scale",
      position: "bottom-left" as const,
      create: options.createScaleControl,
    },
  ];
  for (const control of controls) {
    try {
      map.addControl(control.create(), control.position);
    } catch (error) {
      report(options, "control", control.id, error);
    }
  }
}

function installSources(
  map: MapLibrePromotionMap,
  options: NetworkMapPromotionOptions,
): ReadonlySet<NetworkGeoJsonSourceId> {
  const available = new Set<NetworkGeoJsonSourceId>();
  for (const [id, data] of Object.entries(options.sources) as readonly [
    NetworkGeoJsonSourceId,
    GeoJsonFeatureCollection,
  ][]) {
    try {
      if (!map.getSource(id)) {
        map.addSource(id, { type: "geojson", data, promoteId: "id" });
      }
      available.add(id);
    } catch (error) {
      report(options, "source", id, error);
    }
  }
  return available;
}

function installLayers(
  map: MapLibrePromotionMap,
  options: NetworkMapPromotionOptions,
  availableSources: ReadonlySet<NetworkGeoJsonSourceId>,
): void {
  for (const layer of options.layers) {
    if (!availableSources.has(layer.source)) {
      continue;
    }
    try {
      if (!map.getLayer(layer.id)) {
        map.addLayer(layer);
      }
    } catch (error) {
      report(options, "layer", layer.id, error);
    }
  }
}

export function createNetworkMapPromotion(
  options: NetworkMapPromotionOptions,
): NetworkMapPromotion {
  let disposed = false;
  let promotionStarted = false;
  let promotionComplete = false;

  return {
    promote: (map) => {
      if (disposed || promotionStarted) {
        return false;
      }
      promotionStarted = true;

      installControls(map, options);
      const availableSources = installSources(map, options);
      installLayers(map, options, availableSources);

      if (disposed) {
        return false;
      }
      try {
        options.installInteractions(map);
      } catch (error) {
        report(options, "interaction", "network", error);
      }

      if (disposed) {
        return false;
      }
      try {
        options.exposeMap(map);
      } catch (error) {
        report(options, "expose", "map", error);
      }
      promotionComplete = true;
      return true;
    },
    promoted: () => promotionComplete,
    dispose: () => {
      disposed = true;
    },
  };
}
