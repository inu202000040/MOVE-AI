import "maplibre-gl/dist/maplibre-gl.css";
import "./network.css";

import { validatedArtifactSeamV1 } from "../../data/runtime/data-gateway.server";
import { NetworkPageClient } from "./NetworkPageClient";

async function NetworkPageContent() {
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

export default function NetworkPage() {
  return <NetworkPageContent />;
}
