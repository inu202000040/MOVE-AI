import { ROUTE_IDS } from "../../../app/contracts/routes";
import { sortedRecord, sortCodeUnits } from "../canonical";
import {
  assertExactCount,
  requireBoolean,
  requireInteger,
  requireNumber,
  requireString,
} from "../schema";
import type { TableRecord } from "../xlsx";

type Coordinate = readonly [number, number];

export const EXPECTED_ROUTE_WAYPOINT_COUNTS = {
  KAUI: 17,
  KCI: 6,
  KJI: 8,
  KLEI: 28,
  KLWI: 11,
  KMDI: 40,
  KMEI: 30,
  KNEI: 52,
  KSAI: 25,
  KSEI: 12,
  KUEI: 28,
  KUWI: 10,
  KWAI: 30,
} as const satisfies Readonly<Record<(typeof ROUTE_IDS)[number], number>>;

export const EXPECTED_ROUTE_WAYPOINT_TOTAL = 297;
export const EXPECTED_WAYPOINT_GEOMETRY_USE =
  "INDICATIVE_REPRESENTATIVE_SEA_CORRIDOR";

function coordinate(longitude: unknown, latitude: unknown, label: string): Coordinate {
  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(`${label} longitude is invalid`);
  }
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(`${label} latitude is invalid`);
  }
  return [longitude, latitude];
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${label} must be a non-empty JSON string`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
}

function parseCoordinate(value: unknown, label: string): Coordinate {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${label} must contain one longitude/latitude pair`);
  }
  return coordinate(value[0], value[1], label);
}

function parseCorridor(value: unknown, label: string): readonly Coordinate[] {
  const parsed = parseJson(value, label);
  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error(`${label} must contain at least two coordinates`);
  }
  return parsed.map((item, index) => parseCoordinate(item, `${label}[${index}]`));
}

