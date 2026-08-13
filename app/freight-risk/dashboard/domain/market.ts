import type { GatewayResultV1 } from "../../../contracts";

import {
  decodeFiniteNumber,
  decodeIsoDate,
  decodeNonEmptyString,
  hasExactKeys,
  isRecord,
} from "./decode";

export type MarketSeriesV1 = "fx" | "oil" | "bunker" | "harpex";
export type MarketGatewayState = "LIVE" | "REFERENCE" | "UNAVAILABLE";

export interface MarketQueryV1 {
  readonly series: MarketSeriesV1;
  readonly from: "2026-01-01";
  readonly to: string;
  readonly providerVersion: 3;
}

export interface MarketPointV1 {
  readonly date: string;
  readonly week: string;
  readonly value: number;
}

export interface MarketAttemptV1 {
  readonly provider: string;
  readonly resultCode: string;
  readonly elapsedMs: number;
}

export interface MarketDataV1 {
  readonly series: MarketSeriesV1;
  readonly label: string;
  readonly unit: string;
  readonly provider: string;
  readonly aggregation: string;
  readonly observationStart: string;
  readonly observationEnd: string;
  readonly points: readonly MarketPointV1[];
  readonly attempts: readonly MarketAttemptV1[];
}

export type MarketGatewayResultV1 = GatewayResultV1<MarketDataV1, MarketGatewayState>;

const DATA_KEYS = [
  "series",
  "label",
  "unit",
  "provider",
  "aggregation",
  "observationStart",
  "observationEnd",
  "points",
  "attempts",
] as const;
const POINT_KEYS = ["date", "week", "value"] as const;
const ATTEMPT_KEYS = ["provider", "resultCode", "elapsedMs"] as const;

export function isMarketSeries(value: unknown): value is MarketSeriesV1 {
  return value === "fx" || value === "oil" || value === "bunker" || value === "harpex";
}

export function createMarketQuery(series: MarketSeriesV1, to: string): MarketQueryV1 | null {
  const end = decodeIsoDate(to);
  if (end === null || end < "2026-01-01") {
    return null;
  }
  return { series, from: "2026-01-01", to: end, providerVersion: 3 };
}

function decodeMarketPoint(value: unknown): MarketPointV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, POINT_KEYS)) {
    return null;
  }
  const date = decodeIsoDate(value.date);
  const week = decodeNonEmptyString(value.week);
  const pointValue = decodeFiniteNumber(value.value);
  if (date === null || week === null || pointValue === null || pointValue <= 0) {
    return null;
  }
  return { date, week, value: pointValue };
}

function decodeMarketAttempt(value: unknown): MarketAttemptV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, ATTEMPT_KEYS)) {
    return null;
  }
  const provider = decodeNonEmptyString(value.provider);
  const resultCode = decodeNonEmptyString(value.resultCode);
  const elapsedMs = decodeFiniteNumber(value.elapsedMs);
  if (provider === null || resultCode === null || elapsedMs === null || elapsedMs < 0) {
    return null;
  }
  return { provider, resultCode, elapsedMs };
}

export function decodeMarketData(value: unknown, expectedSeries?: MarketSeriesV1): MarketDataV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, DATA_KEYS) || !isMarketSeries(value.series)) {
    return null;
  }
  const label = decodeNonEmptyString(value.label);
  const unit = decodeNonEmptyString(value.unit);
  const provider = decodeNonEmptyString(value.provider);
  const aggregation = decodeNonEmptyString(value.aggregation);
  const observationStart = decodeIsoDate(value.observationStart);
  const observationEnd = decodeIsoDate(value.observationEnd);
  if (
    label === null
    || unit === null
    || provider === null
    || aggregation === null
    || observationStart === null
    || observationEnd === null
    || observationStart > observationEnd
    || !Array.isArray(value.points)
    || !Array.isArray(value.attempts)
    || (value.series === "harpex" && unit !== "Index")
    || (expectedSeries !== undefined && value.series !== expectedSeries)
  ) {
    return null;
  }
  const points: MarketPointV1[] = [];
  for (const item of value.points) {
    const point = decodeMarketPoint(item);
    if (
      point === null
      || point.date < observationStart
      || point.date > observationEnd
      || (points.at(-1)?.date ?? "") >= point.date
    ) {
      return null;
    }
    points.push(point);
  }
  const attempts: MarketAttemptV1[] = [];
  for (const item of value.attempts) {
    const attempt = decodeMarketAttempt(item);
    if (attempt === null) {
      return null;
    }
    attempts.push(attempt);
  }
  return {
    series: value.series,
    label,
    unit,
    provider,
    aggregation,
    observationStart,
    observationEnd,
    points,
    attempts,
  };
}
