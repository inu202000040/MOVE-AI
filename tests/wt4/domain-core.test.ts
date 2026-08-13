import assert from "node:assert/strict";
import test from "node:test";

import {
  coordinateFacesGlobeCenter,
  declutterProjectedMarkers,
  selectVisibleWeather,
  WEATHER_DECLUTTER_ZOOM,
  type WeatherDeclutterCandidate,
} from "../../app/freight-risk/network/core/declutter";
import {
  moveNetworkFocusMode,
  resolveNetworkFeatureEmphasis,
} from "../../app/freight-risk/network/core/focus-mode";
import {
  normalizeLongitude,
  projectWebMercator,
  splitAntimeridian,
} from "../../app/freight-risk/network/core/geometry";
import {
  createNetworkFeatureStateController,
  selectedNetworkMapFeatures,
  type NetworkMapFeatureIdentifier,
} from "../../app/freight-risk/network/core/map-feature-state";
import {
  reduceNetworkSelection,
  resolveNetworkPointerIntent,
  visibleNetworkPanel,
  type NetworkSelectionState,
} from "../../app/freight-risk/network/core/selection";
import {
  DEFAULT_STATIC_VIEWPORT,
  panStaticViewport,
  resetStaticViewport,
  staticViewportToViewBox,
  zoomStaticViewport,
} from "../../app/freight-risk/network/core/static-viewport";

test("antimeridian routes split at matching world edges", () => {
  const segments = splitAntimeridian([
    [170, 10],
    [-170, 20],
  ]);
  assert.deepEqual(segments, [
    [
      [170, 10],
      [180, 15],
    ],
    [
      [-180, 15],
      [-170, 20],
    ],
  ]);
  assert.equal(normalizeLongitude(540), 180);
});

test("Web Mercator projection clamps poles and keeps the equator centered", () => {
  assert.deepEqual(projectWebMercator([0, 0], 1000, 500), { x: 500, y: 250 });
  const north = projectWebMercator([0, 90], 1000, 500);
  assert.ok(north.y >= -0.0001 && north.y <= 0.0001);
});

const weatherCandidate = (
  overrides: Partial<WeatherDeclutterCandidate>,
): WeatherDeclutterCandidate => ({
  id: "normal-secondary",
  x: 10,
  y: 10,
  risk: "normal",
  role: "secondary",
  selected: false,
  hovered: false,
  ...overrides,
});

test("declutter threshold is stable at 2.14/2.15 and preserves risk priority", () => {
  const candidates = [
    weatherCandidate({ id: "normal" }),
    weatherCandidate({ id: "warning", risk: "warning", x: 11 }),
    weatherCandidate({ id: "selected", selected: true, x: 12 }),
  ];
  assert.deepEqual(
    selectVisibleWeather(candidates, 2.14, 20).map(({ id }) => id),
    ["selected", "warning"],
  );
  assert.deepEqual(
    selectVisibleWeather(candidates, WEATHER_DECLUTTER_ZOOM, 20).map(({ id }) => id),
    ["selected", "warning"],
  );
  assert.deepEqual(
    selectVisibleWeather([
      weatherCandidate({ id: "normal" }),
      weatherCandidate({ id: "route-weather", pinned: true, role: "primary", x: 11 }),
    ], 2.14, 20).map(({ id }) => id),
    ["route-weather"],
  );
});

test("weather declutter never resurrects backface or offscreen markers", () => {
  assert.equal(coordinateFacesGlobeCenter([127, 35], [126, 27]), true);
  assert.equal(coordinateFacesGlobeCenter([-54, -27], [126, 27]), false);
  assert.deepEqual(
    selectVisibleWeather([
      weatherCandidate({ id: "front", globeFacing: true, inViewport: true }),
      weatherCandidate({ id: "back-selected", selected: true, globeFacing: false, inViewport: true }),
      weatherCandidate({ id: "offscreen", selected: true, globeFacing: true, inViewport: false }),
    ], 4, 20).map(({ id }) => id),
    ["front"],
  );
});

