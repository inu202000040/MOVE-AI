import { isRouteId } from "../../../contracts";
import { canonicalJson, computeTuningRunHash } from "./canonical";
import { isRiskModelId } from "./registry";
import {
  HORIZONS,
  ModelsContractError,
  type FourTuple,
  type HashedTuneResultV1,
  type HorizonWeeks,
  type RiskModelId,
  type TrainingWindowV1,
  type TuneEvaluationHorizonV1,
  type TuneEvaluationRecordV1,
  type TuneForecastV1,
  type TuneMetricV1,
  type TuneParameterValueV1,
  type TuneRequestV1,
  type TuneSuccessV1,
} from "./types";

interface NumericParameterSpecV1 {
  readonly kind: "number";
  readonly defaultValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
}

interface StringParameterSpecV1 {
  readonly kind: "string";
  readonly defaultValue: string;
  readonly values: readonly string[];
}

type ParameterSpecV1 = NumericParameterSpecV1 | StringParameterSpecV1;
type ModelParameterSpecsV1 = Readonly<Record<string, ParameterSpecV1>>;

const numberSpec = (
  defaultValue: number,
  minimum: number,
  maximum: number,
  step: number,
): NumericParameterSpecV1 => ({ kind: "number", defaultValue, minimum, maximum, step });

export const MODEL_PARAMETER_SPECS: Readonly<Record<RiskModelId, ModelParameterSpecsV1>> = {
  naive: {},
  sarimax: {
    p: numberSpec(1, 0, 3, 1),
    d: numberSpec(1, 0, 2, 1),
    q: numberSpec(1, 0, 3, 1),
    trend: { kind: "string", defaultValue: "t", values: ["n", "c", "t", "ct"] },
    seasonal_p: numberSpec(0, 0, 1, 1),
    seasonal_d: numberSpec(0, 0, 1, 1),
    seasonal_q: numberSpec(0, 0, 1, 1),
    seasonal_period: numberSpec(52, 4, 52, 1),
    maxiter: numberSpec(60, 20, 150, 10),
  },
  lightgbm: {
    n_estimators: numberSpec(80, 20, 500, 10),
    learning_rate: numberSpec(0.04, 0.005, 0.3, 0.005),
    num_leaves: numberSpec(15, 4, 127, 1),
    max_depth: numberSpec(4, 2, 12, 1),
    min_child_samples: numberSpec(8, 2, 40, 1),
    subsample: numberSpec(0.9, 0.5, 1, 0.05),
    colsample: numberSpec(0.9, 0.5, 1, 0.05),
    reg_lambda: numberSpec(0.5, 0, 20, 0.1),
  },
  xgboost: {
    n_estimators: numberSpec(80, 20, 500, 10),
    learning_rate: numberSpec(0.04, 0.005, 0.3, 0.005),
    max_depth: numberSpec(3, 2, 12, 1),
    min_child_weight: numberSpec(3, 1, 20, 1),
    subsample: numberSpec(0.9, 0.5, 1, 0.05),
    colsample: numberSpec(0.9, 0.5, 1, 0.05),
    reg_lambda: numberSpec(1, 0, 20, 0.1),
  },
  random_forest: {
    n_estimators: numberSpec(100, 20, 500, 10),
    max_depth: numberSpec(8, 2, 20, 1),
    min_samples_leaf: numberSpec(3, 1, 20, 1),
    max_features: numberSpec(0.75, 0.2, 1, 0.05),
  },
  prophet: {
    changepoint_prior_scale: numberSpec(0.1, 0.001, 0.5, 0.005),
    seasonality_prior_scale: numberSpec(10, 0.01, 20, 0.1),
    changepoint_range: numberSpec(0.8, 0.5, 0.95, 0.05),
  },
  timesfm: { context_length: numberSpec(187, 52, 187, 1) },
  chronos: { context_length: numberSpec(187, 52, 187, 1) },
};

export const TRAINING_WINDOWS = ["expanding", "rolling_104", "rolling_52"] as const;

export const TUNING_PRESETS = ["engine_default", "stable", "responsive"] as const;

export type TuningPresetIdV1 = (typeof TUNING_PRESETS)[number];

