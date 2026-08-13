import { ROUTE_IDS, type RouteId } from "../../contracts/routes";
import networkCatalogArtifact from "../generated/network-catalog-seam-v1.json";
import tuningConfigArtifact from "../generated/tuning-config-v1.json";
import {
  array,
  boolean,
  exactArrayLength,
  exactKeys,
  finite,
  integer,
  isoDate,
  isoTimestamp,
  literal,
  nullableFinite,
  nullableString,
  oneOf,
  record,
  string,
  stringArray,
  type UnknownRecord,
} from "../artifacts/decoder-core";
import {
  assertChokepointTrafficFixtureV1,
  assertForecastSnapshotV3,
  assertMarketReferenceV1,
  assertNetworkCatalogSeamV1,
  assertPortTrafficFixtureV1,
  assertTuningConfigV1,
} from "../artifacts/decoders";

export const MODEL_IDS_V1 = [
  "naive",
  "sarimax",
  "lightgbm",
  "xgboost",
  "random_forest",
  "prophet",
  "timesfm",
  "chronos",
] as const;
export type ModelIdV1 = (typeof MODEL_IDS_V1)[number];
type NullableNumberV1 = number | null;

function url(value: unknown, path: string): string {
  const raw = string(value, path);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${path} must be a valid URL`);
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
    throw new Error(`${path} must be a public http(s) URL`);
  }
  return raw;
}

function nonnegative(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result < 0) throw new Error(`${path} cannot be negative`);
  return result;
}

function nullableNonnegative(value: unknown, path: string): NullableNumberV1 {
  const result = nullableFinite(value, path);
  if (result !== null && result < 0) throw new Error(`${path} cannot be negative`);
  return result;
}

function fourTuple<T>(
  value: unknown,
  path: string,
  decode: (item: unknown, index: number) => T,
): readonly [T, T, T, T] {
  const items = array(value, path);
  exactArrayLength(items, 4, path);
  return [decode(items[0], 0), decode(items[1], 1), decode(items[2], 2), decode(items[3], 3)];
}

function horizonAt(index: number): 1 | 2 | 3 | 4 {
  if (index === 0) return 1;
  if (index === 1) return 2;
  if (index === 2) return 3;
  if (index === 3) return 4;
  throw new Error(`Invalid horizon index ${index}`);
}

function directionLabel(code: NewsArticleV1["directionCode"]): NewsArticleV1["direction"] {
  if (code === "UP") return "상승 압력";
  if (code === "DOWN") return "하락 압력";
  if (code === "MIXED") return "혼합 신호";
  return "방향 불확실";
}

function gradeLabel(grade: NewsArticleV1["grade"]): NewsArticleV1["gradeLabel"] {
  if (grade === "S") return "S 직접 가격·운항";
  if (grade === "A") return "A 직접 운영 영향";
  return "B 시장 참고";
}

assertNetworkCatalogSeamV1(networkCatalogArtifact);
const networkRoot = record(networkCatalogArtifact, "$networkCatalog");
const portIdentityById = new Map(
  array(networkRoot.ports, "$networkCatalog.ports").map((value, index) => {
    const item = record(value, `$networkCatalog.ports[${index}]`);
    const id = string(item.id, "id");
    return [id, {
      id,
      routeId: oneOf(item.routeId, ROUTE_IDS, "routeId"),
      portWatchId: string(item.upstreamPortWatchId, "upstreamPortWatchId"),
    }] as const;
  }),
);
const chokeIdentityById = new Map(
  array(networkRoot.chokepoints, "$networkCatalog.chokepoints").map((value, index) => {
    const item = record(value, `$networkCatalog.chokepoints[${index}]`);
    const id = string(item.id, "id");
    return [id, { id, portWatchId: string(item.upstreamPortWatchId, "upstreamPortWatchId") }] as const;
  }),
);

export interface SnapshotDataV1 extends Readonly<Record<string, unknown>> {
  readonly schemaVersion: "glovis-freight-risk/v3";
  readonly generatedAt: string;
  readonly protocol: UnknownRecord;
  readonly source: UnknownRecord;
  readonly dates: readonly string[];
  readonly routes: UnknownRecord;
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
export interface MarketDataV1 extends Readonly<Record<string, unknown>> {
  readonly series: "fx" | "oil" | "bunker" | "harpex";
  readonly label: string;
  readonly unit: string;
  readonly provider: string;
  readonly aggregation: string;
  readonly observationStart: string;
  readonly observationEnd: string;
  readonly points: readonly MarketPointV1[];
  readonly attempts: readonly MarketAttemptV1[];
}

export interface PortSummaryV1 {
  readonly portId: string;
  readonly routeCode: RouteId;
  readonly portWatchId: string;
  readonly sharedSeries: boolean;
  readonly sharedWithPortIds: readonly string[];
  readonly observedAt: string;
  readonly observedDays7d: number;
  readonly previousObservedDays7d: number;
  readonly estimatedImportTons7d: NullableNumberV1;
  readonly estimatedExportTons7d: NullableNumberV1;
  readonly estimatedTotalTons7d: NullableNumberV1;
  readonly previousEstimatedImportTons7d: NullableNumberV1;
  readonly previousEstimatedExportTons7d: NullableNumberV1;
  readonly previousEstimatedTotalTons7d: NullableNumberV1;
  readonly estimatedTotalTonsChangePercent: NullableNumberV1;
  readonly containerVesselCalls7d: NullableNumberV1;
  readonly previousContainerVesselCalls7d: NullableNumberV1;
  readonly vesselCallsChangePercent: NullableNumberV1;
}
export interface PortDetailPointV1 {
  readonly date: string;
  readonly estimatedImportTons: NullableNumberV1;
  readonly estimatedExportTons: NullableNumberV1;
  readonly estimatedTotalTons: NullableNumberV1;
  readonly containerVesselCalls: NullableNumberV1;
  readonly estimatedImportTons7d: NullableNumberV1;
  readonly estimatedExportTons7d: NullableNumberV1;
  readonly estimatedTotalTons7d: NullableNumberV1;
  readonly containerVesselCalls7d: NullableNumberV1;
}
export interface PortDetailV1 {
  readonly portId: string;
  readonly routeCode: RouteId;
  readonly portWatchId: string;
  readonly sharedSeries: boolean;
  readonly sharedWithPortIds: readonly string[];
  readonly points: readonly PortDetailPointV1[];
}
export interface PortTrafficDataV1 extends Readonly<Record<string, unknown>> {
  readonly fetchedAt: string;
  readonly commonObservationDate: string;
  readonly source: string;
  readonly attribution: string;
  readonly methodologyNote: string;
  readonly caveats: readonly string[];
  readonly units: { readonly cargo: "metric_tons_estimated"; readonly vesselCalls: "calls" };
  readonly markerCount: 57;
  readonly uniqueSeriesCount: 56;
  readonly availableMarkerCount: number;
  readonly availableSeriesCount: number;
  readonly summaries: Readonly<Record<string, PortSummaryV1>>;
  readonly detail?: PortDetailV1;
}

export interface ChokepointSummaryV1 {
  readonly chokepointId: string;
  readonly portwatchId: string;
  readonly observedAt: string;
  readonly containerVessels7d: NullableNumberV1;
  readonly estimatedTransitTons7d: NullableNumberV1;
  readonly previousContainerVessels7d: NullableNumberV1;
  readonly previousEstimatedTransitTons7d: NullableNumberV1;
  readonly vesselChangePercent: NullableNumberV1;
  readonly transitTonsChangePercent: NullableNumberV1;
}
export interface ChokepointDetailPointV1 {
  readonly date: string;
  readonly containerVessels7d: NullableNumberV1;
  readonly estimatedTransitTons7d: NullableNumberV1;
}
export interface ChokepointDetailV1 {
  readonly chokepointId: string;
  readonly portwatchId: string;
  readonly points: readonly ChokepointDetailPointV1[];
}
export interface ChokepointTrafficDataV1 extends Readonly<Record<string, unknown>> {
  readonly fetchedAt: string;
  readonly latestObservationDate: string;
  readonly source: string;
  readonly attribution: string;
  readonly methodologyNote: string;
  readonly summaries: Readonly<Record<string, ChokepointSummaryV1>>;
  readonly detail?: ChokepointDetailV1;
}

export interface InsightFactorV1 {
  readonly factor: string;
  readonly evidenceId: string;
}
export interface InsightDataV1 extends Readonly<Record<string, unknown>> {
  readonly engine: "GEMINI" | "RULE_FALLBACK";
  readonly model: string | null;
  readonly generatedAt: string;
  readonly headline: string;
  readonly summary: string;
  readonly confidence: "높음" | "보통" | "낮음";
  readonly quantitativeBasis: readonly string[];
  readonly upwardFactors: readonly InsightFactorV1[];
  readonly downwardFactors: readonly InsightFactorV1[];
  readonly caution: string;
}

export interface NewsArticleV1 {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly originalTitle: string;
  readonly source: string;
  readonly publishedAt: string;
  readonly effectiveAt: string | null;
  readonly url: string;
  readonly direction: "상승 압력" | "하락 압력" | "혼합 신호" | "방향 불확실";
  readonly directionCode: "UP" | "DOWN" | "MIXED" | "NEUTRAL";
  readonly factor: string;
  readonly relevance: "ROUTE";
  readonly impactScore: number;
  readonly impactSignals: readonly string[];
  readonly grade: "S" | "A" | "B";
  readonly gradeLabel: "S 직접 가격·운항" | "A 직접 운영 영향" | "B 시장 참고";
  readonly reason: string;
  readonly isBoundary: boolean;
  readonly provenance: "VERIFIED" | "LIVE_SEARCH";
}
export interface NewsDataV1 extends Readonly<Record<string, unknown>> {
  readonly routeId: RouteId;
  readonly stage: "FILTERED";
  readonly llmAnalyzed: false;
  readonly window: { readonly from: string; readonly to: string; readonly days: 30 | 90 };
  readonly policy: { readonly providerVersion: 18; readonly retry: 0 | 1 };
  readonly stats: {
    readonly fetchedCandidates: number;
    readonly filteredCandidates: number;
    readonly duplicatesRemoved: number;
    readonly selectedArticles: number;
    readonly successfulProviders: number;
    readonly candidateBreakdown: {
      readonly directImpact: number;
      readonly contextual: number;
      readonly routeFallback: number;
    };
  };
  readonly articles: readonly NewsArticleV1[];
  readonly attempts: readonly {
    readonly provider: string;
    readonly resultCode: string;
    readonly elapsedMs: number;
    readonly from: string;
    readonly to: string;
  }[];
}

export interface TuningCapabilityV1 {
  readonly id: ModelIdV1;
  readonly available: boolean;
  readonly execution: "native" | "external";
  readonly version: string | null;
  readonly reasonCode: string | null;
  readonly checkedAt: string;
  readonly probeId: string | null;
  readonly probeStatus: string;
}
export interface TuningHealthDataV1 extends Readonly<Record<string, unknown>> {
  readonly serviceVersion: string;
  readonly capabilities: readonly [
    TuningCapabilityV1, TuningCapabilityV1, TuningCapabilityV1, TuningCapabilityV1,
    TuningCapabilityV1, TuningCapabilityV1, TuningCapabilityV1, TuningCapabilityV1,
  ];
}

export interface TuneMetricV1 {
  readonly horizon: 1 | 2 | 3 | 4;
  readonly mapePct: number;
  readonly mse: number;
  readonly rmse: number;
  readonly mase: number;
  readonly coverage90Pct: number;
  readonly hits: number;
  readonly total: number;
  readonly sampleSize: number;
}
export interface TuneEvaluationRecordV1 {
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
export interface TuneForecastV1 {
  readonly horizon: 1 | 2 | 3 | 4;
  readonly date: string;
  readonly value: number;
  readonly lower90: number;
  readonly upper90: number;
}
export interface TuneEvaluationGroupV1 {
  readonly horizon: 1 | 2 | 3 | 4;
  readonly records: readonly TuneEvaluationRecordV1[];
}
export interface TuneSuccessV1 extends Readonly<Record<string, unknown>> {
  readonly status: "success";
  readonly routeCode: RouteId;
  readonly modelId: ModelIdV1;
  readonly modelVersion: string;
  readonly forecastOrigin: string;
  readonly maseProtocol: "seasonal-naive-52-fixed";
  readonly trainingWindow: "expanding" | "rolling_104" | "rolling_52";
  readonly evaluationOrigins: number;
  readonly parameters: Readonly<Record<string, string | number>>;
  readonly forecasts: readonly [TuneForecastV1, TuneForecastV1, TuneForecastV1, TuneForecastV1];
  readonly metricsByHorizon: readonly [TuneMetricV1, TuneMetricV1, TuneMetricV1, TuneMetricV1];
  readonly evaluationByHorizon: readonly [TuneEvaluationGroupV1, TuneEvaluationGroupV1, TuneEvaluationGroupV1, TuneEvaluationGroupV1];
  readonly elapsedMs: number;
  readonly methodologyKo: string;
}

export interface MarketQueryV1 {
  readonly series: "fx" | "oil" | "bunker" | "harpex";
  readonly from: string;
  readonly to: string;
  readonly providerVersion: 3;
}
export interface NewsQueryV1 {
  readonly route: RouteId;
  readonly asOf: string;
  readonly providerVersion: 18;
  readonly retry: 0 | 1;
  readonly refresh?: string;
}
export interface PortDetailQueryV1 { readonly id: string; readonly days?: number }
export interface ChokepointDetailQueryV1 { readonly id: string }
export type EmptyQueryV1 = Readonly<Record<string, never>>;

export interface InsightNewsV1 {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly publishedAt: string;
  readonly url: string;
  readonly directionCode: "UP" | "DOWN" | "MIXED" | "NEUTRAL";
  readonly factor: string;
  readonly grade: "S" | "A" | "B";
  readonly reason: string;
}
export interface InsightRequestV1 {
  readonly route: { readonly id: RouteId; readonly name: string; readonly asOf: string };
  readonly current: { readonly date: string; readonly value: number };
  readonly selectedHorizon: 1 | 2 | 3 | 4;
  readonly direction: "상승" | "하락" | "보합";
  readonly forecast: { readonly date: string; readonly value: number; readonly changePct: number; readonly lower: number; readonly upper: number; readonly coveragePct: number };
  readonly forecastPath: readonly [
    { readonly horizon: 1; readonly date: string; readonly value: number; readonly lower: number; readonly upper: number },
    { readonly horizon: 2; readonly date: string; readonly value: number; readonly lower: number; readonly upper: number },
    { readonly horizon: 3; readonly date: string; readonly value: number; readonly lower: number; readonly upper: number },
    { readonly horizon: 4; readonly date: string; readonly value: number; readonly lower: number; readonly upper: number },
  ];
  readonly representativeModel: { readonly name: string; readonly mapePct: number; readonly mse: number; readonly mase: number; readonly totalScore: number };
  readonly modelAgreement: { readonly up: number; readonly down: number; readonly flat: number; readonly total: 8 };
  readonly news: readonly InsightNewsV1[];
}
export interface TuneRequestV1 {
  readonly routeCode: RouteId;
  readonly modelId: ModelIdV1;
  readonly dates: readonly string[];
  readonly values: readonly number[];
  readonly trainingWindow: "expanding" | "rolling_104" | "rolling_52";
  readonly evaluationOrigins: number;
  readonly parameters: Readonly<Record<string, string | number>>;
}

export function decodeSnapshotDataV1(value: unknown): SnapshotDataV1 {
  assertForecastSnapshotV3(value);
  const root = record(value, "$snapshotData");
  return {
    schemaVersion: "glovis-freight-risk/v3",
    generatedAt: isoTimestamp(root.generatedAt, "$snapshotData.generatedAt"),
    protocol: record(root.protocol, "$snapshotData.protocol"),
    source: record(root.source, "$snapshotData.source"),
    dates: array(root.dates, "$snapshotData.dates").map((item, index) => isoDate(item, `$snapshotData.dates[${index}]`)),
    routes: record(root.routes, "$snapshotData.routes"),
  };
}

export function decodeMarketDataV1(value: unknown): MarketDataV1 {
  const root = record(value, "$marketData");
  exactKeys(root, ["series", "label", "unit", "provider", "aggregation", "observationStart", "observationEnd", "points", "attempts"], "$marketData");
  const series = oneOf(root.series, ["fx", "oil", "bunker", "harpex"] as const, "$marketData.series");
  const expectedUnit = { fx: "KRW/USD", oil: "USD/bbl", bunker: "USD/metric ton", harpex: "Index" }[series];
  const unit = string(root.unit, "$marketData.unit");
  if (unit !== expectedUnit) throw new Error(`Wrong unit for market series ${series}`);
  const points = array(root.points, "$marketData.points").map((value, index) => {
    const point = record(value, `$marketData.points[${index}]`);
    exactKeys(point, ["date", "week", "value"], `$marketData.points[${index}]`);
    const week = string(point.week, `${index}.week`);
    if (!/^\d{4}-W\d{2}$/u.test(week)) throw new Error("Invalid market week");
    return { date: isoDate(point.date, `${index}.date`), week, value: nonnegative(point.value, `${index}.value`) };
  });
  for (let index = 1; index < points.length; index += 1) {
    if (points[index - 1].date >= points[index].date) throw new Error("Market points must be unique and ascending");
  }
  const observationStart = isoDate(root.observationStart, "observationStart");
  const observationEnd = isoDate(root.observationEnd, "observationEnd");
  if (observationStart > observationEnd) throw new Error("Invalid market observation range");
  if (points.length > 0 && (points[0].date !== observationStart || points.at(-1)?.date !== observationEnd)) {
    throw new Error("Market observation range does not match points");
  }
  const attempts = array(root.attempts, "$marketData.attempts").map((value, index) => {
    const attempt = record(value, `$marketData.attempts[${index}]`);
    exactKeys(attempt, ["provider", "resultCode", "elapsedMs"], `$marketData.attempts[${index}]`);
    return {
      provider: string(attempt.provider, "provider"),
      resultCode: string(attempt.resultCode, "resultCode"),
      elapsedMs: nonnegative(attempt.elapsedMs, "elapsedMs"),
    };
  });
  return { series, label: string(root.label, "label"), unit, provider: string(root.provider, "provider"), aggregation: string(root.aggregation, "aggregation"), observationStart, observationEnd, points, attempts };
}

export function marketFromArtifact(value: unknown, series: MarketQueryV1["series"], from: string, to: string): MarketDataV1 {
  assertMarketReferenceV1(value);
  const root = record(value, "$marketArtifact");
  const entry = record(record(root.series, "$marketArtifact.series")[series], `$marketArtifact.series.${series}`);
  const points = array(entry.points, "points").filter((point) => {
    const date = isoDate(record(point, "point").date, "point.date");
    return date >= from && date <= to;
  });
  return decodeMarketDataV1({
    series,
    label: entry.label,
    unit: entry.unit,
    provider: entry.provider,
    aggregation: entry.aggregation,
    observationStart: points.length > 0 ? record(points[0], "firstPoint").date : from,
    observationEnd: points.length > 0 ? record(points.at(-1), "lastPoint").date : to,
    points,
    attempts: entry.attempts,
  });
}

function decodeSharedPortIdentity(value: UnknownRecord, path: string) {
  const portId = string(value.portId, `${path}.portId`);
  const identity = portIdentityById.get(portId);
  if (!identity) throw new Error(`${path}.portId is not canonical`);
  const routeCode = oneOf(value.routeCode, ROUTE_IDS, `${path}.routeCode`);
  const portWatchId = string(value.portWatchId, `${path}.portWatchId`);
  if (routeCode !== identity.routeId || portWatchId !== identity.portWatchId) {
    throw new Error(`${path} does not match network catalog identity`);
  }
  const sharedSeries = boolean(value.sharedSeries, `${path}.sharedSeries`);
  const sharedWithPortIds = stringArray(value.sharedWithPortIds, `${path}.sharedWithPortIds`);
  if (new Set(sharedWithPortIds).size !== sharedWithPortIds.length || sharedWithPortIds.includes(portId)) {
    throw new Error(`${path}.sharedWithPortIds must be unique and exclude self`);
  }
  for (const sharedId of sharedWithPortIds) {
    const shared = portIdentityById.get(sharedId);
    if (!shared || shared.portWatchId !== portWatchId) throw new Error(`${path} has invalid shared port identity`);
  }
  if (sharedSeries !== (sharedWithPortIds.length > 0)) throw new Error(`${path}.sharedSeries mismatch`);
  return { portId, routeCode, portWatchId, sharedSeries, sharedWithPortIds };
}

function decodePortSummary(value: unknown, key: string): PortSummaryV1 {
  const path = `$portData.summaries.${key}`;
  const root = record(value, path);
  exactKeys(root, ["portId", "routeCode", "portWatchId", "sharedSeries", "sharedWithPortIds", "observedAt", "observedDays7d", "previousObservedDays7d", "estimatedImportTons7d", "estimatedExportTons7d", "estimatedTotalTons7d", "previousEstimatedImportTons7d", "previousEstimatedExportTons7d", "previousEstimatedTotalTons7d", "estimatedTotalTonsChangePercent", "containerVesselCalls7d", "previousContainerVesselCalls7d", "vesselCallsChangePercent"], path);
  const identity = decodeSharedPortIdentity(root, path);
  if (identity.portId !== key) throw new Error(`${path} key must equal portId`);
  const observedDays7d = integer(root.observedDays7d, `${path}.observedDays7d`);
  const previousObservedDays7d = integer(root.previousObservedDays7d, `${path}.previousObservedDays7d`);
  if (observedDays7d < 0 || observedDays7d > 7 || previousObservedDays7d < 0 || previousObservedDays7d > 7) throw new Error(`${path} observed days outside 0..7`);
  const previousTotal = nullableNonnegative(root.previousEstimatedTotalTons7d, `${path}.previousEstimatedTotalTons7d`);
  const totalChange = nullableFinite(root.estimatedTotalTonsChangePercent, `${path}.estimatedTotalTonsChangePercent`);
  const previousCalls = nullableNonnegative(root.previousContainerVesselCalls7d, `${path}.previousContainerVesselCalls7d`);
  const callsChange = nullableFinite(root.vesselCallsChangePercent, `${path}.vesselCallsChangePercent`);
  if ((previousTotal === null || previousTotal <= 0) && totalChange !== null) throw new Error(`${path} total change requires positive previous value`);
  if ((previousCalls === null || previousCalls <= 0) && callsChange !== null) throw new Error(`${path} call change requires positive previous value`);
  return {
    ...identity,
    observedAt: isoDate(root.observedAt, `${path}.observedAt`),
    observedDays7d,
    previousObservedDays7d,
    estimatedImportTons7d: nullableNonnegative(root.estimatedImportTons7d, `${path}.estimatedImportTons7d`),
    estimatedExportTons7d: nullableNonnegative(root.estimatedExportTons7d, `${path}.estimatedExportTons7d`),
    estimatedTotalTons7d: nullableNonnegative(root.estimatedTotalTons7d, `${path}.estimatedTotalTons7d`),
    previousEstimatedImportTons7d: nullableNonnegative(root.previousEstimatedImportTons7d, `${path}.previousEstimatedImportTons7d`),
    previousEstimatedExportTons7d: nullableNonnegative(root.previousEstimatedExportTons7d, `${path}.previousEstimatedExportTons7d`),
    previousEstimatedTotalTons7d: previousTotal,
    estimatedTotalTonsChangePercent: totalChange,
    containerVesselCalls7d: nullableNonnegative(root.containerVesselCalls7d, `${path}.containerVesselCalls7d`),
    previousContainerVesselCalls7d: previousCalls,
    vesselCallsChangePercent: callsChange,
  };
}

function decodePortDetail(value: unknown): PortDetailV1 {
  const root = record(value, "$portData.detail");
  exactKeys(root, ["portId", "routeCode", "portWatchId", "sharedSeries", "sharedWithPortIds", "points"], "$portData.detail");
  const identity = decodeSharedPortIdentity(root, "$portData.detail");
  const points = array(root.points, "$portData.detail.points").map((value, index) => {
    const path = `$portData.detail.points[${index}]`;
    const point = record(value, path);
    exactKeys(point, ["date", "estimatedImportTons", "estimatedExportTons", "estimatedTotalTons", "containerVesselCalls", "estimatedImportTons7d", "estimatedExportTons7d", "estimatedTotalTons7d", "containerVesselCalls7d"], path);
    return {
      date: isoDate(point.date, `${path}.date`),
      estimatedImportTons: nullableNonnegative(point.estimatedImportTons, `${path}.estimatedImportTons`),
      estimatedExportTons: nullableNonnegative(point.estimatedExportTons, `${path}.estimatedExportTons`),
      estimatedTotalTons: nullableNonnegative(point.estimatedTotalTons, `${path}.estimatedTotalTons`),
      containerVesselCalls: nullableNonnegative(point.containerVesselCalls, `${path}.containerVesselCalls`),
      estimatedImportTons7d: nullableNonnegative(point.estimatedImportTons7d, `${path}.estimatedImportTons7d`),
      estimatedExportTons7d: nullableNonnegative(point.estimatedExportTons7d, `${path}.estimatedExportTons7d`),
      estimatedTotalTons7d: nullableNonnegative(point.estimatedTotalTons7d, `${path}.estimatedTotalTons7d`),
      containerVesselCalls7d: nullableNonnegative(point.containerVesselCalls7d, `${path}.containerVesselCalls7d`),
    };
  });
  for (let index = 1; index < points.length; index += 1) if (points[index - 1].date >= points[index].date) throw new Error("Port detail points must be ascending and unique");
  return { ...identity, points };
}

export function decodePortTrafficDataV1(value: unknown): PortTrafficDataV1 {
  const root = record(value, "$portData");
  exactKeys(root, root.detail === undefined
    ? ["fetchedAt", "commonObservationDate", "source", "attribution", "methodologyNote", "caveats", "units", "markerCount", "uniqueSeriesCount", "availableMarkerCount", "availableSeriesCount", "summaries"]
    : ["fetchedAt", "commonObservationDate", "source", "attribution", "methodologyNote", "caveats", "units", "markerCount", "uniqueSeriesCount", "availableMarkerCount", "availableSeriesCount", "summaries", "detail"], "$portData");
  const units = record(root.units, "$portData.units");
  exactKeys(units, ["cargo", "vesselCalls"], "$portData.units");
  literal(units.cargo, "metric_tons_estimated", "$portData.units.cargo");
  literal(units.vesselCalls, "calls", "$portData.units.vesselCalls");
  const markerCount = literal(integer(root.markerCount, "markerCount"), 57, "markerCount");
  const uniqueSeriesCount = literal(integer(root.uniqueSeriesCount, "uniqueSeriesCount"), 56, "uniqueSeriesCount");
  const availableMarkerCount = integer(root.availableMarkerCount, "availableMarkerCount");
  const availableSeriesCount = integer(root.availableSeriesCount, "availableSeriesCount");
  if (availableMarkerCount < 0 || availableMarkerCount > markerCount || availableSeriesCount < 0 || availableSeriesCount > uniqueSeriesCount) throw new Error("Invalid port availability count");
  const rawSummaries = record(root.summaries, "$portData.summaries");
  const summaryKeys = Object.keys(rawSummaries).sort();
  const canonicalKeys = [...portIdentityById.keys()].sort();
  if (summaryKeys.join("\0") !== canonicalKeys.join("\0")) throw new Error("Port summaries must contain the exact catalog IDs");
  const summaries: Record<string, PortSummaryV1> = {};
  for (const key of canonicalKeys) summaries[key] = decodePortSummary(rawSummaries[key], key);
  const commonObservationDate = isoDate(root.commonObservationDate, "commonObservationDate");
  if (Object.values(summaries).some((summary) => summary.observedAt !== commonObservationDate)) {
    throw new Error("Port summary observation dates must match commonObservationDate");
  }
  const availableSummaries = Object.values(summaries).filter((summary) => summary.observedDays7d > 0);
  const availableUpstreamSeries = new Set(availableSummaries.map((summary) => summary.portWatchId));
  if (availableMarkerCount !== availableSummaries.length || availableSeriesCount !== availableUpstreamSeries.size) {
    throw new Error("Port availability counts do not match decoded summaries");
  }
  const detail = root.detail === undefined ? undefined : decodePortDetail(root.detail);
  if (detail && !summaries[detail.portId]) throw new Error("Port detail is not present in summaries");
  if (detail?.points.at(-1)?.date !== undefined && detail.points.at(-1)?.date !== commonObservationDate) {
    throw new Error("Port detail must end at commonObservationDate");
  }
  return {
    fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"), commonObservationDate,
    source: string(root.source, "source"), attribution: string(root.attribution, "attribution"), methodologyNote: string(root.methodologyNote, "methodologyNote"),
    caveats: stringArray(root.caveats, "caveats"), units: { cargo: "metric_tons_estimated", vesselCalls: "calls" }, markerCount, uniqueSeriesCount,
    availableMarkerCount, availableSeriesCount, summaries, ...(detail ? { detail } : {}),
  };
}

export function portFromArtifact(value: unknown, detailId?: string, days = 180): PortTrafficDataV1 {
  assertPortTrafficFixtureV1(value);
  const root = record(value, "$portArtifact");
  const base = {
    fetchedAt: root.fetchedAt, commonObservationDate: root.commonObservationDate, source: root.source, attribution: root.attribution,
    methodologyNote: root.methodologyNote, caveats: root.caveats, units: root.units, markerCount: root.markerCount,
    uniqueSeriesCount: root.uniqueSeriesCount, availableMarkerCount: root.availableMarkerCount, availableSeriesCount: root.availableSeriesCount,
    summaries: root.summaries,
  };
  if (!detailId) return decodePortTrafficDataV1(base);
  const detail = record(record(root.details, "details")[detailId], `details.${detailId}`);
  return decodePortTrafficDataV1({ ...base, detail: { ...detail, points: array(detail.points, "detail.points").slice(-days) } });
}

function decodeChokeSummary(value: unknown, key: string): ChokepointSummaryV1 {
  const path = `$chokeData.summaries.${key}`;
  const root = record(value, path);
  exactKeys(root, ["chokepointId", "portwatchId", "observedAt", "containerVessels7d", "estimatedTransitTons7d", "previousContainerVessels7d", "previousEstimatedTransitTons7d", "vesselChangePercent", "transitTonsChangePercent"], path);
  const chokepointId = string(root.chokepointId, `${path}.chokepointId`);
  const identity = chokeIdentityById.get(chokepointId);
  if (key !== chokepointId || !identity || string(root.portwatchId, `${path}.portwatchId`) !== identity.portWatchId) throw new Error(`${path} identity mismatch`);
  const previousVessels = nullableNonnegative(root.previousContainerVessels7d, `${path}.previousContainerVessels7d`);
  const previousTons = nullableNonnegative(root.previousEstimatedTransitTons7d, `${path}.previousEstimatedTransitTons7d`);
  const vesselChange = nullableFinite(root.vesselChangePercent, `${path}.vesselChangePercent`);
  const tonsChange = nullableFinite(root.transitTonsChangePercent, `${path}.transitTonsChangePercent`);
  if ((previousVessels === null || previousVessels <= 0) && vesselChange !== null) throw new Error(`${path} vessel change requires positive previous value`);
  if ((previousTons === null || previousTons <= 0) && tonsChange !== null) throw new Error(`${path} ton change requires positive previous value`);
  return {
    chokepointId, portwatchId: identity.portWatchId, observedAt: isoDate(root.observedAt, `${path}.observedAt`),
    containerVessels7d: nullableNonnegative(root.containerVessels7d, `${path}.containerVessels7d`), estimatedTransitTons7d: nullableNonnegative(root.estimatedTransitTons7d, `${path}.estimatedTransitTons7d`),
    previousContainerVessels7d: previousVessels, previousEstimatedTransitTons7d: previousTons, vesselChangePercent: vesselChange, transitTonsChangePercent: tonsChange,
  };
}

function decodeChokeDetail(value: unknown): ChokepointDetailV1 {
  const root = record(value, "$chokeData.detail");
  exactKeys(root, ["chokepointId", "portwatchId", "points"], "$chokeData.detail");
  const chokepointId = string(root.chokepointId, "detail.chokepointId");
  const identity = chokeIdentityById.get(chokepointId);
  if (!identity || string(root.portwatchId, "detail.portwatchId") !== identity.portWatchId) throw new Error("Chokepoint detail identity mismatch");
  const points = array(root.points, "detail.points").map((value, index) => {
    const path = `$chokeData.detail.points[${index}]`;
    const point = record(value, path);
    exactKeys(point, ["date", "containerVessels7d", "estimatedTransitTons7d"], path);
    return { date: isoDate(point.date, `${path}.date`), containerVessels7d: nullableNonnegative(point.containerVessels7d, `${path}.containerVessels7d`), estimatedTransitTons7d: nullableNonnegative(point.estimatedTransitTons7d, `${path}.estimatedTransitTons7d`) };
  });
  for (let index = 1; index < points.length; index += 1) if (points[index - 1].date >= points[index].date) throw new Error("Chokepoint detail points must be ascending and unique");
  return { chokepointId, portwatchId: identity.portWatchId, points };
}

export function decodeChokepointTrafficDataV1(value: unknown): ChokepointTrafficDataV1 {
  const root = record(value, "$chokeData");
  exactKeys(root, root.detail === undefined
    ? ["fetchedAt", "latestObservationDate", "source", "attribution", "methodologyNote", "summaries"]
    : ["fetchedAt", "latestObservationDate", "source", "attribution", "methodologyNote", "summaries", "detail"], "$chokeData");
  const rawSummaries = record(root.summaries, "$chokeData.summaries");
  const summaryKeys = Object.keys(rawSummaries).sort();
  const canonicalKeys = [...chokeIdentityById.keys()].sort();
  if (summaryKeys.join("\0") !== canonicalKeys.join("\0")) throw new Error("Chokepoint summaries must contain the exact catalog IDs");
  const summaries: Record<string, ChokepointSummaryV1> = {};
  for (const key of canonicalKeys) summaries[key] = decodeChokeSummary(rawSummaries[key], key);
  const latestObservationDate = isoDate(root.latestObservationDate, "latestObservationDate");
  if (Object.values(summaries).some((summary) => summary.observedAt !== latestObservationDate)) {
    throw new Error("Chokepoint summary observation dates must match latestObservationDate");
  }
  const detail = root.detail === undefined ? undefined : decodeChokeDetail(root.detail);
  if (detail && !summaries[detail.chokepointId]) throw new Error("Chokepoint detail is not present in summaries");
  if (detail?.points.at(-1)?.date !== undefined && detail.points.at(-1)?.date !== latestObservationDate) {
    throw new Error("Chokepoint detail must end at latestObservationDate");
  }
  return {
    fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"), latestObservationDate,
    source: string(root.source, "source"), attribution: string(root.attribution, "attribution"), methodologyNote: string(root.methodologyNote, "methodologyNote"),
    summaries, ...(detail ? { detail } : {}),
  };
}

export function chokeFromArtifact(value: unknown, detailId?: string): ChokepointTrafficDataV1 {
  assertChokepointTrafficFixtureV1(value);
  const root = record(value, "$chokeArtifact");
  const base = { fetchedAt: root.fetchedAt, latestObservationDate: root.latestObservationDate, source: root.source, attribution: root.attribution, methodologyNote: root.methodologyNote, summaries: root.summaries };
  if (!detailId) return decodeChokepointTrafficDataV1(base);
  return decodeChokepointTrafficDataV1({ ...base, detail: record(record(root.details, "details")[detailId], `details.${detailId}`) });
}

function decodeInsightFactor(value: unknown, path: string, allowedEvidenceIds: ReadonlySet<string>): InsightFactorV1 {
  const root = record(value, path);
  exactKeys(root, ["factor", "evidenceId"], path);
  const factor = string(root.factor, `${path}.factor`).trim();
  const evidenceId = string(root.evidenceId, `${path}.evidenceId`).trim();
  if (!factor || !evidenceId) throw new Error(`${path} fields cannot be empty`);
  if (!allowedEvidenceIds.has(evidenceId)) throw new Error(`${path}.evidenceId is not in request news`);
  return { factor, evidenceId };
}

export function decodeInsightDataV1(value: unknown, allowedEvidenceIds: ReadonlySet<string>): InsightDataV1 {
  const root = record(value, "$insightData");
  exactKeys(root, ["engine", "model", "generatedAt", "headline", "summary", "confidence", "quantitativeBasis", "upwardFactors", "downwardFactors", "caution"], "$insightData");
  const engine = oneOf(root.engine, ["GEMINI", "RULE_FALLBACK"] as const, "engine");
  const model = nullableString(root.model, "model");
  if ((engine === "GEMINI" && !model) || (engine === "RULE_FALLBACK" && model !== null)) throw new Error("Insight engine/model invariant failed");
  const confidence = oneOf(root.confidence, ["높음", "보통", "낮음"] as const, "confidence");
  const quantitativeBasis = stringArray(root.quantitativeBasis, "quantitativeBasis");
  if (quantitativeBasis.length < 2 || quantitativeBasis.length > 4 || (engine === "RULE_FALLBACK" && quantitativeBasis.length !== 3)) throw new Error("Invalid quantitativeBasis length");
  const decodeFactors = (raw: unknown, path: string) => {
    const factors = array(raw, path);
    if (factors.length > 2) throw new Error(`${path} has more than two factors`);
    return factors.map((item, index) => decodeInsightFactor(item, `${path}[${index}]`, allowedEvidenceIds));
  };
  return {
    engine, model, generatedAt: isoTimestamp(root.generatedAt, "generatedAt"), headline: string(root.headline, "headline"), summary: string(root.summary, "summary"), confidence,
    quantitativeBasis, upwardFactors: decodeFactors(root.upwardFactors, "upwardFactors"), downwardFactors: decodeFactors(root.downwardFactors, "downwardFactors"), caution: string(root.caution, "caution"),
  };
}

export function decodeNewsDataV1(value: unknown): NewsDataV1 {
  const root = record(value, "$newsData");
  exactKeys(root, ["routeId", "stage", "llmAnalyzed", "window", "policy", "stats", "articles", "attempts"], "$newsData");
  const routeId = oneOf(root.routeId, ROUTE_IDS, "routeId");
  literal(root.stage, "FILTERED", "stage");
  if (boolean(root.llmAnalyzed, "llmAnalyzed") !== false) throw new Error("News data cannot be LLM analyzed");
  const window = record(root.window, "window");
  exactKeys(window, ["from", "to", "days"], "window");
  const from = isoDate(window.from, "window.from");
  const to = isoDate(window.to, "window.to");
  const days = oneOf(window.days, [30, 90] as const, "window.days");
  const inclusiveDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (inclusiveDays !== days) throw new Error("News window does not match days");
  const policy = record(root.policy, "policy");
  exactKeys(policy, ["providerVersion", "retry"], "policy");
  literal(integer(policy.providerVersion, "providerVersion"), 18, "providerVersion");
  const retry = oneOf(policy.retry, [0, 1] as const, "retry");
  if ((retry === 0 ? 30 : 90) !== days) throw new Error("News retry/window mismatch");
  const articles = array(root.articles, "articles");
  if (articles.length < 1 || articles.length > 5) throw new Error("News LIVE data must contain 1..5 articles");
  const decodedArticles = articles.map((value, index): NewsArticleV1 => {
    const path = `articles[${index}]`;
    const article = record(value, path);
    exactKeys(article, ["id", "title", "summary", "originalTitle", "source", "publishedAt", "effectiveAt", "url", "direction", "directionCode", "factor", "relevance", "impactScore", "impactSignals", "grade", "gradeLabel", "reason", "isBoundary", "provenance"], path);
    const id = string(article.id, `${path}.id`);
    if (id !== String(index + 1)) throw new Error("News article IDs must match display order");
    const publishedAt = isoTimestamp(article.publishedAt, `${path}.publishedAt`);
    const endOfWindow = Date.parse(`${to}T23:59:59.999Z`);
    if (Date.parse(publishedAt) > endOfWindow) throw new Error("Future news article is not allowed");
    const effectiveAt = article.effectiveAt === null ? null : isoTimestamp(article.effectiveAt, `${path}.effectiveAt`);
    if (effectiveAt && Date.parse(effectiveAt) > endOfWindow) throw new Error("Future news effectiveAt is not allowed");
    const directionCode = oneOf(article.directionCode, ["UP", "DOWN", "MIXED", "NEUTRAL"] as const, `${path}.directionCode`);
    const expectedDirection = directionLabel(directionCode);
    const direction = oneOf(article.direction, ["상승 압력", "하락 압력", "혼합 신호", "방향 불확실"] as const, `${path}.direction`);
    if (direction !== expectedDirection) throw new Error("News direction label mismatch");
    const grade = oneOf(article.grade, ["S", "A", "B"] as const, `${path}.grade`);
    const expectedGradeLabel = gradeLabel(grade);
    const decodedGradeLabel = oneOf(article.gradeLabel, ["S 직접 가격·운항", "A 직접 운영 영향", "B 시장 참고"] as const, `${path}.gradeLabel`);
    if (decodedGradeLabel !== expectedGradeLabel) throw new Error("News grade label mismatch");
    return {
      id, title: string(article.title, `${path}.title`), summary: string(article.summary, `${path}.summary`), originalTitle: string(article.originalTitle, `${path}.originalTitle`), source: string(article.source, `${path}.source`),
      publishedAt, effectiveAt, url: url(article.url, `${path}.url`), direction, directionCode, factor: string(article.factor, `${path}.factor`), relevance: literal(article.relevance, "ROUTE", `${path}.relevance`),
      impactScore: nonnegative(article.impactScore, `${path}.impactScore`), impactSignals: stringArray(article.impactSignals, `${path}.impactSignals`), grade, gradeLabel: decodedGradeLabel,
      reason: string(article.reason, `${path}.reason`), isBoundary: boolean(article.isBoundary, `${path}.isBoundary`), provenance: oneOf(article.provenance, ["VERIFIED", "LIVE_SEARCH"] as const, `${path}.provenance`),
    };
  });
  const stats = record(root.stats, "stats");
  exactKeys(stats, ["fetchedCandidates", "filteredCandidates", "duplicatesRemoved", "selectedArticles", "successfulProviders", "candidateBreakdown"], "stats");
  const candidateBreakdown = record(stats.candidateBreakdown, "candidateBreakdown");
  exactKeys(candidateBreakdown, ["directImpact", "contextual", "routeFallback"], "candidateBreakdown");
  const decodedStats = {
    fetchedCandidates: integer(stats.fetchedCandidates, "fetchedCandidates"), filteredCandidates: integer(stats.filteredCandidates, "filteredCandidates"), duplicatesRemoved: integer(stats.duplicatesRemoved, "duplicatesRemoved"),
    selectedArticles: integer(stats.selectedArticles, "selectedArticles"), successfulProviders: integer(stats.successfulProviders, "successfulProviders"),
    candidateBreakdown: { directImpact: integer(candidateBreakdown.directImpact, "directImpact"), contextual: integer(candidateBreakdown.contextual, "contextual"), routeFallback: integer(candidateBreakdown.routeFallback, "routeFallback") },
  };
  if (Object.values(decodedStats).some((item) => typeof item === "number" && item < 0) || Object.values(decodedStats.candidateBreakdown).some((item) => item < 0)) throw new Error("News stats cannot be negative");
  if (decodedStats.selectedArticles !== decodedArticles.length) throw new Error("News selectedArticles mismatch");
  const attempts = array(root.attempts, "attempts").map((value, index) => {
    const path = `attempts[${index}]`;
    const attempt = record(value, path);
    exactKeys(attempt, ["provider", "resultCode", "elapsedMs", "from", "to"], path);
    const attemptFrom = isoDate(attempt.from, `${path}.from`);
    const attemptTo = isoDate(attempt.to, `${path}.to`);
    if (attemptFrom > attemptTo || attemptFrom < from || attemptTo > to) throw new Error("News attempt window mismatch");
    return { provider: string(attempt.provider, `${path}.provider`), resultCode: string(attempt.resultCode, `${path}.resultCode`), elapsedMs: nonnegative(attempt.elapsedMs, `${path}.elapsedMs`), from: attemptFrom, to: attemptTo };
  });
  if (decodedStats.successfulProviders > attempts.length) throw new Error("News successful provider count mismatch");
  return { routeId, stage: "FILTERED", llmAnalyzed: false, window: { from, to, days }, policy: { providerVersion: 18, retry }, stats: decodedStats, articles: decodedArticles, attempts };
}

export function decodeTuningHealthDataV1(value: unknown): TuningHealthDataV1 {
  const root = record(value, "$tuningHealth");
  exactKeys(root, ["serviceVersion", "capabilities"], "$tuningHealth");
  const capabilities = array(root.capabilities, "capabilities");
  exactArrayLength(capabilities, 8, "capabilities");
  const decoded = capabilities.map((value, index): TuningCapabilityV1 => {
    const path = `capabilities[${index}]`;
    const capability = record(value, path);
    exactKeys(capability, ["id", "available", "execution", "version", "reasonCode", "checkedAt", "probeId", "probeStatus"], path);
    const id = literal(capability.id, MODEL_IDS_V1[index], `${path}.id`);
    const available = boolean(capability.available, `${path}.available`);
    const version = nullableString(capability.version, `${path}.version`);
    const reasonCode = nullableString(capability.reasonCode, `${path}.reasonCode`);
    const probeId = nullableString(capability.probeId, `${path}.probeId`);
    const probeStatus = string(capability.probeStatus, `${path}.probeStatus`);
    if (available && (!version || !probeId || probeStatus !== "PASS" || reasonCode !== null)) throw new Error(`${path} available capability invariant failed`);
    if (!available && (!reasonCode || probeStatus === "PASS")) throw new Error(`${path} unavailable capability invariant failed`);
    return { id, available, execution: oneOf(capability.execution, ["native", "external"] as const, `${path}.execution`), version, reasonCode, checkedAt: isoTimestamp(capability.checkedAt, `${path}.checkedAt`), probeId, probeStatus };
  });
  return { serviceVersion: string(root.serviceVersion, "serviceVersion"), capabilities: [decoded[0], decoded[1], decoded[2], decoded[3], decoded[4], decoded[5], decoded[6], decoded[7]] };
}

assertTuningConfigV1(tuningConfigArtifact);
const tuningRoot = record(tuningConfigArtifact, "$tuningConfig");
const tuningParameterCatalog = record(tuningRoot.parameterCatalog, "$tuningConfig.parameterCatalog");

function decodeTuningParameters(value: unknown, modelId: ModelIdV1): Readonly<Record<string, string | number>> {
  const input = record(value, "parameters");
  const definitions = tuningParameterCatalog[modelId] === undefined ? [] : array(tuningParameterCatalog[modelId], `parameterCatalog.${modelId}`);
  const definitionByKey = new Map(definitions.map((value, index) => {
    const definition = record(value, `parameterCatalog.${modelId}[${index}]`);
    return [string(definition.key, "parameter.key"), definition] as const;
  }));
  const output: Record<string, string | number> = {};
  for (const [key, parameter] of Object.entries(input)) {
    const definition = definitionByKey.get(key);
    if (!definition) throw new Error(`Unknown parameter ${modelId}.${key}`);
    const inputType = string(definition.inputType, `parameterCatalog.${modelId}.${key}.inputType`);
    if (inputType === "number") {
      if (typeof parameter !== "number" || !Number.isFinite(parameter)) throw new Error(`Parameter ${modelId}.${key} must be a number`);
      const minimum = nullableFinite(definition.minimum, "minimum");
      const maximum = nullableFinite(definition.maximum, "maximum");
      const step = nullableFinite(definition.step, "step");
      if ((minimum !== null && parameter < minimum) || (maximum !== null && parameter > maximum)) throw new Error(`Parameter ${modelId}.${key} is outside its range`);
      if (step !== null && minimum !== null) {
        const steps = (parameter - minimum) / step;
        if (Math.abs(steps - Math.round(steps)) > 1e-8) throw new Error(`Parameter ${modelId}.${key} does not match its step`);
      }
      output[key] = parameter;
    } else if (inputType === "select") {
      if (typeof parameter !== "string") throw new Error(`Parameter ${modelId}.${key} must be a string`);
      const optionsText = nullableString(definition.optionsJson, "optionsJson");
      const options = array(optionsText ? JSON.parse(optionsText) : [], "options").map((value, index) => {
        const option = record(value, `options[${index}]`);
        exactKeys(option, ["value", "label"], `options[${index}]`);
        return string(option.value, `options[${index}].value`);
      });
      if (!options.includes(parameter)) throw new Error(`Parameter ${modelId}.${key} is not an allowed option`);
      output[key] = parameter;
    } else {
      throw new Error(`Unknown input type for ${modelId}.${key}`);
    }
  }
  return output;
}

function decodeMetric(value: unknown, index: number, evaluationOrigins: number): TuneMetricV1 {
  const path = `metricsByHorizon[${index}]`;
  const metric = record(value, path);
  exactKeys(metric, ["horizon", "mapePct", "mse", "rmse", "mase", "coverage90Pct", "hits", "total", "sampleSize"], path);
  const horizon = literal(integer(metric.horizon, `${path}.horizon`), horizonAt(index), `${path}.horizon`);
  const hits = integer(metric.hits, `${path}.hits`);
  const total = integer(metric.total, `${path}.total`);
  const sampleSize = integer(metric.sampleSize, `${path}.sampleSize`);
  const coverage90Pct = nonnegative(metric.coverage90Pct, `${path}.coverage90Pct`);
  if (hits < 0 || total !== evaluationOrigins || sampleSize !== evaluationOrigins || hits > total || coverage90Pct > 100 || Math.abs(coverage90Pct - (100 * hits) / total) > 0.11) throw new Error(`${path} metric count/coverage mismatch`);
  return { horizon, mapePct: nonnegative(metric.mapePct, `${path}.mapePct`), mse: nonnegative(metric.mse, `${path}.mse`), rmse: nonnegative(metric.rmse, `${path}.rmse`), mase: nonnegative(metric.mase, `${path}.mase`), coverage90Pct, hits, total, sampleSize };
}

function decodeEvaluationRecord(value: unknown, path: string): TuneEvaluationRecordV1 {
  const item = record(value, path);
  exactKeys(item, ["forecastOrigin", "targetDate", "predicted", "actual", "difference", "absoluteError", "apePct", "lower90", "upper90", "covered90"], path);
  const forecastOrigin = isoDate(item.forecastOrigin, `${path}.forecastOrigin`);
  const targetDate = isoDate(item.targetDate, `${path}.targetDate`);
  if (forecastOrigin >= targetDate) throw new Error(`${path} forecast origin must precede target`);
  const predicted = nonnegative(item.predicted, `${path}.predicted`);
  const actual = nonnegative(item.actual, `${path}.actual`);
  const difference = finite(item.difference, `${path}.difference`);
  const absoluteError = nonnegative(item.absoluteError, `${path}.absoluteError`);
  const lower90 = finite(item.lower90, `${path}.lower90`);
  const upper90 = finite(item.upper90, `${path}.upper90`);
  const covered90 = boolean(item.covered90, `${path}.covered90`);
  if (lower90 > predicted || predicted > upper90 || Math.abs(difference - (predicted - actual)) > 1e-6 || Math.abs(absoluteError - Math.abs(difference)) > 1e-6 || covered90 !== (actual >= lower90 && actual <= upper90)) throw new Error(`${path} evaluation invariant failed`);
  return { forecastOrigin, targetDate, predicted, actual, difference, absoluteError, apePct: nonnegative(item.apePct, `${path}.apePct`), lower90, upper90, covered90 };
}

export function decodeTuneSuccessV1(value: unknown): TuneSuccessV1 {
  const root = record(value, "$tuneSuccess");
  exactKeys(root, ["status", "routeCode", "modelId", "modelVersion", "forecastOrigin", "maseProtocol", "trainingWindow", "evaluationOrigins", "parameters", "forecasts", "metricsByHorizon", "evaluationByHorizon", "elapsedMs", "methodologyKo"], "$tuneSuccess");
  literal(root.status, "success", "status");
  const routeCode = oneOf(root.routeCode, ROUTE_IDS, "routeCode");
  const modelId = oneOf(root.modelId, MODEL_IDS_V1, "modelId");
  const forecastOrigin = isoDate(root.forecastOrigin, "forecastOrigin");
  const evaluationOrigins = integer(root.evaluationOrigins, "evaluationOrigins");
  if (evaluationOrigins < 36 || evaluationOrigins > 52) throw new Error("Invalid evaluationOrigins");
  const forecasts = fourTuple(root.forecasts, "forecasts", (value, index) => {
    const path = `forecasts[${index}]`;
    const item = record(value, path);
    exactKeys(item, ["horizon", "date", "value", "lower90", "upper90"], path);
    const horizon = literal(integer(item.horizon, `${path}.horizon`), horizonAt(index), `${path}.horizon`);
    const point = nonnegative(item.value, `${path}.value`);
    const lower90 = finite(item.lower90, `${path}.lower90`);
    const upper90 = finite(item.upper90, `${path}.upper90`);
    if (lower90 > point || point > upper90) throw new Error(`${path} interval mismatch`);
    const date = isoDate(item.date, `${path}.date`);
    const expectedDate = new Date(Date.parse(`${forecastOrigin}T00:00:00Z`) + horizon * 7 * 86_400_000).toISOString().slice(0, 10);
    if (date !== expectedDate) throw new Error(`${path} date does not match horizon`);
    return { horizon, date, value: point, lower90, upper90 };
  });
  const metricsByHorizon = fourTuple(root.metricsByHorizon, "metricsByHorizon", (item, index) => decodeMetric(item, index, evaluationOrigins));
  const evaluationByHorizon = fourTuple(root.evaluationByHorizon, "evaluationByHorizon", (value, index) => {
    const path = `evaluationByHorizon[${index}]`;
    const group = record(value, path);
    exactKeys(group, ["horizon", "records"], path);
    const horizon = literal(integer(group.horizon, `${path}.horizon`), horizonAt(index), `${path}.horizon`);
    const records = array(group.records, `${path}.records`).map((item, recordIndex) => decodeEvaluationRecord(item, `${path}.records[${recordIndex}]`));
    exactArrayLength(records, evaluationOrigins, `${path}.records`);
    if (records.some((record) => Date.parse(`${record.targetDate}T00:00:00Z`) - Date.parse(`${record.forecastOrigin}T00:00:00Z`) !== horizon * 7 * 86_400_000)) {
      throw new Error(`${path} record target dates do not match horizon`);
    }
    return { horizon, records };
  });
  return {
    status: "success", routeCode, modelId, modelVersion: string(root.modelVersion, "modelVersion"), forecastOrigin, maseProtocol: literal(root.maseProtocol, "seasonal-naive-52-fixed", "maseProtocol"),
    trainingWindow: oneOf(root.trainingWindow, ["expanding", "rolling_104", "rolling_52"] as const, "trainingWindow"), evaluationOrigins, parameters: decodeTuningParameters(root.parameters, modelId),
    forecasts, metricsByHorizon, evaluationByHorizon, elapsedMs: nonnegative(root.elapsedMs, "elapsedMs"), methodologyKo: string(root.methodologyKo, "methodologyKo"),
  };
}

export function decodeUnavailableData(): never {
  throw new Error("Unavailable result cannot contain data");
}

const INSIGHT_KEYS = ["route", "current", "selectedHorizon", "direction", "forecast", "forecastPath", "representativeModel", "modelAgreement", "news"] as const;

export function decodeInsightRequestV1(value: unknown): InsightRequestV1 {
  const root = record(value, "$insightRequest");
  exactKeys(root, INSIGHT_KEYS, "$insightRequest");
  const route = record(root.route, "route");
  exactKeys(route, ["id", "name", "asOf"], "route");
  const routeId = oneOf(route.id, ROUTE_IDS, "route.id");
  const routeAsOf = isoDate(route.asOf, "route.asOf");
  const current = record(root.current, "current");
  exactKeys(current, ["date", "value"], "current");
  const currentDate = isoDate(current.date, "current.date");
  if (currentDate !== routeAsOf) throw new Error("route.asOf must equal current.date");
  const currentValue = finite(current.value, "current.value");
  if (currentValue <= 0) throw new Error("Current value must be positive");
  const selectedHorizon = oneOf(root.selectedHorizon, [1, 2, 3, 4] as const, "selectedHorizon");
  const direction = oneOf(root.direction, ["상승", "하락", "보합"] as const, "direction");
  const forecast = record(root.forecast, "forecast");
  exactKeys(forecast, ["date", "value", "changePct", "lower", "upper", "coveragePct"], "forecast");
  const forecastValue = finite(forecast.value, "forecast.value");
  const changePct = finite(forecast.changePct, "forecast.changePct");
  const lower = finite(forecast.lower, "forecast.lower");
  const upper = finite(forecast.upper, "forecast.upper");
  const coveragePct = finite(forecast.coveragePct, "forecast.coveragePct");
  if (forecastValue <= 0 || lower > forecastValue || forecastValue > upper || coveragePct < 0 || coveragePct > 100) throw new Error("Invalid forecast bounds");
  const computedDirection = changePct >= 3 ? "상승" : changePct <= -3 ? "하락" : "보합";
  if (computedDirection !== direction) throw new Error("Direction does not match changePct");
  const rawForecastPath = array(root.forecastPath, "forecastPath");
  exactArrayLength(rawForecastPath, 4, "forecastPath");
  const decodeForecastPoint = <H extends 1 | 2 | 3 | 4>(value: unknown, index: number, expectedHorizon: H) => {
    const path = `forecastPath[${index}]`;
    const point = record(value, path);
    exactKeys(point, ["horizon", "date", "value", "lower", "upper"], path);
    const horizon = literal(integer(point.horizon, `${path}.horizon`), expectedHorizon, `${path}.horizon`);
    const pointValue = finite(point.value, `${path}.value`);
    const pointLower = finite(point.lower, `${path}.lower`);
    const pointUpper = finite(point.upper, `${path}.upper`);
    if (pointValue <= 0 || pointLower > pointValue || pointValue > pointUpper) throw new Error("Invalid forecast path interval");
    return { horizon, date: isoDate(point.date, `${path}.date`), value: pointValue, lower: pointLower, upper: pointUpper };
  };
  const forecastPath = [
    decodeForecastPoint(rawForecastPath[0], 0, 1),
    decodeForecastPoint(rawForecastPath[1], 1, 2),
    decodeForecastPoint(rawForecastPath[2], 2, 3),
    decodeForecastPoint(rawForecastPath[3], 3, 4),
  ] as const;
  const selectedPoint = forecastPath[selectedHorizon - 1];
  const forecastDate = isoDate(forecast.date, "forecast.date");
  if (selectedPoint.date !== forecastDate || Math.abs(selectedPoint.value - forecastValue) > 1e-8 || Math.abs(selectedPoint.lower - lower) > 1e-8 || Math.abs(selectedPoint.upper - upper) > 1e-8) throw new Error("Selected forecast does not match forecastPath");
  const representativeModel = record(root.representativeModel, "representativeModel");
  exactKeys(representativeModel, ["name", "mapePct", "mse", "mase", "totalScore"], "representativeModel");
  const decodedRepresentative = { name: string(representativeModel.name, "name"), mapePct: nonnegative(representativeModel.mapePct, "mapePct"), mse: nonnegative(representativeModel.mse, "mse"), mase: nonnegative(representativeModel.mase, "mase"), totalScore: finite(representativeModel.totalScore, "totalScore") };
  const modelAgreement = record(root.modelAgreement, "modelAgreement");
  exactKeys(modelAgreement, ["up", "down", "flat", "total"], "modelAgreement");
  const up = integer(modelAgreement.up, "up"); const down = integer(modelAgreement.down, "down"); const flat = integer(modelAgreement.flat, "flat"); const total = literal(integer(modelAgreement.total, "total"), 8, "total");
  if (up < 0 || down < 0 || flat < 0 || up + down + flat !== total) throw new Error("Invalid model agreement");
  const rawNews = array(root.news, "news");
  if (rawNews.length > 5) throw new Error("Insight news cannot exceed five items");
  const news = rawNews.map((value, index): InsightNewsV1 => {
    const path = `news[${index}]`;
    const article = record(value, path);
    exactKeys(article, ["id", "title", "summary", "source", "publishedAt", "url", "directionCode", "factor", "grade", "reason"], path);
    const publishedAt = isoTimestamp(article.publishedAt, `${path}.publishedAt`);
    if (Date.parse(publishedAt) > Date.parse(`${currentDate}T23:59:59.999Z`)) throw new Error("Insight news cannot be in the future");
    return { id: string(article.id, `${path}.id`), title: string(article.title, `${path}.title`), summary: string(article.summary, `${path}.summary`), source: string(article.source, `${path}.source`), publishedAt, url: url(article.url, `${path}.url`), directionCode: oneOf(article.directionCode, ["UP", "DOWN", "MIXED", "NEUTRAL"] as const, `${path}.directionCode`), factor: string(article.factor, `${path}.factor`), grade: oneOf(article.grade, ["S", "A", "B"] as const, `${path}.grade`), reason: string(article.reason, `${path}.reason`) };
  });
  if (new Set(news.map((article) => article.id)).size !== news.length) throw new Error("Insight news IDs must be unique");
  return {
    route: { id: routeId, name: string(route.name, "route.name"), asOf: routeAsOf }, current: { date: currentDate, value: currentValue }, selectedHorizon, direction,
    forecast: { date: forecastDate, value: forecastValue, changePct, lower, upper, coveragePct }, forecastPath, representativeModel: decodedRepresentative,
    modelAgreement: { up, down, flat, total }, news,
  };
}

export function decodeTuneRequestV1(value: unknown): TuneRequestV1 {
  const root = record(value, "$tuneRequest");
  exactKeys(root, ["routeCode", "modelId", "dates", "values", "trainingWindow", "evaluationOrigins", "parameters"], "$tuneRequest");
  const routeCode = oneOf(root.routeCode, ROUTE_IDS, "routeCode");
  const modelId = oneOf(root.modelId, MODEL_IDS_V1, "modelId");
  const dates = array(root.dates, "dates").map((date, index) => isoDate(date, `dates[${index}]`));
  const values = array(root.values, "values").map((number, index) => finite(number, `values[${index}]`));
  if (dates.length !== values.length || dates.length < 108 || dates.length > 10_000) throw new Error("Invalid training series length");
  for (let index = 1; index < dates.length; index += 1) {
    const intervalMs = Date.parse(`${dates[index]}T00:00:00Z`) - Date.parse(`${dates[index - 1]}T00:00:00Z`);
    if (intervalMs !== 7 * 86_400_000) throw new Error("Dates must be unique weekly observations");
  }
  if (values.some((number) => number <= 0)) throw new Error("Values must be positive");
  const trainingWindow = oneOf(root.trainingWindow, ["expanding", "rolling_104", "rolling_52"] as const, "trainingWindow");
  const evaluationOrigins = integer(root.evaluationOrigins, "evaluationOrigins");
  if (evaluationOrigins < 36 || evaluationOrigins > 52) throw new Error("Invalid evaluationOrigins");
  return { routeCode, modelId, dates, values, trainingWindow, evaluationOrigins, parameters: decodeTuningParameters(root.parameters, modelId) };
}
