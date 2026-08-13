"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { DataModeV1, RouteId } from "../../contracts";
import { MODEL_REGISTRY, isRiskModelId } from "./core/registry";
import {
  MODEL_PARAMETER_SPECS,
  TRAINING_WINDOWS,
  TUNING_PRESETS,
  createTuneRequest,
  createTuningSession,
  defaultParameters,
  parametersForPreset,
  rejectTuningRun,
  resolveTuningRun,
  startTuningRun,
  validateParameters,
  type TuningPresetIdV1,
  type TuningSessionStateV1,
} from "./core/tuning";
import type { HashedTuneResultV1, RiskModelId, TrainingWindowV1, TuneParameterValueV1, TuneRequestV1 } from "./core/types";
import type { HistoricalPointV1 } from "./models-data-types";
import { runTuningGateway, type ModelsTuningGatewayV1 } from "./tuning-gateway";
import styles from "./models.module.css";

interface NumberSpecV1 {
  readonly kind: "number";
  readonly defaultValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
}

interface StringSpecV1 {
  readonly kind: "string";
  readonly defaultValue: string;
  readonly values: readonly string[];
}

type ParameterSpecV1 = NumberSpecV1 | StringSpecV1;

interface TuningDrawerProps {
  readonly open: boolean;
  readonly initialModelId: unknown;
  readonly history: readonly HistoricalPointV1[];
  readonly acceptedByModel: Readonly<Partial<Record<RiskModelId, HashedTuneResultV1>>>;
  readonly routeCode: RouteId;
  readonly routeName: string;
  readonly onClose: () => void;
  readonly onSuccess: (state: TuningSessionStateV1, mode: DataModeV1) => void;
  readonly gateway: ModelsTuningGatewayV1;
}

const PRESET_LABELS: Readonly<Record<TuningPresetIdV1, string>> = {
  engine_default: "엔진 기본",
  stable: "안정형",
  responsive: "변화 민감형",
};

const WINDOW_LABELS: Readonly<Record<TrainingWindowV1, string>> = {
  expanding: "Expanding",
  rolling_104: "최근 104주",
  rolling_52: "최근 52주",
};

function humanizeParameter(key: string): string {
  return key.replaceAll("_", " ");
}

function normalizedTuningModelId(value: unknown): RiskModelId {
  return isRiskModelId(value) ? value : "sarimax";
}

