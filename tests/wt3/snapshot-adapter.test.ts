import assert from "node:assert/strict";
import test from "node:test";

import { ROUTE_IDS, ROUTE_LABELS } from "../../app/contracts";
import { MODEL_REGISTRY, type TuneEvaluationRecordV1 } from "../../app/freight-risk/models/core";
import {
  KNEI_BASELINE_MODELS,
  KNEI_HISTORY,
  kneiEvaluationEvidence,
} from "../../app/freight-risk/models/reference-knei";
import { modelsCatalogFromDecodedSnapshot, modelsRouteFromDecodedSnapshot } from "../../app/freight-risk/models/snapshot-adapter";

interface MutableModelFixture {
  id: string;
  name: string;
  version: string;
  metricsByHorizon: Array<{
    horizon: number; mapePct: number; mse: number; rmse: number; mase: number;
    coverage90Pct: number; hits: number; total: number; sampleSize: number;
  }>;
  evaluationByHorizon: Array<{ horizon: number; records: TuneEvaluationRecordV1[] }>;
  forecasts: Array<{
    horizon: number; date: string; value: number; lower90: number; upper90: number;
    calibrationSampleSize: number;
  }>;
}

interface MutableRouteFixture {
  id: string;
  name: string;
  unit: string;
  values: number[];
  models: MutableModelFixture[];
}

interface MutableSnapshotFixture {
  schemaVersion: string;
  generatedAt: string;
  protocol: Record<string, unknown>;
  source: Record<string, unknown>;
  dates: string[];
  routes: Record<(typeof ROUTE_IDS)[number], MutableRouteFixture>;
}

function snapshotFixture(): MutableSnapshotFixture {
  const models = KNEI_BASELINE_MODELS.map((model) => ({
    id: model.modelId,
    name: model.modelName,
    version: model.modelVersion,
    metricsByHorizon: model.metricsByHorizon.map((metric) => ({
      horizon: metric.horizonWeeks,
      mapePct: metric.mapePct,
      mse: metric.mse,
      rmse: Number(metric.rmse.toFixed(2)),
      mase: metric.mase,
      coverage90Pct: Number(metric.coverage.pct.toFixed(1)),
      hits: metric.coverage.hits,
      total: metric.coverage.total,
      sampleSize: metric.coverage.sampleSize,
    })),
    evaluationByHorizon: kneiEvaluationEvidence(model.modelId).map((records, index) => ({
      horizon: index + 1,
      records: [...records],
    })),
    forecasts: model.forecasts.map((forecast) => ({
      horizon: forecast.horizonWeeks,
      date: forecast.targetDate,
      value: forecast.point,
      lower90: forecast.lower90,
      upper90: forecast.upper90,
      calibrationSampleSize: 78,
    })),
  }));
  return {
    schemaVersion: "glovis-freight-risk/v3",
    generatedAt: "2026-08-13T00:00:00+09:00",
    protocol: {},
    source: {},
    dates: KNEI_HISTORY.map(({ date }) => date),
    routes: Object.fromEntries(ROUTE_IDS.map((route) => [route, {
        id: route,
        name: ROUTE_LABELS[route],
        unit: "USD/FEU",
        values: KNEI_HISTORY.map(({ value }) => value),
        models: structuredClone(models),
      }])) as Record<(typeof ROUTE_IDS)[number], MutableRouteFixture>,
  };
}

test("projects one validated snapshot route into all eight Models inputs", () => {
  const projected = modelsRouteFromDecodedSnapshot(snapshotFixture(), "KNEI");
  assert.equal(projected.history.length, 187);
  assert.equal(projected.currentObservation.date, "2026-08-03");
  assert.equal(projected.currentObservation.value, 4_884);
  assert.deepEqual(projected.models.map(({ modelId }) => modelId), MODEL_REGISTRY.map(({ id }) => id));
  assert.equal(projected.evaluationByModel.sarimax[3].length, 52);
  assert.equal(projected.models[1].metricsByHorizon[0].coverage.pct, 100 * projected.models[1].metricsByHorizon[0].coverage.hits / 52);
  assert.equal(Object.keys(modelsCatalogFromDecodedSnapshot(snapshotFixture())).length, 13);
});

test("fails closed on a reordered model, inverted interval, or incomplete evidence", () => {
  const reordered = structuredClone(snapshotFixture());
  [reordered.routes.KNEI.models[0], reordered.routes.KNEI.models[1]] = [reordered.routes.KNEI.models[1], reordered.routes.KNEI.models[0]];
  assert.throws(() => modelsRouteFromDecodedSnapshot(reordered, "KNEI"), /registry/u);

  const inverted = structuredClone(snapshotFixture());
  inverted.routes.KNEI.models[0].forecasts[0].lower90 = inverted.routes.KNEI.models[0].forecasts[0].value + 1;
  assert.throws(() => modelsRouteFromDecodedSnapshot(inverted, "KNEI"), /interval/u);

  const incomplete = structuredClone(snapshotFixture());
  incomplete.routes.KNEI.models[0].evaluationByHorizon[0].records.pop();
  assert.throws(() => modelsRouteFromDecodedSnapshot(incomplete, "KNEI"), /52/u);

  const tampered = structuredClone(snapshotFixture());
  tampered.routes.KNEI.models[0].metricsByHorizon[0].mapePct = 999;
  assert.throws(() => modelsCatalogFromDecodedSnapshot(tampered), /metrics do not match/u);

  const missingRoute = structuredClone(snapshotFixture());
  delete (missingRoute.routes as Partial<Record<(typeof ROUTE_IDS)[number], MutableRouteFixture>>).KMEI;
  assert.throws(() => modelsCatalogFromDecodedSnapshot(missingRoute), /13-route/u);
});
