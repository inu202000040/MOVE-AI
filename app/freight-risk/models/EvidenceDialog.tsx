"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { fixedSeasonalNaiveScale } from "./core/metrics";
import type { HorizonWeeks, ModelProjectionV1 } from "./core/types";
import type { EvaluationEvidenceV1, HistoricalPointV1 } from "./models-data-types";
import styles from "./models.module.css";

export type EvidenceMetricV1 = "MAPE" | "MSE" | "MASE";

interface EvidenceDialogProps {
  readonly metricName: EvidenceMetricV1;
  readonly model: ModelProjectionV1;
  readonly horizon: HorizonWeeks;
  readonly routeName: string;
  readonly history: readonly HistoricalPointV1[];
  readonly records: readonly EvaluationEvidenceV1[];
  readonly onClose: () => void;
}

interface ChartScaleV1 {
  readonly min: number;
  readonly max: number;
  readonly x: (index: number) => number;
  readonly y: (value: number) => number;
}

const CHART_WIDTH = 920;
const CHART_HEIGHT = 286;
const CHART_PAD = { top: 26, right: 24, bottom: 42, left: 62 } as const;

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatMoney(value: number, digits = 0): string {
  return `$${formatNumber(value, digits)}`;
}

function formatSignedMoney(value: number): string {
  return `${value >= 0 ? "+" : "-"}$${formatNumber(Math.abs(value))}`;
}

function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

function useDialogLifecycle(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-models-main]");
    const previousOverflow = document.body.style.overflow;
    const hadStyleAttribute = document.body.hasAttribute("style");
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
      if (!hadStyleAttribute && document.body.getAttribute("style") === "") {
        document.body.removeAttribute("style");
      }
    };
  }, [onClose]);
  return panelRef;
}

