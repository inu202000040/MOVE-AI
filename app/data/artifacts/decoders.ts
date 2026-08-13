import { ROUTE_IDS } from "../../contracts/routes";
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
  sortedUnique,
  string,
  stringArray,
} from "./decoder-core";

const MODEL_IDS = [
  "naive",
  "sarimax",
  "lightgbm",
  "xgboost",
  "random_forest",
  "prophet",
  "timesfm",
  "chronos",
] as const;
const HORIZONS = [1, 2, 3, 4] as const;

function assertMetric(value: unknown, path: string, horizon: number): void {
  const item = record(value, path);
  exactKeys(
    item,
    ["horizon", "mapePct", "mse", "rmse", "mase", "coverage90Pct", "hits", "total", "sampleSize"],
    path,
  );
  literal(integer(item.horizon, `${path}.horizon`), horizon, `${path}.horizon`);
  finite(item.mapePct, `${path}.mapePct`);
  finite(item.mse, `${path}.mse`);
  finite(item.rmse, `${path}.rmse`);
  finite(item.mase, `${path}.mase`);
  const coverage = finite(item.coverage90Pct, `${path}.coverage90Pct`);
  const hits = integer(item.hits, `${path}.hits`);
  const total = integer(item.total, `${path}.total`);
  const sampleSize = integer(item.sampleSize, `${path}.sampleSize`);
  if (coverage < 0 || coverage > 100 || hits < 0 || hits > total || total !== sampleSize) {
    throw new Error(`${path} metric bounds are invalid`);
  }
}

function assertEvaluationRecord(value: unknown, path: string): void {
  const item = record(value, path);
  exactKeys(
    item,
    [
      "forecastOrigin",
      "targetDate",
      "predicted",
      "actual",
      "difference",
      "absoluteError",
      "apePct",
      "lower90",
      "upper90",
      "covered90",
    ],
    path,
  );
  const origin = isoDate(item.forecastOrigin, `${path}.forecastOrigin`);
  const target = isoDate(item.targetDate, `${path}.targetDate`);
  const predicted = finite(item.predicted, `${path}.predicted`);
  const actual = finite(item.actual, `${path}.actual`);
  const difference = finite(item.difference, `${path}.difference`);
  const absoluteError = finite(item.absoluteError, `${path}.absoluteError`);
  finite(item.apePct, `${path}.apePct`);
  const lower90 = finite(item.lower90, `${path}.lower90`);
  const upper90 = finite(item.upper90, `${path}.upper90`);
  const covered90 = boolean(item.covered90, `${path}.covered90`);
  if (origin >= target || Math.abs(predicted - actual - difference) > 1e-8) {
    throw new Error(`${path} evaluation identity is invalid`);
  }
  if (Math.abs(Math.abs(difference) - absoluteError) > 1e-8) {
    throw new Error(`${path} absolute error is invalid`);
  }
  if ((lower90 <= actual && actual <= upper90) !== covered90) {
    throw new Error(`${path} coverage flag is invalid`);
  }
}

function assertModel(value: unknown, path: string, expectedId: string): void {
  const model = record(value, path);
  exactKeys(
    model,
    ["id", "name", "version", "metricsByHorizon", "evaluationByHorizon", "forecasts"],
    path,
  );
  literal(string(model.id, `${path}.id`), expectedId, `${path}.id`);
  string(model.name, `${path}.name`);
  string(model.version, `${path}.version`);
  const metrics = array(model.metricsByHorizon, `${path}.metricsByHorizon`);
  const evaluations = array(model.evaluationByHorizon, `${path}.evaluationByHorizon`);
  const forecasts = array(model.forecasts, `${path}.forecasts`);
  exactArrayLength(metrics, 4, `${path}.metricsByHorizon`);
  exactArrayLength(evaluations, 4, `${path}.evaluationByHorizon`);
  exactArrayLength(forecasts, 4, `${path}.forecasts`);
  HORIZONS.forEach((horizon, index) => {
    assertMetric(metrics[index], `${path}.metricsByHorizon[${index}]`, horizon);
    const group = record(evaluations[index], `${path}.evaluationByHorizon[${index}]`);
    exactKeys(group, ["horizon", "records"], `${path}.evaluationByHorizon[${index}]`);
    literal(integer(group.horizon, `${path}.evaluationByHorizon[${index}].horizon`), horizon, `${path}.evaluationByHorizon[${index}].horizon`);
    const records = array(group.records, `${path}.evaluationByHorizon[${index}].records`);
    exactArrayLength(records, 52, `${path}.evaluationByHorizon[${index}].records`);
    records.forEach((item, recordIndex) =>
      assertEvaluationRecord(item, `${path}.evaluationByHorizon[${index}].records[${recordIndex}]`),
    );

    const forecast = record(forecasts[index], `${path}.forecasts[${index}]`);
    exactKeys(
      forecast,
      ["horizon", "date", "value", "lower90", "upper90", "calibrationSampleSize"],
      `${path}.forecasts[${index}]`,
    );
    literal(integer(forecast.horizon, `${path}.forecasts[${index}].horizon`), horizon, `${path}.forecasts[${index}].horizon`);
    isoDate(forecast.date, `${path}.forecasts[${index}].date`);
    const point = finite(forecast.value, `${path}.forecasts[${index}].value`);
    const lower = finite(forecast.lower90, `${path}.forecasts[${index}].lower90`);
    const upper = finite(forecast.upper90, `${path}.forecasts[${index}].upper90`);
    integer(forecast.calibrationSampleSize, `${path}.forecasts[${index}].calibrationSampleSize`);
    if (point <= 0 || lower > point || point > upper) {
      throw new Error(`${path}.forecasts[${index}] interval is invalid`);
    }
  });
}

