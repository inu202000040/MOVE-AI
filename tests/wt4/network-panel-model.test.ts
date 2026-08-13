import assert from "node:assert/strict";
import test from "node:test";

import { FixtureDataGateway } from "../../app/data/runtime/fixture-gateway";
import {
  buildNetworkChartPath,
  formatEstimatedTons,
  formatPercent,
  formatVesselCalls,
  resolveChokepointPanelDataV1,
  resolvePortPanelDataV1,
} from "../../app/freight-risk/network/data/network-panel-model";

test("panel models couple summary and detail IDs exactly", async () => {
  const gateway = new FixtureDataGateway();
  const portSummary = await gateway.portSummary();
  assert.ok(portSummary.data);
  const portId = Object.keys(portSummary.data.summaries)[0];
  assert.ok(portId);
  const portDetail = await gateway.portDetail({ id: portId });
  assert.ok(portDetail.data);
  assert.equal(resolvePortPanelDataV1(portId, portSummary.data, portDetail.data).summary?.portId, portId);
  assert.equal(resolvePortPanelDataV1("missing-port", portSummary.data, portDetail.data).summary, null);

  const chokeSummary = await gateway.chokeSummary();
  assert.ok(chokeSummary.data);
  const chokepointId = Object.keys(chokeSummary.data.summaries)[0];
  assert.ok(chokepointId);
  const chokeDetail = await gateway.chokeDetail({ id: chokepointId });
  assert.ok(chokeDetail.data);
  assert.equal(resolveChokepointPanelDataV1(chokepointId, chokeSummary.data, chokeDetail.data).detail?.chokepointId, chokepointId);
  assert.equal(resolveChokepointPanelDataV1("missing-choke", chokeSummary.data, chokeDetail.data).summary, null);
});

test("metric formatting preserves null and zero semantics", () => {
  assert.equal(formatEstimatedTons(null), "—");
  assert.equal(formatEstimatedTons(0), "0 t");
  assert.equal(formatVesselCalls(0), "0척");
  assert.equal(formatPercent(0), "0.0%");
  assert.equal(formatPercent(2.25), "+2.3%");
});

test("chart path keeps gaps and constant zero series visible", () => {
  assert.equal(buildNetworkChartPath([null, null]), "");
  assert.match(buildNetworkChartPath([0, 0, null, 0]), /^M0\.00,120\.00 L140\.00,120\.00 M420\.00,120\.00$/);
});
