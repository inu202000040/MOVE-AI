import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ROUTE_IDS } from "../../app/contracts";
import {
  MODELS_REPRESENTATIVE_PUBLICATION_EVENT,
  publishModelsRepresentativeChange,
  readValidatedModelsRepresentative,
  subscribeModelsRepresentativeChanges,
} from "../../app/freight-risk/models/representative-consumer";
import { loadApprovedModelsCatalog } from "../../app/freight-risk/models/reference-catalog";
import { representativeStorageKey, writeManualRepresentative, type StorageLikeV1 } from "../../app/freight-risk/models/core";

class MemoryStorage implements StorageLikeV1 {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const EXPECTED_CHAMPIONS = {
  KUWI: "timesfm",
  KUEI: "timesfm",
  KNEI: "sarimax",
  KMDI: "timesfm",
  KMEI: "timesfm",
  KAUI: "timesfm",
  KLEI: "sarimax",
  KLWI: "timesfm",
  KSAI: "timesfm",
  KWAI: "sarimax",
  KCI: "sarimax",
  KJI: "timesfm",
  KSEI: "sarimax",
} as const;

test("loads the approved immutable 13-route artifact and validates each representative", () => {
  const artifactBytes = readFileSync(new URL("../../app/freight-risk/models/reference-data/models-snapshot-v3.json", import.meta.url));
  assert.equal(artifactBytes.byteLength, 4_466_219);
  assert.equal(createHash("sha256").update(artifactBytes).digest("hex"), "69a8566d2024ba6f6214e4fb41b6c5a3d5dcf679e8b84a81d608f54e561ff182");

  const catalog = loadApprovedModelsCatalog();
  assert.deepEqual(Object.keys(catalog), [...ROUTE_IDS]);
  for (const route of ROUTE_IDS) {
    const produced = readValidatedModelsRepresentative(catalog[route], new MemoryStorage());
    assert.equal(produced.representative.route, route);
    assert.equal(produced.representative.modelId, EXPECTED_CHAMPIONS[route]);
    assert.equal(produced.representative.modelAgreementByHorizon.length, 4);
    assert.equal(produced.representative.modelAgreementByHorizon.every(({ members }) => members.length === 8), true);
  }
});

test("public consumer seam applies validated storage before publishing the representative", () => {
  const catalog = loadApprovedModelsCatalog();
  const storage = new MemoryStorage();
  writeManualRepresentative(storage, "KNEI", "timesfm", "2026-08-13T04:16:12Z");
  const produced = readValidatedModelsRepresentative(catalog.KNEI, storage);
  assert.equal(produced.storageSnapshot.manualModelId, "timesfm");
  assert.equal(produced.representative.modelId, "timesfm");
  assert.equal(produced.representative.selectionMode, "manual");
  assert.match(produced.representative.representativeRevision, /^rep-v1:[0-9a-f]{64}$/u);

  storage.setItem(representativeStorageKey("KNEI"), "{malformed");
  const recovered = readValidatedModelsRepresentative(catalog.KNEI, storage);
  assert.equal(recovered.representative.modelId, "sarimax");
  assert.equal(storage.getItem(representativeStorageKey("KNEI")), null);
});

test("same-window publications and cross-tab storage changes share one filtered subscription", () => {
  const target = new EventTarget();
  const received: string[] = [];
  const unsubscribe = subscribeModelsRepresentativeChanges(target, "KNEI", (reason) => received.push(reason));

  publishModelsRepresentativeChange(target, "KMEI", "manual");
  publishModelsRepresentativeChange(target, "KNEI", "manual");
  publishModelsRepresentativeChange(target, "KNEI", "keep");
  publishModelsRepresentativeChange(target, "KNEI", "rollback");
  publishModelsRepresentativeChange(target, "KNEI", "automatic");
  target.dispatchEvent(new CustomEvent(MODELS_REPRESENTATIVE_PUBLICATION_EVENT, {
    detail: { route: "KNEI", reason: "invented", extra: true },
  }));
  const storageEvent = new Event("storage");
  Object.defineProperty(storageEvent, "key", { value: representativeStorageKey("KNEI") });
  target.dispatchEvent(storageEvent);
  unsubscribe();
  publishModelsRepresentativeChange(target, "KNEI", "manual");

  assert.deepEqual(received, ["manual", "keep", "rollback", "automatic", "storage"]);
});

test("Models runtime owns no private route or network boundary", () => {
  const clientSource = readFileSync(new URL("../../app/freight-risk/models/ModelsClient.tsx", import.meta.url), "utf8");
  const gatewaySource = readFileSync(new URL("../../app/freight-risk/models/tuning-gateway.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../../app/freight-risk/models/page.tsx", import.meta.url), "utf8");
  assert.match(clientSource, /useFreightRiskRoute/u);
  assert.doesNotMatch(clientSource, /history\.replaceState|\bfetch\s*\(|"KNEI"/u);
  assert.doesNotMatch(gatewaySource, /\bfetch\s*\(|\/api\/freight-risk/u);
  assert.doesNotMatch(pageSource, /tuningGateway=/u);
});

test("base states and narrow-screen accessibility rules remain explicit", () => {
  const stateSource = readFileSync(new URL("../../app/freight-risk/models/ModelsDataState.tsx", import.meta.url), "utf8");
  const chartSource = readFileSync(new URL("../../app/freight-risk/models/ForecastComparisonChart.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../app/freight-risk/models/models.module.css", import.meta.url), "utf8");
  assert.match(stateSource, /"loading" \| "empty" \| "error"/u);
  assert.match(stateSource, /다시 시도/u);
  assert.match(chartSource, /routeName/u);
  assert.doesNotMatch(chartSource, /유럽 항로/u);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*\.dataBasis \{ display: none; \}/u);
  assert.match(css, /\.drawerBody \{ min-height: 0; padding-inline: 14px; overflow-y: auto; \}/u);
  const genericFooterRule = css.indexOf(".drawerFooter button {");
  const primaryFooterRule = css.indexOf(".drawerFooter .primaryButton");
  assert.ok(genericFooterRule >= 0 && primaryFooterRule > genericFooterRule);
  assert.match(css.slice(primaryFooterRule), /background: linear-gradient\(135deg, #1648b8/u);
  assert.match(css.slice(primaryFooterRule), /color: #fff !important/u);
});