export function assertForecastSnapshotV3(value: unknown): void {
  const root = record(value, "$snapshot");
  exactKeys(root, ["schemaVersion", "generatedAt", "protocol", "source", "dates", "routes"], "$snapshot");
  literal(root.schemaVersion, "glovis-freight-risk/v3", "$snapshot.schemaVersion");
  isoTimestamp(root.generatedAt, "$snapshot.generatedAt");
  const protocol = record(root.protocol, "$snapshot.protocol");
  exactKeys(
    protocol,
    [
      "horizonsWeeks",
      "evaluationOrigins",
      "initialCalibrationOrigins",
      "targetCoverage",
      "intervalMethod",
      "windowStrategy",
      "targetAvailabilityRule",
    ],
    "$snapshot.protocol",
  );
  const horizons = array(protocol.horizonsWeeks, "$snapshot.protocol.horizonsWeeks");
  exactArrayLength(horizons, 4, "$snapshot.protocol.horizonsWeeks");
  HORIZONS.forEach((horizon, index) => literal(integer(horizons[index], `horizons[${index}]`), horizon, `horizons[${index}]`));
  literal(integer(protocol.evaluationOrigins, "$snapshot.protocol.evaluationOrigins"), 52, "$snapshot.protocol.evaluationOrigins");
  literal(integer(protocol.initialCalibrationOrigins, "$snapshot.protocol.initialCalibrationOrigins"), 26, "$snapshot.protocol.initialCalibrationOrigins");
  literal(finite(protocol.targetCoverage, "$snapshot.protocol.targetCoverage"), 0.9, "$snapshot.protocol.targetCoverage");
  literal(string(protocol.intervalMethod, "$snapshot.protocol.intervalMethod"), "online absolute-error conformal", "$snapshot.protocol.intervalMethod");
  literal(string(protocol.windowStrategy, "$snapshot.protocol.windowStrategy"), "expanding", "$snapshot.protocol.windowStrategy");
  literal(string(protocol.targetAvailabilityRule, "$snapshot.protocol.targetAvailabilityRule"), "target_index_lte_forecast_origin", "$snapshot.protocol.targetAvailabilityRule");

  const source = record(root.source, "$snapshot.source");
  exactKeys(source, ["logicalIds", "periodStart", "periodEnd", "observationCount"], "$snapshot.source");
  const logicalIds = stringArray(source.logicalIds, "$snapshot.source.logicalIds");
  if (logicalIds.join(",") !== "02,13,14,15") throw new Error("Snapshot logical input IDs mismatch");
  const periodStart = isoDate(source.periodStart, "$snapshot.source.periodStart");
  const periodEnd = isoDate(source.periodEnd, "$snapshot.source.periodEnd");
  literal(integer(source.observationCount, "$snapshot.source.observationCount"), 187, "$snapshot.source.observationCount");

  const dates = array(root.dates, "$snapshot.dates").map((date, index) => isoDate(date, `$snapshot.dates[${index}]`));
  exactArrayLength(dates, 187, "$snapshot.dates");
  sortedUnique(dates, "$snapshot.dates");
  if (dates[0] !== periodStart || dates.at(-1) !== periodEnd) throw new Error("Snapshot period mismatch");

  const routes = record(root.routes, "$snapshot.routes");
  const routeKeys = Object.keys(routes);
  exactArrayLength(routeKeys, 13, "$snapshot.routes keys");
  sortedUnique(routeKeys, "$snapshot.routes keys");
  for (const id of ROUTE_IDS) {
    const route = record(routes[id], `$snapshot.routes.${id}`);
    exactKeys(route, ["id", "name", "unit", "values", "models"], `$snapshot.routes.${id}`);
    literal(string(route.id, `${id}.id`), id, `${id}.id`);
    string(route.name, `${id}.name`);
    literal(string(route.unit, `${id}.unit`), "USD/FEU", `${id}.unit`);
    const values = array(route.values, `${id}.values`);
    exactArrayLength(values, 187, `${id}.values`);
    values.forEach((item, index) => {
      if (finite(item, `${id}.values[${index}]`) <= 0) throw new Error(`${id} contains nonpositive history`);
    });
    const models = array(route.models, `${id}.models`);
    exactArrayLength(models, 8, `${id}.models`);
    MODEL_IDS.forEach((modelId, index) => assertModel(models[index], `${id}.models[${index}]`, modelId));
  }
}

function assertMarketSeries(value: unknown, path: string): void {
  const item = record(value, path);
  exactKeys(
    item,
    ["label", "unit", "provider", "aggregation", "observationStart", "observationEnd", "points", "attempts"],
    path,
  );
  string(item.label, `${path}.label`);
  string(item.unit, `${path}.unit`);
  string(item.provider, `${path}.provider`);
  string(item.aggregation, `${path}.aggregation`);
  const start = isoDate(item.observationStart, `${path}.observationStart`);
  const end = isoDate(item.observationEnd, `${path}.observationEnd`);
  const points = array(item.points, `${path}.points`);
  const dates = points.map((point, index) => {
    const entry = record(point, `${path}.points[${index}]`);
    exactKeys(entry, ["date", "week", "value"], `${path}.points[${index}]`);
    const date = isoDate(entry.date, `${path}.points[${index}].date`);
    if (!/^\d{4}-W\d{2}$/u.test(string(entry.week, `${path}.points[${index}].week`))) {
      throw new Error(`${path}.points[${index}].week is invalid`);
    }
    if (finite(entry.value, `${path}.points[${index}].value`) <= 0) {
      throw new Error(`${path}.points[${index}].value must be positive`);
    }
    return date;
  });
  sortedUnique(dates, `${path}.points dates`);
  if (dates[0] !== start || dates.at(-1) !== end) throw new Error(`${path} observation bounds mismatch`);
  array(item.attempts, `${path}.attempts`);
}

