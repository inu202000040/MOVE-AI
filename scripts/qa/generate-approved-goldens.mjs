import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packRoot = process.argv[2];
const outputRoot = resolve(repoRoot, process.argv[3] ?? "qa/goldens");

if (!packRoot) {
  throw new Error("usage: generate-approved-goldens.mjs <APP_USED_DATA path> [output path]");
}

const approvedSpecs = {
  "docs/specs/README.md": "64d35ccb6dc5fe03f16d5f55d1724436b449f406a33df6d0c59a9b23bd03d978",
  "docs/specs/WT1_FOUNDATION_LANDING.md": "294040bcb1bfcd523b20fee78c66270717ba197ab3e0cb1046715887ec80ded1",
  "docs/specs/WT2_DASHBOARD.md": "26fbc2789da0c7a84acd2e967c52c0b8f26a571fdfb479f3a32d5dd9bea7d2ff",
  "docs/specs/WT3_MODELS.md": "f82e5f23b4f9649a31dbdc5ef77d09e49e893c14954c0b93cc0a779f76e5b200",
  "docs/specs/WT4_NETWORK.md": "632790a809dbcc59944a91be8dedd696433317324019701549d6d2281da63809",
  "docs/specs/WT5_ALLOCATION.md": "6cbadd0ecafd91d144770300cf03801cf36a80ce886237f494ce207e97ced2b3",
  "docs/specs/WT6_DATA_API.md": "4fca56132506218b8e8a4fe287889ad1e3eac295bce38bffa9516ea833597ef0",
};

const approvedData = {
  "00_API_CATALOG.xlsx": [32351, "423544876b745a09eda602858d8659d2103a943bc7f55cda2d23790e707b71c0"],
  "01_ROUTE_PORT_CATALOG.xlsx": [47539, "baae5167e2a73cc81e4adefc57bcafaeefe5a0fb5f4297b3d730c1261a0be38a"],
  "02_KCCI_WEEKLY.xlsx": [155927, "ee03da280ab5d520f44ee738e857e382e2268648bef494f3dfff4402a116b8fd"],
  "03_USDKRW_ECB.xlsx": [427569, "54f976eec014c453ca115bf83aa12a776625b39c7238e922d498888eaef76d99"],
  "04_BRENT_EIA.xlsx": [99961, "7608b039c11fe55dd0310ba7dad5596e51846847b7a212aa8da8ba6955f3ba5e"],
  "05_VLSFO_USDA.xlsx": [108429, "2fd22fa5f47d02e7edc48b9999e377ff4d9d2a3e8e66a1d591b435480c52be37"],
  "06_HARPEX_REFERENCE.xlsx": [13544, "544302ac112733f91032bd78b254b5009c7250b6376f641c34bfe64a0d809804"],
  "07_PORTWATCH_PORT_TRAFFIC.xlsx": [1616510, "b2bf91993b776e1a2451f5a5b3b2ca299e590527c3eb8707a6a70753c033403d"],
  "08_PORTWATCH_CHOKEPOINT_TRAFFIC.xlsx": [255340, "72a2bee17955d4a00baaa9a4930ea41b4610169940476d8dd3d4d14fbf853529"],
  "09_WEATHER_API_REFERENCE.xlsx": [23546, "2798b8ad5668f4df3a6d84306cb3ceb2ced4903842f144be8de4d420308dc87e"],
  "10_ROUTE_NEWS_REFERENCE.xlsx": [21346, "6886e9684f6297b5854c87dcbea8b9098b487df4661825add1163c6db7e23431"],
  "11_PORTMIS_TEU_OPTIONAL.xlsx": [11871, "170bcbf9a43ebc1da549ce929eaf501efe4faa0c5db3ca02e279202db913c7cf"],
  "12_DATA_MANIFEST.xlsx": [18969, "991690557c80d0820228f8d6c63b78c82e74677d64aa91ba1be2906b681bfa71"],
  "13_MODEL_FORECAST_SNAPSHOT.xlsx": [151229, "0297028336741e43cbc9820ce9d8c387d45682b68035a26cadc80cc4505e7c4c"],
  "14_MODEL_EVALUATION.xlsx": [2309944, "3973875c93a68c430be9fa2c9d7fde1b806c1f238dde0d680bbd7396af6e8f1e"],
  "15_MODEL_TUNING_CONFIG.xlsx": [22336, "32e1d0bde567585f21ced1d1564c04da0de9613a9c9a70119b6278c552119c3a"],
  "16_ROUTE_EVENTS_AND_CORRIDORS.xlsx": [67294, "2bfe8ed28f43baf82268ae012d228c6051fb47898548a719afbcb07f3322fe02"],
  "17_RUNTIME_PROVIDER_CATALOG.xlsx": [23309, "a11e7bff4bd204eb6daeb974630cd5d57fa6f0fec13da451b2815809c4b01e7f"],
  "18_CVAR_ALLOCATION_CONFIG.xlsx": [19735, "9da8647b07057bee547d5b0d9c90369957b9534fa3e79f3d0b2877023b504652"],
  "APP_DATA_USAGE_MANIFEST.json": [3893, "47f01f91233e63a59207daf154246113a84abb1587bea168f618a83d21798e93"],
  "PACKAGE_MANIFEST.json": [9669, "8d35ec037144ef024ceaafbb6cf1266d6d9f74238369f9c013614c8f74825c18"],
  "SHA256SUMS.txt": [2383, "25f678142dce948bca64809bb7043422d0e0eddc4bff6e628877334eb8e8e2e4"],
};

