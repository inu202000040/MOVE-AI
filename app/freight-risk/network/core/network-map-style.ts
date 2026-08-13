import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  LineLayerSpecification,
  SkySpecification,
  StyleSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

import type { NetworkGeoJsonSourceId } from "./network-geojson";

export interface NetworkMapPalette {
  readonly ocean: string;
  readonly sky: string;
  readonly horizon: string;
  readonly atmosphere: string;
  readonly route: string;
  readonly routeShadow: string;
  readonly selection: string;
  readonly chokepoint: string;
  readonly port: string;
  readonly weatherNormal: string;
  readonly weatherWarning: string;
  readonly weatherSevere: string;
  readonly weatherUnavailable: string;
}

export type RemoteFreeGlobeStyle = StyleSpecification & {
  name: "MOVE AI Network Globe";
  projection: { type: "globe" };
  sky: SkySpecification;
};

export type NetworkMapLayer = (
  | LineLayerSpecification
  | CircleLayerSpecification
  | SymbolLayerSpecification
) & {
  source: NetworkGeoJsonSourceId;
};

export const NETWORK_LAYER_IDS = [
  "network-globe-graticule",
  "network-chokepoint-corridor-halo",
  "network-chokepoint-corridor",
  "network-route-glow",
  "network-route-shadow",
  "network-route-line",
  "network-connector-line",
  "network-chokepoint-gate",
  "network-chokepoint-center-halo",
  "network-chokepoint-center",
  "network-chokepoint-icon",
  "network-port-halo",
  "network-port-marker",
  "network-port-icon",
  "network-weather-halo",
  "network-weather-marker",
  "network-chokepoint-corridor-hit",
  "network-chokepoint-center-hit",
  "network-route-hit",
  "network-port-hit",
  "network-weather-hit",
  "network-route-selection",
  "network-chokepoint-selection",
  "network-port-selection",
  "network-weather-selection",
] as const;

export const NETWORK_HIT_LAYER_IDS = [
  "network-weather-hit",
  "network-port-hit",
  "network-chokepoint-corridor-hit",
  "network-chokepoint-center-hit",
  "network-route-hit",
] as const;

export function createRemoteFreeGlobeStyle(
  palette: NetworkMapPalette,
): RemoteFreeGlobeStyle {
  return {
    // MapLibre Style Specification version; the runtime/worker/CSS package is 6.3.0.
    version: 8,
    name: "MOVE AI Network Globe",
    projection: { type: "globe" },
    sky: {
      "sky-color": palette.sky,
      "sky-horizon-blend": 0.42,
      "horizon-color": palette.horizon,
      "horizon-fog-blend": 0.32,
      "fog-color": palette.atmosphere,
      "fog-ground-blend": 0.58,
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        5,
        1,
        7,
        0,
      ],
    },
    light: {
      anchor: "map",
      color: palette.horizon,
      intensity: 0.36,
      position: [1.5, 90, 80],
    },
    sources: {},
    layers: [
      {
        id: "network-ocean",
        type: "background",
        paint: { "background-color": palette.ocean },
      },
    ],
  };
}

const selected: ExpressionSpecification = [
  "boolean",
  ["feature-state", "selected"],
  false,
];

