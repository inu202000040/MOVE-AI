"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

import { DEFAULT_ROUTE_ID, ROUTE_IDS, ROUTE_LABELS, isRouteId, type RouteId } from "../../contracts";
import { FreightChart, MarketChart } from "./DashboardCharts";
import { MARKET_POINTS, PERIOD_END, ROUTE_EVENTS, ROUTE_FORECASTS, ROUTE_SERIES } from "./fixture";
import {
  INITIAL_MARKET_SELECTION,
  FORECAST_HORIZONS,
  selectMarketSeries,
  type ForecastHorizon,
  type MarketSelection,
  type MarketSeries,
} from "./domain";

const MARKET_META = {
  fx: { tab: "환율", label: "USD/KRW", provider: "European Central Bank · EUR 교차환율", unit: "KRW/USD", color: "#15269d", state: "LIVE" },
  oil: { tab: "Brent", label: "Brent 유가", provider: "U.S. Energy Information Administration", unit: "USD/bbl", color: "#3fa1eb", state: "LIVE" },
  bunker: { tab: "VLSFO", label: "글로벌 20항 평균 VLSFO 0.5%", provider: "USDA Open Ag Transport", unit: "USD/MT", color: "#008d83", state: "LIVE" },
  harpex: { tab: "HARPEX", label: "HARPEX Index", provider: "Harper Petersen 공개 참고값", unit: "Index", color: "#7c3aed", state: "REFERENCE" },
} as const;

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString("ko-KR")}`;
}
function formatMarketValue(value: number, series: MarketSeries) {
  if (series === "fx") return value.toLocaleString("ko-KR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (series === "harpex") return Math.round(value).toLocaleString("ko-KR");
  return `$${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function routeFromLocation(): RouteId {
  if (typeof window === "undefined") return DEFAULT_ROUTE_ID;
  const candidate = new URLSearchParams(window.location.search).get("route");
  return isRouteId(candidate) ? candidate : DEFAULT_ROUTE_ID;
}

function useDialogLifecycle(open: boolean, close: () => void, trigger: React.RefObject<HTMLButtonElement | null>) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
      trigger.current?.focus();
    };
  }, [close, open, trigger]);
  return closeButton;
}

function DataBadge({ state }: { readonly state: "LIVE" | "REFERENCE" | "LOADING" | "UNAVAILABLE" | "INPUT" }) {
  return <span className={`data-badge ${state.toLowerCase()}`}><i />{state}</span>;
}

function SectionHeading({ eyebrow, title, description, action }: { readonly eyebrow: string; readonly title: string; readonly description: string; readonly action?: React.ReactNode }) {
  return <header className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action !== undefined && <div className="heading-action">{action}</div>}</header>;
}

function RouteSelector({ routeId, onChange }: { readonly routeId: RouteId; readonly onChange: (route: RouteId) => void }) {
  return <label className="route-selector"><span>조회 항로</span><select onChange={(event) => { if (isRouteId(event.target.value)) onChange(event.target.value); }} value={routeId}>{ROUTE_IDS.map((id) => <option key={id} value={id}>{ROUTE_LABELS[id]} · {id}</option>)}</select></label>;
}

function MarketSelector({ selection, onSelect }: { readonly selection: MarketSelection; readonly onSelect: (slot: "upper" | "lower", series: MarketSeries) => void }) {
  return <div className="market-selector" aria-label="시장 지표 선택">{(["upper", "lower"] as const).map((slot) => <div className="market-selector-row" key={slot}><b>{slot === "upper" ? "상단" : "하단"}</b><div role="tablist" aria-label={`${slot === "upper" ? "상단" : "하단"} 시장 지표`}>{(Object.keys(MARKET_META) as MarketSeries[]).map((series) => <button aria-controls={`market-${slot}`} aria-selected={selection[slot] === series} key={series} onClick={() => onSelect(slot, series)} role="tab">{MARKET_META[series].tab}</button>)}</div></div>)}</div>;
}

function MarketCard({ id, series }: { readonly id: string; readonly series: MarketSeries }) {
  const meta = MARKET_META[series];
  const points = MARKET_POINTS[series];
  const latest = points.at(-1);
  return <section aria-labelledby={`${id}-title`} className="soft-card market-card" id={id} role="tabpanel"><SectionHeading action={<DataBadge state={meta.state} />} description={meta.provider} eyebrow="MARKET SIGNAL" title={meta.label} /><MarketChart color={meta.color} points={points} unit={meta.unit} /><footer className="market-footer"><span>최근 관측 <strong>{latest === undefined ? "—" : formatMarketValue(latest.value, series)} {meta.unit}</strong></span><span>주별 마지막 관측 · {latest?.date ?? "—"}</span></footer></section>;
}