export function assertMarketReferenceV1(value: unknown): void {
  const root = record(value, "$market");
  exactKeys(root, ["schemaVersion", "generatedAt", "providerVersion", "series"], "$market");
  literal(root.schemaVersion, "move-ai/market-reference/v1", "$market.schemaVersion");
  isoTimestamp(root.generatedAt, "$market.generatedAt");
  literal(integer(root.providerVersion, "$market.providerVersion"), 3, "$market.providerVersion");
  const series = record(root.series, "$market.series");
  exactKeys(series, ["bunker", "fx", "harpex", "oil"], "$market.series");
  for (const id of ["bunker", "fx", "harpex", "oil"]) assertMarketSeries(series[id], `$market.series.${id}`);
  const harpex = record(series.harpex, "$market.series.harpex");
  literal(string(harpex.unit, "$market.series.harpex.unit"), "Index", "$market.series.harpex.unit");
}

function assertNullableNonnegative(value: unknown, path: string): number | null {
  const result = nullableFinite(value, path);
  if (result !== null && result < 0) throw new Error(`${path} must not be negative`);
  return result;
}

function assertPortSummary(value: unknown, path: string, key: string): void {
  const item = record(value, path);
  exactKeys(
    item,
    [
      "portId", "routeCode", "portWatchId", "sharedSeries", "sharedWithPortIds", "observedAt",
      "observedDays7d", "previousObservedDays7d", "estimatedImportTons7d", "estimatedExportTons7d",
      "estimatedTotalTons7d", "previousEstimatedImportTons7d", "previousEstimatedExportTons7d",
      "previousEstimatedTotalTons7d", "estimatedTotalTonsChangePercent", "containerVesselCalls7d",
      "previousContainerVesselCalls7d", "vesselCallsChangePercent",
    ],
    path,
  );
  literal(string(item.portId, `${path}.portId`), key, `${path}.portId`);
  oneOf(item.routeCode, ROUTE_IDS, `${path}.routeCode`);
  string(item.portWatchId, `${path}.portWatchId`);
  boolean(item.sharedSeries, `${path}.sharedSeries`);
  stringArray(item.sharedWithPortIds, `${path}.sharedWithPortIds`);
  isoDate(item.observedAt, `${path}.observedAt`);
  integer(item.observedDays7d, `${path}.observedDays7d`);
  integer(item.previousObservedDays7d, `${path}.previousObservedDays7d`);
  for (const field of [
    "estimatedImportTons7d", "estimatedExportTons7d", "estimatedTotalTons7d",
    "previousEstimatedImportTons7d", "previousEstimatedExportTons7d",
    "previousEstimatedTotalTons7d", "containerVesselCalls7d", "previousContainerVesselCalls7d",
  ]) assertNullableNonnegative(item[field], `${path}.${field}`);
  nullableFinite(item.estimatedTotalTonsChangePercent, `${path}.estimatedTotalTonsChangePercent`);
  nullableFinite(item.vesselCallsChangePercent, `${path}.vesselCallsChangePercent`);
}

export function assertPortTrafficFixtureV1(value: unknown): void {
  const root = record(value, "$port");
  exactKeys(
    root,
    [
      "schemaVersion", "generatedAt", "fetchedAt", "commonObservationDate", "source", "attribution",
      "methodologyNote", "caveats", "units", "markerCount", "uniqueSeriesCount", "availableMarkerCount",
      "availableSeriesCount", "summaries", "details",
    ],
    "$port",
  );
  literal(root.schemaVersion, "move-ai/port-traffic-fixture/v1", "$port.schemaVersion");
  isoTimestamp(root.generatedAt, "$port.generatedAt");
  isoTimestamp(root.fetchedAt, "$port.fetchedAt");
  literal(isoDate(root.commonObservationDate, "$port.commonObservationDate"), "2026-08-07", "$port.commonObservationDate");
  string(root.source, "$port.source");
  string(root.attribution, "$port.attribution");
  string(root.methodologyNote, "$port.methodologyNote");
  stringArray(root.caveats, "$port.caveats");
  const units = record(root.units, "$port.units");
  exactKeys(units, ["cargo", "vesselCalls"], "$port.units");
  literal(units.cargo, "metric_tons_estimated", "$port.units.cargo");
  literal(units.vesselCalls, "calls", "$port.units.vesselCalls");
  literal(integer(root.markerCount, "$port.markerCount"), 57, "$port.markerCount");
  literal(integer(root.uniqueSeriesCount, "$port.uniqueSeriesCount"), 56, "$port.uniqueSeriesCount");
  literal(integer(root.availableMarkerCount, "$port.availableMarkerCount"), 57, "$port.availableMarkerCount");
  literal(integer(root.availableSeriesCount, "$port.availableSeriesCount"), 56, "$port.availableSeriesCount");
  const summaries = record(root.summaries, "$port.summaries");
  const details = record(root.details, "$port.details");
  exactArrayLength(Object.keys(summaries), 57, "$port.summaries keys");
  exactArrayLength(Object.keys(details), 57, "$port.details keys");
  for (const [key, summary] of Object.entries(summaries)) assertPortSummary(summary, `$port.summaries.${key}`, key);
  for (const [key, value] of Object.entries(details)) {
    const detail = record(value, `$port.details.${key}`);
    exactKeys(
      detail,
      ["portId", "routeCode", "portWatchId", "sharedSeries", "sharedWithPortIds", "points"],
      `$port.details.${key}`,
    );
    literal(string(detail.portId, "portId"), key, "portId");
    oneOf(detail.routeCode, ROUTE_IDS, "routeCode");
    string(detail.portWatchId, "portWatchId");
    boolean(detail.sharedSeries, "sharedSeries");
    stringArray(detail.sharedWithPortIds, "sharedWithPortIds");
    const points = array(detail.points, `$port.details.${key}.points`);
    exactArrayLength(points, 220, `$port.details.${key}.points`);
    const dates = points.map((point, index) => {
      const item = record(point, `$port.details.${key}.points[${index}]`);
      exactKeys(
        item,
        [
          "date", "estimatedImportTons", "estimatedExportTons", "estimatedTotalTons",
          "containerVesselCalls", "estimatedImportTons7d", "estimatedExportTons7d",
          "estimatedTotalTons7d", "containerVesselCalls7d",
        ],
        `$port.details.${key}.points[${index}]`,
      );
      for (const field of [
        "estimatedImportTons", "estimatedExportTons", "estimatedTotalTons", "containerVesselCalls",
        "estimatedImportTons7d", "estimatedExportTons7d", "estimatedTotalTons7d", "containerVesselCalls7d",
      ]) assertNullableNonnegative(item[field], `${key}.points[${index}].${field}`);
      return isoDate(item.date, `${key}.points[${index}].date`);
    });
    sortedUnique(dates, `$port.details.${key}.point dates`);
  }
}

