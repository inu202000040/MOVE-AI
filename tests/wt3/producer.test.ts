import assert from "node:assert/strict";
import test from "node:test";

import {
  computeTuningRunHash,
  createTuneRequest,
  createTuningSession,
  isModelsStorageEventForRoute,
  keepCandidateAndPersist,
  parametersForPreset,
  produceModelsCore,
  representativeStorageKey,
  resolveTuningRun,
  rollbackCandidateWithoutStorageWrite,
  startTuningRun,
  tuningStorageKey,
  writeAcceptedTuning,
  writeManualRepresentative,
  type StorageLikeV1,
} from "../../app/freight-risk/models/core";
import { makeBaselineModels, makeObservationDates, makeTuneSuccess } from "./fixtures";

class MemoryStorage implements StorageLikeV1 {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("blocked");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const CURRENT = { date: "2026-08-03", value: 100, unit: "USD/FEU" } as const;

function makeRequest() {
  return createTuneRequest({
    routeCode: "KNEI",
    modelId: "sarimax",
    dates: makeObservationDates(),
    values: Array.from({ length: 187 }, (_, index) => 4_000 + index),
    trainingWindow: "expanding",
    parameters: parametersForPreset("sarimax", "engine_default"),
  });
}

test("freezes engine-default, stable, and responsive parameter presets", () => {
  assert.deepEqual(parametersForPreset("sarimax", "stable"), {
    p: 1,
    d: 1,
    q: 1,
    trend: "c",
    seasonal_p: 0,
    seasonal_d: 0,
    seasonal_q: 0,
    seasonal_period: 52,
    maxiter: 100,
  });
  assert.deepEqual(parametersForPreset("lightgbm", "responsive"), {
    n_estimators: 120,
    learning_rate: 0.08,
    num_leaves: 31,
    max_depth: 6,
    min_child_samples: 4,
    subsample: 0.9,
    colsample: 0.9,
    reg_lambda: 0.2,
  });
  assert.equal(parametersForPreset("timesfm", "responsive").context_length, 78);
  assert.deepEqual(parametersForPreset("naive", "stable"), {});
});

test("hydrates manual selection and accepted tuning before producing one representative", () => {
  const storage = new MemoryStorage();
  const tune = makeTuneSuccess();
  const accepted = { result: tune, tuningRunHash: computeTuningRunHash(tune) };
  writeAcceptedTuning(storage, "KNEI", accepted, "2026-08-13T04:16:12Z");
  writeManualRepresentative(storage, "KNEI", "sarimax", "2026-08-13T04:16:12Z");

  const produced = produceModelsCore({
    route: "KNEI",
    currentObservation: CURRENT,
    baselineModels: makeBaselineModels(),
    storage,
  });
  assert.equal(produced.representative.selectionMode, "manual");
  assert.equal(produced.representative.modelId, "sarimax");
  assert.equal(produced.representative.forecastSource, "tuned");
  assert.equal(produced.representative.tuningRunHash, accepted.tuningRunHash);

  const automatic = produceModelsCore({
    route: "KNEI",
    currentObservation: CURRENT,
    baselineModels: makeBaselineModels(),
    storage,
    manualModelIdOverride: null,
  });
  assert.equal(automatic.representative.selectionMode, "automatic");
});

test("keeps route-scoped storage isolated", () => {
  const storage = new MemoryStorage();
  writeManualRepresentative(storage, "KMEI", "naive", "2026-08-13T04:16:12Z");
  const produced = produceModelsCore({
    route: "KNEI",
    currentObservation: CURRENT,
    baselineModels: makeBaselineModels(),
    storage,
  });
  assert.equal(produced.storageSnapshot.manualModelId, null);
  assert.equal(produced.representative.modelId, "sarimax");
});

test("persists only KEEP, performs no storage write on rollback, and survives blocked storage", () => {
  const storage = new MemoryStorage();
  const running = startTuningRun(createTuningSession(), "run-1", makeRequest());
  const success = resolveTuningRun(running, "run-1", makeTuneSuccess());
  const rolledBack = rollbackCandidateWithoutStorageWrite(success);
  assert.equal(rolledBack.accepted, null);
  assert.equal(storage.values.size, 0);

  const kept = keepCandidateAndPersist(storage, "KNEI", success, "2026-08-13T04:16:12Z");
  assert.equal(kept.persisted, true);
  assert.equal(kept.warning, null);
  assert.equal(storage.values.has(tuningStorageKey("KNEI", "sarimax")), true);

  const blockedStorage = new MemoryStorage();
  blockedStorage.failWrites = true;
  const blocked = keepCandidateAndPersist(blockedStorage, "KNEI", success, "2026-08-13T04:16:12Z");
  assert.equal(blocked.persisted, false);
  assert.equal(blocked.state.accepted?.result.modelId, "sarimax");
  assert.match(blocked.warning ?? "", /저장하지 못했습니다/u);
});

test("filters cross-tab storage events by route and owned key", () => {
  assert.equal(isModelsStorageEventForRoute(null, "KNEI"), true);
  assert.equal(isModelsStorageEventForRoute(representativeStorageKey("KNEI"), "KNEI"), true);
  assert.equal(isModelsStorageEventForRoute(tuningStorageKey("KNEI", "prophet"), "KNEI"), true);
  assert.equal(isModelsStorageEventForRoute(representativeStorageKey("KMEI"), "KNEI"), false);
  assert.equal(isModelsStorageEventForRoute("move-ai:route:v1", "KNEI"), false);
});