function InsightPanel({ routeId, horizon }: { readonly routeId: RouteId; readonly horizon: ForecastHorizon }) {
  const forecast = ROUTE_FORECASTS[routeId].forecasts[horizon - 1];
  const metric = ROUTE_FORECASTS[routeId].metrics[horizon - 1];
  const current = ROUTE_SERIES[routeId].at(-1)?.value ?? forecast.point;
  const change = ((forecast.point - current) / current) * 100;
  const direction = change >= 3 ? "상승" : change <= -3 ? "하락" : "보합";
  const model = ROUTE_FORECASTS[routeId].model;
  return <section className="soft-card insight-card"><SectionHeading action={<span className="engine-badge">해석 대기</span>} description="정량 예측과 검증 뉴스를 함께 해석" eyebrow="AUTO INSIGHT" title="예측 방향 자동 설명" /><div className={`direction-pill ${direction === "상승" ? "up" : direction === "하락" ? "down" : "flat"}`}><span>{direction === "상승" ? "↗" : direction === "하락" ? "↘" : "→"}</span><strong>{direction} 전망</strong><small>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</small></div><h3>{ROUTE_LABELS[routeId]} 항로는 {horizon}주 후 현재 대비 {direction}권으로 전망됩니다.</h3><p className="insight-summary">현재 {formatMoney(current)}에서 {formatMoney(forecast.point)}로 예상됩니다. 정제된 뉴스를 수집하면 동일한 정량 근거와 기사 ID를 사용해 자동 해석을 생성합니다.</p><div className="model-note"><i /><div><strong>자동 대표 모델 · {model.name}</strong><span>{horizon}주 MAPE {metric.mapePct.toFixed(1)}% · MSE {Math.round(metric.mse).toLocaleString("ko-KR")} · MASE {metric.mase.toFixed(2)} · 종합 {metric.totalScore.toFixed(1)}점</span></div></div><p className="method-notice">뉴스는 예측의 직접 인과 근거가 아니라 방향을 설명하는 보조 신호로만 사용합니다. 뉴스를 수집하면 Gemini 자동 해석을 실행합니다.</p></section>;
}

function NewsPanel({ routeId }: { readonly routeId: RouteId }) {
  const [state, setState] = useState<"IDLE" | "LOADING" | "ERROR">("IDLE");
  const collect = () => {
    setState("LOADING");
    window.setTimeout(() => setState("ERROR"), 800);
  };
  const loading = state === "LOADING";
  return <section className="soft-card news-card"><SectionHeading action={<><DataBadge state={loading ? "LOADING" : state === "ERROR" ? "UNAVAILABLE" : "INPUT"} /><button className="collect-button" disabled={loading} onClick={collect}>{loading && <i className="spinner" />}{loading ? "갱신 중" : "뉴스 수집"}</button></>} description="최근 30일 항로 뉴스를 우선하고, 부족할 때만 90일 범위의 B등급 보조자료로 최대 5건 표시" eyebrow="ROUTE NEWS WATCH" title={`${ROUTE_LABELS[routeId]} 항로 운임 영향 뉴스`} /><div className="external-empty"><span className={loading ? "spinner large" : "news-empty-icon"}>{loading ? "" : "N"}</span><strong>{loading ? "노선 뉴스를 수집하고 정제하는 중입니다." : state === "ERROR" ? "외부 자료를 불러오지 못했습니다." : "아직 이 항로의 뉴스를 수집하지 않았습니다."}</strong><p>{loading ? "항로·운임 관련성 필터와 URL·제목 유사도 중복 제거를 적용합니다." : state === "ERROR" ? "임의 기사 대신 연결 상태를 표시합니다." : "버튼을 누르면 뉴스 수집·필터·중복 제거 후 왼쪽 예측 설명에서 Gemini 해석을 자동 생성합니다."}</p></div><p className="news-disclaimer">선정 뉴스는 왼쪽 Gemini 해석의 보조 근거이며 모델 입력이나 인과 근거가 아닙니다. 모델 기준일 이후 기사는 사후 모니터링용으로만 분리합니다. S는 가격·운항 변경, A는 직접 운영 영향, B는 시장 참고 자료입니다.</p></section>;
}

