import { ROUTE_IDS, ROUTE_LABELS, type RouteId } from "../../contracts";

import { MODEL_REGISTRY } from "./core/registry";
import {
  fixedSeasonalNaiveScale,
  meanAbsolutePercentageError,
  meanAbsoluteScaledError,
  meanSquaredError,
} from "./core/metrics";
import {
  HORIZONS,
  ModelsContractError,
  type CurrentObservationV1,
  type EightTuple,
  type FourTuple,
  type ModelProjectionV1,
  type RiskModelId,
  type TuneEvaluationRecordV1,
} from "./core/types";

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface SnapshotHistoryPointV1 {
  readonly date: string;
  readonly value: number;
}

export interface ModelsSnapshotRouteV1 {
  readonly route: RouteId;
  readonly routeName: string;
  readonly currentObservation: CurrentObservationV1;
  readonly history: readonly SnapshotHistoryPointV1[];
  readonly models: EightTuple<ModelProjectionV1>;
  readonly evaluationByModel: Readonly<Record<RiskModelId, FourTuple<readonly TuneEvaluationRecordV1[]>>>;
}

export type ModelsSnapshotCatalogV1 = Readonly<Record<RouteId, ModelsSnapshotRouteV1>>;

function fail(code: string, message: string): never {
  throw new ModelsContractError(code, message);
}

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("SNAPSHOT_SHAPE", `${label} must be an object`);
  }
  return value as UnknownRecord;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) return fail("SNAPSHOT_SHAPE", `${label} must be an array`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("SNAPSHOT_NUMBER", `${label} must be finite`);
  }
  return value;
}

function nonNegative(value: unknown, label: string): number {
  const parsed = finite(value, label);
  if (parsed < 0) return fail("SNAPSHOT_NUMBER", `${label} must be non-negative`);
  return parsed;
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value)) return fail("SNAPSHOT_INTEGER", `${label} must be an integer`);
  return value as number;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail("SNAPSHOT_STRING", `${label} must be non-empty text`);
  }
  return value;
}

function isoDate(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) {
    return fail("SNAPSHOT_DATE", `${label} must be an ISO date`);
  }
  return parsed;
}

function tuple4<T>(values: readonly T[], label: string): FourTuple<T> {
  if (values.length !== 4) return fail("SNAPSHOT_TUPLE", `${label} must contain four items`);
  return values as unknown as FourTuple<T>;
}

function closeEnough(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance;
}

function decodeEvaluationRecord(value: unknown, label: string): TuneEvaluationRecordV1 {
  const item = record(value, label);
  const predicted = finite(item.predicted, `${label}.predicted`);
  const actual = finite(item.actual, `${label}.actual`);
  const difference = finite(item.difference, `${label}.difference`);
  const absoluteError = nonNegative(item.absoluteError, `${label}.absoluteError`);
  const apePct = nonNegative(item.apePct, `${label}.apePct`);
  const lower90 = finite(item.lower90, `${label}.lower90`);
  const upper90 = finite(item.upper90, `${label}.upper90`);
  if (lower90 > predicted || predicted > upper90 || !closeEnough(difference, predicted - actual, 1e-6) || !closeEnough(absoluteError, Math.abs(predicted - actual), 1e-6)) {
    return fail("SNAPSHOT_EVALUATION", `${label} has inconsistent error or interval fields`);
  }
  if (actual === 0 || !closeEnough(apePct, 100 * Math.abs((actual - predicted) / actual), 0.011)) {
    return fail("SNAPSHOT_EVALUATION", `${label}.apePct is inconsistent`);
  }
  const covered90 = item.covered90;
  if (typeof covered90 !== "boolean" || covered90 !== (actual >= lower90 && actual <= upper90)) {
    return fail("SNAPSHOT_EVALUATION", `${label}.covered90 is inconsistent`);
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
    covered90,
  };
}

