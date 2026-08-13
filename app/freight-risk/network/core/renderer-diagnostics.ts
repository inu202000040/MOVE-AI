export type RendererDiagnosticStage =
  | "host"
  | "capability"
  | "constructor"
  | "context"
  | "style"
  | "globe"
  | "promotion"
  | "ready"
  | "fallback";

export type RendererDiagnosticStatus = "started" | "passed" | "degraded" | "failed";

export interface RendererDiagnosticEntry {
  readonly sequence: number;
  readonly stage: RendererDiagnosticStage;
  readonly status: RendererDiagnosticStatus;
  readonly code: string;
  readonly elapsedMs: number;
}

export interface RendererDiagnostics {
  readonly mark: (
    stage: RendererDiagnosticStage,
    status: RendererDiagnosticStatus,
    code: string,
  ) => void;
  readonly snapshot: () => readonly RendererDiagnosticEntry[];
}

export function createRendererDiagnostics(
  now: () => number = performance.now.bind(performance),
): RendererDiagnostics {
  const startedAt = now();
  const entries: RendererDiagnosticEntry[] = [];
  return {
    mark: (stage, status, code) => {
      entries.push({
        sequence: entries.length + 1,
        stage,
        status,
        code,
        elapsedMs: Math.max(0, now() - startedAt),
      });
    },
    snapshot: () => entries.map((entry) => ({ ...entry })),
  };
}
