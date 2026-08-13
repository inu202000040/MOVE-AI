"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

import {
  DEFAULT_ROUTE_ID,
  STORAGE_KEYS,
  isRouteId,
  type RouteId,
} from "../../contracts";
import {
  MOVE_AI_ROUTE_CHANGE_EVENT,
  commitRouteChange,
  planRouteHydration,
} from "./route-state";

interface RouteChangeDetail {
  readonly routeId: RouteId;
}

export interface FreightRiskRouteState {
  readonly routeId: RouteId;
  readonly changeRoute: (candidate: unknown) => boolean;
}

function readStoredRoute(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.route);
  } catch {
    return null;
  }
}

function publishRoute(routeId: RouteId): void {
  window.dispatchEvent(new CustomEvent<RouteChangeDetail>(
    MOVE_AI_ROUTE_CHANGE_EVENT,
    { detail: { routeId } },
  ));
}

export function useFreightRiskRoute(): FreightRiskRouteState {
  const [routeId, setRouteId] = useState<RouteId>(DEFAULT_ROUTE_ID);

  const reconcileLocation = useCallback(() => {
    const plan = planRouteHydration(window.location.href, readStoredRoute());

    if (plan.shouldPersist) {
      try {
        window.localStorage.setItem(STORAGE_KEYS.route, plan.routeId);
      } catch {
        // URL and in-memory route remain usable when storage is unavailable.
      }
    }

    if (plan.shouldReplaceUrl) {
      window.history.replaceState(window.history.state, "", plan.normalizedHref);
    }

    setRouteId(plan.routeId);
  }, []);

  useLayoutEffect(() => {
    reconcileLocation();
  }, [reconcileLocation]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.route) reconcileLocation();
    };
    const handlePopState = () => reconcileLocation();
    const handleRouteChange = (event: Event) => {
      const customEvent = event as CustomEvent<RouteChangeDetail>;
      if (isRouteId(customEvent.detail?.routeId)) {
        setRouteId(customEvent.detail.routeId);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener(MOVE_AI_ROUTE_CHANGE_EVENT, handleRouteChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(MOVE_AI_ROUTE_CHANGE_EVENT, handleRouteChange);
    };
  }, [reconcileLocation]);

  const changeRoute = useCallback((candidate: unknown): boolean => {
    if (!isRouteId(candidate)) return false;

    setRouteId(candidate);
    commitRouteChange(candidate, window.location.href, {
      store: (key, value) => window.localStorage.setItem(key, value),
      replace: (href) => window.history.replaceState(
        window.history.state,
        "",
        href,
      ),
      publish: publishRoute,
    });
    return true;
  }, []);

  return { routeId, changeRoute };
}
