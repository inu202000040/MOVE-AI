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
  readonly globeFacing?: boolean;
}

function priority(candidate: WeatherDeclutterCandidate): number {
  if (candidate.selected) return 600;
  if (candidate.hovered) return 500;
  if (candidate.risk === "severe") return 400;
  if (candidate.risk === "warning") return 300;
  if (candidate.role === "chokepoint") return 200;
  if (candidate.role === "primary") return 100;
  return 0;
}

function isProtected(candidate: WeatherDeclutterCandidate): boolean {
  return (
    candidate.selected ||
    candidate.hovered ||
    candidate.risk === "severe" ||
    candidate.risk === "warning"
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