function buildChartScale(records: readonly EvaluationEvidenceV1[]): ChartScaleV1 {
  const values = records.flatMap(({ actual, predicted }) => [actual, predicted]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = Math.max(1, rawMax - rawMin);
  const min = Math.max(0, rawMin - range * 0.12);
  const max = rawMax + range * 0.12;
  return {
    min,
    max,
    x: (index) => CHART_PAD.left + index / Math.max(1, records.length - 1)
      * (CHART_WIDTH - CHART_PAD.left - CHART_PAD.right),
    y: (value) => CHART_PAD.top + (max - value) / Math.max(1, max - min)
      * (CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom),
  };
}

function chartPath(
  records: readonly EvaluationEvidenceV1[],
  scale: ChartScaleV1,
  key: "actual" | "predicted",
): string {
  return records.map((record, index) => (
    `${index === 0 ? "M" : "L"}${scale.x(index).toFixed(2)},${scale.y(record[key]).toFixed(2)}`
  )).join(" ");
}

function topIndices(values: readonly number[], count = 5): ReadonlySet<number> {
  return new Set(values
    .map((value, index) => ({ value, index }))
    .toSorted((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, count)
    .map(({ index }) => index));
}

function ChartLegend() {
  return (
    <div className={styles.evidenceLegend} aria-label="차트 범례">
      <span><i className={styles.actualSwatch} />실측 운임</span>
      <span><i className={styles.forecastSwatch} />모델 예측값</span>
      <span><i className={styles.errorSwatch} />높은 오차</span>
    </div>
  );
}

function ActualForecastChart({
  metricName,
  records,
}: Readonly<{
  metricName: EvidenceMetricV1;
  records: readonly EvaluationEvidenceV1[];
}>) {
  const scale = buildChartScale(records);
  const tickIndices = [0, 13, 26, 39, records.length - 1]
    .filter((index, position, all) => index >= 0 && index < records.length && all.indexOf(index) === position);
  const highIndices = metricName === "MAPE"
    ? new Set(records.map((record, index) => record.apePct > 7 ? index : -1).filter((index) => index >= 0))
    : topIndices(records.map((record) => metricName === "MSE" ? record.difference ** 2 : record.absoluteError));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => scale.min + (scale.max - scale.min) * ratio);

  return (
    <div className={styles.evidenceChartCard}>
      <header className={styles.evidenceSectionHeader}>
        <div><span>ACTUAL VS FORECAST</span><h3>실측값과 예측값 비교</h3></div>
        <ChartLegend />
      </header>
      <svg aria-label="52개 목표일의 실측 운임과 모델 예측값" className={styles.evidenceLineChart} role="img" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        {yTicks.map((value) => {
          const y = scale.y(value);
          return (
            <g key={value}>
              <line className={styles.evidenceGridLine} x1={CHART_PAD.left} x2={CHART_WIDTH - CHART_PAD.right} y1={y} y2={y} />
              <text className={styles.evidenceAxisLabel} textAnchor="end" x={CHART_PAD.left - 10} y={y + 4}>{formatNumber(value / 1000, 1)}K</text>
            </g>
          );
        })}
        {tickIndices.map((index) => (
          <text className={styles.evidenceAxisLabel} key={index} textAnchor={index === 0 ? "start" : index === records.length - 1 ? "end" : "middle"} x={scale.x(index)} y={CHART_HEIGHT - 11}>
            {formatDate(records[index].targetDate).slice(2)}
          </text>
        ))}
        <path className={styles.evidenceActual} d={chartPath(records, scale, "actual")} />
        <path className={styles.evidenceForecast} d={chartPath(records, scale, "predicted")} />
        {records.map((record, index) => (
          <g key={`${record.forecastOrigin}-${record.targetDate}`}>
            <circle className={styles.evidenceActualPoint} cx={scale.x(index)} cy={scale.y(record.actual)} r="3.2">
              <title>{`${formatDate(record.targetDate)} · 실측 ${formatMoney(record.actual)} · 예측 ${formatMoney(record.predicted)} · 차이 ${formatSignedMoney(record.difference)} · APE ${record.apePct.toFixed(2)}%`}</title>
            </circle>
            <circle className={highIndices.has(index) ? styles.highError : styles.evidenceForecastPoint} cx={scale.x(index)} cy={scale.y(record.predicted)} r={highIndices.has(index) ? "4.4" : "3.2"}>
              <title>{`${formatDate(record.targetDate)} · 예측 ${formatMoney(record.predicted)} · 실측 ${formatMoney(record.actual)} · 차이 ${formatSignedMoney(record.difference)} · APE ${record.apePct.toFixed(2)}%`}</title>
            </circle>
          </g>
        ))}
        <text className={styles.evidenceAxisTitle} textAnchor="middle" transform="rotate(-90 14 143)" x="14" y="143">USD/FEU</text>
        <text className={styles.evidenceAxisTitle} textAnchor="middle" x={CHART_WIDTH / 2} y={CHART_HEIGHT - 1}>목표일</text>
      </svg>
      <p className={styles.chartHelp}>점에 마우스를 올리면 목표일·예측·실측·차이·APE 원시 기록을 확인할 수 있습니다.</p>
    </div>
  );
}

function ErrorContributionChart({
  metricName,
  records,
  maseScale,
}: Readonly<{
  metricName: "MSE" | "MASE";
  records: readonly EvaluationEvidenceV1[];
  maseScale: number;
}>) {
  const values = records.map((record) => metricName === "MSE"
    ? record.difference ** 2
    : record.absoluteError / maseScale);
  const max = Math.max(...values, metricName === "MASE" ? 1 : 0, 1);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const highIndices = topIndices(values);
  const width = 520;
  const height = CHART_HEIGHT;
  const pad = { top: 28, right: 24, bottom: 42, left: 58 } as const;
  const plotHeight = height - pad.top - pad.bottom;
  const plotWidth = width - pad.left - pad.right;
  const y = (value: number) => height - pad.bottom - value / max * plotHeight;
  const barWidth = plotWidth / values.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const tickIndices = [0, 17, 34, records.length - 1]
    .filter((index, position, all) => index >= 0 && index < records.length && all.indexOf(index) === position);

  return (
    <div className={styles.evidenceChartCard}>
      <header className={styles.evidenceSectionHeader}>
        <div>
          <span>{metricName === "MSE" ? "SQUARED ERROR" : "SCALED ERROR"}</span>
          <h3>{metricName === "MSE" ? "시점별 제곱오차 기여" : "모델 오차와 계절 Naive scale"}</h3>
        </div>
        <div className={styles.compactLegend}>
          <span><i className={styles.barSwatch} />시점별 값</span>
          <span><i className={styles.errorSwatch} />상위 오차 5개</span>
        </div>
      </header>
      <svg aria-label={metricName === "MSE" ? "52개 기록별 제곱오차와 평균선" : "52개 기록별 scaled error와 기준선 1"} className={styles.evidenceBarChart} role="img" viewBox={`0 0 ${width} ${height}`}>
        {yTicks.map((value) => (
          <g key={value}>
            <line className={styles.evidenceGridLine} x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} />
            <text className={styles.evidenceAxisLabel} textAnchor="end" x={pad.left - 8} y={y(value) + 4}>{metricName === "MSE" ? `${formatNumber(value / 1000, 1)}K` : value.toFixed(2)}</text>
          </g>
        ))}
        <line className={styles.evidenceMean} x1={pad.left} x2={width - pad.right} y1={y(mean)} y2={y(mean)} />
        <text className={styles.evidenceMeanLabel} textAnchor="end" x={width - pad.right} y={Math.max(12, y(mean) - 6)}>{metricName === "MSE" ? `평균 ${formatNumber(mean)}` : `평균 ${mean.toFixed(3)}`}</text>
        {metricName === "MASE" ? (
          <>
            <line className={styles.evidenceReference} x1={pad.left} x2={width - pad.right} y1={y(1)} y2={y(1)} />
            <text className={styles.evidenceReferenceLabel} x={pad.left + 4} y={Math.max(12, y(1) - 6)}>계절 Naive 기준 1.000</text>
          </>
        ) : null}
        {values.map((value, index) => {
          const barHeight = value / max * plotHeight;
          return (
            <rect className={highIndices.has(index) ? styles.highErrorBar : styles.errorBar} height={barHeight} key={`${records[index].targetDate}-${value}`} width={Math.max(2.5, barWidth - 2.2)} x={pad.left + index * barWidth + 1} y={height - pad.bottom - barHeight}>
              <title>{`${formatDate(records[index].targetDate)} · ${metricName === "MSE" ? `제곱오차 ${formatNumber(value, 2)}` : `scaled error ${value.toFixed(3)}`} · 실측 ${formatMoney(records[index].actual)} · 예측 ${formatMoney(records[index].predicted)}`}</title>
            </rect>
          );
        })}
        {tickIndices.map((index) => (
          <text className={styles.evidenceAxisLabel} key={index} textAnchor={index === 0 ? "start" : index === records.length - 1 ? "end" : "middle"} x={pad.left + (index + 0.5) * barWidth} y={height - 12}>{formatDate(records[index].targetDate).slice(2)}</text>
        ))}
        <text className={styles.evidenceAxisTitle} textAnchor="middle" x={width / 2} y={height - 1}>목표일</text>
      </svg>
      {metricName === "MASE" ? (
        <div className={styles.scaleComparison}>
          <span><small>모델 MAE</small><strong>{formatMoney(mean * maseScale, 2)}</strong></span>
          <b>÷</b>
          <span><small>고정 계절 scale</small><strong>{formatMoney(maseScale, 2)}</strong></span>
          <b>=</b>
          <span><small>MASE</small><strong>{mean.toFixed(3)}</strong></span>
        </div>
      ) : null}
    </div>
  );
}

