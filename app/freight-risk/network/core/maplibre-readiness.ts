import type { StaticFallbackReason } from "./renderer-state";

export interface MapLibreCanvasLike {
  getContext(contextId: "webgl2"): unknown | null;
  addEventListener(
    type: "webglcontextlost",
    listener: (event: WebGLContextEventLike) => void,
  ): void;
  removeEventListener(
    type: "webglcontextlost",
    listener: (event: WebGLContextEventLike) => void,
  ): void;
}

export interface WebGLContextEventLike {
  preventDefault(): void;
}

export interface MapLibreErrorEventLike {
  readonly error?: unknown;
}

export type MapLibreMapEventName = "style.load" | "load" | "idle" | "error";

export interface MapLibreMapCandidate {
  getCanvas(): MapLibreCanvasLike;
  getProjection(): { readonly type: string };
  setProjection(projection: { readonly type: "globe" }): void;
  isStyleLoaded(): boolean;
  once(type: "style.load", listener: () => void): unknown;
  on(type: "load" | "idle", listener: () => void): unknown;
  on(type: "error", listener: (event: MapLibreErrorEventLike) => void): unknown;
  off(type: "style.load" | "load" | "idle", listener: () => void): unknown;
  off(type: "error", listener: (event: MapLibreErrorEventLike) => void): unknown;
  remove(): void;
}

export interface MapLibreReadinessCallbacks {
  readonly onReady: (map: MapLibreMapCandidate) => void;
  readonly onFallback: (reason: StaticFallbackReason, error?: unknown) => void;
  readonly onPromotionFailure: (error?: unknown) => void;
  readonly onRecoverableError?: (error: unknown) => void;
}

export interface MapLibreReadinessController {
  readonly promoted: () => boolean;
  readonly dispose: () => void;
}

export interface MapLibreGlobeStartOptions extends MapLibreReadinessCallbacks {
  readonly webGl2Supported: boolean;
  readonly createMap: () => MapLibreMapCandidate;
  readonly scheduleMicrotask?: (callback: () => void) => void;
}

function safelyRemove(map: MapLibreMapCandidate): void {
  try {
    map.remove();
  } catch {
    // A GPU initialization failure can leave a partial MapLibre instance.
  }
}

function readUsableCanvas(map: MapLibreMapCandidate): MapLibreCanvasLike | null {
  try {
    const canvas = map.getCanvas();
    return canvas && canvas.getContext("webgl2") !== null ? canvas : null;
  } catch {
    return null;
  }
}

export function isGpuInitializationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { readonly name?: unknown; readonly message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return (
    name === "GPUInitializationError" ||
    /webgl\s*2.*(?:required|unavailable)|gpu initialization/i.test(message)
  );
}

export function withConfirmedMapLibreGlobe(
  map: MapLibreMapCandidate,
): boolean {
  try {
    return (
      readUsableCanvas(map) !== null && map.getProjection().type === "globe"
    );
  } catch {
    return false;
  }
}

export function attachMapLibreReadiness(
  map: MapLibreMapCandidate,
  callbacks: MapLibreReadinessCallbacks,
  scheduleMicrotask: (callback: () => void) => void = queueMicrotask,
): MapLibreReadinessController {
  const canvas = readUsableCanvas(map);
  let disposed = false;
  let terminal = false;
  let readyStarted = false;
  let isPromoted = false;

  const detach = (): void => {
    const operations: readonly (() => void)[] = [
      () => canvas?.removeEventListener("webglcontextlost", handleContextLost),
      () => void map.off("style.load", handleReady),
      () => void map.off("load", enforceGlobe),
      () => void map.off("idle", enforceGlobe),
      () => void map.off("error", handleError),
    ];
    for (const operation of operations) {
      try {
        operation();
      } catch {
        // Partial MapLibre instances are disposed best-effort.
      }
    }
  };

  const failToFallback = (
    reason: StaticFallbackReason,
    error?: unknown,
  ): void => {
    if (disposed || terminal) {
      return;
    }
    terminal = true;
    detach();
    safelyRemove(map);
    callbacks.onFallback(reason, error);
  };

  const failPromotion = (error?: unknown): void => {
    if (disposed || terminal) {
      return;
    }
    terminal = true;
    detach();
    safelyRemove(map);
    callbacks.onPromotionFailure(error);
  };

  function handleContextLost(event: WebGLContextEventLike): void {
    event.preventDefault();
    failToFallback("CONTEXT_LOST");
  }

  function handleError(event: MapLibreErrorEventLike): void {
    const error = event.error ?? event;
    if (!isPromoted && isGpuInitializationError(error)) {
      failToFallback("GPU_INIT_FAILED", error);
      return;
    }
    callbacks.onRecoverableError?.(error);
  }

  function enforceGlobe(): void {
    if (disposed || terminal) {
      return;
    }
    try {
      if (map.getProjection().type !== "globe") {
        map.setProjection({ type: "globe" });
      }
    } catch (error) {
      callbacks.onRecoverableError?.(error);
    }
  }

  function handleReady(): void {
    if (disposed || terminal || readyStarted) {
      return;
    }
    readyStarted = true;

    try {
      map.setProjection({ type: "globe" });
    } catch (error) {
      failPromotion(error);
      return;
    }

    if (!readUsableCanvas(map)) {
      failToFallback("GPU_INIT_FAILED");
      return;
    }

    if (!withConfirmedMapLibreGlobe(map)) {
      failPromotion();
      return;
    }

    if (disposed || terminal) {
      return;
    }
    isPromoted = true;
    callbacks.onReady(map);
  }

  if (!canvas) {
    terminal = true;
    safelyRemove(map);
    callbacks.onFallback("GPU_INIT_FAILED");
    return {
      promoted: () => false,
      dispose: () => {
        disposed = true;
      },
    };
  }

  try {
    canvas.addEventListener("webglcontextlost", handleContextLost);
    map.on("error", handleError);
    map.once("style.load", handleReady);
    map.on("load", enforceGlobe);
    map.on("idle", enforceGlobe);
  } catch (error) {
    failPromotion(error);
    return {
      promoted: () => false,
      dispose: () => {
        disposed = true;
      },
    };
  }

  try {
    if (map.isStyleLoaded()) {
      scheduleMicrotask(handleReady);
    }
  } catch (error) {
    callbacks.onRecoverableError?.(error);
  }

  return {
    promoted: () => isPromoted,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      detach();
      safelyRemove(map);
    },
  };
}

export function startMapLibreGlobe(
  options: MapLibreGlobeStartOptions,
): MapLibreReadinessController | null {
  if (!options.webGl2Supported) {
    options.onFallback("WEBGL2_UNSUPPORTED");
    return null;
  }

  let map: MapLibreMapCandidate;
  try {
    map = options.createMap();
  } catch (error) {
    if (isGpuInitializationError(error)) {
      options.onFallback("GPU_INIT_FAILED", error);
    } else {
      options.onPromotionFailure(error);
    }
    return null;
  }

  return attachMapLibreReadiness(
    map,
    options,
    options.scheduleMicrotask ?? queueMicrotask,
  );
}
