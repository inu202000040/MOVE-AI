export type UnknownRecord = Readonly<Record<string, unknown>>;

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: unknown, path: string): UnknownRecord {
  if (!isUnknownRecord(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

export function exactKeys(
  value: UnknownRecord,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    expected.some((key, index) => actual[index] !== key)
  ) {
    throw new Error(`${path} keys ${actual.join(",")} do not match ${expected.join(",")}`);
  }
}

export function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

export function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${path} must be a string`);
  return value;
}

export function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return string(value, path);
}

export function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

export function nullableFinite(value: unknown, path: string): number | null {
  if (value === null) return null;
  return finite(value, path);
}

export function integer(value: unknown, path: string): number {
  const result = finite(value, path);
  if (!Number.isInteger(result)) throw new Error(`${path} must be an integer`);
  return result;
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

export function literal<T extends string | number>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) throw new Error(`${path} must be ${expected}`);
  return expected;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  const found = allowed.find((candidate) => candidate === value);
  if (!found) throw new Error(`${path} contains unknown value ${value}`);
  return found;
}

export function isoDate(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) {
    throw new Error(`${path} must be an ISO date`);
  }
  return result;
}

export function isoTimestamp(value: unknown, path: string): string {
  const result = string(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      result,
    ) ||
    Number.isNaN(Date.parse(result))
  ) {
    throw new Error(`${path} must be an ISO timestamp with offset`);
  }
  return result;
}

export function exactArrayLength(
  value: readonly unknown[],
  expected: number,
  path: string,
): void {
  if (value.length !== expected) throw new Error(`${path} length must be ${expected}`);
}

export function sortedUnique(values: readonly string[], path: string): void {
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0 && values[index - 1] >= values[index]) {
      throw new Error(`${path} must be code-unit sorted and unique`);
    }
  }
}

export function stringArray(value: unknown, path: string): readonly string[] {
  return array(value, path).map((item, index) => string(item, `${path}[${index}]`));
}
