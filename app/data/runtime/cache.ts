import { createHash } from "node:crypto";
import { GATEWAY_SCHEMA_VERSION, type DataModeV1 } from "../../contracts/gateway";
import {
  boolean,
  exactKeys,
  isoTimestamp,
  nullableString,
  record,
  string,
  stringArray,
} from "../artifacts/decoder-core";
import type { DomainDecoder } from "./result";

export interface CachePolicyV1 {
  readonly freshForMs: number;
  readonly staleForMs: number;
}

export interface StoredCacheEntryV1 {
  readonly schemaVersion: typeof GATEWAY_SCHEMA_VERSION;
  readonly storedAt: number;
  readonly sourceAsOf: string | null;
  readonly payloadJson: string;
  readonly payloadDigest: string;
}

export interface CacheBackendV1 {
  get(key: string): StoredCacheEntryV1 | undefined;
  set(key: string, value: StoredCacheEntryV1): void;
  delete(key: string): void;
}

export class MemoryCacheBackendV1 implements CacheBackendV1 {
  readonly entries = new Map<string, StoredCacheEntryV1>();

  get(key: string): StoredCacheEntryV1 | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: StoredCacheEntryV1): void {
    this.entries.set(key, value);
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}

export type CacheReadV1<T> =
  | { readonly kind: "miss" | "expired" | "corrupt"; readonly warning: string | null }
  | { readonly kind: "fresh" | "stale"; readonly value: T; readonly ageSeconds: number; readonly warning: null };

function normalizeJson(value: unknown, path = "$cache", sortKeys = true): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => normalizeJson(item, `${path}[${index}]`, sortKeys));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    const keys = Object.keys(value);
    if (sortKeys) keys.sort();
    for (const key of keys) {
      const item = Reflect.get(value, key);
      if (item === undefined) throw new Error(`${path}.${key} is undefined`);
      output[key] = normalizeJson(item, `${path}.${key}`, sortKeys);
    }
    return output;
  }
  throw new Error(`${path} is not JSON-compatible`);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertNoSecretKey(value: unknown, path = "$request"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretKey(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const key of Object.keys(value)) {
    if (/(?:authorization|cookie|secret|token|api[-_]?key)/iu.test(key)) {
      throw new Error(`${path}.${key} cannot be included in a cache key`);
    }
    assertNoSecretKey(Reflect.get(value, key), `${path}.${key}`);
  }
}

export function buildCacheKeyV1(input: {
  readonly domain: string;
  readonly normalizedRequest: unknown;
  readonly providerVersion: number | string;
  readonly contractVersion?: string;
  readonly mode: "live" | "fixture";
}): string {
  assertNoSecretKey(input.normalizedRequest);
  const identity = canonicalJson({
    contractVersion: input.contractVersion ?? GATEWAY_SCHEMA_VERSION,
    domain: input.domain,
    mode: input.mode,
    normalizedRequest: input.normalizedRequest,
    providerVersion: input.providerVersion,
  });
  return `${input.domain}:${digest(identity)}`;
}

function assertPolicy(policy: CachePolicyV1): void {
  if (!Number.isInteger(policy.freshForMs) || policy.freshForMs < 0) throw new Error("Invalid fresh cache window");
  if (!Number.isInteger(policy.staleForMs) || policy.staleForMs < 0) throw new Error("Invalid stale cache window");
}

export class VerifiedDataCacheV1 {
  constructor(private readonly backend: CacheBackendV1 = new MemoryCacheBackendV1()) {}

  write<T>(input: {
    readonly key: string;
    readonly value: T;
    readonly sourceAsOf: string | null;
    readonly storedAt: number;
    readonly decoder: DomainDecoder<T>;
  }): void {
    if (!Number.isFinite(input.storedAt) || input.storedAt < 0) throw new Error("Invalid cache storedAt");
    const decoded = input.decoder(input.value);
    const payloadJson = JSON.stringify(normalizeJson(decoded, "$cache", false));
    this.backend.set(input.key, {
      schemaVersion: GATEWAY_SCHEMA_VERSION,
      storedAt: input.storedAt,
      sourceAsOf: input.sourceAsOf,
      payloadJson,
      payloadDigest: digest(payloadJson),
    });
  }

  read<T>(input: {
    readonly key: string;
    readonly now: number;
    readonly policy: CachePolicyV1;
    readonly decoder: DomainDecoder<T>;
  }): CacheReadV1<T> {
    assertPolicy(input.policy);
    const entry = this.backend.get(input.key);
    if (!entry) return { kind: "miss", warning: null };
    try {
      if (
        entry.schemaVersion !== GATEWAY_SCHEMA_VERSION ||
        !Number.isFinite(entry.storedAt) ||
        entry.storedAt < 0 ||
        entry.storedAt > input.now ||
        !/^[\da-f]{64}$/u.test(entry.payloadDigest) ||
        digest(entry.payloadJson) !== entry.payloadDigest
      ) {
        throw new Error("Cache identity mismatch");
      }
      const decoded = input.decoder(JSON.parse(entry.payloadJson));
      const ageMs = input.now - entry.storedAt;
      const ageSeconds = Math.floor(ageMs / 1_000);
      if (ageMs <= input.policy.freshForMs) {
        return { kind: "fresh", value: decoded, ageSeconds, warning: null };
      }
      if (ageMs <= input.policy.freshForMs + input.policy.staleForMs) {
        return { kind: "stale", value: decoded, ageSeconds, warning: null };
      }
      this.backend.delete(input.key);
      return { kind: "expired", warning: "CACHE_EXPIRED" };
    } catch {
      this.backend.delete(input.key);
      return { kind: "corrupt", warning: "CACHE_CORRUPT" };
    }
  }
}

