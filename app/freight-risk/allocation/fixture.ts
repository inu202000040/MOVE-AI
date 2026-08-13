import type {
  RepresentativeDirection,
  RepresentativeMetricsV1,
  RepresentativeModelId,
  RepresentativeSelectionV1,
} from "./representative";

const KNEI_MODEL_PATHS = [
  ["naive", "Naive", "last-observation-v1", 4_884, 4_884, 4_884, 4_884],
  ["sarimax", "SARIMAX", "statsmodels-0.14.6", 4_828.98, 4_791.32, 4_767.23, 4_753.74],
  ["lightgbm", "LightGBM", "lightgbm-4.7.0", 4_728.06, 4_537.62, 5_073.39, 4_643.73],
  ["xgboost", "XGBoost", "xgboost-3.4.0", 4_647.04, 4_810.33, 4_671.69, 4_424.6],
  ["random_forest", "Random Forest", "scikit-learn-1.6.1", 4_701.08, 4_204.79, 4_337.34, 4_944.96],
  ["prophet", "Prophet", "prophet-1.3.0", 5_140.34, 5_252.27, 5_167.86, 4_841.74],
  ["timesfm", "TimesFM", "timesfm-2.0.2", 4_800.28, 4_675.18, 4_539.48, 4_401.22],
  ["chronos", "Chronos", "chronos-forecasting-2.3.1", 4_530.97, 4_328.23, 4_170.49, 4_037.41],
] as const;

const KNEI_FORECASTS = [
  { horizonWeeks: 1, targetDate: "2026-08-10", point: 4_828.98, lower90: 4_482.47, upper90: 5_175.49 },
  { horizonWeeks: 2, targetDate: "2026-08-17", point: 4_791.32, lower90: 4_227.22, upper90: 5_355.43 },
  { horizonWeeks: 3, targetDate: "2026-08-24", point: 4_767.23, lower90: 3_935.75, upper90: 5_598.72 },
  { horizonWeeks: 4, targetDate: "2026-08-31", point: 4_753.74, lower90: 3_439.8, upper90: 6_067.68 },
] as const;

const KNEI_METRICS = [
  [3.6, 22_818.49, 151.06, 0.037, 100, 98.59552494490214, 100, 99.53184164830071, 88.5, 46],
  [6.8, 68_438.82, 261.61, 0.067, 83.97058823529412, 72.7532999546164, 83.58208955223881, 80.10199258071644, 94.2, 49],
  [11.19, 181_485.66, 426.01, 0.111, 83.1099195710456, 69.14281822596892, 83.78378378378379, 78.67884052693277, 92.3, 48],
  [15.55, 342_939.33, 585.61, 0.157, 78.52090032154341, 62.814504244817876, 79.61783439490446, 73.65107965375525, 94.2, 49],
] as const;

function createMetrics(
  values: (typeof KNEI_METRICS)[number],
  index: number,
): RepresentativeMetricsV1 {
  return {
    horizonWeeks: (index + 1) as 1 | 2 | 3 | 4,
    mapePct: values[0],
    mse: values[1],
    rmse: values[2],
    mase: values[3],
    mapeScore: values[4],
    mseScore: values[5],
    maseScore: values[6],
    totalScore: values[7],
    coverage: {
      pct: values[8],
      hits: values[9],
      total: 52,
      sampleSize: 52,
      target: 0.9,
      intervalMethod: "rolling-origin empirical PI90",
    },
  };
}

function directionFor(changePct: number): RepresentativeDirection {
  return changePct >= 3 ? "up" : changePct <= -3 ? "down" : "flat";
}

export const KNEI_REPRESENTATIVE_SELECTION: RepresentativeSelectionV1 = {
  route: "KNEI",
  currentObservation: {
    date: "2026-08-03",
    value: 4_884,
    unit: "USD/FEU",
  },
  modelId: "sarimax",
  modelName: "SARIMAX",
  modelVersion: "statsmodels-0.14.6",
  score1w: 99.53184164830071,
  coverage1w: 88.5,
  selectionMode: "automatic",
  forecastSource: "baseline",
  tuningRunHash: null,
  evaluationProtocol: "rolling-origin-52-seasonal-naive-52-fixed-pi90",
  automaticChampion: {
    modelId: "sarimax",
    modelName: "SARIMAX",
    modelVersion: "statsmodels-0.14.6",
    score1w: 99.53184164830071,
  },
  representativeRevision: "rep-v1:a615fa0b9ffbcecc1ec48e724b896bdf8e2c3e33aca3ff8a4f880270a84495b4",
  forecasts: KNEI_FORECASTS,
  metricsByHorizon: KNEI_METRICS.map(createMetrics),
  modelAgreementByHorizon: KNEI_FORECASTS.map((forecast, index) => {
    const members = KNEI_MODEL_PATHS.map((model) => {
      const point = Number(model[index + 3]);
      const changePct = 100 * (point / 4_884 - 1);
      return {
        modelId: model[0] as RepresentativeModelId,
        modelName: model[1],
        modelVersion: model[2],
        forecastSource: "baseline" as const,
        tuningRunHash: null,
        point,
        changePct,
        direction: directionFor(changePct),
      };
    });
    const counts = members.reduce(
      (count, member) => ({ ...count, [member.direction]: count[member.direction] + 1 }),
      { up: 0, down: 0, flat: 0 },
    );
    return {
      horizonWeeks: forecast.horizonWeeks,
      thresholdPct: 3,
      ...counts,
      total: 8,
      members,
    };
  }),
};
