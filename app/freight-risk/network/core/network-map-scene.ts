import type {
  AddLayerObject,
  CustomLayerInterface,
  LayerSpecification,
  Map as MapLibreMap,
  SourceSpecification,
} from "maplibre-gl";

import { NETWORK_LAYER_IDS } from "./network-map-style";

const FALLBACK_LAND_SOURCE_ID = "network-basemap-natural-earth-land";
const FALLBACK_PLACE_SOURCE_ID = "network-basemap-natural-earth-places";
const OPENFREEMAP_SOURCE_ID = "network-basemap-openfreemap";
const NASA_BLUE_MARBLE_SOURCE_ID = "network-basemap-nasa-blue-marble";
const STARFIELD_LAYER_ID = "network-basemap-starfield";

export const OPENFREEMAP_PLANET_URL =
  "https://tiles.openfreemap.org/planet" as const;

export const NASA_BLUE_MARBLE_TILE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg" as const;

export const NETWORK_BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' +
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · ' +
  '<a href="https://earthdata.nasa.gov/gibs/" target="_blank" rel="noopener">NASA GIBS Blue Marble</a> · ' +
  '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';

export type NetworkMapSceneDegradationCode =
  | "FALLBACK_BASEMAP_UNAVAILABLE"
  | "NASA_BLUE_MARBLE_UNAVAILABLE"
  | "OPENFREEMAP_UNAVAILABLE"
  | "SCENE_ICON_UNAVAILABLE"
  | "STARFIELD_UNAVAILABLE";

export interface NetworkMapSceneDegradation {
  readonly code: NetworkMapSceneDegradationCode;
  readonly id: string;
  readonly error: unknown;
}

export interface NetworkMapSceneOptions {
  readonly beforeLayerId?: string;
  readonly installOpenFreeMap?: boolean;
  readonly installNasaBlueMarble?: boolean;
  readonly installStarfield?: boolean;
  readonly signal?: AbortSignal;
  readonly onDegradation?: (degradation: NetworkMapSceneDegradation) => void;
}

export interface NetworkMapSceneReport {
  readonly fallbackBasemapInstalled: boolean;
  readonly openFreeMapInstalled: boolean;
  readonly starfieldInstalled: boolean;
  readonly installedImageCount: number;
  readonly degradations: readonly NetworkMapSceneDegradationCode[];
}

export interface NetworkMapSceneController {
  readonly ready: Promise<NetworkMapSceneReport>;
  readonly dispose: () => void;
}

interface SceneErrorEvent {
  readonly sourceId?: string;
  readonly error?: unknown;
}

interface SceneImageDefinition {
  readonly id: string;
  readonly url: string;
  readonly pixelRatio: number;
}

const FALLBACK_SOURCE_IDS = new Set([
  FALLBACK_LAND_SOURCE_ID,
  FALLBACK_PLACE_SOURCE_ID,
]);

const SCENE_IMAGES: readonly SceneImageDefinition[] = [
  {
    id: "network-icon-port",
    url: "/network/icons/tabler/anchor.svg",
    pixelRatio: 1,
  },
  {
    id: "network-icon-chokepoint",
    url: "/network/icons/tabler/radar-2.svg",
    pixelRatio: 1,
  },
  {
    id: "network-icon-weather-normal",
    url: "/network/icons/weather/clear-day.svg",
    pixelRatio: 2,
  },
  {
    id: "network-icon-weather-warning",
    url: "/network/icons/weather/partly-cloudy-day.svg",
    pixelRatio: 2,
  },
  {
    id: "network-icon-weather-severe",
    url: "/network/icons/weather/rain.svg",
    pixelRatio: 2,
  },
  {
    id: "network-icon-weather-unavailable",
    url: "/network/icons/weather/cloudy.svg",
    pixelRatio: 2,
  },
];

const FALLBACK_SOURCES: Readonly<Record<string, SourceSpecification>> = {
  [FALLBACK_LAND_SOURCE_ID]: {
    type: "geojson",
    data: "/network/basemap/natural-earth-land-110m.geojson",
    attribution:
      '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>',
  },
  [FALLBACK_PLACE_SOURCE_ID]: {
    type: "geojson",
    data: "/network/basemap/natural-earth-places-110m.geojson",
    attribution:
      '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>',
  },
};

