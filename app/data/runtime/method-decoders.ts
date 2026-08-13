import type { GatewayMetaV1, GatewayResultV1 } from "../../contracts/gateway";
import {
  decodeChokepointTrafficDataV1,
  decodeInsightDataV1,
  decodeMarketDataV1,
  decodeNewsDataV1,
  decodePortTrafficDataV1,
  decodeSnapshotDataV1,
  decodeTuneSuccessV1,
  decodeTuningHealthDataV1,
  decodeUnavailableData,
  decodeWeatherDataV1,
  type ChokepointTrafficDataV1,
  type InsightDataV1,
  type InsightRequestV1,
  type MarketDataV1,
  type MarketQueryV1,
  type NewsDataV1,
  type NewsQueryV1,
  type PortDetailQueryV1,
  type PortTrafficDataV1,
  type SnapshotDataV1,
  type ChokepointDetailQueryV1,
  type TuneRequestV1,
  type TuneSuccessV1,
  type TuningHealthDataV1,
  type WeatherDataV1,
} from "./domains";
import { parseGatewayResultV1 } from "./result";

export type SnapshotStateV1 = "READY" | "UNAVAILABLE";
export type MarketStateV1 = "LIVE" | "REFERENCE" | "UNAVAILABLE";
export type NewsStateV1 = "LIVE" | "UNAVAILABLE";
export type InsightStateV1 = "LLM" | "DERIVED" | "UNAVAILABLE";
export type TuningHealthStateV1 = "LIVE" | "PARTIAL" | "UNAVAILABLE";
export type TuningRunStateV1 = "READY" | "UNAVAILABLE";
export type PortStateV1 = "LIVE" | "PARTIAL" | "STALE" | "UNAVAILABLE";
export type ChokepointStateV1 = "LIVE" | "STALE" | "UNAVAILABLE";
export type WeatherStateV1 = "LIVE" | "PARTIAL" | "UNAVAILABLE";

function isSnapshotState(value: unknown): value is SnapshotStateV1 {
  return value === "READY" || value === "UNAVAILABLE";
}
function isMarketState(value: unknown): value is MarketStateV1 {
  return value === "LIVE" || value === "REFERENCE" || value === "UNAVAILABLE";
}
function isNewsState(value: unknown): value is NewsStateV1 {
  return value === "LIVE" || value === "UNAVAILABLE";
}
function isInsightState(value: unknown): value is InsightStateV1 {
  return value === "LLM" || value === "DERIVED" || value === "UNAVAILABLE";
}
function isTuningHealthState(value: unknown): value is TuningHealthStateV1 {
  return value === "LIVE" || value === "PARTIAL" || value === "UNAVAILABLE";
}
function isTuningRunState(value: unknown): value is TuningRunStateV1 {
  return value === "READY" || value === "UNAVAILABLE";
}
function isPortState(value: unknown): value is PortStateV1 {
  return value === "LIVE" || value === "PARTIAL" || value === "STALE" || value === "UNAVAILABLE";
}
function isChokepointState(value: unknown): value is ChokepointStateV1 {
  return value === "LIVE" || value === "STALE" || value === "UNAVAILABLE";
}
function isWeatherState(value: unknown): value is WeatherStateV1 {
  return value === "LIVE" || value === "PARTIAL" || value === "UNAVAILABLE";
}
function isUnavailableState(value: unknown): value is "UNAVAILABLE" {
  return value === "UNAVAILABLE";
}

function requireUnit(meta: GatewayMetaV1, expected: string | null): void {
  if (meta.unit !== expected) throw new Error(`Gateway unit must be ${String(expected)}`);
}

export function decodeSnapshotResultV1(value: unknown): GatewayResultV1<SnapshotDataV1, SnapshotStateV1> {
  return parseGatewayResultV1(value, decodeSnapshotDataV1, isSnapshotState, (state, data, meta) => {
    if (state !== "READY") throw new Error("Snapshot data requires READY state");
    requireUnit(meta, "USD/FEU");
    if (meta.asOf !== data.dates.at(-1)) throw new Error("Snapshot asOf mismatch");
  });
}

export function decodeMarketResultV1(
  value: unknown,
  query: MarketQueryV1,
): GatewayResultV1<MarketDataV1, MarketStateV1> {
  return parseGatewayResultV1(value, decodeMarketDataV1, isMarketState, (state, data, meta) => {
    if (state !== "LIVE" && state !== "REFERENCE") throw new Error("Market data has an invalid success state");
    if (data.points.length === 0) throw new Error("Market success cannot contain an empty series");
    if (data.series === "harpex" && state !== "REFERENCE") throw new Error("HARPEX must remain REFERENCE");
    if (meta.mode === "fixture" && state === "LIVE") throw new Error("Fixture market cannot be LIVE");
    if (data.series !== query.series || data.observationStart < query.from || data.observationEnd > query.to) {
      throw new Error("Market result does not match its request");
    }
    if (meta.asOf !== data.observationEnd) throw new Error("Market asOf mismatch");
    requireUnit(meta, data.unit);
  });
}

