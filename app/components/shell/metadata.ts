import type { WorkspacePageId } from "./route-state";

export interface WorkspacePageMetadata {
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly navLabel: string;
  readonly icon: "layout-dashboard" | "bar-chart-3" | "globe-2" | "gauge";
}

export const SHARED_PAGE_METADATA: Readonly<
  Record<WorkspacePageId, WorkspacePageMetadata>
> = {
  dashboard: {
    title: "메인 대시보드",
    eyebrow: "ROUTE MARKET OVERVIEW",
    description: "운임과 시장 신호를 한 화면에서 확인합니다.",
    navLabel: "Dashboard",
    icon: "layout-dashboard",
  },
  models: {
    title: "예측 모델 디테일",
    eyebrow: "MODEL VALIDATION",
    description: "8개 모델의 1~4주 전망과 시차별 검증 성능을 비교합니다.",
    navLabel: "Models",
    icon: "bar-chart-3",
  },
  network: {
    title: "글로벌 항만 네트워크",
    eyebrow: "PORT NETWORK OVERVIEW",
    description: "13개 노선의 대표 항만과 AIS 기반 물동량 신호를 탐색합니다.",
    navLabel: "Network",
    icon: "globe-2",
  },
  allocation: {
    title: "선복물량 최적화",
    eyebrow: "CVAR ALLOCATION",
    description: "100,000개 운임경로를 고정운임·Spot 배분으로 전환합니다.",
    navLabel: "Allocation",
    icon: "gauge",
  },
};
