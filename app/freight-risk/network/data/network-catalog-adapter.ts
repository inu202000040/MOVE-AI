import {
  decodeNetworkCatalogIdentity,
  decodeNetworkCatalogSeam,
  validateNetworkCatalogHandoff,
  type CatalogValidationIssue,
  type NetworkCatalogHandoff,
  type NetworkCatalogIdentity,
  type NetworkCatalogSeam,
} from "../core/catalog-consumer";

export type NetworkCatalogMode = "canonical" | "fixture";

export type NetworkCatalogAdapterResult =
  | {
      readonly state: "READY";
      readonly mode: NetworkCatalogMode;
      readonly catalog: NetworkCatalogSeam;
      readonly identity: NetworkCatalogIdentity | null;
      readonly source: string;
      readonly attribution: string;
      readonly asOf: string;
    }
  | {
      readonly state: "UNAVAILABLE";
      readonly code: "CATALOG_UNAVAILABLE" | "CATALOG_CONTRACT_MISMATCH";
      readonly retryable: boolean;
      readonly issues: readonly CatalogValidationIssue[];
    };

export interface NetworkCatalogAdapterV1 {
  load(signal?: AbortSignal): Promise<NetworkCatalogAdapterResult>;
}

export interface ValidatedArtifactCatalogInput {
  readonly load: () => Promise<{
    readonly networkCatalog: unknown;
    readonly networkCatalogIdentity: unknown;
  }>;
  readonly source: string;
  readonly attribution: string;
}

export function createValidatedArtifactCatalogAdapter(
  input: ValidatedArtifactCatalogInput,
): NetworkCatalogAdapterV1 {
  return {
    async load(signal) {
      if (signal?.aborted) {
        return {
          state: "UNAVAILABLE",
          code: "CATALOG_UNAVAILABLE",
          retryable: true,
          issues: [],
        };
      }
      try {
        const artifacts = await input.load();
        if (signal?.aborted) {
          return {
            state: "UNAVAILABLE",
            code: "CATALOG_UNAVAILABLE",
            retryable: true,
            issues: [],
          };
        }
        const catalog = decodeNetworkCatalogSeam(artifacts.networkCatalog);
        const identity = decodeNetworkCatalogIdentity(
          artifacts.networkCatalogIdentity,
        );
        if (
          !catalog ||
          !identity ||
          identity.routeCount !== catalog.routes.length ||
          identity.portCount !== catalog.ports.length ||
          identity.uniquePortSeriesCount !==
            new Set(catalog.ports.map(({ upstreamPortWatchId }) => upstreamPortWatchId))
              .size ||
          identity.chokepointCount !== catalog.chokepoints.length ||
          identity.weatherCount !== catalog.weather.length ||
          identity.referenceManifestSha256 !== catalog.referenceManifestSha256
        ) {
          return {
            state: "UNAVAILABLE",
            code: "CATALOG_CONTRACT_MISMATCH",
            retryable: false,
            issues: ["CATALOG_STRUCTURE_INVALID"],
          };
        }
        return {
          state: "READY",
          mode: "canonical",
          catalog,
          identity,
          source: input.source,
          attribution: input.attribution,
          asOf: catalog.capturedAt,
        };
      } catch {
        return {
          state: "UNAVAILABLE",
          code: "CATALOG_CONTRACT_MISMATCH",
          retryable: false,
          issues: ["CATALOG_STRUCTURE_INVALID"],
        };
      }
    },
  };
}

export interface ReferenceCatalogInput {
  readonly catalog: unknown;
  readonly source: string;
  readonly attribution: string;
  readonly asOf: string;
}

export function createReferenceCatalogAdapter(
  input: ReferenceCatalogInput,
): NetworkCatalogAdapterV1 {
  return {
    async load(signal) {
      if (signal?.aborted) {
        return {
          state: "UNAVAILABLE",
          code: "CATALOG_UNAVAILABLE",
          retryable: true,
          issues: [],
        };
      }
      const catalog = decodeNetworkCatalogSeam(input.catalog);
      if (!catalog) {
        return {
          state: "UNAVAILABLE",
          code: "CATALOG_CONTRACT_MISMATCH",
          retryable: false,
          issues: ["CATALOG_STRUCTURE_INVALID"],
        };
      }
      return {
        state: "READY",
        mode: "fixture",
        catalog,
        identity: null,
        source: input.source,
        attribution: input.attribution,
        asOf: input.asOf,
      };
    },
  };
}

export interface CanonicalCatalogInput {
  readonly handoff: NetworkCatalogHandoff;
  readonly source: string;
  readonly attribution: string;
}

export function createCanonicalCatalogAdapter(
  input: CanonicalCatalogInput,
): NetworkCatalogAdapterV1 {
  return {
    async load(signal) {
      if (signal?.aborted) {
        return {
          state: "UNAVAILABLE",
          code: "CATALOG_UNAVAILABLE",
          retryable: true,
          issues: [],
        };
      }
      const validation = await validateNetworkCatalogHandoff(input.handoff);
      if (!validation.compatible) {
        return {
          state: "UNAVAILABLE",
          code: "CATALOG_CONTRACT_MISMATCH",
          retryable: false,
          issues: validation.issues,
        };
      }
      return {
        state: "READY",
        mode: "canonical",
        catalog: validation.catalog,
        identity: validation.identity,
        source: input.source,
        attribution: input.attribution,
        asOf: validation.catalog.capturedAt,
      };
    },
  };
}
