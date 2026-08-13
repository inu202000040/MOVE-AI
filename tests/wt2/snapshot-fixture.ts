import { ROUTE_IDS, ROUTE_LABELS, type PendingGatewayResultV1 } from "../../app/contracts";
import { ROUTE_SERIES } from "../../app/freight-risk/dashboard/fixture";

export function snapshotGatewayFixture(): PendingGatewayResultV1 {
  const dates = ROUTE_SERIES.KNEI.map((point) => point.date);
  return {
    schemaVersion: "move-ai/gateway/v1",
    state: "READY",
    data: {
      schemaVersion: "glovis-freight-risk/v3",
      generatedAt: "2026-08-13T00:00:00+09:00",
      protocol: { id: "dashboard-test" },
      source: { id: "approved-data-pack" },
      dates,
      routes: Object.fromEntries(ROUTE_IDS.map((routeId) => [routeId, {
        id: routeId,
        name: ROUTE_LABELS[routeId],
        unit: "USD/FEU",
        values: ROUTE_SERIES[routeId].map((point) => point.value),
        models: Array.from({ length: 8 }, () => ({})),
      }])),
    },
    meta: {
      mode: "fixture",
      source: "forecast-snapshot-v3",
      sourceUrl: null,
      asOf: "2026-08-03",
      fetchedAt: "2026-08-13T00:00:00+09:00",
      unit: "USD/FEU",
      isEstimate: true,
      attribution: "MOVE AI approved data pack",
      warnings: [],
      provider: null,
      cache: { hit: false, stale: false, ageSeconds: null },
    },
    error: null,
  };
}
