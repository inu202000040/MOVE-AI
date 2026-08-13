import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("MapLibre runtime, worker, and stylesheet share exact package version 6.3.0", async () => {
  const [packageText, lockText, runtimeText, pageText, clientText] =
    await Promise.all([
      readFile(path.join(root, "package.json"), "utf8"),
      readFile(path.join(root, "package-lock.json"), "utf8"),
      readFile(
        path.join(root, "app/freight-risk/network/core/maplibre-runtime.ts"),
        "utf8",
      ),
      readFile(path.join(root, "app/freight-risk/network/page.tsx"), "utf8"),
      readFile(
        path.join(root, "app/freight-risk/network/NetworkPageClient.tsx"),
        "utf8",
      ),
    ]);
  const packageJson = JSON.parse(packageText) as {
    dependencies?: Record<string, string>;
  };
  const lockJson = JSON.parse(lockText) as {
    packages?: Record<string, { version?: string }>;
  };

  assert.equal(packageJson.dependencies?.["maplibre-gl"], "6.3.0");
  assert.equal(lockJson.packages?.["node_modules/maplibre-gl"]?.version, "6.3.0");
  assert.match(runtimeText, /REQUIRED_MAPLIBRE_VERSION = "6\.3\.0"/);
  assert.match(pageText, /maplibre-gl\/dist\/maplibre-gl\.css/);
  assert.match(clientText, /import\("maplibre-gl"\)/);
  assert.match(
    clientText,
    /import\("maplibre-gl\/dist\/maplibre-gl-worker\.mjs\?url"\)/,
  );
});

test("Network does not ship a second vendored MapLibre runtime", async () => {
  const publicEntries = await readdir(path.join(root, "public"), {
    recursive: true,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  assert.deepEqual(
    publicEntries.filter((entry) => /maplibre/i.test(entry)),
    [],
  );
});
