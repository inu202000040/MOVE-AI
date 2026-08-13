export interface StaticViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_STATIC_VIEWPORT: StaticViewport = {
  x: 0,
  y: 18,
  width: 1000,
  height: 464,
};

export function staticViewportToViewBox(viewport: StaticViewport): string {
  return `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`;
}

export function panStaticViewport(
  viewport: StaticViewport,
  deltaX: number,
  deltaY: number,
): StaticViewport {
  return {
    ...viewport,
    x: viewport.x - deltaX,
    y: viewport.y - deltaY,
  };
}

export function zoomStaticViewport(
  viewport: StaticViewport,
  factor: number,
  anchorX: number,
  anchorY: number,
): StaticViewport {
  if (!(factor > 0)) {
    throw new RangeError("zoom factor must be positive");
  }
  const width = Math.min(4000, Math.max(125, viewport.width / factor));
  const height = width * (viewport.height / viewport.width);
  const relativeX = (anchorX - viewport.x) / viewport.width;
  const relativeY = (anchorY - viewport.y) / viewport.height;
  return {
    x: anchorX - relativeX * width,
    y: anchorY - relativeY * height,
    width,
    height,
  };
}

export function resetStaticViewport(): StaticViewport {
  return { ...DEFAULT_STATIC_VIEWPORT };
}