const TUNING_PRESET_OVERRIDES: Readonly<Record<
  RiskModelId,
  Readonly<Record<Exclude<TuningPresetIdV1, "engine_default">, Readonly<Record<string, TuneParameterValueV1>>>>
>> = {
  naive: { stable: {}, responsive: {} },
  sarimax: {
    stable: { trend: "c", maxiter: 100 },
    responsive: { p: 2, q: 2, maxiter: 100 },
  },
  lightgbm: {
    stable: { n_estimators: 180, learning_rate: 0.02, min_child_samples: 14, reg_lambda: 2 },
    responsive: {
      n_estimators: 120,
      learning_rate: 0.08,
      num_leaves: 31,
      max_depth: 6,
      min_child_samples: 4,
      reg_lambda: 0.2,
    },
  },
  xgboost: {
    stable: { n_estimators: 180, learning_rate: 0.02, min_child_weight: 6, reg_lambda: 2 },
    responsive: {
      n_estimators: 120,
      learning_rate: 0.08,
      max_depth: 6,
      min_child_weight: 1,
      reg_lambda: 0.2,
    },
  },
  random_forest: {
    stable: { n_estimators: 240, max_depth: 7, min_samples_leaf: 5, max_features: 0.65 },
    responsive: { n_estimators: 180, max_depth: 14, min_samples_leaf: 1, max_features: 1 },
  },
  prophet: {
    stable: { changepoint_prior_scale: 0.03, seasonality_prior_scale: 15, changepoint_range: 0.8 },
    responsive: { changepoint_prior_scale: 0.25, seasonality_prior_scale: 5, changepoint_range: 0.9 },
  },
  timesfm: {
    stable: { context_length: 187 },
    responsive: { context_length: 78 },
  },
  chronos: {
    stable: { context_length: 187 },
    responsive: { context_length: 78 },
  },
};

const TRAINING_WINDOW_SET: ReadonlySet<string> = new Set(TRAINING_WINDOWS);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function fail(code: string, message: string): never {
  throw new ModelsContractError(code, message);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    return fail("INVALID_OBJECT", `${label} must be a plain object`);
  }
  return value;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).toSorted();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("INVALID_KEYS", `${label} has an invalid field set`);
  }
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("NON_FINITE", `${label} must be a finite number`);
  }
  return value;
}

function nonNegative(value: unknown, label: string): number {
  const parsed = finite(value, label);
  if (parsed < 0) {
    return fail("NEGATIVE_VALUE", `${label} must not be negative`);
  }
  return parsed;
}

function integer(value: unknown, label: string): number {
  const parsed = finite(value, label);
  if (!Number.isInteger(parsed)) {
    return fail("NON_INTEGER", `${label} must be an integer`);
  }
  return parsed;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail("INVALID_STRING", `${label} must be a non-empty string`);
  }
  return value;
}

function isoDate(value: unknown, label: string): string {
  const parsed = stringValue(value, label);
  if (!ISO_DATE.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) {
    return fail("INVALID_DATE", `${label} must be an ISO date`);
  }
  return parsed;
}

function tuple4<T>(values: readonly T[], label: string): FourTuple<T> {
  if (values.length !== 4) {
    return fail("TUPLE_LENGTH", `${label} must contain four items`);
  }
  return values as unknown as FourTuple<T>;
}

function closeEnough(left: number, right: number, relativeTolerance = 1e-6): boolean {
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * relativeTolerance);
}

export function defaultParameters(modelId: RiskModelId): Readonly<Record<string, TuneParameterValueV1>> {
  return Object.fromEntries(
    Object.entries(MODEL_PARAMETER_SPECS[modelId]).map(([key, spec]) => [key, spec.defaultValue]),
  );
}

export function parametersForPreset(
  modelId: RiskModelId,
  preset: TuningPresetIdV1,
): Readonly<Record<string, TuneParameterValueV1>> {
  const parameters = preset === "engine_default"
    ? defaultParameters(modelId)
    : { ...defaultParameters(modelId), ...TUNING_PRESET_OVERRIDES[modelId][preset] };
  validateParameters(modelId, parameters);
  return parameters;
}

