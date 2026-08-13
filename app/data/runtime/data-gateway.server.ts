import type { DataGatewayV1 } from "../../contracts/gateway";
import networkCatalogArtifact from "../generated/network-catalog-seam-v1.json";
import networkCatalogIdentityArtifact from "../generated/network-catalog-seam-identity-v1.json";
import snapshotArtifact from "../generated/forecast-snapshot-v3.json";
import {
  assertNetworkCatalogIdentity,
  assertNetworkCatalogSeamIdentityV1,
  assertNetworkCatalogSeamV1,
} from "../artifacts/decoders";
import {
  CanonicalDataGatewayAdapterV1,
  SameOriginHttpDataGateway,
  type SameOriginFetchV1,
  type SharedDataGatewayV1,
  type SnapshotGatewayResultV1,
} from "./data-gateway.client";
import { fixtureDataGateway, FixtureDataGateway } from "./fixture-gateway";
import { decodeSnapshotResultV1 } from "./method-decoders";
import { gatewaySuccess } from "./result";

export interface ValidatedArtifactSeamV1 {
  readonly snapshot: SnapshotGatewayResultV1;
  readonly networkCatalog: typeof networkCatalogArtifact;
  readonly networkCatalogIdentity: typeof networkCatalogIdentityArtifact;
}

export interface SharedDataAccessV1 {
  readonly gateway: DataGatewayV1;
  readonly typedGateway: SharedDataGatewayV1;
  readonly artifacts: ValidatedArtifactSeamV1;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const validatedSnapshotResultV1 = deepFreeze(decodeSnapshotResultV1(gatewaySuccess({
  state: "READY",
  data: snapshotArtifact,
  mode: "fixture",
  source: "forecast-snapshot-v3",
  asOf: "2026-08-03",
  fetchedAt: "2026-08-13T00:00:00+09:00",
  unit: "USD/FEU",
  isEstimate: true,
  attribution: "KOBC KCCI and approved model workbooks",
})));

let validatedArtifactsPromise: Promise<ValidatedArtifactSeamV1> | undefined;

export function validatedArtifactSeamV1(): Promise<ValidatedArtifactSeamV1> {
  validatedArtifactsPromise ??= (async () => {
    assertNetworkCatalogSeamV1(networkCatalogArtifact);
    assertNetworkCatalogSeamIdentityV1(networkCatalogIdentityArtifact);
    const canonicalBytes = new TextEncoder().encode(`${JSON.stringify(networkCatalogArtifact)}\n`);
    await assertNetworkCatalogIdentity(canonicalBytes, networkCatalogArtifact, networkCatalogIdentityArtifact);
    return deepFreeze({
      snapshot: validatedSnapshotResultV1,
      networkCatalog: networkCatalogArtifact,
      networkCatalogIdentity: networkCatalogIdentityArtifact,
    });
  })();
  return validatedArtifactsPromise;
}

export async function validatedSnapshotGatewayResultV1(): Promise<SnapshotGatewayResultV1> {
  return (await validatedArtifactSeamV1()).snapshot;
}

export class CanonicalFixtureDataGatewayV1 extends CanonicalDataGatewayAdapterV1 {
  constructor() {
    super(new FixtureDataGateway());
  }
}

export function createFixtureDataGatewayV1(): DataGatewayV1 {
  return new CanonicalFixtureDataGatewayV1();
}

export async function createFixtureDataAccessV1(): Promise<SharedDataAccessV1> {
  return {
    gateway: new CanonicalDataGatewayAdapterV1(fixtureDataGateway),
    typedGateway: fixtureDataGateway,
    artifacts: await validatedArtifactSeamV1(),
  };
}

export async function createSameOriginDataAccessV1(
  fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch,
): Promise<SharedDataAccessV1> {
  const typedGateway = new SameOriginHttpDataGateway(fetchSameOrigin, validatedSnapshotGatewayResultV1);
  return {
    gateway: new CanonicalDataGatewayAdapterV1(typedGateway),
    typedGateway,
    artifacts: await validatedArtifactSeamV1(),
  };
}
