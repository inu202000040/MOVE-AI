"use client";

import { createPortal } from "react-dom";
import { useEffect, useReducer, useRef, useState } from "react";

import { DEFAULT_ROUTE_ID, ROUTE_IDS, ROUTE_LABELS, isRouteId, type RouteId } from "../../contracts";
import { FreightChart, HistoryChart, MarketChart, RouteMiniChart } from "./DashboardCharts";
import { MARKET_POINTS, PERIOD_END, ROUTE_EVENTS, ROUTE_FORECASTS, ROUTE_SERIES } from "./fixture";
import {
  INITIAL_MARKET_SELECTION,
  INITIAL_INSIGHT_STATE,
  INITIAL_NEWS_STATE,
  FORECAST_HORIZONS,
  collectNews,
  createInsightRequest,
  readInsightCache,
  readNewsCache,
  reduceNewsState,
  reduceInsightState,
  requestInsight,
  requestMarket,
  resolveNewsStorageEvent,
  selectMarketSeries,
  writeNewsCache,
  writeInsightCache,
  type DashboardDataGatewayV1,
  type ForecastHorizon,
  type MarketSelection,
  type MarketSeries,
  type NewsGatewayResultV1,
  type NewsDataV1,
  type RepresentativeSelectionV1,
} from "./domain";

const MARKET_META = {
  fx: { tab: "환율", label: "USD/KRW", provider: "European Central Bank · EUR 교차환율", unit: "KRW/USD", color: "#15269d" },
  oil: { tab: "Brent", label: "Brent 유가", provider: "U.S. Energy Information Administration", unit: "USD/bbl", color: "#3fa1eb" },
  bunker: { tab: "VLSFO", label: "글로벌 20항 평균 VLSFO 0.5%", provider: "USDA Open Ag Transport", unit: "USD/MT", color: "#008d83" },
  harpex: { tab: "HARPEX", label: "HARPEX Index", provider: "Harper Petersen 공개 참고값", unit: "Index", color: "#7c3aed" },
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
      window.requestAnimationFrame(() => trigger.current?.focus());
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

type MarketSurface =
  | { readonly state: "LOADING" | "UNAVAILABLE"; readonly label: string; readonly provider: string; readonly unit: string; readonly points: null; readonly aggregation: null; readonly observationEnd: null }
  | { readonly state: "LIVE" | "REFERENCE"; readonly label: string; readonly provider: string; readonly unit: string; readonly points: readonly { readonly date: string; readonly value: number }[]; readonly aggregation: string; readonly observationEnd: string };

function localMarketSurface(series: MarketSeries): MarketSurface {
  const meta = MARKET_META[series];
  const points = MARKET_POINTS[series];
  return {
    state: "REFERENCE",
    label: meta.label,
    provider: meta.provider,
    unit: meta.unit,
    points,
    aggregation: "주별 마지막 관측",
    observationEnd: points.at(-1)?.date ?? PERIOD_END,
  };
}

function MarketCard({ id, series, gateway }: { readonly id: string; readonly series: MarketSeries; readonly gateway?: DashboardDataGatewayV1 }) {
  const meta = MARKET_META[series];
  const [surface, setSurface] = useState<MarketSurface>(() => gateway === undefined
    ? localMarketSurface(series)
    : { state: "LOADING", label: meta.label, provider: "외부 공개 데이터 연결", unit: meta.unit, points: null, aggregation: null, observationEnd: null });
  useEffect(() => {
    if (gateway === undefined) {
      setSurface(localMarketSurface(series));
      return;
    }
    const controller = new AbortController();
    setSurface({ state: "LOADING", label: meta.label, provider: "외부 공개 데이터 연결", unit: meta.unit, points: null, aggregation: null, observationEnd: null });
    void requestMarket(gateway, series, PERIOD_END, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result === null || result.state === "UNAVAILABLE" || result.data === null) {
        setSurface({
          state: "UNAVAILABLE",
          label: meta.label,
          provider: result?.meta.source ?? "외부 공급원 연결 실패",
          unit: meta.unit,
          points: null,
          aggregation: null,
          observationEnd: null,
        });
        return;
      }
      setSurface({
        state: result.state,
        label: result.data.label,
        provider: `${result.data.provider} · ${result.meta.source}`,
        unit: result.data.unit,
        points: result.data.points,
        aggregation: result.data.aggregation,
        observationEnd: result.data.observationEnd,
      });
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError") && !controller.signal.aborted) {
        setSurface({ state: "UNAVAILABLE", label: meta.label, provider: "외부 공급원 연결 실패", unit: meta.unit, points: null, aggregation: null, observationEnd: null });
      }
    });
    return () => controller.abort();
  }, [gateway, meta.label, meta.unit, series]);
  const latest = surface.points?.at(-1);
  return <section aria-labelledby={`${id}-title`} className="soft-card market-card" id={id} role="tabpanel"><SectionHeading action={<DataBadge state={surface.state} />} description={surface.provider} eyebrow="MARKET SIGNAL" title={surface.label} />{surface.points === null ? <div className="external-empty"><span className={surface.state === "LOADING" ? "spinner large" : "news-empty-icon"}>{surface.state === "LOADING" ? "" : "M"}</span><strong>{surface.state === "LOADING" ? "시장 데이터를 불러오는 중입니다." : "외부 자료를 불러오지 못했습니다."}</strong><p>{surface.state === "LOADING" ? "실제 공급원 응답을 기다리고 있습니다." : "임의 수치 대신 연결 상태를 표시합니다."}</p></div> : surface.points.length === 0 ? <div className="external-empty"><span className="news-empty-icon">M</span><strong>검증된 시장 관측값이 없습니다.</strong><p>연결 실패와 빈 관측 범위를 구분해 표시합니다.</p></div> : <><MarketChart color={meta.color} points={surface.points} unit={surface.unit} /><footer className="market-footer"><span>최근 관측 <strong>{latest === undefined ? "—" : formatMarketValue(latest.value, series)} {surface.unit}</strong></span><span>{surface.aggregation} · {surface.observationEnd}</span></footer></>}</section>;
}

