import { isRouteId, type RouteId } from "../../../contracts";

import {
  type JsonValue,
  decodeFiniteNumber,
  decodeIsoDate,
  decodeJsonValue,
  decodeNonEmptyString,
  decodeNonNegativeInteger,
  hasExactKeys,
  isRecord,
} from "./decode";
import {
  FORECAST_HORIZONS,
  type ForecastHorizon,
  decodeForecastHorizon,
  hasExactHorizonOrder,
} from "./horizon";

export const MODEL_IDS = [
  "naive",
  "sarimax",
  "lightgbm",
  "xgboost",
  "random_forest",
  "prophet",
  "timesfm",
  "chronos",
] as const;

export type ModelId = (typeof MODEL_IDS)[number];
export type SelectionMode = "automatic" | "manual";
export type ForecastSource = "baseline" | "tuned";
export type ForecastDirection = "up" | "down" | "flat";

export interface CurrentObservationV1 {
  readonly date: string;
  readonly value: number;
  readonly unit: "USD/FEU";
}

export interface ForecastPointV1 {
  readonly horizonWeeks: ForecastHorizon;
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

export interface HorizonMetricsV1 {
  readonly horizonWeeks: ForecastHorizon;
  readonly mapePct: number;
  readonly mse: number;
  readonly rmse: number;
  readonly mase: number;
  readonly mapeScore: number;
  readonly mseScore: number;
  readonly maseScore: number;
  readonly totalScore: number;
  readonly coverage: CoverageV1;
}

export interface AgreementMemberV1 {
  readonly modelId: ModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly forecastSource: ForecastSource;
  readonly tuningRunHash: string | null;
  readonly point: number;
  readonly changePct: number;
  readonly direction: ForecastDirection;
}

export interface ModelAgreementV1 {
  readonly horizonWeeks: ForecastHorizon;
  readonly thresholdPct: 3;
  readonly up: number;
  readonly down: number;
  readonly flat: number;
  readonly total: 8;
  readonly members: readonly AgreementMemberV1[];
}

export interface AutomaticChampionV1 {
  readonly modelId: ModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly score1w: number;
}

export interface RepresentativeSelectionV1 {
  readonly route: RouteId;
  readonly currentObservation: CurrentObservationV1;
  readonly modelId: ModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly score1w: number;
  readonly coverage1w: number;
  readonly selectionMode: SelectionMode;
  readonly forecastSource: ForecastSource;
  readonly tuningRunHash: string | null;
  readonly evaluationProtocol: JsonValue;
  readonly automaticChampion: AutomaticChampionV1;
  readonly representativeRevision: string;
  readonly forecasts: readonly ForecastPointV1[];
  readonly metricsByHorizon: readonly HorizonMetricsV1[];
  readonly modelAgreementByHorizon: readonly ModelAgreementV1[];
}

export interface RepresentativeHorizonProjectionV1 {
  readonly selection: RepresentativeSelectionV1;
  readonly horizonWeeks: ForecastHorizon;
  readonly forecast: ForecastPointV1;
  readonly metrics: HorizonMetricsV1;
  readonly agreement: ModelAgreementV1;
}

const ROOT_KEYS = [
  "route",
  "currentObservation",
  "modelId",
  "modelName",
  "modelVersion",
  "score1w",
  "coverage1w",
  "selectionMode",
  "forecastSource",
  "tuningRunHash",
  "evaluationProtocol",
  "automaticChampion",
  "representativeRevision",
  "forecasts",
  "metricsByHorizon",
  "modelAgreementByHorizon",
] as const;
const OBSERVATION_KEYS = ["date", "value", "unit"] as const;
const FORECAST_KEYS = ["horizonWeeks", "targetDate", "point", "lower90", "upper90"] as const;
const COVERAGE_KEYS = ["pct", "hits", "total", "sampleSize", "target", "intervalMethod"] as const;
const METRIC_KEYS = [
  "horizonWeeks",
  "mapePct",
  "mse",
  "rmse",
  "mase",
  "mapeScore",
  "mseScore",
  "maseScore",
  "totalScore",
  "coverage",
] as const;
const MEMBER_KEYS = [
  "modelId",
  "modelName",
  "modelVersion",
  "forecastSource",
  "tuningRunHash",
  "point",
  "changePct",
  "direction",
] as const;
const AGREEMENT_KEYS = ["horizonWeeks", "thresholdPct", "up", "down", "flat", "total", "members"] as const;
const CHAMPION_KEYS = ["modelId", "modelName", "modelVersion", "score1w"] as const;

function decodeModelId(value: unknown): ModelId | null {
  for (const id of MODEL_IDS) {
    if (value === id) {
      return id;
    }
  }
  return null;
}

function decodeSelectionMode(value: unknown): SelectionMode | null {
  return value === "automatic" || value === "manual" ? value : null;
}

function decodeForecastSource(value: unknown): ForecastSource | null {
  return value === "baseline" || value === "tuned" ? value : null;
}

function decodeDirection(value: unknown): ForecastDirection | null {
  return value === "up" || value === "down" || value === "flat" ? value : null;
}

function decodeTuningRunHash(value: unknown, source: ForecastSource): string | null | undefined {
  if (source === "baseline") {
    return value === null ? null : undefined;
  }
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value) ? value : undefined;
}

