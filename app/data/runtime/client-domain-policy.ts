import type { RouteId } from "../../contracts/routes";

export type PortIdentityPolicyV1 = readonly [routeId: RouteId, upstreamPortWatchId: string];
export type ChokepointIdentityPolicyV1 = string;
export type TuningParameterPolicyV1 = readonly [
  key: string,
  inputType: "number" | "select",
  minimum: number | null,
  maximum: number | null,
  step: number | null,
  options: readonly string[] | null,
];

// Client-safe decoder policy. Server-side parity tests bind these values to the
// deterministically generated catalog and tuning artifacts.
export const PORT_IDENTITY_POLICY_V1: Readonly<Record<string, PortIdentityPolicyV1>> = {
  "KAUI-ADL": ["KAUI", "port929"], "KAUI-BNE": ["KAUI", "port174"], "KAUI-FRE": ["KAUI", "port361"],
  "KAUI-MEL": ["KAUI", "port729"], "KAUI-SYD": ["KAUI", "port161"], "KCI-NGB": ["KCI", "port824"],
  "KCI-SHA": ["KCI", "port1188"], "KCI-TAO": ["KCI", "port1069"], "KJI-OSA": ["KJI", "port862"],
  "KJI-TYO": ["KJI", "port1305"], "KJI-YOK": ["KJI", "port1417"], "KLEI-BUE": ["KLEI", "port184"],
  "KLEI-IOA": ["KLEI", "port2035"], "KLEI-MVD": ["KLEI", "port764"], "KLEI-PNG": ["KLEI", "port885"],
  "KLEI-SSZ": ["KLEI", "port1160"], "KLWI-BUN": ["KLWI", "port183"], "KLWI-CLL": ["KLWI", "port1045"],
  "KLWI-GYE": ["KLWI", "port426"], "KLWI-SAI": ["KLWI", "port1058"], "KLWI-ZLO": ["KLWI", "port699"],
  "KMDI-BCN": ["KMDI", "port118"], "KMDI-GOA": ["KMDI", "port387"], "KMDI-NAP": ["KMDI", "port795"],
  "KMDI-PIR": ["KMDI", "port908"], "KMDI-VLC": ["KMDI", "port1348"], "KMEI-DMM": ["KMEI", "port275"],
  "KMEI-JEA": ["KMEI", "port744"], "KMEI-JED": ["KMEI", "port518"], "KMEI-KHL": ["KMEI", "port2025"],
  "KMEI-SOH": ["KMEI", "port988"], "KNEI-ANR": ["KNEI", "port57"], "KNEI-BRV": ["KNEI", "port168"],
  "KNEI-FXT": ["KNEI", "port343"], "KNEI-HAM": ["KNEI", "port446"], "KNEI-RTM": ["KNEI", "port1114"],
  "KSAI-CPT": ["KSAI", "port215"], "KSAI-DUR": ["KSAI", "port311"], "KSAI-NGQ": ["KSAI", "port2063"],
  "KSEI-CMT": ["KSEI", "port903"], "KSEI-LCH": ["KSEI", "port1197"], "KSEI-PKG": ["KSEI", "port960"],
  "KSEI-SIN": ["KSEI", "port1201"], "KSEI-TPP": ["KSEI", "port514"], "KUEI-CHS": ["KUEI", "port231"],
  "KUEI-JAX": ["KUEI", "port513"], "KUEI-NYNJ": ["KUEI", "port815"], "KUEI-SAV": ["KUEI", "port1170"],
  "KUEI-VAP": ["KUEI", "port2066"], "KUWI-LAX": ["KUWI", "port664"], "KUWI-LGB": ["KUWI", "port664"],
  "KUWI-OAK": ["KUWI", "port839"], "KUWI-SEA": ["KUWI", "port1175"], "KUWI-TAC": ["KUWI", "port1248"],
  "KWAI-ABJ": ["KWAI", "port4"], "KWAI-LOS": ["KWAI", "port626"], "KWAI-TEM": ["KWAI", "port1282"],
};

export const CHOKEPOINT_IDENTITY_POLICY_V1: Readonly<Record<string, ChokepointIdentityPolicyV1>> = {
  "bab-el-mandeb": "chokepoint4", "cape-good-hope": "chokepoint7", "dover-strait": "chokepoint9",
  "gibraltar-strait": "chokepoint8", "hormuz-strait": "chokepoint6", "korea-strait": "chokepoint12",
  "luzon-strait": "chokepoint14", "malacca-strait": "chokepoint5", "panama-canal": "chokepoint2",
  "suez-canal": "chokepoint1", "taiwan-strait": "chokepoint11",
};

export const TUNING_PARAMETER_POLICY_V1: Readonly<Record<string, readonly TuningParameterPolicyV1[]>> = {
  chronos: [["context_length", "number", 52, 187, 1, null]],
  lightgbm: [
    ["colsample_bytree", "number", 0.5, 1, 0.05, null], ["learning_rate", "number", 0.005, 0.3, 0.005, null],
    ["max_depth", "number", 2, 12, 1, null], ["min_child_samples", "number", 2, 40, 1, null],
    ["n_estimators", "number", 20, 500, 10, null], ["num_leaves", "number", 4, 127, 1, null],
    ["reg_lambda", "number", 0, 20, 0.1, null], ["subsample", "number", 0.5, 1, 0.05, null],
  ],
  prophet: [
    ["changepoint_prior_scale", "number", 0.001, 0.5, 0.005, null], ["changepoint_range", "number", 0.5, 0.95, 0.05, null],
    ["seasonality_prior_scale", "number", 0.01, 20, 0.1, null],
  ],
  random_forest: [
    ["max_depth", "number", 2, 20, 1, null], ["max_features", "number", 0.2, 1, 0.05, null],
    ["min_samples_leaf", "number", 1, 20, 1, null], ["n_estimators", "number", 20, 500, 10, null],
  ],
  sarimax: [
    ["d", "number", 0, 2, 1, null], ["maxiter", "number", 20, 150, 10, null], ["p", "number", 0, 3, 1, null],
    ["q", "number", 0, 3, 1, null], ["seasonal_d", "number", 0, 1, 1, null],
    ["seasonal_p", "number", 0, 1, 1, null], ["seasonal_period", "number", 4, 52, 1, null],
    ["seasonal_q", "number", 0, 1, 1, null], ["trend", "select", null, null, null, ["n", "c", "t", "ct"]],
  ],
  timesfm: [["context_length", "number", 52, 187, 1, null]],
  xgboost: [
    ["colsample_bytree", "number", 0.5, 1, 0.05, null], ["learning_rate", "number", 0.005, 0.3, 0.005, null],
    ["max_depth", "number", 2, 12, 1, null], ["min_child_weight", "number", 1, 20, 1, null],
    ["n_estimators", "number", 20, 500, 10, null], ["reg_lambda", "number", 0, 20, 0.1, null],
    ["subsample", "number", 0.5, 1, 0.05, null],
  ],
};
