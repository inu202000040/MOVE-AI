import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { build } from "vite";

const ROOT = process.cwd();
const CLIENT_ENTRY = path.join(ROOT, "app/data/runtime/data-gateway.client.ts");
const BUNDLE_ENTRY = path.join(ROOT, "tests/wt6/fixtures/data-gateway-client-entry.ts");
const MAX_CLIENT_BYTES = 500_000;

async function resolveModule(importer: string, specifier: string): Promise<string | null> {
  if (!specifier.startsWith(".")) return null;
  const target = path.resolve(path.dirname(importer), specifier);
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}.json`, path.join(target, "index.ts")]) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // Continue through supported local module suffixes.
    }
  }
  throw new Error(`Cannot resolve ${specifier} from ${importer}`);
}

async function transitiveModules(entry: string): Promise<readonly string[]> {
  const pending = [entry];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (!/\.[cm]?[jt]sx?$/u.test(current)) continue;
    const source = await readFile(current, "utf8");
    const imports = ts.preProcessFile(source, true, true).importedFiles;
    for (const imported of imports) {
      const resolved = await resolveModule(current, imported.fileName);
      if (resolved && !visited.has(resolved)) pending.push(resolved);
    }
  }
  return [...visited].sort();
}

type BuiltOutput =
  | { readonly type: "chunk"; readonly code: string }
  | { readonly type: "asset"; readonly source: string | Uint8Array };

function outputBytes(output: BuiltOutput): number {
  if (output.type === "chunk") return Buffer.byteLength(output.code);
  return typeof output.source === "string" ? Buffer.byteLength(output.source) : output.source.byteLength;
}

function isBuildOutput(value: unknown): value is { readonly output: readonly BuiltOutput[] } {
  return typeof value === "object" && value !== null && "output" in value && Array.isArray(value.output);
}

test("client gateway transitive graph excludes generated artifacts and fixture gateway", async () => {
  const modules = await transitiveModules(CLIENT_ENTRY);
  const normalized = modules.map((file) => path.relative(ROOT, file).replaceAll("\\", "/"));
  assert.ok(normalized.length > 1, "dependency walk must include transitive modules");
  assert.deepEqual(normalized.filter((file) => file.includes("/generated/") || file.endsWith("/fixture-gateway.ts")), []);
});

test("minimal use-client gateway bundle remains below the multi-megabyte regression ceiling", async (context) => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: "esbuild",
      target: "es2022",
      lib: { entry: BUNDLE_ENTRY, formats: ["es"], fileName: "data-gateway-client" },
    },
  });
  const candidates: readonly unknown[] = Array.isArray(result) ? result : [result];
  assert.ok(candidates.every(isBuildOutput), "Vite build must return emitted output");
  const outputs = candidates.filter(isBuildOutput);
  const emitted = outputs.flatMap((item) => item.output);
  const clientBytes = emitted.reduce((total, output) => total + outputBytes(output), 0);
  context.diagnostic(`client gateway bundle bytes: ${clientBytes}`);
  assert.ok(clientBytes > 0, "client bundle must emit code");
  assert.ok(clientBytes < MAX_CLIENT_BYTES, `client bundle ${clientBytes} bytes exceeds ${MAX_CLIENT_BYTES}`);
  const bundledText = emitted.map((output) => output.type === "chunk" ? output.code : "").join("\n");
  for (const forbidden of ["forecast-snapshot-v3", "port-traffic-fixture-v1", "chokepoint-traffic-fixture-v1", "market-reference-v1"]) {
    assert.equal(bundledText.includes(forbidden), false, `client bundle contains ${forbidden}`);
  }
});
