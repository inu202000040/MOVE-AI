import { gunzipSync } from "node:zlib";
import type { GatewayResultV1 } from "../../contracts/gateway";
import {
  decodeWeatherDataV1,
  type WeatherConditionV1,
  type WeatherDataV1,
  type WeatherObservationV1,
  type WeatherRiskV1,
} from "../../data/runtime/domains";
import {
  decodeWeatherResultV1,
  type WeatherStateV1,
} from "../../data/runtime/method-decoders";
import {
  CACHE_CONTROL_V1,
  PROVIDER_EXECUTION_LIMITS_V1,
  PROVIDER_RETRY_POLICY_V1,
  assertAllowedProviderUrlV1,
  assertAllowedRedirectV1,
} from "../../data/runtime/provider-policy";
import {
  ProviderHttpError,
  ProviderValidationError,
  runProviderWithRetryV1,
  type FetchLikeV1,
} from "../../data/runtime/retry";
import {
  HybridLoaderV1,
  VerifiedDataCacheV1,
  buildCacheKeyV1,
  type CacheBackendV1,
  type ProviderPayloadV1,
} from "../../data/runtime/cache";
import { gatewaySuccess, gatewayUnavailable } from "../../data/runtime/result";
import { WEATHER_LOCATIONS_V1, type WeatherLocationV1 } from "./weather-locations";

const MET_ENDPOINT = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const MARINE_ENDPOINT = "https://marine-api.open-meteo.com/v1/marine";
const METAR_ENDPOINT = "https://aviationweather.gov/data/cache/metars.cache.csv.gz";
const PROVIDER_NAME = "MET Norway + Open-Meteo + AviationWeather";
const ATTRIBUTION = "MET Norway Locationforecast · Open-Meteo Marine · AviationWeather METAR";
const DEFAULT_USER_AGENT = "MOVE-AI/1.0 (+https://github.com/inu202000040/MOVE-AI)";
const MET_BODY_LIMIT = 2 * 1024 * 1024;
const MARINE_BODY_LIMIT = 4 * 1024 * 1024;
const METAR_COMPRESSED_LIMIT = 5 * 1024 * 1024;
const METAR_DECOMPRESSED_LIMIT = 20 * 1024 * 1024;
const WEATHER_CACHE_POLICY = {
  freshForMs: 30 * 60 * 1_000,
  staleForMs: 2 * 60 * 60 * 1_000,
} as const;
const WEATHER_CACHE_KEY = buildCacheKeyV1({
  domain: "weather",
  normalizedRequest: {},
  providerVersion: 1,
  mode: "live",
});

interface AtmosphereReadingV1 {
  readonly observedAt: string;
  readonly symbolCode: string | null;
  readonly temperatureC: number | null;
  readonly precipitationMm: number | null;
  readonly windSpeedKn: number | null;
  readonly windDirectionDeg: number | null;
  readonly isDay: boolean | null;
}

interface MarineReadingV1 {
  readonly observedAt: string | null;
  readonly waveHeightM: number | null;
  readonly waveDirectionDeg: number | null;
  readonly wavePeriodS: number | null;
  readonly seaSurfaceTemperatureC: number | null;
  readonly oceanCurrentKmh: number | null;
  readonly oceanCurrentDirectionDeg: number | null;
}

interface MetarReadingV1 {
  readonly stationId: string;
  readonly observedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly visibilityM: number | null;
  readonly visibilityIsMinimum: boolean;
  readonly windGustKn: number | null;
}

interface NearestMetarV1 extends MetarReadingV1 {
  readonly distanceKm: number;
}

interface WeatherSignalV1 {
  readonly symbolCode: string | null;
  readonly isDay: boolean | null;
  readonly precipitationMm: number | null;
  readonly visibilityM: number | null;
  readonly windGustKn: number | null;
  readonly waveHeightM: number | null;
  readonly hasAnyReading: boolean;
}

export interface WeatherClassificationV1 {
  readonly condition: WeatherConditionV1;
  readonly conditionLabel: string;
  readonly risk: WeatherRiskV1;
  readonly riskLabel: string;
  readonly riskReasons: readonly string[];
}

export interface WeatherGatewayServiceOptionsV1 {
  readonly fetcher?: FetchLikeV1;
  readonly now?: () => number;
  readonly userAgent?: string;
  readonly cacheBackend?: CacheBackendV1;
}

type ProviderOutcomeV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new ProviderValidationError(`${path} must be an object`);
  return value;
}

