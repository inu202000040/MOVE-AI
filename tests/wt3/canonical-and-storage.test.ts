import assert from "node:assert/strict";
import test from "node:test";

import {
  REPRESENTATIVE_STORAGE_SCHEMA_VERSION,
  TUNING_STORAGE_SCHEMA_VERSION,
  canonicalJson,
  clearManualRepresentative,
  computeTuningRunHash,
  decodeRepresentativePayload,
  decodeTuningPayload,
  encodeRepresentativePayload,
  encodeTuningPayload,
  readModelsStorage,
  representativeStorageKey,
  sha256Hex,
  tuningStorageKey,
  writeAcceptedTuning,
  writeManualRepresentative,
  type StorageLikeV1,
} from "../../app/freight-risk/models/core";
import { makeTuneSuccess } from "./fixtures";

class MemoryStorage implements StorageLikeV1 {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test("serializes recursive object keys canonically while preserving array order", () => {
  assert.equal(
    canonicalJson({ b: 1, a: { z: -0, y: [3, 2, 1] } }),
    '{"a":{"y":[3,2,1],"z":0},"b":1}',
  );
  assert.equal(canonicalJson({ "😀": 1, "가": 2, a: 3 }), '{"a":3,"가":2,"😀":1}');
  assert.throws(() => canonicalJson({ invalid: Number.NaN }), /finite numbers/u);
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycles/u);
  assert.throws(() => canonicalJson(new Array(2)), /sparse arrays/u);
});

test("matches published SHA-256 vectors without a runtime-specific crypto API", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("안녕"), "e8f817f346d1d411cc59d5bdda64fab3763890e1f0f8f4c15805cf78874d68bf");
});

test("makes tuning hash independent of object insertion order and sensitive to semantics", () => {
  const result = makeTuneSuccess();
  const reordered = Object.fromEntries(Object.entries(result).reverse());
  const originalHash = computeTuningRunHash(result);
  assert.match(originalHash, /^[0-9a-f]{64}$/u);
  assert.equal(originalHash, "e63366c7dabca3772949f21ac4b71c0874297fec63f17db044447741b2a3985b");
  assert.equal(computeTuningRunHash(reordered as unknown as typeof result), originalHash);
  assert.notEqual(computeTuningRunHash({ ...result, elapsedMs: result.elapsedMs + 1 }), originalHash);
});

test("round-trips strict tuning and representative storage payloads", () => {
  const result = makeTuneSuccess();
  const hashed = { result, tuningRunHash: computeTuningRunHash(result) };
  const savedAt = "2026-08-13T13:16:12+09:00";
  const tuningJson = encodeTuningPayload("KNEI", hashed, savedAt);
  const decodedTuning = decodeTuningPayload(tuningJson, "KNEI", "sarimax");
  assert.equal(decodedTuning?.schemaVersion, TUNING_STORAGE_SCHEMA_VERSION);
  assert.deepEqual(decodedTuning?.data, hashed);
  assert.equal(decodeTuningPayload(tuningJson, "KMEI", "sarimax"), null);

  const representativeJson = encodeRepresentativePayload("KNEI", "naive", savedAt);
  const decodedRepresentative = decodeRepresentativePayload(representativeJson, "KNEI");
  assert.equal(decodedRepresentative?.schemaVersion, REPRESENTATIVE_STORAGE_SCHEMA_VERSION);
  assert.equal(decodedRepresentative?.data.modelId, "naive");
  assert.equal(decodeRepresentativePayload(representativeJson, "KMEI"), null);
});

test("removes malformed route entries without discarding other valid models", () => {
  const storage = new MemoryStorage();
  const result = makeTuneSuccess();
  const hashed = { result, tuningRunHash: computeTuningRunHash(result) };
  writeAcceptedTuning(storage, "KNEI", hashed, "2026-08-13T04:16:12Z");
  writeManualRepresentative(storage, "KNEI", "timesfm", "2026-08-13T04:16:12Z");
  storage.setItem(tuningStorageKey("KNEI", "prophet"), "{broken");

  const snapshot = readModelsStorage(storage, "KNEI");
  assert.equal(snapshot.manualModelId, "timesfm");
  assert.equal(snapshot.tuningByModel.sarimax?.tuningRunHash, hashed.tuningRunHash);
  assert.equal(storage.getItem(tuningStorageKey("KNEI", "prophet")), null);

  storage.setItem(representativeStorageKey("KNEI"), JSON.stringify({
    schemaVersion: "move-ai/representative-store-v2",
    savedAt: "2026-08-13T04:16:12Z",
    domainIdentity: { routeCode: "KNEI" },
    data: { modelId: "naive" },
  }));
  assert.equal(readModelsStorage(storage, "KNEI").manualModelId, null);
  clearManualRepresentative(storage, "KNEI");
  assert.equal(storage.getItem(representativeStorageKey("KNEI")), null);
});
