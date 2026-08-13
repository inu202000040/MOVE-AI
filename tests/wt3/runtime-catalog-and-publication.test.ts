import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ROUTE_IDS } from "../../app/contracts";
import { computeTuningRunHash } from "../../app/freight-risk/models/core/canonical";
import { representativeStorageKey, writeManualRepresentative, type StorageLikeV1 } from "../../app/freight-risk/models/core/storage";
import type { TuningSessionStateV1 } from "../../app/freight-risk/models/core/tuning";
import {
  getModelsRepresentative,
  subscribeModelsRepresentative,
  type ModelsRepresentativeUpdateV1,
} from "../../app/freight-risk/models/representative-consumer";
import {
  keepModelsTuningCandidateInternal,
  restoreAutomaticModelsRepresentativeInternal,
  rollbackModelsTuningCandidateInternal,
  setManualModelsRepresentativeInternal,
} from "../../app/freight-risk/models/representative-mutations";
import { MODELS_REPRESENTATIVE_HANDOFF_FIXTURES_V1 } from "../../app/freight-risk/models/representative-fixtures";
import { validateRepresentativeSelection } from "../../app/freight-risk/models/core/representative";
import { makeTuneSuccess } from "./fixtures";

class MemoryStorage implements StorageLikeV1 {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

class BlockedStorage extends MemoryStorage {
  override setItem(): void { throw new Error("storage blocked"); }
  override removeItem(): void { throw new Error("storage blocked"); }
}

class CorruptingStorage extends MemoryStorage {
  override setItem(key: string): void { this.values.set(key, "{malformed"); }
}

class CountingTarget extends EventTarget {
  dispatchCount = 0;
  override dispatchEvent(event: Event): boolean {
    this.dispatchCount += 1;
    return super.dispatchEvent(event);
  }
}

const EXPECTED_CHAMPIONS = {
  KUWI: "timesfm",
  KUEI: "timesfm",
  KNEI: "sarimax",
  KMDI: "timesfm",
  KMEI: "timesfm",
  KAUI: "timesfm",
  KLEI: "sarimax",
  KLWI: "timesfm",
  KSAI: "timesfm",
  KWAI: "sarimax",
  KCI: "sarimax",
  KJI: "timesfm",
  KSEI: "sarimax",
} as const;

function successfulSession(): TuningSessionStateV1 {
  const result = makeTuneSuccess();
  return {
    status: "success",
    accepted: null,
    candidate: { result, tuningRunHash: computeTuningRunHash(result) },
    pendingRunId: null,
    pendingRequest: null,
    error: null,
  };
}

test("loads the approved immutable 13-route artifact and returns only validated representatives", () => {
  const artifactBytes = readFileSync(new URL("../../app/freight-risk/models/reference-data/models-snapshot-v3.json", import.meta.url));
  assert.equal(artifactBytes.byteLength, 4_466_219);
  assert.equal(createHash("sha256").update(artifactBytes).digest("hex"), "69a8566d2024ba6f6214e4fb41b6c5a3d5dcf679e8b84a81d608f54e561ff182");

  for (const route of ROUTE_IDS) {
    const representative = getModelsRepresentative(route, new MemoryStorage());
    assert.equal(representative.route, route);
    assert.equal(representative.modelId, EXPECTED_CHAMPIONS[route]);
    assert.equal(representative.modelAgreementByHorizon.length, 4);
    assert.equal(representative.modelAgreementByHorizon.every(({ members }) => members.length === 8), true);
    assert.equal("mergedModels" in representative, false);
    assert.equal("storageSnapshot" in representative, false);
  }
});

test("getter applies valid storage and fails closed on malformed storage", () => {
  const storage = new MemoryStorage();
  writeManualRepresentative(storage, "KNEI", "timesfm", "2026-08-13T04:16:12Z");
  const representative = getModelsRepresentative("KNEI", storage);
  assert.equal(representative.modelId, "timesfm");
  assert.equal(representative.selectionMode, "manual");
  assert.match(representative.representativeRevision, /^rep-v1:[0-9a-f]{64}$/u);

  storage.setItem(representativeStorageKey("KNEI"), "{malformed");
  assert.throws(() => getModelsRepresentative("KNEI", storage), /payload is invalid/u);
});

test("subscriber resolves custom and StorageEvent inputs to READY or explicit UNAVAILABLE DTOs", () => {
  const target = new CountingTarget();
  const storage = new MemoryStorage();
  const received: ModelsRepresentativeUpdateV1[] = [];
  const unsubscribe = subscribeModelsRepresentative(target, "KNEI", storage, (update) => received.push(update));

  setManualModelsRepresentativeInternal(target, "KMEI", storage, "sarimax", "2026-08-13T04:16:12Z");
  setManualModelsRepresentativeInternal(target, "KNEI", storage, "timesfm", "2026-08-13T04:16:12Z");
  assert.equal(received.length, 1);
  assert.equal(received[0].state, "READY");
  assert.equal(received[0].reason, "manual");
  assert.equal(received[0].state === "READY" && received[0].representative.modelId, "timesfm");

  storage.setItem(representativeStorageKey("KNEI"), "{malformed");
  const malformedStorageEvent = new Event("storage");
  Object.defineProperty(malformedStorageEvent, "key", { value: representativeStorageKey("KNEI") });
  target.dispatchEvent(malformedStorageEvent);
  assert.equal(received.at(-1)?.state, "UNAVAILABLE");
  assert.equal(received.at(-1)?.reason, "storage");

  unsubscribe();
  restoreAutomaticModelsRepresentativeInternal(target, "KNEI", new MemoryStorage());
  assert.equal(received.length, 2);
});

test("manual and automatic mutations validate then dispatch exactly once", () => {
  const target = new CountingTarget();
  const storage = new MemoryStorage();
  const received: ModelsRepresentativeUpdateV1[] = [];
  subscribeModelsRepresentative(target, "KNEI", storage, (update) => received.push(update));

  const manual = setManualModelsRepresentativeInternal(
    target,
    "KNEI",
    storage,
    "timesfm",
    "2026-08-13T04:16:12Z",
  );
  assert.equal(manual.state, "READY");
  assert.equal(target.dispatchCount, 1);
  assert.equal(received.length, 1);
  assert.equal(received[0].state === "READY" && received[0].representative.selectionMode, "manual");

  const automatic = restoreAutomaticModelsRepresentativeInternal(target, "KNEI", storage);
  assert.equal(automatic.state, "READY");
  assert.equal(target.dispatchCount, 2);
  assert.equal(received.length, 2);
  assert.equal(received[1].state === "READY" && received[1].representative.selectionMode, "automatic");
});

test("KEEP and rollback each validate and dispatch exactly once", () => {
  const keepTarget = new CountingTarget();
  const keepStorage = new MemoryStorage();
  const keepUpdates: ModelsRepresentativeUpdateV1[] = [];
  subscribeModelsRepresentative(keepTarget, "KNEI", keepStorage, (update) => keepUpdates.push(update));
  const kept = keepModelsTuningCandidateInternal(
    keepTarget,
    "KNEI",
    keepStorage,
    successfulSession(),
    "2026-08-13T04:16:12Z",
  );
  assert.equal(kept.persisted, true);
  assert.equal(keepTarget.dispatchCount, 1);
  assert.equal(keepUpdates.length, 1);
  assert.equal(keepUpdates[0].state, "READY");
  assert.equal(keepUpdates[0].state === "READY" && keepUpdates[0].representative.forecastSource, "tuned");

  const rollbackTarget = new CountingTarget();
  const rollbackStorage = new MemoryStorage();
  const rollbackUpdates: ModelsRepresentativeUpdateV1[] = [];
  subscribeModelsRepresentative(rollbackTarget, "KNEI", rollbackStorage, (update) => rollbackUpdates.push(update));
  const rolledBack = rollbackModelsTuningCandidateInternal(
    rollbackTarget,
    "KNEI",
    rollbackStorage,
    successfulSession(),
  );
  assert.equal(rolledBack.state.status, "idle");
  assert.equal(rollbackTarget.dispatchCount, 1);
  assert.equal(rollbackUpdates.length, 1);
  assert.equal(rollbackUpdates[0].state, "READY");
  assert.equal(rollbackUpdates[0].state === "READY" && rollbackUpdates[0].representative.forecastSource, "baseline");
});

test("blocked or corrupt storage never publishes READY and still dispatches one UNAVAILABLE update", () => {
  for (const storage of [new BlockedStorage(), new CorruptingStorage()]) {
    const target = new CountingTarget();
    const received: ModelsRepresentativeUpdateV1[] = [];
    subscribeModelsRepresentative(target, "KNEI", storage, (update) => received.push(update));
    const mutation = setManualModelsRepresentativeInternal(
      target,
      "KNEI",
      storage,
      "timesfm",
      "2026-08-13T04:16:12Z",
    );
    assert.equal(mutation.state, "UNAVAILABLE");
    assert.equal(target.dispatchCount, 1);
    assert.equal(received.length, 1);
    assert.equal(received[0].state, "UNAVAILABLE");
  }
});

test("blocked automatic clear and KEEP each dispatch once while rollback remains storage-write free", () => {
  const automaticTarget = new CountingTarget();
  const automaticStorage = new BlockedStorage();
  const automaticUpdates: ModelsRepresentativeUpdateV1[] = [];
  subscribeModelsRepresentative(automaticTarget, "KNEI", automaticStorage, (update) => automaticUpdates.push(update));
  const automatic = restoreAutomaticModelsRepresentativeInternal(automaticTarget, "KNEI", automaticStorage);
  assert.equal(automatic.state, "UNAVAILABLE");
  assert.equal(automaticTarget.dispatchCount, 1);
  assert.deepEqual(automaticUpdates.map(({ state, reason }) => ({ state, reason })), [
    { state: "UNAVAILABLE", reason: "automatic" },
  ]);

  const keepTarget = new CountingTarget();
  const keepStorage = new BlockedStorage();
  const keepUpdates: ModelsRepresentativeUpdateV1[] = [];
  subscribeModelsRepresentative(keepTarget, "KNEI", keepStorage, (update) => keepUpdates.push(update));
  const keep = keepModelsTuningCandidateInternal(keepTarget, "KNEI", keepStorage, successfulSession());
  assert.equal(keep.persisted, false);
  assert.equal(keep.update.state, "UNAVAILABLE");
  assert.equal(keepTarget.dispatchCount, 1);
  assert.deepEqual(keepUpdates.map(({ state, reason }) => ({ state, reason })), [
    { state: "UNAVAILABLE", reason: "keep" },
  ]);

  const rollbackTarget = new CountingTarget();
  const rollbackStorage = new BlockedStorage();
  const rollbackUpdates: ModelsRepresentativeUpdateV1[] = [];
  subscribeModelsRepresentative(rollbackTarget, "KNEI", rollbackStorage, (update) => rollbackUpdates.push(update));
  const rollback = rollbackModelsTuningCandidateInternal(
    rollbackTarget,
    "KNEI",
    rollbackStorage,
    successfulSession(),
  );
  assert.equal(rollback.update.state, "READY");
  assert.equal(rollbackTarget.dispatchCount, 1);
  assert.deepEqual(rollbackUpdates.map(({ state, reason }) => ({ state, reason })), [
    { state: "READY", reason: "rollback" },
  ]);
});

test("shared baseline, KEEP, rollback, and provenance-only DTO fixtures are validated and unfiltered", () => {
  const fixtures = MODELS_REPRESENTATIVE_HANDOFF_FIXTURES_V1;
  assert.equal(validateRepresentativeSelection(fixtures.baseline), true);
  assert.equal(validateRepresentativeSelection(fixtures.keep), true);
  assert.equal(validateRepresentativeSelection(fixtures.rollback), true);
  assert.equal(validateRepresentativeSelection(fixtures.provenanceOnly), true);
  assert.deepEqual(fixtures.rollback, fixtures.baseline);
  assert.notDeepEqual(fixtures.keep.forecasts, fixtures.baseline.forecasts);
  assert.deepEqual(fixtures.provenanceOnly.currentObservation, fixtures.baseline.currentObservation);
  assert.equal(fixtures.provenanceOnly.modelId, fixtures.baseline.modelId);
  assert.deepEqual(fixtures.provenanceOnly.forecasts, fixtures.baseline.forecasts);
  assert.deepEqual(fixtures.provenanceOnly.metricsByHorizon, fixtures.baseline.metricsByHorizon);
  assert.notEqual(fixtures.provenanceOnly.representativeRevision, fixtures.baseline.representativeRevision);
  assert.equal(fixtures.provenanceOnly.forecastSource, "baseline");
  assert.equal(fixtures.baseline.forecastSource, "baseline");
  assert.notEqual(fixtures.provenanceOnly.evaluationProtocol, fixtures.baseline.evaluationProtocol);
});

test("the public consumer source exposes no snapshot, produced core, merge, storage snapshot, or publisher", () => {
  const source = readFileSync(new URL("../../app/freight-risk/models/representative-consumer.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /export[^\n]*(ProducedModelsCoreV1|ModelsSnapshot|mergedModels|storageSnapshot|publishModels)/u);
  assert.match(source, /export function getModelsRepresentative\(/u);
  assert.match(source, /export function subscribeModelsRepresentative\(/u);
});

test("Models runtime owns no private route or network boundary", () => {
  const clientSource = readFileSync(new URL("../../app/freight-risk/models/ModelsClient.tsx", import.meta.url), "utf8");
  const gatewaySource = readFileSync(new URL("../../app/freight-risk/models/tuning-gateway.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../../app/freight-risk/models/page.tsx", import.meta.url), "utf8");
  assert.match(clientSource, /useFreightRiskRoute/u);
  assert.match(clientSource, /modelsTuningGatewayFromDataGateway/u);
  assert.match(clientSource, /data\/runtime\/data-gateway\.client/u);
  assert.doesNotMatch(clientSource, /data\/runtime\/data-gateway(?:"|')|data-gateway\.server/u);
  assert.doesNotMatch(clientSource, /history\.replaceState|\bfetch\s*\(|"KNEI"/u);
  assert.doesNotMatch(gatewaySource, /\bfetch\s*\(|\/api\/freight-risk/u);
  assert.doesNotMatch(pageSource, /tuningGateway=/u);
  assert.match(pageSource, /data\/runtime\/data-gateway\.server/u);
  assert.match(pageSource, /validatedSnapshotGatewayResultV1/u);
});

test("base states and narrow-screen accessibility rules remain explicit", () => {
  const stateSource = readFileSync(new URL("../../app/freight-risk/models/ModelsDataState.tsx", import.meta.url), "utf8");
  const chartSource = readFileSync(new URL("../../app/freight-risk/models/ForecastComparisonChart.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../app/freight-risk/models/models.module.css", import.meta.url), "utf8");
  assert.match(stateSource, /"loading" \| "empty" \| "error"/u);
  assert.match(stateSource, /다시 시도/u);
  assert.match(chartSource, /routeName/u);
  assert.doesNotMatch(chartSource, /뉴욕 항로/u);
  assert.doesNotMatch(stateSource, /pageHeader/u);
  assert.doesNotMatch(css, /\.pageHeader|\.dataBasis/u);
  assert.match(css, /\.drawerBody \{ min-height: 0; padding-inline: 14px; overflow-y: auto; \}/u);
  assert.match(css, /\.modalBackdrop, \.drawerBackdrop \{ --navy: #001290; --blue: #15269d; --cyan: #3fa1eb;/u);
  const genericFooterRule = css.indexOf(".drawerFooter button {");
  const primaryFooterRule = css.indexOf(".drawerFooter .primaryButton");
  assert.ok(genericFooterRule >= 0 && primaryFooterRule > genericFooterRule);
  assert.match(css.slice(primaryFooterRule), /background: linear-gradient\(135deg, #1648b8/u);
  assert.match(css.slice(primaryFooterRule), /color: #fff !important/u);
});
