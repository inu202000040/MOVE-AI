import "maplibre-gl/dist/maplibre-gl.css";
import "./network.css";

import { liveWeatherGatewayV1 } from "../../api/globe-weather/weather-service";
import { validatedArtifactSeamV1 } from "../../data/runtime/data-gateway.server";
import { fixtureDataGateway } from "../../data/runtime/fixture-gateway";
import { NetworkPageClient } from "./NetworkPageClient";

async function NetworkPageContent() {
  const [
    artifacts,
    initialPortResult,
    initialChokepointResult,
    initialWeatherResult,
  ] = await Promise.all([
    validatedArtifactSeamV1(),
    fixtureDataGateway.portSummary(),
    fixtureDataGateway.chokeSummary(),
    liveWeatherGatewayV1.weather(),
  ]);
  return (
    <NetworkPageClient
      initialCatalogArtifacts={{
        networkCatalog: artifacts.networkCatalog,
        networkCatalogIdentity: artifacts.networkCatalogIdentity,
      }}
      initialChokepointResult={initialChokepointResult}
      initialPortResult={initialPortResult}
      initialWeatherResult={initialWeatherResult}
    />
  );
}

export default function NetworkPage() {
  return <NetworkPageContent />;
}
