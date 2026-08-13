import { ROUTE_IDS, type RouteId } from "../../../app/contracts/routes";
import { excelSerialToIsoDate, sortedRecord, sortCodeUnits } from "../canonical";
import {
  assertExactCount,
  groupBy,
  requireBoolean,
  requireInteger,
  requireNumber,
  requireString,
} from "../schema";
import type { TableRecord } from "../xlsx";

const MODEL_IDS = [
  "naive",
  "sarimax",
  "lightgbm",
  "xgboost",
  "random_forest",
  "prophet",
  "timesfm",
  "chronos",
] as const;

const HORIZONS = [1, 2, 3, 4] as const;

function routeId(record: TableRecord, key: string): RouteId {
  const value = requireString(record, key);
  if (!(ROUTE_IDS as readonly string[]).includes(value)) {
    throw new Error(`Unknown route ${value}`);
  }
  return value as RouteId;
}

function byHorizon(rows: readonly TableRecord[], label: string): readonly TableRecord[] {
  const ordered = [...rows].sort(
    (left, right) => requireInteger(left, "horizon_weeks") - requireInteger(right, "horizon_weeks"),
  );
  assertExactCount(ordered.length, 4, label);
  HORIZONS.forEach((horizon, index) => {
    if (requireInteger(ordered[index], "horizon_weeks") !== horizon) {
      throw new Error(`${label} horizon order mismatch`);
    }
  });
  return ordered;
}