function decodeModel(
  value: unknown,
  expectedModelId: RiskModelId,
  historyDates: readonly string[],
  historyValues: readonly number[],
): Readonly<{ model: ModelProjectionV1; evaluation: FourTuple<readonly TuneEvaluationRecordV1[]> }> {
  const item = record(value, `models.${expectedModelId}`);
  const definition = MODEL_REGISTRY.find(({ id }) => id === expectedModelId);
  if (definition === undefined || item.id !== expectedModelId || item.name !== definition.name) {
    return fail("SNAPSHOT_MODEL_ORDER", `models.${expectedModelId} does not match the registry`);
  }
  const forecastRows = array(item.forecasts, `${expectedModelId}.forecasts`);
  const metricRows = array(item.metricsByHorizon, `${expectedModelId}.metricsByHorizon`);
  const evaluationRows = array(item.evaluationByHorizon, `${expectedModelId}.evaluationByHorizon`);
  if (forecastRows.length !== 4 || metricRows.length !== 4 || evaluationRows.length !== 4) {
    return fail("SNAPSHOT_TUPLE", `${expectedModelId} requires four ordered horizon groups`);
  }

  const forecasts = tuple4(HORIZONS.map((horizon) => {
    const row = record(forecastRows[horizon - 1], `${expectedModelId}.forecasts[${horizon - 1}]`);
    if (row.horizon !== horizon) return fail("SNAPSHOT_HORIZON", "Forecast horizons must be ordered 1 through 4");
    const point = finite(row.value, "forecast.value");
    const lower90 = finite(row.lower90, "forecast.lower90");
    const upper90 = finite(row.upper90, "forecast.upper90");
    const calibrationSampleSize = integer(row.calibrationSampleSize, "forecast.calibrationSampleSize");
    if (lower90 > point || point > upper90 || calibrationSampleSize < 26) {
      return fail("SNAPSHOT_FORECAST", "Forecast interval or calibration sample is invalid");
    }
    return {
      horizonWeeks: horizon,
      targetDate: isoDate(row.date, "forecast.date"),
      point,
      lower90,
      upper90,
    };
  }), `${expectedModelId}.forecasts`);

  const metricsByHorizon = tuple4(HORIZONS.map((horizon) => {
    const row = record(metricRows[horizon - 1], `${expectedModelId}.metrics[${horizon - 1}]`);
    if (row.horizon !== horizon) return fail("SNAPSHOT_HORIZON", "Metric horizons must be ordered 1 through 4");
    const mapePct = nonNegative(row.mapePct, "metric.mapePct");
    const mse = nonNegative(row.mse, "metric.mse");
    const rmse = nonNegative(row.rmse, "metric.rmse");
    const mase = nonNegative(row.mase, "metric.mase");
    const coverage90Pct = finite(row.coverage90Pct, "metric.coverage90Pct");
    const hits = integer(row.hits, "metric.hits");
    const total = integer(row.total, "metric.total");
    const sampleSize = integer(row.sampleSize, "metric.sampleSize");
    if (!closeEnough(rmse, Math.sqrt(mse), 0.01) || coverage90Pct < 0 || coverage90Pct > 100 || hits < 0 || hits > total || total !== 52 || sampleSize !== 52 || !closeEnough(coverage90Pct, 100 * hits / total, 0.1)) {
      return fail("SNAPSHOT_METRIC", `${expectedModelId} horizon ${horizon} metrics are inconsistent`);
    }
    return {
      horizonWeeks: horizon,
      mapePct,
      mse,
      rmse: Math.sqrt(mse),
      mase,
      coverage: {
        pct: 100 * hits / total,
        hits,
        total,
        sampleSize,
        target: 0.9 as const,
        intervalMethod: "empirical-central-90",
      },
    };
  }), `${expectedModelId}.metricsByHorizon`);

  const evaluation = tuple4(HORIZONS.map((horizon) => {
    const group = record(evaluationRows[horizon - 1], `${expectedModelId}.evaluation[${horizon - 1}]`);
    const records = array(group.records, `${expectedModelId}.evaluation[${horizon - 1}].records`);
    if (group.horizon !== horizon || records.length !== 52) {
      return fail("SNAPSHOT_EVALUATION", "Each horizon requires exactly 52 ordered evaluation records");
    }
    const decoded = records.map((recordValue, index) => decodeEvaluationRecord(recordValue, `${expectedModelId}.evaluation[${horizon - 1}].records[${index}]`));
    for (let index = 1; index < decoded.length; index += 1) {
      if (decoded[index - 1].targetDate >= decoded[index].targetDate) {
        return fail("SNAPSHOT_EVALUATION", "Evaluation target dates must be strictly increasing");
      }
    }
    const hits = decoded.filter(({ covered90 }) => covered90).length;
    if (hits !== metricsByHorizon[horizon - 1].coverage.hits) {
      return fail("SNAPSHOT_EVALUATION", "Evaluation coverage does not match metrics");
    }
    return decoded;
  }), `${expectedModelId}.evaluationByHorizon`);

  const firstOriginIndex = historyDates.indexOf(evaluation[0][0]?.forecastOrigin ?? "");
  if (firstOriginIndex < 52) {
    return fail("SNAPSHOT_EVALUATION", `${expectedModelId} evaluation origins do not align with history`);
  }
  const fixedScale = fixedSeasonalNaiveScale(historyValues.slice(0, firstOriginIndex + 1), 52);
  for (const horizon of HORIZONS) {
    const metric = metricsByHorizon[horizon - 1];
    const pairs = evaluation[horizon - 1].map(({ actual, predicted }) => ({ actual, predicted }));
    const computedMape = meanAbsolutePercentageError(pairs);
    const computedMse = meanSquaredError(pairs);
    const computedMase = meanAbsoluteScaledError(pairs, fixedScale);
    if (!closeEnough(metric.mapePct, computedMape, 0.01)
      || !closeEnough(metric.mse, computedMse, 2.2)
      || !closeEnough(metric.mase, computedMase, 0.001)) {
      return fail("SNAPSHOT_METRIC", `${expectedModelId} horizon ${horizon} metrics do not match evaluation records`);
    }
  }

  return {
    model: {
      modelId: expectedModelId,
      modelName: definition.name,
      modelVersion: string(item.version, `${expectedModelId}.version`),
      forecastSource: "baseline",
      tuningRunHash: null,
      evaluationProtocol: "seasonal-naive-52-fixed|rolling-origin-52|empirical-central-90",
      forecasts,
      metricsByHorizon,
    },
    evaluation,
  };
}

