import { MODEL_IDS } from "../../app/freight-risk/dashboard/domain";

const MEMBER_POINTS = [104, 96, 102, 100, 110, 90, 105, 99] as const;

export function representativeFixture(): Record<string, unknown> {
  const forecasts = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    targetDate: `2026-08-${String(3 + horizonWeeks * 7).padStart(2, "0")}`,
    point: 96,
    lower90: 80 - horizonWeeks,
    upper90: 110 + horizonWeeks,
  }));
  const metricsByHorizon = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    mapePct: 8 + horizonWeeks,
    mse: 100 + horizonWeeks,
    rmse: 10 + horizonWeeks,
    mase: 0.9,
    mapeScore: 70,
    mseScore: 70,
    maseScore: 70,
    totalScore: 70,
    coverage: {
      pct: 90,
      hits: 45,
      total: 50,
      sampleSize: 52,
      target: 0.9,
      intervalMethod: "PI90",
    },
  }));
  const modelAgreementByHorizon = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    thresholdPct: 3,
    up: 3,
    down: 2,
    flat: 3,
    total: 8,
    members: MODEL_IDS.map((modelId, index) => {
      const point = MEMBER_POINTS[index];
      const changePct = point - 100;
      return {
        modelId,
        modelName: modelId === "sarimax" ? "SARIMAX" : modelId,
        modelVersion: modelId === "sarimax" ? "v1" : `${modelId}-v1`,
        forecastSource: "baseline",
        tuningRunHash: null,
        point,
        changePct,
        direction: changePct >= 3 ? "up" : changePct <= -3 ? "down" : "flat",
      };
    }),
  }));
  return {
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    modelId: "sarimax",
    modelName: "SARIMAX",
    modelVersion: "v1",
    score1w: 70,
    coverage1w: 90,
    selectionMode: "automatic",
    forecastSource: "baseline",
    tuningRunHash: null,
    evaluationProtocol: "rolling-origin-52",
    automaticChampion: {
      modelId: "sarimax",
      modelName: "SARIMAX",
      modelVersion: "v1",
      score1w: 70,
    },
    representativeRevision: `rep-v1:${"0".repeat(64)}`,
    forecasts,
    metricsByHorizon,
    modelAgreementByHorizon,
  };
}
