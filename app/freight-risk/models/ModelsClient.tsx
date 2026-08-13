"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFreightRiskRoute } from "../../components/shell";
import { ROUTE_IDS, ROUTE_LABELS, type DataGatewayV1, type DataModeV1, type RouteId } from "../../contracts";
import { createSameOriginDataGatewayV1 } from "../../data/runtime/data-gateway";
import { ForecastComparisonChart } from "./ForecastComparisonChart";
import { EvidenceDialog, type EvidenceMetricV1 } from "./EvidenceDialog";
import { TuningComparisonDialog } from "./TuningComparisonDialog";
import { TuningDrawer } from "./TuningDrawer";
import { scoreModelsForHorizon } from "./core/metrics";
import { produceModelsCore } from "./core/producer";
import { MODEL_REGISTRY } from "./core/registry";
import { buildRepresentativeSelection } from "./core/representative";
import type { TuningSessionStateV1 } from "./core/tuning";
import type {
  EightTuple,
  HashedTuneResultV1,
  HorizonWeeks,
  ModelProjectionV1,
  RepresentativeSelectionV1,
  RiskModelId,
} from "./core/types";
import type { ModelsSnapshotCatalogV1, ModelsSnapshotRouteV1 } from "./snapshot-adapter";
import {
  subscribeModelsRepresentative,
} from "./representative-consumer";
import { getModelsProducedCoreInternal } from "./representative-internal";
import {
  keepModelsTuningCandidateInternal,
  restoreAutomaticModelsRepresentativeInternal,
  rollbackModelsTuningCandidateInternal,
  setManualModelsRepresentativeInternal,
} from "./representative-mutations";
import { modelsTuningGatewayFromDataGateway } from "./tuning-gateway";
import {
  displayModelVersion,
  modelBadge,
  modelChangePct,
  performanceRows,
  selectedLegendLabel,
} from "./view-model";
import styles from "./models.module.css";

interface EvidenceStateV1 {
  readonly metric: EvidenceMetricV1;
  readonly modelId: RiskModelId;
  readonly trigger: HTMLElement;
}

interface ComparisonStateV1 {
  readonly route: RouteId;
  readonly session: TuningSessionStateV1;
  readonly beforeModels: EightTuple<ModelProjectionV1>;
  readonly afterModels: EightTuple<ModelProjectionV1>;
  readonly beforeRepresentative: RepresentativeSelectionV1;
  readonly afterRepresentative: RepresentativeSelectionV1;
  readonly dataMode: DataModeV1;
  readonly beforeSelectedModels: ReadonlySet<RiskModelId>;
  readonly beforeRangeMode: "recent" | "all";
}

