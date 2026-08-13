import { createHash } from "node:crypto";

function assertJsonValue(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number at ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new Error(`Undefined value at ${path}.${key}`);
      assertJsonValue(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`Unsupported JSON value at ${path}`);
}

export function canonicalJson(value: unknown): string {
  assertJsonValue(value, "$");
  return `${JSON.stringify(value)}\n`;
}

export function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sortCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortedRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  return Object.fromEntries(
    [...entries].sort(([left], [right]) => sortCodeUnits(left, right)),
  );
}

export function excelSerialToIsoDate(value: number): string {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid Excel date serial ${value}`);
  }
  const milliseconds = Date.UTC(1899, 11, 30) + value * 86_400_000;
  return new Date(milliseconds).toISOString().slice(0, 10);
}
