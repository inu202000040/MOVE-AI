"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import type { HorizonWeeks, ModelProjectionV1 } from "./core/types";
import type { EvaluationEvidenceV1 } from "./models-data-types";
import styles from "./models.module.css";

export type EvidenceMetricV1 = "MAPE" | "MSE" | "MASE";

interface EvidenceDialogProps {
  readonly metricName: EvidenceMetricV1;
  readonly model: ModelProjectionV1;
  readonly horizon: HorizonWeeks;
  readonly records: readonly EvaluationEvidenceV1[];
  readonly onClose: () => void;
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

function useDialogLifecycle(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-models-main]");
    const previousOverflow = document.body.style.overflow;
    main?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || panelRef.current === null) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      main?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  return panelRef;
}

function EvidenceVisualization({
  metricName,
  records,
  maseScale,
}: Readonly<{ metricName: EvidenceMetricV1; records: readonly EvaluationEvidenceV1[]; maseScale: number }>) {
  const width = 900;
  const height = 210;
  const pad = 24;
  if (metricName === "MAPE") {
    const values = records.flatMap(({ actual, predicted }) => [actual, predicted]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const x = (index: number) => pad + index / Math.max(1, records.length - 1) * (width - pad * 2);
    const y = (value: number) => pad + (max - value) / Math.max(1, max - min) * (height - pad * 2);
    const path = (key: "actual" | "predicted") => records.map((record, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(record[key])}`).join(" ");
    return (
      <svg aria-label="52개 목표일의 실측과 전망" className={styles.evidenceChart} role="img" viewBox={`0 0 ${width} ${height}`}>
        <path className={styles.evidenceActual} d={path("actual")} />
        <path className={styles.evidenceForecast} d={path("predicted")} />
        {records.map((record, index) => record.apePct > 7 ? <circle className={styles.highError} cx={x(index)} cy={y(record.predicted)} key={record.targetDate} r="3.5" /> : null)}
      </svg>
    );
  }
  const values = records.map((record) => metricName === "MSE"
    ? record.difference * record.difference
    : record.absoluteError / maseScale);
  const max = Math.max(...values, metricName === "MASE" ? 1 : 0);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const top = new Set(values.toSorted((a, b) => b - a).slice(0, 5));
  return (
    <svg aria-label={metricName === "MSE" ? "기록별 제곱오차" : "기록별 scaled error"} className={styles.evidenceChart} role="img" viewBox={`0 0 ${width} ${height}`}>
      <line className={styles.evidenceMean} x1={pad} x2={width - pad} y1={height - pad - mean / max * (height - pad * 2)} y2={height - pad - mean / max * (height - pad * 2)} />
      {metricName === "MASE" ? <line className={styles.evidenceReference} x1={pad} x2={width - pad} y1={height - pad - 1 / max * (height - pad * 2)} y2={height - pad - 1 / max * (height - pad * 2)} /> : null}
      {values.map((value, index) => {
        const barWidth = (width - pad * 2) / values.length;
        const barHeight = value / max * (height - pad * 2);
        return <rect className={top.has(value) ? styles.highErrorBar : styles.errorBar} height={barHeight} key={`${records[index].targetDate}-${value}`} width={Math.max(2, barWidth - 2)} x={pad + index * barWidth} y={height - pad - barHeight} />;
      })}
    </svg>
  );
}

export function EvidenceDialog({ metricName, model, horizon, records, onClose }: EvidenceDialogProps) {
  const panelRef = useDialogLifecycle(onClose);
  const metric = model.metricsByHorizon[horizon - 1];
  const meanAbsoluteError = useMemo(() => records.reduce((sum, record) => sum + record.absoluteError, 0) / records.length, [records]);
  const maseScale = meanAbsoluteError / metric.mase;
  const maxSquared = records.toSorted((left, right) => right.difference ** 2 - left.difference ** 2)[0];
  const titleId = `evidence-${model.modelId}-${horizon}-${metricName}`;

  const kpis = metricName === "MAPE"
    ? [["MAPE", `${metric.mapePct.toFixed(2)}%`], ["평가 기록 수", `${records.length}개`], ["평균 절대오차", formatNumber(meanAbsoluteError, 2)], ["평가 문맥", "rolling-origin 외부평가"]]
    : metricName === "MSE"
      ? [["MSE", formatNumber(metric.mse, 2)], ["RMSE", formatNumber(metric.rmse, 2)], ["평가 기록 수", `${records.length}개`], ["최대 제곱오차 목표일", formatDate(maxSquared.targetDate)]]
      : [["MASE", metric.mase.toFixed(3)], ["모델 MAE", formatNumber(meanAbsoluteError, 2)], ["고정 scale", formatNumber(maseScale, 2)], ["평가 기록 수", `${records.length}개`]];

  const content = (
    <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div aria-labelledby={titleId} aria-modal="true" className={styles.evidenceDialog} ref={panelRef} role="dialog">
        <header className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>ROLLING-ORIGIN · OUTER EVALUATION</p>
            <h2 id={titleId}>유럽 · {model.modelName} · {horizon}주 {metricName} 검증 근거</h2>
          </div>
          <button aria-label="검증 근거 닫기" className={styles.iconButton} onClick={onClose} type="button">×</button>
        </header>
        <div className={styles.dialogScroll}>
          <section className={styles.kpiGrid} aria-label={`${metricName} 핵심 지표`}>
            {kpis.map(([label, value]) => <div className={styles.kpi} key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </section>
          <section className={styles.formulaBox}>
            <strong>{metricName} 공식</strong>
            <code>{metricName === "MAPE" ? "MAPE = (1/n) Σ |(Aₜ − Fₜ) / Aₜ| × 100" : metricName === "MSE" ? "MSE = (e₁² + … + eₙ²) / n · RMSE = √MSE" : "MASE = MAE_model / scale_fixed · seasonal lag = 52"}</code>
            {metricName === "MASE" ? <p>&lt;1은 계절 Naive보다 낮은 오차, =1은 동일, &gt;1은 높은 오차입니다.</p> : null}
          </section>
          <EvidenceVisualization maseScale={maseScale} metricName={metricName} records={records} />
          <div className={styles.evidenceTableWrap}>
            <table className={styles.evidenceTable}>
              <thead>
                <tr>{(metricName === "MAPE" ? ["목표일", "예측값", "실측값", "차이", "APE"] : metricName === "MSE" ? ["목표일", "실측값", "예측값", "오차", "제곱오차"] : ["목표일", "실측값", "예측값", "절대오차", "Scaled error"]).map((label) => <th key={label}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr className={metricName === "MAPE" && record.apePct > 7 ? styles.highErrorRow : undefined} key={`${record.forecastOrigin}-${record.targetDate}`}>
                    <td>{formatDate(record.targetDate)}</td>
                    {metricName === "MAPE" ? <><td>{formatNumber(record.predicted, 2)}</td><td>{formatNumber(record.actual, 2)}</td><td>{formatNumber(record.difference, 2)}</td><td>{record.apePct.toFixed(2)}%</td></> : metricName === "MSE" ? <><td>{formatNumber(record.actual, 2)}</td><td>{formatNumber(record.predicted, 2)}</td><td>{formatNumber(record.difference, 2)}</td><td>{formatNumber(record.difference ** 2, 2)}</td></> : <><td>{formatNumber(record.actual, 2)}</td><td>{formatNumber(record.predicted, 2)}</td><td>{formatNumber(record.absoluteError, 2)}</td><td>{(record.absoluteError / maseScale).toFixed(3)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
