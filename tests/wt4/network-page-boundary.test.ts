import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Network client uses shared route state and only the lightweight HTTP gateway entry", async () => {
  const source = await readFile(
    path.join(root, "app/freight-risk/network/NetworkPageClient.tsx"),
    "utf8",
  );
  assert.match(source, /useFreightRiskRoute\(\)/);
  assert.doesNotMatch(source, /localStorage|ROUTE_CHANGE_EVENT|new URL\(window\.location/);
  assert.match(source, /data-gateway\.client/);
  assert.match(source, /createSameOriginDataGatewayV1\(\)/);
  assert.doesNotMatch(source, /data-gateway\.server|validatedArtifactSeamV1/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("Network page passes only validated artifact values through the server boundary", async () => {
  const source = await readFile(
    path.join(root, "app/freight-risk/network/page.tsx"),
    "utf8",
  );
  assert.match(source, /initialCatalogArtifacts/);
  assert.match(source, /data-gateway\.server/);
  assert.doesNotMatch(source, /data-gateway\.client/);
  assert.doesNotMatch(source, /dataGateway=/);
});

test("2D fallback renders the canonical connector collection rather than a private copy", async () => {
  const source = await readFile(
    path.join(root, "app/freight-risk/network/NetworkPageClient.tsx"),
    "utf8",
  );
  assert.match(source, /catalogToNetworkGeoJson\(catalog\)\["network-connectors"\]/);
  assert.match(source, /data-network-connector="true"/);
});
