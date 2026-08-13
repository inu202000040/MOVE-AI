import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

type Asset = {
  id: string;
  path: string;
  nodeId: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  role: "reference-ready" | "reference-state";
};

type Viewport = {
  id: string;
  width: number;
  height: number;
  level: "primary" | "smoke";
};

type StateGroup = {
  id: string;
  interaction: string;
};

type Page = {
  id: string;
  worktree: string;
  route: string;
  url: string;
  compositionReferences: Record<string, string>;
};

type Manifest = {
  schemaVersion: string;
  figmaSourceCommit: string;
  policyCommit: string;
  authority: {
    visualPassAuthority: string;
    browserEvidenceRequired: boolean;
    figmaMismatchAloneIsFinding: boolean;
    figmaRevisionBlocksBuilders: boolean;
    implementationSpecs: {
      status: string;
      soleAuthority: boolean;
    };
    evaluationDimensions: string[];
  };
  figma: {
    fileKey: string;
    status: string;
    use: string;
    pixelParityAuthority: boolean;
    mismatchAloneIsFinding: boolean;
    blocksBuilders: boolean;
  };
  assets: Asset[];
  viewports: Viewport[];
  stateGroups: StateGroup[];
  pages: Page[];
  evidence: {
    root: string;
    imagePattern: string;
    diffPattern: string;
    videoPattern: string;
    computedPattern: string;
    figmaReferenceRequiredForPass: boolean;
    pixelDiffRequiredForPass: boolean;
    statusBeforeCapture: string;
  };
};

const repositoryRoot = process.cwd();
const manifestPath = path.join(repositoryRoot, "qa", "visual-baseline.manifest.json");
const baselineDocumentPath = path.join(repositoryRoot, "docs", "03_FIGMA_DESIGN_BASELINE.md");
const matrixDocumentPath = path.join(repositoryRoot, "docs", "qa", "VISUAL_QA_MATRIX.md");

async function loadManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(bytes.subarray(0, 8).equals(signature), "invalid PNG signature");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR", "missing PNG IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function substitute(pattern: string, values: Record<string, string>): string {
  return pattern.replaceAll(/\{([a-z]+)\}/g, (_match, key: string) => {
    assert.ok(values[key], `missing evidence token ${key}`);
    return values[key];
  });
}

test("docs/specs authority and Figma reference-only policy are machine-enforced", async () => {
  const manifest = await loadManifest();
  const matrixDocument = await readFile(matrixDocumentPath, "utf8");

  assert.equal(manifest.schemaVersion, "move-ai/visual-qa/v2");
  assert.equal(manifest.figmaSourceCommit, "2c83561796b8014ea686db6e7a4c8a8ebd91eb8b");
  assert.equal(manifest.policyCommit, "66cc07ebfed57619f2125ba6dcd31a54c5938024");
  assert.equal(manifest.authority.visualPassAuthority, "docs/specs");
  assert.equal(manifest.authority.browserEvidenceRequired, true);
  assert.equal(manifest.authority.figmaMismatchAloneIsFinding, false);
  assert.equal(manifest.authority.figmaRevisionBlocksBuilders, false);
  assert.deepEqual(manifest.authority.implementationSpecs, {
    status: "REMOVED_BY_POLICY",
    soleAuthority: false,
  });
  assert.deepEqual(manifest.authority.evaluationDimensions, [
    "structure",
    "information-density",
    "required-ui",
    "states",
    "interactions",
    "responsiveness",
    "concept-tokens",
  ]);
  assert.equal(manifest.figma.status, "REFERENCE_ONLY");
  assert.equal(manifest.figma.use, "rough-composition-flow-only");
  assert.equal(manifest.figma.pixelParityAuthority, false);
  assert.equal(manifest.figma.mismatchAloneIsFinding, false);
  assert.equal(manifest.figma.blocksBuilders, false);
  assert.equal(manifest.evidence.figmaReferenceRequiredForPass, false);
  assert.equal(manifest.evidence.pixelDiffRequiredForPass, false);

  for (const requiredText of [
    "normative visual and UX contract",
    "REFERENCE_ONLY",
    "A mismatch with Figma alone is never a finding",
    "exact required cards, charts, KPIs",
    "1440x900 and 375x812 primary review",
    "900x900 and 640x900 breakpoint/overflow smoke",
    "#f1f2f9",
    "#001290",
    "#15269d",
    "#3fa1eb",
  ]) {
    assert.ok(matrixDocument.includes(requiredText), `matrix missing policy text: ${requiredText}`);
  }
});

