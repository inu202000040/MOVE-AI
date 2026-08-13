"use client";

import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_ROUTE_ID,
  ROUTE_IDS,
  ROUTE_LABELS,
} from "../../contracts";
import { lockBodyScroll } from "./body-scroll-lock";
import {
  INITIAL_MOBILE_DRAWER_STATE,
  reduceMobileDrawer,
} from "./mobile-drawer-state";
import { SHARED_PAGE_METADATA } from "./metadata";
import {
  WORKSPACE_PAGE_IDS,
  buildWorkspaceHref,
  type WorkspacePageId,
} from "./route-state";
import { useFreightRiskRoute } from "./use-freight-risk-route";

export interface WorkspaceShellProps {
  readonly children: ReactNode;
  readonly pageId?: WorkspacePageId;
  readonly topbarActions?: ReactNode;
}

function pageIdFromPathname(pathname: string): WorkspacePageId {
  const candidate = pathname.split("/").filter(Boolean).at(-1);
  return WORKSPACE_PAGE_IDS.includes(candidate as WorkspacePageId)
    ? candidate as WorkspacePageId
    : "dashboard";
}

export function WorkspaceShell({
  children,
  pageId: suppliedPageId,
  topbarActions,
}: WorkspaceShellProps) {
  const { routeId, changeRoute } = useFreightRiskRoute();
  const [currentPageId, setCurrentPageId] = useState<WorkspacePageId>(
    suppliedPageId ?? "dashboard",
  );
  const [drawer, dispatchDrawer] = useReducer(
    reduceMobileDrawer,
    INITIAL_MOBILE_DRAWER_STATE,
  );
  const [mobileViewport, setMobileViewport] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!suppliedPageId) {
      setCurrentPageId(pageIdFromPathname(window.location.pathname));
    }
  }, [suppliedPageId]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const syncViewport = () => {
      setMobileViewport(media.matches);
      if (!media.matches) dispatchDrawer({ type: "UNMOUNT" });
    };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!drawer.open || !mobileViewport) return;
    return lockBodyScroll(document.body);
  }, [drawer.open, mobileViewport]);

  useEffect(() => {
    if (!drawer.open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatchDrawer({ type: "ESCAPE" });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawer.open]);

  useEffect(() => {
    if (drawer.focusTarget === "none") return;
    const frame = window.requestAnimationFrame(() => {
      menuButtonRef.current?.focus();
      dispatchDrawer({ type: "FOCUS_RESTORED" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [drawer.focusTarget]);

  const metadata = SHARED_PAGE_METADATA[currentPageId];
  const routeLabel = `${ROUTE_LABELS[routeId]} · ${routeId}`;

  return (
    <div className="workspace-shell" data-page={currentPageId}>
      <a className="skip-link" href="#workspace-content">본문으로 건너뛰기</a>
      <aside
        aria-label="해상운임 예측·운임 의사결정 플랫폼 페이지 메뉴"
        className="workspace-sidebar"
        data-open={drawer.open}
        id="workspace-sidebar"
      >
        <a
          className="workspace-brand"
          href={buildWorkspaceHref("dashboard", routeId)}
          onClick={() => dispatchDrawer({ type: "NAVIGATE" })}
        >
          <span className="workspace-brand-mark" aria-hidden="true">M</span>
          <span className="workspace-brand-copy">MOVE AI</span>
        </a>
        <nav aria-label="워크스페이스" className="workspace-navigation">
          {WORKSPACE_PAGE_IDS.map((pageId) => {
            const item = SHARED_PAGE_METADATA[pageId];
            const active = pageId === currentPageId;
            return (
              <a
                aria-current={active ? "page" : undefined}
                className="workspace-navigation-item"
                href={buildWorkspaceHref(pageId, routeId)}
                key={pageId}
                onClick={() => dispatchDrawer({ type: "NAVIGATE" })}
              >
                <span className="workspace-navigation-mark" aria-hidden="true">
                  {item.mark}
                </span>
                <span className="workspace-navigation-label">{item.navLabel}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="workspace-surface">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button
              aria-controls="workspace-sidebar"
              aria-expanded={drawer.open}
              aria-label="메뉴 열기"
              className="workspace-menu-button"
              onClick={() => dispatchDrawer({ type: "TOGGLE" })}
              ref={menuButtonRef}
              type="button"
            >
              메뉴
            </button>
            <div className="workspace-header-copy">
              <h1>{metadata.shortTitle}</h1>
              <p>{metadata.shortDescription}</p>
            </div>
          </div>
          <div className="workspace-header-actions">
            {topbarActions}
            <label className="workspace-route-select">
              <span className="sr-only">노선 선택</span>
              <select
                aria-label="노선 선택"
                onChange={(event) => changeRoute(event.currentTarget.value)}
                value={routeId ?? DEFAULT_ROUTE_ID}
              >
                {ROUTE_IDS.map((optionRouteId) => (
                  <option key={optionRouteId} value={optionRouteId}>
                    {ROUTE_LABELS[optionRouteId]} · {optionRouteId}
                  </option>
                ))}
              </select>
              <span aria-hidden="true" className="workspace-route-value">
                {routeLabel}
              </span>
            </label>
          </div>
        </header>
        <div className="workspace-content" id="workspace-content">
          {children}
        </div>
      </div>
    </div>
  );
}
