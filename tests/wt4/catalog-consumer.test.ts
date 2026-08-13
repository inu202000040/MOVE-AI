import assert from "node:assert/strict";
import test from "node:test";

import { ROUTE_IDS } from "../../app/contracts/routes";
import {
  NETWORK_CHOKEPOINT_IDS,
  NETWORK_CATALOG_COUNTS,
  sha256Hex,
  validateNetworkCatalogHandoff,
  type NetworkCatalogHandoff,
} from "../../app/freight-risk/network/core/catalog-consumer";

const encoder = new TextEncoder();
function createCatalog(referenceManifestSha256: string) {
  const routeIds = [...ROUTE_IDS].sort();
  const ports = Array.from({ length: NETWORK_CATALOG_COUNTS.ports }, (_, index) => ({
    id: `port-${index.toString().padStart(2, "0")}`,
    routeId: routeIds[index % routeIds.length]!,
    longitude: -170 + index * 5,
    latitude: -60 + index * 2,
    upstreamPortWatchId: `series-${Math.min(index, 55).toString().padStart(2, "0")}`,
    primary: index < routeIds.length,
  }));
  const routes = routeIds.map((id, index) => ({
    id,
    primaryPortId: ports[index]!.id,
    waypointCoordinates: [
      [129.04, 35.1],
      [ports[index]!.longitude, ports[index]!.latitude],
    ],
  }));
  const chokepoints = NETWORK_CHOKEPOINT_IDS.map((id, index) => ({
    id,
    longitude: -150 + index * 25,
    latitude: -50 + index * 10,
    upstreamPortWatchId: `choke-series-${index.toString().padStart(2, "0")}`,
  }));
  const weather = [
    ...ports.map((port) => ({
      id: `port:${port.id}`,
      kind: "port" as const,
      entityId: port.id,
      longitude: port.longitude,
      latitude: port.latitude,
    })),
    {
      id: "port:BUSAN",
      kind: "port" as const,
      entityId: "BUSAN",
      longitude: 129.04,
      latitude: 35.1,
    },
    ...chokepoints.map((chokepoint) => ({
      id: `chokepoint:${chokepoint.id}`,
      kind: "chokepoint" as const,
      entityId: chokepoint.id,
      longitude: chokepoint.longitude,
      latitude: chokepoint.latitude,
    })),
    ...routeIds.map((routeId, index) => ({
      id: `route:${routeId}`,
      kind: "route" as const,
      entityId: routeId,
      longitude: 120 + index,
      latitude: 10 + index,
    })),
  ].sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: "network-catalog-seam/v1" as const,
    capturedAt: "2026-08-13T00:00:00+09:00",
    timezone: "Asia/Seoul" as const,
    referenceManifestSha256,
    routes,
    ports,
    chokepoints,
    weather,
  };
}

async function buildHandoff(
  catalogTransform?: (catalog: ReturnType<typeof createCatalog>) => unknown,
): Promise<{
  catalog: ReturnType<typeof createCatalog>;
  handoff: NetworkCatalogHandoff;
}> {
  const referenceManifestBytes = encoder.encode(
    '{"schemaVersion":"approved-manifest/v1"}\n',
  );
  const referenceManifestSha256 = await sha256Hex(referenceManifestBytes);
  const catalog = createCatalog(referenceManifestSha256);
  const serializedCatalog = catalogTransform?.(catalog) ?? catalog;
  const catalogBytes = encoder.encode(`${JSON.stringify(serializedCatalog)}\n`);
  const catalogSeamSha256 = await sha256Hex(catalogBytes);
  const identity = {
    schemaVersion: "network-catalog-seam-identity/v1",
    catalogSeamSha256,
    byteSize: catalogBytes.byteLength,
    routeCount: NETWORK_CATALOG_COUNTS.routes,
    portCount: NETWORK_CATALOG_COUNTS.ports,
    uniquePortSeriesCount: NETWORK_CATALOG_COUNTS.uniquePortSeries,
    chokepointCount: NETWORK_CATALOG_COUNTS.chokepoints,
    weatherCount: NETWORK_CATALOG_COUNTS.weather,
    referenceManifestSha256,
  };
  return {
    catalog,
    handoff: {
      catalogBytes,
      identity,
      producerByteSize: catalogBytes.byteLength,
      referenceManifestBytes,
    },
  };
}

