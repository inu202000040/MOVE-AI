import type {
  ChokepointDetailV1,
  ChokepointSummaryV1,
  ChokepointTrafficDataV1,
  PortDetailV1,
  PortSummaryV1,
  PortTrafficDataV1,
} from "../../../data/runtime/domains";

export interface PortPanelDataV1 {
  readonly summary: PortSummaryV1 | null;
  readonly detail: PortDetailV1 | null;
}

export interface ChokepointPanelDataV1 {
  readonly summary: ChokepointSummaryV1 | null;
  readonly detail: ChokepointDetailV1 | null;
}

export function resolvePortPanelDataV1(
  portId: string,
  summaryData: Pick<PortTrafficDataV1, "summaries"> | null,
  detailData: Pick<PortTrafficDataV1, "detail"> | null,
): PortPanelDataV1 {
  const summary = summaryData?.summaries[portId] ?? null;
  const detail = detailData?.detail ?? null;
  return {
    summary: summary?.portId === portId ? summary : null,
    detail: detail?.portId === portId ? detail : null,
  };
}

export function resolveChokepointPanelDataV1(
  chokepointId: string,
  summaryData: Pick<ChokepointTrafficDataV1, "summaries"> | null,
  detailData: Pick<ChokepointTrafficDataV1, "detail"> | null,
): ChokepointPanelDataV1 {
  const summary = summaryData?.summaries[chokepointId] ?? null;
  const detail = detailData?.detail ?? null;
  return {
    summary: summary?.chokepointId === chokepointId ? summary : null,
    detail: detail?.chokepointId === chokepointId ? detail : null,
  };
}

const integerFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

export function formatEstimatedTons(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : `${integerFormatter.format(value)} t`;
}

export function formatVesselCalls(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : `${integerFormatter.format(value)}척`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function buildNetworkChartPath(
  values: readonly (number | null)[],
  width = 420,
  height = 120,
): string {
  const finiteValues = values.filter((value): value is number => value !== null);
  if (finiteValues.length === 0) return "";
  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  const range = maximum - minimum || 1;
  const denominator = Math.max(values.length - 1, 1);
  let drawing = false;
  return values.map((value, index) => {
    if (value === null) {
      drawing = false;
      return "";
    }
    const x = (index / denominator) * width;
    const y = height - ((value - minimum) / range) * height;
    const command = drawing ? "L" : "M";
    drawing = true;
    return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
  }).filter(Boolean).join(" ");
}
