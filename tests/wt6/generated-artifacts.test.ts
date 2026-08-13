import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import networkCatalog from "../../app/data/generated/network-catalog-seam-v1.json";
import tuningConfig from "../../app/data/generated/tuning-config-v1.json";
import {
  assertGeneratedArtifact,
  assertNetworkCatalogIdentity,
  assertProvenanceManifestIdentity,
} from "../../app/data/artifacts/decoders";
import { generateAll } from "../../scripts/wt6/generate";
import {
  EXPECTED_ROUTE_WAYPOINT_COUNTS,
  EXPECTED_ROUTE_WAYPOINT_TOTAL,
  EXPECTED_WAYPOINT_GEOMETRY_USE,
} from "../../scripts/wt6/producers/catalog";
import { readTable, readXlsx } from "../../scripts/wt6/xlsx";
import {
  CHOKEPOINT_IDENTITY_POLICY_V1,
  PORT_IDENTITY_POLICY_V1,
  TUNING_PARAMETER_POLICY_V1,
} from "../../app/data/runtime/client-domain-policy";

const GENERATED_DIRECTORY = path.resolve("app/data/generated");
const EXPECTED_ARTIFACTS = [
  ["approved-inputs-manifest-v1", "approved-inputs-manifest-v1.json"],
  ["forecast-snapshot-v3", "forecast-snapshot-v3.json"],
  ["snapshot-evaluation-v3", "snapshot-evaluation-v3.json"],
  ["market-reference-v1", "market-reference-v1.json"],
  ["port-traffic-fixture-v1", "port-traffic-fixture-v1.json"],
  ["chokepoint-traffic-fixture-v1", "chokepoint-traffic-fixture-v1.json"],
  ["news-policy-v18", "news-policy-v18.json"],
  ["insight-policy-v1", "insight-policy-v1.json"],
  ["runtime-provider-policy-v1", "runtime-provider-policy-v1.json"],
  ["tuning-config-v1", "tuning-config-v1.json"],
  ["network-catalog-seam-v1", "network-catalog-seam-v1.json"],
  ["network-catalog-seam-identity-v1", "network-catalog-seam-identity-v1.json"],
  ["fixture-catalog-v1", "fixture-catalog-v1.json"],
  ["consumer-integration-fixtures-v1", "consumer-integration-fixtures-v1.json"],
  ["provenance-manifest-v1", "provenance-manifest-v1.json"],
  ["provenance-manifest-identity-v1", "provenance-manifest-identity-v1.json"],
] as const;

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function artifact(fileName: string): Promise<{
  readonly bytes: Buffer;
  readonly value: unknown;
}> {
  const bytes = await readFile(path.join(GENERATED_DIRECTORY, fileName));
  assert.equal(bytes[0], 0x7b, `${fileName} must start with an object byte`);
  assert.equal(bytes.at(-1), 0x0a, `${fileName} must end with one LF`);
  assert.notEqual(bytes.at(-2), 0x0a, `${fileName} must have one trailing LF`);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

test("all producer artifacts pass their method-specific runtime decoder", async () => {
  for (const [logicalId, fileName] of EXPECTED_ARTIFACTS) {
    const { value } = await artifact(fileName);
    assertGeneratedArtifact(logicalId, value);
  }
});

test("provenance records every derived artifact with matching canonical identity", async () => {
  const { bytes: provenanceBytes, value: provenanceValue } = await artifact(
    "provenance-manifest-v1.json",
  );
  const { value: provenanceIdentity } = await artifact(
    "provenance-manifest-identity-v1.json",
  );
  await assertProvenanceManifestIdentity(provenanceBytes, provenanceIdentity);

  const provenance = provenanceValue as {
    readonly referenceManifestSha256: string;
    readonly artifacts: readonly {
      readonly logicalArtifactId: string;
      readonly byteSize: number;
      readonly sha256: string;
      readonly inputs: readonly {
        readonly logicalId: string;
        readonly sheets: readonly string[];
      }[];
      readonly parameters: Readonly<Record<string, unknown>>;
      readonly rowCounts: Readonly<Record<string, number>>;
      readonly validation: string;
    }[];
  };
  assert.equal(
    provenance.referenceManifestSha256,
    "991690557c80d0820228f8d6c63b78c82e74677d64aa91ba1be2906b681bfa71",
  );
  const filesById = new Map(EXPECTED_ARTIFACTS);
  for (const entry of provenance.artifacts) {
    const fileName = filesById.get(entry.logicalArtifactId as (typeof EXPECTED_ARTIFACTS)[number][0]);
    assert.ok(fileName, `unknown provenance artifact ${entry.logicalArtifactId}`);
    const bytes = await readFile(path.join(GENERATED_DIRECTORY, fileName));
    assert.equal(entry.byteSize, bytes.length);
    assert.equal(entry.sha256, digest(bytes));
    assert.equal(entry.validation, "PASS");
  }
  const networkCatalogEntry = provenance.artifacts.find(
    (entry) => entry.logicalArtifactId === "network-catalog-seam-v1",
  );
  assert.ok(networkCatalogEntry);
  assert.deepEqual(
    networkCatalogEntry.inputs.find((input) => input.logicalId === "16")?.sheets,
    ["CORRIDOR_WAYPOINTS", "CHOKEPOINTS"],
  );
  assert.equal(networkCatalogEntry.parameters.geometryUse, EXPECTED_WAYPOINT_GEOMETRY_USE);
  assert.deepEqual(networkCatalogEntry.rowCounts, {
    routes: 13,
    routeWaypoints: 297,
    ports: 57,
    uniquePortSeries: 56,
    chokepoints: 11,
    chokepointCorridorCoordinates: 57,
    weather: 82,
  });
});

test("network catalog identity is bound to generated bytes and approved counts", async () => {
  const catalog = await artifact("network-catalog-seam-v1.json");
  const identity = await artifact("network-catalog-seam-identity-v1.json");
  await assertNetworkCatalogIdentity(catalog.bytes, catalog.value, identity.value);
  const typed = identity.value as {
    readonly routeCount: number;
    readonly routeWaypointCount: number;
    readonly portCount: number;
    readonly uniquePortSeriesCount: number;
    readonly chokepointCount: number;
    readonly weatherCount: number;
    readonly referenceManifestSha256: string;
  };
  assert.deepEqual(
    [
      typed.routeCount,
      typed.routeWaypointCount,
      typed.portCount,
      typed.uniquePortSeriesCount,
      typed.chokepointCount,
      typed.weatherCount,
    ],
    [13, 297, 57, 56, 11, 82],
  );
  assert.equal(typed.referenceManifestSha256, "991690557c80d0820228f8d6c63b78c82e74677d64aa91ba1be2906b681bfa71");
  const catalogValue = catalog.value as { readonly weather: readonly Readonly<Record<string, unknown>>[] };
  assert.ok(catalogValue.weather.every((item) => Object.keys(item).join(",") === "id,kind,entityId,longitude,latitude"));
});

test("network catalog retains all approved route anchors and chokepoint geometry", async () => {
  const { value } = await artifact("network-catalog-seam-v1.json");
  const catalog = value as {
    readonly routes: readonly {
      readonly id: keyof typeof EXPECTED_ROUTE_WAYPOINT_COUNTS;
      readonly waypointCoordinates: readonly (readonly [number, number])[];
    }[];
    readonly chokepoints: readonly {
      readonly id: string;
      readonly corridorCoordinates: readonly (readonly [number, number])[];
      readonly gateHalfWidthKm: number;
    }[];
  };
  assert.equal(
    catalog.routes.reduce((total, route) => total + route.waypointCoordinates.length, 0),
    EXPECTED_ROUTE_WAYPOINT_TOTAL,
  );
  assert.deepEqual(
    Object.fromEntries(catalog.routes.map((route) => [route.id, route.waypointCoordinates.length])),
    { ...EXPECTED_ROUTE_WAYPOINT_COUNTS },
  );
  assert.equal(catalog.routes.find((route) => route.id === "KNEI")?.waypointCoordinates.length, 52);
  assert.equal(catalog.chokepoints.length, 11);
  assert.equal(
    catalog.chokepoints.reduce(
      (total, chokepoint) => total + chokepoint.corridorCoordinates.length,
      0,
    ),
    57,
  );
  assert.ok(
    catalog.chokepoints.every(
      (chokepoint) =>
        chokepoint.corridorCoordinates.length >= 2 && chokepoint.gateHalfWidthKm > 0,
    ),
  );
});

test(
  "network catalog has zero waypoint and chokepoint geometry mismatches against workbook 16",
  { skip: !process.env.MOVE_AI_DATA_PACK_ROOT },
  async () => {
    const inputRoot = process.env.MOVE_AI_DATA_PACK_ROOT;
    assert.ok(inputRoot);
    const workbook = await readXlsx(
      path.join(inputRoot, "16_ROUTE_EVENTS_AND_CORRIDORS.xlsx"),
      ["CORRIDOR_WAYPOINTS", "CHOKEPOINTS"],
    );
    const sourceWaypoints = readTable(workbook, "CORRIDOR_WAYPOINTS");
    const sourceChokepoints = readTable(workbook, "CHOKEPOINTS");
    const { value } = await artifact("network-catalog-seam-v1.json");
    const catalog = value as {
      readonly routes: readonly {
        readonly id: string;
        readonly waypointCoordinates: readonly (readonly [number, number])[];
      }[];
      readonly chokepoints: readonly {
        readonly id: string;
        readonly corridorCoordinates: readonly (readonly [number, number])[];
        readonly gateHalfWidthKm: number;
      }[];
    };

    assert.equal(sourceWaypoints.length, EXPECTED_ROUTE_WAYPOINT_TOTAL);
    for (const route of catalog.routes) {
      const approved = sourceWaypoints
        .filter((row) => row.route_code === route.id)
        .sort(
          (left, right) =>
            Number(left.waypoint_sequence) - Number(right.waypoint_sequence),
        );
      assert.equal(
        approved.length,
        EXPECTED_ROUTE_WAYPOINT_COUNTS[
          route.id as keyof typeof EXPECTED_ROUTE_WAYPOINT_COUNTS
        ],
      );
      approved.forEach((row, index) => {
        assert.equal(row.waypoint_sequence, index + 1);
        assert.equal(row.geometry_use, EXPECTED_WAYPOINT_GEOMETRY_USE);
        assert.equal(
          row.waypoint_role,
          index === 0
            ? "ORIGIN"
            : index === approved.length - 1
              ? "DESTINATION"
              : "CORRIDOR_ANCHOR",
        );
      });
      assert.deepEqual(
        route.waypointCoordinates,
        approved.map((row) => [row.longitude, row.latitude]),
        `${route.id} waypoint mismatch`,
      );
    }

    assert.equal(sourceChokepoints.length, 11);
    const approvedChokepointById = new Map(
      sourceChokepoints.map((row) => [String(row.id), row] as const),
    );
    for (const chokepoint of catalog.chokepoints) {
      const approved = approvedChokepointById.get(chokepoint.id);
      assert.ok(approved);
      assert.deepEqual(
        chokepoint.corridorCoordinates,
        JSON.parse(String(approved.corridor)),
      );
      assert.equal(chokepoint.gateHalfWidthKm, approved.gateHalfWidthKm);
    }
  },
);

test("client-safe decoder policy is an exact view of generated server artifacts", () => {
  assert.deepEqual(PORT_IDENTITY_POLICY_V1, Object.fromEntries(networkCatalog.ports.map((port) => [
    port.id, [port.routeId, port.upstreamPortWatchId],
  ])));
  assert.deepEqual(CHOKEPOINT_IDENTITY_POLICY_V1, Object.fromEntries(networkCatalog.chokepoints.map((choke) => [
    choke.id, choke.upstreamPortWatchId,
  ])));
  assert.deepEqual(TUNING_PARAMETER_POLICY_V1, Object.fromEntries(Object.entries(tuningConfig.parameterCatalog).map(([modelId, definitions]) => [
    modelId,
    definitions.map((definition) => [
      definition.key,
      definition.inputType,
      definition.minimum,
      definition.maximum,
      definition.step,
      definition.optionsJson === null
        ? null
        : JSON.parse(definition.optionsJson).map((option: { readonly value: string }) => option.value),
    ]),
  ])));
});

test("runtime provider and consumer fixture policies are identity-bound and server-safe", async () => {
  const provider = await artifact("runtime-provider-policy-v1.json");
  const providerText = provider.bytes.toString("utf8");
  assert.doesNotMatch(providerText, /api\.openai\.com|OPENAI_API_KEY|OpenAI Responses/iu);
  assert.match(providerText, /generativelanguage\.googleapis\.com/u);
  assert.match(providerText, /"unit":"Index"/u);

  const consumer = (await artifact("consumer-integration-fixtures-v1.json")).value as {
    readonly fixtureCatalogSha256: string;
    readonly networkCatalogSeamSha256: string;
    readonly consumers: Readonly<Record<string, readonly unknown[]>>;
  };
  const fixture = await artifact("fixture-catalog-v1.json");
  const networkIdentity = (await artifact("network-catalog-seam-identity-v1.json")).value as {
    readonly catalogSeamSha256: string;
  };
  assert.equal(consumer.fixtureCatalogSha256, digest(fixture.bytes));
  assert.equal(consumer.networkCatalogSeamSha256, networkIdentity.catalogSeamSha256);
  assert.deepEqual(
    Object.fromEntries(Object.entries(consumer.consumers).map(([key, resources]) => [key, resources.length])),
    { dashboard: 4, modelLab: 3, globe: 3, allocation: 1 },
  );
});

test("snapshot cardinality, ordering, and KNEI SARIMAX golden values are retained", async () => {
  const { value } = await artifact("forecast-snapshot-v3.json");
  const snapshot = value as {
    readonly dates: readonly string[];
    readonly routes: Readonly<
      Record<
        string,
        {
          readonly values: readonly number[];
          readonly models: readonly {
            readonly id: string;
            readonly forecasts: readonly {
              readonly horizon: number;
              readonly value: number;
              readonly lower90: number;
              readonly upper90: number;
            }[];
            readonly metricsByHorizon: readonly {
              readonly horizon: number;
              readonly mapePct: number;
              readonly mase: number;
              readonly coverage90Pct: number;
            }[];
          }[];
        }
      >
    >;
  };
  assert.equal(snapshot.dates.length, 187);
  assert.equal(Object.keys(snapshot.routes).length, 13);
  assert.ok(Object.values(snapshot.routes).every((route) => route.values.length === 187));
  assert.ok(Object.values(snapshot.routes).every((route) => route.models.length === 8));
  assert.ok(
    Object.values(snapshot.routes).every((route) =>
      route.models.every((model) =>
        model.forecasts.map((forecast) => forecast.horizon).join(",") === "1,2,3,4",
      ),
    ),
  );

  const knei = snapshot.routes.KNEI;
  assert.equal(snapshot.dates.at(-1), "2026-08-03");
  assert.equal(knei.values.at(-1), 4_884);
  const sarimax = knei.models.find((model) => model.id === "sarimax");
  assert.ok(sarimax);
  assert.deepEqual(sarimax.forecasts[0], {
    horizon: 1,
    date: "2026-08-10",
    value: 4_828.98,
    lower90: 4_482.47,
    upper90: 5_175.49,
    calibrationSampleSize: 78,
  });
  assert.equal(sarimax.metricsByHorizon[0].mapePct, 3.6);
  assert.equal(sarimax.metricsByHorizon[0].mase, 0.037);
  assert.equal(sarimax.metricsByHorizon[0].coverage90Pct, 88.5);
});

test("fixture truth preserves reference, stale, unavailable, null, and observed zero", async () => {
  const { value: fixtureValue } = await artifact("fixture-catalog-v1.json");
  const fixture = fixtureValue as {
    readonly items: readonly {
      readonly domain: string;
      readonly state: string;
      readonly mode: string;
      readonly asOf: string | null;
      readonly artifactDigest: string | null;
      readonly expectedCacheControl: string;
    }[];
  };
  assert.ok(fixture.items.some((item) => item.domain === "market" && item.state === "REFERENCE" && item.mode === "fixture"));
  assert.ok(fixture.items.some((item) => item.domain === "port" && item.state === "STALE" && item.mode === "fixture" && item.asOf === "2026-08-07"));
  assert.ok(fixture.items.some((item) => item.domain === "chokepoint" && item.state === "STALE" && item.asOf === "2026-08-09"));
  assert.ok(
    fixture.items
      .filter((item) => item.state === "UNAVAILABLE")
      .every(
        (item) =>
          item.mode === "unavailable" &&
          item.asOf === null &&
          item.artifactDigest === null &&
          item.expectedCacheControl === "no-store",
      ),
  );

  const { value: portValue } = await artifact("port-traffic-fixture-v1.json");
  const port = portValue as {
    readonly summaries: Readonly<
      Record<
        string,
        {
          readonly previousEstimatedTotalTons7d: number | null;
          readonly estimatedTotalTonsChangePercent: number | null;
          readonly previousContainerVesselCalls7d: number | null;
          readonly vesselCallsChangePercent: number | null;
        }
      >
    >;
    readonly details: Readonly<
      Record<
        string,
        {
          readonly points: readonly {
            readonly estimatedTotalTons: number | null;
            readonly containerVesselCalls: number | null;
          }[];
        }
      >
    >;
  };
  assert.ok(
    Object.values(port.summaries).some(
      (summary) =>
        (summary.previousEstimatedTotalTons7d === 0 && summary.estimatedTotalTonsChangePercent === null) ||
        (summary.previousContainerVesselCalls7d === 0 && summary.vesselCallsChangePercent === null),
    ),
  );
  assert.ok(
    Object.values(port.details).some((detail) =>
      detail.points.some(
        (point) => point.estimatedTotalTons === 0 || point.containerVesselCalls === 0,
      ),
    ),
  );
});

test("decoders reject extra keys, malformed domain data, and mismatched identities", async () => {
  const snapshot = structuredClone(
    (await artifact("forecast-snapshot-v3.json")).value,
  ) as Record<string, unknown>;
  snapshot.extra = true;
  assert.throws(() => assertGeneratedArtifact("forecast-snapshot-v3", snapshot), /keys/u);

  const market = structuredClone(
    (await artifact("market-reference-v1.json")).value,
  ) as {
    series: { harpex: { unit: string } };
  };
  market.series.harpex.unit = "index points";
  assert.throws(() => assertGeneratedArtifact("market-reference-v1", market), /Index/u);

  const port = structuredClone(
    (await artifact("port-traffic-fixture-v1.json")).value,
  ) as {
    summaries: Record<string, { portId: string }>;
  };
  const firstPortKey = Object.keys(port.summaries)[0];
  port.summaries[firstPortKey].portId = "wrong-id";
  assert.throws(() => assertGeneratedArtifact("port-traffic-fixture-v1", port), /portId/u);

  const catalog = await artifact("network-catalog-seam-v1.json");
  const identity = structuredClone(
    (await artifact("network-catalog-seam-identity-v1.json")).value,
  ) as { catalogSeamSha256: string };
  identity.catalogSeamSha256 = "0".repeat(64);
  await assert.rejects(
    assertNetworkCatalogIdentity(catalog.bytes, catalog.value, identity),
    /identity/u,
  );
});

test("generated artifacts contain no local or quarantined implementation lineage", async () => {
  const forbidden = /(?:cargo-rescue-network|ZOO_WORKTREES|MOVE_AI_WORKTREES|[A-Z]:\\|19_KCCI_ROUTE_TRENDS_REFERENCE\.html)/u;
  for (const [, fileName] of EXPECTED_ARTIFACTS) {
    const text = (await artifact(fileName)).bytes.toString("utf8");
    assert.doesNotMatch(text, forbidden, fileName);
  }
});

test(
  "approved XLSX inputs regenerate byte-identical artifacts",
  { skip: !process.env.MOVE_AI_DATA_PACK_ROOT },
  async () => {
    const inputRoot = process.env.MOVE_AI_DATA_PACK_ROOT;
    assert.ok(inputRoot);
    const first = await generateAll({ inputRoot });
    const second = await generateAll({ inputRoot });
    assert.deepEqual(
      first.artifacts.map(({ logicalArtifactId, byteSize, sha256 }) => ({
        logicalArtifactId,
        byteSize,
        sha256,
      })),
      second.artifacts.map(({ logicalArtifactId, byteSize, sha256 }) => ({
        logicalArtifactId,
        byteSize,
        sha256,
      })),
    );
    for (const generated of first.artifacts) {
      const committed = await readFile(
        path.join(GENERATED_DIRECTORY, generated.fileName),
      );
      assert.equal(generated.byteSize, committed.length);
      assert.equal(generated.sha256, digest(committed));
      assert.equal(generated.bytes, committed.toString("utf8"));
    }
  },
);
