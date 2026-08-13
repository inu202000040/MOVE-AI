"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { buildTuningComparison } from "./core/comparison";
import { modelDefinition } from "./core/registry";
import type { TuningSessionStateV1 } from "./core/tuning";
import type { EightTuple, ModelProjectionV1 } from "./core/types";
import styles from "./models.module.css";

interface TuningComparisonDialogProps {
  readonly state: TuningSessionStateV1;
  readonly beforeModels: EightTuple<ModelProjectionV1>;
  readonly afterModels: EightTuple<ModelProjectionV1>;
  readonly routeName: string;
  readonly onKeep: () => void;
  readonly onRollback: () => void;
}

function signed(value: number, suffix: string): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function comparisonPath(values: readonly number[], width: number, height: number, minimum: number, maximum: number): string {
  const range = Math.max(1, maximum - minimum);
  return values.map((value, index) => {
    const x = 50 + index * ((width - 100) / 3);
    const y = 24 + (maximum - value) / range * (height - 48);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function TuningComparisonDialog({
  state,
  beforeModels,
  afterModels,
  routeName,
  onKeep,
  onRollback,
}: TuningComparisonDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const decidedRef = useRef(false);
  const view = useMemo(
    () => buildTuningComparison(state, beforeModels, afterModels),
    [afterModels, beforeModels, state],
  );
  const definition = modelDefinition(view.modelId);
  const width = 760;
  const height = 190;
  const beforeValues = view.beforeModel.forecasts.map(({ point }) => point);
  const afterValues = view.afterModel.forecasts.map(({ point }) => point);
  const values = [...beforeValues, ...afterValues];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const keep = () => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    onKeep();
  };
  const rollback = () => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    onRollback();
  };

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-models-main]");
    const previousOverflow = document.body.style.overflow;
    main?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        keep();
        return;
      }
      if (event.key !== "Tab" || dialogRef.current === null) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      const first = controls[0];
      const last = controls.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      main?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
    };
  });

  return createPortal(
    <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) keep(); }}>
      <div aria-labelledby="tuning-comparison-title" aria-modal="true" className={styles.comparisonDialog} ref={dialogRef} role="dialog">
        <header className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>RE-MEASUREMENT RESULT</p>
            <h2 id="tuning-comparison-title">이전 결과와 재측정 결과 비교</h2>
            <p className={styles.comparisonContext}>{routeName} · {definition.name} · 실행 시간 {(view.elapsedMs / 1000).toFixed(1)}초</p>
          </div>
          <button aria-label="비교창 닫고 결과 유지" className={styles.iconButton} onClick={keep} type="button">×</button>
        </header>

        <div className={styles.comparisonScroll}>
          <div className={styles.comparisonMeta}>
            <span><small>이전</small><strong>{view.beforeMeta}</strong></span>
            <span><small>현재</small><strong>이번 재측정 결과</strong></span>
            <em>두 결과 모두 같은 52개 평가 기록</em>
          </div>

          <div className={styles.comparisonKpis}>
            <article><span>MAPE 개선량</span><strong>{signed(view.mapeImprovementPctPoints, "%p")}</strong><small>양수는 오차 감소</small></article>
            <article><span>1주 전망 이동</span><strong>{signed(view.forecastShift, " USD/FEU")}</strong><small>성능 개선과 별도 지표</small></article>
            <article><span>1주 종합순위</span><strong>{view.beforeRank}위 → {view.afterRank}위</strong><small>전체 8개 모델 기준</small></article>
          </div>

          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonChartPanel}>
              <header><strong>1~4주 전망 비교</strong><span><i className={styles.beforeSwatch} /> 이전 결과 <i className={styles.afterSwatch} /> 이번 결과</span></header>
              <svg aria-label={`${definition.name} 이전 결과와 이번 결과의 1주부터 4주 전망 비교`} className={styles.comparisonChart} role="img" viewBox={`0 0 ${width} ${height}`}>
                {[0, 1, 2, 3].map((index) => {
                  const x = 50 + index * ((width - 100) / 3);
                  return <g key={index}><line className={styles.comparisonGridLine} x1={x} x2={x} y1="20" y2={height - 24} /><text className={styles.comparisonAxis} textAnchor="middle" x={x} y={height - 7}>{index + 1}주</text></g>;
                })}
                <path className={styles.comparisonBeforeLine} d={comparisonPath(beforeValues, width, height, minimum, maximum)} />
                <path className={styles.comparisonAfterLine} d={comparisonPath(afterValues, width, height, minimum, maximum)} />
                {beforeValues.map((value, index) => {
                  const x = 50 + index * ((width - 100) / 3);
                  const y = 24 + (maximum - value) / Math.max(1, maximum - minimum) * (height - 48);
                  return <circle className={styles.comparisonBeforePoint} cx={x} cy={y} key={`before-${index}`} r="4" />;
                })}
                {afterValues.map((value, index) => {
                  const x = 50 + index * ((width - 100) / 3);
                  const y = 24 + (maximum - value) / Math.max(1, maximum - minimum) * (height - 48);
                  return <circle className={styles.comparisonAfterPoint} cx={x} cy={y} key={`after-${index}`} r="4.5" />;
                })}
              </svg>
            </div>

            <div className={styles.comparisonTableWrap}>
              <table className={styles.comparisonTable}>
                <thead><tr><th>비교 항목</th><th>{view.beforeMeta}</th><th>이번 재측정 결과</th></tr></thead>
                <tbody>{view.rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <section className={styles.settingsComparison}>
            <div><span>학습창</span><strong>{view.trainingWindowBefore} → {view.trainingWindowAfter}</strong></div>
            <div>
              <span>설정 변경</span>
              {view.settingChanges.length === 0 ? <strong>변경 없음</strong> : (
                <ul>{view.settingChanges.map((change) => <li key={change.key}><code>{change.key}</code><b>{String(change.before)} → {String(change.after)}</b></li>)}</ul>
              )}
            </div>
          </section>
          <p className={styles.comparisonNotice}>새 결과는 이미 그래프와 성능표에 반영됐습니다.</p>
        </div>

        <footer className={styles.comparisonFooter}>
          <button onClick={rollback} type="button">이전 결과로 되돌리기</button>
          <button className={styles.primaryButton} onClick={keep} type="button">결과 유지</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
