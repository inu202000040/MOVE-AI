import {
  decodeIsoTimestamp,
  decodeNonEmptyString,
  decodeStringArray,
  hasExactKeys,
  isRecord,
  unreachable,
} from "./decode";

export type InsightEngine = "GEMINI" | "RULE_FALLBACK";
export type InsightConfidence = "높음" | "보통" | "낮음";

export interface InsightFactorV1 {
  readonly factor: string;
  readonly evidenceId: string;
}

export interface InsightDataV1 {
  readonly engine: InsightEngine;
  readonly model: string | null;
  readonly generatedAt: string;
  readonly headline: string;
  readonly summary: string;
  readonly confidence: InsightConfidence;
  readonly quantitativeBasis: readonly string[];
  readonly upwardFactors: readonly InsightFactorV1[];
  readonly downwardFactors: readonly InsightFactorV1[];
  readonly caution: string;
}

const DATA_KEYS = [
  "engine",
  "model",
  "generatedAt",
  "headline",
  "summary",
  "confidence",
  "quantitativeBasis",
  "upwardFactors",
  "downwardFactors",
  "caution",
] as const;
const FACTOR_KEYS = ["factor", "evidenceId"] as const;

function decodeEngine(value: unknown): InsightEngine | null {
  return value === "GEMINI" || value === "RULE_FALLBACK" ? value : null;
}

function decodeConfidence(value: unknown): InsightConfidence | null {
  return value === "높음" || value === "보통" || value === "낮음" ? value : null;
}

function decodeFactor(value: unknown): InsightFactorV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, FACTOR_KEYS)) {
    return null;
  }
  const factor = decodeNonEmptyString(value.factor);
  const evidenceId = decodeNonEmptyString(value.evidenceId);
  return factor === null || evidenceId === null ? null : { factor, evidenceId };
}

function decodeFactorArray(value: unknown): readonly InsightFactorV1[] | null {
  if (!Array.isArray(value) || value.length > 2) {
    return null;
  }
  const factors: InsightFactorV1[] = [];
  for (const item of value) {
    const factor = decodeFactor(item);
    if (factor === null) {
      return null;
    }
    factors.push(factor);
  }
  return factors;
}

export function decodeInsightData(value: unknown): InsightDataV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, DATA_KEYS)) {
    return null;
  }
  const engine = decodeEngine(value.engine);
  const model = value.model === null ? null : decodeNonEmptyString(value.model);
  const generatedAt = decodeIsoTimestamp(value.generatedAt);
  const headline = decodeNonEmptyString(value.headline);
  const summary = decodeNonEmptyString(value.summary);
  const confidence = decodeConfidence(value.confidence);
  const quantitativeBasis = decodeStringArray(value.quantitativeBasis, 2, 4);
  const upwardFactors = decodeFactorArray(value.upwardFactors);
  const downwardFactors = decodeFactorArray(value.downwardFactors);
  const caution = decodeNonEmptyString(value.caution);
  if (
    engine === null
    || (value.model !== null && model === null)
    || generatedAt === null
    || headline === null
    || summary === null
    || confidence === null
    || quantitativeBasis === null
    || upwardFactors === null
    || downwardFactors === null
    || caution === null
    || (engine === "GEMINI" ? model === null : model !== null)
  ) {
    return null;
  }
  return {
    engine,
    model,
    generatedAt,
    headline,
    summary,
    confidence,
    quantitativeBasis,
    upwardFactors,
    downwardFactors,
    caution,
  };
}

export type InsightClientState =
  | { readonly status: "WAITING" | "CONNECTING"; readonly retained: null }
  | { readonly status: "LOADING"; readonly retained: InsightDataV1 | null }
  | { readonly status: "LLM" | "DERIVED" | "CACHED"; readonly retained: InsightDataV1 }
  | { readonly status: "UNAVAILABLE"; readonly retained: null };

export type InsightClientAction =
  | { readonly type: "INPUT_CHANGED"; readonly hasNews: boolean }
  | { readonly type: "CACHE_HYDRATED"; readonly data: InsightDataV1 }
  | { readonly type: "REQUEST_STARTED" }
  | { readonly type: "REQUEST_RESOLVED"; readonly data: InsightDataV1 | null };

export const INITIAL_INSIGHT_STATE: InsightClientState = { status: "WAITING", retained: null };

export function reduceInsightState(
  state: InsightClientState,
  action: InsightClientAction,
): InsightClientState {
  switch (action.type) {
      case "INPUT_CHANGED":
      return action.hasNews
        ? { status: "CONNECTING", retained: null }
        : INITIAL_INSIGHT_STATE;
      case "CACHE_HYDRATED":
        return action.data.engine === "GEMINI"
          ? { status: "CACHED", retained: action.data }
          : state;
    case "REQUEST_STARTED":
      return { status: "LOADING", retained: state.retained };
      case "REQUEST_RESOLVED":
        if (action.data?.engine === "GEMINI") {
          return { status: "LLM", retained: action.data };
        }
        if (action.data?.engine === "RULE_FALLBACK") {
          return { status: "DERIVED", retained: action.data };
        }
        return state.retained !== null
          ? { status: "CACHED", retained: state.retained }
          : { status: "UNAVAILABLE", retained: null };
    default:
      return unreachable(action);
  }
}
