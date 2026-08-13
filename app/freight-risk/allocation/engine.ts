export const CVAR_SCENARIO_COUNT = 100_000;
export const CVAR_CANDIDATE_COUNT = 101;
export const CVAR_ALPHA = 0.9;
export const CVAR_TAIL_COUNT = 10_000;
export const CVAR_WEEKLY_CORRELATION = 0.75;
export const CVAR_PI90_Z = 1.645;
export const CVAR_SAMPLE_PATH_COUNT = 250;
export const CVAR_SPOT_FLOOR = 1;

export type HorizonWeeks = 1 | 2 | 3 | 4;
export type RiskWeight = 0.5 | 1 | 2;
export type CvarProgressStage = "paths" | "candidates";

export interface CvarForecast {
  readonly horizonWeeks: HorizonWeeks;
  readonly targetDate: string;
  readonly point: number;
  readonly lower90: number;
  readonly upper90: number;
}

export interface CvarSimulationInput {
  readonly forecasts: readonly CvarForecast[];
  readonly current: number;
  readonly selectedHorizon: HorizonWeeks;
  readonly fixed: number;
  readonly volume: number;
  readonly alpha: number;
  readonly riskWeight: RiskWeight;
  readonly seed: number;
  readonly rho: number;
}

export interface CvarProgress {
  readonly stage: CvarProgressStage;
  readonly percent: number;
}

export interface CvarCandidateResult {
  readonly share: number;
  readonly spotShare: number;
  readonly expected: number;
  readonly averageUnitCost: number;
  readonly cvar: number;
  readonly upward: number;
  readonly downward: number;
  readonly objective: number;
}

export interface CvarSamplePath {
  readonly scenario: number;
  readonly points: readonly [number, number, number, number, number];
  readonly selectedOutsidePi90: boolean;
}

export interface CvarSimulationResult {
  readonly results: readonly CvarCandidateResult[];
  readonly best: CvarCandidateResult;
  readonly meanSpot: number;
  readonly baseline: number;
  readonly riskWeight: RiskWeight;
  readonly tailCount: number;
  readonly spots: Float64Array;
  readonly samplePaths: readonly CvarSamplePath[];
  readonly rho: number;
}

const HORIZONS: readonly HorizonWeeks[] = [1, 2, 3, 4];
const RISK_WEIGHTS: readonly RiskWeight[] = [0.5, 1, 2];

export function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function deriveRouteSeed(routeId: string): number {
  let accumulator = 20_260_803;
  for (let index = 0; index < routeId.length; index += 1) {
    accumulator = Math.imul(accumulator, 31) + routeId.charCodeAt(index);
  }
  return accumulator >>> 0;
}

export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createStandardNormal(
  uniform: () => number,
): () => number {
  return (): number => {
    let first = 0;
    let second = 0;
    while (first === 0) {
      first = uniform();
    }
    while (second === 0) {
      second = uniform();
    }
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  };
}

export function assertCvarSimulationInput(
  input: CvarSimulationInput,
): void {
  if (input.forecasts.length !== 4) {
    throw new TypeError("forecasts must contain horizons 1 through 4");
  }
  input.forecasts.forEach((forecast, index) => {
    if (forecast.horizonWeeks !== HORIZONS[index]) {
      throw new TypeError("forecasts must be ordered horizons 1 through 4");
    }
    if (
      !isFinitePositive(forecast.point) ||
      !isFinitePositive(forecast.lower90) ||
      !isFinitePositive(forecast.upper90) ||
      forecast.lower90 > forecast.point ||
      forecast.point > forecast.upper90
    ) {
      throw new TypeError("forecast interval must satisfy lower90 <= point <= upper90");
    }
  });
  if (!isFinitePositive(input.current)) {
    throw new TypeError("current must be a finite positive number");
  }
  if (!isFinitePositive(input.fixed)) {
    throw new TypeError("fixed must be a finite positive number");
  }
  if (!isFinitePositive(input.volume)) {
    throw new TypeError("volume must be a finite positive number");
  }
  if (!HORIZONS.includes(input.selectedHorizon)) {
    throw new TypeError("selectedHorizon must be between 1 and 4");
  }
  if (input.alpha !== 0.9) {
    throw new TypeError("alpha must be exactly 0.9");
  }
  if (input.rho !== 0.75) {
    throw new TypeError("rho must be exactly 0.75");
  }
  if (!RISK_WEIGHTS.includes(input.riskWeight)) {
    throw new TypeError("riskWeight must be 0.5, 1, or 2");
  }
  if (
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 0xffff_ffff
  ) {
    throw new TypeError("seed must be a uint32 integer");
  }
}

export function selectKth(values: Float64Array, target: number): number {
  if (!Number.isInteger(target) || target < 0 || target >= values.length) {
    throw new RangeError("target is outside the input array");
  }

  let left = 0;
  let right = values.length - 1;
  while (left <= right) {
    const pivot = values[(left + right) >>> 1];
    let lower = left;
    let index = left;
    let upper = right;

    while (index <= upper) {
      const value = values[index];
      if (value < pivot) {
        const swap = values[lower];
        values[lower] = value;
        values[index] = swap;
        lower += 1;
        index += 1;
      } else if (value > pivot) {
        const swap = values[upper];
        values[upper] = value;
        values[index] = swap;
        upper -= 1;
      } else {
        index += 1;
      }
    }

    if (target < lower) {
      right = lower - 1;
    } else if (target > upper) {
      left = upper + 1;
    } else {
      return pivot;
    }
  }

  throw new Error("quickselect failed to resolve the target");
}

