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
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import type { DataGatewayV1, GatewayResultV1 } from "../../contracts/gateway";
import { useFreightRiskRoute } from "../../components/shell";
import { createSameOriginDataGatewayV1 } from "../../data/runtime/data-gateway.client";
import {
  DEFAULT_ROUTE_ID,
  isRouteId,
  type RouteId,
} from "../../contracts/routes";
import type {
  ChokepointTrafficDataV1,
  PortTrafficDataV1,
  WeatherDataV1,
  WeatherObservationV1,
} from "../../data/runtime/domains";

type MapLibrePaintProperty = Parameters<MapLibreMap["setPaintProperty"]>[1];

import {
  catalogToNetworkGeoJson,
  createNetworkCameraFit,
  createNetworkFeatureStateController,
  createNetworkMapLayers,
  createNetworkMapPromotion,
  createRemoteFreeGlobeStyle,
  createRendererDiagnostics,
  coordinateFacesGlobeCenter,
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
  sampleRoute,
  selectVisibleWeather,
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
import { installNetworkMapScene } from "./core/network-map-scene";
import {
  APPROVED_NETWORK_LABELS,
  buildNetworkChartPath,
  createNetworkRuntimeAdapters,
  formatEstimatedTons,
  formatPercent,
  formatVesselCalls,
  resolveChokepointPanelDataV1,
  resolveNetworkResource,
  resolvePortPanelDataV1,
  type ChokepointStateV1,
  type NetworkCatalogAdapterResult,
  type NetworkCatalogArtifactPropsV1,
  type NetworkResourceState,
  type PortStateV1,
  type WeatherStateV1,
} from "./data";

const MAP_PALETTE = {
  ocean: "rgba(3, 24, 39, 0.66)",
  sky: "#020b15",
  horizon: "#68d8ff",
  atmosphere: "#0d7dac",
  route: "#159bf4",
  routeShadow: "#001a33",
  selection: "#ffb64c",
  chokepoint: "#ff8b46",
  port: "#eafcff",
  weatherNormal: "#5ad3ae",
  weatherWarning: "#ffbd4a",
  weatherSevere: "#ff5d62",
  weatherUnavailable: "#8aa6b2",
} as const;

function initialSelection(routeId: RouteId): NetworkSelectionState {
  return {
    navigationRouteId: routeId,
    portId: null,
    mapRouteId: null,
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
  readonly dataGateway?: DataGatewayV1;
  readonly initialCatalogArtifacts: NetworkCatalogArtifactPropsV1;
  readonly initialPortResult?: GatewayResultV1<PortTrafficDataV1, PortStateV1>;
  readonly initialChokepointResult?: GatewayResultV1<
    ChokepointTrafficDataV1,
    ChokepointStateV1
  >;
  readonly initialWeatherResult?: GatewayResultV1<WeatherDataV1, WeatherStateV1>;
}

interface WeatherMarkerHandle {
  readonly id: string;
  readonly element: HTMLButtonElement;
  readonly marker: MapLibreMarker;
  readonly observation: WeatherObservationV1;
  readonly role: "secondary" | "primary" | "chokepoint";
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

function resourceLabel<TData, TState extends string>(
  resource: NetworkResourceState<TData, TState>,
): string {
  if (resource.status === "ready" || resource.status === "empty") {
    return resource.result.state;
  }
  if (resource.status === "error") return "UNAVAILABLE";
  return "연결 확인 중";
}

function resourceData<TData, TState extends string>(
  resource: NetworkResourceState<TData, TState>,
): TData | null {
  if (resource.status !== "ready" && resource.status !== "empty") return null;
  return resource.result.data;
}

const WEATHER_ICON_BY_CONDITION: Readonly<Record<WeatherObservationV1["condition"], string>> = {
  clear: "/network/icons/weather/clear-day.svg",
  night: "/network/icons/weather/clear-day.svg",
  rain: "/network/icons/weather/rain.svg",
  snow: "/network/icons/weather/rain.svg",
  storm: "/network/icons/weather/rain.svg",
  wind: "/network/icons/weather/partly-cloudy-day.svg",
  wave: "/network/icons/weather/partly-cloudy-day.svg",
  cloud: "/network/icons/weather/cloudy.svg",
  fog: "/network/icons/weather/cloudy.svg",
  unavailable: "/network/icons/weather/cloudy.svg",
};

const WEATHER_CONDITION_LABELS: Readonly<Record<WeatherObservationV1["condition"], string>> = {
  clear: "맑음",
  night: "맑은 밤",
  rain: "비",
  snow: "눈",
  storm: "폭풍",
  wind: "강풍",
  wave: "높은 파고",
  cloud: "흐림",
  fog: "안개",
  unavailable: "관측 연결 중",
};

function formatMetric(value: number | null | undefined, suffix: string, digits = 1): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(digits)}${suffix}`;
}

function formatWeatherTime(value: string | null | undefined): string {
  if (!value) return "관측 시각 확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatVisibility(value: number | null | undefined, minimum = false): string {
  if (value === null || value === undefined) return "—";
  const prefix = minimum ? "최소 " : "";
  return value >= 1_000
    ? `${prefix}${(value / 1_000).toFixed(1)}km`
    : `${prefix}${Math.round(value).toLocaleString("ko-KR")}m`;
}

function weatherRole(
  observation: WeatherObservationV1,
  primaryPortIds: ReadonlySet<string>,
): WeatherMarkerHandle["role"] {
  if (observation.kind === "chokepoint") return "chokepoint";
  if (
    observation.kind === "route" ||
    observation.entityId === "BUSAN" ||
    primaryPortIds.has(observation.entityId)
  ) {
    return "primary";
  }
  return "secondary";
}

function fitNetworkMap(
  map: MapLibreMap | null,
  coordinates: readonly (readonly [number, number])[],
  panelOpen: boolean,
  preferredDurationMs: number,
): void {
  if (!map || coordinates.length === 0) return;
  const canvas = map.getCanvas();
  const fit = createNetworkCameraFit({
    coordinates,
    viewportWidth: Math.max(canvas.clientWidth, 1),
    viewportHeight: Math.max(canvas.clientHeight, 1),
    mobile: canvas.clientWidth <= 640,
    panelOpen,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    preferredDurationMs,
  });
  map.fitBounds([[...fit.bounds[0]], [...fit.bounds[1]]], {
    padding: fit.padding,
    duration: fit.duration,
    maxZoom: 5.2,
    bearing: 0,
    pitch: 0,
  });
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
        segments: splitAntimeridian(sampleRoute(route.waypointCoordinates)).map((segment) =>
          segment.map((coordinate) => projectWebMercator(coordinate, 1000, 500)),
        ),
      })),
    [catalog],
  );
  const connectorSegments = useMemo(
    () =>
      catalogToNetworkGeoJson(catalog)["network-connectors"].features.flatMap(
        (feature) => {
          if (feature.geometry.type !== "MultiLineString") return [];
          return feature.geometry.coordinates.map((segment, index) => ({
            id: `${String(feature.id)}:${index}`,
            routeId: String(feature.properties.routeId ?? ""),
            points: segment.map((coordinate) =>
              projectWebMercator(coordinate, 1000, 500),
            ),
          }));
        },
      ),
    [catalog],
  );
  const markerPositions = useMemo(
    () =>
      new Map(
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
        ].map((position) => [position.id, position] as const),
      ),
    [catalog],
  );

  const beginPan = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.target instanceof Element && event.target.closest("[role=button]")) {
      return;
    }
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
        <g aria-hidden="true" className="network-static-map__connectors">
          {connectorSegments.map((segment) => (
            <polyline
              className={segment.routeId === selection.mapRouteId ? "is-selected" : undefined}
              data-network-connector="true"
              key={segment.id}
              points={segment.points.map(({ x, y }) => `${x},${y}`).join(" ")}
            />
          ))}
        </g>
        {routeSegments.map(({ route, segments }) => {
          if (!isRouteId(route.id)) return null;
          const routeId = route.id;
          return (
            <g
              aria-label={`${APPROVED_NETWORK_LABELS.routes[routeId]?.ko ?? routeId} 노선`}
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
                APPROVED_NETWORK_LABELS.chokepoints[chokepoint.id]?.ko ??
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
              aria-label={`${APPROVED_NETWORK_LABELS.ports[port.id]?.ko ?? port.id}, ${port.routeId} 노선`}
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
              aria-label={`${APPROVED_NETWORK_LABELS.weather[weather.id]?.ko ?? weather.id} 기상`}
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
  dataGateway,
  initialCatalogArtifacts,
  initialPortResult,
  initialChokepointResult,
  initialWeatherResult,
}: NetworkPageClientProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLibreModuleRef = useRef<typeof import("maplibre-gl") | null>(null);
  const weatherMarkersRef = useRef<readonly WeatherMarkerHandle[]>([]);
  const selectedWeatherIdRef = useRef<string | null>(null);
  const sceneControllerRef = useRef<ReturnType<typeof installNetworkMapScene> | null>(null);
  const selectionTriggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const {
    routeId: navigationRouteId,
    changeRoute,
  } = useFreightRiskRoute();
  const productionGateway = useMemo(
    () => dataGateway ?? createSameOriginDataGatewayV1(),
    [dataGateway],
  );
  const runtimeAdapters = useMemo(
    () => createNetworkRuntimeAdapters({
      artifacts: initialCatalogArtifacts,
      gateway: productionGateway,
    }),
    [initialCatalogArtifacts, productionGateway],
  );
  const focusButtonRefs = useRef(
    new Map<NetworkFocusMode, HTMLButtonElement>(),
  );
  const featureStateRef = useRef<ReturnType<typeof createNetworkFeatureStateController> | null>(
    null,
  );
  const [renderer, dispatchRenderer] = useReducer(reduceRendererState, INITIAL_RENDERER_STATE);
  const [selection, dispatchSelection] = useReducer(
    reduceNetworkSelection,
    initialSelection(DEFAULT_ROUTE_ID),
  );
  const [focusMode, setFocusMode] = useState<NetworkFocusMode>("combined");
  const [viewport, setViewport] = useState(DEFAULT_STATIC_VIEWPORT);
  const [legendOpen, setLegendOpen] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [portAttempt, setPortAttempt] = useState(0);
  const [chokepointAttempt, setChokepointAttempt] = useState(0);
  const [weatherAttempt, setWeatherAttempt] = useState(0);
  const [chokepointMetric, setChokepointMetric] = useState<"tons" | "vessels">(
    "tons",
  );
  const [catalogResource, setCatalogResource] = useState<CatalogClientState>({
    status: "loading",
    attempt: 0,
  });
  const [portResource, setPortResource] = useState<
    NetworkResourceState<PortTrafficDataV1, PortStateV1>
  >(() =>
    initialPortResult ? resolveNetworkResource(initialPortResult, 1) : { status: "idle" },
  );
  const [chokepointResource, setChokepointResource] = useState<
    NetworkResourceState<ChokepointTrafficDataV1, ChokepointStateV1>
  >(() =>
    initialChokepointResult
      ? resolveNetworkResource(initialChokepointResult, 1)
      : { status: "idle" },
  );
  const [weatherResource, setWeatherResource] = useState<
    NetworkResourceState<WeatherDataV1, WeatherStateV1>
  >(() =>
    initialWeatherResult
      ? resolveNetworkResource(initialWeatherResult, 1)
      : { status: "idle" },
  );
  const [portDetailResource, setPortDetailResource] = useState<
    NetworkResourceState<PortTrafficDataV1, PortStateV1>
  >({ status: "idle" });
  const [chokepointDetailResource, setChokepointDetailResource] = useState<
    NetworkResourceState<ChokepointTrafficDataV1, ChokepointStateV1>
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
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const catalog =
    catalogResource.status === "ready" ? catalogResource.value.catalog : null;
  const weatherData = resourceData(weatherResource);
  const weatherObservations = weatherData?.observations ?? null;
  const sources = useMemo(
    () => (catalog ? catalogToNetworkGeoJson(catalog) : null),
    [catalog],
  );
  const layers = useMemo(() => createNetworkMapLayers(MAP_PALETTE), []);
  const weatherGeoJson = useMemo(() => {
    if (!catalog || !weatherObservations) return null;
    const visualState = Object.fromEntries(
      Object.entries(weatherObservations).map(([id, observation]) => [id, {
        condition: observation.condition,
        risk: observation.risk,
        riskLabel: observation.riskLabel,
        riskReason: observation.riskReasons.join(" · ") || null,
        observedAt: observation.observedAt,
      }]),
    );
    return catalogToNetworkGeoJson(catalog, { weatherById: visualState })["network-weather"];
  }, [catalog, weatherObservations]);
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
  const selectedWeatherObservation = selectedWeather && weatherObservations
    ? weatherObservations[selectedWeather.id] ?? null
    : null;
  const weatherStatusLabel = weatherData
    ? `${resourceLabel(weatherResource)} · ${weatherData.locationCount}개 지점 · ${formatWeatherTime(weatherData.fetchedAt)}`
    : resourceLabel(weatherResource);
  const portPanelData = selectedPort
    ? resolvePortPanelDataV1(
        selectedPort.id,
        resourceData(portResource),
        resourceData(portDetailResource),
      )
    : null;
  const chokepointPanelData = selectedChokepoint
    ? resolveChokepointPanelDataV1(
        selectedChokepoint.id,
        resourceData(chokepointResource),
        resourceData(chokepointDetailResource),
      )
    : null;
  const portChartPath = buildNetworkChartPath(
    portPanelData?.detail?.points.map(({ estimatedTotalTons7d }) =>
      estimatedTotalTons7d,
    ) ?? [],
  );
  const chokepointChartPath = buildNetworkChartPath(
    chokepointPanelData?.detail?.points.map((point) =>
      chokepointMetric === "tons"
        ? point.estimatedTransitTons7d
        : point.containerVessels7d,
    ) ?? [],
  );

  const selectMapRoute = useCallback(
    (routeId: RouteId, trigger?: HTMLElement | SVGElement): void => {
      if (trigger) selectionTriggerRef.current = trigger;
      dispatchSelection({ type: "SELECT_ROUTE", routeId });
      const route = catalog?.routes.find(({ id }) => id === routeId);
      if (route) fitNetworkMap(mapRef.current, route.waypointCoordinates, true, 800);
    },
    [catalog],
  );
  const changeNavigationRoute = useCallback(
    (routeId: RouteId, trigger?: HTMLElement | SVGElement): void => {
      if (!changeRoute(routeId)) return;
      selectMapRoute(routeId, trigger);
    },
    [changeRoute, selectMapRoute],
  );
  const selectPort = useCallback((
    portId: string,
    trigger?: HTMLElement | SVGElement,
  ): void => {
    if (trigger) selectionTriggerRef.current = trigger;
    const port = catalog?.ports.find(({ id }) => id === portId);
    if (!port) return;
    dispatchSelection({ type: "SELECT_PORT", portId, routeId: port.routeId });
    fitNetworkMap(mapRef.current, [[port.longitude, port.latitude]], true, 700);
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
      fitNetworkMap(mapRef.current, [[chokepoint.longitude, chokepoint.latitude]], true, 700);
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
      fitNetworkMap(mapRef.current, [[weather.longitude, weather.latitude]], true, 650);
    }
  }, [catalog]);

  const closeDetail = useCallback((): void => {
    const trigger = selectionTriggerRef.current;
    const restoredPortId = panel.kind === "weather" ? selection.portId : null;
    dispatchSelection({
      type: panel.kind === "weather" ? "CLOSE_WEATHER" : "CLOSE_DETAIL",
    });
    queueMicrotask(() => {
      if (trigger?.isConnected) {
        trigger.focus();
        return;
      }
      if (restoredPortId) {
        document
          .querySelector<HTMLElement>(`[data-weather-trigger="${restoredPortId}"]`)
          ?.focus();
      }
    });
  }, [panel.kind, selection.portId]);

  const resetView = useCallback((): void => {
    setViewport(resetStaticViewport());
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current?.easeTo({
      center: [126.2, 27.5],
      zoom: 1.42,
      bearing: -7,
      pitch: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      duration: reducedMotion ? 0 : 700,
    });
  }, []);


  useEffect(() => {
    const controller = new AbortController();
    const attempt = catalogAttempt + 1;
    setCatalogResource({ status: "loading", attempt });
    void runtimeAdapters.catalog.load(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.state === "READY") {
        setCatalogResource({ status: "ready", attempt, value: result });
        return;
      }
      setCatalogResource({ status: "error", attempt, value: result });
    });
    return () => controller.abort();
  }, [catalogAttempt, runtimeAdapters]);

  useEffect(() => {
    if (!catalog) return;
    if (
      initialPortResult &&
      dataGateway === undefined &&
      portAttempt === 0
    ) {
      return;
    }
    const attempt = portAttempt + 1;
    const gateway = runtimeAdapters.gateway;
    if (!gateway) {
      setPortResource({
        status: "error" as const,
        attempt,
        result: null,
        retryable: false,
        message: "데이터 게이트웨이를 사용할 수 없습니다.",
      });
      return;
    }
    const controller = new AbortController();
    setPortResource({ status: "loading", attempt });
    void gateway.portSummary(controller.signal).then(
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
    return () => controller.abort();
  }, [catalog, dataGateway, initialPortResult, portAttempt, runtimeAdapters]);

  useEffect(() => {
    if (!catalog) return;
    if (
      initialChokepointResult &&
      dataGateway === undefined &&
      chokepointAttempt === 0
    ) {
      return;
    }
    const attempt = chokepointAttempt + 1;
    const gateway = runtimeAdapters.gateway;
    if (!gateway) {
      setChokepointResource({
        status: "error",
        attempt,
        result: null,
        retryable: false,
        message: "데이터 게이트웨이를 사용할 수 없습니다.",
      });
      return;
    }
    const controller = new AbortController();
    setChokepointResource({ status: "loading", attempt });
    void gateway.chokeSummary(controller.signal).then(
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
    return () => controller.abort();
  }, [catalog, chokepointAttempt, dataGateway, initialChokepointResult, runtimeAdapters]);

  useEffect(() => {
    if (!catalog) return;
    if (
      initialWeatherResult &&
      dataGateway === undefined &&
      weatherAttempt === 0
    ) {
      return;
    }
    const attempt = weatherAttempt + 1;
    const gateway = runtimeAdapters.gateway;
    if (!gateway) {
      setWeatherResource({
        status: "error",
        attempt,
        result: null,
        retryable: false,
        message: "데이터 게이트웨이를 사용할 수 없습니다.",
      });
      return;
    }
    const controller = new AbortController();
    setWeatherResource((current) =>
      current.status === "ready" || current.status === "empty"
        ? current
        : { status: "loading", attempt },
    );
    void gateway.weather(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          const resolved = resolveNetworkResource(result, attempt);
          setWeatherResource((current) =>
            resolved.status === "ready" || resolved.status === "empty"
              ? resolved
              : current.status === "ready" || current.status === "empty"
                ? current
                : resolved,
          );
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setWeatherResource((current) =>
            current.status === "ready" || current.status === "empty"
              ? current
              : {
                  status: "error",
                  attempt,
                  result: null,
                  retryable: true,
                  message: "데이터를 불러올 수 없습니다.",
                },
          );
        }
      },
    );
    return () => controller.abort();
  }, [catalog, dataGateway, initialWeatherResult, runtimeAdapters, weatherAttempt]);

  useEffect(() => {
    if (!selectedPort) {
      setPortDetailResource({ status: "idle" });
      return;
    }
    const attempt = portAttempt + 1;
    const gateway = runtimeAdapters.gateway;
    if (!gateway) {
      setPortDetailResource({
        status: "error",
        attempt,
        result: null,
        retryable: false,
        message: "데이터 게이트웨이를 사용할 수 없습니다.",
      });
      return;
    }
    const controller = new AbortController();
    setPortDetailResource({ status: "loading", attempt });
    void gateway
      .portDetail({ id: selectedPort.id, days: 90 }, controller.signal)
      .then(
        (result) => {
          if (!controller.signal.aborted) {
            setPortDetailResource(resolveNetworkResource(result, attempt));
          }
        },
        (error) => {
          if (!controller.signal.aborted) {
            setPortDetailResource({
              status: "error",
              attempt,
              result: null,
              retryable: true,
              message: error instanceof Error
                ? error.message
                : "데이터를 불러올 수 없습니다.",
            });
          }
        },
      );
    return () => controller.abort();
  }, [portAttempt, runtimeAdapters, selectedPort]);

  useEffect(() => {
    if (!selectedChokepoint) {
      setChokepointDetailResource({ status: "idle" });
      return;
    }
    const attempt = chokepointAttempt + 1;
    const gateway = runtimeAdapters.gateway;
    if (!gateway) {
      setChokepointDetailResource({
        status: "error",
        attempt,
        result: null,
        retryable: false,
        message: "데이터 게이트웨이를 사용할 수 없습니다.",
      });
      return;
    }
    const controller = new AbortController();
    setChokepointDetailResource({ status: "loading", attempt });
    void gateway
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
  }, [chokepointAttempt, runtimeAdapters, selectedChokepoint]);

  useEffect(() => {
    dispatchSelection({
      type: "CHANGE_NAVIGATION_ROUTE",
      routeId: navigationRouteId,
    });
  }, [navigationRouteId]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (legendOpen) {
        setLegendOpen(false);
        return;
      }
      if (visibleNetworkPanel(selection).kind !== "none") closeDetail();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeDetail, legendOpen, selection]);

  useEffect(() => {
    featureStateRef.current?.apply(selection);
  }, [selection]);

  useEffect(() => {
    selectedWeatherIdRef.current = selection.weatherId;
    for (const handle of weatherMarkersRef.current) {
      const selected = handle.id === selection.weatherId;
      handle.element.dataset.selected = String(selected);
      handle.element.setAttribute("aria-pressed", String(selected));
    }
  }, [selection.weatherId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapInstance || renderer.kind !== "globe_ready" || !weatherGeoJson) return;
    const source = map.getSource("network-weather") as
      | { setData: (data: unknown) => void }
      | undefined;
    try {
      source?.setData(weatherGeoJson);
    } catch {
      dispatchRenderer({ type: "DEGRADE", degradation: "CATALOG_UNAVAILABLE" });
    }
  }, [mapInstance, renderer.kind, weatherGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = mapLibreModuleRef.current;
    for (const handle of weatherMarkersRef.current) handle.marker.remove();
    weatherMarkersRef.current = [];
    if (
      !map ||
      !mapInstance ||
      !mapLibre ||
      !catalog ||
      !weatherObservations ||
      renderer.kind !== "globe_ready"
    ) {
      return;
    }

    const primaryPortIds = new Set(
      catalog.ports.filter(({ primary }) => primary).map(({ id }) => id),
    );
    const handles = catalog.weather.flatMap((weather): WeatherMarkerHandle[] => {
      const observation = weatherObservations[weather.id];
      if (!observation) return [];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "network-weather-marker";
      button.dataset.kind = observation.kind;
      button.dataset.risk = observation.risk;
      button.dataset.selected = String(selectedWeatherIdRef.current === observation.key);
      button.setAttribute(
        "aria-label",
        `${observation.nameKo}, ${observation.conditionLabel || WEATHER_CONDITION_LABELS[observation.condition]}, ${observation.riskLabel}`,
      );
      button.setAttribute(
        "aria-pressed",
        String(selectedWeatherIdRef.current === observation.key),
      );
      button.title = `${observation.nameKo} · ${observation.conditionLabel}`;

      const image = document.createElement("img");
      image.src = WEATHER_ICON_BY_CONDITION[observation.condition];
      image.alt = "";
      image.ariaHidden = "true";
      image.draggable = false;
      const caption = document.createElement("span");
      caption.className = "network-weather-marker__caption";
      caption.textContent = observation.conditionLabel || WEATHER_CONDITION_LABELS[observation.condition];
      button.append(image, caption);

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selectWeather(observation.key, button);
      });
      const marker = new mapLibre.Marker({
        anchor: "center",
        element: button,
        opacity: 1,
        opacityWhenCovered: 0,
        subpixelPositioning: true,
      })
        .setLngLat([observation.longitude, observation.latitude])
        .addTo(map);
      return [{
        id: observation.key,
        element: button,
        marker,
        observation,
        role: weatherRole(observation, primaryPortIds),
      }];
    });
    weatherMarkersRef.current = handles;

    const updateVisibility = (): void => {
      const minimumDistance = map.getCanvas().clientWidth <= 640 ? 36 : 46;
      const canvas = map.getCanvas();
      const center = map.getCenter();
      const visible = new Set(
        selectVisibleWeather(
          handles.map((handle) => {
            const point = map.project([
              handle.observation.longitude,
              handle.observation.latitude,
            ]);
            return {
              id: handle.id,
              x: point.x,
              y: point.y,
              risk: handle.observation.risk,
              role: handle.role,
              selected: selectedWeatherIdRef.current === handle.id,
              hovered: handle.element.matches(":hover"),
              pinned: handle.observation.kind === "route",
              globeFacing: coordinateFacesGlobeCenter(
                [handle.observation.longitude, handle.observation.latitude],
                [center.lng, center.lat],
              ),
              inViewport:
                point.x >= -40 &&
                point.x <= canvas.clientWidth + 40 &&
                point.y >= -40 &&
                point.y <= canvas.clientHeight + 40,
            };
          }),
          map.getZoom(),
          minimumDistance,
        ).map(({ id }) => id),
      );
      for (const handle of handles) {
        const isVisible = visible.has(handle.id);
        handle.element.dataset.visible = String(isVisible);
        handle.element.hidden = !isVisible;
      }
    };

    map.on("move", updateVisibility);
    map.on("resize", updateVisibility);
    for (const handle of handles) {
      handle.element.addEventListener("pointerenter", updateVisibility);
      handle.element.addEventListener("pointerleave", updateVisibility);
    }
    updateVisibility();

    return () => {
      map.off("move", updateVisibility);
      map.off("resize", updateVisibility);
      for (const handle of handles) {
        handle.element.removeEventListener("pointerenter", updateVisibility);
        handle.element.removeEventListener("pointerleave", updateVisibility);
        handle.marker.remove();
      }
      if (weatherMarkersRef.current === handles) weatherMarkersRef.current = [];
    };
  }, [catalog, mapInstance, renderer.kind, selectWeather, weatherObservations]);

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
    const map = mapRef.current;
    if (!map || renderer.kind !== "globe_ready" || !map.getLayer("network-connector-line")) {
      return;
    }
    const activeRouteId = selection.mapRouteId;
    try {
      map.setPaintProperty(
        "network-connector-line",
        "line-color",
        activeRouteId
          ? ["case", ["==", ["get", "routeId"], activeRouteId], "#ffb400", "#58b9f2"]
          : "#58b9f2",
      );
      map.setPaintProperty(
        "network-connector-line",
        "line-width",
        activeRouteId
          ? ["case", ["==", ["get", "routeId"], activeRouteId], 2.35, 1.35]
          : 1.35,
      );
    } catch {
      dispatchRenderer({ type: "DEGRADE", degradation: "CATALOG_UNAVAILABLE" });
    }
  }, [renderer.kind, selection.mapRouteId]);

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
      mapLibreModuleRef.current = mapLibre;

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
          setMapInstance(map);
          try {
            map.addControl(
              new mapLibre.AttributionControl({ compact: true }),
              "bottom-right",
            );
          } catch {
            dispatchRenderer({ type: "DEGRADE", degradation: "BASEMAP_UNAVAILABLE" });
          }
          sceneControllerRef.current?.dispose();
          sceneControllerRef.current = installNetworkMapScene(map, {
            onDegradation: ({ code }) => {
              setDiagnosticCode(`DEGRADED_${code}`);
              dispatchRenderer({ type: "DEGRADE", degradation: "BASEMAP_UNAVAILABLE" });
            },
          });
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
            const trigger = map.getCanvas();
            if (intent.kind === "weather") selectWeather(intent.id, trigger);
            if (intent.kind === "port") selectPort(intent.id, trigger);
            if (intent.kind === "chokepoint") selectChokepoint(intent.id, trigger);
            if (intent.kind === "route" && isRouteId(intent.id)) {
              selectMapRoute(intent.id, trigger);
            }
            if (intent.kind === "overlap") {
              selectionTriggerRef.current = trigger;
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
      sceneControllerRef.current?.dispose();
      sceneControllerRef.current = null;
      for (const handle of weatherMarkersRef.current) handle.marker.remove();
      weatherMarkersRef.current = [];
      featureStateRef.current?.dispose();
      featureStateRef.current = null;
      mapRef.current = null;
      setMapInstance(null);
      mapLibreModuleRef.current = null;
      controller?.dispose();
    };
  }, [
    layers,
    rendererAttempt,
    selectChokepoint,
    selectPort,
    selectMapRoute,
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
          onRoute={selectMapRoute}
          onViewport={setViewport}
          onWeather={selectWeather}
          selection={selection}
          viewport={viewport}
        />
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

      <p className="network-weather-status" role="status">
        <span aria-hidden="true" />
        <strong>기상 실황</strong>
        <small>{weatherStatusLabel}</small>
      </p>

      <section aria-label="네트워크 작업 도구" className="network-actions">
        <div aria-label="지도 초점" className="network-focus" role="radiogroup">
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
              {{
                routes: "노선 중심",
                chokepoints: "초크포인트 중심",
                combined: "함께 보기",
              }[mode]}
            </button>
          ))}
        </div>
        <button className="network-reset" onClick={resetView} type="button">
          초기 위치
        </button>
      </section>

      {catalog ? (
        <nav aria-label="네트워크 항목 탐색" className="network-explorer">
          <label>
            노선
            <select
              onChange={(event) => {
                if (isRouteId(event.currentTarget.value)) {
                  changeNavigationRoute(
                    event.currentTarget.value,
                    event.currentTarget,
                  );
                }
              }}
              value={selection.navigationRouteId}
            >
              {catalog.routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.id} · {APPROVED_NETWORK_LABELS.routes[route.id]?.ko ?? route.id}
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
                    {APPROVED_NETWORK_LABELS.ports[port.id]?.ko ?? port.id}
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
                  {APPROVED_NETWORK_LABELS.chokepoints[chokepoint.id]?.ko ??
                    chokepoint.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            기상 관측
            <select
              onChange={(event) =>
                selectWeather(event.currentTarget.value, event.currentTarget)
              }
              value={selection.weatherId ?? ""}
            >
              <option value="">관측 지점 선택</option>
              {Object.values(weatherObservations ?? {})
                .map((observation) => (
                  <option key={observation.key} value={observation.key}>
                    {observation.nameKo} · {observation.conditionLabel}
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
          aria-controls="network-map-legend"
          onClick={() => setLegendOpen((open) => !open)}
          type="button"
        >
          범례
        </button>
        {legendOpen ? (
          <div
            aria-label="지도 범례"
            className="network-legend__panel"
            id="network-map-legend"
            role="region"
          >
            <div className="network-legend__head">
              <strong>지도 범례</strong>
              <button
                aria-label="범례 닫기"
                onClick={() => setLegendOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <ul>
              <li><i className="legend-origin" /> 부산항</li>
              <li><i className="legend-port" /> 목적항 57개</li>
              <li><i className="legend-route" /> 대표 해상 회랑</li>
              <li><i className="legend-connector" /> 동일 노선 권역 연결</li>
              <li><i className="legend-strait" /> 해협</li>
              <li><i className="legend-canal" /> 운하</li>
              <li><i className="legend-weather" /> 기상 애니메이션</li>
              <li><i className="legend-choke" /> AIS 7일 추정 통과량</li>
            </ul>
            <p>드래그 회전 · 표식 클릭은 상세 정보</p>
          </div>
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
          data-detail-state={
            panel.kind === "port"
              ? portDetailResource.status
              : panel.kind === "chokepoint"
                ? chokepointDetailResource.status
                : undefined
          }
          data-detail-message={
            panel.kind === "port" && portDetailResource.status === "error"
              ? portDetailResource.message
              : panel.kind === "chokepoint" && chokepointDetailResource.status === "error"
                ? chokepointDetailResource.message
                : undefined
          }
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
                {APPROVED_NETWORK_LABELS.routes[selectedRoute.id]?.ko ??
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
                    {APPROVED_NETWORK_LABELS.weather[`route:${selectedRoute.id}`]
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
                      if (isRouteId(routeId)) selectMapRoute(routeId);
                    }}
                    type="button"
                  >
                    <strong>{routeId}</strong>
                    <span>{APPROVED_NETWORK_LABELS.routes[routeId]?.ko ?? routeId}</span>
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
              <h2>{APPROVED_NETWORK_LABELS.ports[selectedPort.id]?.ko ?? selectedPort.id}</h2>
              <dl className="network-kpi-grid">
                <div>
                  <dt>최근 7일 추정 물동량</dt>
                  <dd>{formatEstimatedTons(portPanelData?.summary?.estimatedTotalTons7d)}</dd>
                </div>
                <div>
                  <dt>전주 대비</dt>
                  <dd>{formatPercent(portPanelData?.summary?.estimatedTotalTonsChangePercent)}</dd>
                </div>
                <div>
                  <dt>수입 추정</dt>
                  <dd>{formatEstimatedTons(portPanelData?.summary?.estimatedImportTons7d)}</dd>
                </div>
                <div>
                  <dt>수출 추정</dt>
                  <dd>{formatEstimatedTons(portPanelData?.summary?.estimatedExportTons7d)}</dd>
                </div>
                <div>
                  <dt>컨테이너선 입항</dt>
                  <dd>{formatVesselCalls(portPanelData?.summary?.containerVesselCalls7d)}</dd>
                </div>
                <div>
                  <dt>데이터 기준일</dt>
                  <dd>{portPanelData?.summary?.observedAt ?? "—"}</dd>
                </div>
              </dl>
              <section className="network-chart-placeholder" aria-label="항만 추정 물동량 추세">
                <p className="network-eyebrow">PORTWATCH · RECENT 90 DAYS</p>
                <h3>일별 추정 물동량 7일 이동합계</h3>
                {portChartPath ? (
                  <svg aria-label="항만 물동량 추세 차트" viewBox="0 0 420 120">
                    <path d={portChartPath} />
                  </svg>
                ) : (
                  <p>AIS 추정 · t · 데이터를 불러올 수 없습니다.</p>
                )}
              </section>
              <div className="network-panel-actions">
                <button onClick={() => setPortAttempt((attempt) => attempt + 1)} type="button">
                  다시 시도
                </button>
                <button
                  data-weather-trigger={selectedPort.id}
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
                {APPROVED_NETWORK_LABELS.chokepoints[selectedChokepoint.id]?.ko ??
                  selectedChokepoint.id}
              </h2>
              <dl className="network-kpi-grid">
                <div>
                  <dt>최근 7일 추정 통과량</dt>
                  <dd>{formatEstimatedTons(chokepointPanelData?.summary?.estimatedTransitTons7d)}</dd>
                </div>
                <div>
                  <dt>물동량 전주 대비</dt>
                  <dd>{formatPercent(chokepointPanelData?.summary?.transitTonsChangePercent)}</dd>
                </div>
                <div>
                  <dt>컨테이너선 통항</dt>
                  <dd>{formatVesselCalls(chokepointPanelData?.summary?.containerVessels7d)}</dd>
                </div>
                <div>
                  <dt>통항 척수 전주 대비</dt>
                  <dd>{formatPercent(chokepointPanelData?.summary?.vesselChangePercent)}</dd>
                </div>
                <div>
                  <dt>데이터 기준일</dt>
                  <dd>{chokepointPanelData?.summary?.observedAt ?? "—"}</dd>
                </div>
                <div>
                  <dt>관측 시계열</dt>
                  <dd>{chokepointPanelData?.detail?.points.length ?? 0}개</dd>
                </div>
              </dl>
              <div className="network-metric-control" role="radiogroup" aria-label="초크포인트 지표">
                <button
                  aria-checked={chokepointMetric === "tons"}
                  onClick={() => setChokepointMetric("tons")}
                  role="radio"
                  tabIndex={chokepointMetric === "tons" ? 0 : -1}
                  type="button"
                >
                  추정 물동량
                </button>
                <button
                  aria-checked={chokepointMetric === "vessels"}
                  onClick={() => setChokepointMetric("vessels")}
                  role="radio"
                  tabIndex={chokepointMetric === "vessels" ? 0 : -1}
                  type="button"
                >
                  통항 척수
                </button>
              </div>
              <section className="network-chart-placeholder" aria-label="초크포인트 추세">
                <p className="network-eyebrow">PORTWATCH TREND</p>
                <h3>최근 7일 이동합계</h3>
                {chokepointChartPath ? (
                  <>
                    <svg aria-label="초크포인트 추세 차트" viewBox="0 0 420 120">
                      <path d={chokepointChartPath} />
                    </svg>
                    <ol className="network-chart-rows">
                      {chokepointPanelData?.detail?.points.slice(-5).map((point) => (
                        <li key={point.date}>
                          <time dateTime={point.date}>{point.date}</time>
                          <span>
                            {chokepointMetric === "tons"
                              ? formatEstimatedTons(point.estimatedTransitTons7d)
                              : formatVesselCalls(point.containerVessels7d)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p>데이터를 불러올 수 없습니다.</p>
                )}
              </section>
              <button onClick={() => setChokepointAttempt((attempt) => attempt + 1)} type="button">
                다시 시도
              </button>
              <p className="network-detail-panel__note">AIS 기반 참고 지표입니다.</p>
            </>
          ) : null}
          {panel.kind === "weather" && selectedWeather ? (
            <>
              <p className="network-eyebrow">
                LIVE WEATHER · {formatWeatherTime(selectedWeatherObservation?.observedAt)}
              </p>
              <h2>
                {selectedWeatherObservation?.nameKo ??
                  APPROVED_NETWORK_LABELS.weather[selectedWeather.id]?.ko ??
                  selectedWeather.id}
              </h2>
              <p>
                {selectedWeatherObservation?.subtitleKo ??
                  APPROVED_NETWORK_LABELS.weather[selectedWeather.id]?.subtitleKo}
              </p>
              <dl className="network-kpi-grid network-weather-grid">
                <div>
                  <dt>상태</dt>
                  <dd>{selectedWeatherObservation?.conditionLabel ?? "관측 연결 중"}</dd>
                </div>
                <div>
                  <dt>위험</dt>
                  <dd data-risk={selectedWeatherObservation?.risk ?? "normal"}>
                    {selectedWeatherObservation?.riskLabel ?? "확인 중"}
                  </dd>
                </div>
                <div>
                  <dt>기온</dt>
                  <dd>{formatMetric(selectedWeatherObservation?.temperatureC, "℃")}</dd>
                </div>
                <div>
                  <dt>강수</dt>
                  <dd>{formatMetric(selectedWeatherObservation?.precipitationMm, "mm")}</dd>
                </div>
                <div>
                  <dt>풍속·돌풍</dt>
                  <dd>
                    {formatMetric(selectedWeatherObservation?.windSpeedKn, "kn")}
                    {selectedWeatherObservation?.windGustKn !== null &&
                    selectedWeatherObservation?.windGustKn !== undefined
                      ? ` · ${formatMetric(selectedWeatherObservation.windGustKn, "kn")}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>가시거리 실측</dt>
                  <dd>
                    {formatVisibility(
                      selectedWeatherObservation?.visibilityM,
                      selectedWeatherObservation?.visibilityIsMinimum,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>파고·주기</dt>
                  <dd>
                    {formatMetric(selectedWeatherObservation?.waveHeightM, "m")}
                    {selectedWeatherObservation?.wavePeriodS !== null &&
                    selectedWeatherObservation?.wavePeriodS !== undefined
                      ? ` · ${formatMetric(selectedWeatherObservation.wavePeriodS, "s")}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>해수면 온도</dt>
                  <dd>
                    {formatMetric(selectedWeatherObservation?.seaSurfaceTemperatureC, "℃")}
                  </dd>
                </div>
                <div>
                  <dt>해류</dt>
                  <dd>{formatMetric(selectedWeatherObservation?.oceanCurrentKmh, "km/h")}</dd>
                </div>
                <div>
                  <dt>가시거리 관측소</dt>
                  <dd>{selectedWeatherObservation?.visibilityStationId ?? "—"}</dd>
                </div>
              </dl>
              {selectedWeatherObservation?.riskReasons.length ? (
                <p className="network-weather-alert">
                  {selectedWeatherObservation.riskReasons.join(" · ")}
                </p>
              ) : null}
              <button onClick={() => setWeatherAttempt((attempt) => attempt + 1)} type="button">
                실황 새로고침
              </button>
              <p className="network-detail-panel__note">
                {weatherData?.attribution ?? "MET Norway · Open-Meteo · AviationWeather"}
                <br />운항 승인용이 아닌 노선 위험 모니터링용 참고 실황입니다.
              </p>
            </>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}
