import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";

const EXCLUDED_TOP_LEVEL_DIRECTORIES = new Set(["bootstrap", "contracts"]);
const FEATURE_TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u;

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(entryPath));
    } else if (entry.isFile() && FEATURE_TEST_FILE.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function discoverFeatureTestFiles(testsRoot: string): Promise<string[]> {
  const absoluteTestsRoot = resolve(testsRoot);
  const discovered = await walk(absoluteTestsRoot);

  return discovered
    .filter((file) => {
      const [topLevelDirectory] = relative(absoluteTestsRoot, file).split(sep);
      return !EXCLUDED_TOP_LEVEL_DIRECTORIES.has(topLevelDirectory);
    })
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function runFeatureTestFiles(files: readonly string[], repositoryRoot: string): number {
  if (files.length === 0) {
    process.stdout.write("No feature test suites discovered.\n");
    return 0;
  }

  const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
  for (const file of files) {
    const result = spawnSync(process.execPath, [tsxCli, "--test", file], {
      cwd: repositoryRoot,
      shell: false,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }

  return 0;
}

async function main(): Promise<number> {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const files = await discoverFeatureTestFiles(resolve(repositoryRoot, "tests"));
  return runFeatureTestFiles(files, repositoryRoot);
}

const invokedFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedFile === import.meta.url) {
  process.exitCode = await main();
}
