import type { MapLibrePromotionMap, NetworkMapPromotion } from "./map-promotion";
import {
  startMapLibreGlobe,
  type MapLibreMapCandidate,
  type MapLibreReadinessCallbacks,
  type MapLibreReadinessController,
} from "./maplibre-readiness";
import type { RemoteFreeGlobeStyle } from "./network-map-style";
import type { RendererDiagnostics } from "./renderer-diagnostics";

export const DEFAULT_NETWORK_CAMERA = {
  center: [126.2, 27.5] as const,
  zoom: 1.42,
  bearing: -7,
  pitch: 0,
} as const;

export const REQUIRED_MAPLIBRE_VERSION = "6.3.0" as const;

export interface NetworkMapLibreMap
  extends MapLibreMapCandidate,
    MapLibrePromotionMap {}

export interface NetworkMapLibreOptions {
  readonly container: HTMLElement;
  readonly style: RemoteFreeGlobeStyle;
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
  readonly canvasContextAttributes: {
    readonly contextType: "webgl2";
    readonly antialias: boolean;
    readonly powerPreference: "high-performance";
  };
  readonly renderWorldCopies: false;
  readonly interactive: true;
  readonly keyboard: true;
  readonly scrollZoom: true;
  readonly touchZoomRotate: true;
  readonly touchPitch: true;
  readonly trackResize: true;
  readonly attributionControl: false;
  readonly maplibreLogo: false;
}

export interface NetworkMapLibreModule {
  readonly Map: new (options: NetworkMapLibreOptions) => NetworkMapLibreMap;
  readonly setWorkerUrl: (workerUrl: string) => void;
  readonly getVersion: () => string;
}

export interface StartNetworkMapLibreOptions
  extends Omit<MapLibreReadinessCallbacks<NetworkMapLibreMap>, "onReady"> {
  readonly module: NetworkMapLibreModule;
  readonly container: HTMLElement;
  readonly style: RemoteFreeGlobeStyle;
  readonly workerUrl: string;
  readonly currentUrl: string;
  readonly webGl2Supported: boolean;
  readonly promotion: NetworkMapPromotion;
  readonly diagnostics: RendererDiagnostics;
  readonly onReady: (map: NetworkMapLibreMap, version: string) => void;
  readonly scheduleMicrotask?: (callback: () => void) => void;
}

export function resolveSameOriginAssetUrl(
  assetUrl: string,
  currentUrl: string,
): string {
  const current = new URL(currentUrl);
  const resolved = new URL(assetUrl, current);
  if (resolved.origin !== current.origin) {
    throw new Error("MapLibre worker must be served from the current origin");
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new Error("MapLibre worker requires an HTTP(S) origin");
  }
  return resolved.href;
}

export function createNetworkMapLibreOptions(
  container: HTMLElement,
  style: RemoteFreeGlobeStyle,
): NetworkMapLibreOptions {
  return {
    container,
    style,
    ...DEFAULT_NETWORK_CAMERA,
    canvasContextAttributes: {
      contextType: "webgl2",
      antialias: true,
      powerPreference: "high-performance",
    },
    renderWorldCopies: false,
    interactive: true,
    keyboard: true,
    scrollZoom: true,
    touchZoomRotate: true,
    touchPitch: true,
    trackResize: true,
    attributionControl: false,
    maplibreLogo: false,
  };
}

export function startNetworkMapLibreGlobe(
  options: StartNetworkMapLibreOptions,
): MapLibreReadinessController | null {
  if (!options.webGl2Supported) {
    options.diagnostics.mark("capability", "failed", "WEBGL2_UNSUPPORTED");
    options.onFallback("WEBGL2_UNSUPPORTED");
    return null;
  }

  const version = options.module.getVersion();
  if (version !== REQUIRED_MAPLIBRE_VERSION) {
    options.diagnostics.mark("constructor", "failed", "MAPLIBRE_VERSION_MISMATCH");
    options.onPromotionFailure(
      new Error(
        `Expected MapLibre ${REQUIRED_MAPLIBRE_VERSION}, received ${version}`,
      ),
    );
    return null;
  }

  let workerUrl: string;
  try {
    workerUrl = resolveSameOriginAssetUrl(options.workerUrl, options.currentUrl);
    options.module.setWorkerUrl(workerUrl);
    options.diagnostics.mark("capability", "passed", "WORKER_SAME_ORIGIN");
  } catch (error) {
    options.diagnostics.mark("capability", "failed", "WORKER_ORIGIN_INVALID");
    options.onPromotionFailure(error);
    return null;
  }

  options.diagnostics.mark("constructor", "started", `MAPLIBRE_${version}`);

  const readiness = startMapLibreGlobe<NetworkMapLibreMap>({
    webGl2Supported: true,
    createMap: () =>
      new options.module.Map(
        createNetworkMapLibreOptions(options.container, options.style),
      ),
    scheduleMicrotask: options.scheduleMicrotask,
    onReady: (map) => {
      options.diagnostics.mark("globe", "passed", "PROJECTION_GLOBE");
      if (!options.promotion.promote(map)) {
        options.diagnostics.mark("promotion", "failed", "PROMOTION_REJECTED");
        options.onPromotionFailure(new Error("Map promotion was rejected"));
        return;
      }
      options.diagnostics.mark("promotion", "passed", "LAYERS_INSTALLED");
      options.diagnostics.mark("ready", "passed", "GLOBE_READY");
      options.onReady(map, version);
    },
    onFallback: (reason, error) => {
      options.diagnostics.mark("fallback", "passed", reason);
      options.onFallback(reason, error);
    },
    onPromotionFailure: (error) => {
      options.diagnostics.mark("globe", "failed", "GLOBE_PROMOTION_FAILED");
      options.onPromotionFailure(error);
    },
    onRecoverableError: (error) => {
      options.diagnostics.mark("style", "degraded", "RECOVERABLE_MAP_ERROR");
      options.onRecoverableError?.(error);
    },
  });

  if (!readiness) {
    return null;
  }
  return {
    promoted: () => readiness.promoted() && options.promotion.promoted(),
    dispose: () => {
      options.promotion.dispose();
      readiness.dispose();
    },
  };
}