export function TuningDrawer({
  open,
  initialModelId,
  history,
  acceptedByModel,
  routeCode,
  routeName,
  onClose,
  onSuccess,
  gateway,
}: TuningDrawerProps) {
  const safeInitialModelId = normalizedTuningModelId(initialModelId);
  const panelRef = useRef<HTMLDivElement>(null);
  const runSequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [modelId, setModelId] = useState<RiskModelId>(safeInitialModelId);
  const [preset, setPreset] = useState<TuningPresetIdV1 | "custom">("engine_default");
  const [trainingWindow, setTrainingWindow] = useState<TrainingWindowV1>("expanding");
  const [parameters, setParameters] = useState<Readonly<Record<string, TuneParameterValueV1>>>(() => defaultParameters(safeInitialModelId));
  const [session, setSession] = useState<TuningSessionStateV1>(() => createTuningSession(acceptedByModel[safeInitialModelId] ?? null));
  const [error, setError] = useState<string | null>(null);
  const status = session.status;

  useEffect(() => {
    if (!open) return;
    setModelId(safeInitialModelId);
    setPreset("engine_default");
    setParameters(defaultParameters(safeInitialModelId));
    setSession(createTuningSession(acceptedByModel[safeInitialModelId] ?? null));
    setError(null);
  }, [acceptedByModel, open, safeInitialModelId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    const main = document.querySelector<HTMLElement>("[data-models-main]");
    const previousOverflow = document.body.style.overflow;
    main?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status !== "running") onClose();
      if (event.key !== "Tab" || panelRef.current === null) return;
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")];
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
  }, [onClose, open, status]);

  if (!open) return null;

  const specs = MODEL_PARAMETER_SPECS[modelId] as Readonly<Record<string, ParameterSpecV1>>;
  const chooseModel = (next: RiskModelId) => {
    setModelId(next);
    setPreset("engine_default");
    setParameters(defaultParameters(next));
    setSession(createTuningSession(acceptedByModel[next] ?? null));
    setError(null);
  };
  const choosePreset = (next: TuningPresetIdV1) => {
    setPreset(next);
    setParameters(parametersForPreset(modelId, next));
    setSession(createTuningSession(acceptedByModel[modelId] ?? null));
    setError(null);
  };
  const changeParameter = (key: string, value: TuneParameterValueV1) => {
    setPreset("custom");
    setParameters((current) => ({ ...current, [key]: value }));
    setSession(createTuningSession(acceptedByModel[modelId] ?? null));
    setError(null);
  };
  const submit = async () => {
    let request: TuneRequestV1;
    try {
      validateParameters(modelId, parameters);
      request = createTuneRequest({
        routeCode,
        modelId,
        dates: history.map(({ date }) => date),
        values: history.map(({ value }) => value),
        trainingWindow,
        parameters,
      });
    } catch {
      setSession(createTuningSession(acceptedByModel[modelId] ?? null));
      setError("입력값이 허용 범위를 벗어났습니다. 매개변수 범위와 간격을 확인해 주세요.");
      return;
    }

    const runId = `models-tune-${Date.now()}-${runSequenceRef.current += 1}`;
    const running = startTuningRun(createTuningSession(acceptedByModel[modelId] ?? null), runId, request);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setSession(running);
    setError(null);
    try {
      const result = await runTuningGateway(request, controller.signal, gateway);
      const next = resolveTuningRun(running, runId, result.data);
      setSession(next);
      if (next.status === "success") {
        onSuccess(next, result.meta.mode);
      } else if (next.status === "error") {
        setError("재측정 결과를 검증하지 못했습니다. 기존 결과는 유지됩니다.");
      }
    } catch {
      const next = rejectTuningRun(running, runId, "재측정 엔진에 연결할 수 없습니다. 기존 결과는 유지됩니다.");
      setSession(next);
      setError(next.error);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return createPortal(
    <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target && status !== "running") onClose(); }}>
      <div aria-labelledby="tuning-title" aria-modal="true" className={styles.tuningDrawer} ref={panelRef} role="dialog">
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.liveEyebrow}>LIVE</p>
            <h2 id="tuning-title">고급설정</h2>
            <p>{routeName} · Python 예측엔진</p>
          </div>
          <button aria-label="고급설정 서랍 닫기" className={styles.iconButton} disabled={status === "running"} onClick={onClose} type="button">×</button>
        </header>
        <div className={styles.drawerBody}>
          <section className={styles.drawerSection}>
            <div className={styles.sectionNumber}>01</div>
            <div className={styles.drawerSectionBody}>
              <h3>재측정 모델</h3>
              <p>한 번에 한 모델을 다시 검증합니다.</p>
              <div className={styles.modelChoiceGrid}>
                {MODEL_REGISTRY.map((model) => (
                  <button aria-pressed={modelId === model.id} disabled={status === "running"} key={model.id} onClick={() => chooseModel(model.id)} type="button">
                    <span style={{ backgroundColor: model.color }} />{model.name}
                  </button>
                ))}
              </div>
              <div className={styles.segmented} aria-label="프리셋">
                {TUNING_PRESETS.map((item) => <button aria-pressed={preset === item} disabled={status === "running"} key={item} onClick={() => choosePreset(item)} type="button">{PRESET_LABELS[item]}</button>)}
              </div>
              {preset === "custom" ? <p className={styles.customState}>사용자 설정</p> : null}
            </div>
          </section>
          <section className={styles.drawerSection}>
            <div className={styles.sectionNumber}>02</div>
            <div className={styles.drawerSectionBody}>
              <h3>학습창</h3>
              <p>각 fold에서 모델이 볼 수 있는 과거 범위입니다.</p>
              <div className={styles.segmented} aria-label="학습창">
                {TRAINING_WINDOWS.map((item) => <button aria-pressed={trainingWindow === item} disabled={status === "running"} key={item} onClick={() => setTrainingWindow(item)} type="button">{WINDOW_LABELS[item]}</button>)}
              </div>
            </div>
          </section>
          <section className={styles.drawerSection}>
            <div className={styles.sectionNumber}>03</div>
            <div className={styles.drawerSectionBody}>
              <h3>하이퍼파라미터</h3>
              <p>허용 범위 안에서만 엔진에 전달됩니다.</p>
              {modelId === "naive" ? <div className={styles.parameterEmpty}>Naive는 마지막 실측값을 그대로 사용하는 기준모델이라 조정할 하이퍼파라미터가 없습니다.</div> : (
                <div className={styles.parameterGrid}>
                  {Object.entries(specs).map(([key, spec]) => (
                    <label key={key}>
                      <span>{humanizeParameter(key)}</span>
                      {spec.kind === "string" ? (
                        <select disabled={status === "running"} onChange={(event) => changeParameter(key, event.target.value)} value={String(parameters[key])}>
                          {spec.values.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      ) : (
                        <input disabled={status === "running"} max={spec.maximum} min={spec.minimum} onChange={(event) => changeParameter(key, Number(event.target.value))} step={spec.step} type="number" value={Number(parameters[key])} />
                      )}
                      {spec.kind === "number" ? <small>{spec.minimum}–{spec.maximum} · step {spec.step}</small> : null}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>
          <aside className={styles.validationCaution}>
            <strong>검증 주의</strong>
            <p>같은 외부평가 기록을 반복해 조정하면 과적합될 수 있습니다. 최종 배포 판단에는 별도의 최종 holdout이 필요하며, 재측정이 최적 성능을 보장하지 않습니다.</p>
          </aside>
          {status === "error" && error !== null ? <p className={styles.inlineError} role="alert">{error}</p> : null}
        </div>
        <footer className={styles.drawerFooter}>
          <button disabled={status === "running"} onClick={() => { setPreset("engine_default"); setParameters(defaultParameters(modelId)); setError(null); setSession(createTuningSession(acceptedByModel[modelId] ?? null)); }} type="button">기본값 복원</button>
          <button className={styles.primaryButton} disabled={status === "running"} onClick={() => void submit()} type="button">{status === "running" ? "실제 모델 계산 중…" : "재측정하고 반영"}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
