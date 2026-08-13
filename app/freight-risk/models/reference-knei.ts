import { MODEL_REGISTRY } from "./core/registry";
import type {
  EightTuple,
  FourTuple,
  HorizonWeeks,
  ModelProjectionV1,
  RiskModelId,
} from "./core/types";
import { CHRONOS_REFERENCE_RAW } from "./reference-data/chronos";
import { KNEI_HISTORY_RAW } from "./reference-data/history";
import { LIGHTGBM_REFERENCE_RAW } from "./reference-data/lightgbm";
import { NAIVE_REFERENCE_RAW } from "./reference-data/naive";
import { PROPHET_REFERENCE_RAW } from "./reference-data/prophet";
import { RANDOM_FOREST_REFERENCE_RAW } from "./reference-data/random_forest";
import { SARIMAX_REFERENCE_RAW } from "./reference-data/sarimax";
import { TIMESFM_REFERENCE_RAW } from "./reference-data/timesfm";
import { XGBOOST_REFERENCE_RAW } from "./reference-data/xgboost";

export interface HistoricalPointV1 {
  readonly date: string;
  readonly value: number;
}

export interface EvaluationEvidenceV1 {
  readonly forecastOrigin: string;
  readonly targetDate: string;
  readonly predicted: number;
  readonly actual: number;
  readonly difference: number;
  readonly absoluteError: number;
  readonly apePct: number;
  readonly lower90: number;
  readonly upper90: number;
  readonly covered90: boolean;
}

type ForecastRowV1 = readonly [HorizonWeeks, string, number, number, number];
type MetricRowV1 = readonly [HorizonWeeks, number, number, number, number, number];
type EvaluationRowV1 = readonly [string, string, number, number, number, number, number, number, number, boolean];

interface ReferenceModelDataV1 {
  readonly forecasts: FourTuple<ForecastRowV1>;
  readonly metrics: FourTuple<MetricRowV1>;
  readonly evaluations: FourTuple<readonly EvaluationRowV1[]>;
}

const REFERENCE_DATA: Readonly<Record<RiskModelId, ReferenceModelDataV1>> = {
  naive: NAIVE_REFERENCE_RAW,
  sarimax: SARIMAX_REFERENCE_RAW,
  lightgbm: LIGHTGBM_REFERENCE_RAW,
  xgboost: XGBOOST_REFERENCE_RAW,
  random_forest: RANDOM_FOREST_REFERENCE_RAW,
  prophet: PROPHET_REFERENCE_RAW,
  timesfm: TIMESFM_REFERENCE_RAW,
  chronos: CHRONOS_REFERENCE_RAW,
};

export const KNEI_HISTORY: readonly HistoricalPointV1[] = KNEI_HISTORY_RAW.map(
  ([date, value]) => ({ date, value }),
);

export const KNEI_BASELINE_MODELS = MODEL_REGISTRY.map((definition) => {
  const data = REFERENCE_DATA[definition.id];
  return {
    modelId: definition.id,
    modelName: definition.name,
    modelVersion: definition.baselineVersion,
    forecastSource: "baseline",
    tuningRunHash: null,
    evaluationProtocol: "seasonal-naive-52-fixed|rolling-origin-52|empirical-central-90",
    forecasts: data.forecasts.map(([horizonWeeks, targetDate, point, lower90, upper90]) => ({
      horizonWeeks,
      targetDate,
      point,
      lower90,
      upper90,
    })) as unknown as ModelProjectionV1["forecasts"],
    metricsByHorizon: data.metrics.map((row) => {
      const [horizonWeeks, mapePct, mse, , mase, hits] = row;
      return {
        horizonWeeks,
        mapePct,
        mse,
        rmse: Math.sqrt(mse),
        mase,
        coverage: {
          pct: 100 * hits / 52,
          hits,
          total: 52,
          sampleSize: 52,
          target: 0.9,
          intervalMethod: "empirical-central-90",
        },
      };
    }) as unknown as ModelProjectionV1["metricsByHorizon"],
  } satisfies ModelProjectionV1;
}) as unknown as EightTuple<ModelProjectionV1>;

function evidenceRecord(row: EvaluationRowV1): EvaluationEvidenceV1 {
  const [forecastOrigin, targetDate, predicted, actual, difference, absoluteError, apePct, lower90, upper90, covered90] = row;
  return { forecastOrigin, targetDate, predicted, actual, difference, absoluteError, apePct, lower90, upper90, covered90 };
}

export function kneiEvaluationEvidence(
  modelId: RiskModelId,
): FourTuple<readonly EvaluationEvidenceV1[]> {
  return REFERENCE_DATA[modelId].evaluations.map(
    (group) => group.map(evidenceRecord),
  ) as unknown as FourTuple<readonly EvaluationEvidenceV1[]>;
}
