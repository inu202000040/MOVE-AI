"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { downloadRecommendedCvarCsv } from "./download";
import type { CvarSimulationResult } from "./engine";
import type { AllocationRunInput } from "./representative";
import { money, PathsChart } from "./charts";
import { createPercentileRows } from "./view-model";
import styles from "./allocation.module.css";

type DetailTab = "allocation" | "paths" | "method";

const METHOD_BLOCKS = [
  ["PI90을 주차별 변동 폭으로 변환", "하락폭=(점예측-하한)÷1.645 · 상승폭=(상한-점예측)÷1.645"],
  ["비대칭 Spot 운임 생성", "Spotₜ=점예측ₜ+Zₜ×상승·하락 변동폭ₜ"],
  ["주차 간 시차상관 적용", "Zₜ=0.75×Zₜ₋₁+0.661×새 충격"],
  ["현재부터 4주까지 경로 연결", "현재 → 1주 → 2주 → 3주 → 4주"],
  ["101개 고정·Spot 비중별 비용 평가", "비용ᵢ=물동량×[고정비중×고정운임+Spot비중×Spotᵢ]"],
  ["CVaR90 후회비용과 최종 총비용 계산", "후회ᵢ=현재 배분비용ᵢ-min(전량 고정비용, 전량 Spot비용ᵢ)"],
] as const;

