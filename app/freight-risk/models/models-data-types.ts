export interface HistoricalPointV1 {
  readonly date: string;
  readonly value: number;
}

export interface EvaluationEvidenceV1 {
  readonly forecastOrigin: string;
  readonly targetDate: string;
  readonly predicted: number;
  readonly actual: number;
  readonly difference: number;
  readonly absoluteError: number;
  readonly apePct: number;
  readonly lower90: number;
  readonly upper90: number;
  readonly covered90: boolean;
}
