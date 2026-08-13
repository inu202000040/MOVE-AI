import type { NetworkGeometryCatalog } from "./core/network-geojson";

export const KNEI_REFERENCE_FIXTURE: NetworkGeometryCatalog = {
  routes: [
    {
      id: "KNEI",
      primaryPortId: "KNEI-RTM",
      waypointCoordinates: [
        [129.0756, 35.1047],
        [129.209206, 34.130768],
        [119.831364, 24.72351],
        [102.665106, 1.516955],
        [43.349545, 12.788597],
        [32.436882, 30.593346],
        [-5.754896, 35.942274],
        [1.50584, 51.030224],
        [4.215145, 51.922281],
      ],
    },
  ],
  ports: [
    {
      id: "KNEI-ANR",
      routeId: "KNEI",
      longitude: 4.317802,
      latitude: 51.279355,
      upstreamPortWatchId: "port57",
      primary: false,
    },
    {
      id: "KNEI-BRV",
      routeId: "KNEI",
      longitude: 8.555057,
      latitude: 53.549441,
      upstreamPortWatchId: "port168",
      primary: false,
    },
    {
      id: "KNEI-FXT",
      routeId: "KNEI",
      longitude: 1.293148,
      latitude: 51.954111,
      upstreamPortWatchId: "port343",
      primary: false,
    },
    {
      id: "KNEI-HAM",
      routeId: "KNEI",
      longitude: 9.964294,
      latitude: 53.516401,
      upstreamPortWatchId: "port446",
      primary: false,
    },
    {
      id: "KNEI-RTM",
      routeId: "KNEI",
      longitude: 4.215145,
      latitude: 51.922281,
      upstreamPortWatchId: "port1114",
      primary: true,
    },
  ],
  chokepoints: [
    {
      id: "bab-el-mandeb",
      longitude: 43.349545,
      latitude: 12.788597,
      upstreamPortWatchId: "chokepoint4",
    },
    {
      id: "dover-strait",
      longitude: 1.50584,
      latitude: 51.030224,
      upstreamPortWatchId: "chokepoint9",
    },
    {
      id: "gibraltar-strait",
      longitude: -5.754896,
      latitude: 35.942274,
      upstreamPortWatchId: "chokepoint8",
    },
    {
      id: "korea-strait",
      longitude: 129.209206,
      latitude: 34.130768,
      upstreamPortWatchId: "chokepoint12",
    },
    {
      id: "malacca-strait",
      longitude: 102.665106,
      latitude: 1.516955,
      upstreamPortWatchId: "chokepoint5",
    },
    {
      id: "suez-canal",
      longitude: 32.436882,
      latitude: 30.593346,
      upstreamPortWatchId: "chokepoint1",
    },
    {
      id: "taiwan-strait",
      longitude: 119.831364,
      latitude: 24.72351,
      upstreamPortWatchId: "chokepoint11",
    },
  ],
  weather: [],
};

export const KNEI_PORT_LABELS: Readonly<Record<string, string>> = {
  "KNEI-ANR": "앤트워프-브뤼헤항",
  "KNEI-BRV": "브레머하펜항",
  "KNEI-FXT": "펠릭스토우항",
  "KNEI-HAM": "함부르크항",
  "KNEI-RTM": "로테르담항",
};

export const KNEI_CHOKEPOINT_LABELS: Readonly<Record<string, string>> = {
  "bab-el-mandeb": "바브엘만데브해협",
  "dover-strait": "도버해협",
  "gibraltar-strait": "지브롤터해협",
  "korea-strait": "대한해협",
  "malacca-strait": "말라카해협",
  "suez-canal": "수에즈운하",
  "taiwan-strait": "대만해협",
};
