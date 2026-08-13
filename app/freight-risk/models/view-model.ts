import { scoreModelsForHorizon, compareScoredModels } from "./core/metrics";
import { MODEL_REGISTRY, modelDefinition } from "./core/registry";
import type {
  EightTuple,
  HorizonWeeks,
  ModelProjectionV1,
  RepresentativeSelectionV1,
  RiskModelId,
  ScoredModelMetricV1,
} from "./core/types";

export interface PerformanceRowV1 {
  readonly model: ModelProjectionV1;
  readonly metric: ScoredModelMetricV1;
  readonly rank: number;
  readonly isAutomaticChampion: boolean;
  readonly isRepresentative: boolean;
}

export function performanceRows(
  models: EightTuple<ModelProjectionV1>,
  horizon: HorizonWeeks,
  representative: RepresentativeSelectionV1,
): readonly PerformanceRowV1[] {
  return scoreModelsForHorizon(models.map((model) => ({
    modelId: model.modelId,
    metric: model.metricsByHorizon[horizon - 1],
  })))
    .toSorted(compareScoredModels)
    .map((row, index) => {
      const model = models.find(({ modelId }) => modelId === row.modelId);
      if (model === undefined) {
        throw new Error(`Missing model projection: ${row.modelId}`);
      }
      return {
        model,
        metric: row.metric,
        rank: index + 1,
        isAutomaticChampion: representative.automaticChampion.modelId === row.modelId,
        isRepresentative: representative.modelId === row.modelId,
      };
    });
}

export function selectedLegendLabel(selected: ReadonlySet<RiskModelId>): string {
  return `전체 보기 · ${selected.size}개 선택`;
}

export function modelBadge(
  modelId: RiskModelId,
  representative: RepresentativeSelectionV1,
): string | null {
  if (modelId === "naive") return "기준선 · 자동선정 제외";
  if (representative.selectionMode === "manual" && representative.modelId === modelId) {
    return "사용자 대표";
  }
  if (representative.automaticChampion.modelId === modelId) return "자동 1위";
  return null;
}

export function modelChangePct(point: number, current: number): number {
  return 100 * (point / current - 1);
}

export function displayModelVersion(model: ModelProjectionV1): string {
  return model.forecastSource === "tuned"
    ? `${model.modelVersion} · 재측정`
    : model.modelVersion;
}

export function modelsInRegistryOrder(
  models: readonly ModelProjectionV1[],
): EightTuple<ModelProjectionV1> {
  return MODEL_REGISTRY.map((definition) => {
    const model = models.find(({ modelId }) => modelId === definition.id);
    if (model === undefined || model.modelName !== modelDefinition(definition.id).name) {
      throw new Error(`Invalid model registry member: ${definition.id}`);
    }
    return model;
  }) as unknown as EightTuple<ModelProjectionV1>;
}