export function validateParameters(
  modelId: RiskModelId,
  parameters: Readonly<Record<string, TuneParameterValueV1>>,
): void {
  const specs = MODEL_PARAMETER_SPECS[modelId];
  exactKeys(parameters, Object.keys(specs), `${modelId} parameters`);
  for (const [key, spec] of Object.entries(specs)) {
    const value = parameters[key];
    if (spec.kind === "string") {
      if (typeof value !== "string" || !spec.values.includes(value)) {
        fail("INVALID_PARAMETER", `${modelId}.${key} is not an allowed value`);
      }
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      fail("INVALID_PARAMETER", `${modelId}.${key} must be finite`);
    }
    if (value < spec.minimum || value > spec.maximum) {
      fail("PARAMETER_RANGE", `${modelId}.${key} is outside its allowed range`);
    }
    const steps = value / spec.step;
    const isBoundary = value === spec.minimum || value === spec.maximum;
    if (!isBoundary && Math.abs(steps - Math.round(steps)) > 1e-8) {
      fail("PARAMETER_STEP", `${modelId}.${key} does not align to its step`);
    }
  }
}

export interface TuneRequestInputV1 {
  readonly routeCode: unknown;
  readonly modelId: unknown;
  readonly dates: readonly unknown[];
  readonly values: readonly unknown[];
  readonly trainingWindow: unknown;
  readonly parameters: unknown;
}

export function createTuneRequest(input: TuneRequestInputV1): TuneRequestV1 {
  if (!isRouteId(input.routeCode)) {
    return fail("INVALID_ROUTE", "routeCode is not in the canonical route catalog");
  }
  if (!isRiskModelId(input.modelId)) {
    return fail("INVALID_MODEL", "modelId is not in the canonical model registry");
  }
  if (input.dates.length !== 187 || input.values.length !== 187) {
    return fail("OBSERVATION_COUNT", "Tune requests require exactly 187 observations");
  }
  const dates = input.dates.map((value, index) => isoDate(value, `dates[${index}]`));
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index - 1] >= dates[index]) {
      return fail("DATE_ORDER", "Tune dates must be unique and strictly increasing");
    }
  }
  const values = input.values.map((value, index) => finite(value, `values[${index}]`));
  if (typeof input.trainingWindow !== "string" || !TRAINING_WINDOW_SET.has(input.trainingWindow)) {
    return fail("TRAINING_WINDOW", "trainingWindow is not allowed");
  }
  const parameterRecord = record(input.parameters, "parameters");
  const parameters: Record<string, TuneParameterValueV1> = {};
  for (const [key, value] of Object.entries(parameterRecord)) {
    if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
      return fail("INVALID_PARAMETER", `${key} must be a string or finite number`);
    }
    parameters[key] = value;
  }
  validateParameters(input.modelId, parameters);
  return {
    routeCode: input.routeCode,
    modelId: input.modelId,
    dates,
    values,
    trainingWindow: input.trainingWindow as TrainingWindowV1,
    parameters,
    evaluationOrigins: 52,
  };
}

function decodeForecast(value: unknown, expectedHorizon: HorizonWeeks): TuneForecastV1 {
  const item = record(value, `forecasts[${expectedHorizon - 1}]`);
  exactKeys(item, ["horizon", "targetDate", "value", "lower90", "upper90"], "tune forecast");
  if (item.horizon !== expectedHorizon) {
    return fail("HORIZON_ORDER", "Tune forecasts must be ordered 1 through 4");
  }
  const point = finite(item.value, "forecast.value");
  const lower90 = finite(item.lower90, "forecast.lower90");
  const upper90 = finite(item.upper90, "forecast.upper90");
  if (lower90 > point || point > upper90) {
    return fail("INTERVAL_ORDER", "Tune forecast interval is inverted");
  }
  return {
    horizon: expectedHorizon,
    targetDate: isoDate(item.targetDate, "forecast.targetDate"),
    value: point,
    lower90,
    upper90,
  };
}

