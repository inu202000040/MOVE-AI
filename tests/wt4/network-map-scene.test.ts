import assert from "node:assert/strict";
import test from "node:test";

import {
  createNetworkStarfieldLayer,
  installNetworkMapScene,
  NASA_BLUE_MARBLE_TILE_URL,
  NETWORK_BASEMAP_ATTRIBUTION,
  OPENFREEMAP_PLANET_URL,
} from "../../app/freight-risk/network/core/network-map-scene";
import type { Map as MapLibreMap } from "maplibre-gl";

test("progressive scene keeps licensed basemap endpoints and deterministic WebGL decoration isolated", () => {
  assert.equal(OPENFREEMAP_PLANET_URL, "https://tiles.openfreemap.org/planet");
  assert.match(NASA_BLUE_MARBLE_TILE_URL, /gibs\.earthdata\.nasa\.gov/);
  assert.match(NETWORK_BASEMAP_ATTRIBUTION, /OpenFreeMap/);
  assert.match(NETWORK_BASEMAP_ATTRIBUTION, /OpenStreetMap contributors/);
  assert.match(NETWORK_BASEMAP_ATTRIBUTION, /Natural Earth/);
  assert.match(NETWORK_BASEMAP_ATTRIBUTION, /NASA GIBS Blue Marble/);
  const stars = createNetworkStarfieldLayer();
  assert.equal(stars.id, "network-basemap-starfield");
  assert.equal(stars.type, "custom");
  assert.equal(stars.renderingMode, "3d");
});

test("progressive scene installs same-origin fallback before data and keeps remote/icon failure nonfatal", async () => {
  const layers = ["network-globe-graticule"];
  const sources = new Map<string, unknown>();
  const listeners = new Set<(event: { sourceId?: string; error?: unknown }) => void>();
  const degradations: string[] = [];
  const map = {
    getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
    addLayer: (layer: { id: string }, beforeId?: string) => {
      const before = beforeId ? layers.indexOf(beforeId) : -1;
      if (before >= 0) layers.splice(before, 0, layer.id);
      else layers.push(layer.id);
    },
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: unknown) => sources.set(id, source),
    hasImage: () => false,
    addImage: () => undefined,
    on: (_type: "error", listener: (event: { sourceId?: string }) => void) => {
      listeners.add(listener);
    },
    off: (_type: "error", listener: (event: { sourceId?: string }) => void) => {
      listeners.delete(listener);
    },
  } as unknown as MapLibreMap;

  const scene = installNetworkMapScene(map, {
    installStarfield: false,
    onDegradation: ({ code }) => degradations.push(code),
  });
  const report = await scene.ready;

  assert.equal(report.fallbackBasemapInstalled, true);
  assert.equal(report.openFreeMapInstalled, true);
  assert.equal(report.starfieldInstalled, false);
  assert.equal(report.installedImageCount, 0);
  assert.deepEqual(report.degradations, ["SCENE_ICON_UNAVAILABLE"]);
  assert.equal(
    degradations.filter((code) => code === "SCENE_ICON_UNAVAILABLE").length,
    6,
  );
  assert.equal(sources.has("network-basemap-natural-earth-land"), true);
  assert.equal(sources.has("network-basemap-natural-earth-places"), true);
  assert.equal(sources.has("network-basemap-openfreemap"), true);
  assert.equal(sources.has("network-basemap-nasa-blue-marble"), true);
  assert.ok(layers.indexOf("network-basemap-land") < layers.indexOf("network-globe-graticule"));
  assert.ok(
    layers.indexOf("network-basemap-openfreemap-place-label") <
      layers.indexOf("network-globe-graticule"),
  );

  for (const listener of listeners) {
    listener({ sourceId: "network-basemap-openfreemap", error: new Error("offline") });
  }
  assert.equal(degradations.at(-1), "OPENFREEMAP_UNAVAILABLE");
  scene.dispose();
  assert.equal(listeners.size, 0);
});
