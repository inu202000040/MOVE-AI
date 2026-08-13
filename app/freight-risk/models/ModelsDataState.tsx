"use client";

import styles from "./models.module.css";

export type ModelsDataStateKindV1 = "loading" | "empty" | "error";

const STATE_COPY: Readonly<Record<ModelsDataStateKindV1, Readonly<{ title: string; description: string }>>> = {
  loading: {
    title: "모델 데이터를 불러오는 중입니다.",
    description: "187주 실측과 8개 모델의 예측·평가 묶음을 확인하고 있습니다.",
  },
  empty: {
    title: "표시할 모델 결과가 없습니다.",
    description: "선택한 항로에 사용할 수 있는 모델 결과가 없습니다.",
  },
  error: {
    title: "모델 데이터를 불러오지 못했습니다.",
    description: "검증되지 않은 수치는 표시하지 않습니다. 다시 시도해 주세요.",
  },
};

export function ModelsDataState({ kind }: Readonly<{ kind: ModelsDataStateKindV1 }>) {
  const copy = STATE_COPY[kind];
  return (
    <div className={styles.page} data-models-main>
      <main className={styles.workspace}>
        <section className={`${styles.panel} ${styles.baseStatePanel}`} aria-busy={kind === "loading"}>
          <div className={styles.baseStateMessage}>
            <span aria-hidden="true" className={styles.baseStateMark} data-kind={kind} />
            <div><h2>{copy.title}</h2><p>{copy.description}</p></div>
            {kind === "error" ? <button className={styles.primaryButton} onClick={() => window.location.reload()} type="button">다시 시도</button> : null}
          </div>
          <div aria-hidden="true" className={styles.baseStateChart} />
          <div aria-hidden="true" className={styles.baseStateCards}>{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
        </section>
        <section className={`${styles.panel} ${styles.baseStateTable}`} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
        </section>
      </main>
    </div>
  );
}