function decodeMetric(value: unknown, expectedHorizon: HorizonWeeks): TuneMetricV1 {
  const item = record(value, `metricsByHorizon[${expectedHorizon - 1}]`);
  exactKeys(item, [
    "horizon", "mapePct", "mse", "rmse", "mase", "coverage90Pct", "hits", "total", "sampleSize",
  ], "tune metric");
  if (item.horizon !== expectedHorizon) {
    return fail("HORIZON_ORDER", "Tune metrics must be ordered 1 through 4");
  }
  const mapePct = nonNegative(item.mapePct, "metric.mapePct");
  const mse = nonNegative(item.mse, "metric.mse");
  const rmse = nonNegative(item.rmse, "metric.rmse");
  const mase = nonNegative(item.mase, "metric.mase");
  if (!closeEnough(rmse * rmse, mse)) {
    return fail("RMSE_MISMATCH", "RMSE must equal the square root of MSE");
  }
  const coverage90Pct = finite(item.coverage90Pct, "metric.coverage90Pct");
  const hits = integer(item.hits, "metric.hits");
  const total = integer(item.total, "metric.total");
  const sampleSize = integer(item.sampleSize, "metric.sampleSize");
  if (coverage90Pct < 0 || coverage90Pct > 100 || hits < 0 || total < 1 || hits > total) {
    return fail("COVERAGE_RANGE", "Coverage fields are outside their valid range");
  }
  if (!closeEnough(coverage90Pct, 100 * hits / total)) {
    return fail("COVERAGE_MISMATCH", "Coverage percentage does not match hits and total");
  }
  return { horizon: expectedHorizon, mapePct, mse, rmse, mase, coverage90Pct, hits, total, sampleSize };
}

function decodeEvaluationRecord(value: unknown, label: string): TuneEvaluationRecordV1 {
  const item = record(value, label);
  exactKeys(item, [
    "forecastOrigin", "targetDate", "predicted", "actual", "difference", "absoluteError", "apePct",
    "lower90", "upper90", "covered90",
  ], label);
  const predicted = finite(item.predicted, `${label}.predicted`);
  const actual = finite(item.actual, `${label}.actual`);
  const difference = finite(item.difference, `${label}.difference`);
  const absoluteError = nonNegative(item.absoluteError, `${label}.absoluteError`);
  const apePct = nonNegative(item.apePct, `${label}.apePct`);
  const lower90 = finite(item.lower90, `${label}.lower90`);
  const upper90 = finite(item.upper90, `${label}.upper90`);
  if (lower90 > upper90 || predicted < lower90 || predicted > upper90) {
    return fail("INTERVAL_ORDER", `${label} has an invalid interval`);
  }
  if (typeof item.covered90 !== "boolean") {
    return fail("INVALID_BOOLEAN", `${label}.covered90 must be boolean`);
  }
  if (!closeEnough(difference, predicted - actual) || !closeEnough(absoluteError, Math.abs(predicted - actual))) {
    return fail("EVALUATION_ARITHMETIC", `${label} error fields do not match predicted and actual`);
  }
  if (actual === 0 || !closeEnough(apePct, 100 * Math.abs((actual - predicted) / actual))) {
    return fail("EVALUATION_APE", `${label}.apePct is invalid`);
  }
  const covered = actual >= lower90 && actual <= upper90;
  if (item.covered90 !== covered) {
    return fail("EVALUATION_COVERAGE", `${label}.covered90 is invalid`);
  }
  return {
    forecastOrigin: isoDate(item.forecastOrigin, `${label}.forecastOrigin`),
    targetDate: isoDate(item.targetDate, `${label}.targetDate`),
    predicted,
    actual,
    difference,
    absoluteError,
    apePct,
    lower90,
    upper90,
    covered90: item.covered90,
  };
}

function decodeEvaluationGroup(value: unknown, expectedHorizon: HorizonWeeks): TuneEvaluationHorizonV1 {
  const item = record(value, `evaluationByHorizon[${expectedHorizon - 1}]`);
  exactKeys(item, ["horizon", "records"], "tune evaluation group");
  if (item.horizon !== expectedHorizon || !Array.isArray(item.records) || item.records.length !== 52) {
    return fail("EVALUATION_GROUP", "Each horizon requires exactly 52 ordered evaluation records");
  }
  return {
    horizon: expectedHorizon,
    records: item.records.map((entry, index) => decodeEvaluationRecord(entry, `evaluation[${expectedHorizon}][${index}]`)),
  };
}

