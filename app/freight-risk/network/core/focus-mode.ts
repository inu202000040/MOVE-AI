export const NETWORK_FOCUS_MODES = [
  "routes",
  "chokepoints",
  "combined",
] as const;

export type NetworkFocusMode = (typeof NETWORK_FOCUS_MODES)[number];
export type NetworkFeatureCategory =
  | "route"
  | "connector"
  | "port"
  | "chokepoint"
  | "weather";
export type NetworkFeatureEmphasis = "selected" | "primary" | "neutral" | "secondary";

export interface NetworkFocusContext {
  readonly mode: NetworkFocusMode;
  readonly category: NetworkFeatureCategory;
  readonly selected: boolean;
  readonly relatedToSelectedChokepoint?: boolean;
}

export function resolveNetworkFeatureEmphasis(
  context: NetworkFocusContext,
): NetworkFeatureEmphasis {
  if (context.selected) return "selected";
  if (context.mode === "combined") return "primary";
  if (context.mode === "routes") {
    if (
      context.category === "route" ||
      context.category === "connector" ||
      context.category === "port"
    ) {
      return "primary";
    }
    return context.category === "chokepoint" ? "secondary" : "neutral";
  }
  if (context.category === "chokepoint") return "primary";
  if (
    (context.category === "route" || context.category === "connector") &&
    context.relatedToSelectedChokepoint
  ) {
    return "primary";
  }
  return context.category === "weather" ? "neutral" : "secondary";
}

export function moveNetworkFocusMode(
  current: NetworkFocusMode,
  direction: "next" | "previous" | "first" | "last",
): NetworkFocusMode {
  if (direction === "first") return NETWORK_FOCUS_MODES[0];
  if (direction === "last") return NETWORK_FOCUS_MODES.at(-1)!;
  const index = NETWORK_FOCUS_MODES.indexOf(current);
  const delta = direction === "next" ? 1 : -1;
  return NETWORK_FOCUS_MODES[
    (index + delta + NETWORK_FOCUS_MODES.length) % NETWORK_FOCUS_MODES.length
  ]!;
}