function FormulaPanel({
  metricName,
  metricValue,
  meanAbsoluteError,
  maseScale,
  recordCount,
}: Readonly<{
  metricName: EvidenceMetricV1;
  metricValue: number;
  meanAbsoluteError: number;
  maseScale: number;
  recordCount: number;
}>) {
  if (metricName === "MAPE") {
    return (
      <aside className={styles.evidenceFormulaCard}>
        <span>MAPE FORMULA</span><h3>최종 평균 계산</h3>
        <code>MAPE = (1/n) Σ |(Aₜ − Fₜ) / Aₜ| × 100</code>
        <strong>= {metricValue.toFixed(2)}%</strong>
        <dl><div><dt>n</dt><dd>{recordCount}회 외부평가</dd></div><div><dt>Aₜ</dt><dd>목표일 실측 운임</dd></div><div><dt>Fₜ</dt><dd>동일 목표일 예측값</dd></div></dl>
        <p>각 기록은 반올림 전 원시 정밀도로 APE를 계산한 뒤 평균합니다. 실측값이 0인 기록은 분모가 정의되지 않으므로 데이터 경계에서 거부하며, 현재 52개 기록에는 0 실측값이 없습니다.</p>
      </aside>
    );
  }
  if (metricName === "MSE") {
    return (
      <aside className={styles.evidenceFormulaCard}>
        <span>MSE FORMULA</span><h3>최종 평균 계산</h3>
        <code>MSE = (e₁² + … + eₙ²) ÷ n</code>
        <strong>= {formatNumber(metricValue, 2)}</strong>
        <code>RMSE = √MSE = {formatMoney(Math.sqrt(metricValue), 2)}</code>
        <dl><div><dt>eₜ</dt><dd>실측 − 예측 오차</dd></div><div><dt>n</dt><dd>{recordCount}회 외부평가</dd></div></dl>
        <p>오차를 제곱하므로 큰 오차가 평균에 더 크게 반영됩니다. 오른쪽 막대의 붉은 5개 기록이 MSE 기여도가 가장 큰 목표일입니다.</p>
      </aside>
    );
  }
  return (
    <aside className={styles.evidenceFormulaCard}>
      <span>MASE FORMULA</span><h3>고정 분모 계산</h3>
      <code>scale_fixed = mean(|yₜ − yₜ₋₅₂|)</code>
      <code>MASE = MAE_model ÷ scale_fixed</code>
      <strong>{formatMoney(meanAbsoluteError, 2)} ÷ {formatMoney(maseScale, 2)} = {metricValue.toFixed(3)}</strong>
      <dl><div><dt>lag</dt><dd>계절 시차 52주</dd></div><div><dt>분모</dt><dd>첫 외부평가 이전 학습 이력</dd></div></dl>
      <p><b>&lt;1</b>은 계절 Naive보다 낮은 오차, <b>=1</b>은 동일, <b>&gt;1</b>은 높은 오차입니다. 외부평가 중 발생한 미래 잔차는 고정 scale에 섞지 않습니다.</p>
    </aside>
  );
}

