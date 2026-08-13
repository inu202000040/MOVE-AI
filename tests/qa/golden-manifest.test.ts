import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { canonicalJson, sha256 } from "./lib/canonical-json";
import { readGoldenManifest } from "./lib/manifest";

const manifest = await readGoldenManifest();
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const dataPackRoot = process.env.MOVE_AI_APPROVED_DATA_PACK
  ?? resolve(repoRoot, "../../MOVE_AI_DATA_PACK/APP_USED_DATA");
const approvedSpecs = manifest.authority.specs as Readonly<Record<string, string>>;
const approvedDataPack = manifest.authority.dataPack as Readonly<Record<string, { readonly byteSize: number; readonly sha256: string }>>;

interface NetworkCatalogRow {
  readonly id: string;
  readonly upstreamPortWatchId?: string;
}

interface NetworkCatalogFixture {
  readonly routes: readonly NetworkCatalogRow[];
  readonly ports: readonly NetworkCatalogRow[];
  readonly chokepoints: readonly NetworkCatalogRow[];
  readonly weather: readonly NetworkCatalogRow[];
  readonly referenceManifestSha256: string;
  readonly [key: string]: readonly NetworkCatalogRow[] | string;
}

test("golden manifest is pinned to the exact approved specs and data pack", async () => {
  assert.equal(manifest.schemaVersion, "move-ai/qa-golden-manifest/v1");
  assert.equal(manifest.authority.quarantinedReferenceRead, false);
  for (const [relativePath, expectedHash] of Object.entries(approvedSpecs)) {
    assert.equal(sha256(await readFile(resolve(repoRoot, relativePath))), expectedHash);
  }
  for (const [filename, identity] of Object.entries(approvedDataPack)) {
    const bytes = await readFile(resolve(dataPackRoot, filename));
    assert.equal(bytes.byteLength, identity.byteSize, filename);
    assert.equal(sha256(bytes), identity.sha256, filename);
  }
});

test("model golden freezes 13 x 187 x 8 x 4, 52 origins, and inclusive direction boundaries", () => {
  assert.equal(manifest.model.routeCount, 13);
  assert.equal(manifest.model.historyObservationsPerRoute, 187);
  assert.equal(manifest.model.modelIds.length, 8);
  assert.deepEqual(manifest.model.horizonWeeks, [1, 2, 3, 4]);
  assert.equal(manifest.model.forecastRowCount, 416);
  assert.equal(manifest.model.metricRowCount, 416);
  assert.equal(manifest.model.evaluationRowCount, 21632);
  assert.equal(manifest.model.rollingOriginCount, 52);
  assert.equal(manifest.model.unit, "USD/FEU");
  assert.deepEqual(manifest.model.knei.currentObservation, { date: "2026-08-03", value: 4884, unit: "USD/FEU" });
  assert.equal(manifest.model.knei.automaticChampion.modelId, "sarimax");
  assert.deepEqual(manifest.model.knei.forecasts.map((row: { readonly horizonWeeks: number }) => row.horizonWeeks), [1, 2, 3, 4]);
  assert.deepEqual(manifest.model.knei.metricsByHorizon.map((row: { readonly horizonWeeks: number }) => row.horizonWeeks), [1, 2, 3, 4]);
  for (const agreement of manifest.model.knei.modelAgreementByHorizon) {
    assert.equal(agreement.up + agreement.down + agreement.flat, 8);
    assert.equal(agreement.total, 8);
    for (const member of agreement.members) {
      const expectedDirection = member.changePct >= 3 ? "up" : member.changePct <= -3 ? "down" : "flat";
      assert.equal(member.direction, expectedDirection);
    }
  }
  const exactBoundary = (changePct: number) => changePct >= 3 ? "up" : changePct <= -3 ? "down" : "flat";
  assert.equal(exactBoundary(3), "up");
  assert.equal(exactBoundary(-3), "down");
});

test("canonical JSON hash vector is insertion-order stable and rejects non-finite numbers", () => {
  const vector = manifest.model.canonicalHashVector;
  assert.equal(canonicalJson(vector.input), vector.canonicalJson);
  assert.equal(sha256(vector.canonicalJson), vector.sha256);
  assert.equal(vector.representativeRevision, `rep-v1:${vector.sha256}`);
  assert.equal(canonicalJson({ tuple: [4, 3, 2, 1], a: { a: 1, aa: 2, "😀": 3 }, z: 0 }), vector.canonicalJson);
  assert.throws(() => canonicalJson({ invalid: Number.NaN }), /non-finite/u);
});

test("network fixture identity binds raw bytes, received identity byteSize, counts, and approved manifest", async () => {
  const catalogBytes = await readFile(new URL("../../qa/goldens/network-catalog-seam-v1.json", import.meta.url));
  const identity = JSON.parse(await readFile(new URL("../../qa/goldens/network-catalog-seam-identity-v1.json", import.meta.url), "utf8"));
  const catalog = JSON.parse(catalogBytes.toString("utf8")) as NetworkCatalogFixture;
  assert.equal(catalogBytes.byteLength, identity.byteSize);
  assert.equal(createHash("sha256").update(catalogBytes).digest("hex"), identity.catalogSeamSha256);
  assert.deepEqual(identity, manifest.network.identity);
  assert.equal(catalog.routes.length, 13);
  assert.equal(catalog.ports.length, 57);
  assert.equal(new Set(catalog.ports.map((row) => row.upstreamPortWatchId)).size, 56);
  assert.equal(catalog.chokepoints.length, 11);
  assert.equal(catalog.weather.length, 82);
  assert.equal(catalog.referenceManifestSha256, approvedDataPack["12_DATA_MANIFEST.xlsx"].sha256);
  for (const key of ["routes", "ports", "chokepoints", "weather"]) {
    const rows = catalog[key] as readonly NetworkCatalogRow[];
    assert.deepEqual(rows.map((row) => row.id), [...rows.map((row) => row.id)].sort());
  }
});

test("runtime insight contract is Gemini-only with deterministic rules fallback", () => {
  assert.deepEqual(manifest.contracts.insight.runtimeEngines, ["GEMINI", "RULE_FALLBACK"]);
  assert.deepEqual(manifest.contracts.insight.geminiKeys, ["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  assert.deepEqual(manifest.contracts.insight.forbiddenRuntimeProviders, ["OpenAI"]);
});