function decodeObservation(value: unknown): CurrentObservationV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, OBSERVATION_KEYS)) {
    return null;
  }
  const date = decodeIsoDate(value.date);
  const amount = decodeFiniteNumber(value.value);
  if (date === null || amount === null || amount <= 0 || value.unit !== "USD/FEU") {
    return null;
  }
  return { date, value: amount, unit: "USD/FEU" };
}

function decodeForecast(value: unknown): ForecastPointV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, FORECAST_KEYS)) {
    return null;
  }
  const horizonWeeks = decodeForecastHorizon(value.horizonWeeks);
  const targetDate = decodeIsoDate(value.targetDate);
  const point = decodeFiniteNumber(value.point);
  const lower90 = decodeFiniteNumber(value.lower90);
  const upper90 = decodeFiniteNumber(value.upper90);
  if (
    horizonWeeks === null
    || targetDate === null
    || point === null
    || lower90 === null
    || upper90 === null
    || lower90 > point
    || point > upper90
    || lower90 < 0
  ) {
    return null;
  }
  return { horizonWeeks, targetDate, point, lower90, upper90 };
}

function decodeCoverage(value: unknown): CoverageV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, COVERAGE_KEYS)) {
    return null;
  }
  const pct = decodeFiniteNumber(value.pct);
  const hits = decodeNonNegativeInteger(value.hits);
  const total = decodeNonNegativeInteger(value.total);
  const sampleSize = decodeNonNegativeInteger(value.sampleSize);
  const intervalMethod = decodeNonEmptyString(value.intervalMethod);
  if (
    pct === null
    || pct < 0
    || pct > 100
    || hits === null
    || total === null
    || sampleSize === null
    || hits > total
    || total > sampleSize
    || value.target !== 0.9
    || intervalMethod === null
    || (total > 0 && Math.abs(pct - (hits / total) * 100) > 0.051)
  ) {
    return null;
  }
  return { pct, hits, total, sampleSize, target: 0.9, intervalMethod };
}

function decodeMetrics(value: unknown): HorizonMetricsV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, METRIC_KEYS)) {
    return null;
  }
  const horizonWeeks = decodeForecastHorizon(value.horizonWeeks);
  const metricValues = [
    decodeFiniteNumber(value.mapePct),
    decodeFiniteNumber(value.mse),
    decodeFiniteNumber(value.rmse),
    decodeFiniteNumber(value.mase),
    decodeFiniteNumber(value.mapeScore),
    decodeFiniteNumber(value.mseScore),
    decodeFiniteNumber(value.maseScore),
    decodeFiniteNumber(value.totalScore),
  ];
  const coverage = decodeCoverage(value.coverage);
  if (horizonWeeks === null || coverage === null || metricValues.some((item) => item === null || item < 0)) {
    return null;
  }
  const [mapePct, mse, rmse, mase, mapeScore, mseScore, maseScore, totalScore] = metricValues;
  if (
    mapePct === null
    || mse === null
    || rmse === null
    || mase === null
    || mapeScore === null
    || mseScore === null
    || maseScore === null
    || totalScore === null
  ) {
    return null;
  }
  return {
    horizonWeeks,
    mapePct,
    mse,
    rmse,
    mase,
    mapeScore,
    mseScore,
    maseScore,
    totalScore,
    coverage,
  };
}

