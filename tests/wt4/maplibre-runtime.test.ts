import assert from "node:assert/strict";
import test from "node:test";

import {
  createNetworkMapPromotion,
} from "../../app/freight-risk/network/core/map-promotion";
import type {
  MapLibreCanvasLike,
  MapLibreErrorEventLike,
  WebGLContextEventLike,
} from "../../app/freight-risk/network/core/maplibre-readiness";
import {
  createNetworkMapLibreOptions,
  REQUIRED_MAPLIBRE_VERSION,
  resolveSameOriginAssetUrl,
  startNetworkMapLibreGlobe,
  type NetworkMapLibreMap,
  type NetworkMapLibreModule,
  type NetworkMapLibreOptions,
} from "../../app/freight-risk/network/core/maplibre-runtime";
import { createRemoteFreeGlobeStyle } from "../../app/freight-risk/network/core/network-map-style";
import { createRendererDiagnostics } from "../../app/freight-risk/network/core/renderer-diagnostics";

const style = createRemoteFreeGlobeStyle({
  ocean: "ocean",
  sky: "sky",
  horizon: "horizon",
  atmosphere: "atmosphere",
  route: "route",
  routeShadow: "shadow",
  selection: "selection",
  chokepoint: "chokepoint",
  port: "port",
  weatherNormal: "normal",
  weatherWarning: "warning",
  weatherSevere: "severe",
});

class RuntimeCanvas implements MapLibreCanvasLike {
  listener: ((event: WebGLContextEventLike) => void) | null = null;

  getContext(): unknown | null {
    return { webgl2: true };
  }

  addEventListener(
    _type: "webglcontextlost",
    listener: (event: WebGLContextEventLike) => void,
  ): void {
    this.listener = listener;
  }

  removeEventListener(): void {
    this.listener = null;
  }
}

class RuntimeMap implements NetworkMapLibreMap {
  static constructed: RuntimeMap[] = [];
  readonly canvas = new RuntimeCanvas();
  readonly sources = new Map<string, unknown>();
  readonly layers = new Set<string>();
  readonly controls: string[] = [];
  readonly listeners = new Map<string, Set<(event: MapLibreErrorEventLike) => void>>();
  projection = "mercator";
  styleLoaded = false;
  removed = 0;

  constructor(readonly options: NetworkMapLibreOptions) {
    RuntimeMap.constructed.push(this);
  }

  getCanvas(): MapLibreCanvasLike {
    return this.canvas;
  }

  getProjection(): { readonly type: string } {
    return { type: this.projection };
  }

  setProjection(): void {
    this.projection = "globe";
  }

  isStyleLoaded(): boolean {
    return this.styleLoaded;
  }

  once(type: "style.load", listener: () => void): unknown {
    return this.subscribe(type, listener);
  }

  on(type: "load" | "idle", listener: () => void): unknown;
  on(type: "error", listener: (event: MapLibreErrorEventLike) => void): unknown;
  on(
    type: "load" | "idle" | "error",
    listener: (event: MapLibreErrorEventLike) => void,
  ): unknown {
    return this.subscribe(type, listener);
  }

  off(type: "style.load" | "load" | "idle", listener: () => void): unknown;
  off(type: "error", listener: (event: MapLibreErrorEventLike) => void): unknown;
  off(
    type: "style.load" | "load" | "idle" | "error",
    listener: (event: MapLibreErrorEventLike) => void,
  ): unknown {
    this.listeners.get(type)?.delete(listener);
    return this;
  }

  remove(): void {
    this.removed += 1;
  }

  getSource(id: string): unknown {
    return this.sources.get(id);
  }

  addSource(id: string, source: unknown): unknown {
    this.sources.set(id, source);
    return this;
  }

  getLayer(id: string): unknown {
    return this.layers.has(id) ? id : undefined;
  }

  addLayer(layer: { readonly id: string }): unknown {
    this.layers.add(layer.id);
    return this;
  }

  addControl(control: unknown, position?: string): unknown {
    this.controls.push(`${String(control)}:${position}`);
    return this;
  }

  emit(type: "style.load" | "load" | "idle"): void {
    for (const listener of this.listeners.get(type) ?? []) listener({});
  }

  private subscribe(
    type: string,
    listener: (event: MapLibreErrorEventLike) => void,
  ): unknown {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
    return this;
  }
}

function createModule(
  events: string[],
  version: string = REQUIRED_MAPLIBRE_VERSION,
): NetworkMapLibreModule {
  return {
    Map: class extends RuntimeMap {
      constructor(options: NetworkMapLibreOptions) {
        events.push("constructor");
        super(options);
      }
    },
    setWorkerUrl: (url) => events.push(`worker:${url}`),
    getVersion: () => version,
  };
}

