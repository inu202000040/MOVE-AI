import assert from "node:assert/strict";
import test from "node:test";

import catalogArtifact from "../../app/data/generated/network-catalog-seam-v1.json";
import {
  createNetworkCameraFit,
  networkCameraBounds,
  resolveNetworkCameraDuration,
  resolveNetworkCameraPadding,
} from "../../app/freight-risk/network/core/camera-fit";
import {
  NETWORK_CATALOG_COUNTS,
  NETWORK_CHOKEPOINT_IDS,
  type NetworkCatalogSeam,
} from "../../app/freight-risk/network/core/catalog-consumer";
import {
  createNetworkChokepointGeometry,
  NETWORK_CHOKEPOINT_GEOMETRY_PROFILES,
} from "../../app/freight-risk/network/core/chokepoint-geometry";
import {
  catalogToNetworkGeoJson,
  type NetworkWeatherVisualState,
} from "../../app/freight-risk/network/core/network-geojson";

const catalog = catalogArtifact as unknown as NetworkCatalogSeam;

test("all 11 chokepoints have deterministic corridor and two-gate geometry", () => {
  assert.deepEqual(
    Object.keys(NETWORK_CHOKEPOINT_GEOMETRY_PROFILES),
    [...NETWORK_CHOKEPOINT_IDS],
  );

  for (const chokepoint of catalog.chokepoints) {
    const first = createNetworkChokepointGeometry(chokepoint);
    const second = createNetworkChokepointGeometry(chokepoint);
    assert.deepEqual(first, second);
    assert.deepEqual(first.center, [chokepoint.longitude, chokepoint.latitude]);
    assert.deepEqual(first.corridorCoordinates[1], first.center);
    assert.deepEqual(
      first.gates.map(({ side }) => side),
      ["entry", "exit"],
    );
    assert.equal(first.fitCoordinates.length, 5);
    assert.ok(first.profile.corridorLengthKm > 0);
    assert.ok(first.profile.corridorWidthKm > 0);
    for (const [longitude, latitude] of first.fitCoordinates) {
      assert.ok(Number.isFinite(longitude));
      assert.ok(longitude >= -180 && longitude <= 180);
      assert.ok(Number.isFinite(latitude));
      assert.ok(latitude >= -90 && latitude <= 90);
    }
  }
});

test("network GeoJSON includes 11 shared-identity corridors and two-line gate features", () => {
  const sources = catalogToNetworkGeoJson(catalog);
  const corridors = sources["network-chokepoint-corridors"].features;
  const gates = sources["network-chokepoint-gates"].features;

  assert.equal(corridors.length, NETWORK_CATALOG_COUNTS.chokepoints);
  assert.equal(gates.length, NETWORK_CATALOG_COUNTS.chokepoints);
  assert.deepEqual(
    corridors.map(({ id }) => id),
    NETWORK_CHOKEPOINT_IDS,
  );
  for (const id of NETWORK_CHOKEPOINT_IDS) {
    const corridor = corridors.find(({ properties }) => properties.chokepointId === id);
    const gate = gates.find(({ properties }) => properties.chokepointId === id);
    assert.equal(corridor?.geometry.type, "MultiLineString");
    assert.equal(corridor?.id, id);
    assert.equal(gate?.id, id);
    assert.equal(gate?.properties.gateCount, 2);
    assert.equal(gate?.geometry.type, "MultiLineString");
    if (gate?.geometry.type === "MultiLineString") {
      assert.equal(gate.geometry.coordinates.length, 2);
    }
  }
});

test("weather GeoJSON adopts supplied condition and risk without shrinking registry", () => {
  const severe: NetworkWeatherVisualState = {
    risk: "severe",
    condition: "폭풍우",
    riskLabel: "위험",
    riskReason: "강풍",
    observedAt: "2026-08-13T06:00:00Z",
  };
  const warning: NetworkWeatherVisualState = {
    risk: "warning",
    condition: "높은 파도",
  };
  const sources = catalogToNetworkGeoJson(catalog, {
    weatherById: new Map([
      ["port:BUSAN", severe],
      ["chokepoint:suez-canal", warning],
    ]),
  });
  const features = sources["network-weather"].features;
  assert.equal(features.length, NETWORK_CATALOG_COUNTS.weather);
  assert.deepEqual(
    features.find(({ id }) => id === "port:BUSAN")?.properties,
    {
      id: "port:BUSAN",
      weatherId: "port:BUSAN",
      kind: "port",
      entityId: "BUSAN",
      risk: "severe",
      condition: "폭풍우",
      riskLabel: "위험",
      riskReason: "강풍",
      observedAt: "2026-08-13T06:00:00Z",
    },
  );
  assert.equal(
    features.find(({ id }) => id === "chokepoint:suez-canal")?.properties.risk,
    "warning",
  );
  assert.equal(
    features.find(({ id }) => id === "port:KNEI-RTM")?.properties.risk,
    "unavailable",
  );
});

test("camera bounds use the shortest antimeridian interval", () => {
  assert.deepEqual(
    networkCameraBounds([
      [170, -5],
      [-170, 10],
      [175, 20],
    ]),
    [
      [170, -5],
      [190, 20],
    ],
  );
  assert.deepEqual(networkCameraBounds([[4, 52], [129, 35]]), [
    [4, 35],
    [129, 52],
  ]);
  assert.throws(() => networkCameraBounds([]), /at least one coordinate/u);
});

test("camera safe padding and duration honor desktop, mobile, and reduced motion", () => {
  assert.deepEqual(
    resolveNetworkCameraPadding({
      viewportWidth: 1_440,
      viewportHeight: 900,
      mobile: false,
      panelOpen: true,
    }),
    { top: 24, right: 560, bottom: 24, left: 24 },
  );
  assert.deepEqual(
    resolveNetworkCameraPadding({
      viewportWidth: 375,
      viewportHeight: 812,
      mobile: true,
      panelOpen: true,
    }),
    { top: 12, right: 12, bottom: 360, left: 12 },
  );
  assert.deepEqual(
    resolveNetworkCameraPadding({
      viewportWidth: 375,
      viewportHeight: 812,
      mobile: true,
      panelOpen: false,
    }),
    { top: 12, right: 12, bottom: 12, left: 12 },
  );
  assert.equal(resolveNetworkCameraDuration(725.4, false), 725);
  assert.equal(resolveNetworkCameraDuration(725.4, true), 0);

  const fit = createNetworkCameraFit({
    coordinates: [[170, 0], [-170, 5]],
    viewportWidth: 1_000,
    viewportHeight: 700,
    mobile: false,
    panelOpen: true,
    reducedMotion: true,
    preferredDurationMs: 800,
  });
  assert.deepEqual(fit.bounds, [[170, 0], [190, 5]]);
  assert.deepEqual(fit.padding, { top: 24, right: 430, bottom: 24, left: 24 });
  assert.equal(fit.duration, 0);
});