function InsightPanel({ routeId, horizon, gateway, newsResult, representative }: { readonly routeId: RouteId; readonly horizon: ForecastHorizon; readonly gateway?: DashboardDataGatewayV1; readonly newsResult: NewsGatewayResultV1 | null; readonly representative?: RepresentativeSelectionV1 }) {
  const [state, dispatch] = useReducer(reduceInsightState, INITIAL_INSIGHT_STATE);
  const validRepresentative = representative?.route === routeId ? representative : null;
  const fixtureForecast = ROUTE_FORECASTS[routeId].forecasts[horizon - 1];
  const fixtureMetric = ROUTE_FORECASTS[routeId].metrics[horizon - 1];
  const representativeForecast = validRepresentative?.forecasts[horizon - 1];
  const representativeMetric = validRepresentative?.metricsByHorizon[horizon - 1];
  const forecast = representativeForecast === undefined
    ? fixtureForecast
    : { point: representativeForecast.point, targetDate: representativeForecast.targetDate, lower: representativeForecast.lower90, upper: representativeForecast.upper90 };
  const metric = representativeMetric === undefined
    ? fixtureMetric
    : { mapePct: representativeMetric.mapePct, mse: representativeMetric.mse, mase: representativeMetric.mase, totalScore: representativeMetric.totalScore };
  const current = validRepresentative?.currentObservation.value ?? ROUTE_SERIES[routeId].at(-1)?.value ?? forecast.point;
  const change = ((forecast.point - current) / current) * 100;
  const direction = change >= 3 ? "상승" : change <= -3 ? "하락" : "보합";
  const modelName = validRepresentative?.modelName ?? ROUTE_FORECASTS[routeId].model.name;

  useEffect(() => {
    const readyResult = newsResult?.state === "LIVE" && newsResult.data !== null ? newsResult : null;
    const readyNews = readyResult?.data ?? null;
    const canRequest = gateway !== undefined && validRepresentative !== null && readyNews !== null && readyNews.articles.length > 0;
    dispatch({ type: "INPUT_CHANGED", hasNews: canRequest });
    if (!canRequest || readyResult === null || readyNews === null || validRepresentative === null || gateway === undefined) {
      return;
    }
    const identity = {
      routeId,
      currentDate: validRepresentative.currentObservation.date,
      horizon,
      modelId: validRepresentative.modelId,
      newsFetchedAt: readyResult.meta.fetchedAt,
    };
    const cached = readInsightCache(window.localStorage, identity);
    if (cached !== null && cached.result.data !== null) {
      dispatch({ type: "CACHE_HYDRATED", data: cached.result.data });
      return;
    }
    const controller = new AbortController();
    dispatch({ type: "REQUEST_STARTED" });
    const request = createInsightRequest(validRepresentative, horizon, readyNews);
    void requestInsight(gateway, request, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      dispatch({ type: "REQUEST_RESOLVED", data: result?.data ?? null });
      if (result?.state === "LLM" && result.data !== null) {
        writeInsightCache(window.localStorage, identity, result, new Date().toISOString());
      }
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError") && !controller.signal.aborted) {
        dispatch({ type: "REQUEST_RESOLVED", data: null });
      }
    });
    return () => controller.abort();
  }, [gateway, horizon, newsResult, routeId, validRepresentative]);

  const payload = state.retained;
  const badge = state.status === "LOADING"
    ? "분석 중"
    : state.status === "LLM" || state.status === "CACHED"
      ? "Gemini 해설"
      : state.status === "DERIVED"
        ? "규칙형 해설"
        : state.status === "CONNECTING"
          ? "Gemini 연결 중"
          : "해석 대기";
  const factors = payload === null ? [] : [
    ...payload.upwardFactors.map((factor) => ({ ...factor, tone: "up" as const })),
    ...payload.downwardFactors.map((factor) => ({ ...factor, tone: "down" as const })),
  ];
  const articleById = new Map((newsResult?.data?.articles ?? []).map((article) => [article.id, article]));
  const headline = payload?.headline ?? `${ROUTE_LABELS[routeId]} 항로는 ${horizon}주 후 현재 대비 ${direction}권으로 전망됩니다.`;
  const summary = payload?.summary ?? `현재 ${formatMoney(current)}에서 ${formatMoney(forecast.point)}로 예상됩니다. 정제된 뉴스를 수집하면 동일한 정량 근거와 기사 ID를 사용해 자동 해석을 생성합니다.`;
  const baseNotice = payload?.caution ?? "뉴스는 예측의 직접 인과 근거가 아니라 방향을 설명하는 보조 신호로만 사용합니다.";
  const engineNotice = payload?.engine === "RULE_FALLBACK"
    ? "현재는 LLM 연결 없이 동일 입력을 규칙형으로 종합했습니다."
    : payload !== null
      ? `${payload.model ?? "LLM"}이 입력된 정량 데이터와 기사 ID만 사용해 해석했습니다.`
      : state.status === "CONNECTING" || state.status === "LOADING"
        ? "정제된 뉴스가 준비되어 Gemini 자동 해석을 실행하고 있습니다."
        : "뉴스를 수집하면 Gemini 자동 해석을 실행합니다.";
  return <section aria-busy={state.status === "LOADING"} className="soft-card insight-card"><SectionHeading action={<span className="engine-badge">{badge}</span>} description="정량 예측과 검증 뉴스를 함께 해석" eyebrow="AUTO INSIGHT" title="예측 방향 자동 설명" /><div className={`direction-pill ${direction === "상승" ? "up" : direction === "하락" ? "down" : "flat"}`}><span>{direction === "상승" ? "↗" : direction === "하락" ? "↘" : "→"}</span><strong>{direction} 전망</strong><small>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</small></div><h3>{headline}</h3><p className="insight-summary">{summary}</p>{payload !== null && <div className="evidence-grid"><article><h4>정량 근거</h4><ul>{payload.quantitativeBasis.map((basis) => <li key={basis}>{basis}</li>)}</ul></article><article><h4>뉴스 신호</h4>{factors.length === 0 ? <p>직접 연결할 검증 뉴스가 없습니다.</p> : <ul>{factors.map((factor) => { const article = articleById.get(factor.evidenceId); return <li key={`${factor.tone}-${factor.evidenceId}`}><b>{factor.tone === "up" ? "상방" : "하방"}</b> {factor.factor}{article !== undefined && <a href={article.url} rel="noreferrer" target="_blank">근거 ↗</a>}</li>; })}</ul>}</article></div>}<div className="model-note"><i /><div><strong>{validRepresentative?.selectionMode === "manual" ? "사용자 선택 대표 모델" : "자동 대표 모델"} · {modelName}</strong><span>{horizon}주 MAPE {metric.mapePct.toFixed(1)}% · MSE {Math.round(metric.mse).toLocaleString("ko-KR")} · MASE {metric.mase.toFixed(2)} · 종합 {metric.totalScore.toFixed(1)}점</span></div></div><p className="method-notice">{baseNotice} {engineNotice}{validRepresentative?.selectionMode === "manual" ? ` 자동 선정 1위는 ${validRepresentative.automaticChampion.modelName}입니다.` : ""}</p></section>;
}

