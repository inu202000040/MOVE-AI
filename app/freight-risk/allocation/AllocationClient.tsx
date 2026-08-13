"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ROUTE_IDS, type RouteId } from "../../contracts";
import { ComparisonChart, compactMoney, displayDate, money, SpectrumChart } from "./charts";
import { DetailDialog } from "./DetailDialog";
import type { CvarProgress, CvarSimulationResult, RiskWeight } from "./engine";
import {
  adaptRepresentativeSelection,
  createAllocationRunInput,
  type AllocationDraftInput,
  type AllocationRepresentativeInput,
  type AllocationRunInput,
  type RepresentativeSelectionV1,
} from "./representative";
import { CvarRunCoordinator } from "./runtime";
import { calculateSpotExceedProbability, publishAllocationRoute, riskBarWidth } from "./view-model";
import styles from "./allocation.module.css";

const ROUTE_NAMES: Readonly<Record<RouteId, string>> = {
  KUWI: "북미서안", KUEI: "북미동안", KNEI: "유럽", KMDI: "지중해",
  KMEI: "중동", KAUI: "호주", KLEI: "남미동안", KLWI: "남미서안",
  KSAI: "남아프리카", KWAI: "서아프리카", KCI: "중국", KJI: "일본", KSEI: "동남아",
};

const RISK_PROFILES: Readonly<Record<RiskWeight, { name: string; option: string; description: string }>> = {
  0.5: { name: "평균비용 우선", option: "평균비용 우선", description: "평소 예상 조달비용이 낮은 배분을 우선합니다." },
  1: { name: "비용·위험 균형", option: "비용·위험 균형 · 권장", description: "평균비용과 Spot 급등·하락 위험을 함께 고려합니다." },
  2: { name: "위험 방어 우선", option: "위험 방어 우선", description: "평균비용이 조금 늘더라도 극단적인 손실을 줄이는 배분을 우선합니다." },
};

const ERROR_COPY = "시뮬레이션 계산 중 오류가 발생했습니다. 다시 실행해 주세요.";

function HelpBubble({ label, children }: { readonly label: string; readonly children: string }) {
  return <button aria-label={`${label} 설명`} className={styles.helpButton} type="button">?<span className={styles.helpTooltip} role="tooltip">{children}</span></button>;
}

