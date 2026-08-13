export const GATEWAY_SCHEMA_VERSION = "move-ai/gateway/v1" as const;

export const DATA_MODES = [
  "live",
  "fixture",
  "cached",
  "unavailable",
] as const;

export type DataModeV1 = (typeof DATA_MODES)[number];

export const GATEWAY_ROOT_KEYS = [
  "schemaVersion",
  "state",
  "data",
  "meta",
  "error",
] as const;

export const GATEWAY_ERROR_KEYS = [
  "code",
  "message",
  "retryable",
  "upstreamStatus",
  "details",
] as const;

export const GATEWAY_ERROR_DETAIL_KEYS = ["reasonCode"] as const;

export const GATEWAY_META_KEYS = [
  "mode",
  "source",
  "sourceUrl",
  "asOf",
  "fetchedAt",
  "unit",
  "isEstimate",
  "attribution",
  "warnings",
  "provider",
  "cache",
] as const;

export const GATEWAY_CACHE_KEYS = ["hit", "stale", "ageSeconds"] as const;

export interface GatewayErrorV1 {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly upstreamStatus: number | null;
  readonly details: GatewayErrorDetailsV1 | null;
}

export interface GatewayErrorDetailsV1 {
  readonly reasonCode: string;
}

export interface GatewayCacheMetaV1 {
  readonly hit: boolean;
  readonly stale: boolean;
  readonly ageSeconds: number | null;
}

export interface GatewayMetaV1 {
  readonly mode: DataModeV1;
  readonly source: string;
  readonly sourceUrl: string | null;
  readonly asOf: string | null;
  readonly fetchedAt: string;
  readonly unit: string | null;
  readonly isEstimate: boolean;
  readonly attribution: string;
  readonly warnings: readonly string[];
  readonly provider: string | null;
  readonly cache: GatewayCacheMetaV1;
}

export function isGatewaySchemaVersion(
  value: unknown,
): value is typeof GATEWAY_SCHEMA_VERSION {
  return value === GATEWAY_SCHEMA_VERSION;
}

export interface GatewayResultV1<TData, TState extends string> {
  readonly schemaVersion: typeof GATEWAY_SCHEMA_VERSION;
  readonly state: TState;
  readonly data: TData | null;
  readonly meta: GatewayMetaV1;
  readonly error: GatewayErrorV1 | null;
}

export type PendingDomainContractV1 = Readonly<Record<string, unknown>>;
export type PendingQueryContractV1 = Readonly<Record<string, unknown>>;
export type PendingGatewayResultV1 = GatewayResultV1<
  PendingDomainContractV1,
  string
>;

export const DATA_GATEWAY_METHODS = [
  "snapshot",
  "market",
  "news",
  "insight",
  "tuningHealth",
  "tuningRun",
  "portSummary",
  "portDetail",
  "chokeSummary",
  "chokeDetail",
  "weather",
] as const;

export interface DataGatewayV1 {
  snapshot(signal?: AbortSignal): Promise<PendingGatewayResultV1>;
  market(
    query: PendingQueryContractV1,
    signal?: AbortSignal,
  ): Promise<PendingGatewayResultV1>;
  news(
    query: PendingQueryContractV1,
    signal?: AbortSignal,
  ): Promise<PendingGatewayResultV1>;
  insight(
    query: PendingQueryContractV1,
    signal?: AbortSignal,
  ): Promise<PendingGatewayResultV1>;
  tuningHealth(signal?: AbortSignal): Promise<PendingGatewayResultV1>;
  tuningRun(
    request: PendingQueryContractV1,
    signal?: AbortSignal,
  ): Promise<PendingGatewayResultV1>;
  portSummary(signal?: AbortSignal): Promise<PendingGatewayResultV1>;
  portDetail(
    query: PendingQueryContractV1,
    signal?: AbortSignal,
  ): Promise<PendingGatewayResultV1>;
  chokeSummary(signal?: AbortSignal): Promise<PendingGatewayResultV1>;
  chokeDetail(
    query: PendingQueryContractV1,
    signal?: AbortSignal,
  ): Promise<PendingGatewayResultV1>;
  weather(signal?: AbortSignal): Promise<PendingGatewayResultV1>;
}
