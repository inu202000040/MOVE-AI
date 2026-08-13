import { isRouteId, type RouteId } from "../../contracts";

import {
  economicLoss,
  type CvarSimulationInput,
  type CvarSimulationResult,
} from "./engine";

export const CVAR_CSV_HEADER = [
  "scenario",
  "route",
  "horizon_weeks",
  "fixed_share_pct",
  "spot_share_pct",
  "spot_rate_usd_feu",
  "fixed_cost_usd",
  "spot_cost_usd",
  "total_cost_usd",
  "economic_loss_usd",
  "loss_direction",
].join(",");

export interface CvarCsvArtifact {
  readonly filename: string;
  readonly content: string;
}

export function createCvarCsvFilename(
  route: RouteId,
  horizonWeeks: number,
  fixedSharePercent: number,
): string {
  return `cvar-simulation-${route}-${horizonWeeks}w-fixed-${fixedSharePercent}pct.csv`;
}

export function serializeRecommendedCvarCsv(
  route: RouteId,
  input: CvarSimulationInput,
  result: CvarSimulationResult,
): CvarCsvArtifact {
  if (!isRouteId(route)) {
    throw new TypeError("route must be a canonical RouteId");
  }
  if (result.spots.length !== 100_000) {
    throw new TypeError("CSV requires exactly 100,000 selected-horizon spots");
  }

  const fixedSharePercent = result.best.share;
  const spotSharePercent = 100 - fixedSharePercent;
  const fixedShare = fixedSharePercent / 100;
  const spotShare = 1 - fixedShare;
  const rows = new Array<string>(result.spots.length + 1);
  rows[0] = CVAR_CSV_HEADER;

  for (let index = 0; index < result.spots.length; index += 1) {
    const spot = result.spots[index];
    const fixedCost = fixedShare * input.volume * input.fixed;
    const spotCost = spotShare * input.volume * spot;
    const totalCost = fixedCost + spotCost;
    const loss = economicLoss(spot, input.fixed, fixedShare, input.volume);
    const direction =
      spot < input.fixed ? "spot_down_opportunity" : "spot_up_cost";
    rows[index + 1] = [
      index + 1,
      route,
      input.selectedHorizon,
      fixedSharePercent,
      spotSharePercent,
      spot.toFixed(2),
      fixedCost.toFixed(2),
      spotCost.toFixed(2),
      totalCost.toFixed(2),
      loss.toFixed(2),
      direction,
    ].join(",");
  }

  return {
    filename: createCvarCsvFilename(
      route,
      input.selectedHorizon,
      fixedSharePercent,
    ),
    content: `\uFEFF${rows.join("\n")}`,
  };
}
