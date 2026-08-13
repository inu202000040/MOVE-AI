import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { discoverFeatureTestFiles } from "../../scripts/run-feature-tests";

test("recursively discovers feature suites and excludes contract/bootstrap suites", async () => {
  const root = await mkdtemp(join(tmpdir(), "move ai feature discovery "));
  const testsRoot = join(root, "tests");
  const files = [
    "allocation/deep/allocation.test.ts",
    "dashboard/dashboard.spec.tsx",
    "wt4/network.test.mts",
    "contracts/contracts.test.ts",
    "bootstrap/manifest.test.ts",
    "wt5/notes.ts",
  ] as const;

  try {
    await Promise.all(files.map(async (file) => {
      const absoluteFile = join(testsRoot, file);
      await mkdir(resolve(absoluteFile, ".."), { recursive: true });
      await writeFile(absoluteFile, "export {};\n", "utf8");
    }));

    const discovered = await discoverFeatureTestFiles(testsRoot);
    assert.deepEqual(discovered, [
      resolve(testsRoot, "allocation/deep/allocation.test.ts"),
      resolve(testsRoot, "dashboard/dashboard.spec.tsx"),
      resolve(testsRoot, "wt4/network.test.mts"),
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
