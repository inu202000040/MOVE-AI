import type { DataGatewayV1 } from "../../../contracts/gateway";
import {
  createValidatedArtifactCatalogAdapter,
  type NetworkCatalogAdapterV1,
} from "./network-catalog-adapter";
import {
  adaptNetworkDataGatewayV1,
  type NetworkDomainGatewayV1,
} from "./network-domain-adapter";

export interface NetworkCatalogArtifactPropsV1 {
  readonly networkCatalog: unknown;
  readonly networkCatalogIdentity: unknown;
}

export interface NetworkRuntimeAdaptersV1 {
  readonly catalog: NetworkCatalogAdapterV1;
  readonly gateway: NetworkDomainGatewayV1 | null;
}

export function createNetworkRuntimeAdapters(input: {
  readonly artifacts: NetworkCatalogArtifactPropsV1;
  readonly gateway?: DataGatewayV1;
}): NetworkRuntimeAdaptersV1 {
  return {
    catalog: createValidatedArtifactCatalogAdapter({
      load: async () => input.artifacts,
      source: "network-catalog-seam-v1",
      attribution: "MOVE AI approved data pack",
    }),
    gateway: input.gateway ? adaptNetworkDataGatewayV1(input.gateway) : null,
  };
}