function arrayAt(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new ProviderValidationError(`${path} must be an array`);
  return value;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonnegativeOrNull(value: unknown): number | null {
  const decoded = finiteOrNull(value);
  return decoded !== null && decoded >= 0 ? decoded : null;
}

function directionOrNull(value: unknown): number | null {
  const decoded = finiteOrNull(value);
  return decoded !== null && decoded >= 0 && decoded < 360 ? decoded : null;
}

function roundMetric(value: number | null, digits = 2): number | null {
  if (value === null) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function timestampOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/u.test(value) ? value : `${value}Z`);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function safeUserAgent(value: string | undefined): string {
  const trimmed = value?.trim();
  const hasControlCharacter = trimmed !== undefined
    && [...trimmed].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    });
  if (
    trimmed
    && trimmed.length >= 10
    && trimmed.length <= 256
    && !hasControlCharacter
    && (trimmed.includes("@") || /https?:\/\//u.test(trimmed))
  ) {
    return trimmed;
  }
  return DEFAULT_USER_AGENT;
}

function responseLocation(response: Response): string | null {
  const location = response.headers.get("location");
  return location === null || location.trim() === "" ? null : location;
}

async function fetchAllowedV1(input: {
  readonly url: URL;
  readonly signal: AbortSignal;
  readonly fetcher: FetchLikeV1;
  readonly headers: Readonly<Record<string, string>>;
}): Promise<Response> {
  let current = assertAllowedProviderUrlV1(input.url);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await input.fetcher(current, {
      method: "GET",
      headers: input.headers,
      redirect: "manual",
      signal: input.signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = responseLocation(response);
    if (location === null || redirectCount === 3) {
      throw new ProviderValidationError("Provider redirect was invalid or exceeded the limit");
    }
    current = assertAllowedRedirectV1(current, new URL(location, current));
  }
  throw new ProviderValidationError("Provider redirect loop");
}

async function readBoundedBytesV1(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const rawLength = response.headers.get("content-length");
  if (rawLength !== null) {
    const length = Number(rawLength);
    if (!Number.isFinite(length) || length < 0 || length > maximumBytes) {
      throw new ProviderValidationError("Provider response exceeded the body limit");
    }
  }
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel("body limit exceeded");
      throw new ProviderValidationError("Provider response exceeded the body limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchJsonV1(input: {
  readonly url: URL;
  readonly signal: AbortSignal;
  readonly fetcher: FetchLikeV1;
  readonly userAgent: string;
  readonly maximumBytes: number;
}): Promise<unknown> {
  const response = await fetchAllowedV1({
    ...input,
    headers: { accept: "application/json", "user-agent": input.userAgent },
  });
  if (!response.ok) throw new ProviderHttpError(response.status, response.headers.get("retry-after"));
  const text = new TextDecoder().decode(await readBoundedBytesV1(response, input.maximumBytes));
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderValidationError("Provider response was not valid JSON");
  }
}

function closestTimeseriesEntry(value: unknown, nowMs: number): Readonly<Record<string, unknown>> {
  const entries = arrayAt(value, "MET properties.timeseries");
  let best: { readonly entry: Readonly<Record<string, unknown>>; readonly distance: number } | null = null;
  for (const item of entries) {
    if (!isRecord(item)) continue;
    const time = timestampOrNull(item.time);
    if (time === null) continue;
    const distance = Math.abs(Date.parse(time) - nowMs);
    if (best === null || distance < best.distance) best = { entry: item, distance };
  }
  if (best === null) throw new ProviderValidationError("MET timeseries did not contain a valid timestamp");
  return best.entry;
}

