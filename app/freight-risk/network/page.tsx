import "maplibre-gl/dist/maplibre-gl.css";
import "./network.css";

import { validatedArtifactSeamV1 } from "../../data/runtime/data-gateway";
import { NetworkPageClient } from "./NetworkPageClient";

export default async function NetworkPage() {
  const artifacts = await validatedArtifactSeamV1();
  return (
    <NetworkPageClient
      initialCatalogArtifacts={{
        networkCatalog: artifacts.networkCatalog,
        networkCatalogIdentity: artifacts.networkCatalogIdentity,
      }}
    />
  );
}
