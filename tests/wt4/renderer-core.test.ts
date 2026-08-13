import assert from "node:assert/strict";
import test from "node:test";

import {
  attachMapLibreReadiness,
  startMapLibreGlobe,
  type MapLibreCanvasLike,
  type MapLibreErrorEventLike,
  type MapLibreMapCandidate,
  type WebGLContextEventLike,
} from "../../app/freight-risk/network/core/maplibre-readiness";
import {
  INITIAL_RENDERER_STATE,
  reduceRendererState,
} from "../../app/freight-risk/network/core/renderer-state";

class MockCanvas implements MapLibreCanvasLike {
  private contextLostListener: ((event: WebGLContextEventLike) => void) | null = null;

  constructor(private readonly supportsWebGl2: boolean) {}

  getContext(): unknown | null {
    return this.supportsWebGl2 ? { version: 2 } : null;
  }

  addEventListener(
    _type: "webglcontextlost",
    listener: (event: WebGLContextEventLike) => void,
  ): void {
    this.contextLostListener = listener;
  }

  removeEventListener(
    _type: "webglcontextlost",
    listener: (event: WebGLContextEventLike) => void,
  ): void {
    if (this.contextLostListener === listener) this.contextLostListener = null;
  }

  loseContext(): boolean {
    let prevented = false;
    this.contextLostListener?.({
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  }
}

class MockMap implements MapLibreMapCandidate {
  readonly canvas: MockCanvas;
  removed = 0;
  setProjectionCalls = 0;
  projection = "mercator";
  styleLoaded: boolean;
  private readonly listeners = new Map<
    string,
    Set<(event: MapLibreErrorEventLike) => void>
  >();

  constructor(supportsWebGl2: boolean, styleLoaded = false) {
    this.canvas = new MockCanvas(supportsWebGl2);
    this.styleLoaded = styleLoaded;
  }

  getCanvas(): MapLibreCanvasLike {
    return this.canvas;
  }

  getProjection(): { readonly type: string } {
    return { type: this.projection };
  }

  setProjection(): void {
    this.setProjectionCalls += 1;
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

  emit(type: "style.load" | "load" | "idle" | "error", error?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ error });
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

test("partial MapLibre candidate never promotes controls or data", () => {
  const map = new MockMap(false);
  let promotions = 0;
  let fallback = "";

  const controller = attachMapLibreReadiness(map, {
    onReady: () => {
      promotions += 1;
    },
    onFallback: (reason) => {
      fallback = reason;
    },
    onPromotionFailure: () => assert.fail("projection failure is not expected"),
  });

  assert.equal(promotions, 0);
  assert.equal(controller.promoted(), false);
  assert.equal(fallback, "GPU_INIT_FAILED");
  assert.equal(map.removed, 1);
});

test("capability gate skips construction only when WebGL2 is unavailable", () => {
  let constructions = 0;
  let fallback = "";
  const controller = startMapLibreGlobe({
    webGl2Supported: false,
    createMap: () => {
      constructions += 1;
      return new MockMap(true);
    },
    onReady: () => assert.fail("unsupported browser cannot be ready"),
    onFallback: (reason) => {
      fallback = reason;
    },
    onPromotionFailure: () => assert.fail("unsupported is not promotion failure"),
  });
  assert.equal(controller, null);
  assert.equal(constructions, 0);
  assert.equal(fallback, "WEBGL2_UNSUPPORTED");
});

test("synchronous GPU initialization failure is captured", () => {
  let fallback = "";
  const controller = startMapLibreGlobe({
    webGl2Supported: true,
    createMap: () => {
      const error = new Error("WebGL2 required");
      error.name = "GPUInitializationError";
      throw error;
    },
    onReady: () => assert.fail("failed construction cannot promote"),
    onFallback: (reason) => {
      fallback = reason;
    },
    onPromotionFailure: () => assert.fail("GPU failure must use fallback"),
  });
  assert.equal(controller, null);
  assert.equal(fallback, "GPU_INIT_FAILED");
});

test("style.load promotes a valid WebGL2 globe exactly once", () => {
  const map = new MockMap(true);
  let promotions = 0;
  let fallbacks = 0;
  attachMapLibreReadiness(map, {
    onReady: () => {
      promotions += 1;
    },
    onFallback: () => {
      fallbacks += 1;
    },
    onPromotionFailure: () => assert.fail("valid globe must promote"),
  });

  assert.equal(promotions, 0, "projection is not required immediately after construction");
  map.emit("style.load");
  map.emit("style.load");
  map.emit("load");
  map.emit("idle");

  assert.equal(promotions, 1);
  assert.equal(fallbacks, 0);
  assert.equal(map.projection, "globe");
  assert.equal(map.setProjectionCalls, 1);
});

test("already-loaded style and style.load event share the same readiness latch", () => {
  const map = new MockMap(true, true);
  const scheduled: (() => void)[] = [];
  let promotions = 0;
  attachMapLibreReadiness(
    map,
    {
      onReady: () => {
        promotions += 1;
      },
      onFallback: () => assert.fail("fallback is not expected"),
      onPromotionFailure: () => assert.fail("promotion failure is not expected"),
    },
    (callback) => scheduled.push(callback),
  );

  map.emit("style.load");
  scheduled.forEach((callback) => callback());
  assert.equal(promotions, 1);
});

test("recoverable source error does not demote a healthy candidate", () => {
  const map = new MockMap(true);
  let recovered = 0;
  let fallbacks = 0;
  attachMapLibreReadiness(map, {
    onReady: () => undefined,
    onFallback: () => {
      fallbacks += 1;
    },
    onPromotionFailure: () => assert.fail("promotion failure is not expected"),
    onRecoverableError: () => {
      recovered += 1;
    },
  });

  map.emit("error", new Error("tile request failed"));
  map.emit("style.load");
  assert.equal(recovered, 1);
  assert.equal(fallbacks, 0);
});

test("context loss prevents default and transitions to fallback", () => {
  const map = new MockMap(true);
  let fallback = "";
  attachMapLibreReadiness(map, {
    onReady: () => undefined,
    onFallback: (reason) => {
      fallback = reason;
    },
    onPromotionFailure: () => assert.fail("promotion failure is not expected"),
  });
  map.emit("style.load");

  assert.equal(map.canvas.loseContext(), true);
  assert.equal(fallback, "CONTEXT_LOST");
  assert.equal(map.removed, 1);
});

test("renderer reducer keeps data errors as degradation and reserves 2D for GPU failures", () => {
  const starting = reduceRendererState(INITIAL_RENDERER_STATE, { type: "START" });
  const degraded = reduceRendererState(starting, {
    type: "DEGRADE",
    degradation: "WEATHER_UNAVAILABLE",
  });
  const ready = reduceRendererState(degraded, { type: "READY" });
  assert.equal(ready.kind, "globe_ready");
  assert.deepEqual("degradations" in ready ? ready.degradations : [], [
    "WEATHER_UNAVAILABLE",
  ]);

  const fallback = reduceRendererState(ready, { type: "CONTEXT_LOST" });
  assert.equal(fallback.kind, "static2d");
  assert.equal("reason" in fallback ? fallback.reason : "", "CONTEXT_LOST");
});