export function decodeMetNorwayV1(value: unknown, nowMs: number): AtmosphereReadingV1 {
  const root = recordAt(value, "MET root");
  const properties = recordAt(root.properties, "MET properties");
  const entry = closestTimeseriesEntry(properties.timeseries, nowMs);
  const data = recordAt(entry.data, "MET timeseries.data");
  const instant = recordAt(data.instant, "MET timeseries.data.instant");
  const details = recordAt(instant.details, "MET timeseries.data.instant.details");
  const observedAt = timestampOrNull(entry.time);
  if (observedAt === null) throw new ProviderValidationError("MET timestamp was invalid");
  const nextHour = isRecord(data.next_1_hours) ? data.next_1_hours : null;
  const nextSixHours = isRecord(data.next_6_hours) ? data.next_6_hours : null;
  const nextTwelveHours = isRecord(data.next_12_hours) ? data.next_12_hours : null;
  const summary = [nextHour, nextSixHours, nextTwelveHours]
    .map((period) => period && isRecord(period.summary) ? period.summary : null)
    .find((candidate) => typeof candidate?.symbol_code === "string");
  const precipitation = nextHour && isRecord(nextHour.details)
    ? nonnegativeOrNull(nextHour.details.precipitation_amount)
    : null;
  const temperatureC = finiteOrNull(details.air_temperature);
  const windSpeedMs = nonnegativeOrNull(details.wind_speed);
  const windDirectionDeg = directionOrNull(details.wind_from_direction);
  const symbolCode = typeof summary?.symbol_code === "string" ? summary.symbol_code : null;
  if (temperatureC === null && windSpeedMs === null && precipitation === null && symbolCode === null) {
    throw new ProviderValidationError("MET entry did not contain usable weather values");
  }
  return {
    observedAt,
    symbolCode,
    temperatureC: roundMetric(temperatureC, 1),
    precipitationMm: roundMetric(precipitation, 2),
    windSpeedKn: roundMetric(windSpeedMs === null ? null : windSpeedMs * 1.9438444924, 1),
    windDirectionDeg: roundMetric(windDirectionDeg, 1),
    isDay: symbolCode?.includes("_day") ? true : symbolCode?.includes("_night") ? false : null,
  };
}

function assertMarineUnits(root: Readonly<Record<string, unknown>>): void {
  if (!isRecord(root.current_units)) return;
  const expected = {
    wave_height: "m",
    wave_direction: "°",
    wave_period: "s",
    sea_surface_temperature: "°C",
    ocean_current_velocity: "km/h",
    ocean_current_direction: "°",
  } as const;
  for (const [key, unit] of Object.entries(expected)) {
    const actual = root.current_units[key];
    if (actual !== undefined && actual !== unit) {
      throw new ProviderValidationError(`Open-Meteo unit mismatch for ${key}`);
    }
  }
}

function decodeMarineEntry(value: unknown): MarineReadingV1 {
  const root = recordAt(value, "Open-Meteo marine entry");
  assertMarineUnits(root);
  if (!isRecord(root.current)) {
    return {
      observedAt: null,
      waveHeightM: null,
      waveDirectionDeg: null,
      wavePeriodS: null,
      seaSurfaceTemperatureC: null,
      oceanCurrentKmh: null,
      oceanCurrentDirectionDeg: null,
    };
  }
  const current = root.current;
  const reading = {
    observedAt: timestampOrNull(current.time),
    waveHeightM: roundMetric(nonnegativeOrNull(current.wave_height), 2),
    waveDirectionDeg: roundMetric(directionOrNull(current.wave_direction), 1),
    wavePeriodS: roundMetric(nonnegativeOrNull(current.wave_period), 1),
    seaSurfaceTemperatureC: roundMetric(finiteOrNull(current.sea_surface_temperature), 1),
    oceanCurrentKmh: roundMetric(nonnegativeOrNull(current.ocean_current_velocity), 2),
    oceanCurrentDirectionDeg: roundMetric(directionOrNull(current.ocean_current_direction), 1),
  };
  const hasMetric = Object.entries(reading).some(([key, item]) => key !== "observedAt" && item !== null);
  return hasMetric ? reading : { ...reading, observedAt: null };
}

export function decodeOpenMeteoMarineV1(value: unknown, expectedCount: number): readonly MarineReadingV1[] {
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length !== expectedCount) {
    throw new ProviderValidationError("Open-Meteo response count did not match the requested coordinates");
  }
  return entries.map(decodeMarineEntry);
}

