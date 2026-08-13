import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ROUTE_IDS } from "../../app/contracts";
import {
  fixedSeasonalNaiveScale,
  meanAbsoluteError,
} from "../../app/freight-risk/models/core/metrics";
import { loadApprovedModelsCatalog } from "../../app/freight-risk/models/reference-catalog";

test("every route, model, and horizon supplies a complete evidence dialog calculation", () => {
  const catalog = loadApprovedModelsCatalog();
  let checked = 0;
  for (const route of ROUTE_IDS) {
    const routeData = catalog[route];
    for (const model of routeData.models) {
      for (const [horizonIndex, records] of routeData.evaluationByModel[model.modelId].entries()) {
        assert.equal(records.length, 52);
        const firstOriginIndex = routeData.history.findIndex(({ date }) => date === records[0].forecastOrigin);
        assert.ok(firstOriginIndex >= 52);
        const scale = fixedSeasonalNaiveScale(
          routeData.history.slice(0, firstOriginIndex + 1).map(({ value }) => value),
          52,
        );
        const mase = meanAbsoluteError(records) / scale;
        assert.ok(Math.abs(mase - model.metricsByHorizon[horizonIndex].mase) < 0.0011);
        assert.equal(new Set(records.map(({ targetDate }) => targetDate)).size, 52);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 13 * 8 * 4);
});

test("evidence UI keeps the three metric-specific analysis structures and responsive dialog", async () => {
  const source = await readFile(new URL("../../app/freight-risk/models/EvidenceDialog.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../../app/freight-risk/models/ModelsClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../../app/freight-risk/models/models.module.css", import.meta.url), "utf8");

  for (const token of [
    "ACTUAL VS FORECAST",
    "SQUARED ERROR",
    "SCALED ERROR",
    "MAPE FORMULA",
    "MSE FORMULA",
    "MASE FORMULA",
    "상위 오차 5개",
    "계절 Naive 기준 1.000",
    "실측값이 0인 기록",
    "첫 외부평가 이전 학습 이력",
    "외부평가 중 발생한 미래 잔차",
    "기여도",
  ]) {
    assert.ok(source.includes(token), token);
  }
  assert.ok(source.includes("slice(0, count)"));
  assert.ok(source.includes("fixedSeasonalNaiveScale"));
  assert.ok(source.includes("data-evidence-hover-card=\"true\""));
  assert.ok(source.includes("onPointerEnter={() => setHoveredIndex(index)}"));
  assert.ok(source.includes("전체 기여도"));
  assert.ok(client.includes("history={routeData.history}"));
  assert.ok(client.includes("routeName={routeData.routeName}"));
  assert.ok(css.includes("width: min(1440px, 96vw)"));
  assert.ok(css.includes(".evidenceChartGrid, .evidenceDetailGrid { grid-template-columns: 1fr; }"));
  assert.ok(css.includes(".evidenceTableWrap { width: 100%; height: 210px; overflow: auto; }"));
  assert.ok(css.includes(".evidenceHoverCard rect { fill: #001290; stroke: #3fa1eb;"));
});
