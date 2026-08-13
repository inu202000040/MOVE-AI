import {
  GATEWAY_SCHEMA_VERSION,
  type GatewayResultV1,
} from "../../../contracts/gateway";

export type PortStateV1 = "LIVE" | "PARTIAL" | "STALE" | "UNAVAILABLE";
export type ChokepointStateV1 = "LIVE" | "STALE" | "UNAVAILABLE";
export type WeatherStateV1 = "LIVE" | "PARTIAL" | "UNAVAILABLE";

export interface PortDetailQueryV1 {
  readonly id: string;
  readonly days?: number;
}

export interface ChokepointDetailQueryV1 {
  readonly id: string;
}

export interface NetworkSharedDataGatewayV1 {
  portSummary(
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<unknown, PortStateV1>>;
  portDetail(
    query: PortDetailQueryV1,
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<unknown, PortStateV1>>;
  chokeSummary(
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<unknown, ChokepointStateV1>>;
  chokeDetail(
    query: ChokepointDetailQueryV1,
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<unknown, ChokepointStateV1>>;
  weather(
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<unknown, WeatherStateV1>>;
}

export type NetworkResourceState<TData, TDomainState extends string> =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly attempt: number }
  | {
      readonly status: "ready";
      readonly attempt: number;
      readonly result: GatewayResultV1<TData, TDomainState>;
    }
  | {
      readonly status: "empty";
      readonly attempt: number;
      readonly result: GatewayResultV1<TData, TDomainState>;
    }
  | {
      readonly status: "error";
      readonly attempt: number;
      readonly result: GatewayResultV1<TData, TDomainState> | null;
      readonly retryable: boolean;
      readonly message: string;
    };

export function resolveNetworkResource<TData, TDomainState extends string>(
  result: GatewayResultV1<TData, TDomainState>,
  attempt: number,
  isEmpty: (data: TData) => boolean = () => false,
): NetworkResourceState<TData, TDomainState> {
  if (result.data === null || result.error !== null) {
    return {
      status: "error",
      attempt,
      result,
      retryable: result.error?.retryable ?? false,
      message: result.error?.message ?? "데이터를 불러올 수 없습니다.",
    };
  }
  if (isEmpty(result.data)) {
    return { status: "empty", attempt, result };
  }
  return { status: "ready", attempt, result };
}

function unavailable<TState extends string>(
  state: TState,
  source: string,
): GatewayResultV1<never, TState> {
  return {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state,
    data: null,
    meta: {
      mode: "unavailable",
      source,
      sourceUrl: null,
      asOf: null,
      fetchedAt: "2026-08-13T00:00:00+09:00",
      unit: null,
      isEstimate: false,
      attribution: "",
      warnings: [],
      provider: null,
      cache: { hit: false, stale: false, ageSeconds: null },
    },
    error: {
      code: "UPSTREAM_UNAVAILABLE",
      message: "데이터를 불러올 수 없습니다.",
      retryable: true,
      upstreamStatus: null,
      details: { reasonCode: "SHARED_GATEWAY_PENDING" },
    },
  };
}

export function createUnavailableNetworkGateway(): NetworkSharedDataGatewayV1 {
  return {
    async portSummary() {
      return unavailable("UNAVAILABLE", "network-port-summary");
    },
    async portDetail() {
      return unavailable("UNAVAILABLE", "network-port-detail");
    },
    async chokeSummary() {
      return unavailable("UNAVAILABLE", "network-chokepoint-summary");
    },
    async chokeDetail() {
      return unavailable("UNAVAILABLE", "network-chokepoint-detail");
    },
    async weather() {
      return unavailable("UNAVAILABLE", "network-weather");
    },
  };
}
