import assert from "node:assert/strict";
import test from "node:test";

import {
  MODEL_IDS,
  decodeRepresentativeSelection,
  selectRepresentativeHorizon,
} from "../../app/freight-risk/dashboard/domain";

const MEMBER_POINTS = [104, 96, 102, 100, 110, 90, 105, 99] as const;

function representativeFixture(): Record<string, unknown> {
  const forecasts = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    targetDate: `2026-08-${String(3 + horizonWeeks * 7).padStart(2, "0")}`,
    point: 96,
    lower90: 80 - horizonWeeks,
    upper90: 110 + horizonWeeks,
  }));
  const metricsByHorizon = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    mapePct: 8 + horizonWeeks,
    mse: 100 + horizonWeeks,
    rmse: 10 + horizonWeeks,
    mase: 0.9,
    mapeScore: 70,
    mseScore: 70,
    maseScore: 70,
    totalScore: 70,
    coverage: {
      pct: 90,
      hits: 45,
      total: 50,
      sampleSize: 52,
      target: 0.9,
      intervalMethod: "PI90",
    },
  }));
  const modelAgreementByHorizon = [1, 2, 3, 4].map((horizonWeeks) => ({
    horizonWeeks,
    thresholdPct: 3,
    up: 3,
    down: 2,
    flat: 3,
    total: 8,
    members: MODEL_IDS.map((modelId, index) => {
      const point = MEMBER_POINTS[index];
      const changePct = point - 100;
      return {
        modelId,
        modelName: modelId === "sarimax" ? "SARIMAX" : modelId,
        modelVersion: modelId === "sarimax" ? "v1" : `${modelId}-v1`,
        forecastSource: "baseline",
        tuningRunHash: null,
        point,
        changePct,
        direction: changePct >= 3 ? "up" : changePct <= -3 ? "down" : "flat",
      };
    }),
  }));
  return {
    route: "KNEI",
    currentObservation: { date: "2026-08-03", value: 100, unit: "USD/FEU" },
    modelId: "sarimax",
    modelName: "SARIMAX",
    modelVersion: "v1",
    score1w: 70,
    coverage1w: 90,
    selectionMode: "automatic",
    forecastSource: "baseline",
    tuningRunHash: null,
    evaluationProtocol: "rolling-origin-52",
    automaticChampion: {
      modelId: "sarimax",
      modelName: "SARIMAX",
      modelVersion: "v1",
      score1w: 70,
    },
    representativeRevision: `rep-v1:${"0".repeat(64)}`,
    forecasts,
    metricsByHorizon,
    modelAgreementByHorizon,
  };
}

test("representative decoder reconstructs the complete WT3 projection", () => {
  const raw = representativeFixture();
  const decoded = decodeRepresentativeSelection(raw, "KNEI");
  assert.notEqual(decoded, null);
  assert.notStrictEqual(decoded, raw);
  assert.equal(decoded?.forecasts.length, 4);
  assert.equal(decoded?.metricsByHorizon.length, 4);
  assert.equal(decoded?.modelAgreementByHorizon[0].members.length, 8);

  if (decoded !== null) {
    const selected = selectRepresentativeHorizon(decoded, 4);
    assert.equal(selected.forecast.horizonWeeks, 4);
    assert.equal(selected.metrics.horizonWeeks, 4);
    assert.equal(selected.agreement.horizonWeeks, 4);
  }
});

test("representative decoder rejects route, tuple, arithmetic, and selected-model mismatches", () => {
  assert.equal(decodeRepresentativeSelection(representativeFixture(), "KCI"), null);

  const wrongOrder = representativeFixture();
  const forecasts = wrongOrder.forecasts;
  assert.equal(Array.isArray(forecasts), true);
  if (Array.isArray(forecasts)) {
    forecasts.reverse();
  }
  assert.equal(decodeRepresentativeSelection(wrongOrder), null);

  const wrongCounts = representativeFixture();
  const agreements = wrongCounts.modelAgreementByHorizon;
  if (Array.isArray(agreements) && typeof agreements[0] === "object" && agreements[0] !== null) {
    Reflect.set(agreements[0], "up", 4);
  }
  assert.equal(decodeRepresentativeSelection(wrongCounts), null);

  const mismatchedSelectedPoint = representativeFixture();
  const selectedForecasts = mismatchedSelectedPoint.forecasts;
  if (Array.isArray(selectedForecasts) && typeof selectedForecasts[0] === "object" && selectedForecasts[0] !== null) {
    Reflect.set(selectedForecasts[0], "point", 97);
  }
  assert.equal(decodeRepresentativeSelection(mismatchedSelectedPoint), null);
});

test("representative decoder rejects non-exact objects and invalid source identities", () => {
  const extraRoot = representativeFixture();
  extraRoot.unapproved = true;
  assert.equal(decodeRepresentativeSelection(extraRoot), null);

  const badRevision = representativeFixture();
  badRevision.representativeRevision = "rep-v1:not-a-revision";
  assert.equal(decodeRepresentativeSelection(badRevision), null);

  const badTuned = representativeFixture();
  badTuned.forecastSource = "tuned";
  assert.equal(decodeRepresentativeSelection(badTuned), null);
});
