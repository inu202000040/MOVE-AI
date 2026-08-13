import type { RouteId } from "../../contracts/routes";
import {
  array,
  exactKeys,
  finite,
  integer,
  isoDate,
  isoTimestamp,
  literal,
  record,
  string,
  stringArray,
  type UnknownRecord,
} from "../artifacts/decoder-core";
import {
  assertChokepointTrafficFixtureV1,
  assertForecastSnapshotV3,
  assertMarketReferenceV1,
  assertPortTrafficFixtureV1,
} from "../artifacts/decoders";

export type SnapshotDataV1 = Readonly<Record<string, unknown>> & {
  readonly schemaVersion: "glovis-freight-risk/v3";
  readonly generatedAt: string;
  readonly dates: readonly string[];
  readonly routes: UnknownRecord;
};

export interface MarketPointV1 { readonly date: string; readonly week: string; readonly value: number }
export type MarketDataV1 = Readonly<Record<string, unknown>> & {
  readonly series: "fx" | "oil" | "bunker" | "harpex";
  readonly label: string;
  readonly unit: string;
  readonly provider: string;
  readonly aggregation: string;
  readonly observationStart: string;
  readonly observationEnd: string;
  readonly points: readonly MarketPointV1[];
  readonly attempts: readonly unknown[];
};

export type PortTrafficDataV1 = Readonly<Record<string, unknown>> & {
  readonly fetchedAt: string;
  readonly commonObservationDate: string;
  readonly source: string;
  readonly attribution: string;
  readonly methodologyNote: string;
  readonly caveats: readonly string[];
  readonly units: UnknownRecord;
  readonly markerCount: number;
  readonly uniqueSeriesCount: number;
  readonly availableMarkerCount: number;
  readonly availableSeriesCount: number;
  readonly summaries: UnknownRecord;
  readonly detail?: UnknownRecord;
};

export type ChokepointTrafficDataV1 = Readonly<Record<string, unknown>> & {
  readonly fetchedAt: string;
  readonly latestObservationDate: string;
  readonly source: string;
  readonly attribution: string;
  readonly methodologyNote: string;
  readonly summaries: UnknownRecord;
  readonly detail?: UnknownRecord;
};

export type InsightDataV1 = Readonly<Record<string, unknown>> & {
  readonly engine: "RULE_FALLBACK";
  readonly model: null;
  readonly generatedAt: string;
  readonly headline: string;
  readonly summary: string;
  readonly confidence: "높음" | "보통" | "낮음";
  readonly quantitativeBasis: readonly string[];
  readonly upwardFactors: readonly UnknownRecord[];
  readonly downwardFactors: readonly UnknownRecord[];
  readonly caution: string;
};

