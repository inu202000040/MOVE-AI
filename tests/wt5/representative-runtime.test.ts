import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { GATEWAY_SCHEMA_VERSION } from "../../app/contracts";
import {
  CVAR_ALPHA,
  CVAR_WEEKLY_CORRELATION,
  CVAR_WORKER_SOURCE,
  CvarRunCoordinator,
  REPRESENTATIVE_MODEL_IDS,
  adaptRepresentativeGatewayResult,
  adaptRepresentativeSelection,
  createAllocationRunInput,
  isUnavailableRepresentativeGatewayResult,
  type CvarSimulationInput,
  type CvarSimulationResult,
  type CvarWorkerDoneMessage,
  type CvarWorkerHandle,
  type CvarWorkerLike,
  type CvarWorkerMessage,
  type RepresentativeSelectionV1,
} from "../../app/freight-risk/allocation";
import { KNEI_REPRESENTATIVE_SELECTION } from "../../app/freight-risk/allocation/fixture";
import {
  canonicalJsonForValidation,
  sha256HexForValidation,
} from "../../app/freight-risk/allocation/identity";

const HASH_A = "a".repeat(64);

type Mutable<T> = T extends readonly (infer TItem)[]
  ? Mutable<TItem>[]
  : T extends object
    ? { -readonly [TKey in keyof T]: Mutable<T[TKey]> }
    : T;

function mutableClone<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}

function sealRepresentative(
  value: Mutable<RepresentativeSelectionV1>,
): RepresentativeSelectionV1 {
  const projection = structuredClone(value) as Record<string, unknown>;
  delete projection.representativeRevision;
  value.representativeRevision = `rep-v1:${sha256HexForValidation(
    canonicalJsonForValidation(projection),
  )}`;
  return value;
}

function createRepresentative(): RepresentativeSelectionV1 {
  const forecasts = [
    { horizonWeeks: 1, targetDate: "2026-08-10", point: 4_828.98, lower90: 4_482.47, upper90: 5_175.49 },
    { horizonWeeks: 2, targetDate: "2026-08-17", point: 4_791.32, lower90: 4_227.22, upper90: 5_355.43 },
    { horizonWeeks: 3, targetDate: "2026-08-24", point: 4_767.23, lower90: 3_935.75, upper90: 5_598.72 },
    { horizonWeeks: 4, targetDate: "2026-08-31", point: 4_753.74, lower90: 3_439.8, upper90: 6_067.68 },
  ] as const;
  const metricValues = [
    [3.6, 22_818.49, 151.06, 0.037, 100, 98.59552494490214, 100, 99.53184164830071, 88.5, 46],
    [6.8, 68_438.82, 261.61, 0.067, 83.97058823529412, 72.7532999546164, 83.58208955223881, 80.10199258071644, 94.2, 49],
    [11.19, 181_485.66, 426.01, 0.111, 83.1099195710456, 69.14281822596892, 83.78378378378379, 78.67884052693277, 92.3, 48],
    [15.55, 342_939.33, 585.61, 0.157, 78.52090032154341, 62.814504244817876, 79.61783439490446, 73.65107965375525, 94.2, 49],
  ] as const;
  const representative = {
    route: "KNEI",
    currentObservation: {
      date: "2026-08-03",
      value: 4_884,
      unit: "USD/FEU",
    },
    modelId: "sarimax",
    modelName: "SARIMAX",
    modelVersion: "statsmodels-0.14.6",
    score1w: 99.53184164830071,
    coverage1w: 88.5,
    selectionMode: "automatic",
    forecastSource: "baseline",
    tuningRunHash: null,
    evaluationProtocol: "rolling-origin-52-v1",
    automaticChampion: {
      modelId: "sarimax",
      modelName: "SARIMAX",
      modelVersion: "statsmodels-0.14.6",
      score1w: 99.53184164830071,
    },
    representativeRevision: `rep-v1:${HASH_A}`,
    forecasts,
    metricsByHorizon: metricValues.map((values, index) => ({
      horizonWeeks: (index + 1) as 1 | 2 | 3 | 4,
      mapePct: values[0],
      mse: values[1],
      rmse: values[2],
      mase: values[3],
      mapeScore: values[4],
      mseScore: values[5],
      maseScore: values[6],
      totalScore: values[7],
      coverage: {
        pct: values[8],
        hits: values[9],
        total: 52,
        sampleSize: 52,
        target: 0.9,
        intervalMethod: "pi90",
      },
    })),
    modelAgreementByHorizon: forecasts.map((forecast) => ({
      horizonWeeks: forecast.horizonWeeks,
      thresholdPct: 3,
      up: 0,
      down: 0,
      flat: 8,
      total: 8,
      members: REPRESENTATIVE_MODEL_IDS.map((modelId) => ({
        modelId,
        modelName: modelId === "sarimax" ? "SARIMAX" : modelId,
        modelVersion: modelId === "sarimax" ? "statsmodels-0.14.6" : "baseline-v1",
        forecastSource: "baseline" as const,
        tuningRunHash: null,
        point: modelId === "sarimax" ? forecast.point : 4_800,
        changePct:
          100 * ((modelId === "sarimax" ? forecast.point : 4_800) / 4_884 - 1),
        direction: "flat" as const,
      })),
    })),
  } as unknown as Mutable<RepresentativeSelectionV1>;
  return sealRepresentative(representative);
}

