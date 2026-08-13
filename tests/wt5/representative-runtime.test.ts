import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  CVAR_ALPHA,
  CVAR_WEEKLY_CORRELATION,
  CVAR_WORKER_SOURCE,
  CvarRunCoordinator,
  REPRESENTATIVE_MODEL_IDS,
  adaptRepresentativeSelection,
  type CvarSimulationInput,
  type CvarSimulationResult,
  type CvarWorkerDoneMessage,
  type CvarWorkerHandle,
  type CvarWorkerLike,
  type CvarWorkerMessage,
  type RepresentativeSelectionV1,
} from "../../app/freight-risk/allocation";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

type Mutable<T> = T extends readonly (infer TItem)[]
  ? Mutable<TItem>[]
  : T extends object
    ? { -readonly [TKey in keyof T]: Mutable<T[TKey]> }
    : T;

function mutableClone<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}

function createRepresentative(): RepresentativeSelectionV1 {
  return {
    route: "KNEI",
    currentObservation: {
      date: "2026-08-03",
      value: 4_884,
      unit: "USD/FEU",
    },
    modelId: "sarimax",
    modelName: "SARIMAX",
    modelVersion: "baseline-v1",
    score1w: 99.531841648,
    coverage1w: 88.5,
    selectionMode: "automatic",
    forecastSource: "baseline",
    tuningRunHash: null,
    evaluationProtocol: "rolling-origin-52-v1",
    automaticChampion: {
      modelId: "sarimax",
      modelName: "SARIMAX",
      modelVersion: "baseline-v1",
      score1w: 99.531841648,
    },
    representativeRevision: `rep-v1:${HASH_A}`,
    forecasts: [
      { horizonWeeks: 1, targetDate: "2026-08-10", point: 4_828.98, lower90: 4_482.47, upper90: 5_175.49 },
      { horizonWeeks: 2, targetDate: "2026-08-17", point: 4_791.32, lower90: 4_227.22, upper90: 5_355.43 },
      { horizonWeeks: 3, targetDate: "2026-08-24", point: 4_767.23, lower90: 3_935.75, upper90: 5_598.72 },
      { horizonWeeks: 4, targetDate: "2026-08-31", point: 4_753.74, lower90: 3_439.8, upper90: 6_067.68 },
    ],
    metricsByHorizon: [1, 2, 3, 4].map((horizonWeeks) => ({
      horizonWeeks: horizonWeeks as 1 | 2 | 3 | 4,
      mapePct: 1,
      mse: 1,
      rmse: 1,
      mase: 1,
      mapeScore: 99,
      mseScore: 99,
      maseScore: 99,
      totalScore: 99,
      coverage: {
        pct: 88.5,
        hits: 46,
        total: 52,
        sampleSize: 52,
        target: 0.9,
        intervalMethod: "pi90",
      },
    })),
    modelAgreementByHorizon: [1, 2, 3, 4].map((horizonWeeks) => ({
      horizonWeeks: horizonWeeks as 1 | 2 | 3 | 4,
      thresholdPct: 3,
      up: 0,
      down: 0,
      flat: 8,
      total: 8,
      members: REPRESENTATIVE_MODEL_IDS.map((modelId) => ({
        modelId,
        modelName: modelId,
        modelVersion: "baseline-v1",
        forecastSource: "baseline" as const,
        tuningRunHash: null,
        point: 4_800,
        changePct: 0,
        direction: "flat" as const,
      })),
    })),
  };
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

test("validates and projects the canonical representative without regenerating identity", () => {
  const representative = createRepresentative();
  const adapted = adaptRepresentativeSelection(representative);
  assert.strictEqual(adapted.selection, representative);
  assert.equal(adapted.selection.tuningRunHash, null);
  assert.equal(adapted.selection.representativeRevision, `rep-v1:${HASH_A}`);
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
  provenanceOnly.modelVersion = "baseline-v2";
  provenanceOnly.evaluationProtocol = "rolling-origin-52-v2";
  provenanceOnly.representativeRevision = `rep-v1:${HASH_B}`;
  const baselineKey = adaptRepresentativeSelection(baseline).routeSimulationKey;
  const provenanceKey = adaptRepresentativeSelection(provenanceOnly).routeSimulationKey;
  assert.equal(provenanceKey, baselineKey);

  const effectiveChange = mutableClone(baseline);
  effectiveChange.forecasts[0].point += 1;
  effectiveChange.representativeRevision = `rep-v1:${HASH_B}`;
  assert.notEqual(
    adaptRepresentativeSelection(effectiveChange).routeSimulationKey,
    baselineKey,
  );
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
