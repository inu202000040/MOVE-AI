import {
  DEFAULT_ROUTE_ID,
  PAGE_PATHS,
  STORAGE_KEYS,
  isRouteId,
  type PageId,
  type RouteId,
} from "../../contracts";

export const WORKSPACE_PAGE_IDS = [
  "dashboard",
  "models",
  "network",
  "allocation",
] as const satisfies readonly PageId[];

export type WorkspacePageId = (typeof WORKSPACE_PAGE_IDS)[number];
export type RouteResolutionSource = "query" | "storage" | "default";

export interface RouteResolution {
  readonly routeId: RouteId;
  readonly source: RouteResolutionSource;
}

export interface RouteHydrationPlan extends RouteResolution {
  readonly normalizedHref: string;
  readonly shouldPersist: boolean;
  readonly shouldReplaceUrl: boolean;
}

export interface RouteChangeEffects {
  readonly store: (key: string, value: string) => void;
  readonly replace: (href: string) => void;
  readonly publish: (routeId: RouteId) => void;
}

export type RouteChangeEffect = "storage" | "url" | "notification";

export interface RouteChangeResult {
  readonly accepted: boolean;
  readonly routeId: RouteId | null;
  readonly href: string | null;
  readonly failedEffects: readonly RouteChangeEffect[];
}

export function resolveRoute(
  queryValue: unknown,
  storedValue: unknown,
): RouteResolution {
  if (isRouteId(queryValue)) {
    return { routeId: queryValue, source: "query" };
  }
  if (isRouteId(storedValue)) {
    return { routeId: storedValue, source: "storage" };
  }
  return { routeId: DEFAULT_ROUTE_ID, source: "default" };
}

export function setRouteQuery(currentHref: string, routeId: RouteId): string {
  const nextUrl = new URL(currentHref);
  nextUrl.searchParams.set("route", routeId);
  return nextUrl.href;
}

export function planRouteHydration(
  currentHref: string,
  storedValue: unknown,
): RouteHydrationPlan {
  const currentUrl = new URL(currentHref);
  const queryValue = currentUrl.searchParams.get("route");
  const resolution = resolveRoute(queryValue, storedValue);
  const normalizedHref = setRouteQuery(currentHref, resolution.routeId);

  return {
    ...resolution,
    normalizedHref,
    shouldPersist: storedValue !== resolution.routeId,
    shouldReplaceUrl: normalizedHref !== currentUrl.href,
  };
}

export function buildWorkspaceHref(
  pageId: WorkspacePageId,
  routeId: RouteId,
): string {
  const query = new URLSearchParams({ route: routeId });
  return `${PAGE_PATHS[pageId]}?${query.toString()}`;
}

export function commitRouteChange(
  candidate: unknown,
  currentHref: string,
  effects: RouteChangeEffects,
): RouteChangeResult {
  if (!isRouteId(candidate)) {
    return {
      accepted: false,
      routeId: null,
      href: null,
      failedEffects: [],
    };
  }

  const href = setRouteQuery(currentHref, candidate);
  const failedEffects: RouteChangeEffect[] = [];

  try {
    effects.store(STORAGE_KEYS.route, candidate);
  } catch {
    failedEffects.push("storage");
  }

  try {
    effects.replace(href);
  } catch {
    failedEffects.push("url");
  }

  try {
    effects.publish(candidate);
  } catch {
    failedEffects.push("notification");
  }

  return {
    accepted: true,
    routeId: candidate,
    href,
    failedEffects,
  };
}
