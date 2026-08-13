import runtimeProviderPolicyArtifact from "../generated/runtime-provider-policy-v1.json";
import { assertRuntimeProviderPolicyV1 } from "../artifacts/decoders";
import { record, stringArray } from "../artifacts/decoder-core";
import type { RetryPolicyV1 } from "./retry";

assertRuntimeProviderPolicyV1(runtimeProviderPolicyArtifact);
const policyRoot = record(runtimeProviderPolicyArtifact, "$runtimeProviderPolicy");
const allowedHostSet = new Set(stringArray(policyRoot.allowedHosts, "$runtimeProviderPolicy.allowedHosts"));

export type ServerDataModeV1 = "fixture" | "live" | "hybrid";

export function parseServerDataModeV1(value: string | undefined): ServerDataModeV1 {
  if (value === undefined || value === "") return "hybrid";
  if (value === "fixture" || value === "live" || value === "hybrid") return value;
  throw new Error(`Unsupported MOVE_AI_DATA_MODE ${value}`);
}

export function assertAllowedProviderUrlV1(value: string | URL): URL {
  const url = value instanceof URL ? value : new URL(value);
  if (url.protocol !== "https:" || !allowedHostSet.has(url.hostname)) {
    throw new Error(`Provider host is not allowlisted: ${url.hostname}`);
  }
  if (url.username || url.password) throw new Error("Provider URL cannot contain credentials");
  return url;
}

export function assertAllowedRedirectV1(original: URL, redirected: URL): URL {
  assertAllowedProviderUrlV1(original);
  return assertAllowedProviderUrlV1(redirected);
}

export const CACHE_CONTROL_V1 = {
  immutableSnapshot: "public, max-age=31536000, immutable",
  market: "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
  newsReady: "public, max-age=900, s-maxage=3600, stale-while-revalidate=21600",
  portLiveSummary: "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
  portShort: "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
  chokepointLive: "public, max-age=900, s-maxage=10800, stale-while-revalidate=86400",
  chokepointStale: "public, max-age=60, s-maxage=600, stale-while-revalidate=3600",
  weatherAvailable: "public, max-age=300, s-maxage=1800, stale-while-revalidate=7200",
  noStore: "no-store",
} as const;

export type CacheDomainV1 =
  | "snapshot"
  | "market"
  | "news"
  | "insight"
  | "tuning"
  | "port"
  | "chokepoint"
  | "weather";

export function cacheControlForV1(input: {
  readonly domain: CacheDomainV1;
  readonly state: string;
  readonly detail?: boolean;
  readonly articleCount?: number;
}): string {
  if (input.state === "UNAVAILABLE") return CACHE_CONTROL_V1.noStore;
  switch (input.domain) {
    case "snapshot":
      return CACHE_CONTROL_V1.immutableSnapshot;
    case "market":
      return CACHE_CONTROL_V1.market;
    case "news":
      return input.state === "LIVE" && (input.articleCount ?? 0) >= 5
        ? CACHE_CONTROL_V1.newsReady
        : CACHE_CONTROL_V1.noStore;
    case "insight":
    case "tuning":
      return CACHE_CONTROL_V1.noStore;
    case "port":
      return input.state === "LIVE" && input.detail !== true
        ? CACHE_CONTROL_V1.portLiveSummary
        : CACHE_CONTROL_V1.portShort;
    case "chokepoint":
      return input.state === "LIVE"
        ? CACHE_CONTROL_V1.chokepointLive
        : CACHE_CONTROL_V1.chokepointStale;
    case "weather":
      return input.state === "LIVE" || input.state === "PARTIAL"
        ? CACHE_CONTROL_V1.weatherAvailable
        : CACHE_CONTROL_V1.noStore;
  }
}

export const PROVIDER_RETRY_POLICY_V1 = {
  market: {
    attemptTimeoutMs: 7_000,
    maximumAttempts: 1,
  },
  port: {
    attemptTimeoutMs: 12_000,
    maximumAttempts: 3,
    backoffMs: [350, 700],
  },
  chokepoint: {
    attemptTimeoutMs: 12_000,
    maximumAttempts: 1,
  },
  weatherAtmosphere: {
    attemptTimeoutMs: 20_000,
    maximumAttempts: 2,
    retryStatuses: [429],
  },
  weatherMarine: {
    attemptTimeoutMs: 20_000,
    maximumAttempts: 1,
  },
  weatherVisibility: {
    attemptTimeoutMs: 25_000,
    maximumAttempts: 2,
  },
  tuning: {
    attemptTimeoutMs: 600_000,
    maximumAttempts: 1,
  },
} as const satisfies Readonly<Record<string, RetryPolicyV1>>;

export const PROVIDER_EXECUTION_LIMITS_V1 = {
  port: { chunkSize: 8, concurrency: 3, pageSize: 1_000, maximumPages: 50 },
  news: { primaryWindowDays: 30, retryWindowDays: 90, translationTimeoutMs: 5_000 },
  weather: {
    atmosphereConcurrency: 8,
    marineChunkSize: 24,
    maximumStationDistanceKm: 75,
    maximumObservationAgeMinutes: 180,
    futureToleranceMinutes: 15,
  },
  insight: { totalTimeoutMs: 25_000 },
} as const;
