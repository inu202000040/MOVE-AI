export type Decoder<T> = (value: unknown) => T | null;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  return actualKeys.length === sortedExpected.length
    && actualKeys.every((key, index) => key === sortedExpected[index]);
}

export function decodeNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function decodeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function decodeNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function decodeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export function decodeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.includes("T")) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : value;
}

export function decodeIsoDateOrTimestamp(value: unknown): string | null {
  return decodeIsoDate(value) ?? decodeIsoTimestamp(value);
}

export function decodeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function decodeJsonValue(value: unknown): JsonValue | null {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    const decoded: JsonValue[] = [];
    for (const item of value) {
      const next = decodeJsonValue(item);
      if (next === null && item !== null) {
        return null;
      }
      decoded.push(next);
    }
    return decoded;
  }
  if (!isRecord(value)) {
    return null;
  }
  const decoded: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const next = decodeJsonValue(item);
    if (next === null && item !== null) {
      return null;
    }
    decoded[key] = next;
  }
  return decoded;
}

export function decodeJsonRecord(
  value: unknown,
): JsonObject | null {
  if (!isRecord(value)) {
    return null;
  }
  const decoded: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const next = decodeJsonValue(item);
    if (next === null && item !== null) {
      return null;
    }
    decoded[key] = next;
  }
  return decoded;
}

export function decodeStringArray(
  value: unknown,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
): readonly string[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    return null;
  }
  const result: string[] = [];
  for (const item of value) {
    const decoded = decodeNonEmptyString(item);
    if (decoded === null) {
      return null;
    }
    result.push(decoded);
  }
  return result;
}

export function unreachable(value: never): never {
  throw new Error(`Unhandled domain value: ${String(value)}`);
}
