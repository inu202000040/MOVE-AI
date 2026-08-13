"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  DEFAULT_ROUTE_ID,
  isRouteId,
  type RouteId,
} from "../../contracts/routes";
import { STORAGE_KEYS } from "../../contracts/storage";

type MapLibrePaintProperty = Parameters<MapLibreMap["setPaintProperty"]>[1];

import {
  catalogToNetworkGeoJson,
  createNetworkFeatureStateController,
  createNetworkMapLayers,
  createNetworkMapPromotion,
  createRemoteFreeGlobeStyle,
  createRendererDiagnostics,
  declutterProjectedMarkers,
  DEFAULT_STATIC_VIEWPORT,
  INITIAL_RENDERER_STATE,
  moveNetworkFocusMode,
  NETWORK_HIT_LAYER_IDS,
  panStaticViewport,
  projectWebMercator,
  reduceNetworkSelection,
  reduceRendererState,
  resetStaticViewport,
  resolveNetworkPointerIntent,
  splitAntimeridian,
  startNetworkMapLibreGlobe,
  staticViewportToViewBox,
  visibleNetworkPanel,
  zoomStaticViewport,
  type NetworkFocusMode,
  type NetworkCatalogSeam,
  type NetworkMapLibreModule,
  type NetworkSelectionState,
  type RendererState,
  type StaticFallbackReason,
  type StaticViewport,
} from "./core";
import {
  APPROVED_REFERENCE_LABELS,
  createInterimNetworkRuntimeAdapters,
  resolveNetworkResource,
  type ChokepointStateV1,
  type NetworkCatalogAdapterResult,
  type NetworkResourceState,
  type PortStateV1,
  type WeatherStateV1,
} from "./data";

const MAP_PALETTE = {
  ocean: "#031827",
  sky: "#020b15",
  horizon: "#68d8ff",
  atmosphere: "#0d7dac",
  route: "#57d8f4",
  routeShadow: "#01111e",
  selection: "#ffb64c",
  chokepoint: "#ff8b46",
  port: "#eafcff",
  weatherNormal: "#5ad3ae",
  weatherWarning: "#ffbd4a",
  weatherSevere: "#ff5d62",
} as const;

const RUNTIME_ADAPTERS = createInterimNetworkRuntimeAdapters();
const ROUTE_CHANGE_EVENT = "move-ai:route-change";

function initialSelection(routeId: RouteId): NetworkSelectionState {
  return {
    navigationRouteId: routeId,
    portId: null,
    mapRouteId: routeId,
    chokepointId: null,
    weatherId: null,
    overlapRouteIds: [],
  };
}

type CatalogClientState =
  | { readonly status: "loading"; readonly attempt: number }
  | {
      readonly status: "ready";
      readonly attempt: number;
      readonly value: Extract<NetworkCatalogAdapterResult, { readonly state: "READY" }>;
    }
  | {
      readonly status: "error";
      readonly attempt: number;
      readonly value: Extract<
        NetworkCatalogAdapterResult,
        { readonly state: "UNAVAILABLE" }
      >;
    };

interface NetworkPageClientProps {
  readonly initialRouteId?: RouteId;
  readonly preferStoredRoute?: boolean;
}

const FALLBACK_LABELS: Readonly<Record<StaticFallbackReason, string>> = {
  WEBGL2_UNSUPPORTED: "WebGL2 미지원 · 2D 지도 모드",
  GPU_INIT_FAILED: "3D 가속 초기화 실패 · 2D 지도 모드",
  CONTEXT_LOST: "3D 그래픽 연결 끊김 · 2D 지도 모드",
};

function supportsWebGl2(): boolean {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2");
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return context !== null;
}

function activationKey<TElement extends SVGElement>(
  event: KeyboardEvent<TElement>,
  activate: () => void,
): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

function rendererLabel(state: RendererState): string {
  if (state.kind === "globe_ready") return "3D GLOBE";
  if (state.kind === "static2d") return FALLBACK_LABELS[state.reason];
  if (state.kind === "globe_blocked") return "3D GLOBE INITIALIZATION";
  return "3D GLOBE LOADING";
}

function resourceLabel<TState extends string>(
  resource: NetworkResourceState<unknown, TState>,
): string {
  if (resource.status === "ready" || resource.status === "empty") {
    return resource.result.state;
  }
  if (resource.status === "error") return "UNAVAILABLE";
  return "연결 확인 중";
}

function detailCloseLabel(kind: ReturnType<typeof visibleNetworkPanel>["kind"]): string {
  if (kind === "route") return "노선 정보 닫기";
  if (kind === "port") return "항만 물동량 정보 닫기";
  if (kind === "chokepoint") return "초크포인트 정보 닫기";
  if (kind === "weather") return "기상 정보 닫기";
  if (kind === "overlap") return "겹친 노선 목록 닫기";
  return "선택 정보 닫기";
}

interface StaticMapProps {
  readonly catalog: NetworkCatalogSeam;
  readonly viewport: StaticViewport;
  readonly onViewport: (viewport: StaticViewport) => void;
  readonly selection: NetworkSelectionState;
  readonly onRoute: (
    routeId: RouteId,
    trigger?: HTMLElement | SVGElement,
  ) => void;
  readonly onPort: (portId: string, trigger?: HTMLElement | SVGElement) => void;
  readonly onChokepoint: (
    chokepointId: string,
    trigger?: HTMLElement | SVGElement,
  ) => void;
  readonly onWeather: (
    weatherId: string,
    trigger?: HTMLElement | SVGElement,
  ) => void;
}

