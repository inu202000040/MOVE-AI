import type { GatewayResultV1 } from "../../../contracts";

import {
  decodeIsoTimestamp,
  decodeNonEmptyString,
  decodeStringArray,
  hasExactKeys,
  isRecord,
  unreachable,
} from "./decode";
import { decodeGatewayResult } from "./gateway";

export type InsightGatewayState = "LLM" | "DERIVED" | "UNAVAILABLE";
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

export type InsightResultV1 = GatewayResultV1<InsightDataV1, InsightGatewayState>;

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

function decodeInsightState(value: unknown): InsightGatewayState | null {
  return value === "LLM" || value === "DERIVED" || value === "UNAVAILABLE" ? value : null;
}

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

function decodeInsightData(value: unknown): InsightDataV1 | null {
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

export function decodeInsightResult(value: unknown): InsightResultV1 | null {
  return decodeGatewayResult(value, {
    decodeData: decodeInsightData,
    decodeState: decodeInsightState,
    unavailableState: "UNAVAILABLE",
    isCompatible: (state, data, error, meta) => {
      if (meta.unit !== null) {
        return false;
      }
      if (state === "UNAVAILABLE") {
        return data === null && error !== null;
      }
      if (data === null || error !== null) {
        return false;
      }
      return state === "LLM" ? data.engine === "GEMINI" : data.engine === "RULE_FALLBACK";
    },
  });
}

export type InsightClientState =
  | { readonly status: "WAITING" | "CONNECTING"; readonly retained: null }
  | { readonly status: "LOADING"; readonly retained: InsightResultV1 | null }
  | { readonly status: "LLM" | "DERIVED" | "CACHED"; readonly retained: InsightResultV1 }
  | { readonly status: "UNAVAILABLE"; readonly retained: null };

export type InsightClientAction =
  | { readonly type: "INPUT_CHANGED"; readonly hasNews: boolean }
  | { readonly type: "CACHE_HYDRATED"; readonly result: InsightResultV1 }
  | { readonly type: "REQUEST_STARTED" }
  | { readonly type: "REQUEST_RESOLVED"; readonly result: InsightResultV1 };

export const INITIAL_INSIGHT_STATE: InsightClientState = { status: "WAITING", retained: null };

function isPersistableLlm(result: InsightResultV1): boolean {
  return result.state === "LLM" && result.data?.engine === "GEMINI";
}

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
      return isPersistableLlm(action.result)
        ? { status: "CACHED", retained: action.result }
        : state;
    case "REQUEST_STARTED":
      return { status: "LOADING", retained: state.retained };
    case "REQUEST_RESOLVED":
      if (action.result.state === "LLM") {
        return { status: "LLM", retained: action.result };
      }
        if (action.result.state === "DERIVED") {
          return { status: "DERIVED", retained: action.result };
        }
        return state.retained !== null
          ? { status: "CACHED", retained: state.retained }
          : { status: "UNAVAILABLE", retained: null };
    default:
      return unreachable(action);
  }
}
