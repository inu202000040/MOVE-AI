import type { NetworkCatalogSeam } from "../core/catalog-consumer";
import { APPROVED_CHOKEPOINT_ROWS } from "./approved-reference-chokepoints";
import { APPROVED_PORT_ROWS } from "./approved-reference-ports";
import { APPROVED_ROUTE_ROWS } from "./approved-reference-routes";
import { APPROVED_WEATHER_ROWS } from "./approved-reference-weather";

export interface NetworkDisplayLabel {
  readonly ko: string;
  readonly en?: string;
  readonly subtitleKo?: string;
}

const routes = APPROVED_ROUTE_ROWS.map(
  ([id, primaryPortId, waypointCoordinates]) => ({
    id,
    primaryPortId,
    waypointCoordinates,
  }),
);
const ports = APPROVED_PORT_ROWS.map(
  ([id, routeId, longitude, latitude, upstreamPortWatchId, primary]) => ({
    id,
    routeId,
    longitude,
    latitude,
    upstreamPortWatchId,
    primary,
  }),
);
const chokepoints = APPROVED_CHOKEPOINT_ROWS.map(
  ([id, longitude, latitude, upstreamPortWatchId]) => ({
    id,
    longitude,
    latitude,
    upstreamPortWatchId,
  }),
);
const weather = APPROVED_WEATHER_ROWS.map(
  ([id, kind, entityId, longitude, latitude]) => ({
    id,
    kind,
    entityId,
    longitude,
    latitude,
  }),
);

export const APPROVED_REFERENCE_CATALOG = {
  schemaVersion: "network-catalog-seam/v1",
  capturedAt: "2026-08-12T19:02:10+09:00",
  timezone: "Asia/Seoul",
  referenceManifestSha256:
    "991690557c80d0820228f8d6c63b78c82e74677d64aa91ba1be2906b681bfa71",
  routes,
  ports,
  chokepoints,
  weather,
} as const satisfies NetworkCatalogSeam;

export const APPROVED_REFERENCE_LABELS = {
  routes: Object.fromEntries(
    APPROVED_ROUTE_ROWS.map(([id, , , ko, en]) => [id, { ko, en }]),
  ) as Readonly<Record<string, NetworkDisplayLabel>>,
  ports: Object.fromEntries(
    APPROVED_PORT_ROWS.map(([id, , , , , , ko, en]) => [id, { ko, en }]),
  ) as Readonly<Record<string, NetworkDisplayLabel>>,
  chokepoints: Object.fromEntries(
    APPROVED_CHOKEPOINT_ROWS.map(([id, , , , ko, en]) => [id, { ko, en }]),
  ) as Readonly<Record<string, NetworkDisplayLabel>>,
  weather: Object.fromEntries(
    APPROVED_WEATHER_ROWS.map(([id, , , , , ko, subtitleKo]) => [
      id,
      { ko, subtitleKo },
    ]),
  ) as Readonly<Record<string, NetworkDisplayLabel>>,
} as const;

export const APPROVED_REFERENCE_PROVENANCE = {
  mode: "fixture",
  source: "approved-data-pack:01/09/12/16",
  attribution: "MOVE AI approved data pack",
  capturedAt: APPROVED_REFERENCE_CATALOG.capturedAt,
} as const;
