import consumerFixtureArtifact from "../generated/consumer-integration-fixtures-v1.json";
import networkCatalogIdentity from "../generated/network-catalog-seam-identity-v1.json";
import { assertConsumerIntegrationFixturesV1 } from "../artifacts/decoders";
import { array, integer, literal, oneOf, record, string } from "../artifacts/decoder-core";

export const CONSUMER_IDS_V1 = ["dashboard", "modelLab", "globe", "allocation"] as const;
export type ConsumerIdV1 = (typeof CONSUMER_IDS_V1)[number];

export const CONSUMER_GATEWAY_METHODS_V1 = [
  "snapshot",
  "market",
  "news",
  "insight",
  "tuningHealth",
  "tuningRun",
  "portSummary",
  "chokeSummary",
  "weather",
] as const;
export type ConsumerGatewayMethodV1 = (typeof CONSUMER_GATEWAY_METHODS_V1)[number];

export interface ConsumerFixtureResourceV1 {
  readonly method: ConsumerGatewayMethodV1;
  readonly fixtureId: string;
  readonly expectedState: string;
  readonly expectedMode: "fixture" | "unavailable";
  readonly expectedStatus: number;
  readonly expectedCacheControl: string;
  readonly expectedConsumerState: "ready" | "stale" | "unavailable";
}

function decodeResource(value: unknown, path: string): ConsumerFixtureResourceV1 {
  const root = record(value, path);
  return {
    method: oneOf(root.method, CONSUMER_GATEWAY_METHODS_V1, `${path}.method`),
    fixtureId: string(root.fixtureId, `${path}.fixtureId`),
    expectedState: string(root.expectedState, `${path}.expectedState`),
    expectedMode: oneOf(root.expectedMode, ["fixture", "unavailable"] as const, `${path}.expectedMode`),
    expectedStatus: integer(root.expectedStatus, `${path}.expectedStatus`),
    expectedCacheControl: string(root.expectedCacheControl, `${path}.expectedCacheControl`),
    expectedConsumerState: oneOf(
      root.expectedConsumerState,
      ["ready", "stale", "unavailable"] as const,
      `${path}.expectedConsumerState`,
    ),
  };
}

assertConsumerIntegrationFixturesV1(consumerFixtureArtifact);
const root = record(consumerFixtureArtifact, "$consumerFixtures");
literal(
  string(root.networkCatalogSeamSha256, "networkCatalogSeamSha256"),
  networkCatalogIdentity.catalogSeamSha256,
  "networkCatalogSeamSha256",
);
const consumers = record(root.consumers, "$consumerFixtures.consumers");

export const consumerIntegrationFixturesV1: Readonly<
  Record<ConsumerIdV1, readonly ConsumerFixtureResourceV1[]>
> = Object.freeze({
  dashboard: array(consumers.dashboard, "consumers.dashboard").map((value, index) =>
    decodeResource(value, `consumers.dashboard[${index}]`),
  ),
  modelLab: array(consumers.modelLab, "consumers.modelLab").map((value, index) =>
    decodeResource(value, `consumers.modelLab[${index}]`),
  ),
  globe: array(consumers.globe, "consumers.globe").map((value, index) =>
    decodeResource(value, `consumers.globe[${index}]`),
  ),
  allocation: array(consumers.allocation, "consumers.allocation").map((value, index) =>
    decodeResource(value, `consumers.allocation[${index}]`),
  ),
});

export function fixturesForConsumerV1(consumer: ConsumerIdV1): readonly ConsumerFixtureResourceV1[] {
  return consumerIntegrationFixturesV1[consumer];
}