export function decodeTuneSuccess(value: unknown): TuneSuccessV1 {
  const item = record(value, "TuneSuccessV1");
  exactKeys(item, [
    "status", "routeCode", "modelId", "modelVersion", "forecastOrigin", "maseProtocol", "trainingWindow",
    "evaluationOrigins", "parameters", "forecasts", "metricsByHorizon", "evaluationByHorizon", "elapsedMs",
    "methodologyKo",
  ], "TuneSuccessV1");
  if (item.status !== "success" || !isRouteId(item.routeCode) || !isRiskModelId(item.modelId)) {
    return fail("TUNE_IDENTITY", "Tune success identity is invalid");
  }
  if (item.maseProtocol !== "seasonal-naive-52-fixed" || item.evaluationOrigins !== 52) {
    return fail("TUNE_PROTOCOL", "Tune evaluation protocol is invalid");
  }
  if (typeof item.trainingWindow !== "string" || !TRAINING_WINDOW_SET.has(item.trainingWindow)) {
    return fail("TRAINING_WINDOW", "Tune training window is invalid");
  }
  const parameterRecord = record(item.parameters, "parameters");
  const parameters: Record<string, TuneParameterValueV1> = {};
  for (const [key, parameter] of Object.entries(parameterRecord)) {
    if (typeof parameter !== "string" && (typeof parameter !== "number" || !Number.isFinite(parameter))) {
      return fail("INVALID_PARAMETER", `${key} must be a string or finite number`);
    }
    parameters[key] = parameter;
  }
  validateParameters(item.modelId, parameters);
  const forecastValues = item.forecasts;
  const metricValues = item.metricsByHorizon;
  const evaluationValues = item.evaluationByHorizon;
  if (!Array.isArray(forecastValues) || !Array.isArray(metricValues) || !Array.isArray(evaluationValues)) {
    return fail("TUNE_TUPLES", "Tune forecast, metric, and evaluation tuples are required");
  }
  if (forecastValues.length !== 4 || metricValues.length !== 4 || evaluationValues.length !== 4) {
    return fail("TUPLE_LENGTH", "Tune forecast, metric, and evaluation tuples must contain four items");
  }
  const forecasts = tuple4(HORIZONS.map((horizon) => decodeForecast(forecastValues[horizon - 1], horizon)), "forecasts");
  const metricsByHorizon = tuple4(HORIZONS.map((horizon) => decodeMetric(metricValues[horizon - 1], horizon)), "metricsByHorizon");
  const evaluationByHorizon = tuple4(HORIZONS.map((horizon) => decodeEvaluationGroup(evaluationValues[horizon - 1], horizon)), "evaluationByHorizon");
  for (const group of evaluationByHorizon) {
    for (let index = 1; index < group.records.length; index += 1) {
      if (group.records[index - 1].targetDate >= group.records[index].targetDate) {
        return fail("EVALUATION_ORDER", "Evaluation target dates must be strictly increasing");
      }
    }
  }
  for (let index = 1; index < forecasts.length; index += 1) {
    if (forecasts[index - 1].targetDate >= forecasts[index].targetDate) {
      return fail("FORECAST_ORDER", "Tune forecast target dates must be strictly increasing");
    }
  }
  for (const horizon of HORIZONS) {
    const metric = metricsByHorizon[horizon - 1];
    const records = evaluationByHorizon[horizon - 1].records;
    const hits = records.filter(({ covered90 }) => covered90).length;
    if (metric.sampleSize !== records.length || metric.total !== records.length || metric.hits !== hits) {
      return fail("EVALUATION_METRIC_MISMATCH", `Horizon ${horizon} metrics do not match evaluation records`);
    }
  }
  return {
    status: "success",
    routeCode: item.routeCode,
    modelId: item.modelId,
    modelVersion: stringValue(item.modelVersion, "modelVersion"),
    forecastOrigin: isoDate(item.forecastOrigin, "forecastOrigin"),
    maseProtocol: "seasonal-naive-52-fixed",
    trainingWindow: item.trainingWindow as TrainingWindowV1,
    evaluationOrigins: 52,
    parameters,
    forecasts,
    metricsByHorizon,
    evaluationByHorizon,
    elapsedMs: nonNegative(item.elapsedMs, "elapsedMs"),
    methodologyKo: stringValue(item.methodologyKo, "methodologyKo"),
  };
}

