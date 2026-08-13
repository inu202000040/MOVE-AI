import type { TableRecord, XlsxScalar } from "./xlsx";

export function requireString(record: TableRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`Expected non-empty string at ${key}`);
  }
  return value;
}

export function nullableString(record: TableRecord, key: string): string | null {
  const value = record[key];
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`Expected string or null at ${key}`);
  return value;
}

export function requireNumber(record: TableRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite number at ${key}`);
  }
  return value;
}

export function nullableNumber(record: TableRecord, key: string): number | null {
  const value = record[key];
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite number or null at ${key}`);
  }
  return value;
}

export function requireInteger(record: TableRecord, key: string): number {
  const value = requireNumber(record, key);
  if (!Number.isInteger(value)) throw new Error(`Expected integer at ${key}`);
  return value;
}

export function requireBoolean(record: TableRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`Expected boolean at ${key}`);
  return value;
}

export function nullableScalar(record: TableRecord, key: string): XlsxScalar {
  const value = record[key];
  if (value === undefined) throw new Error(`Missing field ${key}`);
  return value;
}

export function assertExactCount(
  actual: number,
  expected: number,
  label: string,
): void {
  if (actual !== expected) {
    throw new Error(`${label} count ${actual} did not match ${expected}`);
  }
}

export function groupBy<T, K extends string>(
  values: readonly T[],
  keyOf: (value: T) => K,
): ReadonlyMap<K, readonly T[]> {
  const mutable = new Map<K, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = mutable.get(key);
    if (group) group.push(value);
    else mutable.set(key, [value]);
  }
  return mutable;
}

export function assertKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    expected.some((key, index) => actual[index] !== key)
  ) {
    throw new Error(`${label} keys ${actual.join(",")} did not match ${expected.join(",")}`);
  }
}