function syncSelectedMember(
  representative: Mutable<RepresentativeSelectionV1>,
  horizonIndex: number,
): void {
  const member = representative.modelAgreementByHorizon[horizonIndex].members[1];
  const forecast = representative.forecasts[horizonIndex];
  member.modelName = representative.modelName;
  member.modelVersion = representative.modelVersion;
  member.forecastSource = representative.forecastSource;
  member.tuningRunHash = representative.tuningRunHash;
  member.point = forecast.point;
  member.changePct = 100 * (forecast.point / representative.currentObservation.value - 1);
  member.direction =
    member.changePct >= 3 ? "up" : member.changePct <= -3 ? "down" : "flat";
}

const KNEI_INPUT: CvarSimulationInput = {
  forecasts: createRepresentative().forecasts,
  current: 4_884,
  selectedHorizon: 1,
  fixed: 4_998,
  volume: 1_000,
  alpha: CVAR_ALPHA,
  riskWeight: 1,
  seed: 2_401_817_482,
  rho: CVAR_WEEKLY_CORRELATION,
};

test("validates the approved KNEI representative fixture without issuing a revision", () => {
  const adapted = adaptRepresentativeSelection(KNEI_REPRESENTATIVE_SELECTION);
  assert.strictEqual(adapted.selection, KNEI_REPRESENTATIVE_SELECTION);
  assert.equal(adapted.route, "KNEI");
  assert.equal(adapted.selection.modelId, "sarimax");
  assert.equal(
    adapted.selection.representativeRevision,
    "rep-v1:a615fa0b9ffbcecc1ec48e724b896bdf8e2c3e33aca3ff8a4f880270a84495b4",
  );
});

test("validates and projects the canonical representative without regenerating identity", () => {
  const representative = createRepresentative();
  const adapted = adaptRepresentativeSelection(representative);
  assert.strictEqual(adapted.selection, representative);
  assert.equal(adapted.selection.tuningRunHash, null);
  assert.match(adapted.selection.representativeRevision, /^rep-v1:[0-9a-f]{64}$/u);
  assert.equal(adapted.route, "KNEI");
  assert.equal(adapted.current, 4_884);
  assert.equal(adapted.forecasts.length, 4);
});

test("rejects malformed representative tuples atomically", () => {
  const invalidInterval = mutableClone(createRepresentative());
  invalidInterval.forecasts[0].lower90 = invalidInterval.forecasts[0].point + 1;
  assert.throws(() => adaptRepresentativeSelection(invalidInterval));

  const invalidCoverage = mutableClone(createRepresentative());
  invalidCoverage.coverage1w = 101;
  assert.throws(() => adaptRepresentativeSelection(invalidCoverage));

  const invalidRevision = mutableClone(createRepresentative());
  invalidRevision.representativeRevision = "rep-v1:invalid";
  assert.throws(() => adaptRepresentativeSelection(invalidRevision));

  const missingForecast = mutableClone(createRepresentative());
  missingForecast.forecasts.pop();
  assert.throws(() => adaptRepresentativeSelection(missingForecast));

  const wrongRegistryOrder = mutableClone(createRepresentative());
  wrongRegistryOrder.modelAgreementByHorizon[0].members.reverse();
  assert.throws(() => adaptRepresentativeSelection(wrongRegistryOrder));
});

test("keeps provenance-only changes out of the deterministic run key", () => {
  const baseline = createRepresentative();
  const provenanceOnly = mutableClone(baseline);
  provenanceOnly.modelVersion = "statsmodels-0.14.7";
  provenanceOnly.automaticChampion.modelVersion = "statsmodels-0.14.7";
  provenanceOnly.evaluationProtocol = "rolling-origin-52-v2";
  for (let index = 0; index < 4; index += 1) {
    syncSelectedMember(provenanceOnly, index);
  }
  sealRepresentative(provenanceOnly);
  const baselineKey = adaptRepresentativeSelection(baseline).routeSimulationKey;
  const provenanceKey = adaptRepresentativeSelection(provenanceOnly).routeSimulationKey;
  assert.equal(provenanceKey, baselineKey);

  const effectiveChange = mutableClone(baseline);
  effectiveChange.forecasts[0].point += 1;
  syncSelectedMember(effectiveChange, 0);
  sealRepresentative(effectiveChange);
  assert.notEqual(
    adaptRepresentativeSelection(effectiveChange).routeSimulationKey,
    baselineKey,
  );
});