export function EvidenceDialog({ metricName, model, horizon, routeName, history, records, onClose }: EvidenceDialogProps) {
  const panelRef = useDialogLifecycle(onClose);
  const metric = model.metricsByHorizon[horizon - 1];
  const meanAbsoluteError = useMemo(
    () => records.reduce((sum, record) => sum + record.absoluteError, 0) / records.length,
    [records],
  );
  const maseScale = useMemo(() => {
    const firstOriginIndex = history.findIndex(({ date }) => date === records[0]?.forecastOrigin);
    if (firstOriginIndex < 52) {
      throw new TypeError("MASE fixed scale requires the pre-evaluation training history");
    }
    return fixedSeasonalNaiveScale(history.slice(0, firstOriginIndex + 1).map(({ value }) => value), 52);
  }, [history, records]);
  const squaredErrors = useMemo(() => records.map(({ difference }) => difference ** 2), [records]);
  const highMseIndices = topIndices(squaredErrors);
  const scaledErrors = records.map(({ absoluteError }) => absoluteError / maseScale);
  const highMaseIndices = topIndices(scaledErrors);
  const titleId = `evidence-${model.modelId}-${horizon}-${metricName}`;
  const metricValue = metricName === "MAPE" ? metric.mapePct : metricName === "MSE" ? metric.mse : metric.mase;

  const kpis = metricName === "MAPE"
    ? [
        ["MAPE", `${metric.mapePct.toFixed(2)}%`, "표시 집계값"],
        ["외부평가", `${records.length}회`, "동일 rolling-origin"],
        ["평균 금액 오차", formatMoney(meanAbsoluteError), "Mean Absolute Error"],
      ]
    : metricName === "MSE"
      ? [
          ["MSE", formatNumber(metric.mse), "(USD/FEU)²"],
          ["외부평가", `${records.length}회`, "동일 rolling-origin"],
          ["RMSE", formatMoney(metric.rmse), "금액 단위로 환산"],
        ]
      : [
          ["MASE", metric.mase.toFixed(3), metric.mase < 1 ? "계절 Naive보다 우수" : metric.mase === 1 ? "계절 Naive와 동일" : "계절 Naive보다 열위"],
          ["모델 MAE", formatMoney(meanAbsoluteError), "52회 평균 절대오차"],
          ["고정 scale", formatMoney(maseScale), "첫 평가 이전 · lag 52"],
          ["외부평가", `${records.length}회`, "동일 rolling-origin"],
        ];

  const content = (
    <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div aria-labelledby={titleId} aria-modal="true" className={styles.evidenceDialog} ref={panelRef} role="dialog">
        <header className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>ROLLING-ORIGIN · OUTER EVALUATION</p>
            <h2 id={titleId}>{routeName} · {model.modelName} · {horizon}주 {metricName} 검증 근거</h2>
            <p className={styles.evidenceContext}>{model.modelVersion} · {model.evaluationProtocol} · USD/FEU</p>
          </div>
          <button aria-label={`${metricName} 검증 근거 닫기`} className={styles.iconButton} onClick={onClose} type="button">×</button>
        </header>
        <div className={styles.dialogScroll}>
          <section className={`${styles.kpiGrid} ${metricName === "MASE" ? styles.kpiGridFour : ""}`} aria-label={`${metricName} 핵심 지표`}>
            {kpis.map(([label, value, helper]) => (
              <article className={styles.kpi} key={label}><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>
            ))}
          </section>

          <section className={metricName === "MAPE" ? styles.evidenceSingleChart : styles.evidenceChartGrid} aria-label={`${metricName} 시각화`}>
            <ActualForecastChart metricName={metricName} records={records} />
            {metricName !== "MAPE" ? <ErrorContributionChart maseScale={maseScale} metricName={metricName} records={records} /> : null}
          </section>

          <section className={styles.evidenceDetailGrid}>
            <div className={styles.evidenceTableCard}>
              <header className={styles.evidenceSectionHeader}>
                <div><span>FOLD DETAIL</span><h3>{records.length}회 외부평가 계산 내역</h3></div>
                <small>{metricName === "MSE" ? "상위 제곱오차 5개 강조" : metricName === "MASE" ? "상위 scaled error 5개 강조" : "APE 7% 초과 강조"}</small>
              </header>
              <div className={styles.evidenceTableWrap}>
                <table className={styles.evidenceTable}>
                  <thead>
                    <tr>{(metricName === "MAPE"
                      ? ["목표일", "예측값", "실측값", "차이", "APE"]
                      : metricName === "MSE"
                        ? ["목표일", "실측값", "예측값", "오차", "제곱오차", "기여도"]
                        : ["목표일", "절대오차", "고정 scale", "Scaled error", "기여도"]
                    ).map((label) => <th key={label}>{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => {
                      const highError = metricName === "MAPE"
                        ? record.apePct > 7
                        : metricName === "MSE"
                          ? highMseIndices.has(index)
                          : highMaseIndices.has(index);
                      return (
                        <tr className={highError ? styles.highErrorRow : undefined} key={`${record.forecastOrigin}-${record.targetDate}`}>
                          <td>{formatDate(record.targetDate)}</td>
                          {metricName === "MAPE" ? <><td>{formatMoney(record.predicted)}</td><td>{formatMoney(record.actual)}</td><td className={record.difference >= 0 ? styles.positiveError : styles.negativeError}>{formatSignedMoney(record.difference)}</td><td>{record.apePct.toFixed(2)}%</td></>
                            : metricName === "MSE" ? <><td>{formatMoney(record.actual)}</td><td>{formatMoney(record.predicted)}</td><td className={record.difference >= 0 ? styles.positiveError : styles.negativeError}>{formatSignedMoney(record.difference)}</td><td>{formatNumber(squaredErrors[index])}</td><td>{(100 * squaredErrors[index] / squaredErrors.reduce((sum, value) => sum + value, 0)).toFixed(1)}%</td></>
                              : <><td>{formatMoney(record.absoluteError)}</td><td>{formatMoney(maseScale, 2)}</td><td>{scaledErrors[index].toFixed(3)}</td><td>{(100 * scaledErrors[index] / scaledErrors.reduce((sum, value) => sum + value, 0)).toFixed(1)}%</td></>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <FormulaPanel maseScale={maseScale} meanAbsoluteError={meanAbsoluteError} metricName={metricName} metricValue={metricValue} recordCount={records.length} />
          </section>

          <footer className={styles.evidenceMethodology}>
            <strong>검증 문맥</strong>
            <p>같은 {records.length}개 rolling-origin 외부평가 목표일을 사용합니다. 표와 차트는 표시 반올림 전 원시 정밀도에서 계산되며, 성능표의 {metricName} 값과 동일한 기록 집합입니다.</p>
            <p>항로 {routeName} · {model.modelName} {model.modelVersion} · {horizon}주 · {model.forecastSource === "tuned" ? "사용자 승인 재측정" : "승인 기준 결과"}</p>
          </footer>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
