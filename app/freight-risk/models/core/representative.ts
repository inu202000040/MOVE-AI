import { isRouteId, type RouteId } from "../../../contracts";
import { computeRepresentativeRevision, computeTuningRunHash } from "./canonical";
import { automaticChampion, scoreModelsForHorizon } from "./metrics";
import { MODEL_REGISTRY, isRiskModelId, modelDefinition } from "./registry";
import {
  HORIZONS,
  RISK_MODEL_IDS,
  ModelsContractError,
  type AgreementDirectionV1,
  type AgreementMemberV1,
  type AutomaticChampionV1,
  type CurrentObservationV1,
  type EightTuple,
  type ForecastPointV1,
  type FourTuple,
  type HashedTuneResultV1,
  type HorizonWeeks,
  type ModelAgreementV1,
  type ModelMetricInputV1,
  type ModelProjectionV1,
  type RepresentativeSelectionV1,
  type RepresentativeSemanticProjectionV1,
  type RiskModelId,
  type ScoredModelMetricV1,
} from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function fail(code: string, message: string): never {
  throw new ModelsContractError(code, message);
}

function tuple4<T>(values: readonly T[], label: string): FourTuple<T> {
  if (values.length !== 4) {
    return fail("TUPLE_LENGTH", `${label} must contain four items`);
  }
  return values as unknown as FourTuple<T>;
}

function tuple8<T>(values: readonly T[], label: string): EightTuple<T> {
  if (values.length !== 8) {
    return fail("TUPLE_LENGTH", `${label} must contain eight items`);
  }
  return values as unknown as EightTuple<T>;
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    fail("NON_FINITE", `${label} must be finite`);
  }
}

function validateProjection(model: ModelProjectionV1, expectedId: RiskModelId): void {
  if (model.modelId !== expectedId) {
    fail("MODEL_ORDER", "Model projections must use canonical registry order");
  }
  const definition = modelDefinition(expectedId);
  if (model.modelName !== definition.name || model.modelVersion.length === 0 || model.evaluationProtocol.length === 0) {
    fail("MODEL_IDENTITY", `Invalid identity for ${expectedId}`);
  }
  if (model.forecastSource === "baseline" && model.tuningRunHash !== null) {
    fail("BASELINE_HASH", "Baseline models must not carry a tuning hash");
  }
  if (model.forecastSource === "tuned" && !/^[0-9a-f]{64}$/u.test(model.tuningRunHash ?? "")) {
    fail("TUNING_HASH", "Tuned models require a lowercase SHA-256 hash");
  }
  if (model.forecasts.length !== 4 || model.metricsByHorizon.length !== 4) {
    fail("HORIZON_TUPLE", "Each model requires four forecasts and metrics");
  }
  for (const horizon of HORIZONS) {
    const forecast = model.forecasts[horizon - 1];
    const metric = model.metricsByHorizon[horizon - 1];
    if (forecast.horizonWeeks !== horizon || metric.horizonWeeks !== horizon) {
      fail("HORIZON_ORDER", "Forecasts and metrics must be ordered 1 through 4");
    }
    for (const [label, value] of Object.entries({
      point: forecast.point,
      lower90: forecast.lower90,
      upper90: forecast.upper90,
      mapePct: metric.mapePct,
      mse: metric.mse,
      rmse: metric.rmse,
      mase: metric.mase,
      coveragePct: metric.coverage.pct,
    })) {
      finite(value, `${expectedId}.${horizon}.${label}`);
    }
    if (!ISO_DATE.test(forecast.targetDate) || Number.isNaN(Date.parse(`${forecast.targetDate}T00:00:00Z`))
      || forecast.point <= 0 || forecast.lower90 < 0 || forecast.upper90 <= 0
      || forecast.lower90 > forecast.point || forecast.point > forecast.upper90) {
      fail("INTERVAL_ORDER", `${expectedId}.${horizon} interval is inverted`);
    }
    if (metric.mapePct < 0 || metric.mse < 0 || metric.rmse < 0 || metric.mase < 0
      || Math.abs(metric.rmse * metric.rmse - metric.mse) > Math.max(1e-8, metric.mse * 1e-6)) {
      fail("METRIC", `${expectedId}.${horizon} metrics are invalid`);
    }
    const coverage = metric.coverage;
    if (coverage.pct < 0 || coverage.pct > 100 || !Number.isInteger(coverage.hits)
      || !Number.isInteger(coverage.total) || !Number.isInteger(coverage.sampleSize)
      || coverage.hits < 0 || coverage.hits > coverage.total || coverage.total !== 52 || coverage.sampleSize !== 52
      || coverage.target !== 0.9 || coverage.intervalMethod.length === 0
      || Math.abs(coverage.pct - 100 * coverage.hits / coverage.total) > 1e-6) {
      fail("COVERAGE", `${expectedId}.${horizon} coverage is invalid`);
    }
  }
}

