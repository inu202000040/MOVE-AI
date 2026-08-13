import assert from "node:assert/strict";
import test from "node:test";

import {
  CVAR_ALPHA,
  CVAR_WEEKLY_CORRELATION,
  calculateSpotExceedProbability,
  createComparisonGeometry,
  createPercentileRows,
  createSpectrumGeometry,
  publishAllocationRoute,
  riskBarWidth,
  type CvarCandidateResult,
  type CvarSimulationInput,
} from "../../app/freight-risk/allocation";

const INPUT: CvarSimulationInput = {
  current: 4,
  forecasts: [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks: horizonWeeks as 1 | 2 | 3 | 4,
    targetDate: `2026-08-${String(horizonWeeks + 9).padStart(2, "0")}`,
    point: 4,
    lower90: 2,
    upper90: 6,
  })),
  selectedHorizon: 1,
  fixed: 3,
  volume: 10,
  alpha: CVAR_ALPHA,
  riskWeight: 1,
  seed: 1,
  rho: CVAR_WEEKLY_CORRELATION,
};

function candidate(share: number, expected: number, cvar: number): CvarCandidateResult {
  return {
    share,
    spotShare: 100 - share,
    expected,
    averageUnitCost: expected / 10,
    cvar,
    upward: cvar,
    downward: 0,
    objective: expected + cvar,
  };
}

test("freezes comparison scale, five ticks, and non-overlapping labels", () => {
  const geometry = createComparisonGeometry(INPUT.forecasts[0], INPUT.fixed);
  assert.equal(geometry.ticks.length, 5);
  assert.ok(geometry.domainMin <= 2);
  assert.ok(geometry.domainMax >= 6);
  assert.deepEqual(geometry.series.map((item) => item.name), [
    "상한", "점예측", "하한", "고정운임",
  ]);
  const labelYs = geometry.series.map((item) => item.labelY).sort((left, right) => left - right);
  for (let index = 1; index < labelYs.length; index += 1) {
    assert.ok(labelYs[index] - labelYs[index - 1] >= 25);
  }
});

test("keeps spectrum monetary and CVaR domains separate with a five-point band", () => {
  const results = [candidate(0, 100, 30), candidate(13, 110, 20), candidate(100, 200, 50)];
  const geometry = createSpectrumGeometry(results, 13);
  assert.ok(geometry.leftMin < 100);
  assert.ok(geometry.leftMax > 250);
  assert.ok(Math.abs(geometry.rightMax - 56) < Number.EPSILON * 64);
  assert.equal(geometry.recommendationBandStart, 10.5);
  assert.equal(geometry.recommendationBandEnd, 15.5);
});

test("uses strict Spot greater-than for the exceed probability", () => {
  assert.equal(
    calculateSpotExceedProbability(new Float64Array([2, 3, 3.000_001, 4]), 3),
    0.5,
  );
  assert.equal(calculateSpotExceedProbability(new Float64Array(), 3), 0);
});

test("uses nearest-rank indices and the frozen percentile directions", () => {
  const best = candidate(50, 0, 0);
  const rows = createPercentileRows(new Float64Array([5, 1, 4, 2, 3]), INPUT, best);
  assert.deepEqual(rows.map((row) => row.percentile), [1, 5, 10, 25, 50, 75, 90, 95, 99]);
  assert.equal(rows[0].spot, 1);
  assert.equal(rows[4].spot, 3);
  assert.equal(rows[4].direction, "가격 동일");
  assert.equal(rows.at(-1)?.spot, 5);
  assert.equal(rows.at(-1)?.direction, "Spot 상승손실");
});

test("preserves true risk ratios while applying only the visual minimum", () => {
  assert.equal(riskBarWidth(0, 100), 0);
  assert.equal(riskBarWidth(1, 100), 4);
  assert.equal(riskBarWidth(40, 100), 40);
});

test("publishes only canonical routes through the parent-owned seam", () => {
  const routes: string[] = [];
  assert.equal(publishAllocationRoute("KNEI", (route) => routes.push(route)), true);
  assert.equal(publishAllocationRoute("INVALID", (route) => routes.push(route)), false);
  assert.equal(publishAllocationRoute("KMEI", undefined), false);
  assert.deepEqual(routes, ["KNEI"]);
});
