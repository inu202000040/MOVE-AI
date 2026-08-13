import { ROUTE_IDS } from "../../../app/contracts/routes";
import { sortedRecord, sortCodeUnits } from "../canonical";
import {
  assertExactCount,
  requireBoolean,
  requireNumber,
  requireString,
} from "../schema";
import type { TableRecord } from "../xlsx";

export function produceNetworkCatalog(input: {
  readonly capturedAt: string;
  readonly referenceManifestSha256: string;
  readonly routes: readonly TableRecord[];
  readonly ports: readonly TableRecord[];
  readonly chokepoints: readonly TableRecord[];
  readonly weather: readonly TableRecord[];
}) {
  assertExactCount(input.routes.length, 13, "network routes");
  assertExactCount(input.ports.length, 57, "network ports");
  assertExactCount(input.chokepoints.length, 11, "network chokepoints");
  assertExactCount(input.weather.length, 82, "network weather locations");
  if (!/^[\da-f]{64}$/u.test(input.referenceManifestSha256)) {
    throw new Error("Invalid reference manifest SHA-256");
  }

  const primaryPortByRoute = new Map<string, string>();
  for (const port of input.ports) {
    if (!requireBoolean(port, "primary")) continue;
    const routeId = requireString(port, "route_code");
    if (primaryPortByRoute.has(routeId)) throw new Error(`Duplicate primary port for ${routeId}`);
    primaryPortByRoute.set(routeId, requireString(port, "marker_id"));
  }

  const routes = input.routes
    .map((route) => {
      const id = requireString(route, "route_code");
      if (!(ROUTE_IDS as readonly string[]).includes(id)) throw new Error(`Unknown route ${id}`);
      const primaryPortId = primaryPortByRoute.get(id);
      if (!primaryPortId) throw new Error(`Missing primary port for ${id}`);
      return {
        id,
        primaryPortId,
        waypointCoordinates: [
          [requireNumber(route, "origin_longitude"), requireNumber(route, "origin_latitude")],
          [
            requireNumber(route, "representative_longitude"),
            requireNumber(route, "representative_latitude"),
          ],
        ],
      };
    })
    .sort((left, right) => sortCodeUnits(left.id, right.id));

  const ports = input.ports
    .map((port) => ({
      id: requireString(port, "marker_id"),
      routeId: requireString(port, "route_code"),
      longitude: requireNumber(port, "longitude"),
      latitude: requireNumber(port, "latitude"),
      upstreamPortWatchId: requireString(port, "portwatch_id"),
      primary: requireBoolean(port, "primary"),
    }))
    .sort((left, right) => sortCodeUnits(left.id, right.id));

  const chokepoints = input.chokepoints
    .map((chokepoint) => ({
      id: requireString(chokepoint, "chokepoint_id"),
      longitude: requireNumber(chokepoint, "longitude"),
      latitude: requireNumber(chokepoint, "latitude"),
      upstreamPortWatchId: requireString(chokepoint, "portwatch_id"),
    }))
    .sort((left, right) => sortCodeUnits(left.id, right.id));

  const weather = input.weather
    .map((location) => {
      const kind = requireString(location, "kind");
      if (!(["port", "chokepoint", "route"] as const).includes(kind as never)) {
        throw new Error(`Unknown weather location kind ${kind}`);
      }
      return {
        id: requireString(location, "location_key"),
        kind,
        entityId: requireString(location, "entity_id"),
        longitude: requireNumber(location, "longitude"),
        latitude: requireNumber(location, "latitude"),
      };
    })
    .sort((left, right) => sortCodeUnits(left.id, right.id));

  if (new Set(ports.map((port) => port.upstreamPortWatchId)).size !== 56) {
    throw new Error("Network catalog unique port series count mismatch");
  }

  return {
    schemaVersion: "network-catalog-seam/v1",
    capturedAt: input.capturedAt,
    timezone: "Asia/Seoul",
    referenceManifestSha256: input.referenceManifestSha256,
    routes,
    ports,
    chokepoints,
    weather,
  };
}

export function produceNetworkCatalogIdentity(input: {
  readonly catalogSeamSha256: string;
  readonly byteSize: number;
  readonly referenceManifestSha256: string;
  readonly catalog: ReturnType<typeof produceNetworkCatalog>;
}) {
  return {
    schemaVersion: "network-catalog-seam-identity/v1",
    catalogSeamSha256: input.catalogSeamSha256,
    byteSize: input.byteSize,
    routeCount: input.catalog.routes.length,
    portCount: input.catalog.ports.length,
    uniquePortSeriesCount: new Set(
      input.catalog.ports.map((port) => port.upstreamPortWatchId),
    ).size,
    chokepointCount: input.catalog.chokepoints.length,
    weatherCount: input.catalog.weather.length,
    referenceManifestSha256: input.referenceManifestSha256,
  };
}

export function indexCatalogIdentity(
  catalog: ReturnType<typeof produceNetworkCatalog>,
): Readonly<Record<string, string>> {
  return sortedRecord([
    ...catalog.routes.map((record) => [`route:${record.id}`, record.id] as const),
    ...catalog.ports.map((record) => [`port:${record.id}`, record.upstreamPortWatchId] as const),
    ...catalog.chokepoints.map(
      (record) => [`chokepoint:${record.id}`, record.upstreamPortWatchId] as const,
    ),
    ...catalog.weather.map((record) => [`weather:${record.id}`, record.entityId] as const),
  ]);
}