export function mergeAcceptedTune(
  baseline: ModelProjectionV1,
  accepted: HashedTuneResultV1,
  route: RouteId,
  currentObservation: CurrentObservationV1,
): ModelProjectionV1 {
  const { result, tuningRunHash } = accepted;
  if (computeTuningRunHash(result) !== tuningRunHash) {
    return fail("TUNING_HASH", "Accepted tuning result hash is invalid");
  }
  if (result.routeCode !== route || result.modelId !== baseline.modelId
    || result.forecastOrigin !== currentObservation.date) {
    return fail("TUNING_IDENTITY", "Accepted tuning result does not match its baseline projection");
  }
  const forecasts = tuple4(result.forecasts.map((forecast): ForecastPointV1 => ({
    horizonWeeks: forecast.horizon,
    targetDate: forecast.date,
    point: forecast.value,
    lower90: forecast.lower90,
    upper90: forecast.upper90,
  })), "tuned forecasts");
  const metricsByHorizon = tuple4(result.metricsByHorizon.map((metric): ModelMetricInputV1 => ({
    horizonWeeks: metric.horizon,
    mapePct: metric.mapePct,
    mse: metric.mse,
    rmse: metric.rmse,
    mase: metric.mase,
    coverage: {
      pct: metric.coverage90Pct,
      hits: metric.hits,
      total: metric.total,
      sampleSize: metric.sampleSize,
      target: 0.9,
      intervalMethod: baseline.metricsByHorizon[metric.horizon - 1].coverage.intervalMethod,
    },
  })), "tuned metrics");
  const merged: ModelProjectionV1 = {
    modelId: baseline.modelId,
    modelName: baseline.modelName,
    modelVersion: result.modelVersion,
    forecastSource: "tuned",
    tuningRunHash,
    evaluationProtocol: [
      result.maseProtocol,
      result.trainingWindow,
      String(result.evaluationOrigins),
      metricsByHorizon[0].coverage.intervalMethod,
    ].join("|"),
    forecasts,
    metricsByHorizon,
  };
  validateProjection(merged, baseline.modelId);
  return merged;
}

export function mergeAcceptedTunes(
  route: RouteId,
  currentObservation: CurrentObservationV1,
  baselineModels: EightTuple<ModelProjectionV1>,
  acceptedByModel: Readonly<Partial<Record<RiskModelId, HashedTuneResultV1>>>,
): EightTuple<ModelProjectionV1> {
  return tuple8(baselineModels.map((model) => {
    const accepted = acceptedByModel[model.modelId];
    return accepted === undefined ? model : mergeAcceptedTune(model, accepted, route, currentObservation);
  }), "merged models");
}

function directionFor(changePct: number): AgreementDirectionV1 {
  if (changePct >= 3) {
    return "up";
  }
  if (changePct <= -3) {
    return "down";
  }
  return "flat";
}

export function agreementDirection(changePct: number): AgreementDirectionV1 {
  finite(changePct, "changePct");
  return directionFor(changePct);
}