test("overlapping port hit targets receive deterministic one-to-one positions", () => {
  const first = declutterProjectedMarkers([
    { id: "port:LONG_BEACH", x: 200, y: 100 },
    { id: "port:LOS_ANGELES", x: 202, y: 101 },
    { id: "port:ANTWERP", x: 600, y: 180 },
    { id: "port:ROTTERDAM", x: 603, y: 181 },
  ]);
  const second = declutterProjectedMarkers([
    { id: "port:ROTTERDAM", x: 603, y: 181 },
    { id: "port:ANTWERP", x: 600, y: 180 },
    { id: "port:LOS_ANGELES", x: 202, y: 101 },
    { id: "port:LONG_BEACH", x: 200, y: 100 },
  ]);
  const positions = (items: typeof first) =>
    items
      .map(({ id, x, y }) => ({ id, x, y }))
      .sort((left, right) => left.id.localeCompare(right.id));
  assert.deepEqual(
    positions(first),
    positions(second),
  );
  assert.equal(new Set(first.map(({ x, y }) => `${x}:${y}`)).size, 4);
  for (const marker of first) {
    assert.ok(
      first.every(
        (candidate) =>
          candidate.id === marker.id ||
          Math.hypot(candidate.x - marker.x, candidate.y - marker.y) >= 30,
      ),
    );
  }
  assert.deepEqual(
    first.map(({ id, anchorX, anchorY }) => ({ id, anchorX, anchorY })),
    [
      { id: "port:ANTWERP", anchorX: 600, anchorY: 180 },
      { id: "port:LONG_BEACH", anchorX: 200, anchorY: 100 },
      { id: "port:LOS_ANGELES", anchorX: 202, anchorY: 101 },
      { id: "port:ROTTERDAM", anchorX: 603, anchorY: 181 },
    ],
  );
});

test("pointer dispatch is categorical and nearby ports resolve deterministically", () => {
  const baseHits = {
    weather: [],
    chokepoints: [],
    routeIds: ["KNEI"],
  } as const;
  assert.deepEqual(
    resolveNetworkPointerIntent({
      ...baseHits,
      ports: [
        { id: "long-beach", distance: 4, explicitTarget: false, visualOrder: 2 },
        { id: "los-angeles", distance: 0, explicitTarget: true, visualOrder: 1 },
      ],
    }),
    { kind: "port", id: "los-angeles" },
  );
  assert.deepEqual(
    resolveNetworkPointerIntent({
      ...baseHits,
      ports: [
        { id: "los-angeles", distance: 4, explicitTarget: false, visualOrder: 1 },
        { id: "long-beach", distance: 0, explicitTarget: true, visualOrder: 2 },
      ],
    }),
    { kind: "port", id: "long-beach" },
  );

  assert.deepEqual(
    resolveNetworkPointerIntent({
      weather: [
        { id: "weather-los-angeles", distance: 0, explicitTarget: true, visualOrder: 4 },
      ],
      ports: [
        { id: "los-angeles", distance: 0, explicitTarget: true, visualOrder: 3 },
      ],
      chokepoints: [],
      routeIds: ["KUWI"],
    }),
    { kind: "port", id: "los-angeles" },
  );
});

test("route hits deduplicate into global order and open overlap", () => {
  const result = resolveNetworkPointerIntent({
    weather: [],
    ports: [],
    chokepoints: [],
    routeIds: ["KNEI", "KUWI", "KNEI"],
  });
  assert.deepEqual(result, { kind: "overlap", routeIds: ["KUWI", "KNEI"] });
});

test("weather panel temporarily overrides and restores the base selection", () => {
  const initial: NetworkSelectionState = {
    navigationRouteId: "KNEI",
    portId: null,
    mapRouteId: null,
    chokepointId: null,
    weatherId: null,
    overlapRouteIds: [],
  };
  const port = reduceNetworkSelection(initial, {
    type: "SELECT_PORT",
    portId: "rotterdam",
    routeId: "KNEI",
  });
  const weather = reduceNetworkSelection(port, {
    type: "SELECT_WEATHER",
    weatherId: "weather-rotterdam",
  });
  assert.deepEqual(visibleNetworkPanel(weather), {
    kind: "weather",
    id: "weather-rotterdam",
  });
  const restored = reduceNetworkSelection(weather, { type: "CLOSE_WEATHER" });
  assert.deepEqual(visibleNetworkPanel(restored), {
    kind: "port",
    id: "rotterdam",
  });
  assert.equal(restored.navigationRouteId, "KNEI");
});

