import type { Coordinate } from "./catalog-consumer";
import { normalizeLongitude } from "./geometry";

export interface NetworkCameraPadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface NetworkCameraPaddingInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly mobile: boolean;
  readonly panelOpen: boolean;
}

export type NetworkCameraBounds = readonly [
  southWest: Coordinate,
  northEast: Coordinate,
];

export interface NetworkCameraFitInput extends NetworkCameraPaddingInput {
  readonly coordinates: readonly Coordinate[];
  readonly reducedMotion: boolean;
  readonly preferredDurationMs: number;
}

export interface NetworkCameraFit {
  readonly bounds: NetworkCameraBounds;
  readonly padding: NetworkCameraPadding;
  readonly duration: number;
}

function assertPositiveDimension(value: number, label: string): void {
  if (!Number.isFinite(value) || !(value > 0)) {
    throw new RangeError(`${label} must be positive and finite`);
  }
}

export function resolveNetworkCameraPadding({
  viewportWidth,
  viewportHeight,
  mobile,
  panelOpen,
}: NetworkCameraPaddingInput): NetworkCameraPadding {
  assertPositiveDimension(viewportWidth, "viewportWidth");
  assertPositiveDimension(viewportHeight, "viewportHeight");
  const edge = mobile ? 12 : 24;

  if (!panelOpen) {
    return { top: edge, right: edge, bottom: edge, left: edge };
  }
  if (mobile) {
    return {
      top: edge,
      right: edge,
      bottom: Math.max(edge, Math.min(360, viewportHeight * 0.46)),
      left: edge,
    };
  }
  return {
    top: edge,
    right: Math.max(edge, Math.min(560, viewportWidth * 0.43)),
    bottom: edge,
    left: edge,
  };
}

export function resolveNetworkCameraDuration(
  preferredDurationMs: number,
  reducedMotion: boolean,
): number {
  if (!Number.isFinite(preferredDurationMs) || preferredDurationMs < 0) {
    throw new RangeError("camera duration must be finite and nonnegative");
  }
  return reducedMotion ? 0 : Math.round(preferredDurationMs);
}

function wrappedLongitude(longitude: number): number {
  const normalized = normalizeLongitude(longitude);
  return normalized < 0 ? normalized + 360 : normalized;
}

export function networkCameraBounds(
  coordinates: readonly Coordinate[],
): NetworkCameraBounds {
  if (coordinates.length === 0) {
    throw new RangeError("camera fit requires at least one coordinate");
  }
  const longitudes: number[] = [];
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const coordinate of coordinates) {
    if (
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1]) ||
      coordinate[1] < -90 ||
      coordinate[1] > 90
    ) {
      throw new RangeError("camera fit coordinates must contain finite longitude/latitude values");
    }
    longitudes.push(wrappedLongitude(coordinate[0]));
    south = Math.min(south, coordinate[1]);
    north = Math.max(north, coordinate[1]);
  }
  longitudes.sort((left, right) => left - right);

  let largestGap = Number.NEGATIVE_INFINITY;
  let startIndex = 0;
  for (let index = 0; index < longitudes.length; index += 1) {
    const current = longitudes[index]!;
    const next =
      index === longitudes.length - 1
        ? longitudes[0]! + 360
        : longitudes[index + 1]!;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      startIndex = (index + 1) % longitudes.length;
    }
  }

  const westWrapped = longitudes[startIndex]!;
  const span = 360 - largestGap;
  const west = normalizeLongitude(westWrapped);
  const east = west + span;
  return [
    [west, south],
    [east, north],
  ];
}

export function createNetworkCameraFit({
  coordinates,
  reducedMotion,
  preferredDurationMs,
  ...paddingInput
}: NetworkCameraFitInput): NetworkCameraFit {
  return {
    bounds: networkCameraBounds(coordinates),
    padding: resolveNetworkCameraPadding(paddingInput),
    duration: resolveNetworkCameraDuration(preferredDurationMs, reducedMotion),
  };
}
