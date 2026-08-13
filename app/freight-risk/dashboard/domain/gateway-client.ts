import type { DataGatewayV1, RouteId } from "../../../contracts";

import {
  decodeInsightGatewayResult,
  decodeMarketGatewayResult,
  decodeNewsGatewayResult,
  type InsightGatewayResultV1,
  type NewsGatewayResultV1,
} from "./gateway-result";
import type { InsightRequestV1 } from "./insight-request";
import { createMarketQuery, type MarketGatewayResultV1, type MarketSeriesV1 } from "./market";
import { chooseNewsRetryData, createNewsQuery } from "./news";

export type DashboardDataGatewayV1 = Pick<DataGatewayV1, "market" | "news" | "insight">;

export type NewsCollectionResultV1 =
  | { readonly kind: "READY"; readonly result: NewsGatewayResultV1 }
  | { readonly kind: "VERIFIED_EMPTY" | "ERROR"; readonly result: NewsGatewayResultV1 };

export async function requestMarket(
  gateway: DashboardDataGatewayV1,
  series: MarketSeriesV1,
  periodEnd: string,
  signal?: AbortSignal,
): Promise<MarketGatewayResultV1 | null> {
  const query = createMarketQuery(series, periodEnd);
  if (query === null) {
    return null;
  }
  const value: unknown = await gateway.market({ ...query }, signal);
  return decodeMarketGatewayResult(value, series);
}

export async function collectNews(
  gateway: DashboardDataGatewayV1,
  route: RouteId,
  refresh: string | undefined,
  signal?: AbortSignal,
): Promise<NewsCollectionResultV1 | null> {
  const firstValue: unknown = await gateway.news({ ...createNewsQuery(route, 0, refresh) }, signal);
  const first = decodeNewsGatewayResult(firstValue, route);
  if (first === null) {
    return null;
  }
  const needsRetry = first.state === "LIVE"
    ? (first.data?.articles.length ?? 0) < 5
    : first.error?.code === "NO_VALID_DATA";
  if (!needsRetry) {
    return { kind: first.state === "LIVE" ? "READY" : "ERROR", result: first };
  }
  const retryValue: unknown = await gateway.news({ ...createNewsQuery(route, 1, refresh) }, signal);
  const retry = decodeNewsGatewayResult(retryValue, route);
  if (retry === null) {
    return first.state === "LIVE"
      ? { kind: "READY", result: first }
      : { kind: "ERROR", result: first };
  }
  if (first.state === "LIVE" && first.data !== null) {
    if (retry.state !== "LIVE" || retry.data === null) {
      return { kind: "READY", result: first };
    }
    return {
      kind: "READY",
      result: chooseNewsRetryData(first.data, retry.data) === first.data ? first : retry,
    };
  }
  if (retry.state === "LIVE") {
    return { kind: "READY", result: retry };
  }
  return {
    kind: retry.error?.code === "NO_VALID_DATA" ? "VERIFIED_EMPTY" : "ERROR",
    result: retry,
  };
}

export async function requestInsight(
  gateway: DashboardDataGatewayV1,
  request: InsightRequestV1,
  signal?: AbortSignal,
): Promise<InsightGatewayResultV1 | null> {
  const value: unknown = await gateway.insight({ ...request }, signal);
  return decodeInsightGatewayResult(value);
}
