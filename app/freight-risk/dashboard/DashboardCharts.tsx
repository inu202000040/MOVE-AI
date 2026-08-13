"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DAY = 86_400_000;
const FULL_START = Date.parse("2022-10-01T00:00:00Z");
const RECENT_START = Date.parse("2026-01-01T00:00:00Z");
const MIN_SPAN = 56 * DAY;

export interface ChartPoint {
  readonly date: string;
  readonly value: number;
}

export interface ForecastPoint {
  readonly horizon: number;
  readonly targetDate: string;
  readonly point: number;
  readonly lower: number;
  readonly upper: number;
}

function time(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
}

function useMeasuredWidth(minimum = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(minimum);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(minimum, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [minimum]);
  return { ref, width };
}

function linePath(points: readonly { readonly x: number; readonly y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function clampViewport(start: number, end: number, fullEnd: number): [number, number] {
  let span = Math.max(MIN_SPAN, end - start);
  span = Math.min(span, fullEnd - FULL_START);
  let nextStart = start;
  if (nextStart < FULL_START) nextStart = FULL_START;
  if (nextStart + span > fullEnd) nextStart = fullEnd - span;
  return [nextStart, nextStart + span];
}

export function FreightChart({
  actual,
  forecasts,
  selectedHorizon,
  modelName,
  modelColor = "#15269d",
  resetKey,
}: {
  readonly actual: readonly ChartPoint[];
  readonly forecasts: readonly ForecastPoint[];
  readonly selectedHorizon: number;
  readonly modelName: string;
  readonly modelColor?: string;
  readonly resetKey: string;
}) {
  const { ref, width } = useMeasuredWidth();
  const height = 300;
  const pad = { top: 24, right: 24, bottom: 52, left: 82 };
  const dataLeft = pad.left + 14;
  const dataRight = width - pad.right - 14;
  const plotBottom = height - pad.bottom;
  const fullEnd = time(forecasts.at(-1)?.targetDate ?? actual.at(-1)?.date ?? "2026-08-31");
  const [viewport, setViewport] = useState<[number, number]>([RECENT_START, fullEnd]);
  const [hovered, setHovered] = useState<{ x: number; y: number; label: string; date: string; value: number } | null>(null);
  const drag = useRef<{ pointerId: number; x: number; viewport: [number, number] } | null>(null);

  useEffect(() => {
    setViewport([RECENT_START, fullEnd]);
    setHovered(null);
  }, [fullEnd, resetKey]);

  const scale = useMemo(() => {
    const visibleActual = actual.filter((point) => time(point.date) >= viewport[0] && time(point.date) <= viewport[1]);
    const visibleForecast = forecasts.filter((point) => time(point.targetDate) >= viewport[0] && time(point.targetDate) <= viewport[1]);
    const values = [
      ...visibleActual.map((point) => point.value),
      ...visibleForecast.flatMap((point) => [point.point, point.lower, point.upper]),
    ];
    const fallback = [...actual.map((point) => point.value), ...forecasts.flatMap((point) => [point.point, point.lower, point.upper])];
    const domain = values.length === 0 ? fallback : values;
    const rawMin = Math.min(...domain);
    const rawMax = Math.max(...domain);
    const yPad = Math.max(1, (rawMax - rawMin) * 0.13);
    const min = Math.max(0, rawMin - yPad);
    const max = rawMax + yPad;
    const x = (timestamp: number) => dataLeft + ((timestamp - viewport[0]) / (viewport[1] - viewport[0])) * (dataRight - dataLeft);
    const y = (value: number) => pad.top + ((max - value) / (max - min)) * (plotBottom - pad.top);
    return { min, max, x, y };
  }, [actual, dataLeft, dataRight, forecasts, plotBottom, viewport]);

  const renderedActual = actual
    .map((point) => ({ ...point, timestamp: time(point.date) }))
    .filter((point, index, points) => point.timestamp >= viewport[0] && point.timestamp <= viewport[1]
      || index > 0 && points[index - 1].timestamp < viewport[0] && point.timestamp > viewport[0]
      || index < points.length - 1 && point.timestamp < viewport[1] && points[index + 1].timestamp > viewport[1]);
  const lastActual = actual.at(-1);
  const forecastLine = lastActual === undefined ? [] : [
    { date: lastActual.date, value: lastActual.value },
    ...forecasts.map((point) => ({ date: point.targetDate, value: point.point })),
  ].filter((point) => time(point.date) >= viewport[0] && time(point.date) <= viewport[1]);
  const actualEnd = time(lastActual?.date ?? "2026-08-03");
  const dividerX = Math.max(dataLeft, Math.min(dataRight, scale.x(actualEnd)));
  const span = viewport[1] - viewport[0];

  const zoom = (factor: number, anchor = 0.5) => {
    const nextSpan = Math.max(MIN_SPAN, Math.min(fullEnd - FULL_START, span * factor));
    const anchorTime = viewport[0] + span * anchor;
    setViewport(clampViewport(anchorTime - nextSpan * anchor, anchorTime + nextSpan * (1 - anchor), fullEnd));
    setHovered(null);
  };
  const pan = (ratio: number) => {
    const delta = span * ratio;
    setViewport(clampViewport(viewport[0] + delta, viewport[1] + delta, fullEnd));
    setHovered(null);
  };
  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = Math.max(0, Math.min(1, (event.clientX - rect.left - dataLeft) / Math.max(1, dataRight - dataLeft)));
    zoom(Math.exp(Math.max(-160, Math.min(160, event.deltaY)) * 0.0018), anchor);
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    switch (event.key) {
      case "+": case "=": zoom(0.72); break;
      case "-": zoom(1.38); break;
      case "ArrowLeft": pan(-0.16); break;
      case "ArrowRight": pan(0.16); break;
      case "Home": setViewport([RECENT_START, fullEnd]); break;
      case "End": setViewport([FULL_START, fullEnd]); break;
      case "Escape": setHovered(null); break;
      default: return;
    }
    event.preventDefault();
  };

  return (
    <div className="chart-shell" ref={ref}>
      <div aria-label="차트 기간 탐색" className="chart-toolbar" role="toolbar">
        <span><strong>{formatDate(viewport[0])} – {formatDate(viewport[1])}</strong><small>실측 시작 2022.11.07</small></span>
        <span className="chart-hint" id="chart-navigation-hint">휠 확대·축소 · 가로 드래그 이동</span>
        <div className="chart-toolbar-actions">
          <button aria-label="확대" disabled={span <= MIN_SPAN + DAY} onClick={() => zoom(0.72)}>+</button>
          <button aria-label="축소" disabled={viewport[0] <= FULL_START && viewport[1] >= fullEnd} onClick={() => zoom(1.38)}>−</button>
          <button disabled={viewport[0] <= FULL_START && viewport[1] >= fullEnd} onClick={() => setViewport([FULL_START, fullEnd])}>전체</button>
          <button disabled={viewport[0] === RECENT_START && viewport[1] === fullEnd} onClick={() => setViewport([RECENT_START, fullEnd])}>최근</button>
        </div>
      </div>
      <div className="chart-stage">
        <svg
          aria-describedby="chart-navigation-hint"
          aria-label="KCCI 운임 차트. 휠로 확대 축소하고 가로 드래그로 기간을 이동할 수 있습니다."
          className="freight-chart"
          height={height}
          onDoubleClick={() => setViewport([RECENT_START, fullEnd])}
          onKeyDown={onKeyDown}
          onPointerCancel={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerDown={(event: PointerEvent<SVGSVGElement>) => {
            if (event.button !== 0) return;
            drag.current = { pointerId: event.pointerId, x: event.clientX, viewport };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (active === null || active.pointerId !== event.pointerId) return;
            const delta = ((active.x - event.clientX) / Math.max(1, dataRight - dataLeft)) * (active.viewport[1] - active.viewport[0]);
            setViewport(clampViewport(active.viewport[0] + delta, active.viewport[1] + delta, fullEnd));
          }}
          onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onWheel={onWheel}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          tabIndex={0}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
        >
          <rect className="forecast-zone" height={plotBottom - pad.top} rx="8" width={Math.max(0, width - pad.right - dividerX)} x={dividerX} y={pad.top} />
          {Array.from({ length: 5 }, (_, index) => {
            const value = scale.min + ((scale.max - scale.min) * index) / 4;
            const y = scale.y(value);
            return <g key={value}><line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} /><text className="chart-axis" textAnchor="end" x={pad.left - 12} y={y + 4}>{Math.round(value).toLocaleString("ko-KR")}</text></g>;
          })}
          {Array.from({ length: 5 }, (_, index) => {
            const timestamp = viewport[0] + (span * index) / 4;
            return <text className="chart-axis" key={timestamp} textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"} x={dataLeft + ((dataRight - dataLeft) * index) / 4} y={height - 20}>{formatDate(timestamp)}</text>;
          })}
          <text className="chart-axis-title" textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`} x="18" y={height / 2}>KCCI</text>
          <text className="chart-axis-title" textAnchor="end" x={width - pad.right} y={height - 3}>날짜</text>
          <line className="forecast-divider" x1={dividerX} x2={dividerX} y1={pad.top} y2={plotBottom} />
          <text className="forecast-zone-label" x={Math.min(width - 84, dividerX + 14)} y={pad.top + 17}>예측 구간</text>
          <path className="actual-line" d={linePath(renderedActual.map((point) => ({ x: scale.x(point.timestamp), y: scale.y(point.value) })))} />
          <path d={linePath(forecastLine.map((point) => ({ x: scale.x(time(point.date)), y: scale.y(point.value) })))} fill="none" stroke={modelColor} strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.4" />
          {forecasts.filter((point) => time(point.targetDate) >= viewport[0] && time(point.targetDate) <= viewport[1]).map((point) => {
            const x = scale.x(time(point.targetDate));
            const selected = point.horizon === selectedHorizon;
            const upper = scale.y(point.upper);
            const lower = scale.y(point.lower);
            const rangeTitle = `${point.horizon}주 PI90 ${point.targetDate} · ${Math.round(point.point).toLocaleString("ko-KR")} · PI90 ${Math.round(point.lower).toLocaleString("ko-KR")}~${Math.round(point.upper).toLocaleString("ko-KR")}`;
            return <g className={selected ? "range selected" : "range"} key={point.horizon}><title>{rangeTitle}</title><line x1={x} x2={x} y1={upper} y2={lower} /><line x1={x - 8} x2={x + 8} y1={upper} y2={upper} /><line x1={x - 8} x2={x + 8} y1={lower} y2={lower} /><circle cx={x} cy={scale.y(point.point)} fill={modelColor} onBlur={() => setHovered(null)} onFocus={() => setHovered({ x, y: scale.y(point.point), label: `${modelName} ${point.horizon}주 예측`, date: point.targetDate, value: point.point })} onMouseEnter={() => setHovered({ x, y: scale.y(point.point), label: `${modelName} ${point.horizon}주 예측`, date: point.targetDate, value: point.point })} onMouseLeave={() => setHovered(null)} r={point.horizon === 4 ? 7 : 4.6} tabIndex={0} /></g>;
          })}
        </svg>
        {hovered !== null && <div className="chart-tooltip" style={{ left: `${Math.max(26, Math.min(74, (hovered.x / width) * 100))}%`, top: `${Math.max(8, (hovered.y / height) * 100 - 12)}%` }}><strong>{hovered.label}</strong><span>{hovered.date}</span><b>{Math.round(hovered.value).toLocaleString("ko-KR")} USD/FEU</b></div>}
      </div>
    </div>
  );
}

export function MarketChart({ points, color, unit }: { readonly points: readonly ChartPoint[]; readonly color: string; readonly unit: string }) {
  const { ref, width } = useMeasuredWidth();
  const height = 208;
  const pad = { top: 24, right: 24, bottom: 52, left: 82 };
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yPad = Math.max(1, (rawMax - rawMin) * 0.13);
  const min = Math.max(0, rawMin - yPad);
  const max = rawMax + yPad;
  const start = time(points[0]?.date ?? "2026-01-01");
  const end = time(points.at(-1)?.date ?? "2026-08-03");
  const x = (date: string) => pad.left + ((time(date) - start) / Math.max(1, end - start)) * (width - pad.right - pad.left);
  const y = (value: number) => pad.top + ((max - value) / Math.max(1, max - min)) * (height - pad.top - pad.bottom);
  return <div className="market-chart-shell" ref={ref}><svg aria-label={`${unit} 시장 지표 차트`} height={height} preserveAspectRatio="xMidYMid meet" role="img" viewBox={`0 0 ${width} ${height}`} width={width}>
    {Array.from({ length: 5 }, (_, index) => { const value = min + ((max - min) * index) / 4; const yy = y(value); return <g key={value}><line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} /><text className="chart-axis" textAnchor="end" x={pad.left - 12} y={yy + 4}>{Math.round(value).toLocaleString("ko-KR")}</text></g>; })}
    {[0, 0.5, 1].map((ratio) => <text className="chart-axis" key={ratio} textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"} x={pad.left + (width - pad.left - pad.right) * ratio} y={height - 20}>{formatDate(start + (end - start) * ratio)}</text>)}
    <text className="chart-axis-title" textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`} x="18" y={height / 2}>{unit}</text>
    <text className="chart-axis-title" textAnchor="end" x={width - pad.right} y={height - 3}>날짜</text>
    <path d={linePath(points.map((point) => ({ x: x(point.date), y: y(point.value) })))} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
    {points.map((point, index) => <circle cx={x(point.date)} cy={y(point.value)} fill={color} key={point.date} r={index === points.length - 1 ? 5.5 : 3.8} stroke="white" strokeWidth="2"><title>{`${point.date} · ${point.value.toLocaleString("ko-KR")} ${unit}`}</title></circle>)}
  </svg></div>;
}
