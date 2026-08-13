import {
  GATEWAY_SCHEMA_VERSION,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_DETAIL_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  isRouteId,
  type GatewayResultV1,
  type RouteId,
} from "../../contracts";

import {
  CVAR_ALPHA,
  CVAR_WEEKLY_CORRELATION,
  assertCvarSimulationInput,
  deriveRouteSeed,
  type CvarForecast,
  type CvarSimulationInput,
  type HorizonWeeks,
  type RiskWeight,
} from "./engine";
import {
  canonicalJsonForValidation,
  sha256HexForValidation,
} from "./identity";

export const REPRESENTATIVE_MODEL_IDS = [
  "naive",
  "sarimax",
  "lightgbm",
  "xgboost",
  "random_forest",
  "prophet",
  "timesfm",
  "chronos",
] as const;

export type RepresentativeModelId = (typeof REPRESENTATIVE_MODEL_IDS)[number];
export type RepresentativeSelectionMode = "automatic" | "manual";
export type RepresentativeForecastSource = "baseline" | "tuned";
export type RepresentativeDirection = "up" | "down" | "flat";

export interface RepresentativeObservationV1 {
  readonly date: string;
  readonly value: number;
  readonly unit: "USD/FEU";
}

export type RepresentativeForecastV1 = CvarForecast;

export interface RepresentativeAutomaticChampionV1 {
  readonly modelId: RepresentativeModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly score1w: number;
}

export interface RepresentativeCoverageV1 {
  readonly pct: number;
  readonly hits: number;
  readonly total: number;
  readonly sampleSize: number;
  readonly target: 0.9;
  readonly intervalMethod: string;
}

export interface RepresentativeMetricsV1 {
  readonly horizonWeeks: 1 | 2 | 3 | 4;
  readonly mapePct: number;
  readonly mse: number;
  readonly rmse: number;
  readonly mase: number;
  readonly mapeScore: number;
  readonly mseScore: number;
  readonly maseScore: number;
  readonly totalScore: number;
  readonly coverage: RepresentativeCoverageV1;
}

export interface RepresentativeAgreementMemberV1 {
  readonly modelId: RepresentativeModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly forecastSource: RepresentativeForecastSource;
  readonly tuningRunHash: string | null;
  readonly point: number;
  readonly changePct: number;
  readonly direction: RepresentativeDirection;
}

export interface RepresentativeAgreementV1 {
  readonly horizonWeeks: 1 | 2 | 3 | 4;
  readonly thresholdPct: 3;
  readonly up: number;
  readonly down: number;
  readonly flat: number;
  readonly total: 8;
  readonly members: readonly RepresentativeAgreementMemberV1[];
}

export interface RepresentativeSelectionV1 {
  readonly route: RouteId;
  readonly currentObservation: RepresentativeObservationV1;
  readonly modelId: RepresentativeModelId;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly score1w: number;
  readonly coverage1w: number;
  readonly selectionMode: RepresentativeSelectionMode;
  readonly forecastSource: RepresentativeForecastSource;
  readonly tuningRunHash: string | null;
  readonly evaluationProtocol: string;
  readonly automaticChampion: RepresentativeAutomaticChampionV1;
  readonly representativeRevision: string;
  readonly forecasts: readonly RepresentativeForecastV1[];
  readonly metricsByHorizon: readonly RepresentativeMetricsV1[];
  readonly modelAgreementByHorizon: readonly RepresentativeAgreementV1[];
}

export interface AllocationRepresentativeInput {
  readonly selection: RepresentativeSelectionV1;
  readonly route: RouteId;
  readonly current: number;
  readonly forecasts: readonly CvarForecast[];
  readonly routeSimulationKey: string;
}

export interface AllocationDraftInput {
  readonly selectedHorizon: HorizonWeeks;
  readonly fixed: number;
  readonly volume: number;
  readonly riskWeight: RiskWeight;
}

export interface AllocationRunInput {
  readonly representative: AllocationRepresentativeInput;
  readonly simulation: CvarSimulationInput;
}

export type RepresentativeGatewayResultV1 = GatewayResultV1<
  RepresentativeSelectionV1,
  "READY" | "UNAVAILABLE"
