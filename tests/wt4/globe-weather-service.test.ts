import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import test from "node:test";
import {
  WeatherGatewayServiceV1,
  classifyWeatherV1,
  decodeAviationWeatherMetarCsvV1,
  decodeMetNorwayV1,
  decodeOpenMeteoMarineV1,
} from "../../app/api/globe-weather/weather-service";

const NOW_MS = Date.parse("2026-08-13T07:00:00.000Z");

function metPayload(symbolCode = "clearsky_day") {
  return {
    type: "Feature",
    properties: {
      timeseries: [{
        time: "2026-08-13T07:00:00Z",
        data: {
          instant: { details: { air_temperature: 21.7, wind_speed: 3.1, wind_from_direction: 110.8 } },
          next_1_hours: {
            summary: { symbol_code: symbolCode },
            details: { precipitation_amount: 0 },
          },
        },
      }],
    },
  };
}

function marineEntry(locationId: number) {
  return {
    location_id: locationId,
    current_units: {
      time: "iso8601",
      interval: "seconds",
      wave_height: "m",
      wave_direction: "°",
      wave_period: "s",
      sea_surface_temperature: "°C",
      ocean_current_velocity: "km/h",
      ocean_current_direction: "°",
    },
    current: {
      time: "2026-08-13T07:00",
      interval: 900,
      wave_height: 0.8,
      wave_direction: 245,
      wave_period: 6.5,
      sea_surface_temperature: 22.2,
      ocean_current_velocity: 0.7,
      ocean_current_direction: 90,
    },
  };
}

const METAR_CSV = [
  "raw_text,station_id,observation_time,latitude,longitude,temp_c,dewpoint_c,wind_dir_degrees,wind_speed_kt,wind_gust_kt,visibility_statute_mi",
  '"METAR EHRD 130700Z 11012G30KT 2 1/2SM",EHRD,2026-08-13T07:00:00.000Z,51.9569,4.4372,20,10,110,12,30,2.5',
  '"METAR OLD 130300Z 11012KT 6SM",OLD1,2026-08-13T03:00:00.000Z,51.95,4.43,20,10,110,12,,6+',
].join("\n");

interface FetchProbe {
  readonly fetcher: typeof fetch;
  readonly calls: () => { readonly met: number; readonly marine: number; readonly metar: number; readonly maximumMetConcurrency: number };
}

function successfulFetcher(options: {
  readonly failFirstMet?: boolean;
  readonly retryFirstMet429?: boolean;
} = {}): FetchProbe {
  let met = 0;
  let marine = 0;
  let metar = 0;
  let activeMet = 0;
  let maximumMetConcurrency = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    assert.equal(init?.redirect, "manual");
    assert.match(new Headers(init?.headers).get("user-agent") ?? "", /MOVE-AI/u);
    if (url.hostname === "api.met.no") {
      met += 1;
      const metCall = met;
      activeMet += 1;
      maximumMetConcurrency = Math.max(maximumMetConcurrency, activeMet);
      await new Promise<void>((resolve) => setImmediate(resolve));
      activeMet -= 1;
      if (options.retryFirstMet429 && metCall === 1) {
        return new Response(null, { status: 429, headers: { "retry-after": "0" } });
      }
      if (options.failFirstMet && metCall === 1) return Response.json({ invalid: true });
      return Response.json(metPayload());
    }
    if (url.hostname === "marine-api.open-meteo.com") {
      marine += 1;
      const count = url.searchParams.get("latitude")?.split(",").length ?? 0;
      return Response.json(Array.from({ length: count }, (_, index) => marineEntry(index)));
    }
    if (url.hostname === "aviationweather.gov") {
      metar += 1;
      return new Response(gzipSync(METAR_CSV), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }
    throw new Error(`Unexpected provider ${url.hostname}`);
  };
  return {
    fetcher,
    calls: () => ({ met, marine, metar, maximumMetConcurrency }),
  };
}

test("provider decoders retain zero, convert knots, and reject silent unit drift", () => {
  const atmosphere = decodeMetNorwayV1(metPayload(), NOW_MS);
  assert.equal(atmosphere.temperatureC, 21.7);
  assert.equal(atmosphere.precipitationMm, 0);
  assert.equal(atmosphere.windSpeedKn, 6);
  assert.equal(atmosphere.isDay, true);

  const [marine] = decodeOpenMeteoMarineV1([marineEntry(0)], 1);
  assert.equal(marine.waveHeightM, 0.8);
  assert.equal(marine.seaSurfaceTemperatureC, 22.2);
  assert.throws(
    () => decodeOpenMeteoMarineV1([{ ...marineEntry(0), current_units: { wave_height: "ft" } }], 1),
    /unit mismatch/u,
  );
});

test("METAR CSV enforces time bounds and preserves minimum visibility semantics", () => {
  const readings = decodeAviationWeatherMetarCsvV1(METAR_CSV, NOW_MS);
  assert.equal(readings.length, 1);
  assert.equal(readings[0].stationId, "EHRD");
  assert.equal(readings[0].visibilityM, 4023);
  assert.equal(readings[0].windGustKn, 30);
  assert.equal(readings[0].visibilityIsMinimum, false);
});

