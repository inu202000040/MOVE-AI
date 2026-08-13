import type {
  DataGatewayV1,
  GatewayResultV1,
  PendingGatewayResultV1,
  PendingQueryContractV1,
} from "../../contracts/gateway";
import networkCatalogArtifact from "../generated/network-catalog-seam-v1.json";
import networkCatalogIdentityArtifact from "../generated/network-catalog-seam-identity-v1.json";
import snapshotArtifact from "../generated/forecast-snapshot-v3.json";
import {
  assertNetworkCatalogIdentity,
  assertNetworkCatalogSeamIdentityV1,
  assertNetworkCatalogSeamV1,
} from "../artifacts/decoders";
import {
  type ChokepointDetailQueryV1,
  type ChokepointTrafficDataV1,
  type InsightDataV1,
  type InsightRequestV1,
  type MarketDataV1,
  type MarketQueryV1,
  type NewsDataV1,
  type NewsQueryV1,
  type PortDetailQueryV1,
  type PortTrafficDataV1,
  type SnapshotDataV1,
  type TuneRequestV1,
  type TuneSuccessV1,
  type TuningHealthDataV1,
  decodeInsightRequestV1,
  decodeTuneRequestV1,
} from "./domains";
import { fixtureDataGateway, FixtureDataGateway } from "./fixture-gateway";
import {
  decodeChokepointDetailResultV1,
  decodeChokepointSummaryResultV1,
  decodeInsightResultV1,
  decodeMarketResultV1,
  decodeNewsResultV1,
  decodePortDetailResultV1,
  decodePortSummaryResultV1,
  decodeSnapshotResultV1,
  decodeTuningHealthResultV1,
  decodeTuningRunResultV1,
  decodeWeatherUnavailableResultV1,
  type ChokepointStateV1,
  type InsightStateV1,
  type MarketStateV1,
  type NewsStateV1,
  type PortStateV1,
  type SnapshotStateV1,
  type TuningHealthStateV1,
  type TuningRunStateV1,
} from "./method-decoders";
import { gatewaySuccess } from "./result";
import {
  decodeChokepointDetailQueryV1,
  decodeMarketQueryV1,
  decodeNewsQueryV1,
  decodePortDetailQueryV1,
} from "./queries";

