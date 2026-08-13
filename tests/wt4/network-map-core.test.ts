import assert from "node:assert/strict";
import test from "node:test";

import { ROUTE_IDS } from "../../app/contracts/routes";
import {
  NETWORK_CATALOG_COUNTS,
  NETWORK_CHOKEPOINT_IDS,
  type NetworkCatalogSeam,
} from "../../app/freight-risk/network/core/catalog-consumer";
import {
  createNetworkMapPromotion,
  type MapLibrePromotionMap,
} from "../../app/freight-risk/network/core/map-promotion";
import {
  catalogToNetworkGeoJson,
  createGlobeGraticule,
  type GeoJsonFeatureCollection,
} from "../../app/freight-risk/network/core/network-geojson";
import {
  createNetworkMapLayers,
  createRemoteFreeGlobeStyle,
  NETWORK_HIT_LAYER_IDS,
  NETWORK_LAYER_IDS,
  type NetworkMapPalette,
} from "../../app/freight-risk/network/core/network-map-style";
import { createRendererDiagnostics } from "../../app/freight-risk/network/core/renderer-diagnostics";

const palette: NetworkMapPalette = {
  ocean: "#010101",
  sky: "#020202",
  horizon: "#030303",
  atmosphere: "#040404",
  route: "#050505",
  routeShadow: "#060606",
  selection: "#070707",
  chokepoint: "#080808",
  port: "#090909",
  weatherNormal: "#101010",
  weatherWarning: "#111111",
  weatherSevere: "#121212",
};

function createCatalog(): NetworkCatalogSeam {
  const routeIds = [...ROUTE_IDS].sort();
  const ports = Array.from({ length: NETWORK_CATALOG_COUNTS.ports }, (_, index) => ({
    id: `port-${index.toString().padStart(2, "0")}`,
    routeId: routeIds[index % routeIds.length]!,
    longitude: -170 + index * 5,
    latitude: -60 + index * 2,
    upstreamPortWatchId: `series-${Math.min(index, 55).toString().padStart(2, "0")}`,
    primary: index < routeIds.length,
  }));
  const routes = routeIds.map((id, index) => ({
    id,
    primaryPortId: ports[index]!.id,
    waypointCoordinates: [
      [129, 35],
      [ports[index]!.longitude, ports[index]!.latitude],
    ] as const,
  }));
  const chokepoints = NETWORK_CHOKEPOINT_IDS.map((id, index) => ({
    id,
    longitude: -150 + index * 25,
    latitude: -50 + index * 10,
    upstreamPortWatchId: `choke-series-${index}`,
  }));
  const weather = [
    ...ports.map((port, index) => ({
      id: `weather-${index.toString().padStart(3, "0")}`,
      kind: "port" as const,
      entityId: port.id,
      longitude: port.longitude,
      latitude: port.latitude,
    })),
    ...chokepoints.map((chokepoint, index) => ({
      id: `weather-${(index + ports.length).toString().padStart(3, "0")}`,
      kind: "chokepoint" as const,
      entityId: chokepoint.id,
      longitude: chokepoint.longitude,
      latitude: chokepoint.latitude,
    })),
    ...Array.from({ length: 14 }, (_, index) => ({
      id: `weather-${(index + ports.length + chokepoints.length)
        .toString()
        .padStart(3, "0")}`,
      kind: "route" as const,
      entityId: routeIds[index % routeIds.length]!,
      longitude: 100 + index,
      latitude: 10 + index,
    })),
  ];
  return {
    schemaVersion: "network-catalog-seam/v1",
    capturedAt: "2026-08-13T00:00:00+09:00",
    timezone: "Asia/Seoul",
    referenceManifestSha256: "0".repeat(64),
    routes,
    ports,
    chokepoints,
    weather,
  };
}

class PromotionMap implements MapLibrePromotionMap {
  readonly sources = new Map<string, GeoJsonFeatureCollection>();
  readonly layers: string[] = [];
  readonly controls: string[] = [];
  failSource: string | null = null;
  failLayer: string | null = null;

  getSource(id: string): unknown {
    return this.sources.get(id);
  }

  addSource(
    id: string,
    source: {
      readonly type: "geojson";
      readonly data: GeoJsonFeatureCollection;
      readonly promoteId: "id";
    },
  ): unknown {
    if (id === this.failSource) throw new Error(`source ${id} failed`);
    this.sources.set(id, source.data);
    return this;
  }

  getLayer(id: string): unknown {
    return this.layers.includes(id) ? id : undefined;
  }

  addLayer(layer: { readonly id: string }): unknown {
    if (layer.id === this.failLayer) throw new Error(`layer ${layer.id} failed`);
    this.layers.push(layer.id);
    return this;
  }

  addControl(control: unknown, position?: string): unknown {
    this.controls.push(`${String(control)}:${position}`);
    return this;
  }
}

test("minimal style is remote-free and starts with globe projection", () => {
  const style = createRemoteFreeGlobeStyle(palette);
  assert.equal(style.version, 8);
  assert.deepEqual(style.projection, { type: "globe" });
  assert.deepEqual(style.sources, {});
  assert.equal(style.layers.length, 1);
  assert.equal(style.layers[0]?.type, "background");
  assert.equal(JSON.stringify(style).includes("http"), false);
});

test("catalog projects 13 routes, 44 connectors, 57 ports, 11 chokes and 82 weather", () => {
  const sources = catalogToNetworkGeoJson(createCatalog());
  assert.equal(sources["network-globe-graticule"].features.length, 1);
  assert.equal(sources["network-routes"].features.length, 13);
  assert.equal(sources["network-connectors"].features.length, 44);
  assert.equal(sources["network-ports"].features.length, 57);
  assert.equal(sources["network-chokepoints"].features.length, 11);
  assert.equal(sources["network-weather"].features.length, 82);
  assert.deepEqual(
    sources["network-connectors"].features.map(({ id }) => id),
    Array.from({ length: 44 }, (_, index) => `connector:port-${index + 13}`),
  );
});

