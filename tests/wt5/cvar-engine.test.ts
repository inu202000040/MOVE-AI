import assert from "node:assert/strict";
import test from "node:test";

import {
  CVAR_ALPHA,
  CVAR_CANDIDATE_COUNT,
  CVAR_CSV_HEADER,
  CVAR_SCENARIO_COUNT,
  CVAR_TAIL_COUNT,
  CVAR_WEEKLY_CORRELATION,
  deriveRouteSeed,
  runCvarSimulation,
  selectKth,
  serializeRecommendedCvarCsv,
  type CvarProgress,
  type CvarSimulationInput,
} from "../../app/freight-risk/allocation";

const KNEI_INPUT: CvarSimulationInput = {
  current: 4_884,
  forecasts: [
    {
      horizonWeeks: 1,
      targetDate: "2026-08-10",
      point: 4_828.98,
      lower90: 4_482.47,
      upper90: 5_175.49,
    },
    {
      horizonWeeks: 2,
      targetDate: "2026-08-17",
      point: 4_791.32,
      lower90: 4_227.22,
      upper90: 5_355.43,
    },
    {
      horizonWeeks: 3,
      targetDate: "2026-08-24",
      point: 4_767.23,
      lower90: 3_935.75,
      upper90: 5_598.72,
    },
    {
      horizonWeeks: 4,
      targetDate: "2026-08-31",
      point: 4_753.74,
      lower90: 3_439.8,
      upper90: 6_067.68,
    },
  ],
  selectedHorizon: 1,
  fixed: 4_998,
  volume: 1_000,
  alpha: CVAR_ALPHA,
  riskWeight: 1,
  seed: 2_401_817_482,
  rho: CVAR_WEEKLY_CORRELATION,
};

const progress: CvarProgress[] = [];
const result = runCvarSimulation(KNEI_INPUT, (event) => progress.push(event));

function assertNear(actual: number, expected: number, tolerance = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("freezes all approved route seeds", () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        "KUWI", "KUEI", "KNEI", "KMDI", "KMEI", "KAUI", "KLEI",
        "KLWI", "KSAI", "KWAI", "KCI", "KJI", "KSEI",
      ].map((route) => [route, deriveRouteSeed(route)]),
    ),
    {
      KUWI: 2_401_824_767,
      KUEI: 2_401_824_209,
      KNEI: 2_401_817_482,
      KMDI: 2_401_816_490,
      KMEI: 2_401_816_521,
      KAUI: 2_401_805_485,
      KLEI: 2_401_815_560,
      KLWI: 2_401_816_118,
      KSAI: 2_401_822_163,
      KWAI: 2_401_826_007,
      KCI: 2_294_234_958,
      KJI: 2_294_235_175,
      KSEI: 2_401_822_287,
    },
  );
});

test("reproduces the 100,000-path KNEI golden", () => {
  assert.equal(result.spots.length, CVAR_SCENARIO_COUNT);
  assert.equal(result.results.length, CVAR_CANDIDATE_COUNT);
  assert.equal(result.tailCount, CVAR_TAIL_COUNT);
  assert.equal(result.samplePaths.length, 250);
  assert.equal(
    result.samplePaths.filter((path) => path.selectedOutsidePi90).length,
    33,
  );

  assertNear(result.meanSpot, 4_830.245747781964);
  assert.equal(result.best.share, 13);
  assert.equal(result.best.spotShare, 87);
  assertNear(result.best.expected, 4_852_053.80057031);
  assertNear(result.best.averageUnitCost, 4_852.05380057);
  assertNear(result.best.cvar, 176_052.3334165);
  assertNear(result.best.upward, 171_726.88913581);
  assertNear(result.best.downward, 4_325.4442807);
  assertNear(result.best.objective, 5_028_106.13398681);
  assertNear(result.best.upward + result.best.downward, result.best.cvar);

  [
    4_795.12639911,
    5_142.99375507,
    4_581.69753348,
    5_003.27600658,
    4_933.67719446,
  ].forEach((expected, index) => assertNear(result.spots[index], expected));
  assertNear(Math.min(...result.spots), 3_863.81009913);
  assertNear(Math.max(...result.spots), 5_752.29912743);
});

test("matches the approved candidate anchors", () => {
  const anchors = [
    [0, 4_830_245.747782, 201_847.179944, 201_847.179944, 0, 5_032_092.927726],
    [10, 4_847_021.173004, 181_667.031802, 181_569.615701, 97.4161, 5_028_688.204805],
    [20, 4_863_796.598226, 170_856.73643, 133_240.936076, 37_615.800354, 5_034_653.334656],
    [50, 4_914_122.873891, 269_864.52262, 4_287.546101, 265_576.976518, 5_183_987.396511],
    [100, 4_998_000, 538_732.694131, 0, 538_732.694131, 5_536_732.694131],
  ] as const;

  for (const [share, expected, cvar, upward, downward, objective] of anchors) {
    const candidate = result.results[share];
    assert.equal(candidate.share, share);
    assertNear(candidate.expected, expected);
    assertNear(candidate.cvar, cvar);
    assertNear(candidate.upward, upward);
    assertNear(candidate.downward, downward);
    assertNear(candidate.objective, objective);
  }
});

test("uses deterministic monotonic progress milestones", () => {
  assert.deepEqual(progress, [
    { stage: "paths", percent: 2 },
    { stage: "paths", percent: 8 },
    { stage: "paths", percent: 13 },
    { stage: "paths", percent: 19 },
    { stage: "paths", percent: 24 },
    { stage: "paths", percent: 28 },
    { stage: "candidates", percent: 28 },
    { stage: "candidates", percent: 35 },
    { stage: "candidates", percent: 42 },
    { stage: "candidates", percent: 49 },
    { stage: "candidates", percent: 56 },
    { stage: "candidates", percent: 63 },
    { stage: "candidates", percent: 70 },
    { stage: "candidates", percent: 77 },
    { stage: "candidates", percent: 84 },
    { stage: "candidates", percent: 91 },
    { stage: "candidates", percent: 98 },
  ]);
});

test("quickselect handles tied threshold values", () => {
  const values = new Float64Array([5, 1, 5, 2, 5, 3, 4]);
  assert.equal(selectKth(values, 4), 5);
});

test("serializes the recommended 100,000-row CSV byte contract", () => {
  const artifact = serializeRecommendedCvarCsv("KNEI", KNEI_INPUT, result);
  assert.equal(artifact.filename, "cvar-simulation-KNEI-1w-fixed-13pct.csv");
  assert.equal(artifact.content.charCodeAt(0), 0xfeff);
  assert.equal(artifact.content.includes("\r"), false);
  const lines = artifact.content.slice(1).split("\n");
  assert.equal(lines.length, 100_001);
  assert.equal(lines[0], CVAR_CSV_HEADER);
  assert.match(lines[1], /^1,KNEI,1,13,87,/u);
  assert.match(lines.at(-1) ?? "", /^100000,KNEI,1,13,87,/u);
});
