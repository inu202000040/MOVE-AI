import assert from "node:assert/strict";
import test from "node:test";

import { computeCvarGolden, routeSeed } from "./lib/cvar-oracle";
import { readGoldenManifest } from "./lib/manifest";

const manifest = await readGoldenManifest();

function almostEqual(actual: number, expected: number, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("route seed oracle reproduces all 13 approved uint32 seeds", () => {
  for (const [routeId, expected] of Object.entries(manifest.cvar.routeSeeds)) {
    assert.equal(routeSeed(routeId), expected);
  }
});

test("100,000-scenario, 101-candidate KNEI CVaR golden is deterministic", () => {
  const golden = manifest.cvar.kneiGolden;
  const result = computeCvarGolden(manifest.model.knei.forecasts, manifest.cvar.routeSeeds.KNEI, manifest.cvar.config);
  assert.equal(result.fixed, golden.fixed);
  almostEqual(result.meanSpot, golden.meanSpot);
  assert.deepEqual(result.firstThreePaths, golden.firstThreePaths);
  assert.deepEqual(result.best, golden.best);
  assert.deepEqual([result.results[0], result.results[13], result.results[50], result.results[100]], golden.checkpoints);
  assert.equal(result.resultsSha256, golden.resultsSha256);
  assert.equal(result.best.fixedSharePct, 13);
  for (const candidate of result.results) {
    almostEqual(candidate.cvar90, candidate.upwardCvar90 + candidate.downwardCvar90, 1e-6);
  }
});
