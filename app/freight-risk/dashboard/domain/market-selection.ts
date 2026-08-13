export const MARKET_SERIES = ["fx", "oil", "bunker", "harpex"] as const;

export type MarketSeries = (typeof MARKET_SERIES)[number];
export type MarketSlot = "upper" | "lower";

export interface MarketSelection {
  readonly upper: MarketSeries;
  readonly lower: MarketSeries;
}

export const INITIAL_MARKET_SELECTION: MarketSelection = {
  upper: "fx",
  lower: "oil",
};

export function decodeMarketSeries(value: unknown): MarketSeries | null {
  switch (value) {
    case "fx":
    case "oil":
    case "bunker":
    case "harpex":
      return value;
    default:
      return null;
  }
}

export function hasDistinctMarketSlots(selection: MarketSelection): boolean {
  return selection.upper !== selection.lower;
}

export function selectMarketSeries(
  selection: MarketSelection,
  slot: MarketSlot,
  requested: unknown,
): MarketSelection {
  const series = decodeMarketSeries(requested);
  if (series === null) {
    return selection;
  }

  const current = selection[slot];
  if (series === current) {
    return selection;
  }

  const otherSlot: MarketSlot = slot === "upper" ? "lower" : "upper";
  if (selection[otherSlot] === series) {
    return slot === "upper"
      ? { upper: series, lower: current }
      : { upper: current, lower: series };
  }

  return slot === "upper"
    ? { upper: series, lower: selection.lower }
    : { upper: selection.upper, lower: series };
}
