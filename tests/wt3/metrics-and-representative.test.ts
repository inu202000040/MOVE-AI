import assert from "node:assert/strict";
import test from "node:test";

import {
  agreementDirection,
  automaticChampion,
  buildRepresentativeSelection,
  fixedSeasonalNaiveScale,
  meanAbsolutePercentageError,
  meanAbsoluteScaledError,
  meanSquaredError,
  rootMeanSquaredError,
  scoreModelsForHorizon,
  validateRepresentativeSelection,
} from "../../app/freight-risk/models/core";
import { makeBaselineModels } from "./fixtures";

test("computes MAPE, MSE, RMSE, and fixed seasonal MASE from raw precision", () => {
  const pairs = [
    { actual: 100, predicted: 90 },
    { actual: 200, predicted: 220 },
  ];
  assert.equal(meanAbsolutePercentageError(pairs), 10);
  assert.equal(meanSquaredError(pairs), 250);
  assert.equal(rootMeanSquaredError(pairs), Math.sqrt(250));

  const training = [...Array.from({ length: 52 }, (_, index) => index + 1), 53, 55];
  const scale = fixedSeasonalNaiveScale(training, 52);
  assert.equal(scale, 52.5);
  assert.equal(meanAbsoluteScaledError(pairs, scale), 15 / 52.5);
});

test("reproduces the approved KNEI one-week automatic champion and score", () => {
  const models = makeBaselineModels();
  const scored = scoreModelsForHorizon(models.map((model) => ({
    modelId: model.modelId,
    metric: model.metricsByHorizon[0],
  })));
  const champion = automaticChampion(scored);
  assert.equal(champion.modelId, "sarimax");
  assert.ok(Math.abs(champion.metric.totalScore - 99.53184164830071) < 1e-12);
  assert.equal(scored.find(({ modelId }) => modelId === "naive")?.metric.coverage.pct, 100 * 48 / 52);
});

test("uses inclusive three-percent agreement boundaries", () => {
  assert.equal(agreementDirection(3), "up");
  assert.equal(agreementDirection(3.00001), "up");
  assert.equal(agreementDirection(-3), "down");
  assert.equal(agreementDirection(-3.00001), "down");
  assert.equal(agreementDirection(2.99999), "flat");
  assert.equal(agreementDirection(-2.99999), "flat");
});

test("builds automatic and manual representatives with a validated revision", () => {
  const models = makeBaselineModels();
  const automatic = buildRepresentativeSelection({
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    models,
  });
  assert.equal(automatic.modelId, "sarimax");
  assert.equal(automatic.selectionMode, "automatic");
  assert.deepEqual(
    automatic.modelAgreementByHorizon[0].members.map(({ direction }) => direction),
    ["up", "down", "flat", "up", "down", "flat", "flat", "flat"],
  );
  assert.deepEqual(
    {
      up: automatic.modelAgreementByHorizon[0].up,
      down: automatic.modelAgreementByHorizon[0].down,
      flat: automatic.modelAgreementByHorizon[0].flat,
    },
    { up: 2, down: 2, flat: 4 },
  );
  assert.equal(validateRepresentativeSelection(automatic), true);

  const manual = buildRepresentativeSelection({
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    models,
    manualModelId: "naive",
  });
  assert.equal(manual.modelId, "naive");
  assert.equal(manual.selectionMode, "manual");
  assert.equal(manual.automaticChampion.modelId, "sarimax");
  assert.notEqual(manual.representativeRevision, automatic.representativeRevision);
  assert.equal(validateRepresentativeSelection(manual), true);
});

test("fails representative validation after semantic tampering", () => {
  const selection = buildRepresentativeSelection({
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    models: makeBaselineModels(),
  });
  const tampered = { ...selection, coverage1w: selection.coverage1w + 1 };
  assert.equal(validateRepresentativeSelection(tampered), false);
  const agreement = selection.modelAgreementByHorizon[0];
  const changedMember = { ...agreement.members[0], changePct: agreement.members[0].changePct + 0.1 };
  const changedAgreement = {
    ...agreement,
    members: [changedMember, ...agreement.members.slice(1)],
  };
  assert.equal(validateRepresentativeSelection({
    ...selection,
    modelAgreementByHorizon: [changedAgreement, ...selection.modelAgreementByHorizon.slice(1)],
  }), false);
});