function NewsArticles({ data }: { readonly data: NewsDataV1 }) {
  return <><div className="news-stats"><span>수집 후보<b>{data.stats.fetchedCandidates}</b></span><span>필터 통과<b>{data.stats.filteredCandidates}</b></span><span>중복 제거<b>{data.stats.duplicatesRemoved}</b></span><span>최종 선정<b>{data.stats.selectedArticles}</b></span></div><div className="news-list">{data.articles.map((article, index) => <a className="news-row" href={article.url} key={article.id} rel="noreferrer" target="_blank"><span className="news-index">{String(index + 1).padStart(2, "0")}</span><div><div className="news-badges"><span className={`grade-${article.grade.toLowerCase()}`}>{article.grade} · {article.gradeLabel}</span><span className={`direction-${article.directionCode.toLowerCase()}`}>{article.direction}</span><span className="verified">검증 완료</span>{article.isBoundary && <span className="boundary">기간 직전 공지</span>}</div><strong>{article.title}</strong><p>{article.summary}</p><small>{article.impactSignals.join(" · ")} · {article.source} · {article.publishedAt.slice(0, 10)}{article.effectiveAt === null ? "" : ` · 적용 ${article.effectiveAt.slice(0, 10)}`}</small><em>선정 근거 · {article.reason}</em></div><b aria-hidden="true">›</b></a>)}</div></>;
}

