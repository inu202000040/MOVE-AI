import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const APP_DIRECTORY = path.resolve("app");
const DOCUMENT_ELEMENT = /<(?:html|head|body|iframe)(?:\s|>)/gi;

async function collectTsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
  }));
  return files.flat();
}

test("keeps html and body ownership exclusively in the application root layout", async () => {
  const rootLayoutPath = path.join(APP_DIRECTORY, "layout.tsx");
  const rootLayout = await readFile(rootLayoutPath, "utf8");

  assert.equal((rootLayout.match(/<html(?:\s|>)/g) ?? []).length, 1);
  assert.equal((rootLayout.match(/<body(?:\s|>)/g) ?? []).length, 1);

  const nestedFiles = (await collectTsxFiles(APP_DIRECTORY))
    .filter((filePath) => filePath !== rootLayoutPath);

  for (const filePath of nestedFiles) {
    const source = await readFile(filePath, "utf8");
    assert.equal(
      DOCUMENT_ELEMENT.test(source),
      false,
      `${path.relative(APP_DIRECTORY, filePath)} must reuse the root document`,
    );
    DOCUMENT_ELEMENT.lastIndex = 0;
  }
});
