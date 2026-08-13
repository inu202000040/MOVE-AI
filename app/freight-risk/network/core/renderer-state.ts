export type StaticFallbackReason =
  | "WEBGL2_UNSUPPORTED"
  | "GPU_INIT_FAILED"
  | "CONTEXT_LOST";

export type GlobeBlockReason = "GLOBE_PROMOTION_FAILED";

export type RendererDegradation =
  | "BASEMAP_UNAVAILABLE"
  | "CATALOG_UNAVAILABLE"
  | "TRAFFIC_UNAVAILABLE"
  | "WEATHER_UNAVAILABLE";

interface ActiveRendererState {
  readonly generation: number;
  readonly degradations: readonly RendererDegradation[];
}

export type RendererState =
  | { readonly kind: "boot" }
  | ({ readonly kind: "globe_starting" } & ActiveRendererState)
  | ({ readonly kind: "globe_ready" } & ActiveRendererState)
  | ({ readonly kind: "globe_blocked"; readonly reason: GlobeBlockReason } &
      ActiveRendererState)
  | ({ readonly kind: "static2d"; readonly reason: StaticFallbackReason } &
      ActiveRendererState)
  | { readonly kind: "disposed" };

export type RendererEvent =
  | { readonly type: "START" }
  | { readonly type: "READY" }
  | { readonly type: "PROMOTION_FAILED" }
  | { readonly type: "FALLBACK"; readonly reason: StaticFallbackReason }
  | { readonly type: "CONTEXT_LOST" }
  | { readonly type: "DEGRADE"; readonly degradation: RendererDegradation }
  | { readonly type: "RETRY" }
  | { readonly type: "DISPOSE" };

export const INITIAL_RENDERER_STATE: RendererState = { kind: "boot" };

function nextGeneration(state: RendererState): number {
  return "generation" in state ? state.generation + 1 : 1;
}

function addDegradation(
  degradations: readonly RendererDegradation[],
  degradation: RendererDegradation,
): readonly RendererDegradation[] {
  return degradations.includes(degradation)
    ? degradations
    : [...degradations, degradation];
}

export function reduceRendererState(
  state: RendererState,
  event: RendererEvent,
): RendererState {
  if (state.kind === "disposed") {
    return state;
  }

  if (event.type === "DISPOSE") {
    return { kind: "disposed" };
  }

  if (event.type === "START" && state.kind === "boot") {
    return {
      kind: "globe_starting",
      generation: 1,
      degradations: [],
    };
  }

  if (
    event.type === "RETRY" &&
    (state.kind === "static2d" || state.kind === "globe_blocked")
  ) {
    return {
      kind: "globe_starting",
      generation: nextGeneration(state),
      degradations: state.degradations,
    };
  }

  if (event.type === "DEGRADE" && "degradations" in state) {
    return {
      ...state,
      degradations: addDegradation(state.degradations, event.degradation),
    };
  }

  if (state.kind !== "globe_starting" && state.kind !== "globe_ready") {
    return state;
  }

  if (event.type === "READY" && state.kind === "globe_starting") {
    return { ...state, kind: "globe_ready" };
  }

  if (event.type === "PROMOTION_FAILED") {
    return {
      kind: "globe_blocked",
      generation: state.generation,
      degradations: state.degradations,
      reason: "GLOBE_PROMOTION_FAILED",
    };
  }

  if (event.type === "FALLBACK" || event.type === "CONTEXT_LOST") {
    return {
      kind: "static2d",
      generation: state.generation,
      degradations: state.degradations,
      reason: event.type === "CONTEXT_LOST" ? "CONTEXT_LOST" : event.reason,
    };
  }

  return state;
}
