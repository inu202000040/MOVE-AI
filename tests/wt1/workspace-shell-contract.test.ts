import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  MOVE_AI_ROUTE_CHANGE_EVENT,
  SHARED_PAGE_METADATA,
} from "../../app/components/shell";

test("freezes the shared page metadata seam without page-owned rewrites", () => {
  assert.deepEqual(SHARED_PAGE_METADATA, {
    dashboard: {
      title: "메인 대시보드",
      eyebrow: "ROUTE MARKET OVERVIEW",
      description: "운임과 시장 신호를 한 화면에서 확인합니다.",
      shortTitle: "대시보드",
      shortDescription: "시장 신호와 1–4주 전망",
      navLabel: "Dashboard",
      mark: "D",
    },
    models: {
      title: "예측 모델 디테일",
      eyebrow: "MODEL VALIDATION",
      description: "8개 모델의 1~4주 전망과 시차별 검증 성능을 비교합니다.",
      shortTitle: "모델 분석",
      shortDescription: "8개 모델 비교와 대표모델 튜닝",
      navLabel: "Models",
      mark: "M",
    },
    network: {
      title: "글로벌 항만 네트워크",
      eyebrow: "PORT NETWORK OVERVIEW",
      description: "13개 노선의 대표 항만과 AIS 기반 물동량 신호를 탐색합니다.",
      shortTitle: "글로벌 네트워크",
      shortDescription: "3D 지구본 · 항로 · 항만 · 기상",
      navLabel: "Network",
      mark: "N",
    },
    allocation: {
      title: "선복물량 최적화",
      eyebrow: "CVAR ALLOCATION",
      description: "100,000개 운임경로를 고정운임·Spot 배분으로 전환합니다.",
      shortTitle: "물동량 최적화",
      shortDescription: "CVaR 기반 고정·Spot 권고비중",
      navLabel: "Allocation",
      mark: "A",
    },
  });
  assert.equal(MOVE_AI_ROUTE_CHANGE_EVENT, "move-ai:route-change");
});

test("keeps the client shell wired to the shared route and drawer lifecycle", async () => {
  const source = await readFile(
    path.resolve("app/components/shell/WorkspaceShell.tsx"),
    "utf8",
  );
  const routeHook = await readFile(
    path.resolve("app/components/shell/use-freight-risk-route.ts"),
    "utf8",
  );

  for (const requiredSource of [
    'matchMedia("(max-width: 900px)")',
    "lockBodyScroll(document.body)",
    'event.key === "Escape"',
    "window.requestAnimationFrame",
    "aria-expanded={drawer.open}",
    'aria-current={active ? "page" : undefined}',
    "buildWorkspaceHref(pageId, routeId)",
  ]) {
    assert.equal(source.includes(requiredSource), true, requiredSource);
  }

  for (const requiredSource of [
    "planRouteHydration(window.location.href, readStoredRoute())",
    "window.history.replaceState",
    "window.localStorage.setItem",
    "MOVE_AI_ROUTE_CHANGE_EVENT",
    'window.addEventListener("storage"',
    'window.addEventListener("popstate"',
  ]) {
    assert.equal(routeHook.includes(requiredSource), true, requiredSource);
  }
});