test("validates canonical JSON and representative revision bytes", () => {
  assert.equal(
    canonicalJsonForValidation({ z: -0, a: [true, "한글", null] }),
    '{"a":[true,"한글",null],"z":0}',
  );
  assert.equal(
    sha256HexForValidation("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  const invalid = mutableClone(createRepresentative());
  invalid.evaluationProtocol = "changed-without-a-new-wt3-revision";
  assert.throws(() => adaptRepresentativeSelection(invalid));
});

test("consumes only a READY decoded gateway envelope", () => {
  const representative = createRepresentative();
  const ready = {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state: "READY",
    data: representative,
    error: null,
    meta: {
      mode: "fixture",
      source: "approved-data-pack",
      sourceUrl: null,
      asOf: "2026-08-03T00:00:00.000Z",
      fetchedAt: "2026-08-03T00:00:00.000Z",
      unit: "USD/FEU",
      isEstimate: false,
      attribution: "Korea Ocean Business Corporation",
      warnings: [],
      provider: null,
      cache: { hit: false, stale: false, ageSeconds: null },
    },
  } as const;
  assert.strictEqual(
    adaptRepresentativeGatewayResult(ready).selection,
    representative,
  );

  assert.throws(() =>
    adaptRepresentativeGatewayResult({
      ...ready,
      schemaVersion: "wrong-schema",
    } as unknown as typeof ready),
  );
  assert.throws(() =>
    adaptRepresentativeGatewayResult({
      ...ready,
      state: "UNAVAILABLE",
      data: null,
      error: { code: "NO_DATA", message: "unavailable", retryable: false, upstreamStatus: null, details: null },
    }),
  );
  assert.throws(() =>
    adaptRepresentativeGatewayResult(
      representative as unknown as typeof ready,
    ),
  );
  assert.throws(() =>
    adaptRepresentativeGatewayResult({
      ...ready,
      legacyPayload: representative,
    } as unknown as typeof ready),
  );

  const unavailable = {
    ...ready,
    state: "UNAVAILABLE",
    data: null,
    error: { code: "NO_DATA", message: "unavailable", retryable: false, upstreamStatus: null, details: { reasonCode: "NO_VALID_DATA" } },
    meta: { ...ready.meta, mode: "unavailable" },
  } as const;
  assert.equal(isUnavailableRepresentativeGatewayResult(unavailable), true);
  assert.equal(
    isUnavailableRepresentativeGatewayResult({
      ...unavailable,
      data: representative,
    }),
    false,
  );
});

test("freezes one immutable simulation input from representative plus drawer draft", () => {
  const representative = createRepresentative();
  const runInput = createAllocationRunInput(representative, {
    selectedHorizon: 2,
    fixed: 4_960,
    volume: 750,
    riskWeight: 2,
  });
  assert.equal(runInput.simulation.current, 4_884);
  assert.equal(runInput.simulation.seed, 2_401_817_482);
  assert.equal(runInput.simulation.alpha, 0.9);
  assert.equal(runInput.simulation.rho, 0.75);
  assert.equal(runInput.simulation.forecasts[1].point, 4_791.32);
  assert.equal(Object.isFrozen(runInput), true);
  assert.equal(Object.isFrozen(runInput.simulation), true);
  assert.equal(Object.isFrozen(runInput.simulation.forecasts), true);
  assert.equal(Object.isFrozen(runInput.simulation.forecasts[0]), true);
});

class FakeWorker implements CvarWorkerLike {
  onmessage: ((event: MessageEvent<CvarWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

function emptyResult(): CvarSimulationResult {
  const candidate = {
    share: 0,
    spotShare: 100,
    expected: 0,
    averageUnitCost: 0,
    cvar: 0,
    upward: 0,
    downward: 0,
    objective: 0,
  };
  return {
    results: [candidate],
    best: candidate,
    meanSpot: 0,
    baseline: 0,
    riskWeight: 1,
    tailCount: 10_000,
    spots: new Float64Array(),
    samplePaths: [],
    rho: 0.75,
  };
}

test("terminates the previous worker and discards every late message", () => {
  const workers: FakeWorker[] = [];
  const disposed: boolean[] = [];
  const coordinator = new CvarRunCoordinator((): CvarWorkerHandle => {
    const worker = new FakeWorker();
    const index = workers.push(worker) - 1;
    disposed[index] = false;
    return {
      worker,
      dispose: () => {
        disposed[index] = true;
      },
    };
  });

  let staleEvents = 0;
  let currentDone = 0;
  coordinator.run(KNEI_INPUT, {
    onProgress: () => {
      staleEvents += 1;
    },
    onDone: () => {
      staleEvents += 1;
    },
    onError: () => {
      staleEvents += 1;
    },
  });
  const lateMessage = workers[0].onmessage;
  const lateError = workers[0].onerror;

  const secondSequence = coordinator.run(KNEI_INPUT, {
    onProgress: () => undefined,
    onDone: () => {
      currentDone += 1;
    },
    onError: () => undefined,
  });
  assert.equal(secondSequence, 2);
  assert.equal(workers[0].terminated, true);
  assert.equal(disposed[0], true);

  lateMessage?.({
    data: { type: "progress", sequence: 1, stage: "paths", percent: 24 },
  } as MessageEvent<CvarWorkerMessage>);
  lateMessage?.({
    data: { type: "done", sequence: 1, result: emptyResult() },
  } as MessageEvent<CvarWorkerMessage>);
  lateError?.({ error: new Error("late"), message: "late" } as ErrorEvent);
  assert.equal(staleEvents, 0);

  workers[1].onmessage?.({
    data: { type: "done", sequence: 2, result: emptyResult() },
  } as MessageEvent<CvarWorkerMessage>);
  assert.equal(currentDone, 1);
  assert.equal(workers[1].terminated, true);
  assert.equal(disposed[1], true);
});

test("fails closed and disposes when postMessage throws synchronously", () => {
  class ThrowingWorker extends FakeWorker {
    override postMessage(): void {
      throw new Error("structured clone failed");
    }
  }

  const worker = new ThrowingWorker();
  let disposed = false;
  let captured: unknown;
  const coordinator = new CvarRunCoordinator(() => ({
    worker,
    dispose: () => {
      disposed = true;
    },
  }));
  coordinator.run(KNEI_INPUT, {
    onProgress: () => assert.fail("no progress expected"),
    onDone: () => assert.fail("no result expected"),
    onError: (error) => {
      captured = error;
    },
  });
  assert.match(String(captured), /structured clone failed/u);
  assert.equal(worker.terminated, true);
  assert.equal(disposed, true);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
});

test("rejects regressive and stage-reversing worker progress", () => {
  const workers: FakeWorker[] = [];
  const errors: unknown[] = [];
  const coordinator = new CvarRunCoordinator(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return { worker, dispose: () => undefined };
  });

  coordinator.run(KNEI_INPUT, {
    onProgress: () => undefined,
    onDone: () => assert.fail("no result expected"),
    onError: (error) => errors.push(error),
  });
  workers[0].onmessage?.({
    data: { type: "progress", sequence: 1, stage: "paths", percent: 28 },
  } as MessageEvent<CvarWorkerMessage>);
  workers[0].onmessage?.({
    data: { type: "progress", sequence: 1, stage: "candidates", percent: 35 },
  } as MessageEvent<CvarWorkerMessage>);
  const stageReverse = workers[0].onmessage;
  stageReverse?.({
    data: { type: "progress", sequence: 1, stage: "paths", percent: 40 },
  } as MessageEvent<CvarWorkerMessage>);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /progress contract failed/u);
  assert.equal(workers[0].terminated, true);
});

test("executes the Blob worker program against the 100,000-path golden", () => {
  const posted: Array<{ message: CvarWorkerMessage; transfer?: unknown[] }> = [];
  const workerScope: {
    onmessage?: (event: { data: unknown }) => void;
    postMessage: (message: CvarWorkerMessage, transfer?: unknown[]) => void;
  } = {
    postMessage(message, transfer) {
      posted.push({ message, transfer });
    },
  };
  vm.runInNewContext(CVAR_WORKER_SOURCE, {
    self: workerScope,
    Math,
    Number,
    Array,
    Float64Array,
    Error,
    TypeError,
    RangeError,
  });
  workerScope.onmessage?.({
    data: { type: "run", sequence: 7, input: KNEI_INPUT },
  });

  const final = posted.at(-1);
  assert.equal(final?.message.type, "done");
  const done = final?.message as CvarWorkerDoneMessage;
  assert.equal(done.sequence, 7);
  assert.equal(done.result.best.share, 13);
  assert.ok(Math.abs(done.result.best.cvar - 176_052.3334165) <= 1e-6);
  assert.equal(done.result.spots.length, 100_000);
  assert.equal(final?.transfer?.[0], done.result.spots.buffer);
});