function sameCoordinate(left: Coordinate, right: Coordinate): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function assertRouteCodes(value: unknown, label: string): void {
  const parsed = parseJson(value, label);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${label} must contain at least one route code`);
  }
  const routeCodes = parsed.map((item) => {
    if (typeof item !== "string" || !(ROUTE_IDS as readonly string[]).includes(item)) {
      throw new Error(`${label} contains an unknown route code`);
    }
    return item;
  });
  if (new Set(routeCodes).size !== routeCodes.length) {
    throw new Error(`${label} contains duplicate route codes`);
  }
}

export function produceNetworkCatalog(input: {
  readonly capturedAt: string;
  readonly referenceManifestSha256: string;
  readonly routes: readonly TableRecord[];
  readonly ports: readonly TableRecord[];
  readonly chokepoints: readonly TableRecord[];
  readonly weather: readonly TableRecord[];
  readonly corridorWaypoints: readonly TableRecord[];
  readonly corridorChokepoints: readonly TableRecord[];
}) {
  assertExactCount(input.routes.length, 13, "network routes");
  assertExactCount(input.ports.length, 57, "network ports");
  assertExactCount(input.chokepoints.length, 11, "network chokepoints");
  assertExactCount(input.weather.length, 82, "network weather locations");
  assertExactCount(
    input.corridorWaypoints.length,
    EXPECTED_ROUTE_WAYPOINT_TOTAL,
    "network corridor waypoints",
  );
  assertExactCount(input.corridorChokepoints.length, 11, "network corridor chokepoints");
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

  const corridorWaypointsByRoute = new Map<string, TableRecord[]>();
  for (const waypoint of input.corridorWaypoints) {
    const routeId = requireString(waypoint, "route_code");
    const routeWaypoints = corridorWaypointsByRoute.get(routeId);
    if (routeWaypoints) routeWaypoints.push(waypoint);
    else corridorWaypointsByRoute.set(routeId, [waypoint]);
  }

  const routes = input.routes
    .map((route) => {
      const id = requireString(route, "route_code");
      if (!(ROUTE_IDS as readonly string[]).includes(id)) throw new Error(`Unknown route ${id}`);
      const primaryPortId = primaryPortByRoute.get(id);
      if (!primaryPortId) throw new Error(`Missing primary port for ${id}`);
      const routeWaypoints = (corridorWaypointsByRoute.get(id) ?? [])
        .map((waypoint) => ({
          sequence: requireInteger(waypoint, "waypoint_sequence"),
          coordinate: coordinate(
            requireNumber(waypoint, "longitude"),
            requireNumber(waypoint, "latitude"),
            `${id} corridor waypoint`,
          ),
          role: requireString(waypoint, "waypoint_role"),
          geometryUse: requireString(waypoint, "geometry_use"),
          viaKo: requireString(waypoint, "via_ko"),
        }))
        .sort((left, right) => left.sequence - right.sequence);
      const expectedCount = EXPECTED_ROUTE_WAYPOINT_COUNTS[
        id as keyof typeof EXPECTED_ROUTE_WAYPOINT_COUNTS
      ];
      assertExactCount(routeWaypoints.length, expectedCount, `${id} corridor waypoints`);
      const viaKo = routeWaypoints[0]?.viaKo;
      routeWaypoints.forEach((waypoint, index) => {
        const expectedSequence = index + 1;
        if (waypoint.sequence !== expectedSequence) {
          throw new Error(
            `${id} corridor waypoint sequence ${waypoint.sequence} did not match ${expectedSequence}`,
          );
        }
        const expectedRole =
          index === 0
            ? "ORIGIN"
            : index === routeWaypoints.length - 1
              ? "DESTINATION"
              : "CORRIDOR_ANCHOR";
        if (waypoint.role !== expectedRole) {
          throw new Error(
            `${id} corridor waypoint ${waypoint.sequence} role ${waypoint.role} did not match ${expectedRole}`,
          );
        }
        if (waypoint.geometryUse !== EXPECTED_WAYPOINT_GEOMETRY_USE) {
          throw new Error(
            `${id} corridor waypoint ${waypoint.sequence} geometry_use is not approved`,
          );
        }
        if (waypoint.viaKo !== viaKo) {
          throw new Error(`${id} corridor waypoints must share one via_ko value`);
        }
      });
      const approvedOrigin = coordinate(
        requireNumber(route, "origin_longitude"),
        requireNumber(route, "origin_latitude"),
        `${id} approved route origin`,
      );
      if (!sameCoordinate(routeWaypoints[0].coordinate, approvedOrigin)) {
        throw new Error(`${id} corridor origin does not match the approved route origin`);
      }
      return {
        id,
        primaryPortId,
        waypointCoordinates: routeWaypoints.map((waypoint) => waypoint.coordinate),
      };
    })
    .sort((left, right) => sortCodeUnits(left.id, right.id));

  const routeIds = new Set(routes.map((route) => route.id));
  for (const routeId of corridorWaypointsByRoute.keys()) {
    if (!routeIds.has(routeId)) throw new Error(`Corridor waypoint references unknown route ${routeId}`);
  }

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

  const corridorChokepointById = new Map(
    input.corridorChokepoints.map((chokepoint) => {
      const id = requireString(chokepoint, "id");
      if (id === "" || id.trim() !== id) throw new Error("Invalid corridor chokepoint ID");
      return [id, chokepoint] as const;
    }),
  );
  if (corridorChokepointById.size !== input.corridorChokepoints.length) {
    throw new Error("Duplicate corridor chokepoint ID");
  }

  const chokepoints = input.chokepoints
    .map((chokepoint) => {
      const id = requireString(chokepoint, "chokepoint_id");
      const corridorChokepoint = corridorChokepointById.get(id);
      if (!corridorChokepoint) throw new Error(`Missing approved corridor for ${id}`);
      const approvedCenter = coordinate(
        requireNumber(chokepoint, "longitude"),
        requireNumber(chokepoint, "latitude"),
        `${id} approved center`,
      );
      const corridorCenter = parseCoordinate(
        parseJson(corridorChokepoint.coordinate, `${id} coordinate`),
        `${id} coordinate`,
      );
      if (!sameCoordinate(approvedCenter, corridorCenter)) {
        throw new Error(`${id} corridor center does not match workbook 01`);
      }
      const upstreamPortWatchId = requireString(chokepoint, "portwatch_id");
      if (requireString(corridorChokepoint, "portwatchId") !== upstreamPortWatchId) {
        throw new Error(`${id} corridor PortWatch identity does not match workbook 01`);
      }
      const corridor = parseCorridor(corridorChokepoint.corridor, `${id} corridor`);
      if (!corridor.some((item) => sameCoordinate(item, approvedCenter))) {
        throw new Error(`${id} approved corridor does not contain its center coordinate`);
      }
      const gateHalfWidthKm = requireNumber(corridorChokepoint, "gateHalfWidthKm");
      if (gateHalfWidthKm <= 0) throw new Error(`${id} gateHalfWidthKm must be positive`);
      assertRouteCodes(corridorChokepoint.routeCodes, `${id} routeCodes`);
      return {
        id,
        longitude: approvedCenter[0],
        latitude: approvedCenter[1],
        upstreamPortWatchId,
        corridorCoordinates: corridor,
        gateHalfWidthKm,
      };
    })
    .sort((left, right) => sortCodeUnits(left.id, right.id));

  if (chokepoints.length !== corridorChokepointById.size) {
    throw new Error("Workbook 16 contains an unknown corridor chokepoint");
  }

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
    routeWaypointCount: input.catalog.routes.reduce(
      (total, route) => total + route.waypointCoordinates.length,
      0,
    ),
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