export interface SharedDataGatewayV1 {
  snapshot(signal?: AbortSignal): Promise<GatewayResultV1<SnapshotDataV1, SnapshotStateV1>>;
  market(query: MarketQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<MarketDataV1, MarketStateV1>>;
  news(query: NewsQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<NewsDataV1, NewsStateV1>>;
  insight(body: InsightRequestV1, signal?: AbortSignal): Promise<GatewayResultV1<InsightDataV1, InsightStateV1>>;
  tuningHealth(signal?: AbortSignal): Promise<GatewayResultV1<TuningHealthDataV1, TuningHealthStateV1>>;
  tuningRun(body: TuneRequestV1, signal?: AbortSignal): Promise<GatewayResultV1<TuneSuccessV1, TuningRunStateV1>>;
  portSummary(signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>>;
  portDetail(query: PortDetailQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>>;
  chokeSummary(signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>>;
  chokeDetail(query: ChokepointDetailQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>>;
  weather(signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">>;
}

export type SnapshotGatewayResultV1 = GatewayResultV1<SnapshotDataV1, SnapshotStateV1>;

export interface ValidatedArtifactSeamV1 {
  readonly snapshot: GatewayResultV1<SnapshotDataV1, SnapshotStateV1>;
  readonly networkCatalog: typeof networkCatalogArtifact;
  readonly networkCatalogIdentity: typeof networkCatalogIdentityArtifact;
}

export interface SharedDataAccessV1 {
  readonly gateway: DataGatewayV1;
  readonly typedGateway: SharedDataGatewayV1;
  readonly artifacts: ValidatedArtifactSeamV1;
}

export type SameOriginFetchV1 = (input: string, init?: RequestInit) => Promise<Response>;

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

function queryString(entries: readonly (readonly [string, string | number])[]): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) params.append(key, String(value));
  return params.toString();
}

export class SameOriginHttpDataGateway implements SharedDataGatewayV1 {
  constructor(private readonly fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch) {}

  async snapshot(_signal?: AbortSignal): Promise<GatewayResultV1<SnapshotDataV1, SnapshotStateV1>> {
    void _signal;
    return (await validatedArtifactSeamV1()).snapshot;
  }

  async market(query: MarketQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<MarketDataV1, MarketStateV1>> {
    const path = `/api/freight-risk/market?${queryString([
      ["series", query.series], ["from", query.from], ["to", query.to], ["providerVersion", query.providerVersion],
    ])}`;
    return decodeMarketResultV1(await this.request(path, { signal }), query);
  }

  async news(query: NewsQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<NewsDataV1, NewsStateV1>> {
    const entries: (readonly [string, string | number])[] = [
      ["route", query.route], ["asOf", query.asOf], ["providerVersion", query.providerVersion], ["retry", query.retry],
    ];
    if (query.refresh !== undefined) entries.push(["refresh", query.refresh]);
    return decodeNewsResultV1(await this.request(`/api/freight-risk/news?${queryString(entries)}`, { signal }), query);
  }

  async insight(body: InsightRequestV1, signal?: AbortSignal): Promise<GatewayResultV1<InsightDataV1, InsightStateV1>> {
    const value = await this.request("/api/freight-risk/insight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    return decodeInsightResultV1(value, body);
  }

  async tuningHealth(signal?: AbortSignal): Promise<GatewayResultV1<TuningHealthDataV1, TuningHealthStateV1>> {
    return decodeTuningHealthResultV1(await this.request("/api/freight-risk/tune", { signal }));
  }

  async tuningRun(body: TuneRequestV1, signal?: AbortSignal): Promise<GatewayResultV1<TuneSuccessV1, TuningRunStateV1>> {
    const value = await this.request("/api/freight-risk/tune", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    return decodeTuningRunResultV1(value, body);
  }

  async portSummary(signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>> {
    return decodePortSummaryResultV1(await this.request("/api/globe-port-traffic", { signal }));
  }

  async portDetail(query: PortDetailQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>> {
    const entries: (readonly [string, string | number])[] = [["id", query.id]];
    if (query.days !== undefined) entries.push(["days", query.days]);
    return decodePortDetailResultV1(await this.request(`/api/globe-port-traffic?${queryString(entries)}`, { signal }), query);
  }

  async chokeSummary(signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>> {
    return decodeChokepointSummaryResultV1(await this.request("/api/globe-chokepoint-traffic", { signal }));
  }

  async chokeDetail(query: ChokepointDetailQueryV1, signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>> {
    return decodeChokepointDetailResultV1(
      await this.request(`/api/globe-chokepoint-traffic?${queryString([["id", query.id]])}`, { signal }),
      query,
    );
  }

  async weather(signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    return decodeWeatherUnavailableResultV1(await this.request("/api/globe-weather", { signal }));
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    if (!path.startsWith("/api/") || /^\/\//u.test(path)) throw new Error("Gateway request must use a same-origin API path");
    const response = await this.fetchSameOrigin(path, init);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^application\/json(?:;|$)/iu.test(contentType)) throw new Error("Gateway response must be JSON");
    const body: unknown = await response.json();
    return body;
  }
}

export class CanonicalDataGatewayAdapterV1 implements DataGatewayV1 {
  constructor(readonly typedGateway: SharedDataGatewayV1) {}

  async snapshot(signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.snapshot(signal);
  }

  async market(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.market(decodeMarketQueryV1(query), signal);
  }

  async news(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.news(decodeNewsQueryV1(query), signal);
  }

  async insight(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.insight(decodeInsightRequestV1(query), signal);
  }

  async tuningHealth(signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.tuningHealth(signal);
  }

  async tuningRun(request: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.tuningRun(decodeTuneRequestV1(request), signal);
  }

  async portSummary(signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.portSummary(signal);
  }

  async portDetail(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.portDetail(decodePortDetailQueryV1(query), signal);
  }

  async chokeSummary(signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.chokeSummary(signal);
  }

  async chokeDetail(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.chokeDetail(decodeChokepointDetailQueryV1(query), signal);
  }

  async weather(signal?: AbortSignal): Promise<PendingGatewayResultV1> {
    return this.typedGateway.weather(signal);
  }
}

export class CanonicalFixtureDataGatewayV1 extends CanonicalDataGatewayAdapterV1 {
  constructor() {
    super(new FixtureDataGateway());
  }
}

export class CanonicalSameOriginHttpDataGatewayV1 extends CanonicalDataGatewayAdapterV1 {
  constructor(fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch) {
    super(new SameOriginHttpDataGateway(fetchSameOrigin));
  }
}

export function adaptDataGatewayV1(typedGateway: SharedDataGatewayV1): DataGatewayV1 {
  return new CanonicalDataGatewayAdapterV1(typedGateway);
}

export function createFixtureDataGatewayV1(): DataGatewayV1 {
  return new CanonicalFixtureDataGatewayV1();
}

export function createSameOriginDataGatewayV1(
  fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch,
): DataGatewayV1 {
  return new CanonicalSameOriginHttpDataGatewayV1(fetchSameOrigin);
}

export async function createFixtureDataAccessV1(): Promise<SharedDataAccessV1> {
  return {
    gateway: adaptDataGatewayV1(fixtureDataGateway),
    typedGateway: fixtureDataGateway,
    artifacts: await validatedArtifactSeamV1(),
  };
}

export async function createSameOriginDataAccessV1(
  fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch,
): Promise<SharedDataAccessV1> {
  const typedGateway = new SameOriginHttpDataGateway(fetchSameOrigin);
  return {
    gateway: adaptDataGatewayV1(typedGateway),
    typedGateway,
    artifacts: await validatedArtifactSeamV1(),
  };
}

const fixtureGatewayTypeCheck: SharedDataGatewayV1 = new FixtureDataGateway();
void fixtureGatewayTypeCheck;
const canonicalFixtureGatewayTypeCheck: DataGatewayV1 = new CanonicalFixtureDataGatewayV1();
const canonicalHttpGatewayTypeCheck: DataGatewayV1 = new CanonicalSameOriginHttpDataGatewayV1();
void canonicalFixtureGatewayTypeCheck;
void canonicalHttpGatewayTypeCheck;
