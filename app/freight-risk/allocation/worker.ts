import type {
  CvarProgress,
  CvarSimulationInput,
  CvarSimulationResult,
} from "./engine";
import { CVAR_WORKER_SOURCE } from "./worker-source";

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

export { CVAR_WORKER_SOURCE } from "./worker-source";

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
