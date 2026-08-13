import { excelSerialToIsoDate, sortedRecord, sortCodeUnits } from "../canonical";
import {
  assertExactCount,
  groupBy,
  nullableNumber,
  requireBoolean,
  requireInteger,
  requireString,
} from "../schema";
import type { TableRecord } from "../xlsx";

interface PortDay {
  readonly serial: number;
  readonly date: string;
  readonly importTons: number | null;
  readonly exportTons: number | null;
  readonly vesselCalls: number | null;
}

interface ChokeDay {
  readonly serial: number;
  readonly date: string;
  readonly vessels: number | null;
  readonly transitTons: number | null;
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return roundPercent(((current - previous) / previous) * 100);
}

function daysInRange<T extends { readonly serial: number }>(
  rows: readonly T[],
  from: number,
  to: number,
): readonly T[] {
  return rows.filter((row) => row.serial >= from && row.serial <= to);
}

function completeSum<T>(
  rows: readonly T[],
  expectedDays: number,
  valueOf: (row: T) => number | null,
): number | null {
  if (rows.length !== expectedDays) return null;
  let total = 0;
  for (const row of rows) {
    const value = valueOf(row);
    if (value === null || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

function toPortDay(row: TableRecord): PortDay {
  const serial = requireInteger(row, "date");
  if (requireString(row, "unit") !== "metric_tons_and_calls") {
    throw new Error("Port traffic source unit mismatch");
  }
  if (!requireBoolean(row, "is_estimate")) {
    throw new Error("Port traffic tonnage must retain estimate truth");
  }
  return {
    serial,
    date: excelSerialToIsoDate(serial),
    importTons: nullableNumber(row, "imports_tons"),
    exportTons: nullableNumber(row, "exports_tons"),
    vesselCalls: nullableNumber(row, "container_calls"),
  };
}

function toChokeDay(row: TableRecord): ChokeDay {
  const serial = requireInteger(row, "date");
  if (!requireBoolean(row, "is_estimate")) {
    throw new Error("Chokepoint tonnage must retain estimate truth");
  }
  return {
    serial,
    date: excelSerialToIsoDate(serial),
    vessels: nullableNumber(row, "container_vessels"),
    transitTons: nullableNumber(row, "container_capacity_tons"),
  };
}

function commonObservationSerial(groups: ReadonlyMap<string, readonly PortDay[]>): number {
  const counts = new Map<number, number>();
  for (const rows of groups.values()) {
    for (const serial of new Set(rows.map((row) => row.serial))) {
      counts.set(serial, (counts.get(serial) ?? 0) + 1);
    }
  }
  const common = [...counts.entries()]
    .filter(([, count]) => count === groups.size)
    .map(([serial]) => serial)
    .sort((left, right) => right - left)[0];
  if (!common) throw new Error("Port traffic has no common observation date");
  return common;
}

export function producePortTrafficFixture(input: {
  readonly generatedAt: string;
  readonly mapping: readonly TableRecord[];
  readonly daily: readonly TableRecord[];
}) {
  assertExactCount(input.mapping.length, 57, "port markers");
  assertExactCount(input.daily.length, 12_320, "port daily observations");
  const dailyBySeries = groupBy(input.daily, (row) => requireString(row, "portwatch_id"));
  assertExactCount(dailyBySeries.size, 56, "unique port series");
  const parsedBySeries = new Map(
    [...dailyBySeries].map(([id, rows]) => [
      id,
      rows.map(toPortDay).sort((left, right) => left.serial - right.serial),
    ] as const),
  );
  for (const [id, rows] of parsedBySeries) {
    assertExactCount(rows.length, 220, `${id} daily observations`);
  }
  const commonSerial = commonObservationSerial(parsedBySeries);
  const commonObservationDate = excelSerialToIsoDate(commonSerial);
  if (commonObservationDate !== "2026-08-07") {
    throw new Error(`Unexpected port freshness anchor ${commonObservationDate}`);
  }

  const markerIdsBySeries = groupBy(input.mapping, (row) => requireString(row, "portwatch_id"));
  const summaryEntries = input.mapping.map((mapping) => {
    const portId = requireString(mapping, "marker_id");
    const portWatchId = requireString(mapping, "portwatch_id");
    const rows = parsedBySeries.get(portWatchId);
    if (!rows) throw new Error(`Missing port series ${portWatchId}`);
    const currentRows = daysInRange(rows, commonSerial - 6, commonSerial);
    const previousRows = daysInRange(rows, commonSerial - 13, commonSerial - 7);
    const estimatedImportTons7d = completeSum(currentRows, 7, (row) => row.importTons);
    const estimatedExportTons7d = completeSum(currentRows, 7, (row) => row.exportTons);
    const previousEstimatedImportTons7d = completeSum(previousRows, 7, (row) => row.importTons);
    const previousEstimatedExportTons7d = completeSum(previousRows, 7, (row) => row.exportTons);
    const estimatedTotalTons7d =
      estimatedImportTons7d === null || estimatedExportTons7d === null
        ? null
        : estimatedImportTons7d + estimatedExportTons7d;
    const previousEstimatedTotalTons7d =
      previousEstimatedImportTons7d === null || previousEstimatedExportTons7d === null
        ? null
        : previousEstimatedImportTons7d + previousEstimatedExportTons7d;
    const containerVesselCalls7d = completeSum(currentRows, 7, (row) => row.vesselCalls);
    const previousContainerVesselCalls7d = completeSum(previousRows, 7, (row) => row.vesselCalls);
    const sharedWithPortIds = (markerIdsBySeries.get(portWatchId) ?? [])
      .map((row) => requireString(row, "marker_id"))
      .filter((id) => id !== portId)
      .sort(sortCodeUnits);
    return [
      portId,
      {
        portId,
        routeCode: requireString(mapping, "route_code"),
        portWatchId,
        sharedSeries: sharedWithPortIds.length > 0,
        sharedWithPortIds,
        observedAt: commonObservationDate,
        observedDays7d: currentRows.length,
        previousObservedDays7d: previousRows.length,
        estimatedImportTons7d,
        estimatedExportTons7d,
        estimatedTotalTons7d,
        previousEstimatedImportTons7d,
        previousEstimatedExportTons7d,
        previousEstimatedTotalTons7d,
        estimatedTotalTonsChangePercent: changePercent(
          estimatedTotalTons7d,
          previousEstimatedTotalTons7d,
        ),
        containerVesselCalls7d,
        previousContainerVesselCalls7d,
        vesselCallsChangePercent: changePercent(
          containerVesselCalls7d,
          previousContainerVesselCalls7d,
        ),
      },
    ] as const;
  });

  const detailEntries = input.mapping.map((mapping) => {
    const portId = requireString(mapping, "marker_id");
    const portWatchId = requireString(mapping, "portwatch_id");
    const rows = parsedBySeries.get(portWatchId);
    if (!rows) throw new Error(`Missing port series ${portWatchId}`);
    const sharedWithPortIds = (markerIdsBySeries.get(portWatchId) ?? [])
      .map((row) => requireString(row, "marker_id"))
      .filter((id) => id !== portId)
      .sort(sortCodeUnits);
    return [
      portId,
      {
        portId,
        routeCode: requireString(mapping, "route_code"),
        portWatchId,
        sharedSeries: sharedWithPortIds.length > 0,
        sharedWithPortIds,
        points: rows.map((row) => {
          const rolling = daysInRange(rows, row.serial - 6, row.serial);
          const import7d = completeSum(rolling, 7, (item) => item.importTons);
          const export7d = completeSum(rolling, 7, (item) => item.exportTons);
          return {
            date: row.date,
            estimatedImportTons: row.importTons,
            estimatedExportTons: row.exportTons,
            estimatedTotalTons:
              row.importTons === null || row.exportTons === null
                ? null
                : row.importTons + row.exportTons,
            containerVesselCalls: row.vesselCalls,
            estimatedImportTons7d: import7d,
            estimatedExportTons7d: export7d,
            estimatedTotalTons7d:
              import7d === null || export7d === null ? null : import7d + export7d,
            containerVesselCalls7d: completeSum(rolling, 7, (item) => item.vesselCalls),
          };
        }),
      },
    ] as const;
  });

  return {
    schemaVersion: "move-ai/port-traffic-fixture/v1",
    generatedAt: input.generatedAt,
    fetchedAt: input.generatedAt,
    commonObservationDate,
    source: "PortWatch approved workbook 07",
    attribution: "IMF PortWatch",
    methodologyNote: "Seven-day sums use complete observed calendar-day windows.",
    caveats: [
      "Cargo tonnage is estimated.",
      "Shared upstream series is fetched and aggregated once, then mapped to each marker.",
    ],
    units: { cargo: "metric_tons_estimated", vesselCalls: "calls" },
    markerCount: input.mapping.length,
    uniqueSeriesCount: parsedBySeries.size,
    availableMarkerCount: input.mapping.length,
    availableSeriesCount: parsedBySeries.size,
    summaries: sortedRecord(summaryEntries),
    details: sortedRecord(detailEntries),
  };
}

export function produceChokepointTrafficFixture(input: {
  readonly generatedAt: string;
  readonly mapping: readonly TableRecord[];
  readonly daily: readonly TableRecord[];
  readonly allSeries: readonly TableRecord[];
}) {
  assertExactCount(input.mapping.length, 11, "chokepoint app entries");
  assertExactCount(input.daily.length, 2_420, "chokepoint daily observations");
  assertExactCount(input.allSeries.length, 28, "chokepoint full catalog entries");
  const dailyById = groupBy(input.daily, (row) => requireString(row, "chokepoint_id"));
  assertExactCount(dailyById.size, 11, "chokepoint daily groups");
  const parsedById = new Map(
    [...dailyById].map(([id, rows]) => [
      id,
      rows.map(toChokeDay).sort((left, right) => left.serial - right.serial),
    ] as const),
  );
  for (const [id, rows] of parsedById) {
    assertExactCount(rows.length, 220, `${id} daily observations`);
  }
  const latestSerial = Math.max(...[...parsedById.values()].flatMap((rows) => rows.map((row) => row.serial)));
  const latestObservationDate = excelSerialToIsoDate(latestSerial);
  if (latestObservationDate !== "2026-08-09") {
    throw new Error(`Unexpected chokepoint freshness anchor ${latestObservationDate}`);
  }

  const summaryEntries = input.mapping.map((mapping) => {
    const chokepointId = requireString(mapping, "chokepoint_id");
    const rows = parsedById.get(chokepointId);
    if (!rows) throw new Error(`Missing chokepoint series ${chokepointId}`);
    const observedSerial = rows.at(-1)?.serial;
    if (!observedSerial) throw new Error(`Empty chokepoint series ${chokepointId}`);
    const current = daysInRange(rows, observedSerial - 6, observedSerial);
    const previous = daysInRange(rows, observedSerial - 13, observedSerial - 7);
    const containerVessels7d = completeSum(current, 7, (row) => row.vessels);
    const estimatedTransitTons7d = completeSum(current, 7, (row) => row.transitTons);
    const previousContainerVessels7d = completeSum(previous, 7, (row) => row.vessels);
    const previousEstimatedTransitTons7d = completeSum(previous, 7, (row) => row.transitTons);
    return [
      chokepointId,
      {
        chokepointId,
        portwatchId: requireString(mapping, "portwatch_id"),
        observedAt: excelSerialToIsoDate(observedSerial),
        containerVessels7d,
        estimatedTransitTons7d,
        previousContainerVessels7d,
        previousEstimatedTransitTons7d,
        vesselChangePercent: changePercent(containerVessels7d, previousContainerVessels7d),
        transitTonsChangePercent: changePercent(
          estimatedTransitTons7d,
          previousEstimatedTransitTons7d,
        ),
      },
    ] as const;
  });

  const detailEntries = input.mapping.map((mapping) => {
    const chokepointId = requireString(mapping, "chokepoint_id");
    const rows = parsedById.get(chokepointId);
    if (!rows) throw new Error(`Missing chokepoint series ${chokepointId}`);
    return [
      chokepointId,
      {
        chokepointId,
        portwatchId: requireString(mapping, "portwatch_id"),
        points: rows.map((row) => {
          const rolling = daysInRange(rows, row.serial - 6, row.serial);
          return {
            date: row.date,
            containerVessels7d: completeSum(rolling, 7, (item) => item.vessels),
            estimatedTransitTons7d: completeSum(rolling, 7, (item) => item.transitTons),
          };
        }),
      },
    ] as const;
  });

  return {
    schemaVersion: "move-ai/chokepoint-traffic-fixture/v1",
    generatedAt: input.generatedAt,
    fetchedAt: input.generatedAt,
    latestObservationDate,
    source: "PortWatch approved workbook 08",
    attribution: "IMF PortWatch",
    methodologyNote: "Seven-day sums use complete observed calendar-day windows.",
    appChokepointCount: input.mapping.length,
    fullCatalogSeriesCount: input.allSeries.length,
    summaries: sortedRecord(summaryEntries),
    details: sortedRecord(detailEntries),
  };
}
