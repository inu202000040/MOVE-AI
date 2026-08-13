import {
  MODEL_REGISTRY,
  defaultParameters,
  type CoverageV1,
  type EightTuple,
  type FourTuple,
  type ModelMetricInputV1,
  type ModelProjectionV1,
  type RiskModelId,
  type TuneEvaluationHorizonV1,
  type TuneForecastV1,
  type TuneMetricV1,
  type TuneSuccessV1,
} from "../../app/freight-risk/models/core";

const TARGET_DATES = ["2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"] as const;

const KNEI_ONE_WEEK = {
  naive: { mapePct: 5.08, mse: 40_335, mase: 0.051, hits: 48 },
  sarimax: { mapePct: 3.60, mse: 22_818.49, mase: 0.037, hits: 46 },
  lightgbm: { mapePct: 5.83, mse: 52_428, mase: 0.058, hits: 49 },
  xgboost: { mapePct: 5.42, mse: 45_024, mase: 0.053, hits: 50 },
  random_forest: { mapePct: 5.94, mse: 45_700, mase: 0.057, hits: 51 },
  prophet: { mapePct: 12.01, mse: 194_618, mase: 0.121, hits: 50 },
  timesfm: { mapePct: 3.70, mse: 22_498.01, mase: 0.038, hits: 46 },
  chronos: { mapePct: 6.49, mse: 62_842, mase: 0.060, hits: 46 },
} as const satisfies Readonly<Record<RiskModelId, {
  readonly mapePct: number;
  readonly mse: number;
  readonly mase: number;
  readonly hits: number;
}>>;

const UNIT_POINTS: Readonly<Record<RiskModelId, number>> = {
  naive: 103,
  sarimax: 97,
  lightgbm: 100,
  xgboost: 104,
  random_forest: 96,
  prophet: 101,
  timesfm: 99,
  chronos: 100,
};

function coverage(hits: number): CoverageV1 {
  return {
    pct: 100 * hits / 52,
    hits,
    total: 52,
    sampleSize: 52,
    target: 0.9,
    intervalMethod: "online-absolute-error-conformal",
  };
}

export function makeBaselineModels(): EightTuple<ModelProjectionV1> {
  return MODEL_REGISTRY.map((definition): ModelProjectionV1 => {
    const golden = KNEI_ONE_WEEK[definition.id];
    const forecasts = TARGET_DATES.map((targetDate, index) => {
      const point = UNIT_POINTS[definition.id] + index;
      return { horizonWeeks: (index + 1) as 1 | 2 | 3 | 4, targetDate, point, lower90: point - 10, upper90: point + 10 };
    }) as unknown as FourTuple<ModelProjectionV1["forecasts"][number]>;
    const metricsByHorizon = TARGET_DATES.map((_, index): ModelMetricInputV1 => ({
      horizonWeeks: (index + 1) as 1 | 2 | 3 | 4,
      mapePct: golden.mapePct + index,
      mse: golden.mse * (index + 1),
      rmse: Math.sqrt(golden.mse * (index + 1)),
      mase: golden.mase + index * 0.01,
      coverage: coverage(golden.hits),
    })) as unknown as FourTuple<ModelMetricInputV1>;
    return {
      modelId: definition.id,
      modelName: definition.name,
      modelVersion: definition.baselineVersion,
      forecastSource: "baseline",
      tuningRunHash: null,
      evaluationProtocol: "glovis-freight-risk/v3|expanding|52|seasonal-naive-52-fixed|online-absolute-error-conformal",
      forecasts,
      metricsByHorizon,
    };
  }) as unknown as EightTuple<ModelProjectionV1>;
}

function isoDateFromOffset(offsetWeeks: number): string {
  const date = new Date("2024-01-08T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offsetWeeks * 7);
  return date.toISOString().slice(0, 10);
}

export function makeTuneSuccess(modelId: RiskModelId = "sarimax"): TuneSuccessV1 {
  const forecasts = TARGET_DATES.map((date, index): TuneForecastV1 => ({
    horizon: (index + 1) as 1 | 2 | 3 | 4,
    date,
    value: 100 + index,
    lower90: 90 + index,
    upper90: 110 + index,
  })) as unknown as FourTuple<TuneForecastV1>;
  const metricsByHorizon = TARGET_DATES.map((_, index): TuneMetricV1 => ({
    horizon: (index + 1) as 1 | 2 | 3 | 4,
    mapePct: 0,
    mse: 0,
    rmse: 0,
    mase: 0,
    coverage90Pct: 100,
    hits: 52,
    total: 52,
    sampleSize: 52,
  })) as unknown as FourTuple<TuneMetricV1>;
  const evaluationByHorizon = TARGET_DATES.map((_, index): TuneEvaluationHorizonV1 => ({
    horizon: (index + 1) as 1 | 2 | 3 | 4,
    records: Array.from({ length: 52 }, (__, recordIndex) => ({
      forecastOrigin: isoDateFromOffset(recordIndex),
      targetDate: isoDateFromOffset(recordIndex + index + 1),
      predicted: 100,
      actual: 100,
      difference: 0,
      absoluteError: 0,
      apePct: 0,
      lower90: 90,
      upper90: 110,
      covered90: true,
    })),
  })) as unknown as FourTuple<TuneEvaluationHorizonV1>;
  return {
    status: "success",
    routeCode: "KNEI",
    modelId,
    modelVersion: `${MODEL_REGISTRY.find(({ id }) => id === modelId)?.baselineVersion ?? "unit"}-tuned`,
    forecastOrigin: "2026-08-03",
    maseProtocol: "seasonal-naive-52-fixed",
    trainingWindow: "expanding",
    evaluationOrigins: 52,
    parameters: defaultParameters(modelId),
    forecasts,
    metricsByHorizon,
    evaluationByHorizon,
    elapsedMs: 1_234,
    methodologyKo: "52개 rolling-origin 외부평가",
  };
}

export function makeObservationDates(): readonly string[] {
  const finalDate = new Date("2026-08-03T00:00:00Z");
  return Array.from({ length: 187 }, (_, index) => {
    const date = new Date(finalDate);
    date.setUTCDate(finalDate.getUTCDate() - (186 - index) * 7);
    return date.toISOString().slice(0, 10);
  });
}