function HistoryDialog({ routeId, open, onClose, trigger }: { readonly routeId: RouteId; readonly open: boolean; readonly onClose: () => void; readonly trigger: React.RefObject<HTMLButtonElement | null> }) {
  const closeButton = useDialogLifecycle(open, onClose, trigger);
  if (!open || typeof document === "undefined") return null;
  const points = ROUTE_SERIES[routeId];
  const values = points.map((point) => point.value);
  const current = points.at(-1)?.value ?? 0;
  const events = ROUTE_EVENTS.filter((event) => event.routes.some((eventRoute) => eventRoute === routeId));
  return createPortal(<div className="dialog-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section aria-labelledby="history-title" aria-modal="true" className="dialog history-dialog" role="dialog"><header><div><span className="eyebrow">FULL ROUTE HISTORY · {routeId}</span><h2 id="history-title">{ROUTE_LABELS[routeId]} KCCI 전체 이력</h2><p>2022년 11월부터 마지막 실측까지의 운임과 검증된 주요 사건을 함께 봅니다.</p></div><button aria-label="닫기" className="dialog-close" onClick={onClose} ref={closeButton}>×</button></header><div className="history-kpis"><article><span>마지막 실측</span><strong>{formatMoney(current)}</strong><small>{PERIOD_END} · USD/FEU</small></article><article><span>기간 최고</span><strong>{formatMoney(Math.max(...values))}</strong><small>187주 관측</small></article><article><span>기간 최저</span><strong>{formatMoney(Math.min(...values))}</strong><small>zero baseline 미사용</small></article><article><span>주요 사건</span><strong>{events.length}건</strong><small>현재 항로 검증 catalog</small></article></div><div className="history-chart-scroll"><MarketChart color="#15269d" points={points} unit="USD/FEU" /></div><div className="event-list"><h3>이 항로의 주요 사건 {events.length}건</h3>{events.length === 0 ? <p>이 항로에 연결된 검증 사건이 없습니다.</p> : events.map((event) => <article key={event.id}><time>{event.date}</time><div><strong>{event.title}</strong><p>{event.summary}</p><a href={event.url} rel="noreferrer" target="_blank">{event.source} ↗</a></div></article>)}</div><footer>사건 표시는 운임 변동과 시기상 연관된 운영 맥락이며 직접 인과를 뜻하지 않습니다.</footer></section></div>, document.body);
}

function AllRoutesDialog({ open, onClose, trigger }: { readonly open: boolean; readonly onClose: () => void; readonly trigger: React.RefObject<HTMLButtonElement | null> }) {
  const closeButton = useDialogLifecycle(open, onClose, trigger);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="dialog-overlay all-routes-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section aria-labelledby="all-routes-title" aria-modal="true" className="dialog all-routes-dialog" role="dialog"><header><div><span className="eyebrow">ALL ROUTES OBSERVATORY</span><h2 id="all-routes-title">KCCI 13개 항로 운임 추이</h2><p>각 항로는 독립 y축으로 표시하며 관찰용 카드에서 현재 항로를 변경하지 않습니다.</p></div><button aria-label="닫기" className="dialog-close" onClick={onClose} ref={closeButton}>×</button></header><div className="all-routes-grid">{ROUTE_IDS.map((routeId) => { const points = ROUTE_SERIES[routeId]; const latest = points.at(-1)?.value ?? 0; const forecast = ROUTE_FORECASTS[routeId].forecasts[0]; return <article className="route-mini-card" key={routeId}><div><span>{ROUTE_LABELS[routeId]} · {routeId}</span><strong>{formatMoney(latest)}</strong><small>1주 {formatMoney(forecast.point)}</small></div><MarketChart color="#15269d" points={points.slice(-35)} unit="USD/FEU" /></article>; })}</div></section></div>, document.body);
}

export function DashboardApp() {
  const [routeId, setRouteId] = useState<RouteId>(DEFAULT_ROUTE_ID);
  const [horizon, setHorizon] = useState<ForecastHorizon>(1);
  const [market, setMarket] = useState<MarketSelection>(INITIAL_MARKET_SELECTION);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allRoutesOpen, setAllRoutesOpen] = useState(false);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const allRoutesTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => setRouteId(routeFromLocation()), []);
  const changeRoute = (next: RouteId) => {
    setRouteId(next);
    const url = new URL(window.location.href);
    url.searchParams.set("route", next);
    window.history.replaceState(null, "", url);
  };
  const projection = ROUTE_FORECASTS[routeId];
  const selected = projection.forecasts[horizon - 1];
  const metric = projection.metrics[horizon - 1];
  const currentPoint = ROUTE_SERIES[routeId].at(-1);
  const current = currentPoint?.value ?? selected.point;
  const changePct = ((selected.point - current) / current) * 100;
  const direction = changePct >= 3 ? "상승" : changePct <= -3 ? "하락" : "보합";

  return <main className="dashboard-page" aria-label="Dashboard"><div className="dashboard-context"><div><span className="eyebrow">ROUTE MARKET OVERVIEW</span><h1>메인 대시보드</h1><p>운임과 시장 신호를 한 화면에서 확인합니다. <b>기준 {PERIOD_END}</b></p></div><button aria-expanded={allRoutesOpen} aria-haspopup="dialog" className="all-routes-button" onClick={() => setAllRoutesOpen(true)} ref={allRoutesTrigger}><span aria-hidden="true">▥</span><b>전체 노선</b></button></div><div className="dashboard-grid"><section className="soft-card hero-card"><SectionHeading action={<RouteSelector onChange={changeRoute} routeId={routeId} />} description="기본은 2026년 이후 · 휠로 2022년 10월 축부터 전체 기간 탐색" eyebrow="KCCI ROUTE FORECAST" title={`${ROUTE_LABELS[routeId]} 운임 추이·1~4주 전망`} /><button aria-expanded={historyOpen} aria-haspopup="dialog" aria-label={`${ROUTE_LABELS[routeId]} 과거 운임과 주요 사건 보기`} className="history-trigger" onClick={() => setHistoryOpen(true)} ref={historyTrigger}>!</button><div className="chart-legend"><span><i className="actual" />KCCI 실측</span><span><i style={{ background: "#15269d" }} />{projection.model.name}</span><span><i className="range-swatch" />90% 예측구간</span></div><FreightChart actual={ROUTE_SERIES[routeId]} forecasts={projection.forecasts} modelName={projection.model.name} resetKey={routeId} selectedHorizon={horizon} /><div className="forecast-readout"><div className="readout-lead"><div><span className="eyebrow">FORECAST READOUT</span><strong>{ROUTE_LABELS[routeId]} {horizon}주 후 운임은 {formatMoney(selected.point)}로 <em className={direction === "상승" ? "risk" : direction === "하락" ? "relief" : "neutral"}>{direction}</em> 전망입니다.</strong><p>현재 대비 <b>{changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%</b> · PI90 범위는 {formatMoney(selected.lower)}~{formatMoney(selected.upper)} / FEU</p></div><div className="readout-tools"><span>예측 대상 선택</span><div aria-label="예측 horizon" className="horizon-selector" role="radiogroup">{FORECAST_HORIZONS.map((item) => <button aria-checked={horizon === item} key={item} onClick={() => setHorizon(item)} role="radio">{item}주</button>)}</div></div></div><div className="readout-detail"><article><span>현재 운임 → {horizon}주 점예측</span><div className="readout-flow"><dl><dt>마지막 실측</dt><dd>{formatMoney(current)}</dd><small>{currentPoint?.date} · USD/FEU</small></dl><b>›</b><dl><dt>{horizon}주 예측</dt><dd>{formatMoney(selected.point)}</dd><small>{selected.targetDate} · USD/FEU</small></dl></div></article><article><span>PI90 예측구간</span><div className="readout-flow"><dl><dt>하한</dt><dd>{formatMoney(selected.lower)}</dd></dl><i /><dl><dt>상한</dt><dd>{formatMoney(selected.upper)}</dd></dl></div><small>90% 구간 · USD/FEU</small></article><article><span>대표 모델·외부평가</span><div className="validation-grid"><dl><dt>자동 대표 모델</dt><dd>{projection.model.name}</dd><small>1주 성능 기준 자동 선정</small></dl><dl><dt>{horizon}주 PI90 Coverage</dt><dd>{metric.coveragePct.toFixed(1)}%</dd><small>{metric.coverageHits}/{metric.coverageTotal} 적중 · {metric.sampleSize}회</small></dl></div></article></div></div><footer className="chart-footer"><span>▣ KOBC KCCI · 마지막 실측 {currentPoint?.date}</span><span>선택 예측 대상 {selected.targetDate}</span></footer></section><aside className="market-panel"><MarketSelector onSelect={(slot, series) => setMarket((currentSelection) => selectMarketSeries(currentSelection, slot, series))} selection={market} /><div className="market-stack"><MarketCard id="market-upper" series={market.upper} /><MarketCard id="market-lower" series={market.lower} /></div></aside></div><div className="lower-grid"><InsightPanel horizon={horizon} routeId={routeId} /><NewsPanel routeId={routeId} /></div><HistoryDialog onClose={() => setHistoryOpen(false)} open={historyOpen} routeId={routeId} trigger={historyTrigger} /><AllRoutesDialog onClose={() => setAllRoutesOpen(false)} open={allRoutesOpen} trigger={allRoutesTrigger} /></main>;
}