const FALLBACK_LAYERS: readonly LayerSpecification[] = [
  {
    id: "network-basemap-land-shadow",
    type: "fill",
    source: FALLBACK_LAND_SOURCE_ID,
    paint: {
      "fill-color": "#071426",
      "fill-opacity": 0.92,
      "fill-translate": [0, 1.5],
    },
  },
  {
    id: "network-basemap-land",
    type: "fill",
    source: FALLBACK_LAND_SOURCE_ID,
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        "#839b82",
        3,
        "#9caf8d",
        6,
        "#b8bd91",
      ],
      "fill-opacity": 0.95,
      "fill-antialias": true,
    },
  },
  {
    id: "network-basemap-coastline",
    type: "line",
    source: FALLBACK_LAND_SOURCE_ID,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "rgba(149, 225, 231, 0.56)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 6, 1.4],
      "line-opacity": 0.72,
    },
  },
  {
    id: "network-basemap-place-dot",
    type: "circle",
    source: FALLBACK_PLACE_SOURCE_ID,
    minzoom: 1,
    filter: ["<=", ["get", "scalerank"], 3],
    paint: {
      "circle-color": "#d6f7f5",
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1, 6, 2.6],
      "circle-opacity": 0.62,
      "circle-stroke-color": "rgba(3, 15, 31, 0.76)",
      "circle-stroke-width": 1,
    },
  },
  {
    id: "network-basemap-place-label",
    type: "symbol",
    source: FALLBACK_PLACE_SOURCE_ID,
    minzoom: 1,
    filter: ["<=", ["get", "scalerank"], 3],
    layout: {
      "text-field": ["coalesce", ["get", "nameascii"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 1, 8.5, 6, 12],
      "text-letter-spacing": 0.08,
      "text-offset": [0, 0.95],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-padding": 8,
      "symbol-sort-key": ["get", "scalerank"],
    },
    paint: {
      "text-color": "rgba(227, 246, 245, 0.84)",
      "text-halo-color": "rgba(2, 11, 27, 0.92)",
      "text-halo-width": 1.2,
      "text-halo-blur": 0.5,
    },
  },
];

const OPENFREEMAP_LAYERS: readonly LayerSpecification[] = [
  {
    id: "network-basemap-openfreemap-landcover",
    type: "fill",
    source: OPENFREEMAP_SOURCE_ID,
    "source-layer": "landcover",
    maxzoom: 9,
    paint: {
      "fill-color": [
        "match",
        ["get", "class"],
        "wood",
        "#6d9470",
        "grass",
        "#91a979",
        "scrub",
        "#899d74",
        "snow",
        "#c7d9d6",
        "#9daa7f",
      ],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.16, 7, 0.34],
    },
  },
  {
    id: "network-basemap-openfreemap-water",
    type: "fill",
    source: OPENFREEMAP_SOURCE_ID,
    "source-layer": "water",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "fill-color": "#0b3454",
      "fill-opacity": 0.22,
      "fill-antialias": true,
    },
  },
  {
    id: "network-basemap-openfreemap-waterway",
    type: "line",
    source: OPENFREEMAP_SOURCE_ID,
    "source-layer": "waterway",
    minzoom: 2,
    paint: {
      "line-color": "rgba(50, 141, 175, 0.64)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.35, 9, 1.35],
    },
  },
  {
    id: "network-basemap-openfreemap-boundary",
    type: "line",
    source: OPENFREEMAP_SOURCE_ID,
    "source-layer": "boundary",
    minzoom: 1,
    filter: ["<=", ["get", "admin_level"], 4],
    paint: {
      "line-color": "rgba(180, 221, 218, 0.34)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.45, 8, 1.1],
      "line-dasharray": [2, 2],
    },
  },
  {
    id: "network-basemap-openfreemap-place-label",
    type: "symbol",
    source: OPENFREEMAP_SOURCE_ID,
    "source-layer": "place",
    minzoom: 1,
    filter: [
      "match",
      ["get", "class"],
      ["country", "state", "city"],
      true,
      false,
    ],
    layout: {
      "text-field": [
        "coalesce",
        ["get", "name:ko"],
        ["get", "name:en"],
        ["get", "name"],
      ],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 1, 8.5, 8, 13],
      "text-letter-spacing": 0.06,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-padding": 9,
      "symbol-sort-key": [
        "match",
        ["get", "class"],
        "country",
        0,
        "state",
        1,
        2,
      ],
    },
    paint: {
      "text-color": "rgba(235, 249, 247, 0.88)",
      "text-halo-color": "rgba(2, 12, 28, 0.94)",
      "text-halo-width": 1.25,
      "text-halo-blur": 0.55,
    },
  },
];

