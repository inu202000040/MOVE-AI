// Server-only compatibility entry. Client code must import data-gateway.client.
export {
  CanonicalFixtureDataGatewayV1,
  createFixtureDataAccessV1,
  createFixtureDataGatewayV1,
  createSameOriginDataAccessV1,
  validatedArtifactSeamV1,
  validatedSnapshotGatewayResultV1,
  type SharedDataAccessV1,
  type ValidatedArtifactSeamV1,
} from "./data-gateway.server";
