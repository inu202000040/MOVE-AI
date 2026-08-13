import type { RouteId } from "../../../contracts";

import { ROUTE_FORECASTS as ROUTE_FORECAST_SOURCE } from "./forecasts";
import { MARKET_POINTS as MARKET_POINT_SOURCE } from "./market";
import { ROUTE_EVENTS } from "./events";
import { KAUI_SERIES } from "./route-kaui";
import { KCI_SERIES } from "./route-kci";
import { KJI_SERIES } from "./route-kji";
import { KLEI_SERIES } from "./route-klei";
import { KLWI_SERIES } from "./route-klwi";
import { KMDI_SERIES } from "./route-kmdi";
import { KMEI_SERIES } from "./route-kmei";
import { KNEI_SERIES } from "./route-knei";
import { KSAI_SERIES } from "./route-ksai";
import { KSEI_SERIES } from "./route-ksei";
import { KUEI_SERIES } from "./route-kuei";
import { KUWI_SERIES } from "./route-kuwi";
import { KWAI_SERIES } from "./route-kwai";

export const PERIOD_END = "2026-08-03";

export interface FixturePoint { readonly date: string; readonly value: number }
export interface FixtureForecast { readonly horizon: number; readonly targetDate: string; readonly point: number; readonly lower: number; readonly upper: number }
export interface FixtureMetric { readonly horizon: number; readonly mapePct: number; readonly mse: number; readonly mase: number; readonly totalScore: number; readonly coveragePct: number; readonly coverageHits: number; readonly coverageTotal: number; readonly sampleSize: number }
export interface FixtureProjection { readonly model: { readonly id: string; readonly name: string; readonly version: string }; readonly forecasts: readonly FixtureForecast[]; readonly metrics: readonly FixtureMetric[] }

const ROUTE_SERIES_SOURCE = {
  KUWI: KUWI_SERIES,
  KUEI: KUEI_SERIES,
  KNEI: KNEI_SERIES,
  KMDI: KMDI_SERIES,
  KMEI: KMEI_SERIES,
  KAUI: KAUI_SERIES,
  KLEI: KLEI_SERIES,
  KLWI: KLWI_SERIES,
  KSAI: KSAI_SERIES,
  KWAI: KWAI_SERIES,
  KCI: KCI_SERIES,
  KJI: KJI_SERIES,
  KSEI: KSEI_SERIES,
} satisfies Readonly<Record<RouteId, readonly FixturePoint[]>>;

export const ROUTE_SERIES: Readonly<Record<RouteId, readonly FixturePoint[]>> = ROUTE_SERIES_SOURCE;
export const ROUTE_FORECASTS: Readonly<Record<RouteId, FixtureProjection>> = ROUTE_FORECAST_SOURCE;
export const MARKET_POINTS: Readonly<Record<"fx" | "oil" | "bunker" | "harpex", readonly FixturePoint[]>> = MARKET_POINT_SOURCE;
export { ROUTE_EVENTS };