function xorshift32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x1_0000_0000;
  };
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate starfield shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(`Unable to compile starfield shader: ${detail}`);
  }
  return shader;
}

export function createNetworkStarfieldLayer(
  count = 260,
): CustomLayerInterface {
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let position = -1;
  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;

  return {
    id: STARFIELD_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd: (_map, gl) => {
      vertexShader = compileShader(
        gl,
        gl.VERTEX_SHADER,
        `#version 300 es
        in vec4 a_star;
        out float v_alpha;
        void main() {
          gl_Position = vec4(a_star.xy, 0.99998, 1.0);
          gl_PointSize = a_star.z;
          v_alpha = a_star.w;
        }`,
      );
      fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        `#version 300 es
        precision highp float;
        in float v_alpha;
        out vec4 outColor;
        void main() {
          float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
          if (distanceFromCenter > 0.5) discard;
          float core = smoothstep(0.5, 0.02, distanceFromCenter);
          float alpha = v_alpha * core;
          outColor = vec4(vec3(0.76, 0.90, 1.0) * alpha, alpha);
        }`,
      );
      program = gl.createProgram();
      if (!program) throw new Error("Unable to allocate starfield program");
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
          `Unable to link starfield program: ${gl.getProgramInfoLog(program) ?? "unknown link error"}`,
        );
      }
      position = gl.getAttribLocation(program, "a_star");
      if (position < 0) throw new Error("Unable to locate starfield attribute");

      const random = xorshift32(0x4d4f_5645);
      const stars = new Float32Array(count * 4);
      for (let index = 0; index < count; index += 1) {
        const offset = index * 4;
        stars[offset] = random() * 2 - 1;
        stars[offset + 1] = random() * 2 - 1;
        stars[offset + 2] = 1 + random() * random() * 3.2;
        stars[offset + 3] = 0.22 + random() * 0.68;
      }
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to allocate starfield buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, stars, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
    render: (gl) => {
      if (!program || !buffer || position < 0) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disableVertexAttribArray(position);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
    onRemove: (_map, gl) => {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      buffer = null;
      program = null;
      vertexShader = null;
      fragmentShader = null;
      position = -1;
    },
  };
}

function resolveBeforeLayer(
  map: MapLibreMap,
  preferredLayerId: string | undefined,
): string | undefined {
  const id = preferredLayerId ?? NETWORK_LAYER_IDS[0];
  return map.getLayer(id) ? id : undefined;
}

function installSource(
  map: MapLibreMap,
  id: string,
  source: SourceSpecification,
): void {
  if (!map.getSource(id)) map.addSource(id, source);
}

function installLayers(
  map: MapLibreMap,
  layers: readonly LayerSpecification[],
  beforeLayerId: string | undefined,
): void {
  for (const layer of layers) {
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer as AddLayerObject, beforeLayerId);
    }
  }
}

