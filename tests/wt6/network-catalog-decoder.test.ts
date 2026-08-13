import assert from "node:assert/strict";
import test from "node:test";
import catalogArtifact from "../../app/data/generated/network-catalog-seam-v1.json";
import identityArtifact from "../../app/data/generated/network-catalog-seam-identity-v1.json";
import {
  assertNetworkCatalogSeamIdentityV1,
  assertNetworkCatalogSeamV1,
} from "../../app/data/artifacts/decoders";

function catalog() {
  return structuredClone(catalogArtifact);
}

function sortById<T extends { readonly id: string }>(items: T[]): void {
  items.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

test("network catalog accepts only ordered canonical artifact keys and the approved manifest identity", () => {
  assert.doesNotThrow(() => assertNetworkCatalogSeamV1(catalogArtifact));
  assert.doesNotThrow(() => assertNetworkCatalogSeamIdentityV1(identityArtifact));
  const reorderedRoot = {
    weather: catalogArtifact.weather,
    chokepoints: catalogArtifact.chokepoints,
    ports: catalogArtifact.ports,
    routes: catalogArtifact.routes,
    referenceManifestSha256: catalogArtifact.referenceManifestSha256,
    timezone: catalogArtifact.timezone,
    capturedAt: catalogArtifact.capturedAt,
    schemaVersion: catalogArtifact.schemaVersion,
  };
  assert.throws(() => assertNetworkCatalogSeamV1(reorderedRoot), /ordered keys/u);
  assert.throws(
    () => assertNetworkCatalogSeamIdentityV1({ ...identityArtifact, referenceManifestSha256: "0".repeat(64) }),
    /referenceManifestSha256/u,
  );
  assert.throws(
    () => assertNetworkCatalogSeamIdentityV1({ ...identityArtifact, byteSize: 0 }),
    /positive/u,
  );
  assert.throws(
    () => assertNetworkCatalogSeamIdentityV1({ ...identityArtifact, routeWaypointCount: 296 }),
    /routeWaypointCount/u,
  );
});

test("network route and primary-port identities are closed over the canonical route set", () => {
  const unknownRoute = catalog();
  unknownRoute.routes.at(-1)!.id = "ZZZZ";
  assert.throws(() => assertNetworkCatalogSeamV1(unknownRoute), /unknown value|canonical route/u);

  const wrongPrimary = catalog();
  const kaui = wrongPrimary.routes.find((route) => route.id === "KAUI")!;
  kaui.primaryPortId = "KAUI-BNE";
  assert.throws(() => assertNetworkCatalogSeamV1(wrongPrimary), /primary port relationship/u);

  const secondPrimary = catalog();
  secondPrimary.ports.find((port) => port.id === "KAUI-BNE")!.primary = true;
  assert.throws(() => assertNetworkCatalogSeamV1(secondPrimary), /primary port relationship/u);

  const wrongPortRoute = catalog();
  wrongPortRoute.ports.find((port) => port.id === "KAUI-ADL")!.routeId = "KCI";
  assert.throws(() => assertNetworkCatalogSeamV1(wrongPortRoute), /route identity/u);
});

test("network coordinates and upstream identities are bounded and unique where required", () => {
  const badLongitude = catalog();
  badLongitude.ports[0].longitude = 180.0001;
  assert.throws(() => assertNetworkCatalogSeamV1(badLongitude), /longitude/u);

  const badLatitude = catalog();
  badLatitude.chokepoints[0].latitude = -90.0001;
  assert.throws(() => assertNetworkCatalogSeamV1(badLatitude), /latitude/u);

  const badWaypoint = catalog();
  badWaypoint.routes[0].waypointCoordinates[1][0] = -181;
  assert.throws(() => assertNetworkCatalogSeamV1(badWaypoint), /longitude/u);

  const missingWaypoint = catalog();
  missingWaypoint.routes[0].waypointCoordinates.pop();
  assert.throws(() => assertNetworkCatalogSeamV1(missingWaypoint), /waypointCoordinates length/u);

  const badCorridorLongitude = catalog();
  badCorridorLongitude.chokepoints[0].corridorCoordinates[0][0] = 180.0001;
  assert.throws(() => assertNetworkCatalogSeamV1(badCorridorLongitude), /corridorCoordinates.*longitude/u);

  const emptyCorridor = catalog();
  emptyCorridor.chokepoints[0].corridorCoordinates.length = 0;
  assert.throws(() => assertNetworkCatalogSeamV1(emptyCorridor), /at least two coordinates/u);

  const zeroGateWidth = catalog();
  zeroGateWidth.chokepoints[0].gateHalfWidthKm = 0;
  assert.throws(() => assertNetworkCatalogSeamV1(zeroGateWidth), /gateHalfWidthKm must be positive/u);

  const wrongChokepointKeys = catalog();
  const chokepoint = wrongChokepointKeys.chokepoints[0];
  wrongChokepointKeys.chokepoints[0] = {
    id: chokepoint.id,
    longitude: chokepoint.longitude,
    latitude: chokepoint.latitude,
    upstreamPortWatchId: chokepoint.upstreamPortWatchId,
    gateHalfWidthKm: chokepoint.gateHalfWidthKm,
    corridorCoordinates: chokepoint.corridorCoordinates,
  };
  assert.throws(() => assertNetworkCatalogSeamV1(wrongChokepointKeys), /ordered keys/u);

  const duplicateChokeUpstream = catalog();
  duplicateChokeUpstream.chokepoints[1].upstreamPortWatchId = duplicateChokeUpstream.chokepoints[0].upstreamPortWatchId;
  assert.throws(() => assertNetworkCatalogSeamV1(duplicateChokeUpstream), /upstream IDs/u);

  const wrongOrigin = catalog();
  wrongOrigin.routes[0].waypointCoordinates[0][0] += 0.01;
  assert.throws(() => assertNetworkCatalogSeamV1(wrongOrigin), /BUSAN/u);
});

test("weather IDs, entity foreign keys, coverage, and referenced coordinates are coupled", () => {
  const wrongId = catalog();
  wrongId.weather[0].id = "chokepoint:not-the-entity";
  sortById(wrongId.weather);
  assert.throws(() => assertNetworkCatalogSeamV1(wrongId), /kind:entityId/u);

  const unknownPort = catalog();
  const portWeather = unknownPort.weather.find((location) => location.id === "port:KAUI-ADL")!;
  portWeather.id = "port:UNKNOWN";
  portWeather.entityId = "UNKNOWN";
  sortById(unknownPort.weather);
  assert.throws(() => assertNetworkCatalogSeamV1(unknownPort), /port entity/u);

  const unknownChokepoint = catalog();
  const chokeWeather = unknownChokepoint.weather.find((location) => location.kind === "chokepoint")!;
  chokeWeather.id = "chokepoint:unknown";
  chokeWeather.entityId = "unknown";
  sortById(unknownChokepoint.weather);
  assert.throws(() => assertNetworkCatalogSeamV1(unknownChokepoint), /chokepoint entity/u);

  const unknownCorridor = catalog();
  const routeWeather = unknownCorridor.weather.find((location) => location.kind === "route")!;
  routeWeather.id = "route:ZZZZ";
  routeWeather.entityId = "ZZZZ";
  sortById(unknownCorridor.weather);
  assert.throws(() => assertNetworkCatalogSeamV1(unknownCorridor), /route corridor/u);

  const wrongReferencedCoordinate = catalog();
  wrongReferencedCoordinate.weather.find((location) => location.id === "port:KAUI-ADL")!.longitude += 0.01;
  assert.throws(() => assertNetworkCatalogSeamV1(wrongReferencedCoordinate), /port entity/u);
});
