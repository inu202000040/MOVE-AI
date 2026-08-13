import assert from "node:assert/strict";
import test from "node:test";

import {
  meanAbsolutePercentageError,
  meanSquaredError,
} from "../../app/freight-risk/models/core/metrics";
import { buildRepresentativeSelection } from "../../app/freight-risk/models/core/representative";
import { RISK_MODEL_IDS } from "../../app/freight-risk/models/core/types";
import {
  KNEI_BASELINE_MODELS,
  KNEI_HISTORY,
  kneiEvaluationEvidence,
} from "../../app/freight-risk/models/reference-knei";
import {
  modelChangePct,
  performanceRows,
  selectedLegendLabel,
  zoomedHistoryWindowSize,
} from "../../app/freight-risk/models/view-model";

const current = { date: "2026-08-03", value: 4884, unit: "USD/FEU" } as const;

test("approved KNEI reference slice retains the complete input and eight-model tuples", () => {
  assert.equal(KNEI_HISTORY.length, 187);
  assert.deepEqual(KNEI_HISTORY[0], { date: "2022-11-07", value: 4016 });
  assert.deepEqual(KNEI_HISTORY.at(-1), { date: "2026-08-03", value: 4884 });
  assert.deepEqual(KNEI_BASELINE_MODELS.map(({ modelId }) => modelId), RISK_MODEL_IDS);
  for (const model of KNEI_BASELINE_MODELS) {
    assert.equal(model.forecasts.length, 4);
    assert.equal(model.metricsByHorizon.length, 4);
    assert.equal(kneiEvaluationEvidence(model.modelId)[0].length, 52);
  }
});

test("approved KNEI golden selects SARIMAX and ranks all eight models", () => {
  const representative = buildRepresentativeSelection({
    route: "KNEI",
    currentObservation: current,
    models: KNEI_BASELINE_MODELS,
  });
  assert.equal(representative.modelId, "sarimax");
  assert.equal(representative.selectionMode, "automatic");
  assert.equal(representative.score1w, 99.53184164830071);
  assert.deepEqual(
    performanceRows(KNEI_BASELINE_MODELS, 1, representative).map(({ model }) => model.modelId),
    ["sarimax", "timesfm", "naive", "xgboost", "random_forest", "lightgbm", "chronos", "prophet"],
  );
  assert.deepEqual(
    representative.modelAgreementByHorizon.map(({ up, down, flat }) => [up, down, flat]),
    [[1, 4, 3], [1, 4, 3], [2, 4, 2], [0, 4, 4]],
  );
});

test("evidence records reproduce metrics within the approved row precision", () => {
  const records = kneiEvaluationEvidence("sarimax")[0];
  const pairs = records.map(({ actual, predicted }) => ({ actual, predicted }));
  assert.ok(Math.abs(meanAbsolutePercentageError(pairs) - 3.6) < 0.01);
  assert.ok(Math.abs(meanSquaredError(pairs) - 22818.49) < 0.5);
});

test("view helpers preserve selection and signed change semantics", () => {
  assert.equal(selectedLegendLabel(new Set()), "전체 보기 · 0개 선택");
  assert.equal(selectedLegendLabel(new Set(["sarimax", "timesfm"])), "전체 보기 · 2개 선택");
  assert.ok(Math.abs(modelChangePct(4828.98, 4884) - -1.1265356265356241) < 1e-12);
});

test("forecast history zoom clamps between the recent and full ranges", () => {
  assert.equal(zoomedHistoryWindowSize(187, 187, "in"), 124);
  assert.equal(zoomedHistoryWindowSize(4, 187, "in"), 4);
  assert.equal(zoomedHistoryWindowSize(4, 187, "out"), 6);
  assert.equal(zoomedHistoryWindowSize(180, 187, "out"), 187);
  assert.equal(zoomedHistoryWindowSize(1, 3, "in"), 3);
});
