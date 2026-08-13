import {
  RISK_MODEL_IDS,
  type RiskModelId,
} from "./types";

export interface RiskModelDefinitionV1 {
  readonly id: RiskModelId;
  readonly name: string;
  readonly family: string;
  readonly color: `#${string}`;
  readonly baselineVersion: string;
}

export const MODEL_REGISTRY = [
  { id: "naive", name: "Naive", family: "기준모델", color: "#64748b", baselineVersion: "last-observation-v1" },
  { id: "sarimax", name: "SARIMAX", family: "통계 시계열", color: "#38bdf8", baselineVersion: "statsmodels-0.14.6" },
  { id: "lightgbm", name: "LightGBM", family: "트리 부스팅", color: "#16a34a", baselineVersion: "lightgbm-4.7.0" },
  { id: "xgboost", name: "XGBoost", family: "트리 부스팅", color: "#f97316", baselineVersion: "xgboost-3.4.0" },
  { id: "random_forest", name: "Random Forest", family: "트리 앙상블", color: "#0f766e", baselineVersion: "scikit-learn-1.6.1" },
  { id: "prophet", name: "Prophet", family: "추세·계절", color: "#e11d48", baselineVersion: "prophet-1.3.0" },
  { id: "timesfm", name: "TimesFM", family: "사전학습 모델", color: "#0b1f5e", baselineVersion: "timesfm-2.0.2" },
  { id: "chronos", name: "Chronos", family: "사전학습 모델", color: "#7c3aed", baselineVersion: "chronos-forecasting-2.3.1" },
] as const satisfies readonly RiskModelDefinitionV1[];

const MODEL_ID_SET: ReadonlySet<string> = new Set(RISK_MODEL_IDS);

export function isRiskModelId(value: unknown): value is RiskModelId {
  return typeof value === "string" && MODEL_ID_SET.has(value);
}

export function modelDefinition(modelId: RiskModelId): RiskModelDefinitionV1 {
  const definition = MODEL_REGISTRY.find(({ id }) => id === modelId);
  if (definition === undefined) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return definition;
}

export function modelRegistryIndex(modelId: RiskModelId): number {
  return RISK_MODEL_IDS.indexOf(modelId);
}
