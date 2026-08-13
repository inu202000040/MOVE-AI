interface InlineStyleTarget {
  overflow: string;
  readonly length: number;
}

export interface BodyScrollTarget {
  readonly style: InlineStyleTarget;
  hasAttribute(name: "style"): boolean;
  removeAttribute(name: "style"): void;
}

export type ReleaseBodyScrollLock = () => void;

export function lockBodyScroll(
  target: BodyScrollTarget,
): ReleaseBodyScrollLock {
  const previousOverflow = target.style.overflow;
  const hadStyleAttribute = target.hasAttribute("style");
  let released = false;

  target.style.overflow = "hidden";

  return () => {
    if (released) return;
    released = true;
    target.style.overflow = previousOverflow;

    if (!hadStyleAttribute && target.style.length === 0) {
      target.removeAttribute("style");
    }
  };
}
