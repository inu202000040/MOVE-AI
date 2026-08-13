import assert from "node:assert/strict";
import test from "node:test";

import {
  UNAVAILABLE_DASHBOARD_GATEWAY,
  decodeDashboardSnapshotResult,
  requestDashboardSnapshot,
  type DashboardDataGatewayV1,
} from "../../app/freight-risk/dashboard/domain";
import { isRecord } from "../../app/freight-risk/dashboard/domain/decode";
import { snapshotGatewayFixture } from "./snapshot-fixture";

test("snapshot projection reconstructs all 13 approved 187-point actual series", () => {
  const decoded = decodeDashboardSnapshotResult(snapshotGatewayFixture());
  assert.equal(decoded?.status, "READY");
  assert.equal(decoded?.badge, "REFERENCE");
  assert.equal(decoded?.actualByRoute.size, 13);
  assert.equal(decoded?.actualByRoute.get("KNEI")?.length, 187);
  assert.deepEqual(decoded?.actualByRoute.get("KNEI")?.at(-1), {
    date: "2026-08-03",
    value: 4_884,
  });
});

test("snapshot projection rejects malformed envelope, routes, values, and state compatibility", () => {
  const wrongMeta: unknown = structuredClone(snapshotGatewayFixture());
  assert.equal(isRecord(wrongMeta), true);
  if (!isRecord(wrongMeta) || !isRecord(wrongMeta.meta)) throw new Error("fixture invariant");
  wrongMeta.meta.unit = "Index";
  assert.equal(decodeDashboardSnapshotResult(wrongMeta), null);

  const wrongValue: unknown = structuredClone(snapshotGatewayFixture());
  if (!isRecord(wrongValue) || !isRecord(wrongValue.data) || !isRecord(wrongValue.data.routes)) throw new Error("fixture invariant");
  const route = wrongValue.data.routes.KNEI;
  if (!isRecord(route) || !Array.isArray(route.values)) throw new Error("fixture invariant");
  route.values[186] = Number.NaN;
  assert.equal(decodeDashboardSnapshotResult(wrongValue), null);

  const missingRoute: unknown = structuredClone(snapshotGatewayFixture());
  if (!isRecord(missingRoute) || !isRecord(missingRoute.data) || !isRecord(missingRoute.data.routes)) throw new Error("fixture invariant");
  delete missingRoute.data.routes.KCI;
  assert.equal(decodeDashboardSnapshotResult(missingRoute), null);
});

test("snapshot request consumes only the injected canonical gateway", async () => {
  let calls = 0;
  const gateway: DashboardDataGatewayV1 = {
    snapshot: async () => {
      calls += 1;
      return snapshotGatewayFixture();
    },
    market: UNAVAILABLE_DASHBOARD_GATEWAY.market,
    news: UNAVAILABLE_DASHBOARD_GATEWAY.news,
    insight: UNAVAILABLE_DASHBOARD_GATEWAY.insight,
  };
  const ready = await requestDashboardSnapshot(gateway);
  assert.equal(calls, 1);
  assert.equal(ready?.periodEnd, "2026-08-03");
});