function HelpBubble({ label, children }: { readonly label: string; readonly children: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{
    readonly above: boolean;
    readonly left: number;
    readonly top: number;
  } | null>(null);

  const showTooltip = (): void => {
    const box = buttonRef.current?.getBoundingClientRect();
    if (!box) return;
    const above = box.bottom + 100 > window.innerHeight;
    setPosition({
      above,
      left: Math.max(120, Math.min(window.innerWidth - 120, box.left + box.width / 2)),
      top: above ? box.top - 8 : box.bottom + 8,
    });
  };

  return (
    <>
      <button
        aria-describedby={position ? tooltipId : undefined}
        aria-label={`${label} 설명`}
        className={styles.helpButton}
        onBlur={() => setPosition(null)}
        onFocus={showTooltip}
        onPointerEnter={showTooltip}
        onPointerLeave={() => setPosition(null)}
        ref={buttonRef}
        type="button"
      >
        ?
      </button>
      {position && typeof document !== "undefined"
        ? createPortal(
            <span
              className={styles.floatingHelpTooltip}
              data-placement={position.above ? "above" : "below"}
              id={tooltipId}
              role="tooltip"
              style={{ left: position.left, top: position.top }}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

export function DetailDialog({
  onClose,
  open,
  result,
  routeName,
  runInput,
}: {
  readonly onClose: () => void;
  readonly open: boolean;
  readonly result: CvarSimulationResult;
  readonly routeName: string;
  readonly runInput: AllocationRunInput;
}) {
  const [tab, setTab] = useState<DetailTab>("allocation");
  const recommendedRow = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (open) setTab("allocation");
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "allocation") return;
    const frame = requestAnimationFrame(() => {
      recommendedRow.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, tab]);

  const percentiles = useMemo(() => {
    if (!open || tab !== "paths") return [];
    return createPercentileRows(result.spots, runInput.simulation, result.best);
  }, [open, result, runInput, tab]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <section
        aria-label="100,000개 시뮬레이션 상세 결과"
        aria-modal="true"
        className={styles.detailDialog}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.detailHeader}>
          <div>
            <span className={styles.eyebrow}>SIMULATION RESULT TRACE</span>
            <h2>100,000개 시뮬레이션 상세 결과</h2>
            <p>추천 비중을 만든 101개 배분안과 운임경로 분포를 확인합니다.</p>
          </div>
          <div className={styles.detailActions}>
            <button
              aria-label="추천 비중 CSV"
              className={styles.secondaryButton}
              onClick={() => downloadRecommendedCvarCsv(runInput, result)}
              type="button"
            >
              <span aria-hidden="true">↓</span><span className={styles.csvLabel}>추천 비중 CSV</span>
            </button>
            <button aria-label="상세 결과 닫기" className={styles.iconButton} onClick={onClose} type="button">×</button>
          </div>
        </header>

        <div className={styles.detailStats}>
          {[
            ["미래 Spot 경로", "100,000개"],
            ["배분비중 후보", "101개"],
            ["총 비용 평가", "10,100,000건"],
            ["꼬리 기준", "CVaR 90"],
            ["추천 배분", `고정 ${result.best.share}%`],
          ].map(([label, value], index) => (
            <div className={index === 4 ? styles.finalStat : undefined} key={label}>
              <span>{label}</span><strong>{value}</strong>
            </div>
          ))}
        </div>

        <div aria-label="상세 결과 보기" className={styles.tabs} role="tablist">
          {[
            ["allocation", "비중별 결과 101개"],
            ["paths", "운임경로 분포"],
            ["method", "계산 방법"],
          ].map(([id, label]) => (
            <button
              aria-controls={`detail-panel-${id}`}
              aria-selected={tab === id}
              className={tab === id ? styles.activeTab : undefined}
              id={`detail-tab-${id}`}
              key={id}
              onClick={() => setTab(id as DetailTab)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "allocation" ? (
          <div
            aria-labelledby="detail-tab-allocation"
            className={`${styles.detailPanel} ${styles.allocationPanel}`}
            id="detail-panel-allocation"
            role="tabpanel"
          >
            <div className={styles.tableScroller}>
              <table className={styles.resultTable}>
                <thead><tr>
                  <th>배분비율</th>
                  <th>예상 비용 <HelpBubble label="예상 비용">100,000개 운임경로의 평균 조달비용입니다.</HelpBubble></th>
                  <th>평균단가/FEU</th>
                  <th>후회비용 <HelpBubble label="후회비용">불리한 10,000개 경제손실의 평균인 CVaR90입니다.</HelpBubble></th>
                  <th>Spot 상승손실</th><th>Spot 하락손실</th><th>최종 총비용</th>
                </tr></thead>
                <tbody>
                  {result.results.map((candidate) => (
                    <tr
                      className={candidate.share === result.best.share ? styles.recommendedRow : undefined}
                      key={candidate.share}
                      ref={candidate.share === result.best.share ? recommendedRow : undefined}
                    >
                      <td><strong>고정 {candidate.share}%</strong><span>Spot {candidate.spotShare}%</span>{candidate.share === result.best.share ? <em>추천</em> : null}</td>
                      <td>{money(candidate.expected)}</td><td>{money(candidate.averageUnitCost)}</td>
                      <td>{money(candidate.cvar)}</td><td>{money(candidate.upward)}</td>
                      <td>{money(candidate.downward)}</td><td>{money(candidate.objective)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "paths" ? (
          <div aria-labelledby="detail-tab-paths" className={styles.detailPanel} id="detail-panel-paths" role="tabpanel">
            <PathsChart input={runInput.simulation} representative={runInput.representative} result={result} routeName={routeName} />
            <div className={styles.tableScroller}>
              <table className={`${styles.resultTable} ${styles.percentileTable}`}>
                <thead><tr><th>운임 분위수</th><th>Spot 운임/FEU</th><th>고정운임 대비</th><th>추천비중 총비용</th><th>실효단가/FEU</th><th>경제손실</th><th>손실 방향</th></tr></thead>
                <tbody>{percentiles.map((row) => (
                  <tr key={row.percentile}><td><strong>P{row.percentile}</strong></td><td>{money(row.spot)}</td><td>{row.difference >= 0 ? "+" : ""}{money(row.difference)}</td><td>{money(row.totalCost)}</td><td>{money(row.unitCost)}</td><td>{money(row.loss)}</td><td>{row.direction}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "method" ? (
          <div aria-labelledby="detail-tab-method" className={`${styles.detailPanel} ${styles.methodPanel}`} id="detail-panel-method" role="tabpanel">
            <p className={styles.methodIntro}>주차별 점예측과 PI90으로 연결된 Spot 운임경로 100,000개를 만든 뒤, 같은 경로에 고정운임 비중 0~100%의 101개 배분안을 적용해 평균비용과 최악 10%의 후회비용을 비교합니다.</p>
            <div className={styles.methodGrid}>
              {METHOD_BLOCKS.map(([title, formula], index) => (
                <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><code>{formula}</code></article>
              ))}
            </div>
            <aside className={styles.cautionBox}><strong>해석 주의</strong><p>PI90만으로 미래 운임의 전체 확률분포가 결정되는 것은 아닙니다. 표준정규분포와 주간 상관 0.75는 현재 데모 가정이며 실제 운영 단계에서는 rolling-backtest 잔차로 보정해야 합니다.</p></aside>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
