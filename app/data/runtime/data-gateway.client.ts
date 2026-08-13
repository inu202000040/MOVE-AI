import type {
  DataGatewayV1,
  GatewayResultV1,
  PendingGatewayResultV1,
  PendingQueryContractV1,
} from "../../contracts/gateway";
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
import {
  decodeChokepointDetailQueryV1,
  decodeMarketQueryV1,
  decodeNewsQueryV1,
  decodePortDetailQueryV1,
} from "./queries";
import { gatewayUnavailable } from "./result";

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
export type SnapshotProviderV1 = (
  signal?: AbortSignal,
) => SnapshotGatewayResultV1 | Promise<SnapshotGatewayResultV1>;
export type SameOriginFetchV1 = (input: string, init?: RequestInit) => Promise<Response>;

function unavailableSnapshotProvider(): SnapshotGatewayResultV1 {
  return gatewayUnavailable({
    state: "UNAVAILABLE",
    code: "SNAPSHOT_PROVIDER_UNAVAILABLE",
    message: "No validated snapshot provider was injected",
    reasonCode: "SNAPSHOT_PROVIDER_UNAVAILABLE",
    source: "snapshot-provider",
    fetchedAt: new Date().toISOString(),
    attribution: "MOVE AI approved data artifacts",
  });
}

function queryString(entries: readonly (readonly [string, string | number])[]): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) params.append(key, String(value));
  return params.toString();
}

export class SameOriginHttpDataGateway implements SharedDataGatewayV1 {
  constructor(
    private readonly fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch,
    private readonly snapshotProvider: SnapshotProviderV1 = unavailableSnapshotProvider,
  ) {}

  async snapshot(signal?: AbortSignal): Promise<GatewayResultV1<SnapshotDataV1, SnapshotStateV1>> {
    return decodeSnapshotResultV1(await this.snapshotProvider(signal));
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
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal,
    });
    return decodeInsightResultV1(value, body);
  }

  async tuningHealth(signal?: AbortSignal): Promise<GatewayResultV1<TuningHealthDataV1, TuningHealthStateV1>> {
    return decodeTuningHealthResultV1(await this.request("/api/freight-risk/tune", { signal }));
  }

  async tuningRun(body: TuneRequestV1, signal?: AbortSignal): Promise<GatewayResultV1<TuneSuccessV1, TuningRunStateV1>> {
    const value = await this.request("/api/freight-risk/tune", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal,
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
      await this.request(`/api/globe-chokepoint-traffic?${queryString([["id", query.id]])}`, { signal }), query,
    );
  }

  async weather(signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    return decodeWeatherUnavailableResultV1(await this.request("/api/globe-weather", { signal }));
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    if (!path.startsWith("/api/") || /^\/\//u.test(path)) throw new Error("Gateway request must use a same-origin API path");
    // Invoke the browser fetch function without rebinding its receiver to this
    // gateway instance. Some browser runtimes reject a branded Window.fetch
    // when it is called as an object method ("Illegal invocation").
    const fetchSameOrigin = this.fetchSameOrigin;
    const response = await fetchSameOrigin(path, init);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^application\/json(?:;|$)/iu.test(contentType)) throw new Error("Gateway response must be JSON");
    const body: unknown = await response.json();
    return body;
  }
}

export class CanonicalDataGatewayAdapterV1 implements DataGatewayV1 {
  constructor(readonly typedGateway: SharedDataGatewayV1) {}

  async snapshot(signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.snapshot(signal); }
  async market(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.market(decodeMarketQueryV1(query), signal); }
  async news(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.news(decodeNewsQueryV1(query), signal); }
  async insight(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.insight(decodeInsightRequestV1(query), signal); }
  async tuningHealth(signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.tuningHealth(signal); }
  async tuningRun(request: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.tuningRun(decodeTuneRequestV1(request), signal); }
  async portSummary(signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.portSummary(signal); }
  async portDetail(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.portDetail(decodePortDetailQueryV1(query), signal); }
  async chokeSummary(signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.chokeSummary(signal); }
  async chokeDetail(query: PendingQueryContractV1, signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.chokeDetail(decodeChokepointDetailQueryV1(query), signal); }
  async weather(signal?: AbortSignal): Promise<PendingGatewayResultV1> { return this.typedGateway.weather(signal); }
}

export class CanonicalSameOriginHttpDataGatewayV1 extends CanonicalDataGatewayAdapterV1 {
  constructor(
    fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch,
    snapshotProvider: SnapshotProviderV1 = unavailableSnapshotProvider,
  ) {
    super(new SameOriginHttpDataGateway(fetchSameOrigin, snapshotProvider));
  }
}

export function adaptDataGatewayV1(typedGateway: SharedDataGatewayV1): DataGatewayV1 {
  return new CanonicalDataGatewayAdapterV1(typedGateway);
}

export function createSameOriginDataGatewayV1(
  fetchSameOrigin: SameOriginFetchV1 = globalThis.fetch,
  snapshotProvider: SnapshotProviderV1 = unavailableSnapshotProvider,
): DataGatewayV1 {
  return new CanonicalSameOriginHttpDataGatewayV1(fetchSameOrigin, snapshotProvider);
}