function StaticNetworkMap({
  catalog,
  viewport,
  onViewport,
  selection,
  onRoute,
  onPort,
  onChokepoint,
  onWeather,
}: StaticMapProps) {
  const dragRef = useRef<{ x: number; y: number; viewport: StaticViewport } | null>(null);
  const routeSegments = useMemo(
    () =>
      catalog.routes.map((route) => ({
        route,
        segments: splitAntimeridian(route.waypointCoordinates).map((segment) =>
          segment.map((coordinate) => projectWebMercator(coordinate, 1000, 500)),
        ),
      })),
    [catalog],
  );
  const markerPositions = useMemo(
    () =>
      new Map(
        declutterProjectedMarkers(
          [
            ...catalog.ports.map((port) => ({
              id: `port:${port.id}`,
              ...projectWebMercator([port.longitude, port.latitude], 1000, 500),
            })),
            ...catalog.chokepoints.map((chokepoint) => ({
              id: `chokepoint:${chokepoint.id}`,
              ...projectWebMercator(
                [chokepoint.longitude, chokepoint.latitude],
                1000,
                500,
              ),
            })),
            ...catalog.weather.map((weather) => ({
              id: `weather:${weather.id}`,
              ...projectWebMercator(
                [weather.longitude, weather.latitude],
                1000,
                500,
              ),
            })),
          ],
          11,
          34,
        ).map((position) => [position.id, position]),
      ),
    [catalog],
  );

  const beginPan = (event: PointerEvent<SVGSVGElement>): void => {
    if ((event.target as Element).closest("[role=button]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, viewport };
  };
  const movePan = (event: PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current;
    if (!drag) return;
    const scaleX = drag.viewport.width / event.currentTarget.clientWidth;
    const scaleY = drag.viewport.height / event.currentTarget.clientHeight;
    onViewport(
      panStaticViewport(
        drag.viewport,
        (event.clientX - drag.x) * scaleX,
        (event.clientY - drag.y) * scaleY,
      ),
    );
  };

  return (
    <div className="network-static-map" data-static-map="true">
      <svg
        aria-label="2D 글로벌 항만 네트워크"
        className="network-static-map__svg"
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        viewBox={staticViewportToViewBox(viewport)}
      >
        <defs>
          <radialGradient id="network-ocean-glow">
            <stop offset="0" stopColor="#103f59" />
            <stop offset="1" stopColor="#031827" />
          </radialGradient>
          <filter id="network-route-glow">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="1000" height="500" fill="url(#network-ocean-glow)" />
        {Array.from({ length: 13 }, (_, index) => (
          <line
            className="network-static-map__grid"
            key={`vertical-${index}`}
            x1={index * 83.333}
            x2={index * 83.333}
            y1="0"
            y2="500"
          />
        ))}
        {Array.from({ length: 7 }, (_, index) => (
          <line
            className="network-static-map__grid"
            key={`horizontal-${index}`}
            x1="0"
            x2="1000"
            y1={index * 83.333}
            y2={index * 83.333}
          />
        ))}
        {routeSegments.map(({ route, segments }) => {
          if (!isRouteId(route.id)) return null;
          const routeId = route.id;
          return (
            <g
              aria-label={`${APPROVED_REFERENCE_LABELS.routes[routeId]?.ko ?? routeId} 노선`}
              className={
                selection.mapRouteId === routeId
                  ? "network-static-map__route is-selected"
                  : "network-static-map__route"
              }
              key={routeId}
              onClick={(event) => onRoute(routeId, event.currentTarget)}
              onKeyDown={(event) =>
                activationKey(event, () => onRoute(routeId, event.currentTarget))
              }
              role="button"
              tabIndex={0}
            >
              {segments.map((segment, index) => (
                <polyline
                  key={`${routeId}-${index}`}
                  points={segment.map(({ x, y }) => `${x},${y}`).join(" ")}
                />
              ))}
            </g>
          );
        })}
        {catalog.chokepoints.map((chokepoint) => {
          const point = markerPositions.get(`chokepoint:${chokepoint.id}`);
          if (!point) return null;
          const activate = (trigger?: HTMLElement | SVGElement) =>
            onChokepoint(chokepoint.id, trigger);
          return (
            <g
              aria-label={
                APPROVED_REFERENCE_LABELS.chokepoints[chokepoint.id]?.ko ??
                chokepoint.id
              }
              className={
                selection.chokepointId === chokepoint.id
                  ? "network-static-map__choke is-selected"
                  : "network-static-map__choke"
              }
              key={chokepoint.id}
              onClick={(event) => activate(event.currentTarget)}
              onKeyDown={(event) =>
                activationKey(event, () => activate(event.currentTarget))
              }
              role="button"
              tabIndex={0}
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle className="network-static-map__hit" r="16" />
              <circle r="5" />
            </g>
          );
        })}
        {catalog.ports.map((port) => {
          const point = markerPositions.get(`port:${port.id}`);
          if (!point) return null;
          const activate = (trigger?: HTMLElement | SVGElement) =>
            onPort(port.id, trigger);
          return (
            <g
              aria-label={`${APPROVED_REFERENCE_LABELS.ports[port.id]?.ko ?? port.id}, ${port.routeId} 노선`}
              className={
                selection.portId === port.id
                  ? "network-static-map__port is-selected"
                  : "network-static-map__port"
              }
              key={port.id}
              onClick={(event) => activate(event.currentTarget)}
              onKeyDown={(event) =>
                activationKey(event, () => activate(event.currentTarget))
              }
              role="button"
              tabIndex={0}
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle className="network-static-map__hit" r="13" />
              <circle r={port.primary ? 6 : 4.5} />
            </g>
          );
        })}
        {catalog.weather.map((weather) => {
          const point = markerPositions.get(`weather:${weather.id}`);
          if (!point) return null;
          const activate = (trigger?: HTMLElement | SVGElement) =>
            onWeather(weather.id, trigger);
          return (
            <g
              aria-label={`${APPROVED_REFERENCE_LABELS.weather[weather.id]?.ko ?? weather.id} 기상`}
              className={
                selection.weatherId === weather.id
                  ? "network-static-map__weather is-selected"
                  : "network-static-map__weather"
              }
              key={weather.id}
              onClick={(event) => activate(event.currentTarget)}
              onKeyDown={(event) =>
                activationKey(event, () => activate(event.currentTarget))
              }
              role="button"
              tabIndex={0}
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle className="network-static-map__hit" r="10" />
              <path d="M 0 -4 L 4 0 L 0 4 L -4 0 Z" />
            </g>
          );
        })}
      </svg>
      <div aria-label="2D 지도 조작" className="network-static-map__controls">
        <button
          aria-label="확대"
          onClick={() => onViewport(zoomStaticViewport(viewport, 1.3, 500, 250))}
          type="button"
        >
          +
        </button>
        <button
          aria-label="축소"
          onClick={() => onViewport(zoomStaticViewport(viewport, 1 / 1.3, 500, 250))}
          type="button"
        >
          −
        </button>
        <button onClick={() => onViewport(resetStaticViewport())} type="button">
          Reset
        </button>
      </div>
      <p className="network-map-footer">드래그 이동 · 표식 클릭은 상세 정보</p>
    </div>
  );
}

export function NetworkPageClient({
  initialRouteId = DEFAULT_ROUTE_ID,
  preferStoredRoute = true,
}: NetworkPageClientProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectionTriggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const publishingRouteEventRef = useRef(false);
  const focusButtonRefs = useRef(
    new Map<NetworkFocusMode, HTMLButtonElement>(),
  );
  const featureStateRef = useRef<ReturnType<typeof createNetworkFeatureStateController> | null>(
    null,
  );
  const [renderer, dispatchRenderer] = useReducer(reduceRendererState, INITIAL_RENDERER_STATE);
  const [selection, dispatchSelection] = useReducer(
    reduceNetworkSelection,
    initialSelection(initialRouteId),
  );
  const [focusMode, setFocusMode] = useState<NetworkFocusMode>("combined");
  const [viewport, setViewport] = useState(DEFAULT_STATIC_VIEWPORT);
  const [legendOpen, setLegendOpen] = useState(false);
  const [routeReconciled, setRouteReconciled] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [gatewayAttempt, setGatewayAttempt] = useState(0);
  const [catalogResource, setCatalogResource] = useState<CatalogClientState>({
    status: "loading",
    attempt: 0,
  });
  const [portResource, setPortResource] = useState<
    NetworkResourceState<unknown, PortStateV1>
  >({ status: "idle" });
  const [chokepointResource, setChokepointResource] = useState<
    NetworkResourceState<unknown, ChokepointStateV1>
  >({ status: "idle" });
  const [weatherResource, setWeatherResource] = useState<
    NetworkResourceState<unknown, WeatherStateV1>
  >({ status: "idle" });
  const [portDetailResource, setPortDetailResource] = useState<
    NetworkResourceState<unknown, PortStateV1>
  >({ status: "idle" });
  const [chokepointDetailResource, setChokepointDetailResource] = useState<
    NetworkResourceState<unknown, ChokepointStateV1>
  >({ status: "idle" });
  const [diagnosticCode, setDiagnosticCode] = useState("BOOT");
  const [webGl2Capability, setWebGl2Capability] = useState<
    "pending" | "supported" | "unsupported"
  >("pending");
  const [projection, setProjection] = useState<"pending" | "globe" | "static2d">(
    "pending",
  );
  const [globeLoadState, setGlobeLoadState] = useState<"idle" | "style-ready" | "loaded">(
    "idle",
  );
  const [mapLibreVersion, setMapLibreVersion] = useState("pending");
  const catalog =
    catalogResource.status === "ready" ? catalogResource.value.catalog : null;
  const sources = useMemo(
    () => (catalog ? catalogToNetworkGeoJson(catalog) : null),
    [catalog],
  );
  const layers = useMemo(() => createNetworkMapLayers(MAP_PALETTE), []);
  const panel = visibleNetworkPanel(selection);
  const selectedRoute =
    panel.kind === "route"
      ? catalog?.routes.find(({ id }) => id === panel.id) ?? null
      : null;
  const selectedPort =
    panel.kind === "port"
      ? catalog?.ports.find(({ id }) => id === panel.id) ?? null
      : null;
  const selectedChokepoint =
    panel.kind === "chokepoint"
      ? catalog?.chokepoints.find(({ id }) => id === panel.id) ?? null
      : null;
  const selectedWeather =
    panel.kind === "weather"
      ? catalog?.weather.find(({ id }) => id === panel.id) ?? null
      : null;

  const selectRoute = useCallback(
    (routeId: RouteId, trigger?: HTMLElement | SVGElement): void => {
      if (trigger) selectionTriggerRef.current = trigger;
      dispatchSelection({ type: "CHANGE_NAVIGATION_ROUTE", routeId });
      dispatchSelection({ type: "SELECT_ROUTE", routeId });
      const route = catalog?.routes.find(({ id }) => id === routeId);
      const center = route?.waypointCoordinates[
        Math.floor(route.waypointCoordinates.length / 2)
      ];
      mapRef.current?.easeTo({
        center: center ? [...center] : [126.2, 27.5],
        zoom: 1.55,
        duration: 800,
      });
    },
    [catalog],
  );
  const selectPort = useCallback((
    portId: string,
    trigger?: HTMLElement | SVGElement,
  ): void => {
    if (trigger) selectionTriggerRef.current = trigger;
    const port = catalog?.ports.find(({ id }) => id === portId);
    if (!port) return;
    dispatchSelection({ type: "CHANGE_NAVIGATION_ROUTE", routeId: port.routeId });
    dispatchSelection({ type: "SELECT_PORT", portId, routeId: port.routeId });
    if (port) {
      mapRef.current?.easeTo({ center: [port.longitude, port.latitude], zoom: 4.6, duration: 700 });
    }
  }, [catalog]);
  const selectChokepoint = useCallback((
    chokepointId: string,
    trigger?: HTMLElement | SVGElement,
  ): void => {
    if (trigger) selectionTriggerRef.current = trigger;
    dispatchSelection({ type: "SELECT_CHOKEPOINT", chokepointId });
    const chokepoint = catalog?.chokepoints.find(
      ({ id }) => id === chokepointId,
    );
    if (chokepoint) {
      mapRef.current?.easeTo({
        center: [chokepoint.longitude, chokepoint.latitude],
        zoom: 4,
        duration: 700,
      });
    }
  }, [catalog]);

  const selectWeather = useCallback((
    weatherId: string,
    trigger?: HTMLElement | SVGElement,
  ): void => {
    if (trigger) selectionTriggerRef.current = trigger;
    dispatchSelection({ type: "SELECT_WEATHER", weatherId });
    const weather = catalog?.weather.find(({ id }) => id === weatherId);
    if (weather) {
      mapRef.current?.easeTo({
        center: [weather.longitude, weather.latitude],
        zoom: 4.2,
        duration: 650,
      });
    }
  }, [catalog]);

  const closeDetail = useCallback((): void => {
    dispatchSelection({
      type: panel.kind === "weather" ? "CLOSE_WEATHER" : "CLOSE_DETAIL",
    });
    queueMicrotask(() => selectionTriggerRef.current?.focus());
  }, [panel.kind]);

  const resetView = useCallback((): void => {
    setViewport(resetStaticViewport());
    mapRef.current?.easeTo({ center: [126.2, 27.5], zoom: 1.42, bearing: -7, duration: 700 });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const attempt = catalogAttempt + 1;
    setCatalogResource({ status: "loading", attempt });
    void RUNTIME_ADAPTERS.catalog.load(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.state === "READY") {
        setCatalogResource({ status: "ready", attempt, value: result });
        return;
      }
      setCatalogResource({ status: "error", attempt, value: result });
    });
    return () => controller.abort();
  }, [catalogAttempt]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    const attempt = gatewayAttempt + 1;
    setPortResource({ status: "loading", attempt });
    setChokepointResource({ status: "loading", attempt });
    setWeatherResource({ status: "loading", attempt });

    void RUNTIME_ADAPTERS.gateway.portSummary(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setPortResource(resolveNetworkResource(result, attempt));
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setPortResource({
            status: "error",
            attempt,
            result: null,
            retryable: true,
            message: "데이터를 불러올 수 없습니다.",
          });
        }
      },
    );
    void RUNTIME_ADAPTERS.gateway.chokeSummary(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setChokepointResource(resolveNetworkResource(result, attempt));
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setChokepointResource({
            status: "error",
            attempt,
            result: null,
            retryable: true,
            message: "데이터를 불러올 수 없습니다.",
          });
        }
      },
    );
    void RUNTIME_ADAPTERS.gateway.weather(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          setWeatherResource(resolveNetworkResource(result, attempt));
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setWeatherResource({
            status: "error",
            attempt,
            result: null,
            retryable: true,
            message: "데이터를 불러올 수 없습니다.",
          });
        }
      },
    );
    return () => controller.abort();
  }, [catalog, gatewayAttempt]);

  useEffect(() => {
    if (!selectedPort) {
      setPortDetailResource({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const attempt = gatewayAttempt + 1;
    setPortDetailResource({ status: "loading", attempt });
    void RUNTIME_ADAPTERS.gateway
      .portDetail({ id: selectedPort.id, days: 90 }, controller.signal)
      .then(
        (result) => {
          if (!controller.signal.aborted) {
            setPortDetailResource(resolveNetworkResource(result, attempt));
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setPortDetailResource({
              status: "error",
              attempt,
              result: null,
              retryable: true,
              message: "데이터를 불러올 수 없습니다.",
            });
          }
        },
      );
    return () => controller.abort();
  }, [gatewayAttempt, selectedPort]);

  useEffect(() => {
    if (!selectedChokepoint) {
      setChokepointDetailResource({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const attempt = gatewayAttempt + 1;
    setChokepointDetailResource({ status: "loading", attempt });
    void RUNTIME_ADAPTERS.gateway
      .chokeDetail({ id: selectedChokepoint.id }, controller.signal)
      .then(
        (result) => {
          if (!controller.signal.aborted) {
            setChokepointDetailResource(resolveNetworkResource(result, attempt));
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setChokepointDetailResource({
              status: "error",
              attempt,
              result: null,
              retryable: true,
              message: "데이터를 불러올 수 없습니다.",
            });
          }
        },
      );
    return () => controller.abort();
  }, [gatewayAttempt, selectedChokepoint]);

  useEffect(() => {
    const queryRoute = new URL(window.location.href).searchParams.get("route");
    let routeId = isRouteId(queryRoute) ? queryRoute : initialRouteId;
    if (!isRouteId(queryRoute) && preferStoredRoute) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEYS.route);
        if (isRouteId(stored)) routeId = stored;
      } catch {
        // URL/default route remains authoritative when storage is unavailable.
      }
    }
    dispatchSelection({ type: "CHANGE_NAVIGATION_ROUTE", routeId });
    dispatchSelection({ type: "SELECT_ROUTE", routeId });
    setRouteReconciled(true);
  }, [initialRouteId, preferStoredRoute]);

  useEffect(() => {
    if (!routeReconciled) return;
    const routeId = selection.navigationRouteId;
    if (!isRouteId(routeId)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("route", routeId);
    window.history.replaceState(window.history.state, "", url);
    try {
      window.localStorage.setItem(STORAGE_KEYS.route, routeId);
    } catch {
      // URL state remains usable when storage is unavailable.
    }
    publishingRouteEventRef.current = true;
    try {
      window.dispatchEvent(
        new CustomEvent(ROUTE_CHANGE_EVENT, { detail: { routeId } }),
      );
    } finally {
      publishingRouteEventRef.current = false;
    }
  }, [routeReconciled, selection.navigationRouteId]);

  useEffect(() => {
    const applyUrlRoute = (): void => {
      const routeId = new URL(window.location.href).searchParams.get("route");
      if (isRouteId(routeId)) {
        dispatchSelection({ type: "CHANGE_NAVIGATION_ROUTE", routeId });
        dispatchSelection({ type: "SELECT_ROUTE", routeId });
      }
    };
    const applySharedRoute = (event: Event): void => {
      if (publishingRouteEventRef.current) return;
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (
        typeof detail === "object" &&
        detail !== null &&
        "routeId" in detail &&
        isRouteId(detail.routeId)
      ) {
        dispatchSelection({ type: "CHANGE_NAVIGATION_ROUTE", routeId: detail.routeId });
        dispatchSelection({ type: "SELECT_ROUTE", routeId: detail.routeId });
      }
    };
    window.addEventListener("popstate", applyUrlRoute);
    window.addEventListener(ROUTE_CHANGE_EVENT, applySharedRoute);
    return () => {
      window.removeEventListener("popstate", applyUrlRoute);
      window.removeEventListener(ROUTE_CHANGE_EVENT, applySharedRoute);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape" && visibleNetworkPanel(selection).kind !== "none") {
        closeDetail();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeDetail, selection]);

  useEffect(() => {
    featureStateRef.current?.apply(selection);
  }, [selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || renderer.kind !== "globe_ready") return;
    const routesPrimary = focusMode !== "chokepoints";
    const chokesPrimary = focusMode !== "routes";
    const paintUpdates: readonly [string, MapLibrePaintProperty, number][] = [
      ["network-route-shadow", "line-opacity", routesPrimary ? 0.72 : 0.16],
      ["network-route-line", "line-opacity", routesPrimary ? 0.9 : 0.28],
      ["network-connector-line", "line-opacity", routesPrimary ? 0.46 : 0.18],
      ["network-port-marker", "circle-opacity", routesPrimary ? 1 : 0.38],
      ["network-chokepoint-corridor-halo", "line-opacity", chokesPrimary ? 0.16 : 0.05],
      ["network-chokepoint-corridor", "line-opacity", chokesPrimary ? 0.78 : 0.25],
      ["network-chokepoint-gate", "line-opacity", chokesPrimary ? 0.84 : 0.3],
      ["network-chokepoint-center", "circle-opacity", chokesPrimary ? 1 : 0.38],
    ];
    for (const [layerId, property, value] of paintUpdates) {
      try {
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value);
      } catch {
        dispatchRenderer({ type: "DEGRADE", degradation: "CATALOG_UNAVAILABLE" });
      }
    }
  }, [focusMode, renderer.kind]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !sources) return;
    let disposed = false;
    let loadReported = false;
    let controller: ReturnType<typeof startNetworkMapLibreGlobe> = null;
    dispatchRenderer({ type: "START" });
    setProjection("pending");
    setGlobeLoadState("idle");
    setMapLibreVersion("pending");
    setDiagnosticCode("BOOT");
    const diagnostics = createRendererDiagnostics();

    const start = async (): Promise<void> => {
      const webGl2Supported = supportsWebGl2();
      setWebGl2Capability(webGl2Supported ? "supported" : "unsupported");
      if (!webGl2Supported) {
        setProjection("static2d");
        setDiagnosticCode("WEBGL2_UNSUPPORTED");
        dispatchRenderer({ type: "FALLBACK", reason: "WEBGL2_UNSUPPORTED" });
        return;
      }
      const [mapLibre, workerAsset] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
      ]);
      if (disposed) return;

      const promotion = createNetworkMapPromotion({
        sources,
        layers,
        createNavigationControl: () =>
          new mapLibre.NavigationControl({ showCompass: true, showZoom: true }),
        createScaleControl: () => new mapLibre.ScaleControl({ maxWidth: 110, unit: "nautical" }),
        installInteractions: () => undefined,
        exposeMap: (candidate) => {
          const map = candidate as MapLibreMap;
          mapRef.current = map;
          const markLoaded = (): void => {
            if (disposed || loadReported) return;
            loadReported = true;
            setGlobeLoadState("loaded");
            setDiagnosticCode("GLOBE_LOADED");
          };
          map.once("load", markLoaded);
          if (map.loaded()) queueMicrotask(markLoaded);
          featureStateRef.current = createNetworkFeatureStateController(map, () => {
            dispatchRenderer({ type: "DEGRADE", degradation: "CATALOG_UNAVAILABLE" });
          });
          map.on("click", (event) => {
            const features = map.queryRenderedFeatures(event.point, {
              layers: [...NETWORK_HIT_LAYER_IDS],
            });
            const hits = {
              weather: features
                .filter(({ layer }) => layer.id === "network-weather-hit")
                .map((feature, index) => ({
                  id: String(feature.properties?.weatherId ?? feature.id ?? ""),
                  distance: index,
                  explicitTarget: true,
                  visualOrder: features.length - index,
                })),
              ports: features
                .filter(({ layer }) => layer.id === "network-port-hit")
                .map((feature, index) => ({
                  id: String(feature.properties?.portId ?? feature.id ?? ""),
                  distance: index,
                  explicitTarget: true,
                  visualOrder: features.length - index,
                })),
              chokepoints: features
                .filter(({ layer }) =>
                  layer.id === "network-chokepoint-corridor-hit" ||
                  layer.id === "network-chokepoint-center-hit",
                )
                .map((feature, index) => ({
                  id: String(feature.properties?.chokepointId ?? feature.id ?? ""),
                  distance: index,
                  explicitTarget: true,
                  visualOrder: features.length - index,
                })),
              routeIds: features
                .filter(({ layer }) => layer.id === "network-route-hit")
                .map((feature) => String(feature.properties?.routeId ?? feature.id ?? "")),
            };
            const intent = resolveNetworkPointerIntent(hits);
            if (intent.kind === "weather") selectWeather(intent.id);
            if (intent.kind === "port") selectPort(intent.id);
            if (intent.kind === "chokepoint") selectChokepoint(intent.id);
            if (intent.kind === "route" && isRouteId(intent.id)) {
              selectRoute(intent.id);
            }
            if (intent.kind === "overlap") {
              dispatchSelection({ type: "SHOW_OVERLAP", routeIds: intent.routeIds });
            }
          });
        },
        onDegradation: ({ stage }) => {
          setDiagnosticCode(`DEGRADED_${stage.toUpperCase()}`);
        },
      });
      const runtimeModule = {
        createMap: (options) =>
          new mapLibre.Map({
            ...options,
            center: [...options.center],
          }),
        setWorkerUrl: mapLibre.setWorkerUrl,
        getVersion: mapLibre.getVersion,
      } satisfies NetworkMapLibreModule;

      controller = startNetworkMapLibreGlobe({
        module: runtimeModule,
        container: host,
        style: createRemoteFreeGlobeStyle(MAP_PALETTE),
        workerUrl: workerAsset.default,
        currentUrl: window.location.href,
        webGl2Supported: true,
        promotion,
        diagnostics,
        onReady: (map, version) => {
          if (disposed) return;
          setMapLibreVersion(version);
          setProjection(map.getProjection().type === "globe" ? "globe" : "pending");
          setGlobeLoadState("style-ready");
          setDiagnosticCode("GLOBE_READY");
          dispatchRenderer({ type: "READY" });
        },
        onFallback: (reason) => {
          if (disposed) return;
          setProjection("static2d");
          setGlobeLoadState("idle");
          setDiagnosticCode(reason);
          dispatchRenderer({ type: "FALLBACK", reason });
        },
        onPromotionFailure: () => {
          if (disposed) return;
          setProjection("pending");
          setDiagnosticCode("GLOBE_PROMOTION_FAILED");
          dispatchRenderer({ type: "PROMOTION_FAILED" });
        },
        onRecoverableError: () => {
          if (disposed) return;
          dispatchRenderer({ type: "DEGRADE", degradation: "BASEMAP_UNAVAILABLE" });
        },
      });
    };
    void start().catch(() => {
      if (disposed) return;
      setDiagnosticCode("GLOBE_PROMOTION_FAILED");
      dispatchRenderer({ type: "PROMOTION_FAILED" });
    });

    return () => {
      disposed = true;
      featureStateRef.current?.dispose();
      featureStateRef.current = null;
      mapRef.current = null;
      controller?.dispose();
    };
  }, [
    layers,
    rendererAttempt,
    selectChokepoint,
    selectPort,
    selectRoute,
    selectWeather,
    sources,
  ]);

  const staticMode = renderer.kind === "static2d";
  return (
    <main
      aria-label="글로벌 항만 네트워크"
      className="network-page"
      data-catalog-mode={
        catalogResource.status === "ready" ? catalogResource.value.mode : "unavailable"
      }
      data-catalog-state={catalogResource.status}
      data-chokepoint-state={resourceLabel(chokepointResource)}
      data-focus-mode={focusMode}
      data-globe-load-state={globeLoadState}
      data-maplibre-version={mapLibreVersion}
      data-projection={projection}
      data-renderer-stage={renderer.kind}
      data-renderer-diagnostic={diagnosticCode}
      data-port-state={resourceLabel(portResource)}
      data-route-id={selection.navigationRouteId}
      data-weather-state={resourceLabel(weatherResource)}
      data-webgl2-supported={webGl2Capability}
    >
      <div aria-hidden={staticMode} className="network-map-host" ref={hostRef} />
      {staticMode && catalog ? (
        <StaticNetworkMap
          catalog={catalog}
          onChokepoint={selectChokepoint}
          onPort={selectPort}
          onRoute={selectRoute}
          onViewport={setViewport}
          onWeather={selectWeather}
          selection={selection}
          viewport={viewport}
        />
      ) : null}
      {renderer.kind === "globe_ready" ? (
        <p className="network-map-footer">드래그 회전 · 표식 클릭은 상세 정보</p>
      ) : null}

      <header className="network-header">
        <div>
          <p className="network-eyebrow">
            GLOBAL PORT NETWORK · {selection.navigationRouteId}
          </p>
          <h1>글로벌 항만 네트워크</h1>
        </div>
        <span className="network-renderer-status">{rendererLabel(renderer)}</span>
      </header>

      <section aria-label="네트워크 작업 도구" className="network-actions">
        <div aria-label="Focus mode" className="network-focus" role="radiogroup">
          {(["routes", "chokepoints", "combined"] as const).map((mode) => (
            <button
              aria-checked={focusMode === mode}
              className={focusMode === mode ? "is-active" : undefined}
              key={mode}
              onClick={() => setFocusMode(mode)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  const next = moveNetworkFocusMode(mode, "next");
                  setFocusMode(next);
                  queueMicrotask(() => focusButtonRefs.current.get(next)?.focus());
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const previous = moveNetworkFocusMode(mode, "previous");
                  setFocusMode(previous);
                  queueMicrotask(() =>
                    focusButtonRefs.current.get(previous)?.focus(),
                  );
                }
              }}
              ref={(element) => {
                if (element) focusButtonRefs.current.set(mode, element);
                else focusButtonRefs.current.delete(mode);
              }}
              role="radio"
              tabIndex={focusMode === mode ? 0 : -1}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
        <button className="network-reset" onClick={resetView} type="button">
          Reset
        </button>
      </section>

      {catalog ? (
        <nav aria-label="네트워크 항목 탐색" className="network-explorer">
          <label>
            노선
            <select
              onChange={(event) => {
                if (isRouteId(event.currentTarget.value)) {
                  selectRoute(event.currentTarget.value, event.currentTarget);
                }
              }}
              value={selection.navigationRouteId}
            >
              {catalog.routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.id} · {APPROVED_REFERENCE_LABELS.routes[route.id]?.ko ?? route.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            항만
            <select
              onChange={(event) =>
                selectPort(event.currentTarget.value, event.currentTarget)
              }
              value={selection.portId ?? ""}
            >
              <option value="">항만 선택</option>
              {catalog.ports
                .filter(({ routeId }) => routeId === selection.navigationRouteId)
                .map((port) => (
                  <option key={port.id} value={port.id}>
                    {APPROVED_REFERENCE_LABELS.ports[port.id]?.ko ?? port.id}
                  </option>
                ))}
            </select>
          </label>
          <label>
            초크포인트
            <select
              onChange={(event) =>
                selectChokepoint(event.currentTarget.value, event.currentTarget)
              }
              value={selection.chokepointId ?? ""}
            >
              <option value="">초크포인트 선택</option>
              {catalog.chokepoints.map((chokepoint) => (
                <option key={chokepoint.id} value={chokepoint.id}>
                  {APPROVED_REFERENCE_LABELS.chokepoints[chokepoint.id]?.ko ??
                    chokepoint.id}
                </option>
              ))}
            </select>
          </label>
        </nav>
      ) : null}

      {catalogResource.status === "loading" ? (
        <div className="network-loading" role="status">
          <span />
          <strong>네트워크 카탈로그 확인 중</strong>
        </div>
      ) : null}

      {catalogResource.status === "error" ? (
        <div className="network-loading network-loading--error" role="alert">
          <strong>네트워크 카탈로그를 확인할 수 없습니다.</strong>
          <button onClick={() => setCatalogAttempt((attempt) => attempt + 1)} type="button">
            다시 시도
          </button>
        </div>
      ) : null}

      {catalogResource.status === "ready" &&
      renderer.kind !== "globe_ready" &&
      !staticMode &&
      renderer.kind !== "globe_blocked" ? (
        <div className="network-loading" role="status">
          <span />
          <strong>3D GLOBE</strong>
        </div>
      ) : null}

      {renderer.kind === "globe_blocked" ? (
        <div className="network-loading network-loading--error" role="alert">
          <strong>3D 지구본을 준비하지 못했습니다.</strong>
          <button onClick={() => setRendererAttempt((attempt) => attempt + 1)} type="button">
            다시 시도
          </button>
        </div>
      ) : null}

      {staticMode ? (
        <div className="network-fallback-notice" role="status">
          <strong>{FALLBACK_LABELS[renderer.reason]}</strong>
          <span>네트워크 레이어는 계속 사용할 수 있습니다.</span>
          <button onClick={() => setRendererAttempt((attempt) => attempt + 1)} type="button">
            3D 다시 시도
          </button>
        </div>
      ) : null}

      <section className={legendOpen ? "network-legend is-open" : "network-legend"}>
        <button
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((open) => !open)}
          type="button"
        >
          범례
        </button>
        {legendOpen ? (
          <ul>
            <li><i className="legend-origin" /> 부산항</li>
            <li><i className="legend-port" /> 목적항 57개</li>
            <li><i className="legend-route" /> 대표 해상 회랑</li>
            <li><i className="legend-connector" /> 동일 route 권역 연결</li>
            <li><i className="legend-strait" /> 해협</li>
            <li><i className="legend-canal" /> 운하</li>
            <li><i className="legend-weather" /> 기상 상태</li>
            <li><i className="legend-choke" /> 초크포인트 회랑 11개</li>
          </ul>
        ) : null}
      </section>

      {panel.kind !== "none" ? (
        <aside
          aria-busy={
            (panel.kind === "port" && portDetailResource.status === "loading") ||
            (panel.kind === "chokepoint" &&
              chokepointDetailResource.status === "loading") ||
            (panel.kind === "weather" && weatherResource.status === "loading")
          }
          aria-live="polite"
          className={`network-detail-panel network-detail-panel--${panel.kind}`}
          data-panel-kind={panel.kind}
        >
          <button
            aria-label={detailCloseLabel(panel.kind)}
            className="network-detail-panel__close"
            onClick={closeDetail}
            type="button"
          >
            ×
          </button>
          {panel.kind === "route" && selectedRoute ? (
            <>
              <p className="network-eyebrow">{selectedRoute.id}</p>
              <h2>
                {APPROVED_REFERENCE_LABELS.routes[selectedRoute.id]?.ko ??
                  selectedRoute.id} 노선
              </h2>
              <dl>
                <div><dt>출발</dt><dd>부산항</dd></div>
                <div>
                  <dt>등록 목적항</dt>
                  <dd>
                    {catalog?.ports.filter(({ routeId }) => routeId === selectedRoute.id)
                      .length ?? 0}개
                  </dd>
                </div>
                <div>
                  <dt>기본 해상 회랑</dt>
                  <dd>
                    {APPROVED_REFERENCE_LABELS.weather[`route:${selectedRoute.id}`]
                      ?.subtitleKo ?? "—"}
                  </dd>
                </div>
              </dl>
              <p className="network-detail-panel__note">
                노선은 항만 선택을 위한 권역 필터입니다. 물동량은 각 항만 포인트를 선택해 확인하세요.
              </p>
            </>
          ) : null}
          {panel.kind === "overlap" ? (
            <>
              <p className="network-eyebrow">OVERLAPPING ROUTES</p>
              <h2>겹친 노선 {panel.routeIds.length}개</h2>
              <p>이 지점을 통과하는 노선입니다. 확인할 노선을 선택하세요.</p>
              <div className="network-overlap-list">
                {panel.routeIds.map((routeId) => (
                  <button
                    key={routeId}
                    onClick={() => {
                      if (isRouteId(routeId)) selectRoute(routeId);
                    }}
                    type="button"
                  >
                    <strong>{routeId}</strong>
                    <span>{APPROVED_REFERENCE_LABELS.routes[routeId]?.ko ?? routeId}</span>
                    <small>
                      {catalog?.ports.filter((port) => port.routeId === routeId).length ?? 0}개
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {panel.kind === "port" && selectedPort ? (
            <>
              <p className="network-eyebrow">
                {selectedPort.routeId} · IMF PORTWATCH · {resourceLabel(portResource)}
              </p>
              <h2>{APPROVED_REFERENCE_LABELS.ports[selectedPort.id]?.ko ?? selectedPort.id}</h2>
              <dl className="network-kpi-grid">
                <div><dt>최근 7일 추정 물동량</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>전주 대비</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>수입 추정</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>수출 추정</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>컨테이너선 입항</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>데이터 기준일</dt><dd>UNAVAILABLE</dd></div>
              </dl>
              <section className="network-chart-placeholder" aria-label="항만 추정 물동량 추세">
                <p className="network-eyebrow">PORTWATCH · RECENT 90 DAYS</p>
                <h3>일별 추정 물동량 7일 이동합계</h3>
                <p>AIS 추정 · t · 데이터를 불러올 수 없습니다.</p>
              </section>
              <div className="network-panel-actions">
                <button onClick={() => setGatewayAttempt((attempt) => attempt + 1)} type="button">
                  다시 시도
                </button>
                <button
                  onClick={(event) =>
                    selectWeather(`port:${selectedPort.id}`, event.currentTarget)
                  }
                  type="button"
                >
                  항만 기상 보기
                </button>
              </div>
              <p className="network-detail-panel__note">
                AIS 기반 추정치이며 공식 TEU가 아닙니다.
              </p>
            </>
          ) : null}
          {panel.kind === "chokepoint" && selectedChokepoint ? (
            <>
              <p className="network-eyebrow">
                PORTWATCH · {resourceLabel(chokepointResource)}
              </p>
              <h2>
                {APPROVED_REFERENCE_LABELS.chokepoints[selectedChokepoint.id]?.ko ??
                  selectedChokepoint.id}
              </h2>
              <dl className="network-kpi-grid">
                <div><dt>대표 통과 구간</dt><dd>{selectedChokepoint.id}</dd></div>
                <div><dt>대표 경로 이용</dt><dd>{selection.navigationRouteId}</dd></div>
                <div><dt>데이터 기준일</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>연결 노선</dt><dd>{selection.navigationRouteId}</dd></div>
                <div><dt>최근 7일 추정 통과량</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>전주 대비</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>컨테이너선 통항</dt><dd>UNAVAILABLE</dd></div>
              </dl>
              <div className="network-metric-control" role="radiogroup" aria-label="초크포인트 지표">
                <button aria-checked="true" role="radio" type="button">추정 물동량</button>
                <button aria-checked="false" role="radio" type="button">통항 척수</button>
              </div>
              <section className="network-chart-placeholder" aria-label="초크포인트 추세">
                <p className="network-eyebrow">PORTWATCH TREND</p>
                <h3>최근 7일 이동합계</h3>
                <p>데이터를 불러올 수 없습니다.</p>
              </section>
              <button onClick={() => setGatewayAttempt((attempt) => attempt + 1)} type="button">
                다시 시도
              </button>
              <p className="network-detail-panel__note">AIS 기반 참고 지표입니다.</p>
            </>
          ) : null}
          {panel.kind === "weather" && selectedWeather ? (
            <>
              <p className="network-eyebrow">LIVE WEATHER · {resourceLabel(weatherResource)}</p>
              <h2>
                {APPROVED_REFERENCE_LABELS.weather[selectedWeather.id]?.ko ??
                  selectedWeather.id}
              </h2>
              <p>{APPROVED_REFERENCE_LABELS.weather[selectedWeather.id]?.subtitleKo}</p>
              <dl className="network-kpi-grid network-weather-grid">
                <div><dt>상태</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>위험</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>기온</dt><dd>—</dd></div>
                <div><dt>강수</dt><dd>—</dd></div>
                <div><dt>풍속·돌풍</dt><dd>—</dd></div>
                <div><dt>가시거리 실측</dt><dd>—</dd></div>
                <div><dt>파고·주기</dt><dd>—</dd></div>
                <div><dt>해수면 온도</dt><dd>—</dd></div>
              </dl>
              <button onClick={() => setGatewayAttempt((attempt) => attempt + 1)} type="button">
                다시 시도
              </button>
              <p className="network-detail-panel__note">
                운항 승인용이 아닌 노선 위험 모니터링용 참고 실황입니다.
              </p>
            </>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}