export function decodeTuneSuccessForRequest(value: unknown, request: TuneRequestV1): TuneSuccessV1 {
  const result = decodeTuneSuccess(value);
  if (result.routeCode !== request.routeCode || result.modelId !== request.modelId) {
    return fail("REQUEST_RESPONSE_IDENTITY", "Tune response does not match the request identity");
  }
  const lastDate = request.dates.at(-1);
  if (result.forecastOrigin !== lastDate || result.trainingWindow !== request.trainingWindow) {
    return fail("REQUEST_RESPONSE_PROTOCOL", "Tune response does not match the request protocol");
  }
  if (canonicalJson(result.parameters) !== canonicalJson(request.parameters)) {
    return fail("REQUEST_RESPONSE_PARAMETERS", "Tune response parameters do not match the request");
  }
  return result;
}

export type TuningSessionStatusV1 = "idle" | "running" | "success" | "error";

export interface TuningSessionStateV1 {
  readonly status: TuningSessionStatusV1;
  readonly accepted: HashedTuneResultV1 | null;
  readonly candidate: HashedTuneResultV1 | null;
  readonly pendingRunId: string | null;
  readonly pendingRequest: TuneRequestV1 | null;
  readonly error: string | null;
}

export function createTuningSession(
  accepted: HashedTuneResultV1 | null = null,
): TuningSessionStateV1 {
  return {
    status: "idle",
    accepted,
    candidate: null,
    pendingRunId: null,
    pendingRequest: null,
    error: null,
  };
}

export function startTuningRun(
  state: TuningSessionStateV1,
  runId: string,
  request: TuneRequestV1,
): TuningSessionStateV1 {
  if (state.status === "running" || runId.length === 0) {
    return fail("TUNING_STATE", "A non-empty run id can start only from a non-running state");
  }
  return {
    ...state,
    status: "running",
    candidate: null,
    pendingRunId: runId,
    pendingRequest: request,
    error: null,
  };
}

export function resolveTuningRun(
  state: TuningSessionStateV1,
  runId: string,
  value: unknown,
): TuningSessionStateV1 {
  if (state.status !== "running" || state.pendingRunId !== runId) {
    return state;
  }
  try {
    if (state.pendingRequest === null) {
      return fail("TUNING_STATE", "A running state must retain its validated request");
    }
    const result = decodeTuneSuccessForRequest(value, state.pendingRequest);
    const candidate = { result, tuningRunHash: computeTuningRunHash(result) };
    return {
      ...state,
      status: "success",
      candidate,
      pendingRunId: null,
      pendingRequest: null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "재측정 결과를 검증하지 못했습니다.";
    return {
      ...state,
      status: "error",
      candidate: null,
      pendingRunId: null,
      pendingRequest: null,
      error: message,
    };
  }
}

export function rejectTuningRun(
  state: TuningSessionStateV1,
  runId: string,
  message: string,
): TuningSessionStateV1 {
  if (state.status !== "running" || state.pendingRunId !== runId) {
    return state;
  }
  return {
    ...state,
    status: "error",
    candidate: null,
    pendingRunId: null,
    pendingRequest: null,
    error: message,
  };
}

export function keepTuningCandidate(state: TuningSessionStateV1): TuningSessionStateV1 {
  if (state.status !== "success" || state.candidate === null) {
    return fail("TUNING_STATE", "Only a successful candidate can be kept");
  }
  return createTuningSession(state.candidate);
}

export function rollbackTuningCandidate(state: TuningSessionStateV1): TuningSessionStateV1 {
  if (state.status !== "success" || state.candidate === null) {
    return fail("TUNING_STATE", "Only a successful candidate can be rolled back");
  }
  return createTuningSession(state.accepted);
}

export function visibleTuningResult(state: TuningSessionStateV1): HashedTuneResultV1 | null {
  return state.candidate ?? state.accepted;
}