const routeIds = [
  "KUWI", "KUEI", "KNEI", "KMDI", "KMEI", "KAUI", "KLEI",
  "KLWI", "KSAI", "KWAI", "KCI", "KJI", "KSEI",
];
const modelIds = [
  "naive", "sarimax", "lightgbm", "xgboost", "random_forest", "prophet", "timesfm", "chronos",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareCodePoints(left, right) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON rejects non-finite numbers");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError(`canonical JSON rejects ${typeof value}`);
}

function excelDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

function records(workbook, sheetName) {
  const [header, ...rows] = workbook.worksheets.getItem(sheetName).getUsedRange(true).values;
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]])));
}

async function importWorkbook(filename) {
  return SpreadsheetFile.importXlsx(await FileBlob.load(resolve(packRoot, filename)));
}

function routeSeed(routeId) {
  let accumulator = 20_260_803;
  for (let index = 0; index < routeId.length; index += 1) {
    accumulator = (Math.imul(accumulator, 31) + routeId.charCodeAt(index)) | 0;
  }
  return accumulator >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normal(random) {
  let first = random();
  while (first === 0) first = random();
  let second = random();
  while (second === 0) second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function buildCvarGolden(forecasts, current, seed, config) {
  const random = mulberry32(seed);
  const noiseCoefficient = Math.sqrt(1 - config.weeklyCorrelation ** 2);
  const spots = new Float64Array(config.scenarioCount);
  const samplePaths = [];

  for (let scenario = 0; scenario < config.scenarioCount; scenario += 1) {
    let latent = 0;
    const path = [];
    for (let horizon = 0; horizon < forecasts.length; horizon += 1) {
      const independent = normal(random);
      latent = horizon === 0 ? independent : config.weeklyCorrelation * latent + noiseCoefficient * independent;
      const forecast = forecasts[horizon];
      const down = Math.max(1, (forecast.point - forecast.lower90) / config.pi90Z);
      const up = Math.max(1, (forecast.upper90 - forecast.point) / config.pi90Z);
      path.push(Math.max(config.spotFloor, forecast.point + latent * (latent < 0 ? down : up)));
    }
    spots[scenario] = path[0];
    if (scenario < 3) samplePaths.push(path);
  }

  const fixed = Math.round(forecasts[0].point * 1.035);
  const meanSpot = spots.reduce((sum, spot) => sum + spot, 0) / spots.length;
  const results = [];
  for (let percentage = 0; percentage <= 100; percentage += 1) {
    const fixedShare = percentage / 100;
    const losses = Array.from(spots, (spot, scenario) => ({
      scenario,
      spot,
      loss: spot < fixed
        ? fixedShare * config.volume * (fixed - spot)
        : (1 - fixedShare) * config.volume * (spot - fixed),
    }));
    const threshold = losses.map((row) => row.loss).sort((left, right) => right - left)[config.tailCount - 1];
    const tail = [];
    for (const row of losses) if (row.loss > threshold) tail.push(row);
    for (const row of losses) {
      if (tail.length === config.tailCount) break;
      if (row.loss === threshold) tail.push(row);
    }
    assert.equal(tail.length, config.tailCount);
    const sums = tail.reduce((accumulator, row) => {
      accumulator.total += row.loss;
      if (row.spot < fixed) accumulator.downward += row.loss;
      else accumulator.upward += row.loss;
      return accumulator;
    }, { total: 0, upward: 0, downward: 0 });
    const expectedCost = config.volume * (fixedShare * fixed + (1 - fixedShare) * meanSpot);
    const cvar90 = sums.total / config.tailCount;
    results.push({
      fixedSharePct: percentage,
      expectedCost,
      cvar90,
      upwardCvar90: sums.upward / config.tailCount,
      downwardCvar90: sums.downward / config.tailCount,
      objective: expectedCost + config.riskWeight * cvar90,
    });
  }
  const best = results.reduce((winner, result) => result.objective < winner.objective ? result : winner);
  return {
    routeId: "KNEI",
    current,
    selectedHorizon: 1,
    fixed,
    volume: config.volume,
    riskWeight: config.riskWeight,
    meanSpot,
    firstThreePaths: samplePaths,
    best,
    checkpoints: [results[0], results[13], results[50], results[100]],
    resultsSha256: sha256(JSON.stringify(results)),
  };
}

for (const [relativePath, expectedHash] of Object.entries(approvedSpecs)) {
  const bytes = await readFile(resolve(repoRoot, relativePath));
  assert.equal(sha256(bytes), expectedHash, `approved spec changed: ${relativePath}`);
}

for (const [filename, [expectedSize, expectedHash]] of Object.entries(approvedData)) {
  const bytes = await readFile(resolve(packRoot, filename));
  assert.equal(bytes.byteLength, expectedSize, `approved input size changed: ${filename}`);
  assert.equal(sha256(bytes), expectedHash, `approved input hash changed: ${filename}`);
}

const packageManifest = JSON.parse(await readFile(resolve(packRoot, "PACKAGE_MANIFEST.json"), "utf8"));
const routeWorkbook = await importWorkbook("01_ROUTE_PORT_CATALOG.xlsx");
const historyWorkbook = await importWorkbook("02_KCCI_WEEKLY.xlsx");
const weatherWorkbook = await importWorkbook("09_WEATHER_API_REFERENCE.xlsx");
const forecastWorkbook = await importWorkbook("13_MODEL_FORECAST_SNAPSHOT.xlsx");
const evaluationWorkbook = await importWorkbook("14_MODEL_EVALUATION.xlsx");
const tuningWorkbook = await importWorkbook("15_MODEL_TUNING_CONFIG.xlsx");
const providerWorkbook = await importWorkbook("17_RUNTIME_PROVIDER_CATALOG.xlsx");
const cvarWorkbook = await importWorkbook("18_CVAR_ALLOCATION_CONFIG.xlsx");

const routes = records(routeWorkbook, "ROUTES");
const ports = records(routeWorkbook, "PORTS");
const chokepoints = records(routeWorkbook, "CHOKEPOINTS");
const weather = records(weatherWorkbook, "LOCATION_CATALOG");
assert.deepEqual(routes.map((row) => row.route_code), routeIds);
assert.equal(ports.length, 57);
assert.equal(new Set(ports.map((row) => row.portwatch_id)).size, 56);
assert.equal(chokepoints.length, 11);
assert.equal(weather.length, 82);

const primaryPortByRoute = new Map(ports.filter((row) => row.primary).map((row) => [row.route_code, row.marker_id]));
assert.equal(primaryPortByRoute.size, 13);
const networkCatalog = {
  schemaVersion: "network-catalog-seam/v1",
  capturedAt: packageManifest.generatedAtKst,
  timezone: "Asia/Seoul",
  referenceManifestSha256: approvedData["12_DATA_MANIFEST.xlsx"][1],
  routes: routes.map((row) => ({
    id: row.route_code,
    primaryPortId: primaryPortByRoute.get(row.route_code),
    waypointCoordinates: [
      [row.origin_longitude, row.origin_latitude],
      [row.representative_longitude, row.representative_latitude],
    ],
  })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  ports: ports.map((row) => ({
    id: row.marker_id,
    routeId: row.route_code,
    longitude: row.longitude,
    latitude: row.latitude,
    upstreamPortWatchId: row.portwatch_id,
    primary: row.primary,
  })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  chokepoints: chokepoints.map((row) => ({
    id: row.chokepoint_id,
    longitude: row.longitude,
    latitude: row.latitude,
    upstreamPortWatchId: row.portwatch_id,
  })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  weather: weather.map((row) => ({
    id: row.location_key,
    kind: row.kind,
    entityId: row.entity_id,
    longitude: row.longitude,
    latitude: row.latitude,
  })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
};
const networkBytes = Buffer.from(`${JSON.stringify(networkCatalog)}\n`, "utf8");
const networkIdentity = {
  schemaVersion: "network-catalog-seam-identity/v1",
  catalogSeamSha256: sha256(networkBytes),
  byteSize: networkBytes.byteLength,
  routeCount: networkCatalog.routes.length,
  portCount: networkCatalog.ports.length,
  uniquePortSeriesCount: new Set(networkCatalog.ports.map((row) => row.upstreamPortWatchId)).size,
  chokepointCount: networkCatalog.chokepoints.length,
  weatherCount: networkCatalog.weather.length,
  referenceManifestSha256: networkCatalog.referenceManifestSha256,
};

const history = records(historyWorkbook, "APP_BASELINE");
const forecasts = records(forecastWorkbook, "NORMALIZED");
const metrics = records(forecastWorkbook, "METRICS");
const models = records(forecastWorkbook, "MODELS");
const champions = records(evaluationWorkbook, "CHAMPION_H1");
assert.equal(history.length, 13 * 187);
assert.equal(forecasts.length, 13 * 8 * 4);
assert.equal(metrics.length, 13 * 8 * 4);
assert.deepEqual(models.map((row) => row.model_id), modelIds);
assert.equal(champions.length, 13);

const kneiCurrentRow = history.filter((row) => row.route_code === "KNEI").at(-1);
const kneiChampion = champions.find((row) => row.route_id === "KNEI");
const kneiForecasts = forecasts.filter((row) => row.route_id === "KNEI" && row.model_id === kneiChampion.champion_model_id).map((row) => ({
  horizonWeeks: row.horizon_weeks,
  targetDate: excelDate(row.target_date),
  point: row.point_forecast,
  lower90: row.lower90,
  upper90: row.upper90,
  calibrationSampleSize: row.calibration_sample_size,
}));
const kneiMetrics = metrics.filter((row) => row.route_id === "KNEI" && row.model_id === kneiChampion.champion_model_id).map((row) => ({
  horizonWeeks: row.horizon_weeks,
  mapePct: row.mape_pct,
  mse: row.mse,
  rmse: row.rmse,
  mase: row.mase,
  coveragePct: row.pi90_coverage_pct,
  coverageHits: row.coverage_hits,
  coverageTotal: row.coverage_total,
  sampleSize: row.sample_size,
}));
const kneiAgreement = [1, 2, 3, 4].map((horizonWeeks) => {
  const members = forecasts.filter((row) => row.route_id === "KNEI" && row.horizon_weeks === horizonWeeks).map((row) => {
    const changePct = 100 * (row.point_forecast / kneiCurrentRow.value - 1);
    return {
      modelId: row.model_id,
      point: row.point_forecast,
      changePct,
      direction: changePct >= 3 ? "up" : changePct <= -3 ? "down" : "flat",
    };
  });
  return {
    horizonWeeks,
    thresholdPct: 3,
    up: members.filter((member) => member.direction === "up").length,
    down: members.filter((member) => member.direction === "down").length,
    flat: members.filter((member) => member.direction === "flat").length,
    total: members.length,
    members,
  };
});

const cvarConfigRows = Object.fromEntries(records(cvarWorkbook, "APP_BASELINE").map((row) => [row.key, row.value]));
const routeSeeds = Object.fromEntries(records(cvarWorkbook, "ROUTE_SEEDS").map((row) => [row.route_id, row.seed]));
for (const routeId of routeIds) assert.equal(routeSeed(routeId), routeSeeds[routeId]);
const cvarConfig = {
  scenarioCount: cvarConfigRows.scenario_count,
  candidateCount: cvarConfigRows.allocation_candidate_count,
  alpha: cvarConfigRows.cvar_alpha,
  tailCount: cvarConfigRows.tail_count,
  weeklyCorrelation: cvarConfigRows.weekly_ar1_correlation,
  pi90Z: cvarConfigRows.asymmetric_pi90_z,
  volume: cvarConfigRows.default_volume_feu,
  spotFloor: cvarConfigRows.spot_floor_usd_feu,
  riskWeight: 1,
};
const cvarGolden = buildCvarGolden(
  kneiForecasts,
  { date: excelDate(kneiCurrentRow.date), value: kneiCurrentRow.value, unit: kneiCurrentRow.unit },
  routeSeeds.KNEI,
  cvarConfig,
);

const canonicalHashInput = { z: -0, a: { "😀": 3, aa: 2, a: 1 }, tuple: [4, 3, 2, 1] };
const canonicalHashJson = canonicalJson(canonicalHashInput);
const providerRows = records(providerWorkbook, "NORMALIZED");
const tuningRows = records(tuningWorkbook, "APP_BASELINE");
const manifest = {
  schemaVersion: "move-ai/qa-golden-manifest/v1",
  generator: "wt8-approved-golden-generator/v1",
  authority: {
    specs: approvedSpecs,
    dataPack: Object.fromEntries(Object.entries(approvedData).map(([filename, [byteSize, hash]]) => [filename, { byteSize, sha256: hash }])),
    forbiddenInputPolicy: "docs/00_ALLOWED_INPUTS.md",
    quarantinedReferenceRead: false,
  },
  contracts: {
    gateway: {
      schemaVersion: "move-ai/gateway/v1",
      dataModes: ["live", "fixture", "cached", "unavailable"],
      rootKeys: ["schemaVersion", "state", "data", "meta", "error"],
      metaKeys: ["mode", "source", "sourceUrl", "asOf", "fetchedAt", "unit", "isEstimate", "attribution", "warnings", "provider", "cache"],
      cacheKeys: ["hit", "stale", "ageSeconds"],
      errorKeys: ["code", "message", "retryable", "upstreamStatus", "details"],
      methods: ["snapshot", "market", "news", "insight", "tuningHealth", "tuningRun", "portSummary", "portDetail", "chokeSummary", "chokeDetail", "weather"],
      negativeCases: ["extra-root", "extra-meta", "extra-cache", "extra-error", "unknown-state", "unavailable-with-data", "success-with-error", "cached-without-hit", "fixture-live"],
    },
    routeStorage: {
      routeIds,
      routeLabels: Object.fromEntries(routes.map((row) => [row.route_code, row.name_ko])),
      defaultRouteId: "KNEI",
      initialPriority: ["valid-query", "valid-storage", "KNEI"],
      changeTransaction: ["shared-state", "storage", "replace-query", "shared-publication"],
      keys: {
        route: "move-ai:route:v1",
        representativePrefix: "move-ai:representative:v1:",
        tuningPrefix: "move-ai:tuning:v1:",
        routeNewsPrefix: "move-ai:route-news:v1:",
        forecastInsightPrefix: "move-ai:forecast-insight:v1:",
      },
    },
    insight: {
      runtimeEngines: ["GEMINI", "RULE_FALLBACK"],
      forbiddenRuntimeProviders: ["OpenAI"],
      geminiKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      approvedProviderInputRows: providerRows.filter((row) => row.category === "INSIGHT").length,
      note: "WT6 approved spec overrides obsolete provider rows in data pack 17.",
    },
  },
  model: {
    routeCount: 13,
    historyObservationsPerRoute: 187,
    modelIds,
    horizonWeeks: [1, 2, 3, 4],
    forecastRowCount: forecasts.length,
    metricRowCount: metrics.length,
    evaluationRowCount: 21632,
    rollingOriginCount: 52,
    unit: "USD/FEU",
    tuningParameterRowCount: tuningRows.length,
    knei: {
      currentObservation: { date: excelDate(kneiCurrentRow.date), value: kneiCurrentRow.value, unit: kneiCurrentRow.unit },
      automaticChampion: {
        modelId: kneiChampion.champion_model_id,
        modelName: kneiChampion.champion_model_name,
        modelVersion: kneiChampion.champion_model_version,
        totalScore: kneiChampion.total_score,
      },
      forecasts: kneiForecasts,
      metricsByHorizon: kneiMetrics,
      modelAgreementByHorizon: kneiAgreement,
    },
    canonicalHashVector: {
      input: canonicalHashInput,
      canonicalJson: canonicalHashJson,
      sha256: sha256(canonicalHashJson),
      representativeRevision: `rep-v1:${sha256(canonicalHashJson)}`,
    },
  },
  network: {
    identity: networkIdentity,
    catalogFixture: "network-catalog-seam-v1.json",
    identityFixture: "network-catalog-seam-identity-v1.json",
  },
  cvar: {
    config: cvarConfig,
    routeSeeds,
    kneiGolden: cvarGolden,
  },
};

await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, "network-catalog-seam-v1.json"), networkBytes);
await writeFile(resolve(outputRoot, "network-catalog-seam-identity-v1.json"), `${JSON.stringify(networkIdentity, null, 2)}\n`, "utf8");
await writeFile(resolve(outputRoot, "approved-v1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputRoot, networkIdentity, cvarBest: cvarGolden.best, cvarResultsSha256: cvarGolden.resultsSha256 }, null, 2)}\n`);
