import {
  assertCvarSimulationInput,
  createMulberry32,
  createStandardNormal,
  economicLoss,
  isFinitePositive,
  runCvarSimulation,
  selectKth,
  type CvarProgress,
  type CvarSimulationInput,
  type CvarSimulationResult,
} from "./engine";

export interface CvarWorkerRunRequest {
  readonly type: "run";
  readonly sequence: number;
  readonly input: CvarSimulationInput;
}

export interface CvarWorkerProgressMessage extends CvarProgress {
  readonly type: "progress";
  readonly sequence: number;
}

export interface CvarWorkerDoneMessage {
  readonly type: "done";
  readonly sequence: number;
  readonly result: CvarSimulationResult;
}

export type CvarWorkerMessage =
  | CvarWorkerProgressMessage
  | CvarWorkerDoneMessage;

export interface CvarWorkerLike {
  onmessage: ((event: MessageEvent<CvarWorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: CvarWorkerRunRequest): void;
  terminate(): void;
}

export interface CvarWorkerHandle {
  readonly worker: CvarWorkerLike;
  dispose(): void;
}

const WORKER_FUNCTIONS = [
  isFinitePositive,
  createMulberry32,
  createStandardNormal,
  assertCvarSimulationInput,
  selectKth,
  economicLoss,
  runCvarSimulation,
] as const;

function buildCvarWorkerSource(): string {
  const declarations = WORKER_FUNCTIONS.map((fn) => fn.toString()).join("\n");
  const runnerName = runCvarSimulation.name;
  return `"use strict";
const HORIZONS = [1, 2, 3, 4];
const RISK_WEIGHTS = [0.5, 1, 2];
${declarations}
self.onmessage = function onCvarMessage(event) {
  const message = event.data;
  if (!message || message.type !== "run" || !Number.isInteger(message.sequence)) {
    return;
  }
  const sequence = message.sequence;
  const result = ${runnerName}(message.input, function report(progress) {
    self.postMessage({ type: "progress", sequence, stage: progress.stage, percent: progress.percent });
  });
  self.postMessage({ type: "done", sequence, result }, [result.spots.buffer]);
};`;
}

export const CVAR_WORKER_SOURCE = buildCvarWorkerSource();

export function createCvarSimulationWorker(): CvarWorkerHandle {
  const blob = new Blob([CVAR_WORKER_SOURCE], { type: "text/javascript" });
  const objectUrl = URL.createObjectURL(blob);
  let worker: Worker;
  try {
    worker = new Worker(objectUrl);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  let disposed = false;
  return {
    worker,
    dispose(): void {
      if (!disposed) {
        disposed = true;
        URL.revokeObjectURL(objectUrl);
      }
    },
  };
}