function decodeMember(value: unknown, currentValue: number): AgreementMemberV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, MEMBER_KEYS)) {
    return null;
  }
  const modelId = decodeModelId(value.modelId);
  const modelName = decodeNonEmptyString(value.modelName);
  const modelVersion = decodeNonEmptyString(value.modelVersion);
  const forecastSource = decodeForecastSource(value.forecastSource);
  const point = decodeFiniteNumber(value.point);
  const changePct = decodeFiniteNumber(value.changePct);
  const direction = decodeDirection(value.direction);
  if (
    modelId === null
    || modelName === null
    || modelVersion === null
    || forecastSource === null
    || point === null
    || point <= 0
    || changePct === null
    || direction === null
  ) {
    return null;
  }
  const tuningRunHash = decodeTuningRunHash(value.tuningRunHash, forecastSource);
  const calculatedChange = 100 * (point / currentValue - 1);
  const calculatedDirection: ForecastDirection = calculatedChange >= 3
    ? "up"
    : calculatedChange <= -3
      ? "down"
      : "flat";
  if (
    tuningRunHash === undefined
    || Math.abs(changePct - calculatedChange) > 0.051
    || direction !== calculatedDirection
  ) {
    return null;
  }
  return {
    modelId,
    modelName,
    modelVersion,
    forecastSource,
    tuningRunHash,
    point,
    changePct,
    direction,
  };
}

function decodeAgreement(value: unknown, currentValue: number): ModelAgreementV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, AGREEMENT_KEYS) || !Array.isArray(value.members)) {
    return null;
  }
  const horizonWeeks = decodeForecastHorizon(value.horizonWeeks);
  const up = decodeNonNegativeInteger(value.up);
  const down = decodeNonNegativeInteger(value.down);
  const flat = decodeNonNegativeInteger(value.flat);
  if (
    horizonWeeks === null
    || value.thresholdPct !== 3
    || value.total !== 8
    || up === null
    || down === null
    || flat === null
    || value.members.length !== MODEL_IDS.length
  ) {
    return null;
  }
  const members: AgreementMemberV1[] = [];
  for (let index = 0; index < value.members.length; index += 1) {
    const member = decodeMember(value.members[index], currentValue);
    if (member === null || member.modelId !== MODEL_IDS[index]) {
      return null;
    }
    members.push(member);
  }
  const counted = {
    up: members.filter((member) => member.direction === "up").length,
    down: members.filter((member) => member.direction === "down").length,
    flat: members.filter((member) => member.direction === "flat").length,
  };
  if (up + down + flat !== 8 || up !== counted.up || down !== counted.down || flat !== counted.flat) {
    return null;
  }
  return { horizonWeeks, thresholdPct: 3, up, down, flat, total: 8, members };
}

function decodeAutomaticChampion(value: unknown): AutomaticChampionV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, CHAMPION_KEYS)) {
    return null;
  }
  const modelId = decodeModelId(value.modelId);
  const modelName = decodeNonEmptyString(value.modelName);
  const modelVersion = decodeNonEmptyString(value.modelVersion);
  const score1w = decodeFiniteNumber(value.score1w);
  if (modelId === null || modelName === null || modelVersion === null || score1w === null) {
    return null;
  }
  return { modelId, modelName, modelVersion, score1w };
}

