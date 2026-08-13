import { readFile, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APPROVED_INPUT_BY_ID, APPROVED_INPUTS } from "./approved-inputs";
import {
  assertGeneratedArtifact,
  assertNetworkCatalogIdentity,
  assertProvenanceManifestIdentity,
} from "../../app/data/artifacts/decoders";
import { canonicalJson, sha256 } from "./canonical";
import { produceNetworkCatalog, produceNetworkCatalogIdentity } from "./producers/catalog";
import { produceMarketReference } from "./producers/market";
import {
  produceInsightPolicy,
  produceNewsPolicy,
  produceRuntimeProviderPolicy,
  produceTuningConfig,
} from "./producers/policies";
import { produceForecastArtifacts } from "./producers/snapshot";
import {
  produceChokepointTrafficFixture,
  producePortTrafficFixture,
} from "./producers/traffic";
import { assertExactCount, requireInteger, requireString } from "./schema";
import { readTable, readXlsx, type XlsxWorkbook } from "./xlsx";

export const GENERATOR_ID = "move-ai-clean-room-producer";
export const GENERATOR_VERSION = "1.0.0";
export const DEFAULT_GENERATION_CLOCK = "2026-08-13T00:00:00+09:00";

const PACK_SIDECARS = [
  {
    fileName: "APP_DATA_USAGE_MANIFEST.json",
    sha256: "47f01f91233e63a59207daf154246113a84abb1587bea168f618a83d21798e93",
  },
  {
    fileName: "PACKAGE_MANIFEST.json",
    sha256: "8d35ec037144ef024ceaafbb6cf1266d6d9f74238369f9c013614c8f74825c18",
  },
  {
    fileName: "SHA256SUMS.txt",
    sha256: "25f678142dce948bca64809bb7043422d0e0eddc4bff6e628877334eb8e8e2e4",
  },
] as const;

interface ArtifactInput {
  readonly logicalId: string;
  readonly sha256: string;
  readonly sheets: readonly string[];
  readonly observationRange: string | null;
}

interface ArtifactDraft {
  readonly logicalArtifactId: string;
  readonly fileName: string;
  readonly value: unknown;
  readonly inputs: readonly ArtifactInput[];
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly rowCounts: Readonly<Record<string, number>>;
  readonly attribution: string;
  readonly usageNote: string;
}

export interface GeneratedArtifact {
  readonly logicalArtifactId: string;
  readonly fileName: string;
  readonly bytes: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly value: unknown;
}

export interface GenerationResult {
  readonly generatedAt: string;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly referenceManifestSha256: string;
}

function approved(id: string) {
  const input = APPROVED_INPUT_BY_ID.get(id);
  if (!input) throw new Error(`Unknown approved input ${id}`);
  return input;
}

function provenanceInput(
  id: string,
  sheets: readonly string[],
  observationRange: string | null = null,
): ArtifactInput {
  const input = approved(id);
  for (const sheet of sheets) {
    if (!input.sheets.includes(sheet)) {
      throw new Error(`Sheet ${sheet} is not allowlisted for input ${id}`);
    }
  }
  return { logicalId: id, sha256: input.sha256, sheets, observationRange };
}

function materialize(draft: ArtifactDraft): GeneratedArtifact {
  const bytes = canonicalJson(draft.value);
  return {
    logicalArtifactId: draft.logicalArtifactId,
    fileName: draft.fileName,
    bytes,
    byteSize: Buffer.byteLength(bytes),
    sha256: sha256(bytes),
    value: draft.value,
  };
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
    value,
  );
}