export function createNetworkMapLayers(
  palette: NetworkMapPalette,
): readonly NetworkMapLayer[] {
  return [
    {
      id: "network-globe-graticule",
      type: "line",
      source: "network-globe-graticule",
      paint: {
        "line-color": palette.horizon,
        "line-width": 0.75,
        "line-opacity": 0.13,
      },
    },
    {
      id: "network-chokepoint-corridor-halo",
      type: "line",
      source: "network-chokepoint-corridors",
      paint: {
        "line-color": palette.chokepoint,
        "line-width": 12,
        "line-opacity": 0.16,
        "line-blur": 7,
      },
    },
    {
      id: "network-chokepoint-corridor",
      type: "line",
      source: "network-chokepoint-corridors",
      paint: {
        "line-color": palette.chokepoint,
        "line-width": 3,
        "line-opacity": 0.78,
      },
    },
    {
      id: "network-route-glow",
      type: "line",
      source: "network-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": palette.route,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 5, 4, 10],
        "line-opacity": 0.16,
        "line-blur": 5,
      },
    },
    {
      id: "network-route-shadow",
      type: "line",
      source: "network-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": palette.routeShadow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 5.5, 5, 8],
        "line-opacity": 0.78,
      },
    },
    {
      id: "network-route-line",
      type: "line",
      source: "network-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": palette.route,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.8, 5, 3.2],
        "line-opacity": 0.86,
      },
    },
    {
      id: "network-connector-line",
      type: "line",
      source: "network-connectors",
      paint: {
        "line-color": "#58b9f2",
        "line-width": 1.35,
        "line-opacity": 0.34,
        "line-dasharray": [1.35, 1.9],
      },
    },
    {
      id: "network-chokepoint-gate",
      type: "line",
      source: "network-chokepoint-gates",
      paint: {
        "line-color": palette.chokepoint,
        "line-width": 2,
        "line-opacity": 0.84,
        "line-dasharray": [2, 2],
      },
    },
    {
      id: "network-chokepoint-center-halo",
      type: "circle",
      source: "network-chokepoints",
      paint: {
        "circle-color": palette.chokepoint,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 5, 13],
        "circle-opacity": 0.3,
        "circle-blur": 0.68,
      },
    },
    {
      id: "network-chokepoint-center",
      type: "circle",
      source: "network-chokepoints",
      paint: {
        "circle-color": palette.chokepoint,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 4.5, 5, 7],
        "circle-stroke-color": palette.routeShadow,
        "circle-stroke-width": 2,
      },
    },
    {
      id: "network-chokepoint-icon",
      type: "symbol",
      source: "network-chokepoints",
      filter: ["!=", ["get", "kind"], "cape"],
      layout: {
        "icon-image": [
          "case",
          ["==", ["get", "kind"], "canal"],
          "network-icon-chokepoint-canal",
          "network-icon-chokepoint-strait",
        ],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 5, 0.72],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": 0.96,
      },
    },
    {
      id: "network-port-halo",
      type: "circle",
      source: "network-ports",
      paint: {
        "circle-color": palette.port,
        "circle-radius": [
          "case",
          ["get", "primary"],
          ["interpolate", ["linear"], ["zoom"], 0, 8, 5, 13],
          ["interpolate", ["linear"], ["zoom"], 0, 5, 5, 9],
        ],
        "circle-opacity": 0.28,
        "circle-blur": 0.72,
      },
    },
    {
      id: "network-port-marker",
      type: "circle",
      source: "network-ports",
      paint: {
        "circle-color": palette.port,
        "circle-radius": ["case", ["get", "primary"], 6.5, 4.5],
        "circle-stroke-color": palette.routeShadow,
        "circle-stroke-width": 1.75,
      },
    },
    {
      id: "network-port-icon",
      type: "symbol",
      source: "network-ports",
      layout: {
        "icon-image": "network-icon-port",
        "icon-size": ["case", ["get", "primary"], 0.68, 0.48],
        "icon-allow-overlap": false,
        "icon-ignore-placement": false,
        "icon-padding": 4,
        "symbol-sort-key": ["case", ["get", "primary"], 0, 1],
      },
      paint: {
        "icon-opacity": 0.98,
      },
    },
    {
      id: "network-weather-halo",
      type: "circle",
      source: "network-weather",
      filter: [
        "all",
        ["!=", ["get", "kind"], "port"],
        ["!=", ["get", "kind"], "chokepoint"],
      ],
      paint: {
        "circle-color": [
          "match",
          ["get", "risk"],
          "severe",
          palette.weatherSevere,
          "warning",
          palette.weatherWarning,
          "normal",
          palette.weatherNormal,
          palette.weatherUnavailable,
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 5, 14],
        "circle-opacity": 0.2,
        "circle-blur": 0.8,
      },
    },
    {
      id: "network-weather-marker",
      type: "circle",
      source: "network-weather",
      filter: [
        "all",
        ["!=", ["get", "kind"], "port"],
        ["!=", ["get", "kind"], "chokepoint"],
      ],
      paint: {
        "circle-color": [
          "match",
          ["get", "risk"],
          "severe",
          palette.weatherSevere,
          "warning",
          palette.weatherWarning,
          "normal",
          palette.weatherNormal,
          palette.weatherUnavailable,
        ],
        "circle-radius": 3.8,
        "circle-opacity": 0.86,
        "circle-stroke-color": palette.routeShadow,
        "circle-stroke-width": 1,
      },
    },
    {
      id: "network-chokepoint-corridor-hit",
      type: "line",
      source: "network-chokepoint-corridors",
      paint: {
        "line-color": "rgba(0,0,0,0)",
        "line-width": 32,
      },
    },
    {
      id: "network-chokepoint-center-hit",
      type: "circle",
      source: "network-chokepoints",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 13,
      },
    },
    {
      id: "network-route-hit",
      type: "line",
      source: "network-routes",
      paint: {
        "line-color": "rgba(0,0,0,0)",
        "line-width": 14,
      },
    },
    {
      id: "network-port-hit",
      type: "circle",
      source: "network-ports",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 13,
      },
    },
    {
      id: "network-weather-hit",
      type: "circle",
      source: "network-weather",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 10,
      },
    },
    {
      id: "network-route-selection",
      type: "line",
      source: "network-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": palette.selection,
        "line-width": 4.5,
        "line-opacity": ["case", selected, 1, 0],
        "line-blur": 0.5,
      },
    },
    {
      id: "network-chokepoint-selection",
      type: "circle",
      source: "network-chokepoints",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 10,
        "circle-stroke-color": palette.selection,
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": ["case", selected, 1, 0],
      },
    },
    {
      id: "network-port-selection",
      type: "circle",
      source: "network-ports",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 10,
        "circle-stroke-color": palette.selection,
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": ["case", selected, 1, 0],
      },
    },
    {
      id: "network-weather-selection",
      type: "circle",
      source: "network-weather",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": 12,
        "circle-stroke-color": palette.selection,
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": ["case", selected, 1, 0],
      },
    },
  ];
}
