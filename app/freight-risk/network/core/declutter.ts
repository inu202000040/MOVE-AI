import { squaredDistance } from "./geometry";

export const WEATHER_DECLUTTER_ZOOM = 2.15;

export type WeatherRisk = "normal" | "warning" | "severe";
export type WeatherRole = "secondary" | "primary" | "chokepoint";

export interface WeatherDeclutterCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly risk: WeatherRisk;
  readonly role: WeatherRole;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly pinned?: boolean;
  readonly globeFacing?: boolean;
}

export interface ProjectedMarkerCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface DeclutteredMarker extends ProjectedMarkerCandidate {
  readonly anchorX: number;
  readonly anchorY: number;
}

export function declutterProjectedMarkers(
  candidates: readonly ProjectedMarkerCandidate[],
  collisionDistance = 14,
  offsetRadius = 18,
): readonly DeclutteredMarker[] {
  if (collisionDistance < 0 || offsetRadius < 0) {
    throw new RangeError("declutter distances cannot be negative");
  }
  const ordered = [...candidates].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const result: DeclutteredMarker[] = [];
  const minimumSeparation = Math.max(collisionDistance * 2 + 2, offsetRadius);
  const minimumSeparationSquared = minimumSeparation * minimumSeparation;
  const isFree = (x: number, y: number): boolean =>
    result.every(
      (placed) => squaredDistance({ x, y }, placed) >= minimumSeparationSquared,
    );

  for (const candidate of ordered) {
    if (isFree(candidate.x, candidate.y)) {
      result.push({
        ...candidate,
        anchorX: candidate.x,
        anchorY: candidate.y,
      });
      continue;
    }

    let placed = false;
    for (let ring = 1; ring <= ordered.length && !placed; ring += 1) {
      const steps = ring * 8;
      const radius = ring * minimumSeparation;
      for (let step = 0; step < steps; step += 1) {
        const angle = -Math.PI / 2 + (step * Math.PI * 2) / steps;
        const x = candidate.x + Math.cos(angle) * radius;
        const y = candidate.y + Math.sin(angle) * radius;
        if (!isFree(x, y)) continue;
        result.push({
          id: candidate.id,
          x,
          y,
          anchorX: candidate.x,
          anchorY: candidate.y,
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      throw new Error(`Unable to declutter marker ${candidate.id}`);
    }
  }

  return result;
}

function priority(candidate: WeatherDeclutterCandidate): number {
  if (candidate.selected) return 600;
  if (candidate.hovered) return 500;
  if (candidate.risk === "severe") return 400;
  if (candidate.risk === "warning") return 300;
  if (candidate.pinned) return 250;
  if (candidate.role === "chokepoint") return 200;
  if (candidate.role === "primary") return 100;
  return 0;
}

function isProtected(candidate: WeatherDeclutterCandidate): boolean {
  return (
    candidate.selected ||
    candidate.hovered ||
    candidate.risk === "severe" ||
    candidate.risk === "warning" ||
    candidate.pinned === true
  );
}

export function selectVisibleWeather(
  candidates: readonly WeatherDeclutterCandidate[],
  zoom: number,
  minimumDistance: number,
): readonly WeatherDeclutterCandidate[] {
  if (minimumDistance < 0) {
    throw new RangeError("minimumDistance cannot be negative");
  }
  const ordered = [...candidates]
    .filter((candidate) => candidate.globeFacing !== false || candidate.selected)
    .filter(
      (candidate) =>
        zoom >= WEATHER_DECLUTTER_ZOOM ||
        candidate.role !== "secondary" ||
        candidate.risk !== "normal" ||
        candidate.selected ||
        candidate.hovered,
    )
    .sort((left, right) => priority(right) - priority(left) || left.id.localeCompare(right.id));

  const accepted: WeatherDeclutterCandidate[] = [];
  const minimumDistanceSquared = minimumDistance * minimumDistance;
  for (const candidate of ordered) {
    if (
      isProtected(candidate) ||
      accepted.every(
        (visible) => squaredDistance(candidate, visible) >= minimumDistanceSquared,
      )
    ) {
      accepted.push(candidate);
    }
  }
  return accepted;
}