async function verifyApprovedInputs(inputRoot: string, generatedAt: string) {
  if (!isIsoTimestamp(generatedAt)) throw new Error("Generation clock must be an ISO timestamp with offset");
  const files = [];
  for (const input of APPROVED_INPUTS) {
    const filePath = path.join(inputRoot, input.fileName);
    const bytes = await readFile(filePath);
    const digest = sha256(bytes);
    if (bytes.length !== input.byteSize || digest !== input.sha256) {
      throw new Error(
        `Approved input ${input.id} identity mismatch: ${bytes.length}/${digest}`,
      );
    }
    files.push({
      id: input.id,
      fileName: input.fileName,
      byteSize: bytes.length,
      sha256: digest,
      optional: input.optional,
      allowedSheets: input.sheets,
      validation: "PASS",
    });
  }
  assertExactCount(files.length, 19, "approved XLSX inputs");

  const sidecars = [];
  for (const sidecar of PACK_SIDECARS) {
    const bytes = await readFile(path.join(inputRoot, sidecar.fileName));
    const digest = sha256(bytes);
    if (digest !== sidecar.sha256) throw new Error(`Approved sidecar mismatch: ${sidecar.fileName}`);
    sidecars.push({ fileName: sidecar.fileName, byteSize: bytes.length, sha256: digest });
  }

  return {
    schemaVersion: "move-ai/approved-inputs-manifest/v1",
    generatedAt,
    authority: "MOVE_AI_DATA_PACK/APP_USED_DATA",
    policy: "Numbered workbooks 00-18 only; quarantined HTML is not opened or parsed.",
    files,
    sidecars,
  };
}