function agreementForHorizon(
  models: EightTuple<ModelProjectionV1>,
  currentValue: number,
  horizon: HorizonWeeks,
): ModelAgreementV1 {
  const members = tuple8(models.map((model): AgreementMemberV1 => {
    const point = model.forecasts[horizon - 1].point;
    const changePct = 100 * (point / currentValue - 1);
    return {
      modelId: model.modelId,
      modelName: model.modelName,
      modelVersion: model.modelVersion,
      forecastSource: model.forecastSource,
      tuningRunHash: model.tuningRunHash,
      point,
      changePct,
      direction: directionFor(changePct),
    };
  }), `agreement ${horizon}`);
  const up = members.filter(({ direction }) => direction === "up").length;
  const down = members.filter(({ direction }) => direction === "down").length;
  const flat = members.filter(({ direction }) => direction === "flat").length;
  return { horizonWeeks: horizon, thresholdPct: 3, up, down, flat, total: 8, members };
}

export interface BuildRepresentativeInputV1 {
  readonly route: RouteId;
  readonly currentObservation: CurrentObservationV1;
  readonly models: EightTuple<ModelProjectionV1>;
  readonly manualModelId?: unknown;
}

export function buildRepresentativeSelection(
  input: BuildRepresentativeInputV1,
): RepresentativeSelectionV1 {
  if (!(input.currentObservation.value > 0) || !Number.isFinite(input.currentObservation.value)
    || input.currentObservation.unit !== "USD/FEU" || !ISO_DATE.test(input.currentObservation.date)) {
    return fail("CURRENT_OBSERVATION", "Current observation is invalid");
  }
  input.models.forEach((model, index) => validateProjection(model, RISK_MODEL_IDS[index]));
  for (const horizon of HORIZONS) {
    const targetDate = input.models[0].forecasts[horizon - 1].targetDate;
    if (input.models.some((model) => model.forecasts[horizon - 1].targetDate !== targetDate)) {
      return fail("TARGET_DATE_MISMATCH", `All models must share the horizon ${horizon} target date`);
    }
  }

  const scoredByHorizon = HORIZONS.map((horizon) => scoreModelsForHorizon(
    input.models.map((model) => ({ modelId: model.modelId, metric: model.metricsByHorizon[horizon - 1] })),
  ));
  const automatic = automaticChampion(scoredByHorizon[0]);
  const automaticModel = input.models.find(({ modelId }) => modelId === automatic.modelId);
  if (automaticModel === undefined) {
    return fail("NO_CHAMPION", "Automatic champion projection is missing");
  }
  const hasManual = isRiskModelId(input.manualModelId);
  const selectedId = hasManual ? input.manualModelId : automatic.modelId;
  const selected = input.models.find(({ modelId }) => modelId === selectedId);
  if (selected === undefined) {
    return fail("SELECTED_MODEL", "Selected model projection is missing");
  }
  const selectedMetrics = tuple4(HORIZONS.map((horizon): ScoredModelMetricV1 => {
    const row = scoredByHorizon[horizon - 1].find(({ modelId }) => modelId === selectedId);
    if (row === undefined) {
      return fail("SELECTED_METRIC", `Selected model metric is missing for horizon ${horizon}`);
    }
    return row.metric;
  }), "selected metrics");
  const automaticChampionValue: AutomaticChampionV1 = {
    modelId: automatic.modelId,
    modelName: automaticModel.modelName,
    modelVersion: automaticModel.modelVersion,
    score1w: automatic.metric.totalScore,
  };
  const agreement = tuple4(HORIZONS.map((horizon) => agreementForHorizon(
    input.models,
    input.currentObservation.value,
    horizon,
  )), "model agreement");
  const semantic: RepresentativeSemanticProjectionV1 = {
    route: input.route,
    currentObservation: input.currentObservation,
    modelId: selected.modelId,
    modelName: selected.modelName,
    modelVersion: selected.modelVersion,
    score1w: selectedMetrics[0].totalScore,
    coverage1w: selectedMetrics[0].coverage.pct,
    selectionMode: hasManual ? "manual" : "automatic",
    forecastSource: selected.forecastSource,
    tuningRunHash: selected.tuningRunHash,
    evaluationProtocol: selected.evaluationProtocol,
    automaticChampion: automaticChampionValue,
    forecasts: selected.forecasts,
    metricsByHorizon: selectedMetrics,
    modelAgreementByHorizon: agreement,
  };
  return { ...semantic, representativeRevision: computeRepresentativeRevision(semantic) };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).toSorted();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function validFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validHashForSource(source: unknown, hash: unknown): boolean {
  return (source === "baseline" && hash === null)
    || (source === "tuned" && typeof hash === "string" && /^[0-9a-f]{64}$/u.test(hash));
}

