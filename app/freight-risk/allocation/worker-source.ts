// Keep this program fully self-contained. The production bundler may rename module
// bindings, so a Blob worker must never depend on Function#toString output.
export const CVAR_WORKER_SOURCE = String.raw`"use strict";
const HORIZONS = [1, 2, 3, 4];
const RISK_WEIGHTS = [0.5, 1, 2];

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function createMulberry32(seed) {
  let state = seed >>> 0;
  return function nextUniform() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createStandardNormal(uniform) {
  return function nextNormal() {
    let first = 0;
    let second = 0;
    while (first === 0) first = uniform();
    while (second === 0) second = uniform();
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  };
}

function assertCvarSimulationInput(input) {
  if (!input || !Array.isArray(input.forecasts) || input.forecasts.length !== 4) {
    throw new TypeError("forecasts must contain horizons 1 through 4");
  }
  input.forecasts.forEach(function validateForecast(forecast, index) {
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
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) {
    throw new TypeError("seed must be a uint32 integer");
  }
}

function selectKth(values, target) {
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
    if (target < lower) right = lower - 1;
    else if (target > upper) left = upper + 1;
    else return pivot;
  }
  throw new Error("quickselect failed to resolve the target");
}

function economicLoss(spot, fixed, fixedShare, volume) {
  if (spot < fixed) return fixedShare * volume * (fixed - spot);
  return (1 - fixedShare) * volume * (spot - fixed);
}

function runCvarSimulation(input, onProgress) {
  assertCvarSimulationInput(input);
  const scenarioCount = 100000;
  const candidateCount = 101;
  const tailCount = 10000;
  const sampleCount = 250;
  const pi90Z = 1.645;
  const spotFloor = 1;
  const independentNoise = Math.sqrt(1 - input.rho * input.rho);
  const uniform = createMulberry32(input.seed);
  const normal = createStandardNormal(uniform);
  const spots = new Float64Array(scenarioCount);
  const samplePaths = [];
  const selectedIndex = input.selectedHorizon - 1;
  const selectedForecast = input.forecasts[selectedIndex];
  let spotSum = 0;

  if (onProgress) onProgress({ stage: "paths", percent: 2 });
  for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
    if (scenario === 20000 && onProgress) onProgress({ stage: "paths", percent: 8 });
    else if (scenario === 40000 && onProgress) onProgress({ stage: "paths", percent: 13 });
    else if (scenario === 60000 && onProgress) onProgress({ stage: "paths", percent: 19 });
    else if (scenario === 80000 && onProgress) onProgress({ stage: "paths", percent: 24 });

    const points = [input.current, 0, 0, 0, 0];
    let previousShock = 0;
    for (let horizonIndex = 0; horizonIndex < 4; horizonIndex += 1) {
      const independentShock = normal();
      const shock = horizonIndex === 0
        ? independentShock
        : input.rho * previousShock + independentNoise * independentShock;
      previousShock = shock;
      const forecast = input.forecasts[horizonIndex];
      const downwardScale = Math.max(1, (forecast.point - forecast.lower90) / pi90Z);
      const upwardScale = Math.max(1, (forecast.upper90 - forecast.point) / pi90Z);
      const scale = shock < 0 ? downwardScale : upwardScale;
      points[horizonIndex + 1] = Math.max(spotFloor, forecast.point + shock * scale);
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

  if (onProgress) onProgress({ stage: "paths", percent: 28 });
  const meanSpot = spotSum / scenarioCount;
  const losses = new Float64Array(scenarioCount);
  const results = [];
  let best = null;

  for (let share = 0; share < candidateCount; share += 1) {
    if (share % 10 === 0 && onProgress) {
      onProgress({
        stage: "candidates",
        percent: 28 + Math.round(70 * (share / 100)),
      });
    }
    const fixedShare = share / 100;
    for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
      losses[scenario] = economicLoss(spots[scenario], input.fixed, fixedShare, input.volume);
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
        if (spot < input.fixed) downwardSum += loss;
        else upwardSum += loss;
      }
    }
    if (selectedTail < tailCount) {
      for (let scenario = 0; scenario < scenarioCount && selectedTail < tailCount; scenario += 1) {
        const spot = spots[scenario];
        const loss = economicLoss(spot, input.fixed, fixedShare, input.volume);
        if (loss === threshold) {
          selectedTail += 1;
          if (spot < input.fixed) downwardSum += loss;
          else upwardSum += loss;
        }
      }
    }
    if (selectedTail !== tailCount) {
      throw new Error("CVaR tail selection did not produce exactly 10,000 paths");
    }

    const expected = input.volume * (
      fixedShare * input.fixed + (1 - fixedShare) * meanSpot
    );
    const upward = upwardSum / tailCount;
    const downward = downwardSum / tailCount;
    const cvar = upward + downward;
    const candidate = {
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
    if (best === null || candidate.objective < best.objective) best = candidate;
  }
  if (best === null) throw new Error("candidate evaluation produced no result");
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

self.onmessage = function onCvarMessage(event) {
  const message = event.data;
  if (!message || message.type !== "run" || !Number.isInteger(message.sequence)) return;
  const sequence = message.sequence;
  const result = runCvarSimulation(message.input, function report(progress) {
    self.postMessage({
      type: "progress",
      sequence,
      stage: progress.stage,
      percent: progress.percent,
    });
  });
  self.postMessage({ type: "done", sequence, result }, [result.spots.buffer]);
};`;