function assertChokeSummary(value: unknown, path: string, key: string): void {
  const item = record(value, path);
  exactKeys(
    item,
    [
      "chokepointId", "portwatchId", "observedAt", "containerVessels7d", "estimatedTransitTons7d",
      "previousContainerVessels7d", "previousEstimatedTransitTons7d", "vesselChangePercent",
      "transitTonsChangePercent",
    ],
    path,
  );
  literal(string(item.chokepointId, `${path}.chokepointId`), key, `${path}.chokepointId`);
  string(item.portwatchId, `${path}.portwatchId`);
  isoDate(item.observedAt, `${path}.observedAt`);
  for (const field of [
    "containerVessels7d", "estimatedTransitTons7d", "previousContainerVessels7d",
    "previousEstimatedTransitTons7d",
  ]) assertNullableNonnegative(item[field], `${path}.${field}`);
  nullableFinite(item.vesselChangePercent, `${path}.vesselChangePercent`);
  nullableFinite(item.transitTonsChangePercent, `${path}.transitTonsChangePercent`);
}

export function assertChokepointTrafficFixtureV1(value: unknown): void {
  const root = record(value, "$chokepoint");
  exactKeys(
    root,
    [
      "schemaVersion", "generatedAt", "fetchedAt", "latestObservationDate", "source", "attribution",
      "methodologyNote", "appChokepointCount", "fullCatalogSeriesCount", "summaries", "details",
    ],
    "$chokepoint",
  );
  literal(root.schemaVersion, "move-ai/chokepoint-traffic-fixture/v1", "$chokepoint.schemaVersion");
  isoTimestamp(root.generatedAt, "$chokepoint.generatedAt");
  isoTimestamp(root.fetchedAt, "$chokepoint.fetchedAt");
  literal(isoDate(root.latestObservationDate, "$chokepoint.latestObservationDate"), "2026-08-09", "$chokepoint.latestObservationDate");
  string(root.source, "$chokepoint.source");
  string(root.attribution, "$chokepoint.attribution");
  string(root.methodologyNote, "$chokepoint.methodologyNote");
  literal(integer(root.appChokepointCount, "$chokepoint.appChokepointCount"), 11, "$chokepoint.appChokepointCount");
  literal(integer(root.fullCatalogSeriesCount, "$chokepoint.fullCatalogSeriesCount"), 28, "$chokepoint.fullCatalogSeriesCount");
  const summaries = record(root.summaries, "$chokepoint.summaries");
  const details = record(root.details, "$chokepoint.details");
  exactArrayLength(Object.keys(summaries), 11, "$chokepoint.summaries keys");
  exactArrayLength(Object.keys(details), 11, "$chokepoint.details keys");
  for (const [key, summary] of Object.entries(summaries)) {
    assertChokeSummary(summary, `$chokepoint.summaries.${key}`, key);
  }
  for (const [key, value] of Object.entries(details)) {
    const detail = record(value, `$chokepoint.details.${key}`);
    exactKeys(detail, ["chokepointId", "portwatchId", "points"], `$chokepoint.details.${key}`);
    literal(string(detail.chokepointId, "chokepointId"), key, "chokepointId");
    string(detail.portwatchId, "portwatchId");
    const points = array(detail.points, `$chokepoint.details.${key}.points`);
    exactArrayLength(points, 220, `$chokepoint.details.${key}.points`);
    const dates = points.map((point, index) => {
      const item = record(point, `$chokepoint.details.${key}.points[${index}]`);
      exactKeys(item, ["date", "containerVessels7d", "estimatedTransitTons7d"], `${key}.points[${index}]`);
      assertNullableNonnegative(item.containerVessels7d, `${key}.points[${index}].containerVessels7d`);
      assertNullableNonnegative(item.estimatedTransitTons7d, `${key}.points[${index}].estimatedTransitTons7d`);
      return isoDate(item.date, `${key}.points[${index}].date`);
    });
    sortedUnique(dates, `$chokepoint.details.${key}.point dates`);
  }
}

