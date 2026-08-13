import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  UNAVAILABLE_DASHBOARD_GATEWAY,
  UNAVAILABLE_REPRESENTATIVE_SOURCE,
  bindRepresentativeSource,
  collectNews,
  createRepresentativeSnapshotReader,
  readRepresentativeSource,
  requestDashboardSnapshot,
  requestMarket,
  type DashboardDataGatewayV1,
  type DashboardRepresentativeSourceV1,
  type RepresentativeSelectionV1,
} from "../../app/freight-risk/dashboard/domain";
import { representativeFixture } from "./representative-fixture";

test("injected Dashboard gateway exercises market and news without direct provider access", async () => {
  const calls: string[] = [];
  const gateway: DashboardDataGatewayV1 = {
    snapshot: async (signal) => {
      calls.push(`snapshot:${String(signal?.aborted ?? false)}`);
      return UNAVAILABLE_DASHBOARD_GATEWAY.snapshot(signal);
    },
    market: async (query, signal) => {
      calls.push(`market:${String(query["series"])}:${String(signal?.aborted ?? false)}`);
      return UNAVAILABLE_DASHBOARD_GATEWAY.market(query, signal);
    },
    news: async (query, signal) => {
      calls.push(`news:${String(query["route"])}:${String(query["retry"])}`);
      return UNAVAILABLE_DASHBOARD_GATEWAY.news(query, signal);
    },
    insight: async (query, signal) => {
      const route = query["route"];
      const routeId = typeof route === "object" && route !== null && "id" in route
        ? route.id
        : "invalid";
      calls.push(`insight:${String(routeId)}:${String(query["selectedHorizon"])}`);
      return UNAVAILABLE_DASHBOARD_GATEWAY.insight(query, signal);
    },
  };

  const snapshot = await requestDashboardSnapshot(gateway);
  const market = await requestMarket(gateway, "fx", "2026-08-03");
  const news = await collectNews(gateway, "KNEI", "test-refresh");
  assert.equal(snapshot, null);
  assert.equal(market?.state, "UNAVAILABLE");
  assert.equal(news?.kind, "ERROR");
  assert.deepEqual(calls, ["snapshot:false", "market:fx:false", "news:KNEI:0"]);
  assert.equal(JSON.stringify(await gateway.insight({
    route: { id: "KNEI", name: "유럽", asOf: "2026-08-03" },
    current: { date: "2026-08-03", value: 4_884 },
    selectedHorizon: 1,
    direction: "보합",
    forecast: { date: "2026-08-10", value: 4_828.98, changePct: -1.1, lower: 4_482.47, upper: 5_175.49, coveragePct: 88.5 },
    forecastPath: [
      { horizon: 1, date: "2026-08-10", value: 4_828.98, lower: 4_482.47, upper: 5_175.49 },
      { horizon: 2, date: "2026-08-17", value: 4_791.32, lower: 4_227.22, upper: 5_355.43 },
      { horizon: 3, date: "2026-08-24", value: 4_767.23, lower: 3_935.75, upper: 5_598.72 },
      { horizon: 4, date: "2026-08-31", value: 4_753.74, lower: 3_439.8, upper: 6_067.68 },
    ],
    representativeModel: { name: "SARIMAX", mapePct: 3.6, mse: 1, mase: 0.037, totalScore: 1 },
    modelAgreement: { up: 1, down: 4, flat: 3, total: 8 },
    news: [],
  })).includes('"state":"UNAVAILABLE"'), true);
  assert.equal(calls.at(-1), "insight:KNEI:1");
});

test("representative subscription publishes only completely decoded matching revisions", () => {
  let current: unknown = representativeFixture();
  let emit: () => void = () => undefined;
  let subscribed = false;
  const source: DashboardRepresentativeSourceV1 = {
    current: () => current,
    subscribe: (next) => {
      emit = next;
      subscribed = true;
      return () => {
        emit = () => undefined;
        subscribed = false;
      };
    },
  };
  const observed: (RepresentativeSelectionV1 | null)[] = [];
  const readSnapshot = createRepresentativeSnapshotReader(source, "KNEI");
  const firstSnapshot = readSnapshot();
  assert.strictEqual(readSnapshot(), firstSnapshot);
  const unsubscribe = bindRepresentativeSource(source, "KNEI", (value) => observed.push(value));
  assert.equal(observed[0]?.modelId, "sarimax");

  current = { route: "KNEI", representativeRevision: "malformed" };
  assert.equal(subscribed, true);
  emit();
  assert.equal(observed.at(-1), null);

  const updated = representativeFixture();
  updated.selectionMode = "manual";
  updated.representativeRevision = `rep-v1:${"1".repeat(64)}`;
  current = updated;
  emit();
  assert.equal(observed.at(-1)?.selectionMode, "manual");
  assert.equal(observed.at(-1)?.representativeRevision, updated.representativeRevision);
  unsubscribe();
  assert.equal(subscribed, false);

  assert.equal(readRepresentativeSource(UNAVAILABLE_REPRESENTATIVE_SOURCE, "KNEI"), null);
});

test("production page mounts the client runtime with required, fail-closed seams", async () => {
  const page = await readFile(path.resolve("app/freight-risk/dashboard/page.tsx"), "utf8");
  const runtime = await readFile(path.resolve("app/freight-risk/dashboard/DashboardRuntime.tsx"), "utf8");
  const app = await readFile(path.resolve("app/freight-risk/dashboard/DashboardApp.tsx"), "utf8");

  assert.equal(page.includes("validatedSnapshotGatewayResultV1"), true);
  assert.equal(page.includes("initialSnapshotResult={initialSnapshotResult}"), true);
  assert.equal(page.includes("data-gateway.server"), true);
  assert.equal(runtime.includes('"use client"'), true);
  assert.equal(runtime.includes("DashboardRuntimeWithDependencies"), true);
  assert.equal(runtime.includes("createSameOriginDataGatewayV1"), true);
  assert.equal(runtime.includes("data-gateway.client"), true);
  assert.equal(runtime.includes("data-gateway.server"), false);
  assert.equal(runtime.includes('data/runtime/data-gateway"'), false);
  assert.equal(runtime.includes("UNAVAILABLE_REPRESENTATIVE_SOURCE"), true);
  assert.equal(runtime.includes("useSyncExternalStore"), true);
  assert.equal(runtime.includes("initialSnapshotResult"), true);
  assert.equal(app.includes("gateway?:"), false);
  assert.equal(app.includes("representative?:"), false);
  assert.equal(app.includes("localMarketSurface"), false);
  assert.equal(app.includes("ROUTE_FORECASTS"), false);
  assert.equal(app.includes("ROUTE_SERIES"), false);
  assert.equal(app.includes("window.history"), false);
  assert.equal(app.includes("fetch("), false);
});
