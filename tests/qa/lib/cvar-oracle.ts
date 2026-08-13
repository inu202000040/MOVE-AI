import assert from "node:assert/strict";

import { sha256 } from "./canonical-json";

export interface ForecastInput {
  readonly horizonWeeks: number;
  readonly point: number;
  readonly lower90: number;
  readonly upper90: number;
}

export interface CvarConfig {
  readonly scenarioCount: number;
  readonly candidateCount: number;
  readonly alpha: number;
  readonly tailCount: number;
  readonly weeklyCorrelation: number;
  readonly pi90Z: number;
  readonly volume: number;
  readonly spotFloor: number;
  readonly riskWeight: number;
}

export function routeSeed(routeId: string): number {
  let accumulator = 20_260_803;
  for (let index = 0; index < routeId.length; index += 1) {
    accumulator = (Math.imul(accumulator, 31) + routeId.charCodeAt(index)) | 0;
  }
  return accumulator >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normal(random: () => number): number {
  let first = random();
  while (first === 0) first = random();
  let second = random();
  while (second === 0) second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

export function computeCvarGolden(forecasts: readonly ForecastInput[], seed: number, config: CvarConfig) {
  assert.deepEqual(forecasts.map((forecast) => forecast.horizonWeeks), [1, 2, 3, 4]);
  assert.equal(config.candidateCount, 101);
  assert.equal(config.tailCount, Math.round(config.scenarioCount * (1 - config.alpha)));
  const random = mulberry32(seed);
  const independentCoefficient = Math.sqrt(1 - config.weeklyCorrelation ** 2);
  const spots = new Float64Array(config.scenarioCount);
  const firstThreePaths: number[][] = [];

  for (let scenario = 0; scenario < config.scenarioCount; scenario += 1) {
    let latent = 0;
    const path: number[] = [];
    for (let horizon = 0; horizon < forecasts.length; horizon += 1) {
      const independent = normal(random);
      latent = horizon === 0
        ? independent
        : config.weeklyCorrelation * latent + independentCoefficient * independent;
      const forecast = forecasts[horizon];
      const down = Math.max(1, (forecast.point - forecast.lower90) / config.pi90Z);
      const up = Math.max(1, (forecast.upper90 - forecast.point) / config.pi90Z);
      path.push(Math.max(config.spotFloor, forecast.point + latent * (latent < 0 ? down : up)));
    }
    spots[scenario] = path[0];
    if (scenario < 3) firstThreePaths.push(path);
  }

  const fixed = Math.round(forecasts[0].point * 1.035);
  const meanSpot = spots.reduce((sum, spot) => sum + spot, 0) / spots.length;
  const results = [];
  for (let percentage = 0; percentage <= 100; percentage += 1) {
    const fixedShare = percentage / 100;
    const losses = Array.from(spots, (spot, scenario) => ({
      scenario,
      spot,
      loss: spot < fixed
        ? fixedShare * config.volume * (fixed - spot)
        : (1 - fixedShare) * config.volume * (spot - fixed),
    }));
    const threshold = losses.map((row) => row.loss).sort((left, right) => right - left)[config.tailCount - 1];
    const tail = losses.filter((row) => row.loss > threshold);
    for (const row of losses) {
      if (tail.length === config.tailCount) break;
      if (row.loss === threshold) tail.push(row);
    }
    assert.equal(tail.length, config.tailCount);
    const sums = tail.reduce((accumulator, row) => {
      accumulator.total += row.loss;
      if (row.spot < fixed) accumulator.downward += row.loss;
      else accumulator.upward += row.loss;
      return accumulator;
    }, { total: 0, upward: 0, downward: 0 });
    const expectedCost = config.volume * (fixedShare * fixed + (1 - fixedShare) * meanSpot);
    const cvar90 = sums.total / config.tailCount;
    results.push({
      fixedSharePct: percentage,
      expectedCost,
      cvar90,
      upwardCvar90: sums.upward / config.tailCount,
      downwardCvar90: sums.downward / config.tailCount,
      objective: expectedCost + config.riskWeight * cvar90,
    });
  }
  return {
    fixed,
    meanSpot,
    firstThreePaths,
    results,
    best: results.reduce((winner, result) => result.objective < winner.objective ? result : winner),
    resultsSha256: sha256(JSON.stringify(results)),
  };
}
