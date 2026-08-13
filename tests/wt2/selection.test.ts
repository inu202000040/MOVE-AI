import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_MARKET_SELECTION,
  decodeForecastHorizon,
  hasDistinctMarketSlots,
  selectForecastHorizon,
  selectMarketSeries,
} from "../../app/freight-risk/dashboard/domain";

test("horizon selection accepts only the frozen 1 through 4 literals", () => {
  assert.equal(decodeForecastHorizon(1), 1);
  assert.equal(decodeForecastHorizon(4), 4);
  assert.equal(decodeForecastHorizon(0), null);
  assert.equal(decodeForecastHorizon("1"), null);
  assert.equal(selectForecastHorizon(2, 4), 4);
  assert.equal(selectForecastHorizon(2, 5), 2);
});

test("market selection implements no-op, swap, and third-series replacement atomically", () => {
  const initial = INITIAL_MARKET_SELECTION;
  assert.strictEqual(selectMarketSeries(initial, "upper", "fx"), initial);

  const swapped = selectMarketSeries(initial, "upper", "oil");
  assert.deepEqual(swapped, { upper: "oil", lower: "fx" });
  assert.equal(hasDistinctMarketSlots(swapped), true);

  const replaced = selectMarketSeries(swapped, "lower", "bunker");
  assert.deepEqual(replaced, { upper: "oil", lower: "bunker" });
  assert.equal(hasDistinctMarketSlots(replaced), true);

  assert.strictEqual(selectMarketSeries(replaced, "upper", "invalid"), replaced);
});

test("every market transition preserves the non-duplicate invariant", () => {
  const slots = ["upper", "lower"] as const;
  const series = ["fx", "oil", "bunker", "harpex"] as const;
  let state = INITIAL_MARKET_SELECTION;
  for (const slot of slots) {
    for (const next of series) {
      state = selectMarketSeries(state, slot, next);
      assert.equal(hasDistinctMarketSlots(state), true);
    }
  }
});