export function decodeNewsResultV1(
  value: unknown,
  query: NewsQueryV1,
): GatewayResultV1<NewsDataV1, NewsStateV1> {
  return parseGatewayResultV1(value, decodeNewsDataV1, isNewsState, (state, data, meta) => {
    if (state !== "LIVE") throw new Error("News data requires LIVE state");
    if (meta.mode === "fixture") throw new Error("News fixture cannot be LIVE");
    if (data.routeId !== query.route || data.policy.providerVersion !== query.providerVersion || data.policy.retry !== query.retry) {
      throw new Error("News result does not match its request");
    }
    if (query.asOf !== "latest" && data.window.to !== query.asOf) throw new Error("News result window does not match asOf");
    if (meta.asOf !== data.window.to) throw new Error("News asOf mismatch");
    requireUnit(meta, "articles");
  });
}

export function decodeInsightResultV1(
  value: unknown,
  request: InsightRequestV1,
): GatewayResultV1<InsightDataV1, InsightStateV1> {
  const evidenceIds = new Set(request.news.map((article) => article.id));
  return parseGatewayResultV1(
    value,
    (data) => decodeInsightDataV1(data, evidenceIds),
    isInsightState,
    (state, data, meta) => {
      if (state === "LLM" && (data.engine !== "GEMINI" || data.model === null || meta.mode !== "live" || meta.provider !== "GEMINI")) {
        throw new Error("LLM state requires a live Gemini result");
      }
      if (state === "DERIVED" && (data.engine !== "RULE_FALLBACK" || data.model !== null || meta.provider !== "RULE_FALLBACK")) {
        throw new Error("DERIVED state requires rule fallback");
      }
      if (state !== "LLM" && state !== "DERIVED") throw new Error("Insight data has an invalid success state");
      if (meta.mode === "cached") throw new Error("Insight results are no-store and cannot be cached");
      if (meta.asOf !== request.route.asOf) throw new Error("Insight asOf does not match its request");
      requireUnit(meta, "USD/FEU");
    },
  );
}

export function decodeTuningHealthResultV1(
  value: unknown,
): GatewayResultV1<TuningHealthDataV1, TuningHealthStateV1> {
  return parseGatewayResultV1(value, decodeTuningHealthDataV1, isTuningHealthState, (state, data, meta) => {
    const available = data.capabilities.filter((capability) => capability.available).length;
    if (state === "LIVE" && available !== 8) throw new Error("LIVE tuning health requires eight capabilities");
    if (state === "PARTIAL" && (available <= 0 || available >= 8)) throw new Error("PARTIAL tuning health requires some capabilities");
    if (state !== "LIVE" && state !== "PARTIAL") throw new Error("Tuning health data has an invalid success state");
    if (meta.mode !== "live") throw new Error("Tuning health success requires live mode");
    requireUnit(meta, null);
  });
}

export function decodeTuningRunResultV1(
  value: unknown,
  request: TuneRequestV1,
): GatewayResultV1<TuneSuccessV1, TuningRunStateV1> {
  return parseGatewayResultV1(value, decodeTuneSuccessV1, isTuningRunState, (state, data, meta) => {
    if (state !== "READY" || meta.mode !== "live") throw new Error("Tuning success requires live READY state");
    if (
      data.routeCode !== request.routeCode
      || data.modelId !== request.modelId
      || data.trainingWindow !== request.trainingWindow
      || data.evaluationOrigins !== request.evaluationOrigins
      || data.forecastOrigin !== request.dates.at(-1)
    ) {
      throw new Error("Tuning result does not match its request");
    }
    requireUnit(meta, "USD/FEU");
  });
}

export function decodePortResultV1(value: unknown): GatewayResultV1<PortTrafficDataV1, PortStateV1> {
  return parseGatewayResultV1(value, decodePortTrafficDataV1, isPortState, (state, data, meta) => {
    if (meta.asOf !== data.commonObservationDate) throw new Error("Port asOf mismatch");
    requireUnit(meta, "metric_tons_estimated,calls");
    if (state === "STALE") {
      if (!meta.cache.stale || (meta.mode !== "cached" && meta.mode !== "fixture")) throw new Error("STALE port requires stale cached or fixture mode");
    } else {
      if (meta.cache.stale) throw new Error("Fresh port state cannot have stale cache metadata");
      if (meta.mode === "fixture") throw new Error("Fixture port cannot be LIVE or PARTIAL");
      if (state === "LIVE" && (data.availableMarkerCount !== 57 || data.availableSeriesCount !== 56)) throw new Error("LIVE port requires complete coverage");
      if (state === "PARTIAL" && (data.availableSeriesCount <= 0 || data.availableSeriesCount >= 56)) throw new Error("PARTIAL port requires partial coverage");
      if (state !== "LIVE" && state !== "PARTIAL") throw new Error("Port data has an invalid success state");
    }
  });
}