export function economicLoss(
  spot: number,
  fixed: number,
  fixedShare: number,
  volume: number,
): number {
  if (spot < fixed) {
    return fixedShare * volume * (fixed - spot);
  }
  return (1 - fixedShare) * volume * (spot - fixed);
}

export function runCvarSimulation(
  input: CvarSimulationInput,
  onProgress?: (progress: CvarProgress) => void,
): CvarSimulationResult {
  assertCvarSimulationInput(input);

  const scenarioCount = 100_000;
  const candidateCount = 101;
  const tailCount = 10_000;
  const sampleCount = 250;
  const pi90Z = 1.645;
  const spotFloor = 1;
  const independentNoise = Math.sqrt(1 - input.rho * input.rho);
  const uniform = createMulberry32(input.seed);
  const normal = createStandardNormal(uniform);
  const spots = new Float64Array(scenarioCount);
  const samplePaths: CvarSamplePath[] = [];
  const selectedIndex = input.selectedHorizon - 1;
  const selectedForecast = input.forecasts[selectedIndex];
  let spotSum = 0;

  onProgress?.({ stage: "paths", percent: 2 });

  for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
    if (scenario === 20_000) {
      onProgress?.({ stage: "paths", percent: 8 });
    } else if (scenario === 40_000) {
      onProgress?.({ stage: "paths", percent: 13 });
    } else if (scenario === 60_000) {
      onProgress?.({ stage: "paths", percent: 19 });
    } else if (scenario === 80_000) {
      onProgress?.({ stage: "paths", percent: 24 });
    }

    const points: [number, number, number, number, number] = [
      input.current,
      0,
      0,
      0,
      0,
    ];
    let previousShock = 0;
    for (let horizonIndex = 0; horizonIndex < 4; horizonIndex += 1) {
      const independentShock = normal();
      const shock =
        horizonIndex === 0
          ? independentShock
          : input.rho * previousShock + independentNoise * independentShock;
      previousShock = shock;

      const forecast = input.forecasts[horizonIndex];
      const downwardScale = Math.max(
        1,
        (forecast.point - forecast.lower90) / pi90Z,
      );
      const upwardScale = Math.max(
        1,
        (forecast.upper90 - forecast.point) / pi90Z,
      );
      const scale = shock < 0 ? downwardScale : upwardScale;
      points[horizonIndex + 1] = Math.max(
        spotFloor,
        forecast.point + shock * scale,
      );
    }

    const selectedSpot = points[input.selectedHorizon];
    spots[scenario] = selectedSpot;
    spotSum += selectedSpot;

    if (scenario < sampleCount) {
      samplePaths.push({
        scenario: scenario + 1,
        points,
        selectedOutsidePi90:
          selectedSpot < selectedForecast.lower90 ||
          selectedSpot > selectedForecast.upper90,
      });
    }
  }

  onProgress?.({ stage: "paths", percent: 28 });

  const meanSpot = spotSum / scenarioCount;
  const losses = new Float64Array(scenarioCount);
  const results: CvarCandidateResult[] = [];
  let best: CvarCandidateResult | null = null;

  for (let share = 0; share < candidateCount; share += 1) {
    if (share % 10 === 0) {
      onProgress?.({
        stage: "candidates",
        percent: 28 + Math.round(70 * (share / 100)),
      });
    }

    const fixedShare = share / 100;
    for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
      losses[scenario] = economicLoss(
        spots[scenario],
        input.fixed,
        fixedShare,
        input.volume,
      );
    }

    const threshold = selectKth(losses, scenarioCount - tailCount);
    let selectedTail = 0;
    let upwardSum = 0;
    let downwardSum = 0;

    for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
      const spot = spots[scenario];
      const loss = economicLoss(spot, input.fixed, fixedShare, input.volume);
      if (loss > threshold) {
        selectedTail += 1;
        if (spot < input.fixed) {
          downwardSum += loss;
        } else {
          upwardSum += loss;
        }
      }
    }

    if (selectedTail < tailCount) {
      for (
        let scenario = 0;
        scenario < scenarioCount && selectedTail < tailCount;
        scenario += 1
      ) {
        const spot = spots[scenario];
        const loss = economicLoss(spot, input.fixed, fixedShare, input.volume);
        if (loss === threshold) {
          selectedTail += 1;
          if (spot < input.fixed) {
            downwardSum += loss;
          } else {
            upwardSum += loss;
          }
        }
      }
    }

    if (selectedTail !== tailCount) {
      throw new Error("CVaR tail selection did not produce exactly 10,000 paths");
    }

    const expected =
      input.volume *
      (fixedShare * input.fixed + (1 - fixedShare) * meanSpot);
    const upward = upwardSum / tailCount;
    const downward = downwardSum / tailCount;
    const cvar = upward + downward;
    const candidate: CvarCandidateResult = {
      share,
      spotShare: 100 - share,
      expected,
      averageUnitCost: expected / input.volume,
      cvar,
      upward,
      downward,
      objective: expected + input.riskWeight * cvar,
    };
    results.push(candidate);
    if (best === null || candidate.objective < best.objective) {
      best = candidate;
    }
  }

  if (best === null) {
    throw new Error("candidate evaluation produced no result");
  }

  return {
    results,
    best,
    meanSpot,
    baseline: input.volume * input.fixed,
    riskWeight: input.riskWeight,
    tailCount,
    spots,
    samplePaths,
    rho: input.rho,
  };
}
