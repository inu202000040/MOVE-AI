import { ROUTE_IDS, ROUTE_LABELS, type RouteId } from "../../../contracts";

import { hasExactKeys, isRecord } from "./decode";
import type { DashboardDataGatewayV1 } from "./gateway-client";
import { decodeGatewayResult } from "./gateway-result";

export interface DashboardActualPointV1 {
  readonly date: string;
  readonly value: number;
}

export interface DashboardSnapshotReadyV1 {
  readonly status: "READY";
  readonly badge: "LIVE" | "REFERENCE";
  readonly source: string;
  readonly periodEnd: string;
  readonly actualByRoute: ReadonlyMap<RouteId, readonly DashboardActualPointV1[]>;
}

export type DashboardSnapshotSurfaceV1 =
  | { readonly status: "LOADING" }
  | DashboardSnapshotReadyV1
  | { readonly status: "UNAVAILABLE"; readonly source: string };

interface SnapshotProjectionDataV1 {
  readonly periodEnd: string;
  readonly actualByRoute: ReadonlyMap<RouteId, readonly DashboardActualPointV1[]>;
}

const SNAPSHOT_KEYS = ["schemaVersion", "generatedAt", "protocol", "source", "dates", "routes"] as const;
const ROUTE_SNAPSHOT_KEYS = ["id", "name", "unit", "values", "models"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function decodeSnapshotProjection(value: unknown): SnapshotProjectionDataV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, SNAPSHOT_KEYS) || value.schemaVersion !== "glovis-freight-risk/v3") {
    return null;
  }
  if (
    typeof value.generatedAt !== "string"
    || !Number.isFinite(Date.parse(value.generatedAt))
    || !isRecord(value.protocol)
    || !isRecord(value.source)
    || !Array.isArray(value.dates)
    || value.dates.length !== 187
    || !isRecord(value.routes)
    || !hasExactKeys(value.routes, ROUTE_IDS)
  ) {
    return null;
  }
  const dates: string[] = [];
  for (const item of value.dates) {
    if (typeof item !== "string" || !ISO_DATE.test(item) || !Number.isFinite(Date.parse(`${item}T00:00:00Z`))) {
      return null;
    }
    if (dates.length > 0 && (dates.at(-1) ?? "") >= item) {
      return null;
    }
    dates.push(item);
  }

  const actualEntries: [RouteId, readonly DashboardActualPointV1[]][] = [];
  for (const routeId of ROUTE_IDS) {
    const route = value.routes[routeId];
    if (!isRecord(route) || !hasExactKeys(route, ROUTE_SNAPSHOT_KEYS)) {
      return null;
    }
    if (
      route.id !== routeId
      || route.name !== ROUTE_LABELS[routeId]
      || route.unit !== "USD/FEU"
      || !Array.isArray(route.values)
      || route.values.length !== dates.length
      || !Array.isArray(route.models)
      || route.models.length !== 8
    ) {
      return null;
    }
    const points: DashboardActualPointV1[] = [];
    for (let index = 0; index < dates.length; index += 1) {
      const pointValue = route.values[index];
      if (typeof pointValue !== "number" || !Number.isFinite(pointValue) || pointValue <= 0) {
        return null;
      }
      points.push({ date: dates[index], value: pointValue });
    }
    actualEntries.push([routeId, points]);
  }

  return {
    periodEnd: dates.at(-1) ?? "",
    actualByRoute: new Map(actualEntries),
  };
}

export function decodeDashboardSnapshotResult(value: unknown): DashboardSnapshotReadyV1 | null {
  const result = decodeGatewayResult(
    value,
    decodeSnapshotProjection,
    (state) => state === "READY" || state === "UNAVAILABLE" ? state : null,
    ({ state, data, meta, error }) => state === "READY"
      ? data !== null
        && error === null
        && meta.mode !== "unavailable"
        && meta.unit === "USD/FEU"
        && meta.asOf === data.periodEnd
      : data === null && error !== null && meta.mode === "unavailable",
  );
  if (result === null || result.state !== "READY" || result.data === null) {
    return null;
  }
  return {
    status: "READY",
    badge: result.meta.mode === "live" ? "LIVE" : "REFERENCE",
    source: result.meta.source,
    periodEnd: result.data.periodEnd,
    actualByRoute: result.data.actualByRoute,
  };
}

export async function requestDashboardSnapshot(
  gateway: DashboardDataGatewayV1,
  signal?: AbortSignal,
): Promise<DashboardSnapshotReadyV1 | null> {
  return decodeDashboardSnapshotResult(await gateway.snapshot(signal));
}