export function assertNetworkCatalogSeamV1(value: unknown): void {
  const root = record(value, "$network");
  exactKeys(
    root,
    ["schemaVersion", "capturedAt", "timezone", "referenceManifestSha256", "routes", "ports", "chokepoints", "weather"],
    "$network",
  );
  literal(root.schemaVersion, "network-catalog-seam/v1", "$network.schemaVersion");
  isoTimestamp(root.capturedAt, "$network.capturedAt");
  literal(root.timezone, "Asia/Seoul", "$network.timezone");
  if (!/^[\da-f]{64}$/u.test(string(root.referenceManifestSha256, "$network.referenceManifestSha256"))) {
    throw new Error("Network reference manifest digest is invalid");
  }
  const routes = array(root.routes, "$network.routes");
  const ports = array(root.ports, "$network.ports");
  const chokepoints = array(root.chokepoints, "$network.chokepoints");
  const weather = array(root.weather, "$network.weather");
  exactArrayLength(routes, 13, "$network.routes");
  exactArrayLength(ports, 57, "$network.ports");
  exactArrayLength(chokepoints, 11, "$network.chokepoints");
  exactArrayLength(weather, 82, "$network.weather");
  const routeIds = routes.map((value, index) => {
    const item = record(value, `$network.routes[${index}]`);
    exactKeys(item, ["id", "primaryPortId", "waypointCoordinates"], `$network.routes[${index}]`);
    string(item.primaryPortId, `$network.routes[${index}].primaryPortId`);
    const coordinates = array(item.waypointCoordinates, `$network.routes[${index}].waypointCoordinates`);
    if (coordinates.length < 2) throw new Error("Network route needs at least two waypoints");
    coordinates.forEach((coordinate, coordinateIndex) => {
      const pair = array(coordinate, `$network.routes[${index}].waypointCoordinates[${coordinateIndex}]`);
      exactArrayLength(pair, 2, `$network.routes[${index}].waypointCoordinates[${coordinateIndex}]`);
      finite(pair[0], "longitude");
      finite(pair[1], "latitude");
    });
    return string(item.id, `$network.routes[${index}].id`);
  });
  sortedUnique(routeIds, "$network route IDs");
  const portIds = ports.map((value, index) => {
    const item = record(value, `$network.ports[${index}]`);
    exactKeys(item, ["id", "routeId", "longitude", "latitude", "upstreamPortWatchId", "primary"], `$network.ports[${index}]`);
    oneOf(item.routeId, ROUTE_IDS, `$network.ports[${index}].routeId`);
    finite(item.longitude, "longitude");
    finite(item.latitude, "latitude");
    string(item.upstreamPortWatchId, "upstreamPortWatchId");
    boolean(item.primary, "primary");
    return string(item.id, `$network.ports[${index}].id`);
  });
  sortedUnique(portIds, "$network port IDs");
  const uniqueSeries = new Set(
    ports.map((value, index) => string(record(value, `port[${index}]`).upstreamPortWatchId, "upstream")),
  );
  exactArrayLength([...uniqueSeries], 56, "$network unique port series");
  const chokepointIds = chokepoints.map((value, index) => {
    const item = record(value, `$network.chokepoints[${index}]`);
    exactKeys(item, ["id", "longitude", "latitude", "upstreamPortWatchId"], `$network.chokepoints[${index}]`);
    finite(item.longitude, "longitude");
    finite(item.latitude, "latitude");
    string(item.upstreamPortWatchId, "upstreamPortWatchId");
    return string(item.id, `$network.chokepoints[${index}].id`);
  });
  sortedUnique(chokepointIds, "$network chokepoint IDs");
  const weatherIds = weather.map((value, index) => {
    const item = record(value, `$network.weather[${index}]`);
    exactKeys(item, ["id", "kind", "entityId", "routeId", "longitude", "latitude"], `$network.weather[${index}]`);
    oneOf(item.kind, ["port", "chokepoint", "route"], `$network.weather[${index}].kind`);
    string(item.entityId, "entityId");
    const routeId = nullableString(item.routeId, "routeId");
    if (routeId !== null) oneOf(routeId, ROUTE_IDS, "routeId");
    finite(item.longitude, "longitude");
    finite(item.latitude, "latitude");
    return string(item.id, `$network.weather[${index}].id`);
  });
  sortedUnique(weatherIds, "$network weather IDs");
}

export function assertNetworkCatalogSeamIdentityV1(value: unknown): void {
  const root = record(value, "$networkIdentity");
  exactKeys(
    root,
    [
      "schemaVersion", "catalogSeamSha256", "byteSize", "routeCount", "portCount",
      "uniquePortSeriesCount", "chokepointCount", "weatherCount", "referenceManifestSha256",
    ],
    "$networkIdentity",
  );
  literal(root.schemaVersion, "network-catalog-seam-identity/v1", "$networkIdentity.schemaVersion");
  for (const field of ["catalogSeamSha256", "referenceManifestSha256"]) {
    if (!/^[\da-f]{64}$/u.test(string(root[field], `$networkIdentity.${field}`))) {
      throw new Error(`$networkIdentity.${field} is invalid`);
    }
  }
  integer(root.byteSize, "$networkIdentity.byteSize");
  literal(integer(root.routeCount, "routeCount"), 13, "routeCount");
  literal(integer(root.portCount, "portCount"), 57, "portCount");
  literal(integer(root.uniquePortSeriesCount, "uniquePortSeriesCount"), 56, "uniquePortSeriesCount");
  literal(integer(root.chokepointCount, "chokepointCount"), 11, "chokepointCount");
  literal(integer(root.weatherCount, "weatherCount"), 82, "weatherCount");
}

