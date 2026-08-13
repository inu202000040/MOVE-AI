import type {
  DataGatewayV1,
  GatewayResultV1,
} from "../../../contracts/gateway";
import type {
  ChokepointDetailQueryV1,
  ChokepointTrafficDataV1,
  PortDetailQueryV1,
  PortTrafficDataV1,
  WeatherDataV1,
} from "../../../data/runtime/domains";
import {
  decodeChokepointDetailResultV1,
  decodeChokepointSummaryResultV1,
  decodePortDetailResultV1,
  decodePortSummaryResultV1,
  decodeWeatherResultV1,
  type ChokepointStateV1,
  type PortStateV1,
  type WeatherStateV1,
} from "../../../data/runtime/method-decoders";

export type { ChokepointStateV1, PortStateV1, WeatherStateV1 };

export interface NetworkDomainGatewayV1 {
  portSummary(
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>>;
  portDetail(
    query: PortDetailQueryV1,
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>>;
  chokeSummary(
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>>;
  chokeDetail(
    query: ChokepointDetailQueryV1,
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>>;
  weather(
    signal?: AbortSignal,
  ): Promise<GatewayResultV1<WeatherDataV1, WeatherStateV1>>;
}

export function adaptNetworkDataGatewayV1(
  gateway: DataGatewayV1,
): NetworkDomainGatewayV1 {
  return {
    async portSummary(signal) {
      return decodePortSummaryResultV1(await gateway.portSummary(signal));
    },
    async portDetail(query, signal) {
      return decodePortDetailResultV1(
        await gateway.portDetail(
          query.days === undefined
            ? { id: query.id }
            : { id: query.id, days: query.days },
          signal,
        ),
        query,
      );
    },
    async chokeSummary(signal) {
      return decodeChokepointSummaryResultV1(await gateway.chokeSummary(signal));
    },
    async chokeDetail(query, signal) {
      return decodeChokepointDetailResultV1(
        await gateway.chokeDetail({ id: query.id }, signal),
        query,
      );
    },
    async weather(signal) {
      return decodeWeatherResultV1(await gateway.weather(signal));
    },
  };
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