function emptyPromotion(): ReturnType<typeof createNetworkMapPromotion> {
  return createNetworkMapPromotion({
    sources: {
      "network-routes": { type: "FeatureCollection", features: [] },
      "network-connectors": { type: "FeatureCollection", features: [] },
      "network-chokepoint-corridors": { type: "FeatureCollection", features: [] },
      "network-chokepoint-gates": { type: "FeatureCollection", features: [] },
      "network-chokepoints": { type: "FeatureCollection", features: [] },
      "network-ports": { type: "FeatureCollection", features: [] },
      "network-weather": { type: "FeatureCollection", features: [] },
    },
    layers: [],
    createNavigationControl: () => "navigation",
    createScaleControl: () => "scale",
    installInteractions: () => undefined,
    exposeMap: () => undefined,
    onDegradation: () => undefined,
  });
}

const container = Object.create(null) as HTMLElement;

test("worker URL must resolve to the current HTTP origin", () => {
  assert.equal(
    resolveSameOriginAssetUrl(
      "/assets/maplibre-gl-worker.js",
      "http://127.0.0.1:3104/freight-risk/network",
    ),
    "http://127.0.0.1:3104/assets/maplibre-gl-worker.js",
  );
  assert.throws(
    () =>
      resolveSameOriginAssetUrl(
        "https://cdn.example.com/worker.js",
        "http://127.0.0.1:3104/freight-risk/network",
      ),
    /current origin/,
  );
});

test("constructor options force WebGL2 and the approved initial globe camera", () => {
  const options = createNetworkMapLibreOptions(container, style);
  assert.deepEqual(options.center, [126.2, 27.5]);
  assert.equal(options.zoom, 1.42);
  assert.equal(options.bearing, -7);
  assert.equal(options.pitch, 0);
  assert.equal(options.canvasContextAttributes.contextType, "webgl2");
  assert.equal(options.renderWorldCopies, false);
  assert.equal(options.interactive, true);
});

test("same-version worker is configured before construction and style readiness promotes once", () => {
  RuntimeMap.constructed = [];
  const events: string[] = [];
  let ready = 0;
  const controller = startNetworkMapLibreGlobe({
    module: createModule(events),
    container,
    style,
    workerUrl: "/assets/maplibre-gl-worker.js",
    currentUrl: "http://127.0.0.1:3104/freight-risk/network",
    webGl2Supported: true,
    promotion: emptyPromotion(),
    diagnostics: createRendererDiagnostics(() => 0),
    onReady: () => {
      ready += 1;
    },
    onFallback: () => assert.fail("fallback is not expected"),
    onPromotionFailure: () => assert.fail("promotion failure is not expected"),
  });

  assert.deepEqual(events, [
    "worker:http://127.0.0.1:3104/assets/maplibre-gl-worker.js",
    "constructor",
  ]);
  assert.equal(ready, 0);
  const map = RuntimeMap.constructed[0]!;
  map.emit("style.load");
  map.emit("style.load");
  assert.equal(ready, 1);
  assert.equal(controller?.promoted(), true);
  assert.equal(map.controls.length, 2);
});

test("unexpected package version blocks map and worker creation", () => {
  RuntimeMap.constructed = [];
  const events: string[] = [];
  let failed = 0;
  const controller = startNetworkMapLibreGlobe({
    module: createModule(events, "6.2.0"),
    container,
    style,
    workerUrl: "/assets/maplibre-gl-worker.js",
    currentUrl: "http://127.0.0.1:3104/freight-risk/network",
    webGl2Supported: true,
    promotion: emptyPromotion(),
    diagnostics: createRendererDiagnostics(() => 0),
    onReady: () => assert.fail("wrong package version cannot be ready"),
    onFallback: () => assert.fail("version mismatch is not a GPU fallback"),
    onPromotionFailure: () => {
      failed += 1;
    },
  });
  assert.equal(controller, null);
  assert.equal(failed, 1);
  assert.deepEqual(events, []);
  assert.equal(RuntimeMap.constructed.length, 0);
});

test("unsupported WebGL2 transitions before worker or constructor setup", () => {
  RuntimeMap.constructed = [];
  const events: string[] = [];
  let fallback = "";
  const controller = startNetworkMapLibreGlobe({
    module: createModule(events),
    container,
    style,
    workerUrl: "/assets/maplibre-gl-worker.js",
    currentUrl: "http://127.0.0.1:3104/freight-risk/network",
    webGl2Supported: false,
    promotion: emptyPromotion(),
    diagnostics: createRendererDiagnostics(() => 0),
    onReady: () => assert.fail("unsupported WebGL2 cannot be ready"),
    onFallback: (reason) => {
      fallback = reason;
    },
    onPromotionFailure: () => assert.fail("unsupported is not promotion failure"),
  });
  assert.equal(controller, null);
  assert.equal(fallback, "WEBGL2_UNSUPPORTED");
  assert.deepEqual(events, []);
  assert.equal(RuntimeMap.constructed.length, 0);
});