function NewsPanel({ routeId, gateway, onResult }: { readonly routeId: RouteId; readonly gateway?: DashboardDataGatewayV1; readonly onResult: (result: NewsGatewayResultV1 | null) => void }) {
  const [state, dispatch] = useReducer(reduceNewsState, INITIAL_NEWS_STATE);
  const [meta, setMeta] = useState<{ readonly source: string; readonly fetchedAt: string } | null>(null);
  const requestRevision = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestRevision.current += 1;
    abortRef.current?.abort();
    dispatch({ type: "ROUTE_CHANGED" });
    setMeta(null);
    onResult(null);
    const cached = readNewsCache(window.localStorage, routeId);
    if (cached !== null && cached.result.data !== null) {
      dispatch({ type: "CACHE_HYDRATED", data: cached.result.data });
      setMeta({ source: cached.result.meta.source, fetchedAt: cached.result.meta.fetchedAt });
      onResult(cached.result);
    }
    const onStorage = (event: StorageEvent) => {
      const resolution = resolveNewsStorageEvent(window.localStorage, routeId, event);
      if (resolution.kind === "HYDRATED" && resolution.payload.result.data !== null) {
        dispatch({ type: "CACHE_HYDRATED", data: resolution.payload.result.data });
        setMeta({
          source: resolution.payload.result.meta.source,
          fetchedAt: resolution.payload.result.meta.fetchedAt,
        });
        onResult(resolution.payload.result);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      requestRevision.current += 1;
      abortRef.current?.abort();
      window.removeEventListener("storage", onStorage);
    };
  }, [onResult, routeId]);

  const loading = state.status === "LOADING" || state.status === "LOADING_CACHED";
  const collect = async () => {
    if (gateway === undefined || loading) {
      return;
    }
    const revision = requestRevision.current + 1;
    requestRevision.current = revision;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "COLLECT_STARTED" });
    try {
      const resolution = await collectNews(gateway, routeId, new Date().toISOString(), controller.signal);
      if (controller.signal.aborted || requestRevision.current !== revision) {
        return;
      }
      if (resolution?.kind === "READY" && resolution.result.data !== null) {
        dispatch({ type: "REQUEST_RESOLVED", resolution: { kind: "READY", data: resolution.result.data } });
        setMeta({ source: resolution.result.meta.source, fetchedAt: resolution.result.meta.fetchedAt });
        onResult(resolution.result);
        writeNewsCache(window.localStorage, routeId, resolution.result, new Date().toISOString());
        return;
      }
      dispatch({
        type: "REQUEST_RESOLVED",
        resolution: { kind: resolution?.kind === "VERIFIED_EMPTY" ? "VERIFIED_EMPTY" : "ERROR", data: null },
      });
      if (state.retained === null) {
        onResult(null);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && requestRevision.current === revision) {
        dispatch({ type: "REQUEST_RESOLVED", resolution: { kind: "ERROR", data: null } });
        if (state.retained === null) {
          onResult(null);
        }
      }
    }
  };

  const retained = state.retained;
  const failed = state.status === "ERROR" || state.status === "ERROR_CACHED";
  const verifiedEmpty = state.status === "READY_EMPTY";
  const buttonLabel = loading ? "갱신 중" : retained === null ? "뉴스 수집" : "뉴스 갱신";
  const badgeState = loading ? "LOADING" : failed ? "UNAVAILABLE" : retained === null ? "INPUT" : "LIVE";
  return <section className="soft-card news-card"><SectionHeading action={<><DataBadge state={badgeState} /><button className="collect-button" disabled={loading || gateway === undefined} onClick={() => { void collect(); }}>{loading && <i className="spinner" />}{buttonLabel}</button></>} description="최근 30일 항로 뉴스를 우선하고, 부족할 때만 90일 범위의 B등급 보조자료로 최대 5건 표시" eyebrow="ROUTE NEWS WATCH" title={`${ROUTE_LABELS[routeId]} 항로 운임 영향 뉴스`} />{retained === null ? <div className="external-empty"><span className={loading ? "spinner large" : "news-empty-icon"}>{loading ? "" : "N"}</span><strong>{loading ? "노선 뉴스를 수집하고 정제하는 중입니다." : verifiedEmpty ? "검증 가능한 운임 영향 기사가 없습니다." : failed ? "외부 자료를 불러오지 못했습니다." : "아직 이 항로의 뉴스를 수집하지 않았습니다."}</strong><p>{loading ? "항로·운임 관련성 필터와 URL·제목 유사도 중복 제거를 적용합니다." : verifiedEmpty ? "단순 항만 홍보나 다른 선종 기사로 5개를 채우지 않습니다." : failed ? "임의 기사 대신 연결 상태를 표시합니다." : "버튼을 누르면 뉴스 수집·필터·중복 제거 후 왼쪽 예측 설명에서 Gemini 해석을 자동 생성합니다."}</p></div> : <><div className="news-persistence"><span>{state.status === "ERROR_CACHED" ? "갱신 실패 · 이전 데이터" : state.status === "LOADING_CACHED" ? "이전 결과 유지" : meta?.source ?? "검증 뉴스"}</span><strong>{meta?.fetchedAt ?? "—"}</strong></div><NewsArticles data={retained} /></>}<p className="news-disclaimer">선정 뉴스는 왼쪽 Gemini 해석의 보조 근거이며 모델 입력이나 인과 근거가 아닙니다. 모델 기준일 이후 기사는 사후 모니터링용으로만 분리합니다. S는 가격·운항 변경, A는 직접 운영 영향, B는 시장 참고 자료입니다.</p></section>;
}

