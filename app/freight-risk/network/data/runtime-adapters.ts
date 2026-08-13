import {
  APPROVED_REFERENCE_CATALOG,
  APPROVED_REFERENCE_PROVENANCE,
} from "./approved-reference-fixture";
import {
  createReferenceCatalogAdapter,
  type NetworkCatalogAdapterV1,
} from "./network-catalog-adapter";
import {
  createUnavailableNetworkGateway,
  type NetworkSharedDataGatewayV1,
} from "./network-domain-adapter";

export interface NetworkRuntimeAdaptersV1 {
  readonly catalog: NetworkCatalogAdapterV1;
  readonly gateway: NetworkSharedDataGatewayV1;
}

export function createInterimNetworkRuntimeAdapters(): NetworkRuntimeAdaptersV1 {
  return {
    catalog: createReferenceCatalogAdapter({
      catalog: APPROVED_REFERENCE_CATALOG,
      source: APPROVED_REFERENCE_PROVENANCE.source,
      attribution: APPROVED_REFERENCE_PROVENANCE.attribution,
      asOf: APPROVED_REFERENCE_PROVENANCE.capturedAt,
    }),
    gateway: createUnavailableNetworkGateway(),
  };
}
