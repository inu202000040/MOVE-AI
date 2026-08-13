import {
  economicLoss,
  type CvarCandidateResult,
  type CvarForecast,
  type CvarSimulationInput,
} from "./engine";

export interface ComparisonSeriesGeometry {
  readonly name: "상한" | "점예측" | "하한" | "고정운임";
  readonly value: number;
  readonly color: string;
  readonly dashed: boolean;
  readonly y: number;
  labelY: number;
}

export interface ComparisonGeometry {
  readonly domainMin: number;
  readonly domainMax: number;
  readonly ticks: readonly { readonly y: number; readonly value: number }[];
  readonly series: readonly ComparisonSeriesGeometry[];
}

export interface SpectrumGeometry {
  readonly leftMin: number;
  readonly leftMax: number;
  readonly rightMax: number;
  readonly recommendationBandStart: number;
  readonly recommendationBandEnd: number;
}

export interface CvarPercentileRow {
  readonly percentile: number;
  readonly spot: number;
  readonly difference: number;
  readonly totalCost: number;
  readonly unitCost: number;
  readonly loss: number;
  readonly direction: "가격 동일" | "Spot 하락손실" | "Spot 상승손실";
}

export function createComparisonGeometry(
  forecast: CvarForecast,
  fixed: number,
): ComparisonGeometry {
  const rawValues = [forecast.lower90, forecast.point, forecast.upper90, fixed];
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);
  const padding = Math.max(8, (rawMax - rawMin) * 0.24, rawMax * 0.035);
  const domainMin = Math.max(0, rawMin - padding);
  const domainMax = rawMax + padding;
  const plotTop = 30;
  const plotBottom = 248;
  const yFor = (value: number) =>
    plotBottom - ((value - domainMin) / (domainMax - domainMin)) * (plotBottom - plotTop);
  const series: ComparisonSeriesGeometry[] = [
    { name: "상한", value: forecast.upper90, color: "#d64545", dashed: true, y: yFor(forecast.upper90), labelY: yFor(forecast.upper90) },
    { name: "점예측", value: forecast.point, color: "#3fa1eb", dashed: false, y: yFor(forecast.point), labelY: yFor(forecast.point) },
    { name: "하한", value: forecast.lower90, color: "#087352", dashed: true, y: yFor(forecast.lower90), labelY: yFor(forecast.lower90) },
    { name: "고정운임", value: fixed, color: "#7c3aed", dashed: false, y: yFor(fixed), labelY: yFor(fixed) },
  ];
  const sorted = [...series].sort((left, right) => left.y - right.y);
  sorted.forEach((item, index) => {
    item.labelY = Math.max(item.y, index === 0 ? 34 : sorted[index - 1].labelY + 25);
  });
  const overflow = sorted.at(-1)?.labelY ?? 0;
  if (overflow > 242) {
    sorted.forEach((item) => {
      item.labelY -= overflow - 242;
    });
  }
  return {
    domainMin,
    domainMax,
    ticks: [0, 1, 2, 3, 4].map((index) => ({
      y: plotTop + ((plotBottom - plotTop) * index) / 4,
      value: domainMax - ((domainMax - domainMin) * index) / 4,
    })),
    series,
  };
}

export function createSpectrumGeometry(
  results: readonly CvarCandidateResult[],
  recommendedShare: number,
): SpectrumGeometry {
  const allLeft = results.flatMap((item) => [item.expected, item.objective]);
  const rawLeftMin = Math.min(...allLeft);
  const rawLeftMax = Math.max(...allLeft);
  const leftPadding = (rawLeftMax - rawLeftMin) * 0.12;
  return {
    leftMin: rawLeftMin - leftPadding,
    leftMax: rawLeftMax + leftPadding,
    rightMax: Math.max(...results.map((item) => item.cvar)) * 1.12,
    recommendationBandStart: Math.max(0, recommendedShare - 2.5),
    recommendationBandEnd: Math.min(100, recommendedShare + 2.5),
  };
}

export function calculateSpotExceedProbability(
  spots: Float64Array,
  fixed: number,
): number {
  let exceedCount = 0;
  for (const spot of spots) {
    if (spot > fixed) exceedCount += 1;
  }
  return spots.length === 0 ? 0 : exceedCount / spots.length;
}

export function createPercentileRows(
  spots: Float64Array,
  input: CvarSimulationInput,
  best: CvarCandidateResult,
): readonly CvarPercentileRow[] {
  const sorted = Array.from(spots).sort((left, right) => left - right);
  const fixedShare = best.share / 100;
  return [1, 5, 10, 25, 50, 75, 90, 95, 99].map((percentile) => {
    const spot = sorted[Math.round((sorted.length - 1) * (percentile / 100))];
    const totalCost =
      input.volume *
      (fixedShare * input.fixed + (1 - fixedShare) * spot);
    const difference = spot - input.fixed;
    return {
      percentile,
      spot,
      difference,
      totalCost,
      unitCost: totalCost / input.volume,
      loss: economicLoss(spot, input.fixed, fixedShare, input.volume),
      direction:
        Math.abs(difference) < 0.005
          ? "가격 동일"
          : difference < 0
            ? "Spot 하락손실"
            : "Spot 상승손실",
    };
  });
}

export function riskBarWidth(component: number, cvar: number): number {
  if (component <= 0 || cvar <= 0) return 0;
  return Math.max(4, (component / cvar) * 100);
}

export function publishAllocationRoute(
  value: unknown,
  changeRoute: (candidate: unknown) => boolean,
): boolean {
  return changeRoute(value);
}
