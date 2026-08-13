import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRepresentativeSelection,
  computeTuningRunHash,
  createTuneRequest,
  createTuningSession,
  decodeTuneSuccess,
  defaultParameters,
  keepTuningCandidate,
  mergeAcceptedTunes,
  rejectTuningRun,
  resolveTuningRun,
  rollbackTuningCandidate,
  startTuningRun,
  visibleTuningResult,
} from "../../app/freight-risk/models/core";
import { makeBaselineModels, makeObservationDates, makeTuneSuccess } from "./fixtures";

function makeSarimaxRequest() {
  return createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates: makeObservationDates(),
    values: Array.from({ length: 187 }, (_, index) => 4_000 + index),
    trainingWindow: "expanding",
    parameters: defaultParameters("sarimax"),
  });
}

test("builds the exact 187-observation and 52-origin tuning request", () => {
  const dates = makeObservationDates();
  const request = createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates,
    values: Array.from({ length: 187 }, (_, index) => 4_000 + index),
    trainingWindow: "expanding",
    parameters: defaultParameters("sarimax"),
  });
  assert.equal(request.dates.length, 187);
  assert.equal(request.values.length, 187);
  assert.equal(request.evaluationOrigins, 52);
  assert.equal(request.dates.at(-1), "2026-08-03");
});

test("rejects invalid parameter ranges, steps, and observation order before transport", () => {
  const dates = makeObservationDates();
  const values = Array.from({ length: 187 }, (_, index) => 4_000 + index);
  assert.throws(() => createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates,
    values,
    trainingWindow: "expanding",
    parameters: { ...defaultParameters("sarimax"), p: 4 },
  }), /outside its allowed range/u);
  assert.throws(() => createTuneRequest({
    routeCode: "KNEI",
    modelId: "lightgbm",
    dates,
    values,
    trainingWindow: "expanding",
    parameters: { ...defaultParameters("lightgbm"), learning_rate: 0.012 },
  }), /does not align/u);
  assert.throws(() => createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates: [...dates.slice(0, 186), dates[185]],
    values,
    trainingWindow: "expanding",
    parameters: defaultParameters("sarimax"),
  }), /strictly increasing/u);
  assert.doesNotThrow(() => createTuneRequest({
    routeCode: "KNEI",
    modelId: "prophet",
    dates,
    values,
    trainingWindow: "rolling_104",
    parameters: defaultParameters("prophet"),
  }));
});

test("validates the complete four-horizon tuning result and 52 records per horizon", () => {
  const valid = makeTuneSuccess();
  assert.deepEqual(decodeTuneSuccess(valid), valid);
  const missingEvaluation = {
    ...valid,
    evaluationByHorizon: valid.evaluationByHorizon.slice(0, 3),
  };
  assert.throws(() => decodeTuneSuccess(missingEvaluation), /four items/u);
  const inverted = {
    ...valid,
    forecasts: [
      { ...valid.forecasts[0], lower90: 120 },
      ...valid.forecasts.slice(1),
    ],
  };
  assert.throws(() => decodeTuneSuccess(inverted), /interval is inverted/u);
});

test("keeps baseline during running/error, ignores late runs, and supports keep/rollback", () => {
  const priorResult = makeTuneSuccess("timesfm");
  const prior = { result: priorResult, tuningRunHash: computeTuningRunHash(priorResult) };
  const idle = createTuningSession(prior);
  const request = makeSarimaxRequest();
  const running = startTuningRun(idle, "run-2", request);
  assert.deepEqual(visibleTuningResult(running), prior);
  assert.equal(resolveTuningRun(running, "run-1", makeTuneSuccess()).status, "running");

  const success = resolveTuningRun(running, "run-2", makeTuneSuccess());
  assert.equal(success.status, "success");
  assert.equal(visibleTuningResult(success)?.result.modelId, "sarimax");
  assert.equal(keepTuningCandidate(success).accepted?.result.modelId, "sarimax");
  assert.deepEqual(rollbackTuningCandidate(success).accepted, prior);

  const failed = rejectTuningRun(startTuningRun(idle, "run-3", request), "run-3", "엔진 오류");
  assert.equal(failed.status, "error");
  assert.deepEqual(visibleTuningResult(failed), prior);

  const mismatched = resolveTuningRun(
    startTuningRun(idle, "run-4", request),
    "run-4",
    { ...makeTuneSuccess(), routeCode: "KMEI" },
  );
  assert.equal(mismatched.status, "error");
  assert.deepEqual(visibleTuningResult(mismatched), prior);
});

test("merges an accepted tuning result before representative scoring", () => {
  const result = makeTuneSuccess();
  const accepted = { result, tuningRunHash: computeTuningRunHash(result) };
  const models = mergeAcceptedTunes(
    "KNEI",
    { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    makeBaselineModels(),
    { sarimax: accepted },
  );
  const selection = buildRepresentativeSelection({
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    models,
  });
  assert.equal(selection.modelId, "sarimax");
  assert.equal(selection.forecastSource, "tuned");
  assert.equal(selection.tuningRunHash, accepted.tuningRunHash);
  assert.equal(selection.modelVersion, result.modelVersion);
});
