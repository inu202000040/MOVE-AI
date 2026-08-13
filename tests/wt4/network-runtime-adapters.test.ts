import assert from "node:assert/strict";
import test from "node:test";

import {
  createFixtureDataGatewayV1,
  validatedArtifactSeamV1,
} from "../../app/data/runtime/data-gateway";
import { decodeNetworkCatalogSeam } from "../../app/freight-risk/network/core/catalog-consumer";
import {
  createValidatedArtifactCatalogAdapter,
} from "../../app/freight-risk/network/data/network-catalog-adapter";
import {
  adaptNetworkDataGatewayV1,
  resolveNetworkResource,
} from "../../app/freight-risk/network/data/network-domain-adapter";

test("WT6 canonical artifact validates as 13/57/11/82 with canonical route geometry", async () => {
  const artifacts = await validatedArtifactSeamV1();
  const decoded = decodeNetworkCatalogSeam(artifacts.networkCatalog);
  assert.ok(decoded);
  assert.equal(decoded.routes.length, 13);
  assert.equal(decoded.ports.length, 57);
  assert.equal(decoded.chokepoints.length, 11);
  assert.equal(decoded.weather.length, 82);
  assert.equal(
    new Set(decoded.ports.map(({ upstreamPortWatchId }) => upstreamPortWatchId)).size,
    56,
  );
  assert.ok(decoded.routes.every(({ waypointCoordinates }) => waypointCoordinates.length === 2));
});

test("canonical DataGateway fixture decodes exact network queries and truthful states", async () => {
  const gateway = adaptNetworkDataGatewayV1(createFixtureDataGatewayV1());
  const [portSummary, portDetail, chokeSummary, chokeDetail, weather] =
    await Promise.all([
      gateway.portSummary(),
      gateway.portDetail({ id: "KNEI-RTM", days: 90 }),
      gateway.chokeSummary(),
      gateway.chokeDetail({ id: "suez-canal" }),
      gateway.weather(),
    ]);

  for (const result of [
    portSummary,
    portDetail,
    chokeSummary,
    chokeDetail,
  ]) {
    assert.equal(result.state, "STALE");
    assert.ok(result.data);
    assert.equal(result.meta.mode, "fixture");
    assert.equal(result.error, null);
  }
  assert.equal(resolveNetworkResource(portSummary, 1).status, "ready");
  assert.equal(resolveNetworkResource(portDetail, 1).status, "ready");
  assert.equal(resolveNetworkResource(chokeSummary, 1).status, "ready");
  assert.equal(resolveNetworkResource(chokeDetail, 1).status, "ready");
  assert.equal(portDetail.data?.detail?.portId, "KNEI-RTM");
  assert.equal(portDetail.data?.detail?.points.length, 90);
  assert.equal(chokeDetail.data?.detail?.chokepointId, "suez-canal");
  assert.equal(weather.state, "UNAVAILABLE");
  assert.equal(weather.data, null);
  assert.equal(weather.meta.mode, "unavailable");
  assert.equal(resolveNetworkResource(weather, 1).status, "error");
});

test("validated WT6 artifact seam becomes the canonical Network catalog", async () => {
  const adapter = createValidatedArtifactCatalogAdapter({
    load: validatedArtifactSeamV1,
    source: "network-catalog-seam-v1",
    attribution: "MOVE AI approved data pack",
  });
  const result = await adapter.load();
  assert.equal(result.state, "READY");
  if (result.state !== "READY") return;
  assert.equal(result.mode, "canonical");
  assert.equal(result.catalog.routes.length, 13);
  assert.equal(result.catalog.ports.length, 57);
  assert.equal(result.catalog.chokepoints.length, 11);
  assert.equal(result.catalog.weather.length, 82);
  assert.equal(result.identity?.routeCount, 13);
  assert.equal(
    result.identity?.referenceManifestSha256,
    result.catalog.referenceManifestSha256,
  );
});

test("validated artifact adapter rejects malformed catalog input instead of casting", async () => {
  const artifacts = await validatedArtifactSeamV1();
  const adapter = createValidatedArtifactCatalogAdapter({
    load: async () => ({
      networkCatalog: { ...artifacts.networkCatalog, weather: [] },
      networkCatalogIdentity: artifacts.networkCatalogIdentity,
    }),
    source: "approved-data-pack:test",
    attribution: "approved fixture",
  });
  const result = await adapter.load();
  assert.deepEqual(result, {
    state: "UNAVAILABLE",
    code: "CATALOG_CONTRACT_MISMATCH",
    retryable: false,
    issues: ["CATALOG_STRUCTURE_INVALID"],
  });
});