function SectionHeading({ eyebrow, title, description, action }: { readonly eyebrow: string; readonly title: string; readonly description: string; readonly action?: React.ReactNode }) {
  return <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

function InputDrawer({
  draft,
  onChange,
  onClose,
  onRouteChange,
  onRun,
  open,
  representative,
  running,
}: {
  readonly draft: AllocationDraftInput;
  readonly onChange: (draft: AllocationDraftInput) => void;
  readonly onClose: () => void;
  readonly onRouteChange?: (route: RouteId) => void;
  readonly onRun: () => void;
  readonly open: boolean;
  readonly representative: AllocationRepresentativeInput;
  readonly running: boolean;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <aside aria-label="배분 분석 데이터 입력" aria-modal="true" className={styles.drawer} onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header className={styles.drawerHeader}><div><span className={styles.eyebrow}>DECISION INPUT</span><h2>배분 분석 데이터 입력</h2><p>고정 물동량과 고정운임, 판단 시점 및 추천 성향을 입력합니다.</p></div><button aria-label="데이터 입력 닫기" className={styles.iconButton} onClick={onClose} type="button">×</button></header>
        <div className={styles.drawerBody}>
          <label className={styles.field}><span>항로</span><select onChange={(event) => publishAllocationRoute(event.target.value, onRouteChange)} value={representative.route}>{ROUTE_IDS.map((route) => <option key={route} value={route}>{ROUTE_NAMES[route]} · {route}</option>)}</select></label>
          <label className={styles.field}><span>판단 시점</span><select onChange={(event) => { const selectedHorizon = Number(event.target.value) as 1 | 2 | 3 | 4; onChange({ ...draft, selectedHorizon, fixed: Math.max(1, Math.round(representative.forecasts[selectedHorizon - 1].point * 1.035)) }); }} value={draft.selectedHorizon}>{[1, 2, 3, 4].map((week) => <option key={week} value={week}>{week}주</option>)}</select></label>
          <label className={styles.field}><span>고정 물동량</span><div className={styles.unitInput}><input min="1" onChange={(event) => onChange({ ...draft, volume: Math.max(1, Number(event.target.value)) })} step="10" type="number" value={draft.volume} /><b>FEU</b></div></label>
          <label className={styles.field}><span>고정계약 운임</span><div className={styles.unitInput}><input min="1" onChange={(event) => onChange({ ...draft, fixed: Math.max(1, Number(event.target.value)) })} step="1" type="number" value={draft.fixed} /><b>USD/FEU</b></div></label>
          <label className={styles.field}><span>추천 성향</span><select onChange={(event) => onChange({ ...draft, riskWeight: Number(event.target.value) as RiskWeight })} value={draft.riskWeight}>{([0.5, 1, 2] as const).map((weight) => <option key={weight} value={weight}>{RISK_PROFILES[weight].option}</option>)}</select><small>{RISK_PROFILES[draft.riskWeight].description}</small></label>
          <section className={styles.forecastSection}><h3>대표모델 1~4주 예측</h3><div className={styles.forecastGrid}>{representative.forecasts.map((forecast) => <button className={draft.selectedHorizon === forecast.horizonWeeks ? styles.selectedForecast : undefined} key={forecast.horizonWeeks} onClick={() => onChange({ ...draft, selectedHorizon: forecast.horizonWeeks, fixed: Math.max(1, Math.round(forecast.point * 1.035)) })} type="button"><span>{forecast.horizonWeeks}주</span><strong>{money(forecast.point)}</strong><small>PI90 {money(forecast.lower90)}–{money(forecast.upper90)}</small></button>)}</div></section>
          <p className={styles.proxyNote}>선택 항로 대표모델의 1·2·3·4주 점예측과 PI90을 시뮬레이션 중심과 변동 폭으로 사용합니다. KCCI는 개별 선사의 실제 Spot 견적이 아닌 시장운임 대용변수입니다.</p>
        </div>
        <footer className={styles.drawerFooter}><button className={styles.secondaryButton} onClick={onClose} type="button">취소</button><button className={styles.primaryButton} disabled={running} onClick={onRun} type="button">{running ? "분석 실행 중…" : "100,000개 분석 실행"}</button></footer>
      </aside>
    </div>,
    document.body,
  );
}

export function AllocationClient({
  onRouteChange,
  selection,
}: {
  readonly onRouteChange?: (route: RouteId) => void;
  readonly selection: RepresentativeSelectionV1;
}) {
  const representative = useMemo(() => adaptRepresentativeSelection(selection), [selection]);
  const [draft, setDraft] = useState<AllocationDraftInput>(() => ({ selectedHorizon: 1, volume: 1_000, fixed: Math.round(representative.forecasts[0].point * 1.035), riskWeight: 1 }));
  const [result, setResult] = useState<CvarSimulationResult | null>(null);
  const [lastInput, setLastInput] = useState<AllocationRunInput | null>(null);
  const [progress, setProgress] = useState<CvarProgress>({ stage: "paths", percent: 0 });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const coordinator = useRef<CvarRunCoordinator | null>(null);
  if (coordinator.current === null) coordinator.current = new CvarRunCoordinator();

  const runDraft = useCallback((nextDraft: AllocationDraftInput, closeDrawer: boolean) => {
    let nextInput: AllocationRunInput;
    try {
      nextInput = createAllocationRunInput(selection, nextDraft);
    } catch {
      setResult(null); setRunning(false); setError(ERROR_COPY); return;
    }
    setLastInput(nextInput); setProgress({ stage: "paths", percent: 2 }); setRunning(true); setError(null); setResult(null); setDetailOpen(false);
    if (closeDrawer) setDrawerOpen(false);
    coordinator.current?.run(nextInput.simulation, {
      onProgress: setProgress,
      onDone: (nextResult) => { setProgress({ stage: "candidates", percent: 100 }); setRunning(false); setResult(nextResult); },
      onError: () => { setRunning(false); setResult(null); setError(ERROR_COPY); },
    });
  }, [selection]);

  useEffect(() => {
    const nextDraft = { ...draft, fixed: Math.max(1, Math.round(representative.forecasts[draft.selectedHorizon - 1].point * 1.035)) };
    setDraft(nextDraft);
    const timer = window.setTimeout(() => runDraft(nextDraft, false), 0);
    return () => { window.clearTimeout(timer); coordinator.current?.dispose(); };
    // Only allocation-effective representative changes trigger this automatic run.
  }, [representative.routeSimulationKey]);

  useEffect(() => {
    if (!drawerOpen && !detailOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { if (detailOpen) setDetailOpen(false); else setDrawerOpen(false); } };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [detailOpen, drawerOpen]);

  const displayInput = lastInput?.simulation ?? createAllocationRunInput(selection, draft).simulation;
  const share = result?.best.share ?? 0;
  const spotShare = result?.best.spotShare ?? 0;
  const exceedProbability = result && lastInput ? 100 * calculateSpotExceedProbability(result.spots, lastInput.simulation.fixed) : null;
  const status = error ? "계산 오류" : running ? "계산 중" : result ? "계산 완료" : "준비 중";
  const profile = RISK_PROFILES[(lastInput?.simulation.riskWeight ?? draft.riskWeight)];
  const routeName = ROUTE_NAMES[representative.route];

  return (
    <main aria-label="Allocation" className={styles.page}>
      <section className={styles.inputSummary}>
        <div className={styles.summaryTitle}><span className={styles.eyebrow}>ANALYSIS INPUT</span><strong>{routeName} · {representative.route}</strong></div>
        <div className={styles.summaryItem}><span>대표모델</span><strong>{representative.selection.modelName}</strong><small>1주 종합점수 {representative.selection.score1w.toFixed(1)}점 · Coverage {representative.selection.coverage1w.toFixed(1)}%</small></div>
        <div className={styles.summaryItem}><span>판단 시점</span><strong>{displayInput.selectedHorizon}주</strong></div>
        <div className={styles.summaryItem}><span>물동량</span><strong>{displayInput.volume.toLocaleString("en-US")} FEU</strong></div>
        <div className={styles.summaryItem}><span>고정운임</span><strong>{money(displayInput.fixed)}</strong><small>USD/FEU</small></div>
        {running ? <div className={styles.progress}><span>{progress.percent < 30 ? "운임경로 생성 중" : "배분비율 평가 중"}</span><strong>{progress.percent}%</strong><i><b style={{ width: `${progress.percent}%` }} /></i></div> : null}
        <button className={styles.primaryButton} onClick={() => { setDetailOpen(false); setDrawerOpen(true); }} type="button">데이터 입력</button>
      </section>

      <div className={styles.decisionGrid}>
        <section className={`${styles.card} ${styles.mixCard}`}>
          <SectionHeading eyebrow="RECOMMENDED MIX" title="고정운임·Spot 권고 비중" description="예상 비용과 불리한 상황의 후회비용을 함께 고려합니다." action={<span className={`${styles.badge} ${error ? styles.errorBadge : ""}`}>{status}</span>} />
          <div className={styles.ratioGrid}>
            <div className={styles.donut} style={{ background: `conic-gradient(#001290 0 ${share}%, #3fa1eb ${share}% 100%)` }}><div><strong>{share}%</strong><span>고정운임</span></div></div>
            <div className={styles.ratioRows}><div><span>고정운임</span><strong>{share}%</strong></div><div><span>Spot 대응</span><strong>{spotShare}%</strong></div><div><span>분석 경로</span><strong>100,000개</strong></div></div>
          </div>
          <div className={styles.kpiGrid}>
            {[
              ["예상 비용", result ? compactMoney(result.best.expected) : "—", "100,000개 전체 평균", "100,000개 운임경로의 평균 조달비용입니다."],
              ["Spot 고정운임 초과확률", exceedProbability === null ? "—" : `${exceedProbability.toFixed(1)}%`, "100,000개 경로 기준", "선택 시점의 Spot 운임이 입력 고정운임보다 높은 경로 비율입니다."],
              ["후회비용", result ? compactMoney(result.best.cvar) : "—", "최악 10,000개 평균", "불리한 10% 경로의 평균 경제손실인 CVaR90입니다."],
              ["최종 총비용", result ? compactMoney(result.best.objective) : "—", profile.name, "예상 비용에 위험 반영 강도만큼 후회비용을 더한 비교점수입니다."],
            ].map(([label, value, helper, help]) => <article key={label}><span>{label}<HelpBubble label={label}>{help}</HelpBubble></span><strong>{value}</strong><small>{helper}</small></article>)}
          </div>
          <p className={`${styles.reason} ${error ? styles.errorText : ""}`}>{error ?? (running ? "100,000개 운임경로와 101개 배분안을 계산하고 있습니다." : result ? `${profile.name} 기준에서 예상 비용 ${compactMoney(result.best.expected)}과 후회비용 ${compactMoney(result.best.cvar)}을 함께 반영한 최종 총비용 ${compactMoney(result.best.objective)}이 101개 배분안 중 가장 낮습니다.` : "100,000개 분석 결과를 준비하고 있습니다.")}</p>
          <button className={styles.detailButton} disabled={!result || running} onClick={() => { setDrawerOpen(false); setDetailOpen(true); }} type="button">시뮬레이션 상세 결과 보기 <span aria-hidden="true">→</span></button>
        </section>

        <section className={`${styles.card} ${styles.comparisonCard}`}>
          <SectionHeading eyebrow="CONTRACT VS SPOT" title="고정운임 vs Spot 전망" description={`${displayInput.selectedHorizon}주 운임 전망 · PI90과 입력 고정운임을 비교합니다.`} action={<span className={styles.badge}>{representative.selection.modelName}</span>} />
          <ComparisonChart input={displayInput} representative={representative} />
          <div className={styles.comparisonFooter}><div><span>Spot 운임 전망 범위</span><strong>{money(displayInput.forecasts[displayInput.selectedHorizon - 1].lower90)} → {money(displayInput.forecasts[displayInput.selectedHorizon - 1].upper90)}</strong></div><div><span>입력 고정운임</span><strong>{money(displayInput.fixed)} / FEU</strong></div></div>
          <div className={styles.comparisonMeta}><span>점예측 {money(displayInput.forecasts[displayInput.selectedHorizon - 1].point)} / FEU</span><span>예측 대상 {displayDate(displayInput.forecasts[displayInput.selectedHorizon - 1].targetDate)}</span></div>
        </section>
      </div>

      <section className={`${styles.card} ${styles.flowCard}`}><div className={styles.flowSteps}>{["100,000개 4주 운임경로 생성", "선택 시점에서 101개 배분비율 평가", "최종 총비용이 낮은 비중 추천"].map((text, index) => <div key={text}><b>{index + 1}</b><span>{text}</span>{index < 2 ? <i /> : null}</div>)}</div></section>

      <section className={`${styles.card} ${styles.spectrumCard}`}>
        <SectionHeading eyebrow="FIXED–SPOT SPECTRUM" title="고정운임 0%에서 100%까지 비교" description="100,000개 운임 시나리오에 101개 배분비율을 적용합니다." />
        <div className={styles.spectrumLegend}><span data-tone="expected">예상 비용</span><span data-tone="cvar">후회비용</span><span data-tone="objective">최종 총비용</span><span data-tone="up">Spot 상승손실</span><span data-tone="down">Spot 하락손실</span></div>
        {result ? <SpectrumChart result={result} /> : <div className={styles.chartEmpty}>{error ?? "101개 배분안을 계산하고 있습니다."}</div>}
      </section>

      <section className={`${styles.card} ${styles.riskSection}`}><SectionHeading eyebrow="TAIL RISK BREAKDOWN" title="상승·하락 위험 분해" description="추천 후보의 CVaR90을 손실 방향별로 나눕니다." /><div className={styles.riskGrid}>{[
        ["Spot 상승손실", "Spot 운임이 고정운임보다 높을 때 Spot 배분에서 발생하는 추가비용", result?.best.upward ?? 0, "up"],
        ["Spot 하락손실", "Spot 운임이 낮을 때 고정 배분으로 놓친 비용절감 기회", result?.best.downward ?? 0, "down"],
      ].map(([title, description, numeric, tone]) => { const value = Number(numeric); const width = riskBarWidth(value, result?.best.cvar ?? 0); return <article key={String(title)}><div><span>{title}</span><strong>{compactMoney(value)}</strong></div><p>{description}</p><i><b data-tone={tone} style={{ width: `${width}%` }} /></i><small>{result?.best.cvar ? `${((value / result.best.cvar) * 100).toFixed(1)}%` : "0%"}</small></article>; })}</div></section>

      <InputDrawer draft={draft} onChange={setDraft} onClose={() => setDrawerOpen(false)} onRouteChange={onRouteChange} onRun={() => runDraft(draft, true)} open={drawerOpen} representative={representative} running={running} />
      {result && lastInput ? <DetailDialog onClose={() => setDetailOpen(false)} open={detailOpen} result={result} routeName={routeName} runInput={lastInput} /> : null}
    </main>
  );
}
