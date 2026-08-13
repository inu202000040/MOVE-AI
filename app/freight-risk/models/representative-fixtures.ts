import { computeTuningRunHash } from "./core/canonical";
import { meanAbsolutePercentageError, meanSquaredError } from "./core/metrics";
import { buildRepresentativeSelection } from "./core/representative";
import { writeAcceptedTuning, type StorageLikeV1 } from "./core/storage";
import { decodeTuneSuccess, defaultParameters } from "./core/tuning";
import type {
  FourTuple,
  HashedTuneResultV1,
  EightTuple,
  ModelProjectionV1,
  RepresentativeSelectionV1,
  TuneEvaluationHorizonV1,
  TuneForecastV1,
  TuneMetricV1,
  TuneSuccessV1,
} from "./core/types";
import { getModelsRepresentative } from "./representative-consumer";
import { loadApprovedModelsCatalog } from "./reference-catalog";

export interface ModelsRepresentativeHandoffFixturesV1 {
  readonly baseline: RepresentativeSelectionV1;
  readonly keep: RepresentativeSelectionV1;
  readonly rollback: RepresentativeSelectionV1;
  readonly provenanceOnly: RepresentativeSelectionV1;
}

class FixtureStorage implements StorageLikeV1 {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function tuple4<T>(values: readonly T[]): FourTuple<T> {
  if (values.length !== 4) throw new TypeError("Models handoff fixtures require four horizons");
  return values as FourTuple<T>;
}

function acceptedKeepFixture(): HashedTuneResultV1 {
  const route = loadApprovedModelsCatalog().KNEI;
  const model = route.models.find(({ modelId }) => modelId === "sarimax");
  if (model === undefined) throw new TypeError("KNEI SARIMAX fixture source is unavailable");
  const delta = 125;
  const forecasts = tuple4(model.forecasts.map((forecast, index): TuneForecastV1 => ({
    horizon: (index + 1) as 1 | 2 | 3 | 4,
    date: forecast.targetDate,
    value: forecast.point + delta,
    lower90: forecast.lower90 + delta,
    upper90: forecast.upper90 + delta,
  })));
  const evaluationByHorizon = tuple4(route.evaluationByModel.sarimax.map((records, index): TuneEvaluationHorizonV1 => ({
    horizon: (index + 1) as 1 | 2 | 3 | 4,
    records: records.map((record) => {
      const difference = record.predicted - record.actual;
      return {
        ...record,
        difference,
        absoluteError: Math.abs(difference),
        apePct: 100 * Math.abs(difference / record.actual),
        covered90: record.actual >= record.lower90 && record.actual <= record.upper90,
      };
    }),
  })));
  const metricsByHorizon = tuple4(evaluationByHorizon.map((group, index): TuneMetricV1 => {
    const pairs = group.records.map(({ actual, predicted }) => ({ actual, predicted }));
    const mse = meanSquaredError(pairs);
    const hits = group.records.filter(({ covered90 }) => covered90).length;
    return {
      horizon: (index + 1) as 1 | 2 | 3 | 4,
      mapePct: meanAbsolutePercentageError(pairs),
      mse,
      rmse: Math.sqrt(mse),
      mase: model.metricsByHorizon[index].mase,
      coverage90Pct: 100 * hits / group.records.length,
      hits,
      total: group.records.length,
      sampleSize: group.records.length,
    };
  }));
  const result: TuneSuccessV1 = decodeTuneSuccess({
    status: "success",
    routeCode: "KNEI",
    modelId: "sarimax",
    modelVersion: model.modelVersion,
    forecastOrigin: route.currentObservation.date,
    maseProtocol: "seasonal-naive-52-fixed",
    trainingWindow: "expanding",
    evaluationOrigins: 52,
    parameters: defaultParameters("sarimax"),
    forecasts,
    metricsByHorizon,
    evaluationByHorizon,
    elapsedMs: 1_250,
    methodologyKo: "공유 KEEP 인계 fixture",
  });
  return { result, tuningRunHash: computeTuningRunHash(result) };
}

function provenanceOnlyRepresentative(): RepresentativeSelectionV1 {
  const route = loadApprovedModelsCatalog().KNEI;
  const models = route.models.map((model): ModelProjectionV1 => model.modelId === "sarimax"
    ? { ...model, evaluationProtocol: `${model.evaluationProtocol}|provenance-fixture` }
    : model) as unknown as EightTuple<ModelProjectionV1>;
  return buildRepresentativeSelection({
    route: "KNEI",
    currentObservation: route.currentObservation,
    models,
  });
}

function representativeWithAccepted(accepted: HashedTuneResultV1): RepresentativeSelectionV1 {
  const storage = new FixtureStorage();
  writeAcceptedTuning(storage, "KNEI", accepted, "2026-08-13T04:16:12Z");
  return getModelsRepresentative("KNEI", storage);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function createHandoffFixtures(): ModelsRepresentativeHandoffFixturesV1 {
  const baseline = structuredClone(getModelsRepresentative("KNEI", new FixtureStorage()));
  return deepFreeze({
    baseline,
    keep: structuredClone(representativeWithAccepted(acceptedKeepFixture())),
    rollback: structuredClone(baseline),
    provenanceOnly: structuredClone(provenanceOnlyRepresentative()),
  });
}

export const MODELS_REPRESENTATIVE_HANDOFF_FIXTURES_V1 = createHandoffFixtures();