test("condition precedence and every matching risk reason are retained", () => {
  const result = classifyWeatherV1({
    symbolCode: "heavyrainandthunder_day",
    isDay: true,
    precipitationMm: 7.5,
    visibilityM: 999,
    windGustKn: 40,
    waveHeightM: 5,
    hasAnyReading: true,
  });
  assert.equal(result.condition, "storm");
  assert.equal(result.risk, "severe");
  assert.deepEqual(result.riskReasons, [
    "뇌우 예보",
    "가시거리 999m",
    "돌풍 40.0kn",
    "파고 5.0m",
    "1시간 강수 7.5mm",
  ]);

  const warning = classifyWeatherV1({
    symbolCode: "clearsky_day",
    isDay: true,
    precipitationMm: 0,
    visibilityM: null,
    windGustKn: null,
    waveHeightM: 3,
    hasAnyReading: true,
  });
  assert.equal(warning.condition, "clear");
  assert.equal(warning.risk, "warning");
});

test("weather gateway fetches 82 atmosphere locations at bounded concurrency, batches marine, and caches", async () => {
  const probe = successfulFetcher();
  const service = new WeatherGatewayServiceV1({ fetcher: probe.fetcher, now: () => NOW_MS });
  const first = await service.weather();
  assert.equal(first.state, "LIVE");
  assert.equal(first.data?.locationCount, 82);
  assert.equal(first.data?.visibilityObservationCount, 1);
  assert.equal(first.data?.observations["port:KNEI-RTM"].visibilityStationId, "EHRD");
  assert.equal(first.data?.observations["port:KNEI-RTM"].risk, "warning");
  assert.deepEqual(probe.calls(), { met: 82, marine: 4, metar: 1, maximumMetConcurrency: 8 });

  const second = await service.weather();
  assert.equal(second.state, "LIVE");
  assert.equal(second.meta.mode, "cached");
  assert.deepEqual(second.meta.cache, { hit: true, stale: false, ageSeconds: 0 });
  assert.deepEqual(probe.calls(), { met: 82, marine: 4, metar: 1, maximumMetConcurrency: 8 });
});

test("a location failure degrades only weather to PARTIAL and preserves successful marine data", async () => {
  const probe = successfulFetcher({ failFirstMet: true });
  const service = new WeatherGatewayServiceV1({ fetcher: probe.fetcher, now: () => NOW_MS });
  const result = await service.weather();
  assert.equal(result.state, "PARTIAL");
  assert.match(result.data?.warnings.join(" ") ?? "", /MET_NORWAY_PARTIAL:81\/82/u);
  assert.equal(result.data?.observations["chokepoint:bab-el-mandeb"].temperatureC, null);
  assert.equal(result.data?.observations["chokepoint:bab-el-mandeb"].waveHeightM, 0.8);
});

test("MET Norway retries one 429 response once without degrading successful coverage", async () => {
  const probe = successfulFetcher({ retryFirstMet429: true });
  const service = new WeatherGatewayServiceV1({ fetcher: probe.fetcher, now: () => NOW_MS });
  const result = await service.weather();
  assert.equal(result.state, "LIVE");
  assert.equal(probe.calls().met, 83);
});

test("a verified stale cache is retained as PARTIAL when every live provider refresh fails", async () => {
  const probe = successfulFetcher();
  let nowMs = NOW_MS;
  let fail = false;
  const fetcher: typeof fetch = async (input, init) => {
    if (!fail) return probe.fetcher(input, init);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    return url.hostname === "aviationweather.gov"
      ? new Response("invalid,csv\n1,2")
      : Response.json({ invalid: true });
  };
  const service = new WeatherGatewayServiceV1({ fetcher, now: () => nowMs });
  assert.equal((await service.weather()).state, "LIVE");
  fail = true;
  nowMs += 31 * 60 * 1_000;
  const stale = await service.weather();
  assert.equal(stale.state, "PARTIAL");
  assert.equal(stale.meta.mode, "cached");
  assert.deepEqual(stale.meta.cache, { hit: true, stale: true, ageSeconds: 1_860 });
  assert.match(stale.data?.warnings.join(" ") ?? "", /STALE_WEATHER_CACHE/u);
  assert.equal(stale.data?.observations["port:KNEI-RTM"].temperatureC, 21.7);
});

test("all invalid provider payloads return truthful UNAVAILABLE without synthetic values", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.hostname === "aviationweather.gov") return new Response("not,csv\n1,2");
    return Response.json({ invalid: true });
  };
  const service = new WeatherGatewayServiceV1({ fetcher, now: () => NOW_MS });
  const result = await service.weather();
  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(result.data, null);
  assert.equal(result.meta.mode, "unavailable");
  assert.equal(result.error?.details?.reasonCode, "NO_VALID_WEATHER_OBSERVATIONS");
});
