import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKET_POINTS,
  PERIOD_END,
  ROUTE_FORECASTS,
  ROUTE_SERIES,
} from "../../app/freight-risk/dashboard/fixture";
import { ROUTE_IDS } from "../../app/contracts";

test("approved Dashboard fixture carries every route and 187 observations", () => {
  assert.equal(ROUTE_IDS.length, 13);
  for (const routeId of ROUTE_IDS) {
    const points = ROUTE_SERIES[routeId];
    assert.equal(points.length, 187, routeId);
    assert.equal(points[0].date, "2022-11-07");
    assert.equal(points.at(-1)?.date, PERIOD_END);
    assert.equal(ROUTE_FORECASTS[routeId].forecasts.length, 4);
    assert.equal(ROUTE_FORECASTS[routeId].metrics.length, 4);
  }
});

test("KNEI smoke values and metric lineage stay bound to the approved data pack", () => {
  const knei = ROUTE_FORECASTS.KNEI;
  assert.equal(ROUTE_SERIES.KNEI.at(-1)?.value, 4_884);
  assert.equal(knei.model.id, "sarimax");
  assert.deepEqual(
    knei.forecasts.map(({ horizon, point, lower, upper }) => ({ horizon, point, lower, upper })),
    [
      { horizon: 1, point: 4_828.98, lower: 4_482.47, upper: 5_175.49 },
      { horizon: 2, point: 4_791.32, lower: 4_227.22, upper: 5_355.43 },
      { horizon: 3, point: 4_767.23, lower: 3_935.75, upper: 5_598.72 },
      { horizon: 4, point: 4_753.74, lower: 3_439.8, upper: 6_067.68 },
    ],
  );
  assert.deepEqual(
    knei.metrics.map(({ horizon, coverageHits, coverageTotal, coveragePct }) => ({
      horizon,
      coverageHits,
      coverageTotal,
      coveragePct,
    })),
    [
      { horizon: 1, coverageHits: 46, coverageTotal: 52, coveragePct: 88.5 },
      { horizon: 2, coverageHits: 49, coverageTotal: 52, coveragePct: 94.2 },
      { horizon: 3, coverageHits: 48, coverageTotal: 52, coveragePct: 92.3 },
      { horizon: 4, coverageHits: 49, coverageTotal: 52, coveragePct: 94.2 },
    ],
  );
});

test("market fixture carries only approved observed values", () => {
  assert.ok(MARKET_POINTS.fx.length > 20);
  assert.ok(MARKET_POINTS.oil.length > 20);
  assert.ok(MARKET_POINTS.bunker.length > 20);
  assert.equal(MARKET_POINTS.harpex.length, 3);
});