export function assertFixtureCatalogV1(value: unknown): void {
  const root = record(value, "$fixtures");
  exactKeys(root, ["schemaVersion", "generatedAt", "fixedRequestId", "items"], "$fixtures");
  literal(root.schemaVersion, "move-ai/fixture-catalog/v1", "$fixtures.schemaVersion");
  isoTimestamp(root.generatedAt, "$fixtures.generatedAt");
  string(root.fixedRequestId, "$fixtures.fixedRequestId");
  const items = array(root.items, "$fixtures.items");
  items.forEach((value, index) => {
    const item = record(value, `$fixtures.items[${index}]`);
    exactKeys(
      item,
      [
        "fixtureId", "domain", "normalizedRequest", "state", "mode", "asOf", "fetchedAt",
        "artifactDigest", "expectedStatus", "expectedCacheControl", "expectedConsumerState",
      ],
      `$fixtures.items[${index}]`,
    );
    string(item.fixtureId, "fixtureId");
    string(item.domain, "domain");
    record(item.normalizedRequest, "normalizedRequest");
    string(item.state, "state");
    oneOf(item.mode, ["fixture", "reference", "unavailable"], "mode");
    if (item.asOf !== null) isoDate(item.asOf, "asOf");
    isoTimestamp(item.fetchedAt, "fetchedAt");
    if (item.artifactDigest !== null && !/^[\da-f]{64}$/u.test(string(item.artifactDigest, "artifactDigest"))) {
      throw new Error("Invalid fixture artifact digest");
    }
    integer(item.expectedStatus, "expectedStatus");
    string(item.expectedCacheControl, "expectedCacheControl");
    string(item.expectedConsumerState, "expectedConsumerState");
    if (item.state === "UNAVAILABLE" && (item.mode !== "unavailable" || item.artifactDigest !== null)) {
      throw new Error("Unavailable fixture truth invariant failed");
    }
  });
}

export function assertSnapshotEvaluationV3(value: unknown): void {
  const root = record(value, "$evaluation");
  exactKeys(
    root,
    [
      "schemaVersion",
      "generatedAt",
      "evaluationOrigins",
      "routeCount",
      "modelOrder",
      "horizonOrder",
      "routes",
    ],
    "$evaluation",
  );
  literal(root.schemaVersion, "move-ai/snapshot-evaluation/v3", "$evaluation.schemaVersion");
  isoTimestamp(root.generatedAt, "$evaluation.generatedAt");
  literal(integer(root.evaluationOrigins, "$evaluation.evaluationOrigins"), 52, "$evaluation.evaluationOrigins");
  literal(integer(root.routeCount, "$evaluation.routeCount"), 13, "$evaluation.routeCount");
  const modelOrder = stringArray(root.modelOrder, "$evaluation.modelOrder");
  if (modelOrder.join(",") !== MODEL_IDS.join(",")) throw new Error("Evaluation model order mismatch");
  const horizonOrder = array(root.horizonOrder, "$evaluation.horizonOrder");
  exactArrayLength(horizonOrder, 4, "$evaluation.horizonOrder");
  HORIZONS.forEach((horizon, index) =>
    literal(integer(horizonOrder[index], `horizonOrder[${index}]`), horizon, `horizonOrder[${index}]`),
  );
  const routes = record(root.routes, "$evaluation.routes");
  exactArrayLength(Object.keys(routes), 13, "$evaluation.routes keys");
  for (const routeId of ROUTE_IDS) {
    const route = record(routes[routeId], `$evaluation.routes.${routeId}`);
    exactKeys(route, ["models"], `$evaluation.routes.${routeId}`);
    const models = record(route.models, `$evaluation.routes.${routeId}.models`);
    exactArrayLength(Object.keys(models), 8, `$evaluation.routes.${routeId}.models keys`);
    for (const modelId of MODEL_IDS) {
      const model = record(models[modelId], `${routeId}.${modelId}`);
      exactKeys(model, ["recordsByHorizon"], `${routeId}.${modelId}`);
      const groups = array(model.recordsByHorizon, `${routeId}.${modelId}.recordsByHorizon`);
      exactArrayLength(groups, 4, `${routeId}.${modelId}.recordsByHorizon`);
      HORIZONS.forEach((horizon, index) => {
        const group = record(groups[index], `${routeId}.${modelId}.recordsByHorizon[${index}]`);
        exactKeys(group, ["horizon", "recordCount"], `${routeId}.${modelId}.recordsByHorizon[${index}]`);
        literal(integer(group.horizon, "horizon"), horizon, "horizon");
        literal(integer(group.recordCount, "recordCount"), 52, "recordCount");
      });
    }
  }
}

