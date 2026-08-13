export { lockBodyScroll } from "./body-scroll-lock";
export type {
  BodyScrollTarget,
  ReleaseBodyScrollLock,
} from "./body-scroll-lock";
export {
  INITIAL_MOBILE_DRAWER_STATE,
  reduceMobileDrawer,
} from "./mobile-drawer-state";
export type {
  DrawerFocusTarget,
  MobileDrawerEvent,
  MobileDrawerState,
} from "./mobile-drawer-state";
export {
  MOVE_AI_ROUTE_CHANGE_EVENT,
  WORKSPACE_PAGE_IDS,
  buildWorkspaceHref,
  commitRouteChange,
  planRouteHydration,
  resolveRoute,
  setRouteQuery,
} from "./route-state";
export type {
  RouteChangeEffect,
  RouteChangeEffects,
  RouteChangeResult,
  RouteHydrationPlan,
  RouteResolution,
  RouteResolutionSource,
  WorkspacePageId,
} from "./route-state";
export { SHARED_PAGE_METADATA } from "./metadata";
export type { WorkspacePageMetadata } from "./metadata";
export { useFreightRiskRoute } from "./use-freight-risk-route";
export type { FreightRiskRouteState } from "./use-freight-risk-route";
export { WorkspaceShell } from "./WorkspaceShell";
export type { WorkspaceShellProps } from "./WorkspaceShell";