function decodeTuple<T>(value: unknown, decoder: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value) || value.length !== FORECAST_HORIZONS.length) {
    return null;
  }
  const result: T[] = [];
  for (const item of value) {
    const decoded = decoder(item);
    if (decoded === null) {
      return null;
    }
    result.push(decoded);
  }
  return result;
}

export function decodeRepresentativeSelection(
  value: unknown,
  expectedRoute?: RouteId,
): RepresentativeSelectionV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, ROOT_KEYS) || !isRouteId(value.route)) {
    return null;
  }
  if (expectedRoute !== undefined && value.route !== expectedRoute) {
    return null;
  }
  const currentObservation = decodeObservation(value.currentObservation);
  const modelId = decodeModelId(value.modelId);
  const modelName = decodeNonEmptyString(value.modelName);
  const modelVersion = decodeNonEmptyString(value.modelVersion);
  const score1w = decodeFiniteNumber(value.score1w);
  const coverage1w = decodeFiniteNumber(value.coverage1w);
  const selectionMode = decodeSelectionMode(value.selectionMode);
  const forecastSource = decodeForecastSource(value.forecastSource);
  const evaluationProtocol = decodeJsonValue(value.evaluationProtocol);
  const automaticChampion = decodeAutomaticChampion(value.automaticChampion);
  const representativeRevision = decodeNonEmptyString(value.representativeRevision);
  const forecasts = decodeTuple(value.forecasts, decodeForecast);
  const metrics = decodeTuple(value.metricsByHorizon, decodeMetrics);
  if (
    currentObservation === null
    || modelId === null
    || modelName === null
    || modelVersion === null
    || score1w === null
    || coverage1w === null
    || coverage1w < 0
    || coverage1w > 100
    || selectionMode === null
    || forecastSource === null
    || evaluationProtocol === null
    || automaticChampion === null
    || representativeRevision === null
    || !/^rep-v1:[0-9a-f]{64}$/u.test(representativeRevision)
    || forecasts === null
    || metrics === null
    || !hasExactHorizonOrder(forecasts)
    || !hasExactHorizonOrder(metrics)
  ) {
    return null;
  }
  const tuningRunHash = decodeTuningRunHash(value.tuningRunHash, forecastSource);
  const agreements = decodeTuple(
    value.modelAgreementByHorizon,
    (item) => decodeAgreement(item, currentObservation.value),
  );
  if (
    tuningRunHash === undefined
    || agreements === null
    || !hasExactHorizonOrder(agreements)
    || Math.abs(score1w - metrics[0].totalScore) > Number.EPSILON
    || Math.abs(coverage1w - metrics[0].coverage.pct) > Number.EPSILON
    || forecasts.some((forecast) => forecast.targetDate <= currentObservation.date)
    || agreements.some((agreement, index) => {
      const selectedMember = agreement.members.find((member) => member.modelId === modelId);
      return selectedMember === undefined
        || selectedMember.modelName !== modelName
        || selectedMember.modelVersion !== modelVersion
        || selectedMember.forecastSource !== forecastSource
        || selectedMember.tuningRunHash !== tuningRunHash
        || Math.abs(selectedMember.point - forecasts[index].point) > Number.EPSILON;
    })
  ) {
    return null;
  }
  return {
    route: value.route,
    currentObservation,
    modelId,
    modelName,
    modelVersion,
    score1w,
    coverage1w,
    selectionMode,
    forecastSource,
    tuningRunHash,
    evaluationProtocol,
    automaticChampion,
    representativeRevision,
    forecasts,
    metricsByHorizon: metrics,
    modelAgreementByHorizon: agreements,
  };
}

export function selectRepresentativeHorizon(
  selection: RepresentativeSelectionV1,
  horizonWeeks: ForecastHorizon,
): RepresentativeHorizonProjectionV1 {
  const index = FORECAST_HORIZONS.indexOf(horizonWeeks);
  return {
    selection,
    horizonWeeks,
    forecast: selection.forecasts[index],
    metrics: selection.metricsByHorizon[index],
    agreement: selection.modelAgreementByHorizon[index],
  };
}