test("canonical 13/57/11/82 handoff with 56 unique series is compatible", async () => {
  const { handoff } = await buildHandoff();
  const result = await validateNetworkCatalogHandoff(handoff);
  assert.equal(result.compatible, true);
  if (!result.compatible) return;
  assert.equal(result.catalog.routes.length, 13);
  assert.equal(result.catalog.ports.length, 57);
  assert.equal(result.catalog.chokepoints.length, 11);
  assert.equal(result.catalog.weather.length, 82);
  assert.equal(
    new Set(result.catalog.ports.map(({ upstreamPortWatchId }) => upstreamPortWatchId))
      .size,
    56,
  );
});

test("raw seam bytes are hashed without newline normalization", async () => {
  const { handoff } = await buildHandoff();
  const changedBytes = Uint8Array.from(handoff.catalogBytes);
  changedBytes[changedBytes.length - 1] = 32;
  const result = await validateNetworkCatalogHandoff({
    ...handoff,
    catalogBytes: changedBytes,
  });
  assert.equal(result.compatible, false);
  if (result.compatible) return;
  assert.ok(result.issues.includes("CATALOG_DIGEST_MISMATCH"));
});

test("manifest exact-byte digest must match catalog and identity", async () => {
  const { handoff } = await buildHandoff();
  const result = await validateNetworkCatalogHandoff({
    ...handoff,
    referenceManifestBytes: encoder.encode("different approved manifest bytes"),
  });
  assert.equal(result.compatible, false);
  if (result.compatible) return;
  assert.ok(result.issues.includes("REFERENCE_MANIFEST_MISMATCH"));
});

test("extra keys and out-of-range coordinates fail structural validation", async (t) => {
  await t.test("extra root key", async () => {
    const { handoff } = await buildHandoff((catalog) => ({
      ...catalog,
      unexpected: true,
    }));
    const result = await validateNetworkCatalogHandoff(handoff);
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.ok(result.issues.includes("CATALOG_STRUCTURE_INVALID"));
  });

  await t.test("coordinate outside canonical range", async () => {
    const { handoff } = await buildHandoff((catalog) => {
      catalog.ports[0]!.longitude = 181;
      return catalog;
    });
    const result = await validateNetworkCatalogHandoff(handoff);
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.ok(result.issues.includes("CATALOG_STRUCTURE_INVALID"));
  });
});

test("array order, primary relationship, and identity counts fail closed", async (t) => {
  await t.test("array order", async () => {
    const { handoff } = await buildHandoff((catalog) => {
      [catalog.ports[0], catalog.ports[1]] = [catalog.ports[1]!, catalog.ports[0]!];
      return catalog;
    });
    const result = await validateNetworkCatalogHandoff(handoff);
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.ok(result.issues.includes("CATALOG_STRUCTURE_INVALID"));
  });

  await t.test("primary relationship", async () => {
    const { handoff } = await buildHandoff((catalog) => {
      catalog.routes[0]!.primaryPortId = "port-56";
      return catalog;
    });
    const result = await validateNetworkCatalogHandoff(handoff);
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.ok(result.issues.includes("CATALOG_STRUCTURE_INVALID"));
  });

  await t.test("identity count", async () => {
    const { handoff } = await buildHandoff();
    assert.ok(
      typeof handoff.identity === "object" &&
        handoff.identity !== null &&
        !Array.isArray(handoff.identity),
    );
    const identity = { ...handoff.identity, routeCount: 12 };
    const result = await validateNetworkCatalogHandoff({ ...handoff, identity });
    assert.equal(result.compatible, false);
    if (!result.compatible) assert.ok(result.issues.includes("COUNT_MISMATCH"));
  });
});
