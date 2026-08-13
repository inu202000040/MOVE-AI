import type { PendingGatewayResultV1, RouteId } from "../../../contracts";

import type { DashboardDataGatewayV1 } from "./gateway-client";
import {
  decodeRepresentativeSelection,
  type RepresentativeSelectionV1,
} from "./representative";

export interface DashboardRepresentativeSourceV1 {
  current(routeId: RouteId): unknown;
  subscribe(listener: () => void): () => void;
}

export function readRepresentativeSource(
  source: DashboardRepresentativeSourceV1,
  routeId: RouteId,
): RepresentativeSelectionV1 | null {
  try {
    return decodeRepresentativeSelection(source.current(routeId), routeId);
  } catch {
    return null;
  }
}

export function createRepresentativeSnapshotReader(
  source: DashboardRepresentativeSourceV1,
  routeId: RouteId,
): () => RepresentativeSelectionV1 | null {
  let initialized = false;
  let fingerprint: string | null = null;
  let retained: RepresentativeSelectionV1 | null = null;
  return () => {
    const next = readRepresentativeSource(source, routeId);
    const nextFingerprint = next === null ? null : JSON.stringify(next);
    if (initialized && nextFingerprint === fingerprint) {
      return retained;
    }
    if (
      retained !== null
      && next !== null
      && retained.representativeRevision === next.representativeRevision
      && nextFingerprint !== fingerprint
    ) {
      retained = null;
      fingerprint = null;
      initialized = true;
      return null;
    }
    retained = next;
    fingerprint = nextFingerprint;
    initialized = true;
    return retained;
  };
}

export function subscribeRepresentativeSource(
  source: DashboardRepresentativeSourceV1,
  notify: () => void,
): () => void {
  try {
    return source.subscribe(notify);
  } catch {
    return () => undefined;
  }
}

export function bindRepresentativeSource(
  source: DashboardRepresentativeSourceV1,
  routeId: RouteId,
  publish: (selection: RepresentativeSelectionV1 | null) => void,
): () => void {
  const readSnapshot = createRepresentativeSnapshotReader(source, routeId);
  const synchronize = () => publish(readSnapshot());
  synchronize();
  return subscribeRepresentativeSource(source, synchronize);
}

function unavailableResult(domain: "snapshot" | "market" | "news" | "insight"): PendingGatewayResultV1 {
  return {
    schemaVersion: "move-ai/gateway/v1",
    state: "UNAVAILABLE",
    data: null,
    meta: {
      mode: "unavailable",
      source: "dashboard-runtime",
      sourceUrl: null,
      asOf: null,
      fetchedAt: "1970-01-01T00:00:00.000Z",
      unit: null,
      isEstimate: false,
      attribution: "MOVE AI",
      warnings: [],
      provider: null,
      cache: { hit: false, stale: false, ageSeconds: null },
    },
    error: {
      code: "PROVIDER_UNAVAILABLE",
      message: `${domain} gateway가 아직 연결되지 않았습니다.`,
      retryable: false,
      upstreamStatus: null,
      details: { reasonCode: "GATEWAY_NOT_ASSEMBLED" },
    },
  };
}

export const UNAVAILABLE_DASHBOARD_GATEWAY: DashboardDataGatewayV1 = Object.freeze({
  snapshot: async () => unavailableResult("snapshot"),
  market: async () => unavailableResult("market"),
  news: async () => unavailableResult("news"),
  insight: async () => unavailableResult("insight"),
});

export const UNAVAILABLE_REPRESENTATIVE_SOURCE: DashboardRepresentativeSourceV1 = Object.freeze({
  current: () => null,
  subscribe: () => () => undefined,
});