test("detail close clears the visible entity without changing navigation route", () => {
  const selected: NetworkSelectionState = {
    navigationRouteId: "KNEI",
    portId: "KNEI-RTM",
    mapRouteId: "KNEI",
    chokepointId: null,
    weatherId: null,
    overlapRouteIds: [],
  };
  const closed = reduceNetworkSelection(selected, { type: "CLOSE_DETAIL" });
  assert.deepEqual(visibleNetworkPanel(closed), { kind: "none" });
  assert.equal(closed.navigationRouteId, "KNEI");
});

test("static fallback supports pan, zoom, and exact reset", () => {
  assert.equal(staticViewportToViewBox(DEFAULT_STATIC_VIEWPORT), "0 18 1000 464");
  const changed = zoomStaticViewport(
    panStaticViewport(DEFAULT_STATIC_VIEWPORT, 20, -10),
    2,
    500,
    250,
  );
  assert.notEqual(staticViewportToViewBox(changed), "0 18 1000 464");
  assert.equal(staticViewportToViewBox(resetStaticViewport()), "0 18 1000 464");
});

test("focus modes preserve selected override and keyboard roving order", () => {
  assert.equal(
    resolveNetworkFeatureEmphasis({
      mode: "routes",
      category: "chokepoint",
      selected: false,
    }),
    "secondary",
  );
  assert.equal(
    resolveNetworkFeatureEmphasis({
      mode: "chokepoints",
      category: "route",
      selected: false,
      relatedToSelectedChokepoint: true,
    }),
    "primary",
  );
  assert.equal(
    resolveNetworkFeatureEmphasis({
      mode: "chokepoints",
      category: "port",
      selected: true,
    }),
    "selected",
  );
  assert.equal(moveNetworkFocusMode("routes", "previous"), "combined");
  assert.equal(moveNetworkFocusMode("combined", "next"), "routes");
  assert.equal(moveNetworkFocusMode("routes", "last"), "combined");
});

test("feature-state keeps weather and its base selection, then applies only deltas", () => {
  const operations: string[] = [];
  const controller = createNetworkFeatureStateController(
    {
      setFeatureState: (feature) => operations.push(`set:${feature.source}:${feature.id}`),
      removeFeatureState: (feature) =>
        operations.push(`clear:${feature.source}:${feature.id}`),
    },
    () => assert.fail("feature-state operation must not fail"),
  );
  const portWithWeather: NetworkSelectionState = {
    navigationRouteId: "KNEI",
    portId: "rotterdam",
    mapRouteId: "KNEI",
    chokepointId: null,
    weatherId: "weather-rotterdam",
    overlapRouteIds: [],
  };
  assert.deepEqual(selectedNetworkMapFeatures(portWithWeather), [
    { source: "network-routes", id: "KNEI" },
    { source: "network-ports", id: "rotterdam" },
    { source: "network-weather", id: "weather-rotterdam" },
  ]);
  controller.apply(portWithWeather);
  controller.apply(portWithWeather);
  assert.deepEqual(operations, [
    "set:network-routes:KNEI",
    "set:network-ports:rotterdam",
    "set:network-weather:weather-rotterdam",
  ]);

  controller.apply({ ...portWithWeather, weatherId: null });
  assert.deepEqual(operations.at(-1), "clear:network-weather:weather-rotterdam");
  controller.dispose();
  assert.deepEqual(operations.slice(-2), [
    "clear:network-routes:KNEI",
    "clear:network-ports:rotterdam",
  ]);
});

test("feature-state failures remain local and identify the exact feature", () => {
  const failures: { operation: string; feature: NetworkMapFeatureIdentifier }[] = [];
  const controller = createNetworkFeatureStateController(
    {
      setFeatureState: () => {
        throw new Error("source is reloading");
      },
      removeFeatureState: () => undefined,
    },
    ({ operation, feature }) => failures.push({ operation, feature }),
  );
  controller.apply({
    navigationRouteId: "KNEI",
    portId: null,
    mapRouteId: "KNEI",
    chokepointId: null,
    weatherId: null,
    overlapRouteIds: [],
  });
  assert.deepEqual(failures, [
    {
      operation: "select",
      feature: { source: "network-routes", id: "KNEI" },
    },
  ]);
});
