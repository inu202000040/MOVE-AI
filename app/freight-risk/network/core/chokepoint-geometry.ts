import {
  NETWORK_CHOKEPOINT_IDS,
  type Coordinate,
  type NetworkChokepointRecord,
} from "./catalog-consumer";
import { normalizeLongitude } from "./geometry";

export type NetworkChokepointId = (typeof NETWORK_CHOKEPOINT_IDS)[number];
export type NetworkChokepointKind = "strait" | "canal" | "cape";
export type NetworkChokepointGateSide = "entry" | "intermediate" | "exit";

export interface NetworkChokepointGateGeometry {
  readonly side: NetworkChokepointGateSide;
  readonly center: Coordinate;
  readonly coordinates: readonly [Coordinate, Coordinate];
}

export interface NetworkChokepointGeometry {
  readonly chokepointId: NetworkChokepointId;
  readonly center: Coordinate;
  readonly kind: NetworkChokepointKind;
  readonly bearingDegrees: number;
  readonly corridorCoordinates: readonly Coordinate[];
  readonly gateHalfWidthKm: number;
  readonly gates: readonly NetworkChokepointGateGeometry[];
  readonly fitCoordinates: readonly Coordinate[];
}

export const NETWORK_CHOKEPOINT_KIND_BY_ID = {
  "bab-el-mandeb": "strait",
  "cape-good-hope": "cape",
  "dover-strait": "strait",
  "gibraltar-strait": "strait",
  "hormuz-strait": "strait",
  "korea-strait": "strait",
  "luzon-strait": "strait",
  "malacca-strait": "strait",
  "panama-canal": "canal",
  "suez-canal": "canal",
  "taiwan-strait": "strait",
} as const satisfies Readonly<Record<NetworkChokepointId, NetworkChokepointKind>>;

const EARTH_RADIUS_KM = 6_371.0088;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isNetworkChokepointId(value: string): value is NetworkChokepointId {
  return (NETWORK_CHOKEPOINT_IDS as readonly string[]).includes(value);
}

export function destinationCoordinate(
  origin: Coordinate,
  bearingDegrees: number,
  distanceKm: number,
): Coordinate {
  if (
    !Number.isFinite(bearingDegrees) ||
    !Number.isFinite(distanceKm) ||
    distanceKm < 0
  ) {
    throw new RangeError("bearing and distance must be finite, with nonnegative distance");
  }
  if (
    !Number.isFinite(origin[0]) ||
    !Number.isFinite(origin[1]) ||
    origin[1] < -90 ||
    origin[1] > 90
  ) {
    throw new RangeError("origin must be a finite longitude/latitude coordinate");
  }

  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = degreesToRadians(bearingDegrees);
  const latitude = degreesToRadians(origin[1]);
  const longitude = degreesToRadians(normalizeLongitude(origin[0]));
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) -
      Math.sin(latitude) * Math.sin(destinationLatitude),
  );

  return [
    roundCoordinate(normalizeLongitude(radiansToDegrees(destinationLongitude))),
    roundCoordinate(radiansToDegrees(destinationLatitude)),
  ];
}

/** Bearing of the approved corridor's first leg, matching the reference renderer. */
function corridorBearing(coordinates: readonly Coordinate[]): number {
  const start = coordinates[0];
  const end = coordinates[1];
  if (!start || !end) throw new RangeError("chokepoint corridor requires two coordinates");
  const deltaLongitude = degreesToRadians(end[0] - start[0]);
  const startLatitude = degreesToRadians(start[1]);
  const endLatitude = degreesToRadians(end[1]);
  const y = Math.sin(deltaLongitude) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(deltaLongitude);
  return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function createNetworkChokepointGeometry(
  chokepoint: NetworkChokepointRecord,
): NetworkChokepointGeometry {
  if (!isNetworkChokepointId(chokepoint.id)) {
    throw new Error(`Unknown network chokepoint ${chokepoint.id}`);
  }
  if (chokepoint.corridorCoordinates.length < 2 || !(chokepoint.gateHalfWidthKm > 0)) {
    throw new RangeError(`Invalid approved corridor geometry for ${chokepoint.id}`);
  }
  const bearingDegrees = corridorBearing(chokepoint.corridorCoordinates);
  const perpendicular = bearingDegrees + 90;
  const lastIndex = chokepoint.corridorCoordinates.length - 1;
  const gates = chokepoint.corridorCoordinates.map((center, index): NetworkChokepointGateGeometry => ({
    side: index === 0 ? "entry" : index === lastIndex ? "exit" : "intermediate",
    center,
    coordinates: [
      destinationCoordinate(center, perpendicular + 180, chokepoint.gateHalfWidthKm),
      destinationCoordinate(center, perpendicular, chokepoint.gateHalfWidthKm),
    ],
  }));
  const center: Coordinate = [chokepoint.longitude, chokepoint.latitude];

  return {
    chokepointId: chokepoint.id,
    center,
    kind: NETWORK_CHOKEPOINT_KIND_BY_ID[chokepoint.id],
    bearingDegrees,
    corridorCoordinates: chokepoint.corridorCoordinates,
    gateHalfWidthKm: chokepoint.gateHalfWidthKm,
    gates,
    fitCoordinates: [
      ...chokepoint.corridorCoordinates,
      ...gates.flatMap((gate) => gate.coordinates),
    ],
  };
}
