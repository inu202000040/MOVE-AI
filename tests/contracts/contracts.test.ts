import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_GATEWAY_METHODS,
  DATA_MODES,
  DEFAULT_ROUTE_ID,
  GATEWAY_CACHE_KEYS,
  GATEWAY_ERROR_DETAIL_KEYS,
  GATEWAY_ERROR_KEYS,
  GATEWAY_META_KEYS,
  GATEWAY_ROOT_KEYS,
  GATEWAY_SCHEMA_VERSION,
  PAGE_PATHS,
  ROUTE_IDS,
  ROUTE_LABELS,
  STORAGE_KEYS,
  isGatewaySchemaVersion,
  isRouteId,
} from "../../app/contracts";

test("freezes the documented route catalog and default", () => {
  assert.deepEqual(ROUTE_IDS, [
    "KUWI", "KUEI", "KNEI", "KMDI", "KMEI", "KAUI", "KLEI",
    "KLWI", "KSAI", "KWAI", "KCI", "KJI", "KSEI",
  ]);
  assert.equal(DEFAULT_ROUTE_ID, "KNEI");
  assert.deepEqual(Object.values(ROUTE_LABELS), [
    "북미서안", "북미동안", "유럽", "지중해", "중동", "호주", "남미동안",
    "남미서안", "남아프리카", "서아프리카", "중국", "일본", "동남아",
  ]);
  assert.equal(isRouteId("KNEI"), true);
  assert.equal(isRouteId("knei"), false);
  assert.equal(isRouteId("KNEI-extra"), false);
});

test("freezes the five documented page paths", () => {
  assert.deepEqual(PAGE_PATHS, {
    landing: "/",
    dashboard: "/freight-risk/dashboard",
    models: "/freight-risk/models",
    network: "/freight-risk/network",
    allocation: "/freight-risk/allocation",
  });
});

test("freezes storage ownership keys and prefixes", () => {
  assert.deepEqual(STORAGE_KEYS, {
    route: "move-ai:route:v1",
    representativePrefix: "move-ai:representative:v1:",
    tuningPrefix: "move-ai:tuning:v1:",
    routeNewsPrefix: "move-ai:route-news:v1:",
    forecastInsightPrefix: "move-ai:forecast-insight:v1:",
  });
});

test("freezes the gateway envelope surface and method manifest", () => {
  assert.equal(GATEWAY_SCHEMA_VERSION, "move-ai/gateway/v1");
  assert.equal(isGatewaySchemaVersion("move-ai/gateway/v1"), true);
  assert.equal(
    isGatewaySchemaVersion("move-ai/gateway-v1"),
    false,
    "the superseded bootstrap schema literal must stay rejected",
  );
  assert.deepEqual(DATA_MODES, [
    "live", "fixture", "cached", "unavailable",
  ]);
  assert.equal(new Set<string>(DATA_MODES).has("reference"), false);
  assert.deepEqual(GATEWAY_ROOT_KEYS, [
    "schemaVersion", "state", "data", "error", "meta",
  ]);
  assert.deepEqual(GATEWAY_ERROR_KEYS, [
    "code", "message", "retryable", "upstreamStatus", "details",
  ]);
  assert.deepEqual(GATEWAY_ERROR_DETAIL_KEYS, ["reasonCode"]);
  assert.deepEqual(GATEWAY_META_KEYS, [
    "mode", "source", "sourceUrl", "asOf", "fetchedAt", "unit",
    "isEstimate", "attribution", "warnings", "provider", "cache",
  ]);
  assert.deepEqual(GATEWAY_CACHE_KEYS, ["hit", "stale", "ageSeconds"]);
  assert.deepEqual(DATA_GATEWAY_METHODS, [
    "snapshot", "market", "news", "insight", "tuningHealth", "tune",
    "portSummary", "portDetail", "chokeSummary", "chokeDetail", "weather",
  ]);
});