>;

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
const CHAMPION_KEYS = [
  "modelId",
  "modelName",
  "modelVersion",
  "score1w",
] as const;
const FORECAST_KEYS = [
  "horizonWeeks",
  "targetDate",
  "point",
  "lower90",
  "upper90",
] as const;
const METRICS_KEYS = [
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
const COVERAGE_KEYS = [
  "pct",
  "hits",
  "total",
  "sampleSize",
  "target",
  "intervalMethod",
] as const;
const AGREEMENT_KEYS = [
  "horizonWeeks",
  "thresholdPct",
  "up",
  "down",
  "flat",
  "total",
  "members",
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

const MODEL_ID_SET: ReadonlySet<string> = new Set(REPRESENTATIVE_MODEL_IDS);
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const REVISION_PATTERN = /^rep-v1:[0-9a-f]{64}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFinitePositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isBoundedPercent(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isModelId(value: unknown): value is RepresentativeModelId {
  return typeof value === "string" && MODEL_ID_SET.has(value);
}

function isForecastSource(
  value: unknown,
): value is RepresentativeForecastSource {
  return value === "baseline" || value === "tuned";
}

function hasValidTuningHash(
  source: RepresentativeForecastSource,
  value: unknown,
): value is string | null {
  return source === "baseline"
    ? value === null
    : typeof value === "string" && HASH_PATTERN.test(value);
}

function isObservation(
  value: unknown,
): value is RepresentativeObservationV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, OBSERVATION_KEYS) &&
    isIsoDate(value.date) &&
    isFinitePositive(value.value) &&
    value.unit === "USD/FEU"
  );
}

function isChampion(
  value: unknown,
): value is RepresentativeAutomaticChampionV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, CHAMPION_KEYS) &&
    isModelId(value.modelId) &&
    isNonEmptyString(value.modelName) &&
    isNonEmptyString(value.modelVersion) &&
    isFiniteNumber(value.score1w)
  );
}

function isForecast(
  value: unknown,
  horizonWeeks: number,
): value is RepresentativeForecastV1 {
  if (!isRecord(value)) {
    return false;
  }
  return (
    hasExactKeys(value, FORECAST_KEYS) &&
    value.horizonWeeks === horizonWeeks &&
    isIsoDate(value.targetDate) &&
    isFinitePositive(value.point) &&
    isFinitePositive(value.lower90) &&
    isFinitePositive(value.upper90) &&
    value.lower90 <= value.point &&
    value.point <= value.upper90
  );
}

function isCoverage(value: unknown): value is RepresentativeCoverageV1 {
  if (
    !(
    isRecord(value) &&
    hasExactKeys(value, COVERAGE_KEYS) &&
    isBoundedPercent(value.pct) &&
    isNonNegativeInteger(value.hits) &&
    isNonNegativeInteger(value.total) &&
    isNonNegativeInteger(value.sampleSize) &&
    value.total > 0 &&
    value.hits <= value.total &&
    value.sampleSize === value.total &&
    value.target === 0.9 &&
    isNonEmptyString(value.intervalMethod)
    )
  ) {
    return false;
  }
  const expectedPercent = (value.hits / value.total) * 100;
  const roundedPercent = Math.round(expectedPercent * 10) / 10;
  return (
    Math.abs(value.pct - expectedPercent) <= 1e-9 ||
    value.pct === roundedPercent
  );
}

function isMetrics(
  value: unknown,
  horizonWeeks: number,
): value is RepresentativeMetricsV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, METRICS_KEYS) &&
    value.horizonWeeks === horizonWeeks &&
    isFiniteNumber(value.mapePct) &&
    isFiniteNumber(value.mse) &&
    isFiniteNumber(value.rmse) &&
    isFiniteNumber(value.mase) &&
    isFiniteNumber(value.mapeScore) &&
    isFiniteNumber(value.mseScore) &&
    isFiniteNumber(value.maseScore) &&
    isFiniteNumber(value.totalScore) &&
    isCoverage(value.coverage)
  );
}

function isAgreementMember(
  value: unknown,
  expectedModelId: RepresentativeModelId,
  current: number,
): value is RepresentativeAgreementMemberV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, MEMBER_KEYS) ||
    value.modelId !== expectedModelId ||
    !isNonEmptyString(value.modelName) ||
    !isNonEmptyString(value.modelVersion) ||
    !isForecastSource(value.forecastSource) ||
    !hasValidTuningHash(value.forecastSource, value.tuningRunHash) ||
    !isFinitePositive(value.point) ||
    !isFiniteNumber(value.changePct)
  ) {
    return false;
  }
  const expectedChange = 100 * (value.point / current - 1);
  const expectedDirection: RepresentativeDirection =
    expectedChange >= 3 ? "up" : expectedChange <= -3 ? "down" : "flat";
  return (
    Math.abs(value.changePct - expectedChange) <= 1e-9 &&
    value.direction === expectedDirection
  );
}

function isAgreement(
  value: unknown,
  horizonWeeks: number,
  current: number,
): value is RepresentativeAgreementV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, AGREEMENT_KEYS) ||
    value.horizonWeeks !== horizonWeeks ||
    value.thresholdPct !== 3 ||
    !isNonNegativeInteger(value.up) ||
    !isNonNegativeInteger(value.down) ||
    !isNonNegativeInteger(value.flat) ||
    value.total !== 8 ||
    value.up + value.down + value.flat !== 8 ||
    !Array.isArray(value.members) ||
    value.members.length !== 8
  ) {
    return false;
  }
  if (
    !value.members.every((member, index) =>
      isAgreementMember(member, REPRESENTATIVE_MODEL_IDS[index], current),
    )
  ) {
    return false;
  }
  const counts = value.members.reduce(
    (result, member) => {
      result[member.direction] += 1;
      return result;
    },
    { up: 0, down: 0, flat: 0 },
  );
  return (
    value.up === counts.up &&
    value.down === counts.down &&
    value.flat === counts.flat
  );
}

