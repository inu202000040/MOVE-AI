import type { Coordinate } from "./catalog-consumer";

export const MAX_WEB_MERCATOR_LATITUDE = 85.05112878;

export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    throw new TypeError("longitude must be finite");
  }
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 && longitude > 0 ? 180 : normalized;
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
