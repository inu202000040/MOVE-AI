"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MODEL_REGISTRY } from "./core/registry";
import type { EightTuple, ModelProjectionV1, RepresentativeSelectionV1, RiskModelId } from "./core/types";
import type { HistoricalPointV1 } from "./models-data-types";
import styles from "./models.module.css";
import { zoomedHistoryWindowSize, type HistoryZoomDirectionV1 } from "./view-model";

type RangeMode = "recent" | "all";

interface TooltipV1 {
  readonly modelId: RiskModelId;
  readonly horizon: number;
  readonly x: number;
  readonly y: number;
}

interface ForecastComparisonChartProps {
  readonly history: readonly HistoricalPointV1[];
  readonly models: EightTuple<ModelProjectionV1>;
  readonly routeName: string;
  readonly representative: RepresentativeSelectionV1;
  readonly selectedModels: ReadonlySet<RiskModelId>;
  readonly rangeMode: RangeMode;
  readonly onRangeModeChange: (mode: RangeMode) => void;
}

const INITIAL_WIDTH = 1160;
const HEIGHT = 338;
const RECENT_HISTORY_POINTS = 4;
const PLOT = { top: 20, bottom: 42 } as const;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function linePath(points: readonly { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

export function ForecastComparisonChart({
  history,
  models,
  routeName,
  representative,
  selectedModels,
  rangeMode,
  onRangeModeChange,
}: ForecastComparisonChartProps) {
  const [hoveredModel, setHoveredModel] = useState<RiskModelId | null>(null);
  const [tooltip, setTooltip] = useState<TooltipV1 | null>(null);
  const clearTooltip = () => setTooltip(null);
  const clearChartHover = () => {
    setHoveredModel(null);
    setTooltip(null);
  };
  const [chartWidth, setChartWidth] = useState(INITIAL_WIDTH);
  const minimumHistoryCount = Math.min(RECENT_HISTORY_POINTS, history.length);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(
    rangeMode === "recent" ? minimumHistoryCount : history.length,
  );
  const chartRef = useRef<SVGSVGElement>(null);
  const shownModels = selectedModels.size === 0
    ? models
    : models.filter(({ modelId }) => selectedModels.has(modelId));

  const selectRange = (mode: RangeMode) => {
    setTooltip(null);
    setVisibleHistoryCount(mode === "recent" ? minimumHistoryCount : history.length);
    onRangeModeChange(mode);
  };

  const zoomHistory = (direction: HistoryZoomDirectionV1) => {
    setTooltip(null);
    setVisibleHistoryCount((current) => zoomedHistoryWindowSize(
      current,
      history.length,
      direction,
      minimumHistoryCount,
    ));
  };

  useEffect(() => {
    setVisibleHistoryCount(rangeMode === "recent" ? minimumHistoryCount : history.length);
  }, [history.length, minimumHistoryCount, rangeMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTooltip(null);
      if (event.key === "Home") {
        setVisibleHistoryCount(minimumHistoryCount);
        onRangeModeChange("recent");
      }
      if (event.key === "End") {
        setVisibleHistoryCount(history.length);
        onRangeModeChange("all");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [history.length, minimumHistoryCount, onRangeModeChange]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) return;
    const resize = () => setChartWidth(Math.max(260, chart.getBoundingClientRect().width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const visibleHistory = history.slice(-visibleHistoryCount);
    const forecastValues = shownModels.flatMap(({ forecasts }) => forecasts.map(({ point }) => point));
    const values = [...visibleHistory.map(({ value }) => value), ...forecastValues];
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = Math.max(1, rawMax - rawMin);
    const midpoint = (rawMax + rawMin) / 2;
    const pad = Math.max(1, range * 0.045, Math.abs(midpoint) * 0.0025);
    const min = Math.max(0, rawMin - pad);
    const max = rawMax + pad;
    const plotLeft = chartWidth <= 500 ? 44 : 68;
    const plotRight = chartWidth <= 500 ? 10 : 26;
    const plotWidth = chartWidth - plotLeft - plotRight;
    const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
    const y = (value: number) => PLOT.top + (max - value) / Math.max(1, max - min) * plotHeight;
    const current = history.at(-1);
    if (current === undefined) throw new Error("Chart history is empty");

    let actualPoints: readonly { x: number; y: number; date: string; value: number }[];
    let forecastX: readonly number[];
    if (visibleHistoryCount === minimumHistoryCount) {
      const actualWidth = plotWidth * 0.25;
      actualPoints = visibleHistory.map((point, index) => ({
        ...point,
        x: plotLeft + actualWidth * index / Math.max(1, visibleHistory.length - 1),
        y: y(point.value),
      }));
      forecastX = [0, 1, 2, 3, 4].map((index) => plotLeft + actualWidth + plotWidth * 0.75 * index / 4);
    } else {
      const start = Date.parse(`${visibleHistory[0].date}T00:00:00Z`);
      const endDate = models[0].forecasts[3].targetDate;
      const end = Date.parse(`${endDate}T00:00:00Z`);
      const xForDate = (date: string) => plotLeft + (Date.parse(`${date}T00:00:00Z`) - start) / (end - start) * plotWidth;
      actualPoints = visibleHistory.map((point) => ({ ...point, x: xForDate(point.date), y: y(point.value) }));
      forecastX = [current.date, ...models[0].forecasts.map(({ targetDate }) => targetDate)].map(xForDate);
    }
    const modelPoints = new Map<RiskModelId, readonly { x: number; y: number; point: number }[]>();
    for (const model of models) {
      modelPoints.set(model.modelId, [
        { x: forecastX[0], y: y(current.value), point: current.value },
        ...model.forecasts.map((forecast, index) => ({
          x: forecastX[index + 1], y: y(forecast.point), point: forecast.point,
        })),
      ]);
    }
    const ticks = Array.from({ length: 7 }, (_, index) => max - (max - min) * index / 6);
    return { visibleHistory, actualPoints, modelPoints, ticks, y, current, forecastX, plotLeft, plotRight };
  }, [chartWidth, history, minimumHistoryCount, models, shownModels, visibleHistoryCount]);

  const tooltipModel = tooltip === null ? null : models.find(({ modelId }) => modelId === tooltip.modelId) ?? null;
  const tooltipForecast = tooltipModel === null || tooltip === null ? null : tooltipModel.forecasts[tooltip.horizon - 1];
  const tooltipMetric = tooltipModel === null || tooltip === null ? null : tooltipModel.metricsByHorizon[tooltip.horizon - 1];
  const showNearestForecast = (
    modelId: RiskModelId,
    points: readonly { readonly x: number; readonly y: number; readonly point: number }[],
    clientX: number,
  ) => {
    const chart = chartRef.current;
    const forecastPoints = points.slice(1);
    if (chart === null || forecastPoints.length === 0) return;
    const bounds = chart.getBoundingClientRect();
    const localX = (clientX - bounds.left) / Math.max(1, bounds.width) * chartWidth;
    const nearestIndex = forecastPoints.reduce((bestIndex, point, index) => (
      Math.abs(point.x - localX) < Math.abs(forecastPoints[bestIndex].x - localX) ? index : bestIndex
    ), 0);
    const nearest = forecastPoints[nearestIndex];
    setTooltip({ modelId, horizon: nearestIndex + 1, x: nearest.x, y: nearest.y });
  };

  return (
    <div className={styles.chartShell} onDoubleClick={() => selectRange("recent")} onMouseLeave={clearChartHover} onPointerLeave={clearChartHover}>
      <div className={styles.chartRange} aria-label="차트 기간">
        <button aria-pressed={visibleHistoryCount === minimumHistoryCount} onClick={() => selectRange("recent")} type="button">최근</button>
        <button aria-pressed={visibleHistoryCount === history.length} onClick={() => selectRange("all")} type="button">전체</button>
        <button aria-label="그래프 확대" disabled={visibleHistoryCount === minimumHistoryCount} onClick={() => zoomHistory("in")} type="button">확대 +</button>
        <button aria-label="그래프 축소" disabled={visibleHistoryCount === history.length} onClick={() => zoomHistory("out")} type="button">축소 −</button>
        <button aria-label="그래프 확대/축소 초기화" disabled={visibleHistoryCount === minimumHistoryCount} onClick={() => selectRange("recent")} type="button">초기화</button>
        <output aria-live="polite">{visibleHistoryCount}주</output>
      </div>
      <svg
        aria-label={`${routeName} 항로 KCCI 실측과 8개 모델의 1주부터 4주 예측 비교`}
        className={styles.chart}
        onPointerCancel={clearChartHover}
        ref={chartRef}
        role="img"
        onWheel={(event) => {
          if (event.deltaY === 0) return;
          event.preventDefault();
          zoomHistory(event.deltaY < 0 ? "in" : "out");
        }}
        viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id="forecast-zone" x1="0" x2="1">
            <stop offset="0" stopColor="#3fa1eb" stopOpacity="0.09" />
            <stop offset="1" stopColor="#001290" stopOpacity="0.025" />
          </linearGradient>
        </defs>
        <rect
          fill="url(#forecast-zone)"
          height={HEIGHT - PLOT.top - PLOT.bottom}
          width={chartWidth - geometry.plotRight - geometry.forecastX[0]}
          x={geometry.forecastX[0]}
          y={PLOT.top}
        />
        {geometry.ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.chartGrid} x1={geometry.plotLeft} x2={chartWidth - geometry.plotRight} y1={geometry.y(tick)} y2={geometry.y(tick)} />
            <text className={styles.chartAxis} textAnchor="end" x={geometry.plotLeft - 8} y={geometry.y(tick) + 4}>{formatMoney(tick)}</text>
          </g>
        ))}
        <line className={styles.forecastDivider} x1={geometry.forecastX[0]} x2={geometry.forecastX[0]} y1={PLOT.top} y2={HEIGHT - PLOT.bottom} />
        <text className={styles.chartZoneLabel} x={geometry.forecastX[0] + 10} y={PLOT.top + 15}>FORECAST</text>
        <path className={styles.actualLine} d={linePath(geometry.actualPoints)} />
        {shownModels.map((model) => {
          const definition = MODEL_REGISTRY.find(({ id }) => id === model.modelId);
          const points = geometry.modelPoints.get(model.modelId) ?? [];
          const isRepresentative = representative.modelId === model.modelId;
          const isDimmed = hoveredModel !== null && hoveredModel !== model.modelId;
          return (
            <g
              className={styles.modelSeries}
              key={model.modelId}
              onPointerCancel={clearChartHover}
              onPointerEnter={(event) => {
                setHoveredModel(model.modelId);
                showNearestForecast(model.modelId, points, event.clientX);
              }}
              onPointerMove={(event) => showNearestForecast(model.modelId, points, event.clientX)}
              style={{ opacity: isDimmed ? 0.12 : 1 }}
            >
              <path
                className={styles.modelLineHitArea}
                d={linePath(points)}
              />
              <path
                className={styles.modelLine}
                d={linePath(points)}
                stroke={definition?.color}
                strokeWidth={hoveredModel === model.modelId ? 5.4 : isRepresentative ? 4.8 : 2.7}
              />
              {points.slice(1).map((point, index) => (
                <circle
                  aria-label={`${model.modelName} ${index + 1}주 예측 ${formatMoney(point.point)} USD/FEU`}
                  className={styles.chartPoint}
                  cx={point.x}
                  cy={point.y}
                  fill={definition?.color}
                  key={`${model.modelId}-${index}`}
                  onBlur={() => { setHoveredModel(null); clearTooltip(); }}
                  onClick={() => setTooltip({ modelId: model.modelId, horizon: index + 1, x: point.x, y: point.y })}
                  onFocus={() => {
                    setHoveredModel(model.modelId);
                    setTooltip({ modelId: model.modelId, horizon: index + 1, x: point.x, y: point.y });
                  }}
                  onPointerCancel={clearChartHover}
                  r={isRepresentative ? 4.8 : 3.4}
                  role="button"
                  tabIndex={0}
                />
              ))}
            </g>
          );
        })}
        <text className={styles.chartAxis} textAnchor="start" x={geometry.plotLeft} y={HEIGHT - 14}>{formatDate(geometry.visibleHistory[0].date)}</text>
        <text className={styles.chartAxis} textAnchor="middle" x={geometry.forecastX[0]} y={HEIGHT - 14}>{formatDate(geometry.current.date)}</text>
        <text className={styles.chartAxis} textAnchor="end" x={chartWidth - geometry.plotRight} y={HEIGHT - 14}>{formatDate(models[0].forecasts[3].targetDate)}</text>
        {tooltip !== null && tooltipForecast !== null && tooltipMetric !== null ? (
          <foreignObject height="152" pointerEvents="none" width={Math.min(220, chartWidth - 16)} x={Math.min(chartWidth - Math.min(220, chartWidth - 16) - 8, Math.max(8, tooltip.x - 105))} y={Math.min(HEIGHT - 162, Math.max(8, tooltip.y - 150))}>
            <div className={styles.chartTooltip}>
              <strong>{tooltipModel?.modelName} {tooltip.horizon}주 예측</strong>
              <span>{formatDate(tooltipForecast.targetDate)}</span>
              <dl>
                <div><dt>예측값</dt><dd>{formatMoney(tooltipForecast.point)}</dd></div>
                <div><dt>PI90 하한</dt><dd>{formatMoney(tooltipForecast.lower90)}</dd></div>
                <div><dt>PI90 상한</dt><dd>{formatMoney(tooltipForecast.upper90)}</dd></div>
                <div><dt>구간 너비</dt><dd>{formatMoney(tooltipForecast.upper90 - tooltipForecast.lower90)}</dd></div>
              </dl>
              <small>실현 Coverage {tooltipMetric.coverage.pct.toFixed(1)}% · {tooltipMetric.coverage.hits}/{tooltipMetric.coverage.total}회 적중</small>
            </div>
          </foreignObject>
        ) : null}
      </svg>
    </div>
  );
}
