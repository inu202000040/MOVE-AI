import type { Coordinate } from "./catalog-consumer";

export const MAX_WEB_MERCATOR_LATITUDE = 85.05112878;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    throw new TypeError("longitude must be finite");
  }
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 && longitude > 0 ? 180 : normalized;
}

/**
 * Spherical interpolation used only to render smooth corridors between the
 * approved workbook anchors. The returned anchors remain byte-for-byte part
 * of the sampled path; this never invents catalog identity or route data.
 */
export function greatCircleInterpolate(
  start: Coordinate,
  end: Coordinate,
  ratio: number,
): Coordinate {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new RangeError("great-circle interpolation ratio must be between 0 and 1");
  }
  if (ratio === 0) return [start[0], start[1]];
  if (ratio === 1) return [end[0], end[1]];
  const startLongitude = toRadians(start[0]);
  const startLatitude = toRadians(start[1]);
  const endLongitude = toRadians(end[0]);
  const endLatitude = toRadians(end[1]);
  const delta = 2 * Math.asin(Math.sqrt(
    Math.sin((endLatitude - startLatitude) / 2) ** 2 +
      Math.cos(startLatitude) * Math.cos(endLatitude) *
        Math.sin((endLongitude - startLongitude) / 2) ** 2,
  ));
  if (delta < 1e-9) return [start[0], start[1]];
  const startWeight = Math.sin((1 - ratio) * delta) / Math.sin(delta);
  const endWeight = Math.sin(ratio * delta) / Math.sin(delta);
  const x =
    startWeight * Math.cos(startLatitude) * Math.cos(startLongitude) +
    endWeight * Math.cos(endLatitude) * Math.cos(endLongitude);
  const y =
    startWeight * Math.cos(startLatitude) * Math.sin(startLongitude) +
    endWeight * Math.cos(endLatitude) * Math.sin(endLongitude);
  const z = startWeight * Math.sin(startLatitude) + endWeight * Math.sin(endLatitude);
  return [
    normalizeLongitude(toDegrees(Math.atan2(y, x))),
    toDegrees(Math.atan2(z, Math.hypot(x, y))),
  ];
}

export function sampleGreatCircle(
  start: Coordinate,
  end: Coordinate,
  samples = 16,
): readonly Coordinate[] {
  if (!Number.isInteger(samples) || samples < 1) {
    throw new RangeError("great-circle samples must be a positive integer");
  }
  return Array.from({ length: samples + 1 }, (_, index) =>
    greatCircleInterpolate(start, end, index / samples),
  );
}

export function sampleRoute(
  waypoints: readonly Coordinate[],
  samplesPerLeg = 12,
): readonly Coordinate[] {
  if (waypoints.length < 2) return [...waypoints];
  const sampled: Coordinate[] = [];
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const leg = sampleGreatCircle(waypoints[index]!, waypoints[index + 1]!, samplesPerLeg);
    sampled.push(...(index === 0 ? leg : leg.slice(1)));
  }
  return sampled;
}

export function splitAntimeridian(
  coordinates: readonly Coordinate[],
): readonly (readonly Coordinate[])[] {
  if (coordinates.length < 2) {
    return coordinates.length === 0 ? [] : [[coordinates[0]!]];
  }

  const first: Coordinate = [normalizeLongitude(coordinates[0]![0]), coordinates[0]![1]];
  const segments: Coordinate[][] = [[first]];

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = segments.at(-1)!.at(-1)!;
    const next: Coordinate = [
      normalizeLongitude(coordinates[index]![0]),
      coordinates[index]![1],
    ];
    const delta = next[0] - previous[0];

    if (Math.abs(delta) <= 180) {
      segments.at(-1)!.push(next);
      continue;
    }

    const adjustedNextLongitude = delta < -180 ? next[0] + 360 : next[0] - 360;
    const boundary = delta < -180 ? 180 : -180;
    const ratio = (boundary - previous[0]) / (adjustedNextLongitude - previous[0]);
    const latitude = previous[1] + (next[1] - previous[1]) * ratio;
    segments.at(-1)!.push([boundary, latitude]);
    segments.push([[-boundary, latitude], next]);
  }

  return segments;
}

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
}

export function projectWebMercator(
  coordinate: Coordinate,
  width: number,
  height: number,
): ProjectedPoint {
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError("projection dimensions must be positive");
  }
  const longitude = normalizeLongitude(coordinate[0]);
  const latitude = Math.max(
    -MAX_WEB_MERCATOR_LATITUDE,
    Math.min(MAX_WEB_MERCATOR_LATITUDE, coordinate[1]),
  );
  const radians = (latitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * width,
    y:
      (0.5 - Math.log((1 + Math.sin(radians)) / (1 - Math.sin(radians))) / (4 * Math.PI)) *
      height,
  };
}

export function squaredDistance(a: ProjectedPoint, b: ProjectedPoint): number {
  const deltaX = a.x - b.x;
  const deltaY = a.y - b.y;
  return deltaX * deltaX + deltaY * deltaY;
}
