import { ROUTE_IDS, type RouteId } from "../../contracts/routes";
import type {
  ChokepointDetailQueryV1,
  MarketQueryV1,
  NewsQueryV1,
  PortDetailQueryV1,
} from "./domains";
import {
  exactKeys,
  literal,
  oneOf,
  record,
  string,
} from "../artifacts/decoder-core";

export class InvalidRequestError extends Error {
  readonly code = "INVALID_REQUEST";
}

function valuesByKey(params: URLSearchParams): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const [key, value] of params) {
    const values = map.get(key);
    if (values) values.push(value);
    else map.set(key, [value]);
  }
  return map;
}

function exactParams(
  params: URLSearchParams,
  required: readonly string[],
  optional: readonly string[] = [],
): Readonly<Record<string, string>> {
  const values = valuesByKey(params);
  const allowed = new Set([...required, ...optional]);
  for (const [key, entries] of values) {
    if (!allowed.has(key)) throw new InvalidRequestError(`허용되지 않는 query key: ${key}`);
    if (entries.length !== 1) throw new InvalidRequestError(`중복 query key: ${key}`);
  }
  const result: Record<string, string> = {};
  for (const key of required) {
    const value = values.get(key)?.[0];
    if (!value) throw new InvalidRequestError(`필수 query key 누락: ${key}`);
    result[key] = value;
  }
  for (const key of optional) {
    const value = values.get(key)?.[0];
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function isoDate(value: string, key: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidRequestError(`${key}는 유효한 ISO date여야 합니다.`);
  }
  return value;
}

function routeId(value: string): RouteId {
  const route = ROUTE_IDS.find((candidate) => candidate === value);
  if (!route) throw new InvalidRequestError("존재하지 않는 route입니다.");
  return route;
}

export function parseMarketQuery(params: URLSearchParams): MarketQueryV1 {
  const query = exactParams(params, ["series", "from", "to", "providerVersion"]);
  const series = (["fx", "oil", "bunker", "harpex"] as const).find(
    (candidate) => candidate === query.series,
  );
  if (!series) throw new InvalidRequestError("존재하지 않는 market series입니다.");
  const from = isoDate(query.from, "from");
  const to = isoDate(query.to, "to");
  if (from > to) throw new InvalidRequestError("from은 to보다 늦을 수 없습니다.");
  if (query.providerVersion !== "3") {
    throw new InvalidRequestError("providerVersion은 3이어야 합니다.");
  }
  return { series, from, to, providerVersion: 3 };
}

export function parseNewsQuery(params: URLSearchParams): NewsQueryV1 {
  const query = exactParams(
    params,
    ["route", "asOf", "providerVersion", "retry"],
    ["refresh"],
  );
  if (query.providerVersion !== "18") {
    throw new InvalidRequestError("providerVersion은 18이어야 합니다.");
  }
  const retry = query.retry === "0" ? 0 : query.retry === "1" ? 1 : null;
  if (retry === null) throw new InvalidRequestError("retry는 0 또는 1이어야 합니다.");
  const refresh = query.refresh;
  return {
    route: routeId(query.route),
    asOf: query.asOf === "latest" ? "latest" : isoDate(query.asOf, "asOf"),
    providerVersion: 18,
    retry,
    ...(refresh === undefined ? {} : { refresh }),
  };
}

export function parseNewsCompatibilityQuery(params: URLSearchParams): NewsQueryV1 {
  const routeValue = params.get("route") ?? "KNEI";
  const route = ROUTE_IDS.find((candidate) => candidate === routeValue) ?? "KNEI";
  const asOfValue = params.get("asOf") ?? "latest";
  let asOf = "latest";
  if (asOfValue !== "latest") {
    try {
      asOf = isoDate(asOfValue, "asOf");
    } catch {
      // Compatibility input retains the canonical latest sentinel.
    }
  }
  const retry = params.get("retry") === "1" ? 1 : 0;
  const refresh = params.get("refresh");
  return {
    route,
    asOf,
    providerVersion: 18,
    retry,
    ...(refresh === null ? {} : { refresh }),
  };
}

export function parseEmptyQuery(
  params: URLSearchParams,
): Readonly<Record<string, never>> {
  exactParams(params, []);
  return {};
}

export function parsePortQuery(
  params: URLSearchParams,
):
  | { readonly kind: "summary" }
  | { readonly kind: "detail"; readonly query: PortDetailQueryV1 } {
  if ([...params.keys()].length === 0) return { kind: "summary" };
  const query = exactParams(params, ["id"], ["days"]);
  let days: number | undefined;
  if (query.days !== undefined) {
    const raw = Number(query.days);
    if (!Number.isFinite(raw)) days = 180;
    else days = Math.min(730, Math.max(30, Math.round(raw)));
  }
  return {
    kind: "detail",
    query: { id: query.id, ...(days === undefined ? {} : { days }) },
  };
}

export function parseChokepointQuery(
  params: URLSearchParams,
):
  | { readonly kind: "summary" }
  | { readonly kind: "detail"; readonly query: ChokepointDetailQueryV1 } {
  if ([...params.keys()].length === 0) return { kind: "summary" };
  const query = exactParams(params, ["id"]);
  return { kind: "detail", query: { id: query.id } };
}

export function decodeMarketQueryV1(value: unknown): MarketQueryV1 {
  const root = record(value, "$marketQuery");
  exactKeys(root, ["series", "from", "to", "providerVersion"], "$marketQuery");
  const series = oneOf(root.series, ["fx", "oil", "bunker", "harpex"] as const, "$marketQuery.series");
  const from = isoDate(string(root.from, "$marketQuery.from"), "from");
  const to = isoDate(string(root.to, "$marketQuery.to"), "to");
  if (from > to) throw new InvalidRequestError("from은 to보다 늦을 수 없습니다.");
  literal(root.providerVersion, 3, "$marketQuery.providerVersion");
  return { series, from, to, providerVersion: 3 };
}

export function decodeNewsQueryV1(value: unknown): NewsQueryV1 {
  const root = record(value, "$newsQuery");
  exactKeys(
    root,
    root.refresh === undefined
      ? ["route", "asOf", "providerVersion", "retry"]
      : ["route", "asOf", "providerVersion", "retry", "refresh"],
    "$newsQuery",
  );
  const route = oneOf(root.route, ROUTE_IDS, "$newsQuery.route");
  const rawAsOf = string(root.asOf, "$newsQuery.asOf");
  const asOf = rawAsOf === "latest" ? "latest" : isoDate(rawAsOf, "asOf");
  literal(root.providerVersion, 18, "$newsQuery.providerVersion");
  const retry = oneOf(root.retry, [0, 1] as const, "$newsQuery.retry");
  if (root.refresh !== undefined && typeof root.refresh !== "string") {
    throw new InvalidRequestError("refresh는 문자열이어야 합니다.");
  }
  return {
    route,
    asOf,
    providerVersion: 18,
    retry,
    ...(root.refresh === undefined ? {} : { refresh: root.refresh }),
  };
}

export function decodePortDetailQueryV1(value: unknown): PortDetailQueryV1 {
  const root = record(value, "$portDetailQuery");
  exactKeys(root, root.days === undefined ? ["id"] : ["id", "days"], "$portDetailQuery");
  const id = string(root.id, "$portDetailQuery.id");
  if (root.days === undefined) return { id };
  if (typeof root.days !== "number") throw new InvalidRequestError("days는 숫자여야 합니다.");
  const days = Number.isFinite(root.days)
    ? Math.min(730, Math.max(30, Math.round(root.days)))
    : 180;
  return { id, days };
}

export function decodeChokepointDetailQueryV1(value: unknown): ChokepointDetailQueryV1 {
  const root = record(value, "$chokepointDetailQuery");
  exactKeys(root, ["id"], "$chokepointDetailQuery");
  return { id: string(root.id, "$chokepointDetailQuery.id") };
}