export function produceForecastArtifacts(input: {
  readonly generatedAt: string;
  readonly history: readonly TableRecord[];
  readonly forecasts: readonly TableRecord[];
  readonly metrics: readonly TableRecord[];
  readonly evaluations: readonly TableRecord[];
}) {
  assertExactCount(input.history.length, 13 * 187, "history rows");
  assertExactCount(input.forecasts.length, 416, "forecast rows");
  assertExactCount(input.metrics.length, 416, "metric rows");
  assertExactCount(input.evaluations.length, 21_632, "evaluation rows");

  const historyByRoute = groupBy(input.history, (row) => routeId(row, "route_code"));
  const forecastByRoute = groupBy(input.forecasts, (row) => routeId(row, "route_id"));
  const metricsByRoute = groupBy(input.metrics, (row) => routeId(row, "route_id"));
  const evaluationsByRoute = groupBy(input.evaluations, (row) => routeId(row, "route_id"));

  const dates = [...new Set(input.history.map((row) => excelSerialToIsoDate(requireInteger(row, "date"))))]
    .sort(sortCodeUnits);
  assertExactCount(dates.length, 187, "history dates");

  const routeEntries = ROUTE_IDS.map((id) => {
    const historyRows = [...(historyByRoute.get(id) ?? [])].sort(
      (left, right) => requireInteger(left, "date") - requireInteger(right, "date"),
    );
    assertExactCount(historyRows.length, 187, `${id} history`);
    const routeDates = historyRows.map((row) => excelSerialToIsoDate(requireInteger(row, "date")));
    if (routeDates.some((date, index) => date !== dates[index])) {
      throw new Error(`${id} history dates are not aligned`);
    }
    const values = historyRows.map((row) => {
      if (requireString(row, "unit") !== "USD/FEU") throw new Error(`${id} history unit mismatch`);
      const value = requireNumber(row, "value");
      if (value <= 0) throw new Error(`${id} history contains nonpositive value`);
      return value;
    });

    const routeForecasts = forecastByRoute.get(id) ?? [];
    const routeMetrics = metricsByRoute.get(id) ?? [];
    const routeEvaluations = evaluationsByRoute.get(id) ?? [];
    assertExactCount(routeForecasts.length, 32, `${id} forecasts`);
    assertExactCount(routeMetrics.length, 32, `${id} metrics`);
    assertExactCount(routeEvaluations.length, 1_664, `${id} evaluations`);

    const models = MODEL_IDS.map((modelId) => {
      const modelForecasts = byHorizon(
        routeForecasts.filter((row) => requireString(row, "model_id") === modelId),
        `${id}/${modelId} forecasts`,
      );
      const modelMetrics = byHorizon(
        routeMetrics.filter((row) => requireString(row, "model_id") === modelId),
        `${id}/${modelId} metrics`,
      );
      const modelEvaluations = routeEvaluations.filter(
        (row) => requireString(row, "model_id") === modelId,
      );
      assertExactCount(modelEvaluations.length, 208, `${id}/${modelId} evaluations`);

      const metricsByHorizon = modelMetrics.map((row) => ({
        horizon: requireInteger(row, "horizon_weeks"),
        mapePct: requireNumber(row, "mape_pct"),
        mse: requireNumber(row, "mse"),
        rmse: requireNumber(row, "rmse"),
        mase: requireNumber(row, "mase"),
        coverage90Pct: requireNumber(row, "pi90_coverage_pct"),
        hits: requireInteger(row, "coverage_hits"),
        total: requireInteger(row, "coverage_total"),
        sampleSize: requireInteger(row, "sample_size"),
      }));

      const evaluationByHorizon = HORIZONS.map((horizon) => {
        const rows = modelEvaluations
          .filter((row) => requireInteger(row, "horizon_weeks") === horizon)
          .sort((left, right) => requireInteger(left, "origin_index") - requireInteger(right, "origin_index"));
        assertExactCount(rows.length, 52, `${id}/${modelId}/h${horizon} evaluation`);
        return {
          horizon,
          records: rows.map((row, index) => {
            if (requireInteger(row, "origin_index") !== index + 1) {
              throw new Error(`${id}/${modelId}/h${horizon} origin order mismatch`);
            }
            const forecastOrigin = excelSerialToIsoDate(requireInteger(row, "forecast_origin"));
            const targetDate = excelSerialToIsoDate(requireInteger(row, "target_date"));
            const predicted = requireNumber(row, "predicted");
            const actual = requireNumber(row, "actual");
            const difference = requireNumber(row, "difference");
            const absoluteError = requireNumber(row, "absolute_error");
            const lower90 = requireNumber(row, "lower90");
            const upper90 = requireNumber(row, "upper90");
            const covered90 = requireBoolean(row, "covered90");
            if (forecastOrigin >= targetDate) throw new Error("Evaluation target must follow origin");
            if (Math.abs(predicted - actual - difference) > 1e-8) {
              throw new Error("Evaluation difference mismatch");
            }
            if (Math.abs(Math.abs(difference) - absoluteError) > 1e-8) {
              throw new Error("Evaluation absolute error mismatch");
            }
            if ((lower90 <= actual && actual <= upper90) !== covered90) {
              throw new Error("Evaluation coverage mismatch");
            }
            return {
              forecastOrigin,
              targetDate,
              predicted,
              actual,
              difference,
              absoluteError,
              apePct: requireNumber(row, "ape_pct"),
              lower90,
              upper90,
              covered90,
            };
          }),
        };
      });

      const forecasts = modelForecasts.map((row) => {
        const value = requireNumber(row, "point_forecast");
        const lower90 = requireNumber(row, "lower90");
        const upper90 = requireNumber(row, "upper90");
        if (!(lower90 <= value && value <= upper90) || value <= 0) {
          throw new Error(`${id}/${modelId} invalid forecast interval`);
        }
        return {
          horizon: requireInteger(row, "horizon_weeks"),
          date: excelSerialToIsoDate(requireInteger(row, "target_date")),
          value,
          lower90,
          upper90,
          calibrationSampleSize: requireInteger(row, "calibration_sample_size"),
        };
      });

      return {
        id: modelId,
        name: requireString(modelForecasts[0], "model_name"),
        version: requireString(modelForecasts[0], "model_version"),
        metricsByHorizon,
        evaluationByHorizon,
        forecasts,
      };
    });

    return [
      id,
      {
        id,
        name: requireString(routeForecasts[0], "route_name"),
        unit: "USD/FEU",
        values,
        models,
      },
    ] as const;
  });

  const routes = sortedRecord(routeEntries);
  const snapshot = {
    schemaVersion: "glovis-freight-risk/v3",
    generatedAt: input.generatedAt,
    protocol: {
      horizonsWeeks: HORIZONS,
      evaluationOrigins: 52,
      initialCalibrationOrigins: 26,
      targetCoverage: 0.9,
      intervalMethod: "online absolute-error conformal",
      windowStrategy: "expanding",
      targetAvailabilityRule: "target_index_lte_forecast_origin",
    },
    source: {
      logicalIds: ["02", "13", "14", "15"],
      periodStart: dates[0],
      periodEnd: dates.at(-1),
      observationCount: dates.length,
    },
    dates,
    routes,
  };

  const evaluation = {
    schemaVersion: "move-ai/snapshot-evaluation/v3",
    generatedAt: input.generatedAt,
    evaluationOrigins: 52,
    routeCount: ROUTE_IDS.length,
    modelOrder: MODEL_IDS,
    horizonOrder: HORIZONS,
    routes: sortedRecord(
      Object.entries(routes).map(([id, route]) => [
        id,
        {
          models: sortedRecord(
            route.models.map((model) => [
              model.id,
              {
                recordsByHorizon: model.evaluationByHorizon.map((group) => ({
                  horizon: group.horizon,
                  recordCount: group.records.length,
                })),
              },
            ] as const),
          ),
        },
      ] as const),
    ),
  };

  return { snapshot, evaluation };
}