test("reference-only Figma PNG bytes, hashes, dimensions, and frame IDs stay frozen", async () => {
  const manifest = await loadManifest();
  const baselineDocument = await readFile(baselineDocumentPath, "utf8");
  const assetIds = new Set<string>();
  const nodeIds = new Set<string>();

  assert.equal(manifest.figma.fileKey, "RvydVRm2bD59KlTzfemK7F");
  assert.equal(manifest.assets.length, 13);

  for (const asset of manifest.assets) {
    assert.match(asset.id, /^[a-z0-9-]+$/);
    assert.match(asset.nodeId, /^\d+:\d+$/);
    assert.ok(!assetIds.has(asset.id), `duplicate asset id ${asset.id}`);
    assert.ok(!nodeIds.has(asset.nodeId), `duplicate Figma node ${asset.nodeId}`);
    assetIds.add(asset.id);
    nodeIds.add(asset.nodeId);

    const fileBytes = await readFile(path.join(repositoryRoot, asset.path));
    const dimensions = pngDimensions(fileBytes);
    assert.equal(fileBytes.byteLength, asset.bytes, `${asset.path} byte count`);
    assert.equal(createHash("sha256").update(fileBytes).digest("hex"), asset.sha256, `${asset.path} SHA-256`);
    assert.deepEqual(dimensions, { width: asset.width, height: asset.height }, `${asset.path} dimensions`);

    assert.ok(baselineDocument.includes(`\`${path.basename(asset.path)}\``), `${asset.path} missing from baseline table`);
    assert.ok(baselineDocument.includes(`\`${asset.sha256}\``), `${asset.path} hash missing from baseline table`);
    assert.ok(baselineDocument.includes(`\`${asset.nodeId}\``), `${asset.nodeId} missing from frame inventory`);
  }
});

test("primary and smoke viewport policy expands to exactly 120 pending cells", async () => {
  const manifest = await loadManifest();
  const expectedViewports = [
    ["1440x900", "primary"],
    ["375x812", "primary"],
    ["900x900", "smoke"],
    ["640x900", "smoke"],
  ];
  assert.deepEqual(
    manifest.viewports.map(({ id, level }) => [id, level]),
    expectedViewports,
  );
  assert.equal(manifest.pages.length, 5);
  assert.equal(manifest.stateGroups.length, 6);
  assert.equal(manifest.pages.length * manifest.stateGroups.length * manifest.viewports.length, 120);
  assert.equal(manifest.evidence.statusBeforeCapture, "PENDING_CANDIDATE");

  const assetIds = new Set(manifest.assets.map(({ id }) => id));
  for (const page of manifest.pages) {
    assert.match(page.worktree, /^wt[1-5]$/);
    assert.match(page.route, /^[A-Z0-9]+$/);
    assert.ok(page.url.startsWith("/"));
    assert.deepEqual(Object.keys(page.compositionReferences).sort(), ["1440x900", "375x812"].sort());
    for (const assetId of Object.values(page.compositionReferences)) {
      assert.ok(assetIds.has(assetId), `${page.id} references missing composition image ${assetId}`);
    }
  }
});

test("evidence names are deterministic and confined to the owning WT", async () => {
  const manifest = await loadManifest();
  const filenamePattern = /^[A-Z0-9]+-[a-z0-9-]+-(1440x900|375x812|900x900|640x900)-[a-z0-9-]+(?:-diff)?\.png$/;

  for (const page of manifest.pages) {
    for (const state of manifest.stateGroups) {
      for (const viewport of manifest.viewports) {
        const values = {
          route: page.route,
          state: state.id,
          viewport: viewport.id,
          interaction: state.interaction,
        };
        const image = substitute(manifest.evidence.imagePattern, values);
        const diff = substitute(manifest.evidence.diffPattern, values);
        assert.match(image, filenamePattern);
        assert.match(diff, filenamePattern);
        assert.equal(
          path.posix.join(manifest.evidence.root, page.worktree, "candidate", image),
          `evidence/${page.worktree}/candidate/${image}`,
        );
        assert.equal(
          path.posix.join(manifest.evidence.root, page.worktree, "diff", diff),
          `evidence/${page.worktree}/diff/${diff}`,
        );
      }
    }
  }
});

test("reference state images remain explicit and page-ready references stay complete", async () => {
  const manifest = await loadManifest();
  const stateReferences = manifest.assets.filter(({ role }) => role === "reference-state").map(({ id }) => id).sort();
  assert.deepEqual(stateReferences, [
    "allocation-data-input-640x812",
    "network-fallback-375x812",
    "runtime-states-1440x900",
  ]);
  assert.equal(manifest.assets.filter(({ role }) => role === "reference-ready").length, 10);
  assert.equal(manifest.assets.some(({ width, height }) => width === 900 && height === 900), false);
  assert.equal(manifest.assets.some(({ width, height }) => width === 640 && height === 900), false);
});
