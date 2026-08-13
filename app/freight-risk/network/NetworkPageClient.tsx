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
  catalogToNetworkGeoJson,
  createNetworkFeatureStateController,
  createNetworkMapLayers,
  createNetworkMapPromotion,
  createRemoteFreeGlobeStyle,
  createRendererDiagnostics,
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
  type NetworkMapLibreModule,
  type NetworkSelectionState,
  type RendererState,
  type StaticFallbackReason,
  type StaticViewport,
} from "./core";
import {
  KNEI_CHOKEPOINT_LABELS,
  KNEI_PORT_LABELS,
  KNEI_REFERENCE_FIXTURE,
} from "./knei-reference-fixture";

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

const INITIAL_SELECTION: NetworkSelectionState = {
  navigationRouteId: "KNEI",
  portId: null,
  mapRouteId: "KNEI",
  chokepointId: null,
  weatherId: null,
  overlapRouteIds: [],
};

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

function activationKey(event: KeyboardEvent<SVGGElement>, activate: () => void): void {
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

interface StaticMapProps {
  readonly viewport: StaticViewport;
  readonly onViewport: (viewport: StaticViewport) => void;
  readonly selection: NetworkSelectionState;
  readonly onRoute: () => void;
  readonly onPort: (portId: string) => void;
  readonly onChokepoint: (chokepointId: string) => void;
}

function StaticNetworkMap({
  viewport,
  onViewport,
  selection,
  onRoute,
  onPort,
  onChokepoint,
}: StaticMapProps) {
  const dragRef = useRef<{ x: number; y: number; viewport: StaticViewport } | null>(null);
  const routeSegments = useMemo(
    () =>
      splitAntimeridian(KNEI_REFERENCE_FIXTURE.routes[0]!.waypointCoordinates).map(
        (segment) => segment.map((coordinate) => projectWebMercator(coordinate, 1000, 500)),
      ),
    [],
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
        {routeSegments.map((segment, index) => (
          <polyline
            aria-label="KNEI 유럽 노선"
            className={
              selection.mapRouteId === "KNEI"
                ? "network-static-map__route is-selected"
                : "network-static-map__route"
            }
            key={`route-${index}`}
            onClick={onRoute}
            onKeyDown={(event) => activationKey(event, onRoute)}
            points={segment.map(({ x, y }) => `${x},${y}`).join(" ")}
            role="button"
            tabIndex={0}
          />
        ))}
        {KNEI_REFERENCE_FIXTURE.chokepoints.map((chokepoint) => {
          const point = projectWebMercator(
            [chokepoint.longitude, chokepoint.latitude],
            1000,
            500,
          );
          const activate = () => onChokepoint(chokepoint.id);
          return (
            <g
              aria-label={KNEI_CHOKEPOINT_LABELS[chokepoint.id] ?? chokepoint.id}
              className={
                selection.chokepointId === chokepoint.id
                  ? "network-static-map__choke is-selected"
                  : "network-static-map__choke"
              }
              key={chokepoint.id}
              onClick={activate}
              onKeyDown={(event) => activationKey(event, activate)}
              role="button"
              tabIndex={0}
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle className="network-static-map__hit" r="16" />
              <circle r="5" />
            </g>
          );
        })}
        {KNEI_REFERENCE_FIXTURE.ports.map((port) => {
          const point = projectWebMercator([port.longitude, port.latitude], 1000, 500);
          const activate = () => onPort(port.id);
          return (
            <g
              aria-label={`${KNEI_PORT_LABELS[port.id] ?? port.id}, KNEI 노선`}
              className={
                selection.portId === port.id
                  ? "network-static-map__port is-selected"
                  : "network-static-map__port"
              }
              key={port.id}
              onClick={activate}
              onKeyDown={(event) => activationKey(event, activate)}
              role="button"
              tabIndex={0}
              transform={`translate(${point.x} ${point.y})`}
            >
              <circle className="network-static-map__hit" r="13" />
              <circle r={port.primary ? 6 : 4.5} />
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
    </div>
  );
}

export function NetworkPageClient() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const featureStateRef = useRef<ReturnType<typeof createNetworkFeatureStateController> | null>(
    null,
  );
  const [renderer, dispatchRenderer] = useReducer(reduceRendererState, INITIAL_RENDERER_STATE);
  const [selection, dispatchSelection] = useReducer(reduceNetworkSelection, INITIAL_SELECTION);
  const [focusMode, setFocusMode] = useState<NetworkFocusMode>("combined");
  const [viewport, setViewport] = useState(DEFAULT_STATIC_VIEWPORT);
  const [legendOpen, setLegendOpen] = useState(false);
  const [diagnosticCode, setDiagnosticCode] = useState("BOOT");
  const sources = useMemo(() => catalogToNetworkGeoJson(KNEI_REFERENCE_FIXTURE), []);
  const layers = useMemo(() => createNetworkMapLayers(MAP_PALETTE), []);
  const panel = visibleNetworkPanel(selection);

  const selectRoute = useCallback((): void => {
    dispatchSelection({ type: "SELECT_ROUTE", routeId: "KNEI" });
    mapRef.current?.easeTo({ center: [65, 30], zoom: 1.55, duration: 800 });
  }, []);
  const selectPort = useCallback((portId: string): void => {
    dispatchSelection({ type: "SELECT_PORT", portId, routeId: "KNEI" });
    const port = KNEI_REFERENCE_FIXTURE.ports.find(({ id }) => id === portId);
    if (port) {
      mapRef.current?.easeTo({ center: [port.longitude, port.latitude], zoom: 4.6, duration: 700 });
    }
  }, []);
  const selectChokepoint = useCallback((chokepointId: string): void => {
    dispatchSelection({ type: "SELECT_CHOKEPOINT", chokepointId });
    const chokepoint = KNEI_REFERENCE_FIXTURE.chokepoints.find(
      ({ id }) => id === chokepointId,
    );
    if (chokepoint) {
      mapRef.current?.easeTo({
        center: [chokepoint.longitude, chokepoint.latitude],
        zoom: 4,
        duration: 700,
      });
    }
  }, []);

  useEffect(() => {
    featureStateRef.current?.apply(selection);
  }, [selection]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let controller: ReturnType<typeof startNetworkMapLibreGlobe> = null;
    dispatchRenderer({ type: "START" });
    const diagnostics = createRendererDiagnostics();

    const start = async (): Promise<void> => {
      const webGl2Supported = supportsWebGl2();
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
          featureStateRef.current = createNetworkFeatureStateController(map, () => {
            dispatchRenderer({ type: "DEGRADE", degradation: "CATALOG_UNAVAILABLE" });
          });
          map.on("click", (event) => {
            const features = map.queryRenderedFeatures(event.point, {
              layers: [...NETWORK_HIT_LAYER_IDS],
            });
            const hits = {
              weather: [],
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
            if (intent.kind === "port") selectPort(intent.id);
            if (intent.kind === "chokepoint") selectChokepoint(intent.id);
            if (intent.kind === "route") selectRoute();
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
        webGl2Supported,
        promotion,
        diagnostics,
        onReady: () => {
          if (disposed) return;
          setDiagnosticCode("GLOBE_READY");
          dispatchRenderer({ type: "READY" });
        },
        onFallback: (reason) => {
          if (disposed) return;
          setDiagnosticCode(reason);
          dispatchRenderer({ type: "FALLBACK", reason });
        },
        onPromotionFailure: () => {
          if (disposed) return;
          setDiagnosticCode("GLOBE_PROMOTION_FAILED");
          dispatchRenderer({ type: "PROMOTION_FAILED" });
        },
        onRecoverableError: () => {
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
  }, [layers, selectChokepoint, selectPort, selectRoute, sources]);

  const staticMode = renderer.kind === "static2d";
  return (
    <main
      aria-label="글로벌 항만 네트워크"
      className="network-page"
      data-renderer-stage={renderer.kind}
      data-renderer-diagnostic={diagnosticCode}
    >
      <div aria-hidden={staticMode} className="network-map-host" ref={hostRef} />
      {staticMode ? (
        <StaticNetworkMap
          onChokepoint={selectChokepoint}
          onPort={selectPort}
          onRoute={selectRoute}
          onViewport={setViewport}
          selection={selection}
          viewport={viewport}
        />
      ) : null}

      <header className="network-header">
        <div>
          <p className="network-eyebrow">GLOBAL PORT NETWORK · KNEI</p>
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
                  setFocusMode(moveNetworkFocusMode(mode, "next"));
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setFocusMode(moveNetworkFocusMode(mode, "previous"));
                }
              }}
              role="radio"
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
        <button className="network-reset" onClick={selectRoute} type="button">
          Reset
        </button>
      </section>

      <nav aria-label="네트워크 항목 탐색" className="network-explorer">
        <button onClick={selectRoute} type="button">
          KNEI · 유럽 노선
        </button>
        {KNEI_REFERENCE_FIXTURE.ports.map((port) => (
          <button key={port.id} onClick={() => selectPort(port.id)} type="button">
            {KNEI_PORT_LABELS[port.id] ?? port.id}
          </button>
        ))}
        {KNEI_REFERENCE_FIXTURE.chokepoints.map((chokepoint) => (
          <button
            key={chokepoint.id}
            onClick={() => selectChokepoint(chokepoint.id)}
            type="button"
          >
            {KNEI_CHOKEPOINT_LABELS[chokepoint.id] ?? chokepoint.id}
          </button>
        ))}
      </nav>

      {renderer.kind !== "globe_ready" && !staticMode ? (
        <div className="network-loading" role="status">
          <span />
          <strong>3D GLOBE</strong>
        </div>
      ) : null}

      {staticMode ? (
        <div className="network-fallback-notice" role="status">
          <strong>{FALLBACK_LABELS[renderer.reason]}</strong>
          <span>네트워크 레이어는 계속 사용할 수 있습니다.</span>
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
            <li><i className="legend-route" /> 대표 해상 회랑</li>
            <li><i className="legend-port" /> 목적항</li>
            <li><i className="legend-choke" /> 초크포인트</li>
            <li><i className="legend-selected" /> 선택 항목</li>
          </ul>
        ) : null}
      </section>

      {panel.kind !== "none" ? (
        <aside aria-live="polite" className="network-detail-panel">
          <button
            aria-label="선택 정보 닫기"
            className="network-detail-panel__close"
            onClick={() => dispatchSelection({ type: "CLOSE_DETAIL" })}
            type="button"
          >
            ×
          </button>
          {panel.kind === "route" ? (
            <>
              <p className="network-eyebrow">KNEI</p>
              <h2>유럽 노선</h2>
              <dl>
                <div><dt>출발</dt><dd>부산항</dd></div>
                <div><dt>등록 목적항</dt><dd>5개 · FIXTURE</dd></div>
                <div><dt>물동량</dt><dd>UNAVAILABLE</dd></div>
              </dl>
              <p className="network-detail-panel__note">
                노선은 항만 선택을 위한 권역 필터입니다. 물동량은 각 항만 포인트를 선택해 확인하세요.
              </p>
            </>
          ) : null}
          {panel.kind === "port" ? (
            <>
              <p className="network-eyebrow">KNEI · FIXTURE</p>
              <h2>{KNEI_PORT_LABELS[panel.id] ?? panel.id}</h2>
              <dl>
                <div><dt>항만 물동량</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>기상</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>데이터 경계</dt><dd>WT6 연결 대기</dd></div>
              </dl>
            </>
          ) : null}
          {panel.kind === "chokepoint" ? (
            <>
              <p className="network-eyebrow">KNEI · FIXTURE</p>
              <h2>{KNEI_CHOKEPOINT_LABELS[panel.id] ?? panel.id}</h2>
              <dl>
                <div><dt>대표 경로 이용</dt><dd>KNEI</dd></div>
                <div><dt>추정 물동량</dt><dd>UNAVAILABLE</dd></div>
                <div><dt>통항 척수</dt><dd>UNAVAILABLE</dd></div>
              </dl>
            </>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}
