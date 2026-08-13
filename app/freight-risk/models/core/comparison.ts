import { compareScoredModels, scoreModelsForHorizon } from "./metrics";
import { defaultParameters } from "./tuning";
import type {
  EightTuple,
  ModelProjectionV1,
  RiskModelId,
  TuneParameterValueV1,
} from "./types";
import type { TuningSessionStateV1 } from "./tuning";

export const TUNING_COMPARISON_ROW_ORDER = [
  "1주 예측 운임",
  "1주 PI90 구간",
  "MAPE",
  "MSE",
  "MASE",
  "PI90 Coverage",
  "1주 종합순위",
] as const;

export interface TuningComparisonRowV1 {
  readonly label: (typeof TUNING_COMPARISON_ROW_ORDER)[number];
  readonly before: string;
  readonly after: string;
}

export interface TuningSettingChangeV1 {
  readonly key: string;
  readonly before: TuneParameterValueV1;
  readonly after: TuneParameterValueV1;
}

export interface TuningComparisonViewV1 {
  readonly modelId: RiskModelId;
  readonly beforeModel: ModelProjectionV1;
  readonly afterModel: ModelProjectionV1;
  readonly beforeMeta: "직전 재측정 결과" | "내장 기준 결과";
  readonly elapsedMs: number;
  readonly mapeImprovementPctPoints: number;
  readonly forecastShift: number;
  readonly beforeRank: number;
  readonly afterRank: number;
  readonly trainingWindowBefore: string;
  readonly trainingWindowAfter: string;
  readonly settingChanges: readonly TuningSettingChangeV1[];
  readonly rows: readonly TuningComparisonRowV1[];
}

function rankOf(models: EightTuple<ModelProjectionV1>, modelId: RiskModelId): number {
  const sorted = scoreModelsForHorizon(models.map((model) => ({
    modelId: model.modelId,
    metric: model.metricsByHorizon[0],
  }))).toSorted(compareScoredModels);
  return sorted.findIndex((entry) => entry.modelId === modelId) + 1;
}

function money(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

export function buildTuningComparison(
  state: TuningSessionStateV1,
  beforeModels: EightTuple<ModelProjectionV1>,
  afterModels: EightTuple<ModelProjectionV1>,
): TuningComparisonViewV1 {
  if (state.status !== "success" || state.candidate === null) {
    throw new Error("A successful tuning candidate is required for comparison");
  }
  const { result } = state.candidate;
  const beforeModel = beforeModels.find(({ modelId }) => modelId === result.modelId);
  const afterModel = afterModels.find(({ modelId }) => modelId === result.modelId);
  if (beforeModel === undefined || afterModel === undefined) {
    throw new Error("The tuned model is missing from the comparison tuples");
  }

  const baselineParameters = defaultParameters(result.modelId);
  const priorParameters = state.accepted?.result.parameters ?? baselineParameters;
  const priorTrainingWindow = state.accepted?.result.trainingWindow ?? "expanding";
  const settingChanges = Object.keys(result.parameters).toSorted().flatMap((key) => {
    const before = priorParameters[key];
    const after = result.parameters[key];
    return before === after || before === undefined || after === undefined ? [] : [{ key, before, after }];
  });
  const beforeForecast = beforeModel.forecasts[0];
  const afterForecast = afterModel.forecasts[0];
  const beforeMetric = beforeModel.metricsByHorizon[0];
  const afterMetric = afterModel.metricsByHorizon[0];
  const beforeRank = rankOf(beforeModels, result.modelId);
  const afterRank = rankOf(afterModels, result.modelId);
  const rows: readonly TuningComparisonRowV1[] = [
    { label: "1주 예측 운임", before: `${money(beforeForecast.point)} USD/FEU`, after: `${money(afterForecast.point)} USD/FEU` },
    { label: "1주 PI90 구간", before: `${money(beforeForecast.lower90)}–${money(beforeForecast.upper90)}`, after: `${money(afterForecast.lower90)}–${money(afterForecast.upper90)}` },
    { label: "MAPE", before: `${beforeMetric.mapePct.toFixed(2)}%`, after: `${afterMetric.mapePct.toFixed(2)}%` },
    { label: "MSE", before: money(beforeMetric.mse), after: money(afterMetric.mse) },
    { label: "MASE", before: beforeMetric.mase.toFixed(3), after: afterMetric.mase.toFixed(3) },
    { label: "PI90 Coverage", before: `${beforeMetric.coverage.pct.toFixed(1)}%`, after: `${afterMetric.coverage.pct.toFixed(1)}%` },
    { label: "1주 종합순위", before: `${beforeRank}위 / 8`, after: `${afterRank}위 / 8` },
  ];

  return {
    modelId: result.modelId,
    beforeModel,
    afterModel,
    beforeMeta: state.accepted === null ? "내장 기준 결과" : "직전 재측정 결과",
    elapsedMs: result.elapsedMs,
    mapeImprovementPctPoints: beforeMetric.mapePct - afterMetric.mapePct,
    forecastShift: afterForecast.point - beforeForecast.point,
    beforeRank,
    afterRank,
    trainingWindowBefore: priorTrainingWindow,
    trainingWindowAfter: result.trainingWindow,
    settingChanges,
    rows,
  };
}