function loadSceneImage(definition: SceneImageDefinition): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Browser image decoding is unavailable"));
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${definition.url}`));
    image.src = definition.url;
  });
}

export function installNetworkMapScene(
  map: MapLibreMap,
  options: NetworkMapSceneOptions = {},
): NetworkMapSceneController {
  let disposed = false;
  let fallbackBasemapInstalled = false;
  let openFreeMapInstalled = false;
  let starfieldInstalled = false;
  let installedImageCount = 0;
  const degradationCodes: NetworkMapSceneDegradationCode[] = [];
  const reported = new Set<string>();

  const degrade = (
    code: NetworkMapSceneDegradationCode,
    id: string,
    error: unknown,
  ): void => {
    const key = `${code}:${id}`;
    if (reported.has(key)) return;
    reported.add(key);
    degradationCodes.push(code);
    options.onDegradation?.({ code, id, error });
  };

  const onMapError = (event: SceneErrorEvent): void => {
    if (disposed || !event.sourceId) return;
    if (event.sourceId === OPENFREEMAP_SOURCE_ID) {
      degrade(
        "OPENFREEMAP_UNAVAILABLE",
        event.sourceId,
        event.error ?? new Error("OpenFreeMap source error"),
      );
    }
    if (event.sourceId === NASA_BLUE_MARBLE_SOURCE_ID) {
      degrade(
        "NASA_BLUE_MARBLE_UNAVAILABLE",
        event.sourceId,
        event.error ?? new Error("NASA Blue Marble source error"),
      );
    }
    if (FALLBACK_SOURCE_IDS.has(event.sourceId)) {
      degrade(
        "FALLBACK_BASEMAP_UNAVAILABLE",
        event.sourceId,
        event.error ?? new Error("Natural Earth fallback source error"),
      );
    }
  };

  map.on("error", onMapError);
  const dataLayerId = resolveBeforeLayer(map, options.beforeLayerId);

  try {
    if (!map.getLayer(STARFIELD_LAYER_ID) && options.installStarfield !== false) {
      map.addLayer(createNetworkStarfieldLayer());
    }
    starfieldInstalled =
      options.installStarfield !== false && Boolean(map.getLayer(STARFIELD_LAYER_ID));
  } catch (error) {
    degrade("STARFIELD_UNAVAILABLE", STARFIELD_LAYER_ID, error);
  }

  try {
    for (const [id, source] of Object.entries(FALLBACK_SOURCES)) {
      installSource(map, id, source);
    }
    installLayers(map, FALLBACK_LAYERS, dataLayerId);
    fallbackBasemapInstalled = true;
  } catch (error) {
    degrade("FALLBACK_BASEMAP_UNAVAILABLE", "natural-earth", error);
  }

  if (options.installNasaBlueMarble !== false) {
    try {
      installSource(map, NASA_BLUE_MARBLE_SOURCE_ID, {
        type: "raster",
        tiles: [NASA_BLUE_MARBLE_TILE_URL],
        tileSize: 256,
        maxzoom: 8,
        attribution:
          '<a href="https://earthdata.nasa.gov/gibs/" target="_blank" rel="noopener">NASA GIBS Blue Marble</a>',
      });
      installLayers(
        map,
        [
          {
            id: "network-basemap-nasa-blue-marble",
            type: "raster",
            source: NASA_BLUE_MARBLE_SOURCE_ID,
            paint: {
              "raster-opacity": 0.9,
              "raster-saturation": -0.12,
              "raster-contrast": 0.08,
              "raster-brightness-min": 0.08,
              "raster-brightness-max": 0.92,
            },
          },
        ],
        dataLayerId,
      );
    } catch (error) {
      degrade("NASA_BLUE_MARBLE_UNAVAILABLE", NASA_BLUE_MARBLE_SOURCE_ID, error);
    }
  }

  if (options.installOpenFreeMap !== false) {
    try {
      installSource(map, OPENFREEMAP_SOURCE_ID, {
        type: "vector",
        url: OPENFREEMAP_PLANET_URL,
        attribution: NETWORK_BASEMAP_ATTRIBUTION,
      });
      installLayers(map, OPENFREEMAP_LAYERS, dataLayerId);
      openFreeMapInstalled = true;
    } catch (error) {
      degrade("OPENFREEMAP_UNAVAILABLE", OPENFREEMAP_SOURCE_ID, error);
    }
  }

  const ready = Promise.all(
    SCENE_IMAGES.map(async (definition) => {
      if (disposed || options.signal?.aborted || map.hasImage(definition.id)) {
        return;
      }
      try {
        const image = await loadSceneImage(definition);
        if (disposed || options.signal?.aborted || map.hasImage(definition.id)) {
          return;
        }
        map.addImage(definition.id, image, {
          pixelRatio: definition.pixelRatio,
        });
        installedImageCount += 1;
      } catch (error) {
        degrade("SCENE_ICON_UNAVAILABLE", definition.id, error);
      }
    }),
  ).then(
    (): NetworkMapSceneReport => ({
      fallbackBasemapInstalled,
      openFreeMapInstalled,
      starfieldInstalled,
      installedImageCount,
      degradations: [...new Set(degradationCodes)],
    }),
  );

  return {
    ready,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      map.off("error", onMapError);
    },
  };
}
