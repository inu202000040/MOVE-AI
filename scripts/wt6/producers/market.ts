import { excelSerialToIsoDate, sortedRecord, sortCodeUnits } from "../canonical";
import { assertExactCount, requireInteger, requireNumber, requireString } from "../schema";
import type { TableRecord } from "../xlsx";

function isoWeek(date: string): string {
  const instant = new Date(`${date}T00:00:00Z`);
  const day = instant.getUTCDay() || 7;
  instant.setUTCDate(instant.getUTCDate() + 4 - day);
  const year = instant.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((instant.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function produceSeries(input: {
  readonly rows: readonly TableRecord[];
  readonly valueKey: string;
  readonly label: string;
  readonly unit: string;
  readonly provider: string;
  readonly aggregation: string;
}) {
  const points = input.rows
    .map((row) => {
      const date = excelSerialToIsoDate(requireInteger(row, "date"));
      const value = requireNumber(row, input.valueKey);
      if (value <= 0) throw new Error(`${input.label} contains nonpositive value`);
      return { date, week: isoWeek(date), value };
    })
    .sort((left, right) => sortCodeUnits(left.date, right.date));
  if (new Set(points.map((point) => point.date)).size !== points.length) {
    throw new Error(`${input.label} contains duplicate dates`);
  }
  const observationStart = points[0]?.date;
  const observationEnd = points.at(-1)?.date;
  if (!observationStart || !observationEnd) throw new Error(`${input.label} is empty`);
  return {
    label: input.label,
    unit: input.unit,
    provider: input.provider,
    aggregation: input.aggregation,
    observationStart,
    observationEnd,
    points,
    attempts: [],
  };
}

export function produceMarketReference(input: {
  readonly generatedAt: string;
  readonly fx: readonly TableRecord[];
  readonly oil: readonly TableRecord[];
  readonly bunker: readonly TableRecord[];
  readonly harpex: readonly TableRecord[];
}) {
  assertExactCount(input.fx.length, 960, "FX reference rows");
  assertExactCount(input.oil.length, 944, "Brent reference rows");
  assertExactCount(input.bunker.length, 948, "VLSFO reference rows");
  assertExactCount(input.harpex.length, 4, "HARPEX reference rows");

  input.fx.forEach((row) => {
    if (requireString(row, "unit") !== "KRW/USD") throw new Error("FX unit mismatch");
  });
  input.oil.forEach((row) => {
    if (requireString(row, "unit") !== "USD/bbl") throw new Error("Brent unit mismatch");
  });
  input.bunker.forEach((row) => {
    if (requireString(row, "unit") !== "USD/metric ton") throw new Error("VLSFO unit mismatch");
  });
  input.harpex.forEach((row) => {
    if (requireString(row, "status") !== "REFERENCE") throw new Error("HARPEX state mismatch");
  });

  return {
    schemaVersion: "move-ai/market-reference/v1",
    generatedAt: input.generatedAt,
    providerVersion: 3,
    series: sortedRecord([
      [
        "bunker",
        produceSeries({
          rows: input.bunker,
          valueKey: "value",
          label: "VLSFO 0.5% global 20-port average",
          unit: "USD/metric ton",
          provider: requireString(input.bunker[0], "source_id"),
          aggregation: "daily global 20-port average",
        }),
      ],
      [
        "fx",
        produceSeries({
          rows: input.fx,
          valueKey: "krw_per_usd",
          label: "KRW per USD",
          unit: "KRW/USD",
          provider: requireString(input.fx[0], "source_id"),
          aggregation: "daily ECB cross-rate",
        }),
      ],
      [
        "harpex",
        produceSeries({
          rows: input.harpex,
          valueKey: "harpex_index",
          label: "HARPEX",
          unit: "Index",
          provider: requireString(input.harpex[0], "source_id"),
          aggregation: "weekly public reference",
        }),
      ],
      [
        "oil",
        produceSeries({
          rows: input.oil,
          valueKey: "value",
          label: "Brent spot price",
          unit: "USD/bbl",
          provider: requireString(input.oil[0], "source_id"),
          aggregation: "daily",
        }),
      ],
    ]),
  };
}
