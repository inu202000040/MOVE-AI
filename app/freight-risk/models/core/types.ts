import type { RouteId } from "../../../contracts";

export const HORIZONS = [1, 2, 3, 4] as const;

export type HorizonWeeks = (typeof HORIZONS)[number];
export type FourTuple<T> = readonly [T, T, T, T];
export type EightTuple<T> = readonly [T, T, T, T, T, T, T, T];

export const RISK_MODEL_IDS = [
  "naive",
  "sarimax",
  "lightgbm",
  "xgboost",
  "random_forest",
  "prophet",
  "timesfm",
  "chronos",
] as const;

export type RiskModelId = (typeof RISK_MODEL_IDS)[number];
export type ForecastSourceV1 = "baseline" | "tuned";
export type SelectionModeV1 = "automatic" | "manual";
export type AgreementDirectionV1 = "up" | "down" | "flat";
export type TrainingWindowV1 = "expanding" | "rolling_104" | "rolling_52";
export type TuneParameterValueV1 = string | number;

export interface CurrentObservationV1 {
  readonly date: string;
  readonly value: number;
  readonly unit: "USD/FEU";
}

export interface ForecastPointV1 {
  readonly horizonWeeks: HorizonWeeks;
  readonly targetDate: string;
  readonly point: number;
  readonly lower90: number;
  readonly upper90: number;
}

export interface CoverageV1 {
  readonly pct: number;
  readonly hits: number;
  readonly total: number;
  readonly sampleSize: number;
  readonly target: 0.9;
  readonly intervalMethod: string;
}

export interface ModelMetricInputV1 {
  readonly horizonWeeks: HorizonWeeks;
  readonly mapePct: number;
  readonly mse: number;
  readonly rmse: number;
  readonly mase: number;
  readonly coverage: CoverageV1;
}

export interface ScoredModelMetricV1 extends ModelMetricInputV1 {
  readonly mapeScore: number;
  readonly mseScore: number;
  readonly maseScore: number;
  readonly totalScore: number;
}

export interface ModelProjectionV1 {
  readonly modelId: RiskModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly forecastSource: ForecastSourceV1;
  readonly tuningRunHash: string | null;
  readonly evaluationProtocol: string;
  readonly forecasts: FourTuple<ForecastPointV1>;
  readonly metricsByHorizon: FourTuple<ModelMetricInputV1>;
}

export interface TuneForecastV1 {
  readonly horizon: HorizonWeeks;
  readonly targetDate: string;
  readonly value: number;
  readonly lower90: number;
  readonly upper90: number;
}

export interface TuneMetricV1 {
  readonly horizon: HorizonWeeks;
  readonly mapePct: number;
  readonly mse: number;
  readonly rmse: number;
  readonly mase: number;
  readonly coverage90Pct: number;
  readonly hits: number;
  readonly total: number;
  readonly sampleSize: number;
}

export interface TuneEvaluationRecordV1 {
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

export interface TuneEvaluationHorizonV1 {
  readonly horizon: HorizonWeeks;
  readonly records: readonly TuneEvaluationRecordV1[];
}

export interface TuneRequestV1 {
  readonly routeCode: RouteId;
  readonly modelId: RiskModelId;
  readonly dates: readonly string[];
  readonly values: readonly number[];
  readonly trainingWindow: TrainingWindowV1;
  readonly parameters: Readonly<Record<string, TuneParameterValueV1>>;
  readonly evaluationOrigins: 52;
}

export interface TuneSuccessV1 {
  readonly status: "success";
  readonly routeCode: RouteId;
  readonly modelId: RiskModelId;
  readonly modelVersion: string;
  readonly forecastOrigin: string;
  readonly maseProtocol: "seasonal-naive-52-fixed";
  readonly trainingWindow: TrainingWindowV1;
  readonly evaluationOrigins: 52;
  readonly parameters: Readonly<Record<string, TuneParameterValueV1>>;
  readonly forecasts: FourTuple<TuneForecastV1>;
  readonly metricsByHorizon: FourTuple<TuneMetricV1>;
  readonly evaluationByHorizon: FourTuple<TuneEvaluationHorizonV1>;
  readonly elapsedMs: number;
  readonly methodologyKo: string;
}

export interface HashedTuneResultV1 {
  readonly result: TuneSuccessV1;
  readonly tuningRunHash: string;
}

export interface AutomaticChampionV1 {
  readonly modelId: RiskModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly score1w: number;
}

export interface AgreementMemberV1 {
  readonly modelId: RiskModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly forecastSource: ForecastSourceV1;
  readonly tuningRunHash: string | null;
  readonly point: number;
  readonly changePct: number;
  readonly direction: AgreementDirectionV1;
}

export interface ModelAgreementV1 {
  readonly horizonWeeks: HorizonWeeks;
  readonly thresholdPct: 3;
  readonly up: number;
  readonly down: number;
  readonly flat: number;
  readonly total: 8;
  readonly members: EightTuple<AgreementMemberV1>;
}

export interface RepresentativeSelectionV1 {
  readonly route: RouteId;
  readonly currentObservation: CurrentObservationV1;
  readonly modelId: RiskModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly score1w: number;
  readonly coverage1w: number;
  readonly selectionMode: SelectionModeV1;
  readonly forecastSource: ForecastSourceV1;
  readonly tuningRunHash: string | null;
  readonly evaluationProtocol: string;
  readonly automaticChampion: AutomaticChampionV1;
  readonly representativeRevision: string;
  readonly forecasts: FourTuple<ForecastPointV1>;
  readonly metricsByHorizon: FourTuple<ScoredModelMetricV1>;
  readonly modelAgreementByHorizon: FourTuple<ModelAgreementV1>;
}

export type RepresentativeSemanticProjectionV1 = Omit<
  RepresentativeSelectionV1,
  "representativeRevision"
>;

export class ModelsContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ModelsContractError";
    this.code = code;
  }
}
