import assert from "node:assert/strict";
import test from "node:test";

import {
  GATEWAY_SCHEMA_VERSION,
  type GatewayMetaV1,
} from "../../app/contracts";
import {
  TUNING_COMPARISON_ROW_ORDER,
  buildTuningComparison,
  createTuneRequest,
  createTuningSession,
  mergeAcceptedTunes,
  parametersForPreset,
  resolveTuningRun,
  startTuningRun,
} from "../../app/freight-risk/models/core";
import {
  TuningGatewayError,
  decodeTuningGatewayResult,
  runTuningGateway,
} from "../../app/freight-risk/models/tuning-gateway";
import { makeBaselineModels, makeObservationDates, makeTuneSuccess } from "./fixtures";

const META: GatewayMetaV1 = {
  mode: "live",
  source: "tuning-engine",
  sourceUrl: null,
  asOf: "2026-08-03",
  fetchedAt: "2026-08-13T04:16:12Z",
  unit: "USD/FEU",
  isEstimate: true,
  attribution: "MOVE AI",
  warnings: [],
  provider: null,
  cache: { hit: false, stale: false, ageSeconds: null },
};

function ready(data: Readonly<Record<string, unknown>>) {
  return { schemaVersion: GATEWAY_SCHEMA_VERSION, state: "READY", data, meta: META, error: null };
}

function unavailable() {
  return {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state: "UNAVAILABLE",
    data: null,
    meta: { ...META, mode: "unavailable", unit: null, isEstimate: false },
    error: {
      code: "NO_VALID_DATA",
      message: "엔진을 사용할 수 없습니다.",
      retryable: false,
      upstreamStatus: null,
      details: { reasonCode: "ENGINE_OFFLINE" },
    },
  };
}

test("accepts only a complete READY tuning gateway envelope", async () => {
  const result = makeTuneSuccess();
  const envelopeData = { ...result };
  assert.equal(decodeTuningGatewayResult(ready(envelopeData)).data, envelopeData);
  assert.throws(
    () => decodeTuningGatewayResult({ ...ready(envelopeData), extra: true }),
    (error) => error instanceof TuningGatewayError && error.code === "INVALID_ENVELOPE",
  );
  assert.throws(
    () => decodeTuningGatewayResult(unavailable()),
    (error) => error instanceof TuningGatewayError && error.code === "UNAVAILABLE",
  );

  const request = createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates: makeObservationDates(),
    values: Array.from({ length: 187 }, (_, index) => 4_000 + index),
    trainingWindow: "expanding",
    parameters: parametersForPreset("sarimax", "engine_default"),
  });
  let healthCalls = 0;
  let receivedRequest: typeof request | null = null;
  const decoded = await runTuningGateway(request, new AbortController().signal, {
    async tuningHealth() {
      healthCalls += 1;
      return ready({ status: "ok" });
    },
    async tuningRun(value) {
      receivedRequest = value;
      return ready({ ...result });
    },
  });
  assert.deepEqual(decoded.data, result);
  assert.equal(decoded.meta.mode, "live");
  assert.equal(healthCalls, 1);
  assert.deepEqual(receivedRequest, request);
});

test("rejects inconsistent tuning state, meta, cache, mode, and error envelopes", () => {
  const data = { ...makeTuneSuccess() };
  const baseReady = ready(data);
  const baseUnavailable = unavailable();
  const invalid = [
    { ...baseReady, state: "SUCCESS" },
    { ...baseReady, meta: { ...META, extra: true } },
    { ...baseReady, meta: { ...META, mode: "cached", cache: { hit: false, stale: false, ageSeconds: 0 } } },
    { ...baseReady, meta: { ...META, mode: "unavailable" } },
    { ...baseReady, error: baseUnavailable.error },
    { ...baseUnavailable, meta: META },
    { ...baseUnavailable, error: { ...baseUnavailable.error, stack: "secret" } },
    { ...baseUnavailable, error: { ...baseUnavailable.error, details: { reasonCode: "OFFLINE", rawBody: "secret" } } },
  ];
  for (const envelope of invalid) {
    assert.throws(
      () => decodeTuningGatewayResult(envelope),
      (error) => error instanceof TuningGatewayError && error.code === "INVALID_ENVELOPE",
    );
  }
});

test("stops at truthful UNAVAILABLE health and never invokes tuningRun", async () => {
  const request = createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates: makeObservationDates(),
    values: Array.from({ length: 187 }, (_, index) => 4_000 + index),
    trainingWindow: "expanding",
    parameters: parametersForPreset("sarimax", "engine_default"),
  });
  let runCalls = 0;
  await assert.rejects(
    runTuningGateway(request, new AbortController().signal, {
      async tuningHealth() { return unavailable(); },
      async tuningRun() {
        runCalls += 1;
        return ready({ ...makeTuneSuccess() });
      },
    }),
    (error) => error instanceof TuningGatewayError && error.code === "UNAVAILABLE",
  );
  assert.equal(runCalls, 0);
});

test("builds the exact seven-row before/after comparison without accepting the candidate", () => {
  const baseline = makeBaselineModels();
  const parameters = parametersForPreset("sarimax", "responsive");
  const request = createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates: makeObservationDates(),
    values: Array.from({ length: 187 }, (_, index) => 4_000 + index),
    trainingWindow: "rolling_104",
    parameters,
  });
  const response = {
    ...makeTuneSuccess(),
    trainingWindow: "rolling_104" as const,
    parameters,
  };
  const running = startTuningRun(createTuningSession(), "run-comparison", request);
  const success = resolveTuningRun(running, "run-comparison", response);
  assert.equal(success.status, "success");
  assert.equal(success.accepted, null);
  assert.ok(success.candidate);
  const after = mergeAcceptedTunes(
    "KNEI",
    { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    baseline,
    { sarimax: success.candidate! },
  );
  const comparison = buildTuningComparison(success, baseline, after);
  assert.deepEqual(comparison.rows.map(({ label }) => label), TUNING_COMPARISON_ROW_ORDER);
  assert.equal(comparison.beforeMeta, "내장 기준 결과");
  assert.equal(comparison.settingChanges.some(({ key }) => key === "p"), true);
  assert.equal(comparison.trainingWindowAfter, "rolling_104");
  assert.equal(comparison.afterModel.forecastSource, "tuned");
  assert.equal(success.accepted, null);
});
