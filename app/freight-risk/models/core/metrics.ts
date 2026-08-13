import { modelRegistryIndex } from "./registry";
import {
  RISK_MODEL_IDS,
  ModelsContractError,
  type ModelMetricInputV1,
  type RiskModelId,
  type ScoredModelMetricV1,
} from "./types";

export interface ActualPredictedPairV1 {
  readonly actual: number;
  readonly predicted: number;
}

export interface ScoredModelRowV1 {
  readonly modelId: RiskModelId;
  readonly metric: ScoredModelMetricV1;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new ModelsContractError("NON_FINITE", `${label} must be finite`);
  }
}

function requirePairs(pairs: readonly ActualPredictedPairV1[]): void {
  if (pairs.length === 0) {
    throw new ModelsContractError("EMPTY_EVALUATION", "Evaluation records are required");
  }
  for (const [index, pair] of pairs.entries()) {
    assertFinite(pair.actual, `actual[${index}]`);
    assertFinite(pair.predicted, `predicted[${index}]`);
  }
}

export function meanAbsoluteError(pairs: readonly ActualPredictedPairV1[]): number {
  requirePairs(pairs);
  return pairs.reduce((sum, pair) => sum + Math.abs(pair.actual - pair.predicted), 0) / pairs.length;
}

export function meanAbsolutePercentageError(
  pairs: readonly ActualPredictedPairV1[],
): number {
  requirePairs(pairs);
  let total = 0;
  for (const [index, pair] of pairs.entries()) {
    if (pair.actual === 0) {
      throw new ModelsContractError("ZERO_ACTUAL", `actual[${index}] must not be zero for MAPE`);
    }
    total += Math.abs((pair.actual - pair.predicted) / pair.actual) * 100;
  }
  return total / pairs.length;
}

export function meanSquaredError(pairs: readonly ActualPredictedPairV1[]): number {
  requirePairs(pairs);
  return pairs.reduce((sum, pair) => {
    const error = pair.actual - pair.predicted;
    return sum + error * error;
  }, 0) / pairs.length;
}

export function rootMeanSquaredError(pairs: readonly ActualPredictedPairV1[]): number {
  return Math.sqrt(meanSquaredError(pairs));
}

export function fixedSeasonalNaiveScale(
  trainingValues: readonly number[],
  seasonalLag = 52,
): number {
  if (!Number.isInteger(seasonalLag) || seasonalLag < 1) {
    throw new ModelsContractError("INVALID_SEASONAL_LAG", "Seasonal lag must be a positive integer");
  }
  if (trainingValues.length <= seasonalLag) {
    throw new ModelsContractError("SHORT_TRAINING_HISTORY", "Training history must exceed the seasonal lag");
  }
  let total = 0;
  let count = 0;
  for (let index = seasonalLag; index < trainingValues.length; index += 1) {
    const current = trainingValues[index];
    const previous = trainingValues[index - seasonalLag];
    assertFinite(current, `trainingValues[${index}]`);
    assertFinite(previous, `trainingValues[${index - seasonalLag}]`);
    total += Math.abs(current - previous);
    count += 1;
  }
  const scale = total / count;
  if (!(scale > 0)) {
    throw new ModelsContractError("ZERO_MASE_SCALE", "MASE scale must be greater than zero");
  }
  return scale;
}

export function meanAbsoluteScaledError(
  pairs: readonly ActualPredictedPairV1[],
  fixedScale: number,
): number {
  assertFinite(fixedScale, "fixedScale");
  if (!(fixedScale > 0)) {
    throw new ModelsContractError("INVALID_MASE_SCALE", "MASE scale must be greater than zero");
  }
  return meanAbsoluteError(pairs) / fixedScale;
}

function validateMetric(metric: ModelMetricInputV1): void {
  const values = [metric.mapePct, metric.mse, metric.rmse, metric.mase, metric.coverage.pct];
  for (const [index, value] of values.entries()) {
    assertFinite(value, `metric[${index}]`);
  }
  if (metric.mapePct < 0 || metric.mse < 0 || metric.rmse < 0 || metric.mase < 0) {
    throw new ModelsContractError("NEGATIVE_METRIC", "Error metrics must not be negative");
  }
}

export function scoreModelsForHorizon(
  rows: readonly { readonly modelId: RiskModelId; readonly metric: ModelMetricInputV1 }[],
): readonly ScoredModelRowV1[] {
  if (rows.length !== RISK_MODEL_IDS.length) {
    throw new ModelsContractError("MODEL_COUNT", "Exactly eight model metrics are required");
  }
  const seen = new Set<RiskModelId>();
  for (const row of rows) {
    validateMetric(row.metric);
    if (seen.has(row.modelId)) {
      throw new ModelsContractError("DUPLICATE_MODEL", `Duplicate model: ${row.modelId}`);
    }
    seen.add(row.modelId);
  }
  if (RISK_MODEL_IDS.some((modelId) => !seen.has(modelId))) {
    throw new ModelsContractError("MODEL_SET", "The canonical eight-model set is required");
  }
  const horizon = rows[0]?.metric.horizonWeeks;
  if (horizon === undefined || rows.some(({ metric }) => metric.horizonWeeks !== horizon)) {
    throw new ModelsContractError("HORIZON_MISMATCH", "All model metrics must share one horizon");
  }
  const bestMape = Math.min(...rows.map(({ metric }) => metric.mapePct));
  const bestMse = Math.min(...rows.map(({ metric }) => metric.mse));
  const bestMase = Math.min(...rows.map(({ metric }) => metric.mase));

  return rows.map(({ modelId, metric }) => {
    const mapeScore = 100 * bestMape / Math.max(metric.mapePct, 1e-9);
    const mseScore = 100 * bestMse / Math.max(metric.mse, 1e-9);
    const maseScore = 100 * bestMase / Math.max(metric.mase, 1e-9);
    return {
      modelId,
      metric: {
        ...metric,
        mapeScore,
        mseScore,
        maseScore,
        totalScore: (mapeScore + mseScore + maseScore) / 3,
      },
    };
  });
}

export function compareScoredModels(left: ScoredModelRowV1, right: ScoredModelRowV1): number {
  return right.metric.totalScore - left.metric.totalScore
    || left.metric.mapePct - right.metric.mapePct
    || left.metric.mase - right.metric.mase
    || left.metric.mse - right.metric.mse
    || modelRegistryIndex(left.modelId) - modelRegistryIndex(right.modelId);
}

export function automaticChampion(rows: readonly ScoredModelRowV1[]): ScoredModelRowV1 {
  const candidates = rows.filter(({ modelId }) => modelId !== "naive").toSorted(compareScoredModels);
  const champion = candidates[0];
  if (champion === undefined) {
    throw new ModelsContractError("NO_CHAMPION", "A non-Naive model is required");
  }
  return champion;
}