export function validateRepresentativeSelection(value: unknown): value is RepresentativeSelectionV1 {
  if (!isPlainRecord(value) || !exactKeys(value, [
    "route", "currentObservation", "modelId", "modelName", "modelVersion", "score1w", "coverage1w",
    "selectionMode", "forecastSource", "tuningRunHash", "evaluationProtocol", "automaticChampion",
    "representativeRevision", "forecasts", "metricsByHorizon", "modelAgreementByHorizon",
  ]) || !isRouteId(value.route) || !isRiskModelId(value.modelId)) {
    return false;
  }
  const current = value.currentObservation;
  const champion = value.automaticChampion;
  if (!isPlainRecord(current) || !exactKeys(current, ["date", "value", "unit"])
    || typeof current.date !== "string" || !ISO_DATE.test(current.date)
    || !validFinite(current.value) || current.value <= 0
    || current.unit !== "USD/FEU" || !isPlainRecord(champion)
    || !exactKeys(champion, ["modelId", "modelName", "modelVersion", "score1w"])
    || !isRiskModelId(champion.modelId) || champion.modelName !== modelDefinition(champion.modelId).name
    || typeof champion.modelVersion !== "string" || champion.modelVersion.length === 0
    || !validFinite(champion.score1w) || champion.score1w < 0) {
    return false;
  }
  if (value.modelName !== modelDefinition(value.modelId).name
    || typeof value.modelVersion !== "string" || value.modelVersion.length === 0
    || !validFinite(value.score1w) || value.score1w < 0
    || !validFinite(value.coverage1w) || value.coverage1w < 0 || value.coverage1w > 100
    || (value.selectionMode !== "automatic" && value.selectionMode !== "manual")
    || (value.forecastSource !== "baseline" && value.forecastSource !== "tuned")
    || typeof value.evaluationProtocol !== "string" || typeof value.representativeRevision !== "string") {
    return false;
  }
  if (!validHashForSource(value.forecastSource, value.tuningRunHash)) {
    return false;
  }
  if (!Array.isArray(value.forecasts) || value.forecasts.length !== 4
    || !Array.isArray(value.metricsByHorizon) || value.metricsByHorizon.length !== 4
    || !Array.isArray(value.modelAgreementByHorizon) || value.modelAgreementByHorizon.length !== 4) {
    return false;
  }
  for (const horizon of HORIZONS) {
    const forecast = value.forecasts[horizon - 1];
    const metric = value.metricsByHorizon[horizon - 1];
    const agreement = value.modelAgreementByHorizon[horizon - 1];
    if (!isPlainRecord(forecast) || !exactKeys(forecast, ["horizonWeeks", "targetDate", "point", "lower90", "upper90"])
      || forecast.horizonWeeks !== horizon || typeof forecast.targetDate !== "string" || !ISO_DATE.test(forecast.targetDate)
      || !validFinite(forecast.point) || !validFinite(forecast.lower90) || !validFinite(forecast.upper90)
      || forecast.point <= 0 || forecast.lower90 < 0 || forecast.lower90 > forecast.point || forecast.point > forecast.upper90
      || !isPlainRecord(metric) || !exactKeys(metric, [
        "horizonWeeks", "mapePct", "mse", "rmse", "mase", "coverage",
        "mapeScore", "mseScore", "maseScore", "totalScore",
      ]) || metric.horizonWeeks !== horizon || !isPlainRecord(metric.coverage)
      || !exactKeys(metric.coverage, ["pct", "hits", "total", "sampleSize", "target", "intervalMethod"])
      || !isPlainRecord(agreement) || !exactKeys(agreement, [
        "horizonWeeks", "thresholdPct", "up", "down", "flat", "total", "members",
      ]) || agreement.horizonWeeks !== horizon || agreement.thresholdPct !== 3
      || agreement.total !== 8 || !Array.isArray(agreement.members) || agreement.members.length !== 8) {
      return false;
    }
    const metricValues = [
      metric.mapePct, metric.mse, metric.rmse, metric.mase,
      metric.mapeScore, metric.mseScore, metric.maseScore, metric.totalScore,
    ];
    const coveragePct = metric.coverage.pct;
    const coverageHits = metric.coverage.hits;
    const coverageTotal = metric.coverage.total;
    const coverageSampleSize = metric.coverage.sampleSize;
    if (!metricValues.every(validFinite) || metricValues.some((entry) => entry < 0)
      || Math.abs((metric.mapeScore as number) + (metric.mseScore as number) + (metric.maseScore as number)
        - 3 * (metric.totalScore as number)) > 1e-7
      || !validFinite(coveragePct) || coveragePct < 0 || coveragePct > 100
      || typeof coverageHits !== "number" || !Number.isInteger(coverageHits)
      || typeof coverageTotal !== "number" || !Number.isInteger(coverageTotal)
      || typeof coverageSampleSize !== "number" || !Number.isInteger(coverageSampleSize)
      || coverageTotal !== 52 || coverageSampleSize !== 52 || coverageHits < 0 || coverageHits > 52
      || metric.coverage.target !== 0.9 || typeof metric.coverage.intervalMethod !== "string"
      || Math.abs(coveragePct - 100 * coverageHits / 52) > 1e-6) {
      return false;
    }
    let up = 0;
    let down = 0;
    let flat = 0;
    for (const [index, member] of agreement.members.entries()) {
      const definition = MODEL_REGISTRY[index];
      if (!isPlainRecord(member) || !exactKeys(member, [
        "modelId", "modelName", "modelVersion", "forecastSource", "tuningRunHash", "point", "changePct", "direction",
      ]) || member.modelId !== definition.id || member.modelName !== definition.name
        || typeof member.modelVersion !== "string" || member.modelVersion.length === 0
        || !validHashForSource(member.forecastSource, member.tuningRunHash)
        || !validFinite(member.point) || member.point <= 0 || !validFinite(member.changePct)
        || Math.abs(member.changePct - 100 * (member.point / current.value - 1)) > 1e-9
        || member.direction !== directionFor(member.changePct)) {
        return false;
      }
      if (member.direction === "up") up += 1;
      else if (member.direction === "down") down += 1;
      else flat += 1;
    }
    if (agreement.up !== up || agreement.down !== down || agreement.flat !== flat || up + down + flat !== 8) {
      return false;
    }
    const selectedMember = agreement.members.find((member) => isPlainRecord(member) && member.modelId === value.modelId);
    if (!isPlainRecord(selectedMember) || selectedMember.modelName !== value.modelName
      || selectedMember.modelVersion !== value.modelVersion || selectedMember.forecastSource !== value.forecastSource
      || selectedMember.tuningRunHash !== value.tuningRunHash || selectedMember.point !== forecast.point) {
      return false;
    }
  }
  if (value.score1w !== (value.metricsByHorizon[0] as Record<string, unknown>).totalScore
    || value.coverage1w !== ((value.metricsByHorizon[0] as Record<string, unknown>).coverage as Record<string, unknown>).pct
    || (value.selectionMode === "automatic" && value.modelId !== champion.modelId)) {
    return false;
  }
  const { representativeRevision, ...semantic } = value;
  return /^rep-v1:[0-9a-f]{64}$/u.test(representativeRevision)
    && computeRepresentativeRevision(semantic as RepresentativeSemanticProjectionV1) === representativeRevision;
}
