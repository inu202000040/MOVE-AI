import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEFAULT_ROUTE_ID, PAGE_PATHS, ROUTE_IDS, ROUTE_LABELS, STORAGE_KEYS, isRouteId } from "../../app/contracts";
import { readGoldenManifest } from "./lib/manifest";

const manifest = await readGoldenManifest();
const expected = manifest.contracts.routeStorage;

function resolveRoute(query: unknown, stored: unknown) {
  if (isRouteId(query)) return { routeId: query, source: "valid-query" };
  if (isRouteId(stored)) return { routeId: stored, source: "valid-storage" };
  return { routeId: DEFAULT_ROUTE_ID, source: "KNEI" };
}

test("route and storage exports match the approved clean-room manifest", () => {
  assert.deepEqual(ROUTE_IDS, expected.routeIds);
  assert.deepEqual(ROUTE_LABELS, expected.routeLabels);
  assert.equal(DEFAULT_ROUTE_ID, expected.defaultRouteId);
  assert.deepEqual(STORAGE_KEYS, expected.keys);
  assert.deepEqual(PAGE_PATHS, {
    landing: "/",
    dashboard: "/freight-risk/dashboard",
    models: "/freight-risk/models",
    network: "/freight-risk/network",
    allocation: "/freight-risk/allocation",
  });
});

test("route resolution is exact query then exact storage then KNEI", () => {
  assert.deepEqual(resolveRoute("KMEI", "KNEI"), { routeId: "KMEI", source: "valid-query" });
  assert.deepEqual(resolveRoute("kmei", "KMEI"), { routeId: "KMEI", source: "valid-storage" });
  assert.deepEqual(resolveRoute("KNEI-extra", "bad"), { routeId: "KNEI", source: "KNEI" });
  assert.deepEqual(expected.initialPriority, ["valid-query", "valid-storage", "KNEI"]);
  assert.deepEqual(expected.changeTransaction, ["shared-state", "storage", "replace-query", "shared-publication"]);
});

test("approved specifications do not retain legacy storage owners", async () => {
  const specNames = ["WT1_FOUNDATION_LANDING.md", "WT2_DASHBOARD.md", "WT3_MODELS.md", "WT4_NETWORK.md", "WT5_ALLOCATION.md", "WT6_DATA_API.md"];
  const sources = await Promise.all(specNames.map((name) => readFile(new URL(`../../docs/specs/${name}`, import.meta.url), "utf8")));
  for (const source of sources) {
    assert.doesNotMatch(source, /freight-risk-route|glovis-freight-risk:/u);
  }
});