function parseCsvRows(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new ProviderValidationError("METAR CSV ended inside a quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows;
}

function parseCsvNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function parseVisibilityMiles(value: string | undefined): { readonly miles: number; readonly minimum: boolean } | null {
  if (value === undefined) return null;
  let text = value.trim();
  if (text === "") return null;
  let minimum = text.endsWith("+");
  if (minimum) text = text.slice(0, -1);
  if (/^[MP]/u.test(text)) {
    minimum ||= text[0] === "P";
    text = text.slice(1);
  }
  let miles = Number(text);
  if (!Number.isFinite(miles) && /^\d+\s+\d+\/\d+$/u.test(text)) {
    const [whole, fraction] = text.split(/\s+/u);
    const [numerator, denominator] = fraction.split("/").map(Number);
    miles = Number(whole) + numerator / denominator;
  } else if (!Number.isFinite(miles) && /^\d+\/\d+$/u.test(text)) {
    const [numerator, denominator] = text.split("/").map(Number);
    miles = numerator / denominator;
  }
  return Number.isFinite(miles) && miles >= 0
    ? { miles, minimum }
    : null;
}

export function decodeAviationWeatherMetarCsvV1(text: string, nowMs: number): readonly MetarReadingV1[] {
  const rows = parseCsvRows(text);
  const header = rows[0];
  if (!header) throw new ProviderValidationError("METAR CSV was empty");
  const indexes = new Map(header.map((name, index) => [name, index]));
  const required = ["station_id", "observation_time", "latitude", "longitude", "wind_gust_kt", "visibility_statute_mi"];
  if (required.some((field) => indexes.get(field) === undefined)) {
    throw new ProviderValidationError("METAR CSV was missing required columns");
  }
  const indexOf = (name: string): number => indexes.get(name) as number;
  const maximumAgeMs = PROVIDER_EXECUTION_LIMITS_V1.weather.maximumObservationAgeMinutes * 60 * 1_000;
  const futureToleranceMs = PROVIDER_EXECUTION_LIMITS_V1.weather.futureToleranceMinutes * 60 * 1_000;
  const readings: MetarReadingV1[] = [];
  for (const row of rows.slice(1)) {
    const stationId = row[indexOf("station_id")]?.trim();
    const observedAt = timestampOrNull(row[indexOf("observation_time")]);
    const latitude = parseCsvNumber(row[indexOf("latitude")]);
    const longitude = parseCsvNumber(row[indexOf("longitude")]);
    if (!stationId || observedAt === null || latitude === null || longitude === null) continue;
    const observationMs = Date.parse(observedAt);
    if (observationMs < nowMs - maximumAgeMs || observationMs > nowMs + futureToleranceMs) continue;
    const visibility = parseVisibilityMiles(row[indexOf("visibility_statute_mi")]);
    const windGustKn = nonnegativeOrNull(parseCsvNumber(row[indexOf("wind_gust_kt")]));
    if (visibility === null && windGustKn === null) continue;
    readings.push({
      stationId,
      observedAt,
      latitude,
      longitude,
      visibilityM: roundMetric(visibility === null ? null : visibility.miles * 1609.344, 0),
      visibilityIsMinimum: visibility?.minimum ?? false,
      windGustKn: roundMetric(windGustKn, 1),
    });
  }
  return readings;
}

function haversineKm(left: WeatherLocationV1, right: Pick<MetarReadingV1, "latitude" | "longitude">): number {
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestMetar(location: WeatherLocationV1, readings: readonly MetarReadingV1[]): NearestMetarV1 | null {
  const candidates: NearestMetarV1[] = [];
  for (const reading of readings) {
    const distanceKm = haversineKm(location, reading);
    if (distanceKm > PROVIDER_EXECUTION_LIMITS_V1.weather.maximumStationDistanceKm) continue;
    candidates.push({ ...reading, distanceKm: roundMetric(distanceKm, 1) as number });
  }
  candidates.sort((left, right) => left.distanceKm - right.distanceKm || left.stationId.localeCompare(right.stationId));
  return candidates.find(({ visibilityM }) => visibilityM !== null) ?? candidates[0] ?? null;
}

function symbolCondition(symbolCode: string | null, isDay: boolean | null): WeatherConditionV1 {
  const symbol = symbolCode?.toLowerCase() ?? "";
  if (/(?:thunder|storm)/u.test(symbol)) return "storm";
  if (/(?:snow|sleet)/u.test(symbol)) return "snow";
  if (/(?:rain|drizzle|shower)/u.test(symbol)) return "rain";
  if (/(?:fog|mist)/u.test(symbol)) return "fog";
  if (/(?:cloud|overcast|partlycloudy)/u.test(symbol)) return "cloud";
  if (isDay === false || symbol.includes("night")) return "night";
  return symbol === "" ? "unavailable" : "clear";
}

const CONDITION_LABELS: Readonly<Record<WeatherConditionV1, string>> = {
  clear: "맑음",
  night: "맑은 밤",
  rain: "비",
  snow: "눈",
  storm: "뇌우",
  wind: "강풍",
  wave: "높은 파고",
  cloud: "흐림",
  fog: "안개",
  unavailable: "연결 확인 중",
};

export function classifyWeatherV1(signal: WeatherSignalV1): WeatherClassificationV1 {
  const symbol = symbolCondition(signal.symbolCode, signal.isDay);
  let condition = symbol;
  if (symbol !== "storm" && symbol !== "snow" && symbol !== "rain") {
    if (signal.visibilityM !== null && signal.visibilityM < 5_000) condition = "fog";
    else if (signal.waveHeightM !== null && signal.waveHeightM >= 3.5) condition = "wave";
    else if (signal.windGustKn !== null && signal.windGustKn >= 25) condition = "wind";
  }
  const severeReasons: string[] = [];
  const warningReasons: string[] = [];
  if (symbol === "storm") severeReasons.push("뇌우 예보");
  if (signal.visibilityM !== null) {
    if (signal.visibilityM < 1_000) severeReasons.push(`가시거리 ${Math.round(signal.visibilityM).toLocaleString("ko-KR")}m`);
    else if (signal.visibilityM < 5_000) warningReasons.push(`가시거리 ${Math.round(signal.visibilityM).toLocaleString("ko-KR")}m`);
  }
  if (signal.windGustKn !== null) {
    if (signal.windGustKn >= 40) severeReasons.push(`돌풍 ${signal.windGustKn.toFixed(1)}kn`);
    else if (signal.windGustKn >= 28) warningReasons.push(`돌풍 ${signal.windGustKn.toFixed(1)}kn`);
  }
  if (signal.waveHeightM !== null) {
    if (signal.waveHeightM >= 5) severeReasons.push(`파고 ${signal.waveHeightM.toFixed(1)}m`);
    else if (signal.waveHeightM >= 3) warningReasons.push(`파고 ${signal.waveHeightM.toFixed(1)}m`);
  }
  if (signal.precipitationMm !== null && signal.precipitationMm >= 7.5) {
    warningReasons.push(`1시간 강수 ${signal.precipitationMm.toFixed(1)}mm`);
  }
  const risk: WeatherRiskV1 = severeReasons.length > 0 ? "severe" : warningReasons.length > 0 ? "warning" : "normal";
  return {
    condition,
    conditionLabel: CONDITION_LABELS[condition],
    risk,
    riskLabel: risk === "severe" ? "심각" : risk === "warning" ? "주의" : signal.hasAnyReading ? "정상" : "관측 없음",
    riskReasons: [...severeReasons, ...warningReasons],
  };
}

async function mapWithConcurrencyV1<TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<readonly TResult[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer");
  const output = new Array<TResult>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

function chunksOf<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

function providerFailure<T>(error: unknown): ProviderOutcomeV1<T> {
  return { ok: false, error };
}

function providerSuccess<T>(value: T): ProviderOutcomeV1<T> {
  return { ok: true, value };
}

function abortIfRequested(signal: AbortSignal | undefined, error: unknown): void {
  if (signal?.aborted) throw error;
}

async function loadAtmosphereV1(input: {
  readonly fetcher: FetchLikeV1;
  readonly userAgent: string;
  readonly nowMs: number;
  readonly signal?: AbortSignal;
}): Promise<readonly ProviderOutcomeV1<AtmosphereReadingV1>[]> {
  const retryPolicy = { ...PROVIDER_RETRY_POLICY_V1.weatherAtmosphere, retryNetworkFailures: false } as const;
  return mapWithConcurrencyV1(
    WEATHER_LOCATIONS_V1,
    PROVIDER_EXECUTION_LIMITS_V1.weather.atmosphereConcurrency,
    async (location) => {
      try {
        const url = new URL(MET_ENDPOINT);
        url.searchParams.set("lat", String(location.latitude));
        url.searchParams.set("lon", String(location.longitude));
        const value = await runProviderWithRetryV1({
          policy: retryPolicy,
          signal: input.signal,
          operation: (attemptSignal) => fetchJsonV1({
            url,
            signal: attemptSignal,
            fetcher: input.fetcher,
            userAgent: input.userAgent,
            maximumBytes: MET_BODY_LIMIT,
          }),
        });
        return providerSuccess(decodeMetNorwayV1(value, input.nowMs));
      } catch (error) {
        abortIfRequested(input.signal, error);
        return providerFailure(error);
      }
    },
  );
}

async function loadMarineV1(input: {
  readonly fetcher: FetchLikeV1;
  readonly userAgent: string;
  readonly signal?: AbortSignal;
}): Promise<readonly ProviderOutcomeV1<readonly MarineReadingV1[]>[]> {
  const chunks = chunksOf(WEATHER_LOCATIONS_V1, PROVIDER_EXECUTION_LIMITS_V1.weather.marineChunkSize);
  return Promise.all(chunks.map(async (locations) => {
    try {
      const url = new URL(MARINE_ENDPOINT);
      url.searchParams.set("latitude", locations.map(({ latitude }) => latitude).join(","));
      url.searchParams.set("longitude", locations.map(({ longitude }) => longitude).join(","));
      url.searchParams.set("current", [
        "wave_height",
        "wave_direction",
        "wave_period",
        "sea_surface_temperature",
        "ocean_current_velocity",
        "ocean_current_direction",
      ].join(","));
      url.searchParams.set("timezone", "GMT");
      const value = await runProviderWithRetryV1({
        policy: PROVIDER_RETRY_POLICY_V1.weatherMarine,
        signal: input.signal,
        operation: (attemptSignal) => fetchJsonV1({
          url,
          signal: attemptSignal,
          fetcher: input.fetcher,
          userAgent: input.userAgent,
          maximumBytes: MARINE_BODY_LIMIT,
        }),
      });
      return providerSuccess(decodeOpenMeteoMarineV1(value, locations.length));
    } catch (error) {
      abortIfRequested(input.signal, error);
      return providerFailure(error);
    }
  }));
}

async function loadMetarV1(input: {
  readonly fetcher: FetchLikeV1;
  readonly userAgent: string;
  readonly nowMs: number;
  readonly signal?: AbortSignal;
}): Promise<ProviderOutcomeV1<readonly MetarReadingV1[]>> {
  try {
    const compressed = await runProviderWithRetryV1({
      policy: PROVIDER_RETRY_POLICY_V1.weatherVisibility,
      signal: input.signal,
      operation: async (attemptSignal) => {
        const response = await fetchAllowedV1({
          url: new URL(METAR_ENDPOINT),
          signal: attemptSignal,
          fetcher: input.fetcher,
          headers: { accept: "application/gzip,text/csv", "user-agent": input.userAgent },
        });
        if (!response.ok) throw new ProviderHttpError(response.status, response.headers.get("retry-after"));
        return readBoundedBytesV1(response, METAR_COMPRESSED_LIMIT);
      },
    });
    const isGzip = compressed.byteLength >= 2 && compressed[0] === 0x1f && compressed[1] === 0x8b;
    const bytes = isGzip ? new Uint8Array(gunzipSync(compressed)) : compressed;
    if (bytes.byteLength > METAR_DECOMPRESSED_LIMIT) {
      throw new ProviderValidationError("METAR CSV exceeded the decompressed body limit");
    }
    return providerSuccess(decodeAviationWeatherMetarCsvV1(new TextDecoder().decode(bytes), input.nowMs));
  } catch (error) {
    abortIfRequested(input.signal, error);
    return providerFailure(error);
  }
}

function emptyMarine(): MarineReadingV1 {
  return {
    observedAt: null,
    waveHeightM: null,
    waveDirectionDeg: null,
    wavePeriodS: null,
    seaSurfaceTemperatureC: null,
    oceanCurrentKmh: null,
    oceanCurrentDirectionDeg: null,
  };
}

function buildObservationV1(
  location: WeatherLocationV1,
  atmosphere: AtmosphereReadingV1 | null,
  marine: MarineReadingV1,
  metar: NearestMetarV1 | null,
): WeatherObservationV1 {
  const visibilityM = metar?.visibilityM ?? null;
  const hasAnyReading = atmosphere !== null
    || marine.observedAt !== null
    || metar !== null;
  const classification = classifyWeatherV1({
    symbolCode: atmosphere?.symbolCode ?? null,
    isDay: atmosphere?.isDay ?? null,
    precipitationMm: atmosphere?.precipitationMm ?? null,
    visibilityM,
    windGustKn: metar?.windGustKn ?? null,
    waveHeightM: marine.waveHeightM,
    hasAnyReading,
  });
  const visibilityPresent = metar !== null && metar.visibilityM !== null;
  return {
    key: location.key,
    kind: location.kind,
    entityId: location.entityId,
    nameKo: location.nameKo,
    subtitleKo: location.subtitleKo,
    routeCode: location.routeCode,
    longitude: location.longitude,
    latitude: location.latitude,
    observedAt: atmosphere?.observedAt ?? null,
    condition: classification.condition,
    conditionLabel: classification.conditionLabel,
    risk: classification.risk,
    riskLabel: classification.riskLabel,
    riskReasons: classification.riskReasons,
    temperatureC: atmosphere?.temperatureC ?? null,
    precipitationMm: atmosphere?.precipitationMm ?? null,
    visibilityM,
    visibilityIsMinimum: visibilityPresent ? metar.visibilityIsMinimum : false,
    visibilityObservedAt: visibilityPresent ? metar.observedAt : null,
    visibilityStationId: visibilityPresent ? metar.stationId : null,
    visibilityStationDistanceKm: visibilityPresent ? metar.distanceKm : null,
    windSpeedKn: atmosphere?.windSpeedKn ?? null,
    windDirectionDeg: atmosphere?.windDirectionDeg ?? null,
    windGustKn: metar?.windGustKn ?? null,
    isDay: atmosphere?.isDay ?? null,
    waveHeightM: marine.waveHeightM,
    waveDirectionDeg: marine.waveDirectionDeg,
    wavePeriodS: marine.wavePeriodS,
    seaSurfaceTemperatureC: marine.seaSurfaceTemperatureC,
    oceanCurrentKmh: marine.oceanCurrentKmh,
    oceanCurrentDirectionDeg: marine.oceanCurrentDirectionDeg,
  };
}

function hasUsableObservation(observation: WeatherObservationV1): boolean {
  return observation.observedAt !== null
    || observation.visibilityObservedAt !== null
    || [
      observation.temperatureC,
      observation.precipitationMm,
      observation.windSpeedKn,
      observation.windGustKn,
      observation.visibilityM,
      observation.waveHeightM,
      observation.wavePeriodS,
      observation.seaSurfaceTemperatureC,
      observation.oceanCurrentKmh,
    ].some((value) => value !== null);
}

async function aggregateLiveWeatherV1(input: {
  readonly fetcher: FetchLikeV1;
  readonly userAgent: string;
  readonly nowMs: number;
  readonly signal?: AbortSignal;
}): Promise<ProviderPayloadV1<WeatherDataV1>> {
  const [atmosphereOutcomes, marineChunkOutcomes, metarOutcome] = await Promise.all([
    loadAtmosphereV1(input),
    loadMarineV1(input),
    loadMetarV1(input),
  ]);
  const marineByIndex = Array.from({ length: WEATHER_LOCATIONS_V1.length }, emptyMarine);
  let locationOffset = 0;
  let successfulMarineChunks = 0;
  for (const outcome of marineChunkOutcomes) {
    const chunkLength = Math.min(
      PROVIDER_EXECUTION_LIMITS_V1.weather.marineChunkSize,
      WEATHER_LOCATIONS_V1.length - locationOffset,
    );
    if (outcome.ok) {
      successfulMarineChunks += 1;
      outcome.value.forEach((reading, index) => { marineByIndex[locationOffset + index] = reading; });
    }
    locationOffset += chunkLength;
  }
  const metarReadings = metarOutcome.ok ? metarOutcome.value : [];
  const observations: Record<string, WeatherObservationV1> = {};
  for (let index = 0; index < WEATHER_LOCATIONS_V1.length; index += 1) {
    const location = WEATHER_LOCATIONS_V1[index];
    const atmosphereOutcome = atmosphereOutcomes[index];
    const atmosphere = atmosphereOutcome.ok ? atmosphereOutcome.value : null;
    const metar = location.kind === "port" ? nearestMetar(location, metarReadings) : null;
    observations[location.key] = buildObservationV1(location, atmosphere, marineByIndex[index], metar);
  }
  const successfulAtmosphere = atmosphereOutcomes.filter(({ ok }) => ok).length;
  const warnings: string[] = [];
  if (successfulAtmosphere < WEATHER_LOCATIONS_V1.length) {
    warnings.push(`MET_NORWAY_PARTIAL:${successfulAtmosphere}/${WEATHER_LOCATIONS_V1.length}`);
  }
  if (successfulMarineChunks < marineChunkOutcomes.length) {
    warnings.push(`OPEN_METEO_MARINE_PARTIAL:${successfulMarineChunks}/${marineChunkOutcomes.length}`);
  }
  if (!metarOutcome.ok) warnings.push("AVIATION_WEATHER_UNAVAILABLE");
  const visibilityObservationCount = Object.values(observations).filter(({ visibilityM }) => visibilityM !== null).length;
  const fetchedAt = new Date(input.nowMs).toISOString();
  const data = decodeWeatherDataV1({
    fetchedAt,
    source: PROVIDER_NAME,
    attribution: ATTRIBUTION,
    locationCount: 82,
    visibilityObservationCount,
    observations,
    warnings,
  });
  if (!Object.values(data.observations).some(hasUsableObservation)) {
    throw new ProviderValidationError("All weather providers were unavailable");
  }
  const observationTimes = Object.values(data.observations)
    .flatMap((observation) => [observation.observedAt, observation.visibilityObservedAt])
    .filter((value): value is string => value !== null)
    .sort();
  return {
    data,
    source: PROVIDER_NAME,
    sourceUrl: null,
    asOf: observationTimes.at(-1) ?? fetchedAt,
    fetchedAt,
    unit: "mixed_SI_and_knots",
    isEstimate: true,
    attribution: ATTRIBUTION,
    warnings,
    provider: PROVIDER_NAME,
  };
}

function uniqueWarnings(...groups: readonly (readonly string[])[]): readonly string[] {
  return [...new Set(groups.flat())];
}

export class WeatherGatewayServiceV1 {
  private readonly fetcher: FetchLikeV1;
  private readonly now: () => number;
  private readonly userAgent: string;
  private readonly loader: HybridLoaderV1<WeatherDataV1>;

  constructor(options: WeatherGatewayServiceOptionsV1 = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.userAgent = safeUserAgent(options.userAgent ?? process.env.MET_NO_USER_AGENT);
    this.loader = new HybridLoaderV1(new VerifiedDataCacheV1(options.cacheBackend));
  }

  async weather(signal?: AbortSignal): Promise<GatewayResultV1<WeatherDataV1, WeatherStateV1>> {
    const nowMs = this.now();
    const loaded = await this.loader.load({
      key: WEATHER_CACHE_KEY,
      now: nowMs,
      policy: WEATHER_CACHE_POLICY,
      decodeData: decodeWeatherDataV1,
      signal,
      live: () => aggregateLiveWeatherV1({
        fetcher: this.fetcher,
        userAgent: this.userAgent,
        nowMs,
        signal,
      }),
    });
    if (loaded.kind === "unavailable") {
      return decodeWeatherResultV1(gatewayUnavailable({
        state: "UNAVAILABLE",
        code: "WEATHER_PROVIDERS_UNAVAILABLE",
        message: "현재 기상·해상 관측을 불러올 수 없습니다.",
        reasonCode: "NO_VALID_WEATHER_OBSERVATIONS",
        source: PROVIDER_NAME,
        fetchedAt: new Date(nowMs).toISOString(),
        attribution: ATTRIBUTION,
        retryable: true,
      }));
    }
    const responseWarnings = uniqueWarnings(
      loaded.payload.data.warnings,
      loaded.payload.warnings,
      loaded.warnings,
      loaded.cache.stale ? ["STALE_WEATHER_CACHE"] : [],
    );
    const data = decodeWeatherDataV1({ ...loaded.payload.data, warnings: responseWarnings });
    const availableCount = Object.values(data.observations).filter(hasUsableObservation).length;
    if (availableCount === 0) {
      return decodeWeatherResultV1(gatewayUnavailable({
        state: "UNAVAILABLE",
        code: "WEATHER_PROVIDERS_UNAVAILABLE",
        message: "현재 유효한 기상·해상 관측이 없습니다.",
        reasonCode: "NO_VALID_WEATHER_OBSERVATIONS",
        source: PROVIDER_NAME,
        fetchedAt: new Date(nowMs).toISOString(),
        attribution: ATTRIBUTION,
        retryable: true,
      }));
    }
    const state: Exclude<WeatherStateV1, "UNAVAILABLE"> = (
      loaded.cache.stale
      || responseWarnings.length > 0
      || availableCount < WEATHER_LOCATIONS_V1.length
    ) ? "PARTIAL" : "LIVE";
    const envelope = gatewaySuccess({
      state,
      data,
      mode: loaded.mode,
      source: loaded.payload.source,
      asOf: loaded.payload.asOf,
      fetchedAt: loaded.payload.fetchedAt,
      unit: loaded.payload.unit,
      isEstimate: loaded.payload.isEstimate,
      attribution: loaded.payload.attribution,
      warnings: responseWarnings,
      provider: loaded.payload.provider,
      stale: loaded.cache.stale,
    });
    return decodeWeatherResultV1({
      ...envelope,
      meta: { ...envelope.meta, cache: loaded.cache },
    });
  }
}

export const liveWeatherGatewayV1 = new WeatherGatewayServiceV1();
export { CACHE_CONTROL_V1 };
