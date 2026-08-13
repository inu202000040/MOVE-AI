import { readFile } from "node:fs/promises";

export async function readGoldenManifest() {
  return JSON.parse(await readFile(new URL("../../../qa/goldens/approved-v1.json", import.meta.url), "utf8"));
}
