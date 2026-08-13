import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_FILES = [
  "app/page.tsx",
  "app/freight-risk/dashboard/page.tsx",
  "app/freight-risk/models/page.tsx",
  "app/freight-risk/network/page.tsx",
  "app/freight-risk/allocation/page.tsx",
] as const;

test("the basic route manifest is present", async () => {
  const sources = await Promise.all(
    ROUTE_FILES.map((path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8")),
  );
  assert.equal(sources.length, 5);
  for (const source of sources) {
    assert.match(source, /export default function/u);
  }
});

test("the root layout is the sole html and body owner", async () => {
  const layout = await readFile(
    new URL("../../app/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((layout.match(/<html\b/gu) ?? []).length, 1);
  assert.equal((layout.match(/<body\b/gu) ?? []).length, 1);

  for (const path of ROUTE_FILES) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<\/?(?:html|body)\b/gu);
  }
});