test("remote-free globe graticule makes the spherical projection legible", () => {
  const graticule = createGlobeGraticule();
  assert.equal(graticule.features.length, 1);
  const geometry = graticule.features[0]?.geometry;
  assert.equal(geometry?.type, "MultiLineString");
  if (geometry?.type === "MultiLineString") {
    assert.equal(geometry.coordinates.length, 19);
    assert.deepEqual(geometry.coordinates[0]?.at(0), [-180, -80]);
    assert.deepEqual(geometry.coordinates.at(-1)?.at(-1), [180, 60]);
  }
});

test("network layers retain the specified depth order", () => {
  const layers = createNetworkMapLayers(palette);
  assert.deepEqual(
    layers.map(({ id }) => id),
    NETWORK_LAYER_IDS,
  );
  assert.equal(new Set(layers.map(({ id }) => id)).size, layers.length);
  const hitLayers = layers.filter(({ id }) =>
    (NETWORK_HIT_LAYER_IDS as readonly string[]).includes(id),
  );
  assert.equal(hitLayers.length, 5);
  const portHit = hitLayers.find(({ id }) => id === "network-port-hit");
  assert.equal(portHit?.type, "circle");
  if (portHit?.type === "circle") {
    assert.equal(portHit.paint?.["circle-radius"], 13);
  }
  const corridorHit = hitLayers.find(
    ({ id }) => id === "network-chokepoint-corridor-hit",
  );
  assert.equal(corridorHit?.type, "line");
  if (corridorHit?.type === "line") {
    assert.equal(corridorHit.paint?.["line-width"], 32);
  }
  const centerHit = hitLayers.find(
    ({ id }) => id === "network-chokepoint-center-hit",
  );
  assert.equal(centerHit?.type, "circle");
  if (centerHit?.type === "circle") {
    assert.equal(centerHit.paint?.["circle-radius"], 13);
  }
});

test("promotion installs controls, sources, layers, interactions and exposure once", () => {
  const map = new PromotionMap();
  const degradations: string[] = [];
  let interactions = 0;
  let exposures = 0;
  const promotion = createNetworkMapPromotion({
    sources: catalogToNetworkGeoJson(createCatalog()),
    layers: createNetworkMapLayers(palette),
    createNavigationControl: () => "navigation",
    createScaleControl: () => "scale",
    installInteractions: () => {
      interactions += 1;
    },
    exposeMap: () => {
      exposures += 1;
    },
    onDegradation: ({ stage, id }) => degradations.push(`${stage}:${id}`),
  });

  assert.equal(promotion.promote(map), true);
  assert.equal(promotion.promote(map), false);
  assert.equal(promotion.promoted(), true);
  assert.deepEqual(map.controls, ["navigation:top-right", "scale:bottom-left"]);
  assert.equal(map.sources.size, 8);
  assert.deepEqual(map.layers, NETWORK_LAYER_IDS);
  assert.equal(interactions, 1);
  assert.equal(exposures, 1);
  assert.deepEqual(degradations, []);
});

test("one source/layer failure degrades locally without cancelling globe promotion", () => {
  const map = new PromotionMap();
  map.failSource = "network-weather";
  map.failLayer = "network-route-shadow";
  const degradations: string[] = [];
  const promotion = createNetworkMapPromotion({
    sources: catalogToNetworkGeoJson(createCatalog()),
    layers: createNetworkMapLayers(palette),
    createNavigationControl: () => "navigation",
    createScaleControl: () => "scale",
    installInteractions: () => undefined,
    exposeMap: () => undefined,
    onDegradation: ({ stage, id }) => degradations.push(`${stage}:${id}`),
  });

  assert.equal(promotion.promote(map), true);
  assert.equal(promotion.promoted(), true);
  assert.deepEqual(degradations, [
    "source:network-weather",
    "layer:network-route-shadow",
  ]);
  assert.equal(map.layers.includes("network-weather-marker"), false);
  assert.equal(map.layers.includes("network-route-line"), true);
});

test("disposed promotion cannot install or expose late map work", () => {
  const map = new PromotionMap();
  let exposures = 0;
  const promotion = createNetworkMapPromotion({
    sources: catalogToNetworkGeoJson(createCatalog()),
    layers: createNetworkMapLayers(palette),
    createNavigationControl: () => "navigation",
    createScaleControl: () => "scale",
    installInteractions: () => undefined,
    exposeMap: () => {
      exposures += 1;
    },
    onDegradation: () => undefined,
  });
  promotion.dispose();
  assert.equal(promotion.promote(map), false);
  assert.equal(exposures, 0);
  assert.equal(map.sources.size, 0);
});

test("renderer diagnostics preserve ordered stage evidence without exposing errors", () => {
  let time = 100;
  const diagnostics = createRendererDiagnostics(() => time);
  time = 112;
  diagnostics.mark("constructor", "passed", "MAP_CREATED");
  time = 126;
  diagnostics.mark("ready", "passed", "GLOBE_READY");
  const snapshot = diagnostics.snapshot();
  assert.deepEqual(snapshot, [
    {
      sequence: 1,
      stage: "constructor",
      status: "passed",
      code: "MAP_CREATED",
      elapsedMs: 12,
    },
    {
      sequence: 2,
      stage: "ready",
      status: "passed",
      code: "GLOBE_READY",
      elapsedMs: 26,
    },
  ]);
});