export class SingleFlightV1<T> {
  private readonly inFlight = new Map<string, Promise<T>>();

  run(key: string, task: () => Promise<T>): Promise<T> {
    const current = this.inFlight.get(key);
    if (current) return current;
    const started = task().finally(() => {
      if (this.inFlight.get(key) === started) this.inFlight.delete(key);
    });
    this.inFlight.set(key, started);
    return started;
  }
}

export interface ProviderPayloadV1<T> {
  readonly data: T;
  readonly source: string;
  readonly sourceUrl: string | null;
  readonly asOf: string | null;
  readonly fetchedAt: string;
  readonly unit: string | null;
  readonly isEstimate: boolean;
  readonly attribution: string;
  readonly warnings: readonly string[];
  readonly provider: string | null;
}

export function providerPayloadDecoderV1<T>(decodeData: DomainDecoder<T>): DomainDecoder<ProviderPayloadV1<T>> {
  return (value: unknown) => {
    const root = record(value, "$providerPayload");
    exactKeys(
      root,
      ["data", "source", "sourceUrl", "asOf", "fetchedAt", "unit", "isEstimate", "attribution", "warnings", "provider"],
      "$providerPayload",
    );
    return {
      data: decodeData(root.data),
      source: string(root.source, "source"),
      sourceUrl: nullableString(root.sourceUrl, "sourceUrl"),
      asOf: nullableString(root.asOf, "asOf"),
      fetchedAt: isoTimestamp(root.fetchedAt, "fetchedAt"),
      unit: nullableString(root.unit, "unit"),
      isEstimate: boolean(root.isEstimate, "isEstimate"),
      attribution: string(root.attribution, "attribution"),
      warnings: stringArray(root.warnings, "warnings"),
      provider: nullableString(root.provider, "provider"),
    };
  };
}

export type HybridLoadV1<T> =
  | {
      readonly kind: "success";
      readonly payload: ProviderPayloadV1<T>;
      readonly mode: Exclude<DataModeV1, "unavailable">;
      readonly cache: { readonly hit: boolean; readonly stale: boolean; readonly ageSeconds: number | null };
      readonly warnings: readonly string[];
    }
  | { readonly kind: "unavailable"; readonly error: unknown; readonly warnings: readonly string[] };

export class HybridLoaderV1<T> {
  private readonly singleFlight = new SingleFlightV1<ProviderPayloadV1<T>>();

  constructor(private readonly cache: VerifiedDataCacheV1) {}

  async load(input: {
    readonly key: string;
    readonly now: number;
    readonly policy: CachePolicyV1;
    readonly decodeData: DomainDecoder<T>;
    readonly live: (signal?: AbortSignal) => Promise<unknown>;
    readonly fixture?: () => unknown;
    readonly fixtureStale?: boolean;
    readonly signal?: AbortSignal;
  }): Promise<HybridLoadV1<T>> {
    const decodePayload = providerPayloadDecoderV1(input.decodeData);
    const cacheResult = this.cache.read({
      key: input.key,
      now: input.now,
      policy: input.policy,
      decoder: decodePayload,
    });
    if (cacheResult.kind === "fresh") {
      return {
        kind: "success",
        payload: cacheResult.value,
        mode: "cached",
        cache: { hit: true, stale: false, ageSeconds: cacheResult.ageSeconds },
        warnings: [],
      };
    }
    const cacheWarning = cacheResult.warning ? [cacheResult.warning] : [];
    try {
      const payload = await this.singleFlight.run(input.key, async () => {
        if (input.signal?.aborted) throw input.signal.reason;
        const decoded = decodePayload(await input.live(input.signal));
        this.cache.write({
          key: input.key,
          value: decoded,
          sourceAsOf: decoded.asOf,
          storedAt: input.now,
          decoder: decodePayload,
        });
        return decoded;
      });
      return {
        kind: "success",
        payload,
        mode: "live",
        cache: { hit: false, stale: false, ageSeconds: null },
        warnings: cacheWarning,
      };
    } catch (error) {
      if (input.signal?.aborted) throw error;
      if (cacheResult.kind === "stale") {
        return {
          kind: "success",
          payload: cacheResult.value,
          mode: "cached",
          cache: { hit: true, stale: true, ageSeconds: cacheResult.ageSeconds },
          warnings: ["LIVE_PROVIDER_FAILED"],
        };
      }
      if (input.fixture) {
        return {
          kind: "success",
          payload: decodePayload(input.fixture()),
          mode: "fixture",
          cache: { hit: false, stale: input.fixtureStale ?? false, ageSeconds: null },
          warnings: [...cacheWarning, "LIVE_PROVIDER_FAILED"],
        };
      }
      return { kind: "unavailable", error, warnings: [...cacheWarning, "LIVE_PROVIDER_FAILED"] };
    }
  }
}