function hasMatchingSelectedMember(selection: RepresentativeSelectionV1): boolean {
  const modelIndex = REPRESENTATIVE_MODEL_IDS.indexOf(selection.modelId);
  return selection.modelAgreementByHorizon.every((agreement, index) => {
    const member = agreement.members[modelIndex];
    const forecast = selection.forecasts[index];
    return (
      member.modelName === selection.modelName &&
      member.modelVersion === selection.modelVersion &&
      member.forecastSource === selection.forecastSource &&
      member.tuningRunHash === selection.tuningRunHash &&
      member.point === forecast.point
    );
  });
}

function hasMatchingAutomaticChampion(
  selection: RepresentativeSelectionV1,
): boolean {
  if (selection.automaticChampion.modelId === "naive") {
    return false;
  }
  if (selection.selectionMode === "manual") {
    return true;
  }
  return (
    selection.modelId === selection.automaticChampion.modelId &&
    selection.modelName === selection.automaticChampion.modelName &&
    selection.modelVersion === selection.automaticChampion.modelVersion &&
    selection.score1w === selection.automaticChampion.score1w
  );
}

function hasMatchingRepresentativeRevision(
  selection: RepresentativeSelectionV1,
): boolean {
  const representativeProjection = {
    route: selection.route,
    currentObservation: selection.currentObservation,
    modelId: selection.modelId,
    modelName: selection.modelName,
    modelVersion: selection.modelVersion,
    score1w: selection.score1w,
    coverage1w: selection.coverage1w,
    selectionMode: selection.selectionMode,
    forecastSource: selection.forecastSource,
    tuningRunHash: selection.tuningRunHash,
    evaluationProtocol: selection.evaluationProtocol,
    automaticChampion: selection.automaticChampion,
    forecasts: selection.forecasts,
    metricsByHorizon: selection.metricsByHorizon,
    modelAgreementByHorizon: selection.modelAgreementByHorizon,
  };
  const expected = sha256HexForValidation(
    canonicalJsonForValidation(representativeProjection),
  );
  return selection.representativeRevision === `rep-v1:${expected}`;
}

export function isRepresentativeSelectionV1(
  value: unknown,
): value is RepresentativeSelectionV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ROOT_KEYS) ||
    !isRouteId(value.route) ||
    !isObservation(value.currentObservation) ||
    !isModelId(value.modelId) ||
    !isNonEmptyString(value.modelName) ||
    !isNonEmptyString(value.modelVersion) ||
    !isFiniteNumber(value.score1w) ||
    !isBoundedPercent(value.coverage1w) ||
    (value.selectionMode !== "automatic" && value.selectionMode !== "manual") ||
    !isForecastSource(value.forecastSource) ||
    !hasValidTuningHash(value.forecastSource, value.tuningRunHash) ||
    !isNonEmptyString(value.evaluationProtocol) ||
    !isChampion(value.automaticChampion) ||
    typeof value.representativeRevision !== "string" ||
    !REVISION_PATTERN.test(value.representativeRevision) ||
    !Array.isArray(value.forecasts) ||
    value.forecasts.length !== 4 ||
    !Array.isArray(value.metricsByHorizon) ||
    value.metricsByHorizon.length !== 4 ||
    !Array.isArray(value.modelAgreementByHorizon) ||
    value.modelAgreementByHorizon.length !== 4
  ) {
    return false;
  }

  for (let index = 0; index < 4; index += 1) {
    const horizonWeeks = index + 1;
    if (
      !isForecast(value.forecasts[index], horizonWeeks) ||
      !isMetrics(value.metricsByHorizon[index], horizonWeeks) ||
      !isAgreement(
        value.modelAgreementByHorizon[index],
        horizonWeeks,
        value.currentObservation.value,
      )
    ) {
      return false;
    }
  }
  const selection = value as unknown as RepresentativeSelectionV1;
  const dates = [
    selection.currentObservation.date,
    ...selection.forecasts.map((forecast) => forecast.targetDate),
  ];
  return (
    dates.every((date, index) => index === 0 || dates[index - 1] < date) &&
    selection.score1w === selection.metricsByHorizon[0].totalScore &&
    selection.coverage1w === selection.metricsByHorizon[0].coverage.pct &&
    hasMatchingSelectedMember(selection) &&
    hasMatchingAutomaticChampion(selection) &&
    hasMatchingRepresentativeRevision(selection)
  );
}

