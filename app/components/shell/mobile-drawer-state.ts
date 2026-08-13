export type DrawerFocusTarget = "none" | "opener" | "next-shell-trigger";

export interface MobileDrawerState {
  readonly open: boolean;
  readonly focusTarget: DrawerFocusTarget;
}

export type MobileDrawerEvent =
  | { readonly type: "OPEN" }
  | { readonly type: "TOGGLE" }
  | { readonly type: "ESCAPE" }
  | { readonly type: "NAVIGATE" }
  | { readonly type: "UNMOUNT" }
  | { readonly type: "FOCUS_RESTORED" };

export const INITIAL_MOBILE_DRAWER_STATE: MobileDrawerState = {
  open: false,
  focusTarget: "none",
};

export function reduceMobileDrawer(
  state: MobileDrawerState,
  event: MobileDrawerEvent,
): MobileDrawerState {
  switch (event.type) {
    case "OPEN":
      return state.open ? state : { open: true, focusTarget: "none" };
    case "TOGGLE":
      return state.open
        ? { open: false, focusTarget: "opener" }
        : { open: true, focusTarget: "none" };
    case "ESCAPE":
      return state.open
        ? { open: false, focusTarget: "opener" }
        : state;
    case "NAVIGATE":
      return state.open
        ? { open: false, focusTarget: "next-shell-trigger" }
        : state;
    case "UNMOUNT":
      return { open: false, focusTarget: "none" };
    case "FOCUS_RESTORED":
      return state.focusTarget === "none"
        ? state
        : { ...state, focusTarget: "none" };
  }
}
