"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { RiskModelId } from "./core/types";
import styles from "./model-info-tooltip.module.css";

interface ModelInfoCopyV1 {
  readonly summary: string;
  readonly strength: string;
  readonly caution: string;
}

const MODEL_INFO: Readonly<Record<RiskModelId, ModelInfoCopyV1>> = {
  naive: {
    summary: "마지막 실측 운임을 미래 값으로 그대로 사용하는 기준모델입니다.",
    strength: "복잡한 모델이 단순 기준보다 실제로 나은지 비교하는 기준선입니다.",
    caution: "추세나 계절 변화를 반영하지 않으며 자동 대표모델 후보에서는 제외됩니다.",
  },
  sarimax: {
    summary: "최근 운임의 자기상관과 계절 패턴을 함께 추정하는 통계 시계열 모델입니다.",
    strength: "반복되는 주기와 점진적인 변화를 설명하고 계수 기반으로 해석하기 좋습니다.",
    caution: "급격한 구조 변화가 발생하면 새 패턴을 따라가는 데 시간이 걸릴 수 있습니다.",
  },
  lightgbm: {
    summary: "시차·이동 통계 등 입력 특징의 비선형 관계를 순차적으로 학습하는 부스팅 모델입니다.",
    strength: "복잡한 상호작용을 빠르게 포착하며 다양한 운임 국면에 유연하게 대응합니다.",
    caution: "짧은 구간의 잡음까지 학습하지 않도록 깊이와 학습률을 함께 관리해야 합니다.",
  },
  xgboost: {
    summary: "오차를 차례로 보완하는 규제 기반의 그래디언트 부스팅 모델입니다.",
    strength: "비선형 변화와 특징 간 상호작용을 정교하게 반영하는 데 적합합니다.",
    caution: "민감한 설정에서는 최근 급등락에 과도하게 반응할 수 있어 외부평가를 함께 봐야 합니다.",
  },
  random_forest: {
    summary: "여러 의사결정나무의 예측을 평균해 변동성을 낮추는 앙상블 모델입니다.",
    strength: "비선형 패턴에 강하고 일부 입력 변화나 이상치에 비교적 안정적입니다.",
    caution: "추세를 범위 밖으로 길게 외삽하는 능력은 제한적일 수 있습니다.",
  },
  prophet: {
    summary: "장기 추세와 반복 계절성을 분리해 전망하는 구조적 시계열 모델입니다.",
    strength: "추세·계절 성분을 직관적으로 설명하고 완만한 구조 변화를 표현하기 좋습니다.",
    caution: "단기 급변이나 복잡한 자기상관에서는 다른 모델보다 오차가 커질 수 있습니다.",
  },
  timesfm: {
    summary: "대규모 시계열로 사전학습된 패턴을 현재 운임 이력에 적용하는 기반 모델입니다.",
    strength: "별도의 복잡한 특징 설계 없이 다양한 시계열 패턴을 활용할 수 있습니다.",
    caution: "사전학습 분포와 실제 항로 국면이 다르면 성능이 흔들릴 수 있어 외부평가가 중요합니다.",
  },
  chronos: {
    summary: "연속 운임 값을 토큰화해 확률적 미래 경로를 생성하는 사전학습 시계열 모델입니다.",
    strength: "여러 가능한 미래 패턴을 폭넓게 학습한 표현을 활용할 수 있습니다.",
    caution: "도메인 변화와 입력 문맥 길이에 민감할 수 있으므로 오차와 Coverage를 함께 봐야 합니다.",
  },
};

interface ModelInfoTooltipProps {
  readonly modelId: RiskModelId;
  readonly modelName: string;
}

export function ModelInfoTooltip({ modelId, modelName }: ModelInfoTooltipProps) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const copy = MODEL_INFO[modelId];
  const open = !dismissed && (hovered || focused || pinned);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (button === null) return;
    const rect = button.getBoundingClientRect();
    if (window.innerWidth <= 640) {
      setPosition({ bottom: 18, left: 14, right: 14, width: "auto" });
      return;
    }
    const width = Math.min(330, window.innerWidth - 28);
    const left = Math.min(
      Math.max(14, rect.right - width + 8),
      window.innerWidth - width - 14,
    );
    const placeAbove = rect.top > 230 || rect.bottom + 210 > window.innerHeight - 14;
    setPosition({
      left,
      top: placeAbove ? rect.top - 10 : rect.bottom + 10,
      width,
      transform: placeAbove ? "translateY(-100%)" : undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const tooltip = open && position !== null
    ? createPortal(
      <span className={styles.tooltip} id={tooltipId} role="tooltip" style={position}>
        <span className={styles.eyebrow}>MODEL GUIDE</span>
        <strong>{modelName}</strong>
        <span>{copy.summary}</span>
        <span className={styles.facts}>
          <span><b>강점</b><span>{copy.strength}</span></span>
          <span><b>주의</b><span>{copy.caution}</span></span>
        </span>
      </span>,
      document.body,
    )
    : null;

  return (
    <span
      className={styles.root}
      data-pinned={pinned ? "true" : "false"}
      onMouseEnter={() => { setDismissed(false); setHovered(true); }}
      onMouseLeave={() => { setHovered(false); setDismissed(false); }}
    >
      <button
        aria-describedby={tooltipId}
        aria-expanded={pinned}
        aria-label={`${modelName} 모델 정보`}
        onBlur={() => { setFocused(false); setPinned(false); setDismissed(false); }}
        onClick={() => { setDismissed(false); setPinned((current) => !current); }}
        onFocus={() => { setDismissed(false); setFocused(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setPinned(false);
            setDismissed(true);
          }
        }}
        ref={buttonRef}
        type="button"
      >
        i
      </button>
      {tooltip}
    </span>
  );
}