export function decodePortSummaryResultV1(value: unknown): GatewayResultV1<PortTrafficDataV1, PortStateV1> {
  const result = decodePortResultV1(value);
  if (result.data?.detail !== undefined) throw new Error("Port summary response cannot include detail");
  return result;
}

export function decodePortDetailResultV1(
  value: unknown,
  query: PortDetailQueryV1,
): GatewayResultV1<PortTrafficDataV1, PortStateV1> {
  const result = decodePortResultV1(value);
  if (result.data !== null) {
    if (result.data.detail?.portId !== query.id) throw new Error("Port detail response does not match its request");
    if (query.days !== undefined && result.data.detail.points.length > query.days) throw new Error("Port detail exceeds requested days");
  }
  return result;
}

export function decodeChokepointResultV1(
  value: unknown,
): GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1> {
  return parseGatewayResultV1(value, decodeChokepointTrafficDataV1, isChokepointState, (state, data, meta) => {
    if (meta.asOf !== data.latestObservationDate) throw new Error("Chokepoint asOf mismatch");
    requireUnit(meta, "metric_tons_estimated,calls");
    if (state === "STALE") {
      if (!meta.cache.stale || (meta.mode !== "cached" && meta.mode !== "fixture")) throw new Error("STALE chokepoint requires stale cached or fixture mode");
    } else if (state === "LIVE") {
      if (meta.cache.stale || meta.mode === "fixture") throw new Error("LIVE chokepoint cannot use stale fixture metadata");
    } else {
      throw new Error("Chokepoint data has an invalid success state");
    }
  });
}

export function decodeChokepointSummaryResultV1(
  value: unknown,
): GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1> {
  const result = decodeChokepointResultV1(value);
  if (result.data?.detail !== undefined) throw new Error("Chokepoint summary response cannot include detail");
  return result;
}

export function decodeChokepointDetailResultV1(
  value: unknown,
  query: ChokepointDetailQueryV1,
): GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1> {
  const result = decodeChokepointResultV1(value);
  if (result.data !== null && result.data.detail?.chokepointId !== query.id) {
    throw new Error("Chokepoint detail response does not match its request");
  }
  return result;
}

export function decodeWeatherUnavailableResultV1(value: unknown): GatewayResultV1<never, "UNAVAILABLE"> {
  return parseGatewayResultV1(value, decodeUnavailableData, isUnavailableState, () => {
    throw new Error("Weather unavailable result cannot contain data");
  });
}

export function decodeWeatherResultV1(
  value: unknown,
): GatewayResultV1<WeatherDataV1, WeatherStateV1> {
  return parseGatewayResultV1(value, decodeWeatherDataV1, isWeatherState, (state, data, meta) => {
    requireUnit(meta, "mixed_SI_and_knots");
    const availableCount = Object.values(data.observations).filter((observation) =>
      observation.observedAt !== null
      || observation.visibilityObservedAt !== null
      || observation.waveHeightM !== null
      || observation.seaSurfaceTemperatureC !== null
      || observation.oceanCurrentKmh !== null,
    ).length;
    if (availableCount === 0) throw new Error("Weather success requires at least one observation");
    if (state === "LIVE") {
      if (availableCount !== data.locationCount || meta.cache.stale || meta.mode === "fixture") {
        throw new Error("LIVE weather requires fresh complete live or fresh cached coverage");
      }
    } else if (state === "PARTIAL") {
      if (availableCount >= data.locationCount && !meta.cache.stale && data.warnings.length === 0) {
        throw new Error("PARTIAL weather requires reduced coverage, a provider warning, or stale cache");
      }
      if (meta.cache.stale && meta.mode !== "cached") {
        throw new Error("Stale weather cache must use cached mode");
      }
    } else {
      throw new Error("Weather data has an invalid success state");
    }
  });
}

export function decodeUnavailableOnlyResultV1(value: unknown): GatewayResultV1<never, "UNAVAILABLE"> {
  return parseGatewayResultV1(value, decodeUnavailableData, isUnavailableState, () => {
    throw new Error("Unavailable-only result cannot contain data");
  });
}