async function publishAtomically(
  outputDirectory: string,
  artifacts: readonly GeneratedArtifact[],
): Promise<void> {
  const parent = path.dirname(outputDirectory);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, ".wt6-generate-"));
  try {
    for (const artifact of artifacts) {
      await writeFile(path.join(temporary, artifact.fileName), artifact.bytes, "utf8");
    }
    await mkdir(outputDirectory, { recursive: true });
    for (const artifact of artifacts) {
      const source = path.join(temporary, artifact.fileName);
      const destination = path.join(outputDirectory, artifact.fileName);
      const existing = await readFile(destination).catch(() => null);
      if (existing && existing.equals(Buffer.from(artifact.bytes))) {
        await rm(source);
        continue;
      }
      if (existing) await rm(destination);
      await rename(source, destination);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function generateAll(input: {
  readonly inputRoot: string;
  readonly outputDirectory?: string;
  readonly generatedAt?: string;
}): Promise<GenerationResult> {
  const generatedAt = input.generatedAt ?? DEFAULT_GENERATION_CLOCK;
  const approvedInputs = await verifyApprovedInputs(input.inputRoot, generatedAt);
  const referenceManifestSha256 = approved("12").sha256;
  const workbookCache = new Map<string, Promise<XlsxWorkbook>>();
  const workbook = (id: string): Promise<XlsxWorkbook> => {
    const source = approved(id);
    const cached = workbookCache.get(id);
    if (cached) return cached;
    const loaded = readXlsx(path.join(input.inputRoot, source.fileName), source.sheets);
    workbookCache.set(id, loaded);
    return loaded;
  };

  const manifestWorkbook = await workbook("12");
  const manifestFiles = readTable(manifestWorkbook, "FILES");
  assertExactCount(manifestFiles.length, 18, "approved manifest file rows");
  const approvedManifestStatuses = new Set([
    "VERIFIED",
    "VERIFIED_WITH_CAVEATS",
    "REFERENCE",
    "OPTIONAL",
    "VERIFIED_CONFIG",
    "API_KEY_REQUIRED",
  ]);
  for (const row of manifestFiles) {
    const order = requireInteger(row, "order");
    const id = String(order).padStart(2, "0");
    const source = approved(id);
    if (
      requireString(row, "relative_path") !== source.fileName ||
      requireInteger(row, "file_size_bytes") !== source.byteSize ||
      requireString(row, "sha256") !== source.sha256 ||
      !approvedManifestStatuses.has(requireString(row, "status"))
    ) {
      throw new Error(
        `Workbook 12 manifest mismatch for ${id}: ${JSON.stringify({ relativePath: row.relative_path, byteSize: row.file_size_bytes, sha256: row.sha256, status: row.status })}`,
      );
    }
  }
  if (manifestFiles.some((row) => requireInteger(row, "order") === 12)) {
    throw new Error("Workbook 12 must not self-declare its own identity");
  }
  const manifestValidation = readTable(manifestWorkbook, "VALIDATION");
  if (manifestValidation.some((row) => requireString(row, "status") !== "PASS")) {
    throw new Error("Workbook 12 validation contains a non-PASS row");
  }

  const [historyBook, forecastBook, evaluationBook] = await Promise.all([
    workbook("02"),
    workbook("13"),
    workbook("14"),
  ]);
  const forecastArtifacts = produceForecastArtifacts({
    generatedAt,
    history: readTable(historyBook, "NORMALIZED"),
    forecasts: readTable(forecastBook, "NORMALIZED"),
    metrics: readTable(forecastBook, "METRICS"),
    evaluations: readTable(evaluationBook, "RAW"),
  });

  const [fxBook, oilBook, bunkerBook, harpexBook] = await Promise.all([
    workbook("03"),
    workbook("04"),
    workbook("05"),
    workbook("06"),
  ]);
  const market = produceMarketReference({
    generatedAt,
    fx: readTable(fxBook, "NORMALIZED"),
    oil: readTable(oilBook, "NORMALIZED"),
    bunker: readTable(bunkerBook, "NORMALIZED"),
    harpex: readTable(harpexBook, "NORMALIZED"),
  });

  const [portBook, chokeBook] = await Promise.all([workbook("07"), workbook("08")]);
  const portTraffic = producePortTrafficFixture({
    generatedAt,
    mapping: readTable(portBook, "PORT_MAPPING"),
    daily: readTable(portBook, "DAILY_RECENT_220D"),
  });
  const chokepointTraffic = produceChokepointTrafficFixture({
    generatedAt,
    mapping: readTable(chokeBook, "CHOKEPOINT_MAPPING"),
    daily: readTable(chokeBook, "DAILY_RECENT_220D"),
    allSeries: readTable(chokeBook, "ALL_SERIES"),
  });

  const [catalogBook, weatherBook, newsBook, tuningBook, runtimeProviderBook] = await Promise.all([
    workbook("01"),
    workbook("09"),
    workbook("10"),
    workbook("15"),
    workbook("17"),
  ]);
  const networkCatalog = produceNetworkCatalog({
    capturedAt: generatedAt,
    referenceManifestSha256,
    routes: readTable(catalogBook, "ROUTES"),
    ports: readTable(catalogBook, "PORTS"),
    chokepoints: readTable(catalogBook, "CHOKEPOINTS"),
    weather: readTable(weatherBook, "LOCATION_CATALOG"),
  });
  const newsPolicy = produceNewsPolicy({
    generatedAt,
    profiles: readTable(newsBook, "ROUTE_QUERY_CATALOG"),
    providers: readTable(newsBook, "PROVIDERS"),
  });
  const insightPolicy = produceInsightPolicy(generatedAt);
  const runtimeProviderPolicy = produceRuntimeProviderPolicy({
    generatedAt,
    providers: readTable(runtimeProviderBook, "NORMALIZED"),
  });
  const tuningConfig = produceTuningConfig({
    generatedAt,
    parameters: readTable(tuningBook, "RAW"),
    presets: readTable(tuningBook, "NORMALIZED"),
    windows: readTable(tuningBook, "TRAINING_WINDOWS"),
  });

  const drafts: ArtifactDraft[] = [
    {
      logicalArtifactId: "approved-inputs-manifest-v1",
      fileName: "approved-inputs-manifest-v1.json",
      value: approvedInputs,
      inputs: APPROVED_INPUTS.map((source) => provenanceInput(source.id, [])),
      parameters: { identity: "byteSize+sha256", forbiddenHtmlOpened: false },
      rowCounts: { inputs: APPROVED_INPUTS.length },
      attribution: "MOVE AI approved data pack",
      usageNote: "Clean-room input identity registry; no workbook payload is exposed.",
    },
    {
      logicalArtifactId: "forecast-snapshot-v3",
      fileName: "forecast-snapshot-v3.json",
      value: forecastArtifacts.snapshot,
      inputs: [
        provenanceInput("02", ["NORMALIZED"], "2022-11-07..2026-08-03"),
        provenanceInput("13", ["NORMALIZED", "METRICS"]),
        provenanceInput("14", ["RAW"]),
        provenanceInput("15", ["TRAINING_WINDOWS"]),
      ],
      parameters: { routeCount: 13, observationsPerRoute: 187, modelCount: 8, horizons: [1, 2, 3, 4] },
      rowCounts: { history: 2_431, forecasts: 416, metrics: 416, evaluations: 21_632 },
      attribution: "KOBC KCCI and approved model workbooks",
      usageNote: "Forecast reference; not an executable carrier quote.",
    },
    {
      logicalArtifactId: "snapshot-evaluation-v3",
      fileName: "snapshot-evaluation-v3.json",
      value: forecastArtifacts.evaluation,
      inputs: [provenanceInput("14", ["RAW"], "52 origins per model-horizon")],
      parameters: { evaluationOrigins: 52, horizonOrder: [1, 2, 3, 4] },
      rowCounts: { evaluations: 21_632 },
      attribution: "Approved model evaluation workbook",
      usageNote: "Rolling evaluation evidence for the static snapshot.",
    },
    {
      logicalArtifactId: "market-reference-v1",
      fileName: "market-reference-v1.json",
      value: market,
      inputs: [
        provenanceInput("03", ["NORMALIZED"]),
        provenanceInput("04", ["NORMALIZED"]),
        provenanceInput("05", ["NORMALIZED"]),
        provenanceInput("06", ["NORMALIZED"]),
      ],
      parameters: { harpexPublicUnit: "Index", providerVersion: 3 },
      rowCounts: { fx: 960, oil: 944, bunker: 948, harpex: 4 },
      attribution: "ECB, EIA, USDA and HARPEX public reference",
      usageNote: "HARPEX is a four-point public reference, not a live full series.",
    },
    {
      logicalArtifactId: "port-traffic-fixture-v1",
      fileName: "port-traffic-fixture-v1.json",
      value: portTraffic,
      inputs: [provenanceInput("07", ["PORT_MAPPING", "DAILY_RECENT_220D"], "220 days")],
      parameters: { rollingWindowDays: 7, nullOnIncompleteWindow: true },
      rowCounts: { markers: 57, uniqueSeries: 56, dailyRows: 12_320 },
      attribution: "IMF PortWatch",
      usageNote: "Tonnage is estimated; calls are observed counts.",
    },
    {
      logicalArtifactId: "chokepoint-traffic-fixture-v1",
      fileName: "chokepoint-traffic-fixture-v1.json",
      value: chokepointTraffic,
      inputs: [
        provenanceInput("08", ["CHOKEPOINT_MAPPING", "DAILY_RECENT_220D", "ALL_SERIES"], "220 days"),
      ],
      parameters: { rollingWindowDays: 7, nullOnIncompleteWindow: true },
      rowCounts: { appChokepoints: 11, fullCatalogSeries: 28, dailyRows: 2_420 },
      attribution: "IMF PortWatch",
      usageNote: "Transit tonnage is estimated metric tons, not TEU.",
    },
    {
      logicalArtifactId: "news-policy-v18",
      fileName: "news-policy-v18.json",
      value: newsPolicy,
      inputs: [provenanceInput("10", ["ROUTE_QUERY_CATALOG", "PROVIDERS"])],
      parameters: { primaryWindowDays: 30, fallbackWindowDays: 90, providerVersion: 18 },
      rowCounts: { routeProfiles: 13, providers: readTable(newsBook, "PROVIDERS").length },
      attribution: "Approved runtime provider catalog",
      usageNote: "Provider execution is best-effort and must retain attempt truth.",
    },
    {
      logicalArtifactId: "insight-policy-v1",
      fileName: "insight-policy-v1.json",
      value: insightPolicy,
      inputs: [provenanceInput("10", ["ROUTE_QUERY_CATALOG"])],
      parameters: { llm: "Gemini only", deterministicFallback: true },
      rowCounts: { routeProfiles: 13 },
      attribution: "Frozen WT6 contract tables",
      usageNote: "No OpenAI runtime or API is permitted.",
    },
    {
      logicalArtifactId: "runtime-provider-policy-v1",
      fileName: "runtime-provider-policy-v1.json",
      value: runtimeProviderPolicy,
      inputs: [provenanceInput("17", ["NORMALIZED"])],
      parameters: { llm: "Gemini only", outboundScheme: "https", harpexPublicUnit: "Index" },
      rowCounts: { approvedRuntimeProviders: runtimeProviderPolicy.providers.length },
      attribution: "Approved runtime provider catalog and frozen WT6 policy tables",
      usageNote: "Server-only provider allowlist; prohibited LLM rows are not executable or published.",
    },
    {
      logicalArtifactId: "tuning-config-v1",
      fileName: "tuning-config-v1.json",
      value: tuningConfig,
      inputs: [provenanceInput("15", ["RAW", "NORMALIZED", "TRAINING_WINDOWS"])],
      parameters: { maximumTimeoutMs: 600_000 },
      rowCounts: { parameters: 33, presetRows: 99, trainingWindows: 3 },
      attribution: "Approved tuning configuration workbook",
      usageNote: "Static model presence does not imply deployed tuning capability.",
    },
    {
      logicalArtifactId: "network-catalog-seam-v1",
      fileName: "network-catalog-seam-v1.json",
      value: networkCatalog,
      inputs: [
        provenanceInput("01", ["ROUTES", "PORTS", "CHOKEPOINTS"]),
        provenanceInput("09", ["LOCATION_CATALOG"]),
        provenanceInput("12", ["FILES", "VALIDATION"]),
      ],
      parameters: { timezone: "Asia/Seoul", routeWaypoints: "approved representative endpoints" },
      rowCounts: { routes: 13, ports: 57, uniquePortSeries: 56, chokepoints: 11, weather: 82 },
      attribution: "Approved route, PortWatch and weather catalogs",
      usageNote: "Coordinates are retained without display rounding.",
    },
  ];

  const materialized = drafts.map(materialize);
  const catalogArtifact = materialized.find(
    (artifact) => artifact.logicalArtifactId === "network-catalog-seam-v1",
  );
  if (!catalogArtifact) throw new Error("Network catalog artifact was not materialized");
  const catalogIdentity = produceNetworkCatalogIdentity({
    catalogSeamSha256: catalogArtifact.sha256,
    byteSize: catalogArtifact.byteSize,
    referenceManifestSha256,
    catalog: networkCatalog,
  });
  const networkIdentityDraft: ArtifactDraft = {
    logicalArtifactId: "network-catalog-seam-identity-v1",
    fileName: "network-catalog-seam-identity-v1.json",
    value: catalogIdentity,
    inputs: drafts.find((draft) => draft.logicalArtifactId === "network-catalog-seam-v1")?.inputs ?? [],
    parameters: { digestAlgorithm: "sha256" },
    rowCounts: { identity: 1 },
    attribution: "MOVE AI clean-room producer",
    usageNote: "Must be checked against the catalog canonical bytes before overlay use.",
  };
  drafts.push(networkIdentityDraft);
  materialized.push(materialize(networkIdentityDraft));

  const digestById = new Map(materialized.map((artifact) => [artifact.logicalArtifactId, artifact.sha256]));
  const fixtureCatalog = {
    schemaVersion: "move-ai/fixture-catalog/v1",
    generatedAt,
    fixedRequestId: "wt6-clean-room-fixture-v1",
    items: [
      {
        fixtureId: "snapshot-ready-v1",
        domain: "snapshot",
        normalizedRequest: {},
        state: "READY",
        mode: "fixture",
        asOf: "2026-08-03",
        fetchedAt: generatedAt,
        artifactDigest: digestById.get("forecast-snapshot-v3"),
        expectedStatus: 200,
        expectedCacheControl: "public, max-age=31536000, immutable",
        expectedConsumerState: "ready",
      },
      ...(["fx", "oil", "bunker", "harpex"] as const).map((series) => ({
        fixtureId: `market-${series}-reference-v1`,
        domain: "market",
        normalizedRequest: { series, providerVersion: 3 },
        state: "REFERENCE",
        mode: "fixture",
        asOf: market.series[series].observationEnd,
        fetchedAt: generatedAt,
        artifactDigest: digestById.get("market-reference-v1"),
        expectedStatus: 200,
        expectedCacheControl: "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
        expectedConsumerState: "ready",
      })),
      {
        fixtureId: "port-summary-stale-v1",
        domain: "port",
        normalizedRequest: {},
        state: "STALE",
        mode: "fixture",
        asOf: portTraffic.commonObservationDate,
        fetchedAt: generatedAt,
        artifactDigest: digestById.get("port-traffic-fixture-v1"),
        expectedStatus: 200,
        expectedCacheControl: "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
        expectedConsumerState: "stale",
      },
      {
        fixtureId: "chokepoint-summary-stale-v1",
        domain: "chokepoint",
        normalizedRequest: {},
        state: "STALE",
        mode: "fixture",
        asOf: chokepointTraffic.latestObservationDate,
        fetchedAt: generatedAt,
        artifactDigest: digestById.get("chokepoint-traffic-fixture-v1"),
        expectedStatus: 200,
        expectedCacheControl: "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
        expectedConsumerState: "stale",
      },
      ...(["news", "weather"] as const).map((domain) => ({
        fixtureId: `${domain}-unavailable-v1`,
        domain,
        normalizedRequest: {},
        state: "UNAVAILABLE",
        mode: "unavailable",
        asOf: null,
        fetchedAt: generatedAt,
        artifactDigest: null,
        expectedStatus: 200,
        expectedCacheControl: "no-store",
        expectedConsumerState: "unavailable",
      })),
      {
        fixtureId: "insight-derived-rule-v1",
        domain: "insight",
        normalizedRequest: { route: "KNEI", selectedHorizon: 1 },
        state: "DERIVED",
        mode: "fixture",
        asOf: "2026-08-03",
        fetchedAt: generatedAt,
        artifactDigest: digestById.get("insight-policy-v1"),
        expectedStatus: 200,
        expectedCacheControl: "no-store",
        expectedConsumerState: "ready",
      },
      ...(["tuning-health", "tuning-run"] as const).map((domain) => ({
        fixtureId: `${domain}-unavailable-v1`,
        domain,
        normalizedRequest: {},
        state: "UNAVAILABLE",
        mode: "unavailable",
        asOf: null,
        fetchedAt: generatedAt,
        artifactDigest: null,
        expectedStatus: 503,
        expectedCacheControl: "no-store",
        expectedConsumerState: "unavailable",
      })),
    ],
  };
  const fixtureDraft: ArtifactDraft = {
    logicalArtifactId: "fixture-catalog-v1",
    fileName: "fixture-catalog-v1.json",
    value: fixtureCatalog,
    inputs: [
      provenanceInput("02", ["NORMALIZED"]),
      provenanceInput("03", ["NORMALIZED"]),
      provenanceInput("04", ["NORMALIZED"]),
      provenanceInput("05", ["NORMALIZED"]),
      provenanceInput("06", ["NORMALIZED"]),
      provenanceInput("07", ["PORT_MAPPING", "DAILY_RECENT_220D"]),
      provenanceInput("08", ["CHOKEPOINT_MAPPING", "DAILY_RECENT_220D"]),
    ],
    parameters: { fixedClock: generatedAt, fixedRequestId: "wt6-clean-room-fixture-v1" },
    rowCounts: { fixtures: fixtureCatalog.items.length },
    attribution: "MOVE AI approved data pack",
    usageNote: "Unavailable news and weather fixtures contain no fabricated observations.",
  };
  drafts.push(fixtureDraft);
  const fixtureArtifact = materialize(fixtureDraft);
  materialized.push(fixtureArtifact);

  const fixtureById = new Map(
    fixtureCatalog.items.map((fixture) => [fixture.fixtureId, fixture] as const),
  );
  const consumerResource = (method: string, fixtureId: string) => {
    const fixture = fixtureById.get(fixtureId);
    if (!fixture) throw new Error(`Unknown consumer fixture ${fixtureId}`);
    return {
      method,
      fixtureId,
      expectedState: fixture.state,
      expectedMode: fixture.mode,
      expectedStatus: fixture.expectedStatus,
      expectedCacheControl: fixture.expectedCacheControl,
      expectedConsumerState: fixture.expectedConsumerState,
    };
  };
  const consumerFixtures = {
    schemaVersion: "move-ai/consumer-integration-fixtures/v1",
    generatedAt,
    fixtureCatalogSha256: fixtureArtifact.sha256,
    networkCatalogSeamSha256: catalogArtifact.sha256,
    consumers: {
      dashboard: [
        consumerResource("snapshot", "snapshot-ready-v1"),
        consumerResource("market", "market-harpex-reference-v1"),
        consumerResource("news", "news-unavailable-v1"),
        consumerResource("insight", "insight-derived-rule-v1"),
      ],
      modelLab: [
        consumerResource("snapshot", "snapshot-ready-v1"),
        consumerResource("tuningHealth", "tuning-health-unavailable-v1"),
        consumerResource("tuningRun", "tuning-run-unavailable-v1"),
      ],
      globe: [
        consumerResource("portSummary", "port-summary-stale-v1"),
        consumerResource("chokeSummary", "chokepoint-summary-stale-v1"),
        consumerResource("weather", "weather-unavailable-v1"),
      ],
      allocation: [consumerResource("snapshot", "snapshot-ready-v1")],
    },
  };
  const consumerFixtureDraft: ArtifactDraft = {
    logicalArtifactId: "consumer-integration-fixtures-v1",
    fileName: "consumer-integration-fixtures-v1.json",
    value: consumerFixtures,
    inputs: fixtureDraft.inputs,
    parameters: {
      fixtureCatalogSha256: fixtureArtifact.sha256,
      networkCatalogSeamSha256: catalogArtifact.sha256,
    },
    rowCounts: {
      consumers: Object.keys(consumerFixtures.consumers).length,
      resources: Object.values(consumerFixtures.consumers).flat().length,
    },
    attribution: "MOVE AI consumer seam contract",
    usageNote: "Consumers share WT6 method decoders and must not invent fallback payloads.",
  };
  drafts.push(consumerFixtureDraft);
  materialized.push(materialize(consumerFixtureDraft));

  const draftById = new Map(drafts.map((draft) => [draft.logicalArtifactId, draft]));
  const provenanceManifest = {
    schemaVersion: "move-ai/provenance-manifest/v1",
    generatedAt,
    generator: { id: GENERATOR_ID, version: GENERATOR_VERSION },
    referenceManifestSha256,
    artifacts: materialized.map((artifact) => {
      const draft = draftById.get(artifact.logicalArtifactId);
      return {
        logicalArtifactId: artifact.logicalArtifactId,
        schemaVersion:
          typeof artifact.value === "object" && artifact.value !== null && "schemaVersion" in artifact.value
            ? String(artifact.value.schemaVersion)
            : "unknown",
        mediaType: "application/json",
        byteSize: artifact.byteSize,
        sha256: artifact.sha256,
        inputs: draft?.inputs ?? [],
        generator: { id: GENERATOR_ID, version: GENERATOR_VERSION },
        parameters: draft?.parameters ?? {},
        generatedAt,
        rowCounts: draft?.rowCounts ?? {},
        attribution: draft?.attribution ?? "MOVE AI clean-room producer",
        usageNote: draft?.usageNote ?? "Derived identity artifact.",
        validation: "PASS",
      };
    }),
  };
  const provenanceArtifact = materialize({
    logicalArtifactId: "provenance-manifest-v1",
    fileName: "provenance-manifest-v1.json",
    value: provenanceManifest,
    inputs: APPROVED_INPUTS.map((source) => provenanceInput(source.id, [])),
    parameters: { generatorVersion: GENERATOR_VERSION },
    rowCounts: { artifacts: materialized.length },
    attribution: "MOVE AI clean-room producer",
    usageNote: "Artifact identity and approved-input lineage.",
  });
  materialized.push(provenanceArtifact);
  materialized.push(
    materialize({
      logicalArtifactId: "provenance-manifest-identity-v1",
      fileName: "provenance-manifest-identity-v1.json",
      value: {
        schemaVersion: "move-ai/provenance-manifest-identity/v1",
        sha256: provenanceArtifact.sha256,
        byteSize: provenanceArtifact.byteSize,
      },
      inputs: [],
      parameters: { digestAlgorithm: "sha256" },
      rowCounts: { identity: 1 },
      attribution: "MOVE AI clean-room producer",
      usageNote: "Identity of the generated provenance manifest canonical bytes.",
    }),
  );

  const fileNames = new Set(materialized.map((artifact) => artifact.fileName));
  if (fileNames.size !== materialized.length) throw new Error("Duplicate generated artifact filename");
  for (const artifact of materialized) {
    assertGeneratedArtifact(artifact.logicalArtifactId, JSON.parse(artifact.bytes));
  }
  const identityArtifact = materialized.find(
    (artifact) => artifact.logicalArtifactId === "network-catalog-seam-identity-v1",
  );
  const provenanceIdentityArtifact = materialized.find(
    (artifact) => artifact.logicalArtifactId === "provenance-manifest-identity-v1",
  );
  if (!identityArtifact || !provenanceIdentityArtifact) {
    throw new Error("Generated identity artifacts are missing");
  }
  await assertNetworkCatalogIdentity(
    Buffer.from(catalogArtifact.bytes),
    JSON.parse(catalogArtifact.bytes),
    JSON.parse(identityArtifact.bytes),
  );
  await assertProvenanceManifestIdentity(
    Buffer.from(provenanceArtifact.bytes),
    JSON.parse(provenanceIdentityArtifact.bytes),
  );
  if (input.outputDirectory) await publishAtomically(input.outputDirectory, materialized);
  return { generatedAt, artifacts: materialized, referenceManifestSha256 };
}

function parseCliArguments(argv: readonly string[]) {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("Arguments must be --key value pairs");
    result[key.slice(2)] = value;
  }
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const args = parseCliArguments(process.argv.slice(2));
  const inputRoot = args.input ?? process.env.MOVE_AI_DATA_PACK_ROOT;
  if (!inputRoot) throw new Error("Provide --input or MOVE_AI_DATA_PACK_ROOT");
  const outputDirectory = args.output ?? path.resolve("app/data/generated");
  const result = await generateAll({
    inputRoot,
    outputDirectory,
    generatedAt: args.clock ?? DEFAULT_GENERATION_CLOCK,
  });
  process.stdout.write(
    `${JSON.stringify({ generatedAt: result.generatedAt, artifacts: result.artifacts.map(({ logicalArtifactId, fileName, byteSize, sha256: digest }) => ({ logicalArtifactId, fileName, byteSize, sha256: digest })) }, null, 2)}\n`,
  );
}