export function modelsRouteFromDecodedSnapshot(
  value: unknown,
  route: RouteId,
): ModelsSnapshotRouteV1 {
  const root = record(value, "snapshot");
  if (root.schemaVersion !== "glovis-freight-risk/v3") {
    return fail("SNAPSHOT_VERSION", "Snapshot schema version is invalid");
  }
  const dates = array(root.dates, "snapshot.dates").map((date, index) => isoDate(date, `snapshot.dates[${index}]`));
  if (dates.length !== 187 || dates[0] !== "2022-11-07" || dates.at(-1) !== "2026-08-03") {
    return fail("SNAPSHOT_HISTORY", "Snapshot history period or count is invalid");
  }
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index - 1] >= dates[index]) return fail("SNAPSHOT_HISTORY", "Snapshot dates must be strictly increasing");
  }
  const routeItem = record(record(root.routes, "snapshot.routes")[route], `snapshot.routes.${route}`);
  if (routeItem.id !== route || routeItem.name !== ROUTE_LABELS[route] || routeItem.unit !== "USD/FEU") {
    return fail("SNAPSHOT_ROUTE", "Snapshot route identity or unit is invalid");
  }
  const values = array(routeItem.values, `${route}.values`).map((valueItem, index) => finite(valueItem, `${route}.values[${index}]`));
  if (values.length !== dates.length) return fail("SNAPSHOT_HISTORY", "Snapshot dates and values must have equal length");
  const rawModels = array(routeItem.models, `${route}.models`);
  if (rawModels.length !== MODEL_REGISTRY.length) return fail("SNAPSHOT_MODELS", "Snapshot must contain all eight models");
  const decoded = MODEL_REGISTRY.map((definition, index) => decodeModel(rawModels[index], definition.id, dates, values));
  const models = decoded.map(({ model }) => model) as unknown as EightTuple<ModelProjectionV1>;
  const evaluationByModel = Object.fromEntries(decoded.map(({ model, evaluation }) => [model.modelId, evaluation])) as Readonly<Record<RiskModelId, FourTuple<readonly TuneEvaluationRecordV1[]>>>;
  const history = dates.map((date, index) => ({ date, value: values[index] }));
  return {
    route,
    routeName: string(routeItem.name, `${route}.name`),
    currentObservation: { date: dates[dates.length - 1], value: values[values.length - 1], unit: "USD/FEU" },
    history,
    models,
    evaluationByModel,
  };
}

export function modelsCatalogFromDecodedSnapshot(value: unknown): ModelsSnapshotCatalogV1 {
  const root = record(value, "snapshot");
  const routes = record(root.routes, "snapshot.routes");
  const routeKeys = Object.keys(routes).toSorted();
  const expectedKeys = [...ROUTE_IDS].toSorted();
  if (routeKeys.length !== expectedKeys.length || routeKeys.some((key, index) => key !== expectedKeys[index])) {
    return fail("SNAPSHOT_ROUTE_SET", "Snapshot must contain the exact canonical 13-route set");
  }
  return Object.fromEntries(
    ROUTE_IDS.map((route) => [route, modelsRouteFromDecodedSnapshot(value, route)]),
  ) as ModelsSnapshotCatalogV1;
}
