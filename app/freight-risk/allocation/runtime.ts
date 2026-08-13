import type { CvarProgress, CvarSimulationInput, CvarSimulationResult } from "./engine";
import {
  createCvarSimulationWorker,
  type CvarWorkerHandle,
  type CvarWorkerMessage,
} from "./worker";

export type CvarWorkerFactory = () => CvarWorkerHandle;

export interface CvarRunHandlers {
  readonly onProgress: (progress: CvarProgress) => void;
  readonly onDone: (result: CvarSimulationResult) => void;
  readonly onError: (error: unknown) => void;
}

export class CvarRunCoordinator {
  readonly #workerFactory: CvarWorkerFactory;
  #sequence = 0;
  #current: CvarWorkerHandle | null = null;

  constructor(workerFactory: CvarWorkerFactory = createCvarSimulationWorker) {
    this.#workerFactory = workerFactory;
  }

  get sequence(): number {
    return this.#sequence;
  }

  run(input: CvarSimulationInput, handlers: CvarRunHandlers): number {
    this.#sequence += 1;
    const sequence = this.#sequence;
    this.#cleanupCurrent();

    let handle: CvarWorkerHandle;
    try {
      handle = this.#workerFactory();
    } catch (error) {
      handlers.onError(error);
      return sequence;
    }

    this.#current = handle;
    handle.worker.onmessage = (event: MessageEvent<CvarWorkerMessage>): void => {
      if (sequence !== this.#sequence || event.data.sequence !== sequence) {
        return;
      }
      if (event.data.type === "progress") {
        handlers.onProgress({
          stage: event.data.stage,
          percent: event.data.percent,
        });
        return;
      }

      this.#cleanupCurrent();
      handlers.onProgress({ stage: "candidates", percent: 100 });
      handlers.onDone(event.data.result);
    };
    handle.worker.onerror = (event: ErrorEvent): void => {
      if (sequence !== this.#sequence) {
        return;
      }
      this.#cleanupCurrent();
      handlers.onError(event.error ?? new Error(event.message));
    };
    handle.worker.postMessage({ type: "run", sequence, input });
    return sequence;
  }

  dispose(): void {
    this.#sequence += 1;
    this.#cleanupCurrent();
  }

  #cleanupCurrent(): void {
    const current = this.#current;
    if (current === null) {
      return;
    }
    this.#current = null;
    current.worker.onmessage = null;
    current.worker.onerror = null;
    current.worker.terminate();
    current.dispose();
  }
}
