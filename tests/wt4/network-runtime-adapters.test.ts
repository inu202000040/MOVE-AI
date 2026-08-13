import assert from "node:assert/strict";
import test from "node:test";

import { decodeNetworkCatalogSeam } from "../../app/freight-risk/network/core/catalog-consumer";
import { APPROVED_REFERENCE_CATALOG } from "../../app/freight-risk/network/data/approved-reference-fixture";
import { createReferenceCatalogAdapter } from "../../app/freight-risk/network/data/network-catalog-adapter";
import {
  createUnavailableNetworkGateway,
  resolveNetworkResource,
} from "../../app/freight-risk/network/data/network-domain-adapter";

test("approved clean-room fixture validates as the complete 13/57/11/82 catalog", async () => {
  const decoded = decodeNetworkCatalogSeam(APPROVED_REFERENCE_CATALOG);
  assert.ok(decoded);
  assert.equal(decoded.routes.length, 13);
  assert.equal(decoded.ports.length, 57);
  assert.equal(decoded.chokepoints.length, 11);
  assert.equal(decoded.weather.length, 82);
  assert.equal(
    new Set(decoded.ports.map(({ upstreamPortWatchId }) => upstreamPortWatchId)).size,
    56,
  );

  const adapter = createReferenceCatalogAdapter({
    catalog: APPROVED_REFERENCE_CATALOG,
    source: "approved-data-pack:test",
    attribution: "approved fixture",
    asOf: APPROVED_REFERENCE_CATALOG.capturedAt,
  });
  const result = await adapter.load();
  assert.equal(result.state, "READY");
  if (result.state !== "READY") return;
  assert.equal(result.mode, "fixture");
  assert.equal(result.identity, null);
});

test("interim domain adapter is truthful UNAVAILABLE for exact network queries", async () => {
  const gateway = createUnavailableNetworkGateway();
  const [portSummary, portDetail, chokeSummary, chokeDetail, weather] =
    await Promise.all([
      gateway.portSummary(),
      gateway.portDetail({ id: "USLAX", days: 90 }),
      gateway.chokeSummary(),
      gateway.chokeDetail({ id: "suez-canal" }),
      gateway.weather(),
    ]);

  for (const result of [
    portSummary,
    portDetail,
    chokeSummary,
    chokeDetail,
    weather,
  ]) {
    assert.equal(result.state, "UNAVAILABLE");
    assert.equal(result.data, null);
    assert.equal(result.meta.mode, "unavailable");
    assert.equal(result.error?.code, "UPSTREAM_UNAVAILABLE");
    assert.equal(resolveNetworkResource(result, 1).status, "error");
  }
});

test("reference adapter rejects malformed catalog input instead of casting", async () => {
  const adapter = createReferenceCatalogAdapter({
    catalog: { ...APPROVED_REFERENCE_CATALOG, weather: [] },
    source: "approved-data-pack:test",
    attribution: "approved fixture",
    asOf: APPROVED_REFERENCE_CATALOG.capturedAt,
  });
  const result = await adapter.load();
  assert.deepEqual(result, {
    state: "UNAVAILABLE",
    code: "CATALOG_CONTRACT_MISMATCH",
    retryable: false,
    issues: ["CATALOG_STRUCTURE_INVALID"],
  });
});
