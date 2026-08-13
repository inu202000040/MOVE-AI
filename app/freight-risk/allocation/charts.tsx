"use client";

import { useMemo, useRef, useState } from "react";

import type {
  CvarCandidateResult,
  CvarSimulationInput,
  CvarSimulationResult,
} from "./engine";
import type { AllocationRepresentativeInput } from "./representative";
import { createComparisonGeometry, createSpectrumGeometry } from "./view-model";
import styles from "./allocation.module.css";

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return money(value);
}

export function displayDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function polylinePath(
  values: readonly number[],
  xFor: (index: number) => number,
  yFor: (value: number) => number,
): string {
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(2)},${yFor(value).toFixed(2)}`)
    .join(" ");
}

export function ComparisonChart({
  input,
  representative,
}: {
  readonly input: CvarSimulationInput;
  readonly representative: AllocationRepresentativeInput;
}) {
  const forecast = input.forecasts[input.selectedHorizon - 1];
  const geometry = createComparisonGeometry(forecast, input.fixed);

  return (
    <div className={styles.chartScroll}>
      <svg
        aria-label={`${input.selectedHorizon}주 Spot PI90과 입력 고정운임 비교`}
        className={styles.comparisonSvg}
        role="img"
        viewBox="0 0 720 300"
      >
        {geometry.ticks.map(({ y, value }, index) => {
          return (
            <g key={index}>
              <line className={styles.gridLine} x1="72" x2="500" y1={y} y2={y} />
              <text className={styles.axisText} textAnchor="end" x="62" y={y + 4}>
                {money(value)}
              </text>
            </g>
          );
        })}
        {geometry.series.map((item) => (
          <g key={item.name}>
            <line
              stroke={item.color}
              strokeDasharray={item.dashed ? "7 6" : undefined}
              strokeWidth={item.dashed ? 1.5 : 2.5}
              x1="72"
              x2="500"
              y1={item.y}
              y2={item.y}
            />
            <circle cx="500" cy={item.y} fill={item.color} r="4.5" />
            {Math.abs(item.labelY - item.y) > 1 ? (
              <path
                d={`M504,${item.y} L522,${item.labelY}`}
                fill="none"
                stroke={item.color}
                strokeWidth="1"
              />
            ) : null}
            <text fill={item.color} fontSize="12" fontWeight="700" x="530" y={item.labelY + 4}>
              {item.name} ({money(item.value)})
            </text>
          </g>
        ))}
        <text className={styles.chartCaption} x="72" y="284">
          대표모델 {representative.selection.modelName} · 판단 시점 {input.selectedHorizon}주
        </text>
      </svg>
    </div>
  );
}

export function SpectrumChart({ result }: { readonly result: CvarSimulationResult }) {
  const [hovered, setHovered] = useState<CvarCandidateResult | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const left = 76;
  const right = 844;
  const top = 42;
  const bottom = 312;
  const geometry = createSpectrumGeometry(result.results, result.best.share);
  const xFor = (share: number) => left + (share / 100) * (right - left);
  const leftY = (value: number) => bottom - ((value - geometry.leftMin) / (geometry.leftMax - geometry.leftMin)) * (bottom - top);
  const rightY = (value: number) => bottom - (value / geometry.rightMax) * (bottom - top);
  const expectedPath = polylinePath(result.results.map((item) => item.expected), xFor, leftY);
  const objectivePath = polylinePath(result.results.map((item) => item.objective), xFor, leftY);
  const cvarPath = polylinePath(result.results.map((item) => item.cvar), xFor, rightY);
  const downArea = `${polylinePath(result.results.map((item) => item.downward), xFor, rightY)} L${right},${bottom} L${left},${bottom} Z`;
  const upAreaTop = result.results
    .map((item, index) => `${index === 0 ? "M" : "L"}${xFor(index)},${rightY(item.downward + item.upward)}`)
    .join(" ");
  const upAreaBottom = [...result.results]
    .reverse()
    .map((item) => `L${xFor(item.share)},${rightY(item.downward)}`)
    .join(" ");
  const recommendationX = xFor(result.best.share);

  return (
    <div className={styles.spectrumWrap}>
      <div className={styles.chartScroll}>
        <svg
          aria-label="고정운임 0%부터 100%까지 101개 배분비율의 예상 비용, 후회비용, 최종 총비용 비교"
          className={styles.spectrumSvg}
          onPointerLeave={() => setHovered(null)}
          onPointerMove={(event) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const viewX = ((event.clientX - rect.left) / rect.width) * 920;
            const share = Math.max(0, Math.min(100, Math.round(((viewX - left) / (right - left)) * 100)));
            setHovered(result.results[share]);
          }}
          ref={svgRef}
          role="img"
          tabIndex={0}
          viewBox="0 0 920 360"
        >
          {[0, 1, 2, 3, 4].map((index) => {
            const y = top + ((bottom - top) * index) / 4;
            return <line className={styles.gridLine} key={index} x1={left} x2={right} y1={y} y2={y} />;
          })}
          <rect
            className={styles.recommendationBand}
            height={bottom - top}
            width={xFor(geometry.recommendationBandEnd) - xFor(geometry.recommendationBandStart)}
            x={xFor(geometry.recommendationBandStart)}
            y={top}
          />
          <path className={styles.downArea} d={downArea} />
          <path className={styles.upArea} d={`${upAreaTop} ${upAreaBottom} Z`} />
          <path className={styles.expectedLine} d={expectedPath} />
          <path className={styles.objectiveLine} d={objectivePath} />
          <path className={styles.cvarLine} d={cvarPath} />
          <line className={styles.recommendationLine} x1={recommendationX} x2={recommendationX} y1={top} y2={bottom} />
          <text className={styles.recommendationText} textAnchor="middle" x={recommendationX} y="28">
            추천 {result.best.share}%
          </text>
          <circle className={styles.expectedPoint} cx={recommendationX} cy={leftY(result.best.expected)} r="5" />
          <circle className={styles.objectivePoint} cx={recommendationX} cy={leftY(result.best.objective)} r="6" />
          <circle className={styles.cvarPoint} cx={recommendationX} cy={rightY(result.best.cvar)} r="4" />
          {[0, 20, 40, 60, 80, 100].map((share) => (
            <text className={styles.axisText} key={share} textAnchor="middle" x={xFor(share)} y="337">
              {share}%
            </text>
          ))}
          <text className={styles.axisTitle} transform="rotate(-90 18 180)" x="18" y="180">
            예상·최종 총비용
          </text>
          <text className={styles.axisTitle} transform="rotate(90 902 180)" x="902" y="180">
            후회비용
          </text>
        </svg>
      </div>
      {hovered ? (
        <div
          className={styles.spectrumTooltip}
          style={{ left: `${Math.max(24, Math.min(76, hovered.share))}%` }}
        >
          <strong>고정 {hovered.share}% · Spot {hovered.spotShare}%</strong>
          <span>예상 비용 {money(hovered.expected)}</span>
          <span>평균단가 {money(hovered.averageUnitCost)} / FEU</span>
          <span>후회비용 {money(hovered.cvar)}</span>
          <span>최종 총비용 {money(hovered.objective)}</span>
          <span>상승 {money(hovered.upward)} · 하락 {money(hovered.downward)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function PathsChart({
  input,
  representative,
  result,
  routeName,
}: {
  readonly input: CvarSimulationInput;
  readonly representative: AllocationRepresentativeInput;
  readonly result: CvarSimulationResult;
  readonly routeName: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const geometry = useMemo(() => {
    const left = 72;
    const right = 872;
    const top = 35;
    const bottom = 256;
    const allValues = [
      input.current,
      ...input.forecasts.flatMap((forecast) => [forecast.lower90, forecast.upper90]),
      ...result.samplePaths.flatMap((path) => path.points),
    ];
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const padding = (rawMax - rawMin) * 0.08;
    const min = Math.max(0, rawMin - padding);
    const max = rawMax + padding;
    return {
      left,
      right,
      top,
      bottom,
      min,
      max,
      xFor: (index: number) => left + (index / 4) * (right - left),
      yFor: (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top),
    };
  }, [input, result]);
  const selectedX = geometry.xFor(input.selectedHorizon);
  const focusX = Math.max(geometry.left, Math.min(geometry.right - 140, selectedX - 70));
  const pointPath = polylinePath(
    [input.current, ...input.forecasts.map((forecast) => forecast.point)],
    geometry.xFor,
    geometry.yFor,
  );
  const hoverInfo = useMemo(() => {
    if (hoveredIndex === null) return null;
    const sorted = result.samplePaths
      .map((path) => path.points[hoveredIndex])
      .sort((leftValue, rightValue) => leftValue - rightValue);
    const percentile = (ratio: number): number =>
      sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))]
      ?? input.current;
    const forecast = hoveredIndex === 0 ? null : input.forecasts[hoveredIndex - 1];
    return {
      forecast,
      index: hoveredIndex,
      p10: percentile(0.1),
      p50: percentile(0.5),
      p90: percentile(0.9),
      point: hoveredIndex === 0 ? input.current : forecast?.point ?? input.current,
    };
  }, [hoveredIndex, input, result.samplePaths]);

  const selectHoverIndex = (clientX: number): void => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewX = ((clientX - rect.left) / rect.width) * 900;
    const index = Math.max(
      0,
      Math.min(4, Math.round(((viewX - geometry.left) / (geometry.right - geometry.left)) * 4)),
    );
    setHoveredIndex(index);
  };

  return (
    <section className={styles.pathPanel}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>JOINT 4-WEEK PATHS</span>
          <h3>{routeName} · 4주 운임경로</h3>
          <p>PI90 폭과 주간 연결성을 반영한 미래 운임경로입니다.</p>
        </div>
        <span className={styles.badge}>100,000개 생성 완료</span>
      </div>
      <div className={styles.pathChartWrap}>
        <div className={styles.chartScroll}>
          <svg
          aria-describedby={hoverInfo ? "allocation-path-tooltip" : undefined}
          aria-label={`${routeName} 현재부터 4주까지 250개 표본 운임경로와 PI90`}
          className={styles.pathSvg}
          onBlur={() => setHoveredIndex(null)}
          onFocus={() => setHoveredIndex(input.selectedHorizon)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setHoveredIndex((current) => {
              const base = current ?? input.selectedHorizon;
              return event.key === "ArrowLeft" ? Math.max(0, base - 1) : Math.min(4, base + 1);
            });
          }}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={(event) => selectHoverIndex(event.clientX)}
          ref={svgRef}
          role="application"
          tabIndex={0}
          viewBox="0 0 900 300"
        >
          <rect className={styles.pathFocusBand} height={geometry.bottom - geometry.top} width="140" x={focusX} y={geometry.top} />
          {[0, 1, 2, 3, 4].map((index) => {
            const y = geometry.top + ((geometry.bottom - geometry.top) * index) / 4;
            const value = geometry.max - ((geometry.max - geometry.min) * index) / 4;
            return (
              <g key={index}>
                <line className={styles.gridLine} x1={geometry.left} x2={geometry.right} y1={y} y2={y} />
                <text className={styles.axisText} textAnchor="end" x="62" y={y + 4}>{money(value)}</text>
              </g>
            );
          })}
          {result.samplePaths.map((path) => (
            <path
              className={path.selectedOutsidePi90 ? styles.tailPath : styles.normalPath}
              d={polylinePath(path.points, geometry.xFor, geometry.yFor)}
              key={path.scenario}
            />
          ))}
          {input.forecasts.map((forecast, index) => {
            const x = geometry.xFor(index + 1);
            const upper = geometry.yFor(forecast.upper90);
            const lower = geometry.yFor(forecast.lower90);
            return (
              <g className={styles.interval} key={forecast.horizonWeeks}>
                <line x1={x} x2={x} y1={upper} y2={lower} />
                <line x1={x - 8} x2={x + 8} y1={upper} y2={upper} />
                <line x1={x - 8} x2={x + 8} y1={lower} y2={lower} />
              </g>
            );
          })}
          <path className={styles.pointPath} d={pointPath} />
          {hoverInfo ? (
            <g aria-hidden="true" className={styles.pathHoverGuide}>
              <line
                x1={geometry.xFor(hoverInfo.index)}
                x2={geometry.xFor(hoverInfo.index)}
                y1={geometry.top}
                y2={geometry.bottom}
              />
              <circle
                cx={geometry.xFor(hoverInfo.index)}
                cy={geometry.yFor(hoverInfo.point)}
                r="5"
              />
            </g>
          ) : null}
          {["현재", "1주", "2주", "3주", "4주"].map((label, index) => (
            <text className={styles.axisText} key={label} textAnchor="middle" x={geometry.xFor(index)} y="280">{label}</text>
          ))}
          <text className={styles.pathFocusLabel} textAnchor="middle" x={Math.max(62, Math.min(838, selectedX))} y="24">
            판단 시점 {input.selectedHorizon}주
          </text>
          </svg>
        </div>
        {hoverInfo ? (
          <div
            className={styles.pathTooltip}
            id="allocation-path-tooltip"
            role="tooltip"
            style={{ left: `${Math.max(17, Math.min(83, 8 + hoverInfo.index * 21))}%` }}
          >
            <strong>
              {hoverInfo.index === 0
                ? "현재 운임"
                : `${hoverInfo.index}주 · ${displayDate(hoverInfo.forecast?.targetDate ?? "")}`}
            </strong>
            <span>모델 점예측 {money(hoverInfo.point)} / FEU</span>
            {hoverInfo.forecast ? (
              <span>PI90 {money(hoverInfo.forecast.lower90)} ~ {money(hoverInfo.forecast.upper90)}</span>
            ) : null}
            <span>표본 경로 P10 {money(hoverInfo.p10)} · P50 {money(hoverInfo.p50)} · P90 {money(hoverInfo.p90)}</span>
          </div>
        ) : null}
      </div>
      <div className={styles.chartLegend}>
        <span data-tone="point">모델 점예측</span><span data-tone="interval">PI90</span>
        <span data-tone="normal">일반 경로</span><span data-tone="tail">PI90 밖 꼬리 경로</span>
      </div>
      <div className={styles.pathMeta}>
        <span>대표모델 {representative.selection.modelName} · 1~4주 PI90 반영</span>
        <span>계산 100,000개 · 화면 표시 250개 · 시차상관 0.75</span>
      </div>
    </section>
  );
}