export function assertNewsPolicyV18(value: unknown): void {
  const root = record(value, "$newsPolicy");
  exactKeys(
    root,
    ["schemaVersion", "generatedAt", "providerVersion", "execution", "maxDisplayedArticles", "profiles", "providers"],
    "$newsPolicy",
  );
  literal(root.schemaVersion, "move-ai/news-policy/v18", "$newsPolicy.schemaVersion");
  isoTimestamp(root.generatedAt, "$newsPolicy.generatedAt");
  literal(integer(root.providerVersion, "providerVersion"), 18, "providerVersion");
  string(root.execution, "execution");
  literal(integer(root.maxDisplayedArticles, "maxDisplayedArticles"), 5, "maxDisplayedArticles");
  const profiles = record(root.profiles, "$newsPolicy.profiles");
  exactArrayLength(Object.keys(profiles), 13, "$newsPolicy.profiles keys");
  for (const routeId of ROUTE_IDS) {
    const profile = record(profiles[routeId], `$newsPolicy.profiles.${routeId}`);
    exactKeys(
      profile,
      [
        "routeCode", "routeNameKo", "destinationQuery", "operationalQuery", "matchTerms",
        "portTerms", "localQuery", "primaryLookbackDays", "fallbackLookbackDays",
      ],
      `$newsPolicy.profiles.${routeId}`,
    );
    literal(profile.routeCode, routeId, "routeCode");
    string(profile.routeNameKo, "routeNameKo");
    string(profile.destinationQuery, "destinationQuery");
    string(profile.operationalQuery, "operationalQuery");
    stringArray(profile.matchTerms, "matchTerms");
    stringArray(profile.portTerms, "portTerms");
    if (profile.localQuery !== null) string(profile.localQuery, "localQuery");
    literal(integer(profile.primaryLookbackDays, "primaryLookbackDays"), 30, "primaryLookbackDays");
    literal(integer(profile.fallbackLookbackDays, "fallbackLookbackDays"), 90, "fallbackLookbackDays");
  }
  const providers = array(root.providers, "$newsPolicy.providers");
  if (providers.length < 5) throw new Error("News policy needs the approved provider fan-out");
  providers.forEach((value, index) => {
    const provider = record(value, `$newsPolicy.providers[${index}]`);
    exactKeys(
      provider,
      ["category", "order", "provider", "execution", "endpoint", "authentication", "unit", "notes"],
      `$newsPolicy.providers[${index}]`,
    );
    string(provider.category, "category");
    integer(provider.order, "order");
    string(provider.provider, "provider");
    string(provider.execution, "execution");
    if (!/^https:\/\//u.test(string(provider.endpoint, "endpoint"))) throw new Error("Provider endpoint must use HTTPS");
    string(provider.authentication, "authentication");
    string(provider.unit, "unit");
    string(provider.notes, "notes");
  });
}

export function assertInsightPolicyV1(value: unknown): void {
  const root = record(value, "$insightPolicy");
  exactKeys(root, ["schemaVersion", "generatedAt", "engines", "forbiddenEngines", "gemini", "fallback"], "$insightPolicy");
  literal(root.schemaVersion, "move-ai/insight-policy/v1", "$insightPolicy.schemaVersion");
  isoTimestamp(root.generatedAt, "$insightPolicy.generatedAt");
  const engines = stringArray(root.engines, "engines");
  if (engines.join(",") !== "GEMINI,RULE_FALLBACK") throw new Error("Insight engine allowlist mismatch");
  const forbidden = stringArray(root.forbiddenEngines, "forbiddenEngines");
  if (forbidden.join(",") !== "OPENAI") throw new Error("Insight forbidden engine registry mismatch");
  const gemini = record(root.gemini, "gemini");
  exactKeys(
    gemini,
    ["keyOrder", "modelCandidates", "totalTimeoutMs", "maxOutputTokens", "thinkingBudget", "advanceCandidateStatus"],
    "gemini",
  );
  const keyOrder = stringArray(gemini.keyOrder, "keyOrder");
  if (keyOrder.join(",") !== "GEMINI_API_KEY,GOOGLE_API_KEY") throw new Error("Gemini key order mismatch");
  stringArray(gemini.modelCandidates, "modelCandidates");
  literal(integer(gemini.totalTimeoutMs, "totalTimeoutMs"), 25_000, "totalTimeoutMs");
  literal(integer(gemini.maxOutputTokens, "maxOutputTokens"), 2_048, "maxOutputTokens");
  literal(integer(gemini.thinkingBudget, "thinkingBudget"), 1_024, "thinkingBudget");
  literal(integer(gemini.advanceCandidateStatus, "advanceCandidateStatus"), 404, "advanceCandidateStatus");
  record(root.fallback, "fallback");
}

export function assertTuningConfigV1(value: unknown): void {
  const root = record(value, "$tuningConfig");
  exactKeys(
    root,
    ["schemaVersion", "generatedAt", "requestLimits", "parameterCatalog", "presetCatalog", "trainingWindows"],
    "$tuningConfig",
  );
  literal(root.schemaVersion, "move-ai/tuning-config/v1", "$tuningConfig.schemaVersion");
  isoTimestamp(root.generatedAt, "$tuningConfig.generatedAt");
  const limits = record(root.requestLimits, "requestLimits");
  exactKeys(
    limits,
    ["minimumObservations", "maximumObservations", "minimumEvaluationOrigins", "maximumEvaluationOrigins", "timeoutMs"],
    "requestLimits",
  );
  literal(integer(limits.minimumObservations, "minimumObservations"), 108, "minimumObservations");
  literal(integer(limits.maximumObservations, "maximumObservations"), 10_000, "maximumObservations");
  literal(integer(limits.minimumEvaluationOrigins, "minimumEvaluationOrigins"), 36, "minimumEvaluationOrigins");
  literal(integer(limits.maximumEvaluationOrigins, "maximumEvaluationOrigins"), 52, "maximumEvaluationOrigins");
  literal(integer(limits.timeoutMs, "timeoutMs"), 600_000, "timeoutMs");
  record(root.parameterCatalog, "parameterCatalog");
  const presets = record(root.presetCatalog, "presetCatalog");
  for (const [presetId, value] of Object.entries(presets)) {
    const preset = record(value, `presetCatalog.${presetId}`);
    for (const [key, parameter] of Object.entries(preset)) {
      if (typeof parameter !== "string" && typeof parameter !== "number") {
        throw new Error(`presetCatalog.${presetId}.${key} must be string or number`);
      }
      if (typeof parameter === "number" && !Number.isFinite(parameter)) {
        throw new Error(`presetCatalog.${presetId}.${key} must be finite`);
      }
    }
  }
  exactArrayLength(array(root.trainingWindows, "trainingWindows"), 3, "trainingWindows");
}

export function assertProvenanceManifestV1(value: unknown): void {
  const root = record(value, "$provenance");
  exactKeys(
    root,
    ["schemaVersion", "generatedAt", "generator", "referenceManifestSha256", "artifacts"],
    "$provenance",
  );
  literal(root.schemaVersion, "move-ai/provenance-manifest/v1", "$provenance.schemaVersion");
  isoTimestamp(root.generatedAt, "$provenance.generatedAt");
  const generator = record(root.generator, "$provenance.generator");
  exactKeys(generator, ["id", "version"], "$provenance.generator");
  string(generator.id, "$provenance.generator.id");
  string(generator.version, "$provenance.generator.version");
  if (!/^[\da-f]{64}$/u.test(string(root.referenceManifestSha256, "$provenance.referenceManifestSha256"))) {
    throw new Error("Invalid provenance reference digest");
  }
  const artifacts = array(root.artifacts, "$provenance.artifacts");
  artifacts.forEach((value, index) => {
    const item = record(value, `$provenance.artifacts[${index}]`);
    exactKeys(
      item,
      [
        "logicalArtifactId", "schemaVersion", "mediaType", "byteSize", "sha256", "inputs", "generator",
        "parameters", "generatedAt", "rowCounts", "attribution", "usageNote", "validation",
      ],
      `$provenance.artifacts[${index}]`,
    );
    string(item.logicalArtifactId, "logicalArtifactId");
    string(item.schemaVersion, "schemaVersion");
    literal(item.mediaType, "application/json", "mediaType");
    integer(item.byteSize, "byteSize");
    if (!/^[\da-f]{64}$/u.test(string(item.sha256, "sha256"))) throw new Error("Invalid artifact digest");
    array(item.inputs, "inputs");
    record(item.generator, "generator");
    record(item.parameters, "parameters");
    isoTimestamp(item.generatedAt, "generatedAt");
    record(item.rowCounts, "rowCounts");
    string(item.attribution, "attribution");
    string(item.usageNote, "usageNote");
    literal(item.validation, "PASS", "validation");
  });
}

export function assertGeneratedArtifact(
  logicalArtifactId: string,
  value: unknown,
): void {
  switch (logicalArtifactId) {
    case "forecast-snapshot-v3":
      return assertForecastSnapshotV3(value);
    case "snapshot-evaluation-v3":
      return assertSnapshotEvaluationV3(value);
    case "market-reference-v1":
      return assertMarketReferenceV1(value);
    case "port-traffic-fixture-v1":
      return assertPortTrafficFixtureV1(value);
    case "chokepoint-traffic-fixture-v1":
      return assertChokepointTrafficFixtureV1(value);
    case "network-catalog-seam-v1":
      return assertNetworkCatalogSeamV1(value);
    case "network-catalog-seam-identity-v1":
      return assertNetworkCatalogSeamIdentityV1(value);
    case "fixture-catalog-v1":
      return assertFixtureCatalogV1(value);
    case "news-policy-v18":
      return assertNewsPolicyV18(value);
    case "insight-policy-v1":
      return assertInsightPolicyV1(value);
    case "tuning-config-v1":
      return assertTuningConfigV1(value);
    case "provenance-manifest-v1":
      return assertProvenanceManifestV1(value);
    default:
      record(value, `$${logicalArtifactId}`);
  }
}

export function catalogIdentityFields(value: unknown): {
  readonly catalogSeamSha256: string;
  readonly byteSize: number;
  readonly referenceManifestSha256: string;
} {
  assertNetworkCatalogSeamIdentityV1(value);
  const root = record(value, "$networkIdentity");
  return {
    catalogSeamSha256: string(root.catalogSeamSha256, "catalogSeamSha256"),
    byteSize: integer(root.byteSize, "byteSize"),
    referenceManifestSha256: string(root.referenceManifestSha256, "referenceManifestSha256"),
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const stableBytes = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", stableBytes.buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function assertNetworkCatalogIdentity(
  catalogBytes: Uint8Array,
  catalog: unknown,
  identity: unknown,
): Promise<void> {
  assertNetworkCatalogSeamV1(catalog);
  const fields = catalogIdentityFields(identity);
  const digest = await sha256Hex(catalogBytes);
  if (fields.catalogSeamSha256 !== digest || fields.byteSize !== catalogBytes.byteLength) {
    throw new Error("Network catalog identity does not match canonical bytes");
  }
  const catalogRoot = record(catalog, "$network");
  if (fields.referenceManifestSha256 !== catalogRoot.referenceManifestSha256) {
    throw new Error("Network catalog reference manifest identity mismatch");
  }
}

export async function assertProvenanceManifestIdentity(
  manifestBytes: Uint8Array,
  identity: unknown,
): Promise<void> {
  const root = record(identity, "$provenanceIdentity");
  exactKeys(root, ["schemaVersion", "sha256", "byteSize"], "$provenanceIdentity");
  literal(root.schemaVersion, "move-ai/provenance-manifest-identity/v1", "$provenanceIdentity.schemaVersion");
  const digest = string(root.sha256, "$provenanceIdentity.sha256");
  if (!/^[\da-f]{64}$/u.test(digest)) throw new Error("Invalid provenance manifest digest");
  const byteSize = integer(root.byteSize, "$provenanceIdentity.byteSize");
  const actualDigest = await sha256Hex(manifestBytes);
  if (digest !== actualDigest || byteSize !== manifestBytes.byteLength) {
    throw new Error("Provenance manifest identity does not match canonical bytes");
  }
}
