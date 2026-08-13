export interface ApprovedInput {
  readonly id: string;
  readonly fileName: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly sheets: readonly string[];
  readonly optional: boolean;
}

export const APPROVED_INPUTS: readonly ApprovedInput[] = [
  { id: "00", fileName: "00_API_CATALOG.xlsx", byteSize: 32_351, sha256: "423544876b745a09eda602858d8659d2103a943bc7f55cda2d23790e707b71c0", sheets: ["APIS", "FIELD_MAPPING", "ERROR_POLICY", "LICENSES", "NEWS_QUERY_PROFILES"], optional: false },
  { id: "01", fileName: "01_ROUTE_PORT_CATALOG.xlsx", byteSize: 47_539, sha256: "baae5167e2a73cc81e4adefc57bcafaeefe5a0fb5f4297b3d730c1261a0be38a", sheets: ["ROUTES", "PORTS", "CHOKEPOINTS"], optional: false },
  { id: "02", fileName: "02_KCCI_WEEKLY.xlsx", byteSize: 155_927, sha256: "ee03da280ab5d520f44ee738e857e382e2268648bef494f3dfff4402a116b8fd", sheets: ["NORMALIZED"], optional: false },
  { id: "03", fileName: "03_USDKRW_ECB.xlsx", byteSize: 427_569, sha256: "54f976eec014c453ca115bf83aa12a776625b39c7238e922d498888eaef76d99", sheets: ["NORMALIZED"], optional: false },
  { id: "04", fileName: "04_BRENT_EIA.xlsx", byteSize: 99_961, sha256: "7608b039c11fe55dd0310ba7dad5596e51846847b7a212aa8da8ba6955f3ba5e", sheets: ["NORMALIZED"], optional: false },
  { id: "05", fileName: "05_VLSFO_USDA.xlsx", byteSize: 108_429, sha256: "2fd22fa5f47d02e7edc48b9999e377ff4d9d2a3e8e66a1d591b435480c52be37", sheets: ["NORMALIZED"], optional: false },
  { id: "06", fileName: "06_HARPEX_REFERENCE.xlsx", byteSize: 13_544, sha256: "544302ac112733f91032bd78b254b5009c7250b6376f641c34bfe64a0d809804", sheets: ["NORMALIZED"], optional: false },
  { id: "07", fileName: "07_PORTWATCH_PORT_TRAFFIC.xlsx", byteSize: 1_616_510, sha256: "b2bf91993b776e1a2451f5a5b3b2ca299e590527c3eb8707a6a70753c033403d", sheets: ["PORT_MAPPING", "DAILY_RECENT_220D"], optional: false },
  { id: "08", fileName: "08_PORTWATCH_CHOKEPOINT_TRAFFIC.xlsx", byteSize: 255_340, sha256: "72a2bee17955d4a00baaa9a4930ea41b4610169940476d8dd3d4d14fbf853529", sheets: ["CHOKEPOINT_MAPPING", "DAILY_RECENT_220D", "ALL_SERIES"], optional: false },
  { id: "09", fileName: "09_WEATHER_API_REFERENCE.xlsx", byteSize: 23_546, sha256: "2798b8ad5668f4df3a6d84306cb3ceb2ced4903842f144be8de4d420308dc87e", sheets: ["LOCATION_CATALOG", "API_SCHEMA"], optional: false },
  { id: "10", fileName: "10_ROUTE_NEWS_REFERENCE.xlsx", byteSize: 21_346, sha256: "6886e9684f6297b5854c87dcbea8b9098b487df4661825add1163c6db7e23431", sheets: ["ROUTE_QUERY_CATALOG", "NORMALIZED", "PROVIDERS"], optional: false },
  { id: "11", fileName: "11_PORTMIS_TEU_OPTIONAL.xlsx", byteSize: 11_871, sha256: "170bcbf9a43ebc1da549ce929eaf501efe4faa0c5db3ca02e279202db913c7cf", sheets: ["API_CONTRACT"], optional: true },
  { id: "12", fileName: "12_DATA_MANIFEST.xlsx", byteSize: 18_969, sha256: "991690557c80d0820228f8d6c63b78c82e74677d64aa91ba1be2906b681bfa71", sheets: ["FILES", "RAW_SOURCES", "PACK_STRUCTURE", "VALIDATION"], optional: false },
  { id: "13", fileName: "13_MODEL_FORECAST_SNAPSHOT.xlsx", byteSize: 151_229, sha256: "0297028336741e43cbc9820ce9d8c387d45682b68035a26cadc80cc4505e7c4c", sheets: ["NORMALIZED", "METRICS", "MODELS"], optional: false },
  { id: "14", fileName: "14_MODEL_EVALUATION.xlsx", byteSize: 2_309_944, sha256: "3973875c93a68c430be9fa2c9d7fde1b806c1f238dde0d680bbd7396af6e8f1e", sheets: ["RAW", "NORMALIZED", "MODEL_SCORES", "CHAMPION_H1"], optional: false },
  { id: "15", fileName: "15_MODEL_TUNING_CONFIG.xlsx", byteSize: 22_336, sha256: "32e1d0bde567585f21ced1d1564c04da0de9613a9c9a70119b6278c552119c3a", sheets: ["RAW", "NORMALIZED", "TRAINING_WINDOWS", "API_CONTRACT", "PERSISTENCE"], optional: false },
  { id: "16", fileName: "16_ROUTE_EVENTS_AND_CORRIDORS.xlsx", byteSize: 67_294, sha256: "2bfe8ed28f43baf82268ae012d228c6051fb47898548a719afbcb07f3322fe02", sheets: ["ROUTES", "EVENTS", "CORRIDOR_WAYPOINTS", "PORTS", "CHOKEPOINTS", "PORT_CONNECTORS", "WEATHER_LOCATIONS"], optional: false },
  { id: "17", fileName: "17_RUNTIME_PROVIDER_CATALOG.xlsx", byteSize: 23_309, sha256: "a11e7bff4bd204eb6daeb974630cd5d57fa6f0fec13da451b2815809c4b01e7f", sheets: ["NORMALIZED", "ROUTE_NEWS_PROFILES"], optional: false },
  { id: "18", fileName: "18_CVAR_ALLOCATION_CONFIG.xlsx", byteSize: 19_735, sha256: "9da8647b07057bee547d5b0d9c90369957b9534fa3e79f3d0b2877023b504652", sheets: ["RAW", "RISK_PROFILES", "ROUTE_SEEDS", "FORMULAS", "CAVEATS"], optional: false },
] as const;

export const APPROVED_INPUT_BY_ID = new Map(
  APPROVED_INPUTS.map((input) => [input.id, input] as const),
);
