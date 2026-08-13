import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_MOBILE_DRAWER_STATE,
  reduceMobileDrawer,
} from "../../app/components/shell";

test("opens and toggle-closes with opener focus restoration requested", () => {
  const open = reduceMobileDrawer(INITIAL_MOBILE_DRAWER_STATE, {
    type: "OPEN",
  });
  assert.deepEqual(open, { open: true, focusTarget: "none" });

  const closed = reduceMobileDrawer(open, { type: "TOGGLE" });
  assert.deepEqual(closed, { open: false, focusTarget: "opener" });
  assert.deepEqual(reduceMobileDrawer(closed, { type: "FOCUS_RESTORED" }), {
    open: false,
    focusTarget: "none",
  });
});

test("Escape closes only an open drawer and requests opener focus", () => {
  assert.equal(
    reduceMobileDrawer(INITIAL_MOBILE_DRAWER_STATE, { type: "ESCAPE" }),
    INITIAL_MOBILE_DRAWER_STATE,
  );

  assert.deepEqual(
    reduceMobileDrawer(
      { open: true, focusTarget: "none" },
      { type: "ESCAPE" },
    ),
    { open: false, focusTarget: "opener" },
  );
});

test("navigation and unmount close through explicit lifecycle states", () => {
  assert.deepEqual(
    reduceMobileDrawer(
      { open: true, focusTarget: "none" },
      { type: "NAVIGATE" },
    ),
    { open: false, focusTarget: "next-shell-trigger" },
  );
  assert.deepEqual(
    reduceMobileDrawer(
      { open: true, focusTarget: "none" },
      { type: "UNMOUNT" },
    ),
    INITIAL_MOBILE_DRAWER_STATE,
  );
});
