import {
  NETWORK_CHOKEPOINT_IDS,
  type Coordinate,
  type NetworkChokepointRecord,
} from "./catalog-consumer";
import { normalizeLongitude } from "./geometry";

export type NetworkChokepointId = (typeof NETWORK_CHOKEPOINT_IDS)[number];
export type NetworkChokepointKind = "strait" | "canal" | "cape";
export type NetworkChokepointGateSide = "entry" | "exit";

export interface NetworkChokepointGeometryProfile {
  readonly kind: NetworkChokepointKind;
  /** Direction from the entry gate to the exit gate, clockwise from north. */
  readonly bearingDegrees: number;
  readonly corridorLengthKm: number;
  readonly corridorWidthKm: number;
}

export interface NetworkChokepointGateGeometry {
  readonly side: NetworkChokepointGateSide;
  readonly center: Coordinate;
  readonly coordinates: readonly [Coordinate, Coordinate];
}

export interface NetworkChokepointGeometry {
  readonly chokepointId: NetworkChokepointId;
  readonly center: Coordinate;
  readonly profile: NetworkChokepointGeometryProfile;
  readonly corridorCoordinates: readonly [Coordinate, Coordinate, Coordinate];
  readonly gates: readonly [
    NetworkChokepointGateGeometry,
    NetworkChokepointGateGeometry,
  ];
  readonly fitCoordinates: readonly Coordinate[];
}

/*
 * Representative navigation envelopes, not legal navigation boundaries.
 * Keeping these values in one frozen table makes the corridor/gate topology
 * stable even when traffic and weather providers are unavailable.
 */
export const NETWORK_CHOKEPOINT_GEOMETRY_PROFILES = {
  "bab-el-mandeb": {
    kind: "strait",
    bearingDegrees: 330,
    corridorLengthKm: 180,
    corridorWidthKm: 52,
  },
  "cape-good-hope": {
    kind: "cape",
    bearingDegrees: 105,
    corridorLengthKm: 520,
    corridorWidthKm: 160,
  },
  "dover-strait": {
    kind: "strait",
    bearingDegrees: 45,
    corridorLengthKm: 115,
    corridorWidthKm: 38,
  },
  "gibraltar-strait": {
    kind: "strait",
    bearingDegrees: 90,
    corridorLengthKm: 125,
    corridorWidthKm: 44,
  },
  "hormuz-strait": {
    kind: "strait",
    bearingDegrees: 110,
    corridorLengthKm: 150,
    corridorWidthKm: 45,
  },
  "korea-strait": {
    kind: "strait",
    bearingDegrees: 35,
    corridorLengthKm: 250,
    corridorWidthKm: 100,
  },
  "luzon-strait": {
    kind: "strait",
    bearingDegrees: 85,
    corridorLengthKm: 380,
    corridorWidthKm: 170,
  },
  "malacca-strait": {
    kind: "strait",
    bearingDegrees: 135,
    corridorLengthKm: 650,
    corridorWidthKm: 110,
  },
  "panama-canal": {
    kind: "canal",
    bearingDegrees: 135,
    corridorLengthKm: 95,
    corridorWidthKm: 36,
  },
  "suez-canal": {
    kind: "canal",
    bearingDegrees: 2,
    corridorLengthKm: 190,
    corridorWidthKm: 34,
  },
  "taiwan-strait": {
    kind: "strait",
    bearingDegrees: 25,
    corridorLengthKm: 470,
    corridorWidthKm: 165,
  },
} as const satisfies Readonly<
  Record<NetworkChokepointId, NetworkChokepointGeometryProfile>
>;

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
    !(distanceKm >= 0)
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
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(destinationLatitude),
    );

  return [
    roundCoordinate(normalizeLongitude(radiansToDegrees(destinationLongitude))),
    roundCoordinate(radiansToDegrees(destinationLatitude)),
  ];
}

function gateGeometry(
  side: NetworkChokepointGateSide,
  center: Coordinate,
  bearingDegrees: number,
  widthKm: number,
): NetworkChokepointGateGeometry {
  const halfWidth = widthKm / 2;
  return {
    side,
    center,
    coordinates: [
      destinationCoordinate(center, bearingDegrees - 90, halfWidth),
      destinationCoordinate(center, bearingDegrees + 90, halfWidth),
    ],
  };
}

export function createNetworkChokepointGeometry(
  chokepoint: NetworkChokepointRecord,
): NetworkChokepointGeometry {
  if (!isNetworkChokepointId(chokepoint.id)) {
    throw new Error(`Unknown network chokepoint ${chokepoint.id}`);
  }
  const profile = NETWORK_CHOKEPOINT_GEOMETRY_PROFILES[chokepoint.id];
  const center: Coordinate = [chokepoint.longitude, chokepoint.latitude];
  const halfLength = profile.corridorLengthKm / 2;
  const entryCenter = destinationCoordinate(
    center,
    profile.bearingDegrees + 180,
    halfLength,
  );
  const exitCenter = destinationCoordinate(
    center,
    profile.bearingDegrees,
    halfLength,
  );
  const entryGate = gateGeometry(
    "entry",
    entryCenter,
    profile.bearingDegrees,
    profile.corridorWidthKm,
  );
  const exitGate = gateGeometry(
    "exit",
    exitCenter,
    profile.bearingDegrees,
    profile.corridorWidthKm,
  );

  return {
    chokepointId: chokepoint.id,
    center,
    profile,
    corridorCoordinates: [entryCenter, center, exitCenter],
    gates: [entryGate, exitGate],
    fitCoordinates: [
      entryGate.coordinates[0],
      entryGate.coordinates[1],
      center,
      exitGate.coordinates[0],
      exitGate.coordinates[1],
    ],
  };
}