export interface MarketQueryV1 {
  readonly series: "fx" | "oil" | "bunker" | "harpex";
  readonly from: string;
  readonly to: string;
  readonly providerVersion: 3;
}
export interface NewsQueryV1 { readonly route: RouteId; readonly asOf: string; readonly providerVersion: 18; readonly retry: 0 | 1; readonly refresh?: boolean }
export interface PortDetailQueryV1 { readonly id: string; readonly days?: number }
export interface ChokepointDetailQueryV1 { readonly id: string }
export type EmptyQueryV1 = Readonly<Record<string, never>>;
export interface InsightRequestV1 {
  readonly route: UnknownRecord;
  readonly current: UnknownRecord;
  readonly selectedHorizon: 1 | 2 | 3 | 4;
  readonly direction: "상승" | "하락" | "보합";
  readonly forecast: UnknownRecord;
  readonly forecastPath: readonly UnknownRecord[];
  readonly representativeModel: UnknownRecord;
  readonly modelAgreement: UnknownRecord;
  readonly news: readonly UnknownRecord[];
}
export interface TuneRequestV1 {
  readonly routeCode: RouteId;
  readonly modelId: string;
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
  const series = string(root.series, "$marketData.series");
  if (series !== "fx" && series !== "oil" && series !== "bunker" && series !== "harpex") throw new Error("Unknown market series");
  const points = array(root.points, "$marketData.points").map((value, index) => {
    const point = record(value, `$marketData.points[${index}]`);
    exactKeys(point, ["date", "week", "value"], `$marketData.points[${index}]`);
    return { date: isoDate(point.date, "date"), week: string(point.week, "week"), value: finite(point.value, "value") };
  });
  return {
    series,
    label: string(root.label, "label"),
    unit: string(root.unit, "unit"),
    provider: string(root.provider, "provider"),
    aggregation: string(root.aggregation, "aggregation"),
    observationStart: isoDate(root.observationStart, "observationStart"),
    observationEnd: isoDate(root.observationEnd, "observationEnd"),
    points,
    attempts: array(root.attempts, "attempts"),
  };
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

export function portFromArtifact(value: unknown, detailId?: string, days = 180): PortTrafficDataV1 {
  assertPortTrafficFixtureV1(value);
  const root = record(value, "$portArtifact");
  const base = {
    fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"),
    commonObservationDate: isoDate(root.commonObservationDate, "commonObservationDate"),
    source: string(root.source, "source"),
    attribution: string(root.attribution, "attribution"),
    methodologyNote: string(root.methodologyNote, "methodologyNote"),
    caveats: stringArray(root.caveats, "caveats"),
    units: record(root.units, "units"),
    markerCount: integer(root.markerCount, "markerCount"),
    uniqueSeriesCount: integer(root.uniqueSeriesCount, "uniqueSeriesCount"),
    availableMarkerCount: integer(root.availableMarkerCount, "availableMarkerCount"),
    availableSeriesCount: integer(root.availableSeriesCount, "availableSeriesCount"),
    summaries: record(root.summaries, "summaries"),
  };
  if (!detailId) return base;
  const details = record(root.details, "details");
  const detail = record(details[detailId], `details.${detailId}`);
  const points = array(detail.points, "detail.points");
  return { ...base, detail: { ...detail, points: points.slice(-days) } };
}

export function chokeFromArtifact(value: unknown, detailId?: string): ChokepointTrafficDataV1 {
  assertChokepointTrafficFixtureV1(value);
  const root = record(value, "$chokeArtifact");
  const base = {
    fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"),
    latestObservationDate: isoDate(root.latestObservationDate, "latestObservationDate"),
    source: string(root.source, "source"),
    attribution: string(root.attribution, "attribution"),
    methodologyNote: string(root.methodologyNote, "methodologyNote"),
    summaries: record(root.summaries, "summaries"),
  };
  if (!detailId) return base;
  const detail = record(record(root.details, "details")[detailId], `details.${detailId}`);
  return { ...base, detail };
}

export function decodePortTrafficDataV1(value: unknown): PortTrafficDataV1 {
  const root = record(value, "$portData");
  const keys = Object.keys(root);
  const expected = ["fetchedAt", "commonObservationDate", "source", "attribution", "methodologyNote", "caveats", "units", "markerCount", "uniqueSeriesCount", "availableMarkerCount", "availableSeriesCount", "summaries"];
  if (keys.length === expected.length + 1) expected.push("detail");
  exactKeys(root, expected, "$portData");
  return {
    fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"), commonObservationDate: isoDate(root.commonObservationDate, "commonObservationDate"),
    source: string(root.source, "source"), attribution: string(root.attribution, "attribution"), methodologyNote: string(root.methodologyNote, "methodologyNote"),
    caveats: stringArray(root.caveats, "caveats"), units: record(root.units, "units"), markerCount: integer(root.markerCount, "markerCount"),
    uniqueSeriesCount: integer(root.uniqueSeriesCount, "uniqueSeriesCount"), availableMarkerCount: integer(root.availableMarkerCount, "availableMarkerCount"),
    availableSeriesCount: integer(root.availableSeriesCount, "availableSeriesCount"), summaries: record(root.summaries, "summaries"),
    ...(root.detail === undefined ? {} : { detail: record(root.detail, "detail") }),
  };
}

export function decodeChokepointTrafficDataV1(value: unknown): ChokepointTrafficDataV1 {
  const root = record(value, "$chokeData");
  const expected = ["fetchedAt", "latestObservationDate", "source", "attribution", "methodologyNote", "summaries"];
  if (Object.keys(root).length === expected.length + 1) expected.push("detail");
  exactKeys(root, expected, "$chokeData");
  return {
    fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"), latestObservationDate: isoDate(root.latestObservationDate, "latestObservationDate"),
    source: string(root.source, "source"), attribution: string(root.attribution, "attribution"), methodologyNote: string(root.methodologyNote, "methodologyNote"),
    summaries: record(root.summaries, "summaries"), ...(root.detail === undefined ? {} : { detail: record(root.detail, "detail") }),
  };
}

export function decodeInsightDataV1(value: unknown): InsightDataV1 {
  const root = record(value, "$insightData");
  exactKeys(root, ["engine", "model", "generatedAt", "headline", "summary", "confidence", "quantitativeBasis", "upwardFactors", "downwardFactors", "caution"], "$insightData");
  literal(root.engine, "RULE_FALLBACK", "engine");
  if (root.model !== null) throw new Error("Rule fallback model must be null");
  const confidence = string(root.confidence, "confidence");
  if (confidence !== "높음" && confidence !== "보통" && confidence !== "낮음") throw new Error("Invalid confidence");
  return { engine: "RULE_FALLBACK", model: null, generatedAt: isoTimestamp(root.generatedAt, "generatedAt"), headline: string(root.headline, "headline"), summary: string(root.summary, "summary"), confidence, quantitativeBasis: stringArray(root.quantitativeBasis, "quantitativeBasis"), upwardFactors: array(root.upwardFactors, "upwardFactors").map((item) => record(item, "factor")), downwardFactors: array(root.downwardFactors, "downwardFactors").map((item) => record(item, "factor")), caution: string(root.caution, "caution") };
}

export function decodeUnavailableData(): never { throw new Error("Unavailable result cannot contain data"); }

const INSIGHT_KEYS = ["route", "current", "selectedHorizon", "direction", "forecast", "forecastPath", "representativeModel", "modelAgreement", "news"] as const;

export function decodeInsightRequestV1(value: unknown): InsightRequestV1 {
  const root = record(value, "$insightRequest");
  exactKeys(root, INSIGHT_KEYS, "$insightRequest");
  const route = record(root.route, "route");
  exactKeys(route, ["id", "name", "asOf"], "route");
  string(route.id, "route.id"); string(route.name, "route.name"); isoDate(route.asOf, "route.asOf");
  const current = record(root.current, "current");
  exactKeys(current, ["date", "value"], "current");
  isoDate(current.date, "current.date"); if (finite(current.value, "current.value") <= 0) throw new Error("Current value must be positive");
  const horizon = integer(root.selectedHorizon, "selectedHorizon");
  if (horizon !== 1 && horizon !== 2 && horizon !== 3 && horizon !== 4) throw new Error("Invalid selected horizon");
  const direction = string(root.direction, "direction");
  if (direction !== "상승" && direction !== "하락" && direction !== "보합") throw new Error("Invalid direction");
  const forecast = record(root.forecast, "forecast");
  exactKeys(forecast, ["date", "value", "changePct", "lower", "upper", "coveragePct"], "forecast");
  isoDate(forecast.date, "forecast.date");
  const forecastValue = finite(forecast.value, "forecast.value");
  const changePct = finite(forecast.changePct, "forecast.changePct");
  const lower = finite(forecast.lower, "forecast.lower");
  const upper = finite(forecast.upper, "forecast.upper");
  const coveragePct = finite(forecast.coveragePct, "forecast.coveragePct");
  if (forecastValue <= 0 || lower > forecastValue || forecastValue > upper || coveragePct < 0 || coveragePct > 100) throw new Error("Invalid forecast bounds");
  const computedDirection = changePct >= 3 ? "상승" : changePct <= -3 ? "하락" : "보합";
  if (computedDirection !== direction) throw new Error("Direction does not match changePct");
  const forecastPath = array(root.forecastPath, "forecastPath").map((item, index) => {
    const point = record(item, `forecastPath[${index}]`);
    exactKeys(point, ["horizon", "date", "value", "lower", "upper"], `forecastPath[${index}]`);
    literal(integer(point.horizon, "horizon"), index + 1, "horizon");
    isoDate(point.date, "date"); const pointValue = finite(point.value, "value"); const pointLower = finite(point.lower, "lower"); const pointUpper = finite(point.upper, "upper");
    if (pointValue <= 0 || pointLower > pointValue || pointValue > pointUpper) throw new Error("Invalid forecast path interval");
    return point;
  });
  if (forecastPath.length !== 4) throw new Error("forecastPath must have four points");
  const representativeModel = record(root.representativeModel, "representativeModel");
  exactKeys(representativeModel, ["name", "mapePct", "mse", "mase", "totalScore"], "representativeModel");
  string(representativeModel.name, "name"); for (const key of ["mapePct", "mse", "mase", "totalScore"]) finite(representativeModel[key], key);
  const modelAgreement = record(root.modelAgreement, "modelAgreement");
  exactKeys(modelAgreement, ["up", "down", "flat", "total"], "modelAgreement");
  const up = integer(modelAgreement.up, "up"); const down = integer(modelAgreement.down, "down"); const flat = integer(modelAgreement.flat, "flat"); const total = integer(modelAgreement.total, "total");
  if (total !== 8 || up + down + flat !== total) throw new Error("Invalid model agreement");
  const news = array(root.news, "news").map((item, index) => {
    const article = record(item, `news[${index}]`);
    exactKeys(article, ["id", "title", "summary", "source", "publishedAt", "url", "directionCode", "factor", "grade", "reason"], `news[${index}]`);
    for (const key of ["id", "title", "summary", "source", "publishedAt", "url", "directionCode", "factor", "grade", "reason"]) string(article[key], `news[${index}].${key}`);
    return article;
  });
  return { route, current, selectedHorizon: horizon, direction, forecast, forecastPath, representativeModel, modelAgreement, news };
}

export function decodeTuneRequestV1(value: unknown): TuneRequestV1 {
  const root = record(value, "$tuneRequest");
  exactKeys(root, ["routeCode", "modelId", "dates", "values", "trainingWindow", "evaluationOrigins", "parameters"], "$tuneRequest");
  const routeCode = string(root.routeCode, "routeCode");
  const knownRoute = (["KUWI", "KUEI", "KNEI", "KMDI", "KMEI", "KAUI", "KLEI", "KLWI", "KSAI", "KWAI", "KCI", "KJI", "KSEI"] as const).find((id) => id === routeCode);
  if (!knownRoute) throw new Error("Unknown routeCode");
  const modelId = string(root.modelId, "modelId");
  if (!["naive", "sarimax", "lightgbm", "xgboost", "random_forest", "prophet", "timesfm", "chronos"].includes(modelId)) throw new Error("Unknown modelId");
  const dates = array(root.dates, "dates").map((date, index) => isoDate(date, `dates[${index}]`));
  const values = array(root.values, "values").map((number, index) => finite(number, `values[${index}]`));
  if (dates.length !== values.length || dates.length < 108 || dates.length > 10_000) throw new Error("Invalid training series length");
  for (let index = 1; index < dates.length; index += 1) if (dates[index - 1] >= dates[index]) throw new Error("Dates must be strictly ascending");
  if (values.some((number) => number <= 0)) throw new Error("Values must be positive");
  const trainingWindow = string(root.trainingWindow, "trainingWindow");
  if (trainingWindow !== "expanding" && trainingWindow !== "rolling_104" && trainingWindow !== "rolling_52") throw new Error("Invalid trainingWindow");
  const evaluationOrigins = integer(root.evaluationOrigins, "evaluationOrigins");
  if (evaluationOrigins < 36 || evaluationOrigins > 52) throw new Error("Invalid evaluationOrigins");
  const rawParameters = record(root.parameters, "parameters");
  const parameters: Record<string, string | number> = {};
  for (const [key, parameter] of Object.entries(rawParameters)) {
    if (typeof parameter !== "string" && (typeof parameter !== "number" || !Number.isFinite(parameter))) throw new Error(`Invalid parameter ${key}`);
    parameters[key] = parameter;
  }
  return { routeCode: knownRoute, modelId, dates, values, trainingWindow, evaluationOrigins, parameters };
}
