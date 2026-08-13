"use client";

import Link from "vinext/shims/link";
import { usePathname } from "vinext/shims/navigation";
import {
  useEffect,
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
import {
  SHARED_PAGE_METADATA,
  type WorkspacePageMetadata,
} from "./metadata";
import {
  WORKSPACE_PAGE_IDS,
  buildWorkspaceHref,
  type WorkspacePageId,
} from "./route-state";
import { useFreightRiskRoute } from "./use-freight-risk-route";

type ShellIconName = "ship" | WorkspacePageMetadata["icon"];

function ShellIcon({ name }: Readonly<{ name: ShellIconName }>) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (name === "layout-dashboard") {
    return (
      <svg {...common}>
        <rect height="9" rx="1" width="7" x="3" y="3" />
        <rect height="5" rx="1" width="7" x="14" y="3" />
        <rect height="9" rx="1" width="7" x="14" y="12" />
        <rect height="5" rx="1" width="7" x="3" y="16" />
      </svg>
    );
  }
  if (name === "bar-chart-3") {
    return (
      <svg {...common}>
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </svg>
    );
  }
  if (name === "globe-2") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 0 20" />
        <path d="M12 2a15.3 15.3 0 0 0 0 20" />
      </svg>
    );
  }
  if (name === "gauge") {
    return (
      <svg {...common}>
        <path d="m12 14 4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3v18" />
      <path d="M5 8h14l2 9H3l2-9Z" />
      <path d="M7 21c1.2-1 2.5-1.5 4-1.5s2.8.5 4 1.5" />
    </svg>
  );
}

function MenuIcon({ open }: Readonly<{ open: boolean }>) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (open) {
    return (
      <svg {...common}>
        <rect height="18" rx="2" width="18" x="3" y="3" />
        <path d="M9 3v18" />
        <path d="m16 15-3-3 3-3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

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
  const pathname = usePathname();
  const currentPageId = suppliedPageId ?? pageIdFromPathname(pathname);
  const [drawer, dispatchDrawer] = useReducer(
    reduceMobileDrawer,
    INITIAL_MOBILE_DRAWER_STATE,
  );
  const [mobileViewport, setMobileViewport] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    const body = document.body;
    const hadStyleAttribute = body.hasAttribute("style");
    const release = lockBodyScroll(body);
    return () => {
      release();
      if (!hadStyleAttribute) {
        const removeEmptyStyleAttribute = () => {
          if (body.hasAttribute("style") && body.style.length === 0) {
            body.removeAttribute("style");
          }
        };
        const observer = new MutationObserver(removeEmptyStyleAttribute);
        observer.observe(body, { attributes: true, attributeFilter: ["style"] });
        window.requestAnimationFrame(() => {
          removeEmptyStyleAttribute();
        });
        window.setTimeout(() => {
          removeEmptyStyleAttribute();
          observer.disconnect();
        }, 1_500);
      }
    };
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
        <Link
          className="workspace-brand"
          href={buildWorkspaceHref("dashboard", routeId)}
          onNavigate={() => dispatchDrawer({ type: "NAVIGATE" })}
        >
          <span className="workspace-brand-mark"><ShellIcon name="ship" /></span>
          <span className="workspace-brand-copy">
            <strong>해상운임 예측·운임 의사결정 플랫폼</strong>
            <small>MARITIME FREIGHT FORECASTING &amp; RATE DECISION PLATFORM</small>
          </span>
        </Link>
        <nav aria-label="워크스페이스" className="workspace-navigation">
          {WORKSPACE_PAGE_IDS.map((pageId) => {
            const item = SHARED_PAGE_METADATA[pageId];
            const active = pageId === currentPageId;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className="workspace-navigation-item"
                href={buildWorkspaceHref(pageId, routeId)}
                key={pageId}
                onNavigate={() => dispatchDrawer({ type: "NAVIGATE" })}
              >
                <span className="workspace-navigation-mark" aria-hidden="true">
                  <ShellIcon name={item.icon} />
                </span>
                <span className="workspace-navigation-label">{item.navLabel}</span>
              </Link>
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
              <MenuIcon open={drawer.open} />
            </button>
            <div className="workspace-header-copy">
              <span>{metadata.eyebrow}</span>
              <h1>{metadata.title}</h1>
              <p>{metadata.description}</p>
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