function formatMoney(value: number, digits = 0): string {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function initialRepresentative(routeData: ModelsSnapshotRouteV1): RepresentativeSelectionV1 {
  return buildRepresentativeSelection({
    route: routeData.route,
    currentObservation: routeData.currentObservation,
    models: routeData.models,
  });
}

export interface ModelsClientProps {
  readonly catalog: ModelsSnapshotCatalogV1;
  readonly dataGateway?: DataGatewayV1;
}

export default function ModelsClient({ catalog, dataGateway }: ModelsClientProps) {
  const { routeId, changeRoute } = useFreightRiskRoute();
  const routeData = catalog[routeId];
  const tuningGateway = useMemo(
    () => modelsTuningGatewayFromDataGateway(dataGateway ?? createSameOriginDataGatewayV1()),
    [dataGateway],
  );
  const [horizon, setHorizon] = useState<HorizonWeeks>(1);
  const [rangeMode, setRangeMode] = useState<"recent" | "all">("recent");
  const [selectedModels, setSelectedModels] = useState<ReadonlySet<RiskModelId>>(() => new Set());
  const [models, setModels] = useState(routeData.models);
  const [representative, setRepresentative] = useState(() => initialRepresentative(routeData));
  const [evidence, setEvidence] = useState<EvidenceStateV1 | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTrigger, setDrawerTrigger] = useState<HTMLElement | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [acceptedByModel, setAcceptedByModel] = useState<Readonly<Partial<Record<RiskModelId, HashedTuneResultV1>>>>({});
  const [acceptedModeByModel, setAcceptedModeByModel] = useState<Readonly<Partial<Record<RiskModelId, DataModeV1>>>>({});
  const [comparison, setComparison] = useState<ComparisonStateV1 | null>(null);

  const refreshFromStorage = useCallback((validatedRepresentative?: RepresentativeSelectionV1) => {
    try {
      const produced = getModelsProducedCoreInternal(routeId, window.localStorage);
      if (validatedRepresentative !== undefined
        && produced.representative.representativeRevision
          !== validatedRepresentative.representativeRevision) {
        throw new TypeError("Models representative changed during hydration");
      }
      setModels(produced.mergedModels);
      setRepresentative(validatedRepresentative ?? produced.representative);
      setAcceptedByModel(produced.storageSnapshot.tuningByModel);
      setStorageWarning(null);
    } catch {
      setModels(routeData.models);
      setRepresentative(initialRepresentative(routeData));
      setAcceptedByModel({});
      setStorageWarning("저장된 모델 설정을 불러오지 못했습니다. 내장 기준 결과를 유지합니다.");
    }
  }, [routeData, routeId]);

  useEffect(() => {
    setHorizon(1);
    setRangeMode("recent");
    setSelectedModels(new Set());
    setEvidence(null);
    setDrawerOpen(false);
    setComparison(null);
    setAcceptedModeByModel({});
    refreshFromStorage();
    return subscribeModelsRepresentative(window, routeId, window.localStorage, (update) => {
      if (update.state === "READY") {
        refreshFromStorage(update.representative);
      } else {
        setModels(routeData.models);
        setRepresentative(initialRepresentative(routeData));
        setAcceptedByModel({});
        setStorageWarning("저장된 모델 설정을 검증할 수 없어 승인 기준 결과를 유지합니다.");
      }
    });
  }, [refreshFromStorage, routeId]);

  const rows = useMemo(
    () => performanceRows(models, horizon, representative),
    [horizon, models, representative],
  );
  const scoredForCards = useMemo(
    () => new Map(scoreModelsForHorizon(models.map((model) => ({
      modelId: model.modelId,
      metric: model.metricsByHorizon[horizon - 1],
    }))).map((entry) => [entry.modelId, entry.metric])),
    [horizon, models],
  );

  const selectRepresentative = (modelId: RiskModelId) => {
    const update = setManualModelsRepresentativeInternal(
      window,
      routeId,
      window.localStorage,
      modelId,
    );
    if (update.state === "READY") {
      setStorageWarning(null);
    } else {
      setStorageWarning("대표모델을 이 브라우저에 저장하지 못했습니다. 현재 탭에서는 선택을 유지합니다.");
      setRepresentative(buildRepresentativeSelection({
        route: routeId,
        currentObservation: routeData.currentObservation,
        models,
        manualModelId: modelId,
      }));
    }
  };

  const restoreAutomatic = () => {
    const update = restoreAutomaticModelsRepresentativeInternal(
      window,
      routeId,
      window.localStorage,
    );
    if (update.state === "READY") {
      setStorageWarning(null);
    } else {
      setStorageWarning("대표모델 저장을 갱신하지 못했습니다. 현재 탭에서는 자동 선택을 적용합니다.");
      setRepresentative(buildRepresentativeSelection({
        route: routeId,
        currentObservation: routeData.currentObservation,
        models,
      }));
    }
  };

  const toggleLegend = (modelId: RiskModelId) => {
    setSelectedModels((current) => {
      const next = new Set(current);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const closeEvidence = () => {
    const trigger = evidence?.trigger;
    setEvidence(null);
    requestAnimationFrame(() => trigger?.focus());
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    requestAnimationFrame(() => drawerTrigger?.focus());
  };

  const previewTuningCandidate = (session: TuningSessionStateV1, dataMode: DataModeV1) => {
    if (session.status !== "success" || session.candidate === null) return;
    const beforeModels = models;
    const beforeRepresentative = representative;
    const beforeSelectedModels = new Set(selectedModels);
    const beforeRangeMode = rangeMode;
    const produced = produceModelsCore({
      route: routeId,
      currentObservation: routeData.currentObservation,
      baselineModels: routeData.models,
      storage: window.localStorage,
      sessionTuningByModel: { [session.candidate.result.modelId]: session.candidate },
    });
    setModels(produced.mergedModels);
    setRepresentative(produced.representative);
    setDrawerOpen(false);
    setComparison({
      route: routeId,
      session,
      beforeModels,
      afterModels: produced.mergedModels,
      beforeRepresentative,
      afterRepresentative: produced.representative,
      dataMode,
      beforeSelectedModels,
      beforeRangeMode,
    });
  };

  const finishComparison = () => {
    setComparison(null);
    requestAnimationFrame(() => drawerTrigger?.focus());
  };

  const keepComparisonCandidate = () => {
    if (comparison === null || comparison.session.candidate === null) return;
    const result = keepModelsTuningCandidateInternal(
      window,
      comparison.route,
      window.localStorage,
      comparison.session,
    );
    const accepted = result.state.accepted;
    if (accepted !== null) {
      setAcceptedByModel((current) => ({ ...current, [accepted.result.modelId]: accepted }));
      setAcceptedModeByModel((current) => ({ ...current, [accepted.result.modelId]: comparison.dataMode }));
    }
    setModels(comparison.afterModels);
    setRepresentative(comparison.afterRepresentative);
    setStorageWarning(result.persisted ? null : "재학습 결과를 이 브라우저에 저장하지 못했습니다.");
    finishComparison();
  };

  const rollbackComparisonCandidate = () => {
    if (comparison === null) return;
    rollbackModelsTuningCandidateInternal(
      window,
      comparison.route,
      window.localStorage,
      comparison.session,
    );
    setModels(comparison.beforeModels);
    setRepresentative(comparison.beforeRepresentative);
    setSelectedModels(comparison.beforeSelectedModels);
    setRangeMode(comparison.beforeRangeMode);
    finishComparison();
  };

  return (
    <div className={styles.page} data-models-main>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>MODEL VALIDATION</p>
          <h1>예측 모델 디테일</h1>
          <p className={styles.pageDescription}>8개 모델의 1~4주 전망과 시차별 검증 성능을 비교합니다.</p>
        </div>
        <div className={styles.dataBasis}>
          <span>데이터 기준</span>
              <strong>{routeData.currentObservation.date.replaceAll("-", ".")}</strong>
        </div>
      </header>

      <main className={styles.workspace}>
        <section className={`${styles.panel} ${styles.forecastPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>EIGHT-MODEL FORECAST</p>
              <h2>8개 모델의 1~4주 예측경로 확대 비교</h2>
              <p>기본은 직전 4개 실측과 향후 1~4주 예측을 확대 비교하며, 휠·드래그·기간 버튼으로 2022년부터 과거 흐름을 탐색할 수 있습니다.</p>
            </div>
            <div className={styles.panelBadges}>
              <span>동일 187주 입력</span>
            </div>
          </header>

          <div className={styles.contextBar}>
            <div className={styles.contextCopy}>
              <strong>{routeData.routeName} · 직전 4주 + 향후 1~4주 · 전체 이력 탐색</strong>
              <span>{representative.selectionMode === "manual" ? "사용자 대표" : "자동 대표"} {representative.modelName} · 1주 기준</span>
            </div>
            <div className={styles.tools}>
              <label className={styles.routeControl}>
                <span>조회 항로</span>
                <select aria-label="조회 항로" onChange={(event) => changeRoute(event.target.value)} value={routeId}>
                  {ROUTE_IDS.map((route) => <option key={route} value={route}>{route} · {ROUTE_LABELS[route]}</option>)}
                </select>
              </label>
              <div className={styles.horizonTabs} aria-label="성능 시차">
                {([1, 2, 3, 4] as const).map((item) => (
                  <button aria-pressed={horizon === item} key={item} onClick={() => setHorizon(item)} type="button">{item}주</button>
                ))}
              </div>
              <button className={styles.settingsButton} onClick={(event) => { setDrawerTrigger(event.currentTarget); setDrawerOpen(true); }} type="button">고급설정</button>
            </div>
          </div>

          <div className={styles.legend} aria-label="모델 범례">
            <div className={styles.actualLegend}><span /> <strong>KCCI 실측</strong></div>
            {MODEL_REGISTRY.map((definition) => {
              const model = models.find(({ modelId }) => modelId === definition.id);
              const selected = selectedModels.has(definition.id);
              return (
                <button aria-pressed={selected} key={definition.id} onClick={() => toggleLegend(definition.id)} type="button">
                  <span className={styles.legendColor} style={{ backgroundColor: definition.color }} />
                  <span><strong>{definition.name}</strong><small>{definition.family}</small></span>
                  {representative.modelId === definition.id ? <em>대표</em> : null}
                  {model?.forecastSource === "tuned" && acceptedByModel[definition.id]?.tuningRunHash === model.tuningRunHash && acceptedModeByModel[definition.id] === "live" ? <em>LIVE</em> : null}
                </button>
              );
            })}
            <button className={styles.legendReset} onClick={() => setSelectedModels(new Set())} type="button">{selectedLegendLabel(selectedModels)}</button>
          </div>

          <ForecastComparisonChart
            history={routeData.history}
            models={models}
            onRangeModeChange={setRangeMode}
            rangeMode={rangeMode}
            representative={representative}
            routeName={routeData.routeName}
            selectedModels={selectedModels}
          />

          <div className={styles.representativeIntro}>
            <div>
              <h3>1페이지에 반영할 대표모델 선택</h3>
              <p>기본값은 Naive를 제외한 1주 성능 자동 1위이며, 아래 카드를 누르면 이 항로의 대표모델을 직접 지정합니다.</p>
            </div>
            {representative.selectionMode === "manual" ? (
              <button onClick={restoreAutomatic} type="button">자동 선택으로 복원</button>
            ) : <span>자동 선택 중 · {representative.automaticChampion.modelName}</span>}
          </div>

          {storageWarning !== null ? <p className={styles.storageWarning} role="status">{storageWarning}</p> : null}

          <div className={styles.modelCards}>
            {models.map((model) => {
              const definition = MODEL_REGISTRY.find(({ id }) => id === model.modelId);
              const forecast = model.forecasts[horizon - 1];
              const metric = scoredForCards.get(model.modelId);
              const badge = modelBadge(model.modelId, representative);
              const isRepresentative = representative.modelId === model.modelId;
              const change = modelChangePct(forecast.point, routeData.currentObservation.value);
              return (
                <button
                  aria-pressed={isRepresentative}
                  className={styles.modelCard}
                  key={model.modelId}
                  onClick={() => selectRepresentative(model.modelId)}
                  style={{ "--model-color": definition?.color } as React.CSSProperties}
                  type="button"
                >
                  <span className={styles.modelFamily}>{definition?.family}</span>
                  <span className={styles.modelCardTitle}><i />{model.modelName}</span>
                  <span className={styles.modelCardMeta}>{displayModelVersion(model)}</span>
                  <span className={styles.modelCardValue}><strong>{formatMoney(forecast.point)}</strong><small>USD/FEU · {horizon}주</small></span>
                  <span className={change >= 0 ? styles.positiveChange : styles.negativeChange}>{change >= 0 ? "+" : ""}{change.toFixed(1)}% <small>현재값 대비</small></span>
                  <span className={styles.modelCardFooter}><em>{badge ?? `${horizon}주 점수 ${metric?.totalScore.toFixed(1)}`}</em>{isRepresentative ? <b>대표</b> : null}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.performancePanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>OUT-OF-SAMPLE SCORE</p>
              <h2>모델 성능 비교</h2>
              <p>{horizon}주 외부평가 오차를 무차원 점수로 바꾼 뒤 동일가중으로 합산</p>
            </div>
            <div className={styles.weightBadges}><span>MAPE 33.3%</span><span>MSE 33.3%</span><span>MASE 33.3%</span><span>대표모델 1주 기준</span></div>
          </header>
          <div className={styles.performanceTableWrap}>
            <table className={styles.performanceTable}>
              <thead><tr><th>예측모델</th><th>MAPE</th><th>MSE</th><th>MASE</th><th>종합점수</th><th>{horizon}주 Coverage</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const definition = MODEL_REGISTRY.find(({ id }) => id === row.model.modelId);
                  return (
                    <tr className={row.isRepresentative && representative.selectionMode === "manual" ? styles.manualRow : undefined} key={row.model.modelId}>
                      <td><div className={styles.tableModel}><span style={{ backgroundColor: definition?.color }} /><div><strong>{row.rank}. {row.model.modelName}</strong><small>{displayModelVersion(row.model)}{row.isAutomaticChampion ? " · 자동 1위" : ""}{row.isRepresentative ? " · 대표" : ""}</small></div><button aria-label={`${row.model.modelName} 모델 정보`} type="button">i</button></div></td>
                      {(["MAPE", "MSE", "MASE"] as const).map((metricName) => (
                        <td key={metricName}><button className={styles.metricButton} onClick={(event) => setEvidence({ metric: metricName, modelId: row.model.modelId, trigger: event.currentTarget })} type="button"><strong>{metricName === "MAPE" ? `${row.metric.mapePct.toFixed(2)}%` : metricName === "MSE" ? formatMoney(row.metric.mse) : row.metric.mase.toFixed(3)}</strong><small>점수 {(metricName === "MAPE" ? row.metric.mapeScore : metricName === "MSE" ? row.metric.mseScore : row.metric.maseScore).toFixed(1)} · 근거 보기</small></button></td>
                      ))}
                      <td><strong className={styles.score}>{row.metric.totalScore.toFixed(1)}</strong></td>
                      <td><strong>{row.metric.coverage.pct.toFixed(1)}%</strong><small className={styles.coverageHits}>{row.metric.coverage.hits}/{row.metric.coverage.total}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <aside className={styles.methodology}>
            <strong>평가 방법</strong>
            <p>모든 모델은 같은 52개 rolling-origin 외부평가 기록으로 비교합니다. MAPE, MSE, MASE를 무차원 점수로 바꿔 동일가중 합산하며, Coverage는 품질 맥락으로만 보이고 종합점수에는 들어가지 않습니다.</p>
            <p>Naive는 기준선이며 자동 대표 후보에서 제외됩니다. 수동 대표는 자동 1위와 별개로 유지되며, LIVE는 사용자가 결과 유지를 선택한 재측정에만 붙습니다.</p>
          </aside>
        </section>
      </main>

      {evidence !== null ? (() => {
        const model = models.find(({ modelId }) => modelId === evidence.modelId);
        if (model === undefined) return null;
        const candidate = comparison?.session.candidate?.result.modelId === evidence.modelId
          ? comparison.session.candidate
          : acceptedByModel[evidence.modelId];
        const records = candidate?.result.evaluationByHorizon[horizon - 1].records
          ?? routeData.evaluationByModel[evidence.modelId][horizon - 1];
        return <EvidenceDialog horizon={horizon} metricName={evidence.metric} model={model} onClose={closeEvidence} records={records} />;
      })() : null}
      <TuningDrawer acceptedByModel={acceptedByModel} gateway={tuningGateway} history={routeData.history} initialModelId={selectedModels.size === 1 ? [...selectedModels][0] : representative.modelId} onClose={closeDrawer} onSuccess={previewTuningCandidate} open={drawerOpen} routeCode={routeId} routeName={routeData.routeName} />
      {comparison !== null ? (
        <TuningComparisonDialog
          afterModels={comparison.afterModels}
          beforeModels={comparison.beforeModels}
          onKeep={keepComparisonCandidate}
          onRollback={rollbackComparisonCandidate}
          routeName={routeData.routeName}
          state={comparison.session}
        />
      ) : null}
    </div>
  );
}