export function createRouteSimulationKey(
  selection: RepresentativeSelectionV1,
): string {
  return JSON.stringify([
    "allocation-effective-v1",
    selection.route,
    selection.currentObservation.value,
    selection.modelName,
    selection.score1w,
    selection.coverage1w,
    selection.forecasts.map((forecast) => [
      forecast.targetDate,
      forecast.point,
      forecast.lower90,
      forecast.upper90,
    ]),
  ]);
}

export function adaptRepresentativeSelection(
  value: unknown,
): AllocationRepresentativeInput {
  if (!isRepresentativeSelectionV1(value)) {
    throw new TypeError("RepresentativeSelectionV1 validation failed");
  }
  return {
    selection: value,
    route: value.route,
    current: value.currentObservation.value,
    forecasts: value.forecasts.map((forecast) => ({
      horizonWeeks: forecast.horizonWeeks,
      targetDate: forecast.targetDate,
      point: forecast.point,
      lower90: forecast.lower90,
      upper90: forecast.upper90,
    })),
    routeSimulationKey: createRouteSimulationKey(value),
  };
}

export function adaptRepresentativeGatewayResult(
  result: RepresentativeGatewayResultV1,
): AllocationRepresentativeInput {
  if (
    !isRecord(result) ||
    !hasExactKeys(result, GATEWAY_ROOT_KEYS) ||
    result.schemaVersion !== GATEWAY_SCHEMA_VERSION ||
    result.state !== "READY" ||
    result.data === null ||
    result.error !== null ||
    !isGatewayMeta(result.meta, false)
  ) {
    throw new TypeError("Representative gateway result is not READY");
  }
  return adaptRepresentativeSelection(result.data);
}

function isGatewayMeta(value: unknown, unavailable: boolean): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, GATEWAY_META_KEYS) ||
    (unavailable
      ? value.mode !== "unavailable"
      : value.mode !== "live" && value.mode !== "cached" && value.mode !== "fixture") ||
    !isNonEmptyString(value.source) ||
    !(value.sourceUrl === null || isNonEmptyString(value.sourceUrl)) ||
    !(value.asOf === null || isNonEmptyString(value.asOf)) ||
    !isNonEmptyString(value.fetchedAt) ||
    !(value.unit === null || isNonEmptyString(value.unit)) ||
    typeof value.isEstimate !== "boolean" ||
    typeof value.attribution !== "string" ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === "string") ||
    !(value.provider === null || isNonEmptyString(value.provider)) ||
    !isRecord(value.cache) ||
    !hasExactKeys(value.cache, GATEWAY_CACHE_KEYS) ||
    typeof value.cache.hit !== "boolean" ||
    typeof value.cache.stale !== "boolean" ||
    !(value.cache.ageSeconds === null || isNonNegativeInteger(value.cache.ageSeconds))
  ) {
    return false;
  }
  return value.mode !== "cached" || value.cache.hit;
}

function isGatewayError(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, GATEWAY_ERROR_KEYS) ||
    !isNonEmptyString(value.code) ||
    !isNonEmptyString(value.message) ||
    typeof value.retryable !== "boolean" ||
    !(value.upstreamStatus === null || isNonNegativeInteger(value.upstreamStatus))
  ) {
    return false;
  }
  return (
    value.details === null ||
    (isRecord(value.details) &&
      hasExactKeys(value.details, GATEWAY_ERROR_DETAIL_KEYS) &&
      isNonEmptyString(value.details.reasonCode))
  );
}

export function isUnavailableRepresentativeGatewayResult(
  result: RepresentativeGatewayResultV1,
): boolean {
  return (
    isRecord(result) &&
    hasExactKeys(result, GATEWAY_ROOT_KEYS) &&
    result.schemaVersion === GATEWAY_SCHEMA_VERSION &&
    result.state === "UNAVAILABLE" &&
    result.data === null &&
    isGatewayError(result.error) &&
    isGatewayMeta(result.meta, true)
  );
}

export function createAllocationRunInput(
  representativeValue: unknown,
  draft: AllocationDraftInput,
): AllocationRunInput {
  const representative = adaptRepresentativeSelection(representativeValue);
  const forecasts = Object.freeze(
    representative.forecasts.map((forecast) => Object.freeze({ ...forecast })),
  );
  const simulation = Object.freeze({
    forecasts,
    current: representative.current,
    selectedHorizon: draft.selectedHorizon,
    fixed: draft.fixed,
    volume: draft.volume,
    alpha: CVAR_ALPHA,
    riskWeight: draft.riskWeight,
    seed: deriveRouteSeed(representative.route),
    rho: CVAR_WEEKLY_CORRELATION,
  });
  assertCvarSimulationInput(simulation);
  return Object.freeze({ representative, simulation });
}