function HistoryDialog({ routeId, open, onClose, trigger }: { readonly routeId: RouteId; readonly open: boolean; readonly onClose: () => void; readonly trigger: React.RefObject<HTMLButtonElement | null> }) {
  const closeButton = useDialogLifecycle(open, onClose, trigger);
  const routeEvents = ROUTE_EVENTS.filter((item) => item.routes.some((eventRoute) => eventRoute === routeId));
  const [eventsVisible, setEventsVisible] = useState(true);
  const [activeEventId, setActiveEventId] = useState<string | null>(() => routeEvents[0]?.id ?? null);
  useEffect(() => {
    setEventsVisible(true);
    setActiveEventId(routeEvents[0]?.id ?? null);
  }, [routeId]);
  if (!open || typeof document === "undefined") return null;
  const points = ROUTE_SERIES[routeId];
  const latest = points.at(-1);
  const recentValues = points.slice(-52).map((point) => point.value);
  const firstValue = points[0]?.value ?? 0;
  const latestValue = latest?.value ?? 0;
  const fullChange = firstValue === 0 ? 0 : ((latestValue - firstValue) / firstValue) * 100;
  const activeEvent = routeEvents.find((item) => item.id === activeEventId) ?? null;
  return createPortal(<div className="dialog-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section aria-labelledby="history-title" aria-modal="true" className="dialog history-dialog" role="dialog"><header><div><span className="eyebrow">FULL ROUTE HISTORY · {routeId}</span><h2 id="history-title">{ROUTE_LABELS[routeId]} 과거 운임 추이·주요 사건</h2><p>{points[0]?.date}~{latest?.date} · 주간 {points.length}개 관측값 · USD/FEU</p></div><button aria-label="과거 운임 창 닫기" className="dialog-close" onClick={onClose} ref={closeButton}>×</button></header><div className="history-dialog-body"><div className="history-kpis"><article><span>마지막 운임</span><strong>{formatMoney(latestValue)}</strong><small>{latest?.date} · USD/FEU</small></article><article><span>최근 52주 최고</span><strong>{formatMoney(Math.max(...recentValues))}</strong><small>최근 52개 관측</small></article><article><span>최근 52주 최저</span><strong>{formatMoney(Math.min(...recentValues))}</strong><small>최근 52개 관측</small></article><article><span>전체기간 변화</span><strong className={fullChange >= 0 ? "history-up" : "history-down"}>{fullChange >= 0 ? "+" : ""}{fullChange.toFixed(1)}%</strong><small>{points[0]?.date} 대비</small></article></div><section className="history-chart-panel"><header><div><span className="eyebrow">KCCI WEEKLY FREIGHT RATE</span><h3>주간 운임과 사건 발생 시점</h3></div><button aria-pressed={eventsVisible} className="event-toggle" onClick={() => setEventsVisible((visible) => !visible)}>주요 사건 {eventsVisible ? "ON" : "OFF"}</button></header><div className="history-legend"><span><i className="rate" />KCCI 운임</span><span><i className="event" />주요 사건</span><small>운임선 위를 움직이면 주간 값을 확인할 수 있습니다.</small></div><div className="history-chart-scroll"><HistoryChart activeEventId={activeEventId} events={routeEvents} eventsVisible={eventsVisible} onSelectEvent={setActiveEventId} points={points} /></div></section><section className="history-event-section"><div className="event-timeline"><span className="eyebrow">EVENT TIMELINE</span><h3>이 항로의 주요 사건 {routeEvents.length}건</h3>{routeEvents.length === 0 ? <div className="event-empty"><strong>검증해 표시할 사건이 없습니다.</strong><p>근거가 불명확한 사건을 임의로 추가하지 않습니다.</p></div> : routeEvents.map((item) => <button aria-pressed={item.id === activeEventId} className={item.id === activeEventId ? "event-card active" : "event-card"} key={item.id} onClick={() => setActiveEventId(item.id)}><time>{item.date}</time><span><strong>{item.short}</strong><small>{item.source}</small></span><b aria-hidden="true">›</b></button>)}</div><aside className="event-detail">{activeEvent === null ? <div className="event-empty"><strong>선택된 사건이 없습니다.</strong></div> : <><span>{activeEvent.date} · {activeEvent.source}</span><h3>{activeEvent.title}</h3><p>{activeEvent.summary}</p><a href={activeEvent.url} rel="noreferrer" target="_blank">원문 출처 보기 ↗</a></>}</aside></section></div><footer>주황색 표시는 사건과 운임 변동 시점이 겹친다는 뜻이며, 해당 사건이 운임 변화를 단독으로 일으켰다는 인과관계를 의미하지 않습니다.</footer></section></div>, document.body);
}

function AllRoutesDialog({ open, onClose, trigger }: { readonly open: boolean; readonly onClose: () => void; readonly trigger: React.RefObject<HTMLButtonElement | null> }) {
  const closeButton = useDialogLifecycle(open, onClose, trigger);
  const [eventsVisible, setEventsVisible] = useState(true);
  useEffect(() => {
    if (open) {
      setEventsVisible(true);
    }
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  const firstDate = ROUTE_SERIES[ROUTE_IDS[0]][0]?.date;
  const latestDate = ROUTE_SERIES[ROUTE_IDS[0]].at(-1)?.date;
  return createPortal(<div className="dialog-overlay all-routes-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section aria-labelledby="all-routes-title" aria-modal="true" className="dialog all-routes-dialog" role="dialog"><header><div><span className="eyebrow">ALL KCCI ROUTES · 13</span><h2 id="all-routes-title">KCCI 13개 항로 운임 추이</h2><p>{firstDate}~{latestDate} · 주간 187개 관측값 · 각 그래프 독립 Y축 · USD/FEU</p></div><div className="all-routes-controls"><button aria-pressed={eventsVisible} className="event-toggle" onClick={() => setEventsVisible((visible) => !visible)}>주요 사건 {eventsVisible ? "ON" : "OFF"}</button><button aria-label="전체 노선 창 닫기" className="dialog-close" onClick={onClose} ref={closeButton}>×</button></div></header><div className="all-routes-body"><p className="all-routes-notice">주황색 표시는 공신력 있는 자료와 운임 변동 시점이 겹치는 주요 사건입니다. 단독 인과관계를 뜻하지 않습니다.</p><div className="all-routes-grid">{ROUTE_IDS.map((itemRouteId) => { const points = ROUTE_SERIES[itemRouteId]; const latest = points.at(-1)?.value ?? 0; const first = points[0]?.value ?? latest; const change = first === 0 ? 0 : ((latest - first) / first) * 100; const events = ROUTE_EVENTS.filter((item) => item.routes.some((eventRoute) => eventRoute === itemRouteId)); return <article className="route-mini-card" key={itemRouteId}><div><span>{ROUTE_LABELS[itemRouteId]} · {itemRouteId}</span><strong>{formatMoney(latest)}</strong><small>{latestDate} · <b className={change >= 0 ? "mini-up" : "mini-down"}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</b></small></div><RouteMiniChart events={events} eventsVisible={eventsVisible} points={points} routeId={itemRouteId} /></article>; })}</div><details className="all-routes-sources"><summary>표시된 주요 사건 {ROUTE_EVENTS.length}건의 근거·출처 보기</summary><div>{ROUTE_EVENTS.map((item) => <article key={item.id}><time>{item.date}</time><span><strong>{item.title}</strong><small>{item.routes.map((itemRouteId) => ROUTE_LABELS[itemRouteId]).join(" · ")}</small></span><a href={item.url} rel="noreferrer" target="_blank">{item.source} 원문 ↗</a></article>)}</div></details></div></section></div>, document.body);
}

export function DashboardApp({ gateway, representative }: { readonly gateway?: DashboardDataGatewayV1; readonly representative?: RepresentativeSelectionV1 }) {
  const [routeId, setRouteId] = useState<RouteId>(DEFAULT_ROUTE_ID);
  const [horizon, setHorizon] = useState<ForecastHorizon>(1);
  const [market, setMarket] = useState<MarketSelection>(INITIAL_MARKET_SELECTION);
  const [newsResult, setNewsResult] = useState<NewsGatewayResultV1 | null>(null);
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

  return <main className="dashboard-page" aria-label="Dashboard"><div className="dashboard-context"><div><span className="eyebrow">ROUTE MARKET OVERVIEW</span><h1>메인 대시보드</h1><p>운임과 시장 신호를 한 화면에서 확인합니다. <b>기준 {PERIOD_END}</b></p></div><button aria-expanded={allRoutesOpen} aria-haspopup="dialog" className="all-routes-button" onClick={() => setAllRoutesOpen(true)} ref={allRoutesTrigger}><span aria-hidden="true">▥</span><b>전체 노선</b></button></div><div className="dashboard-grid"><section className="soft-card hero-card"><SectionHeading action={<RouteSelector onChange={changeRoute} routeId={routeId} />} description="기본은 2026년 이후 · 휠로 2022년 10월 축부터 전체 기간 탐색" eyebrow="KCCI ROUTE FORECAST" title={`${ROUTE_LABELS[routeId]} 운임 추이·1~4주 전망`} /><button aria-expanded={historyOpen} aria-haspopup="dialog" aria-label={`${ROUTE_LABELS[routeId]} 과거 운임과 주요 사건 보기`} className="history-trigger" onClick={() => setHistoryOpen(true)} ref={historyTrigger}>!</button><div className="chart-legend"><span><i className="actual" />KCCI 실측</span><span><i style={{ background: "#15269d" }} />{projection.model.name}</span><span><i className="range-swatch" />90% 예측구간</span></div><FreightChart actual={ROUTE_SERIES[routeId]} forecasts={projection.forecasts} modelName={projection.model.name} resetKey={routeId} selectedHorizon={horizon} /><div className="forecast-readout"><div className="readout-lead"><div><span className="eyebrow">FORECAST READOUT</span><strong>{ROUTE_LABELS[routeId]} {horizon}주 후 운임은 {formatMoney(selected.point)}로 <em className={direction === "상승" ? "risk" : direction === "하락" ? "relief" : "neutral"}>{direction}</em> 전망입니다.</strong><p>현재 대비 <b>{changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%</b> · PI90 범위는 {formatMoney(selected.lower)}~{formatMoney(selected.upper)} / FEU</p></div><div className="readout-tools"><span>예측 대상 선택</span><div aria-label="예측 horizon" className="horizon-selector" role="radiogroup">{FORECAST_HORIZONS.map((item) => <button aria-checked={horizon === item} key={item} onClick={() => setHorizon(item)} role="radio">{item}주</button>)}</div></div></div><div className="readout-detail"><article><span>현재 운임 → {horizon}주 점예측</span><div className="readout-flow"><dl><dt>마지막 실측</dt><dd>{formatMoney(current)}</dd><small>{currentPoint?.date} · USD/FEU</small></dl><b>›</b><dl><dt>{horizon}주 예측</dt><dd>{formatMoney(selected.point)}</dd><small>{selected.targetDate} · USD/FEU</small></dl></div></article><article><span>PI90 예측구간</span><div className="readout-flow"><dl><dt>하한</dt><dd>{formatMoney(selected.lower)}</dd></dl><i /><dl><dt>상한</dt><dd>{formatMoney(selected.upper)}</dd></dl></div><small>90% 구간 · USD/FEU</small></article><article><span>대표 모델·외부평가</span><div className="validation-grid"><dl><dt>자동 대표 모델</dt><dd>{projection.model.name}</dd><small>1주 성능 기준 자동 선정</small></dl><dl><dt>{horizon}주 PI90 Coverage</dt><dd>{metric.coveragePct.toFixed(1)}%</dd><small>{metric.coverageHits}/{metric.coverageTotal} 적중 · {metric.sampleSize}회</small></dl></div></article></div></div><footer className="chart-footer"><span>▣ KOBC KCCI · 마지막 실측 {currentPoint?.date}</span><span>선택 예측 대상 {selected.targetDate}</span></footer></section><aside className="market-panel"><MarketSelector onSelect={(slot, series) => setMarket((currentSelection) => selectMarketSeries(currentSelection, slot, series))} selection={market} /><div className="market-stack"><MarketCard gateway={gateway} id="market-upper" key={`market-upper-${market.upper}`} series={market.upper} /><MarketCard gateway={gateway} id="market-lower" key={`market-lower-${market.lower}`} series={market.lower} /></div></aside></div><div className="lower-grid"><InsightPanel gateway={gateway} horizon={horizon} newsResult={newsResult} representative={representative} routeId={routeId} /><NewsPanel gateway={gateway} onResult={setNewsResult} routeId={routeId} /></div><HistoryDialog onClose={() => setHistoryOpen(false)} open={historyOpen} routeId={routeId} trigger={historyTrigger} /><AllRoutesDialog onClose={() => setAllRoutesOpen(false)} open={allRoutesOpen} trigger={allRoutesTrigger} /></main>;
}

