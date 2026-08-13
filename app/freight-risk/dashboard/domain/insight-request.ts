import { ROUTE_LABELS } from "../../../contracts";

import type { ForecastHorizon } from "./horizon";
import type { NewsArticleV1, NewsDataV1 } from "./news";
import type { RepresentativeSelectionV1 } from "./representative";

export type InsightDirection = "상승" | "하락" | "보합";

export interface InsightRequestNewsV1 {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly publishedAt: string;
  readonly url: string;
  readonly directionCode: NewsArticleV1["directionCode"];
  readonly factor: string;
  readonly grade: NewsArticleV1["grade"];
  readonly reason: string;
}

export interface InsightRequestV1 {
  readonly route: { readonly id: string; readonly name: string; readonly asOf: string };
  readonly current: { readonly date: string; readonly value: number };
  readonly selectedHorizon: ForecastHorizon;
  readonly direction: InsightDirection;
  readonly forecast: {
    readonly date: string;
    readonly value: number;
    readonly changePct: number;
    readonly lower: number;
    readonly upper: number;
    readonly coveragePct: number;
  };
  readonly forecastPath: readonly {
    readonly horizon: ForecastHorizon;
    readonly date: string;
    readonly value: number;
    readonly lower: number;
    readonly upper: number;
  }[];
  readonly representativeModel: {
    readonly name: string;
    readonly mapePct: number;
    readonly mse: number;
    readonly mase: number;
    readonly totalScore: number;
  };
  readonly modelAgreement: { readonly up: number; readonly down: number; readonly flat: number; readonly total: 8 };
  readonly news: readonly InsightRequestNewsV1[];
}

function insightDirection(changePct: number): InsightDirection {
  return changePct >= 3 ? "상승" : changePct <= -3 ? "하락" : "보합";
}

function eligibleArticle(article: NewsArticleV1, currentDate: string): boolean {
  return article.publishedAt.slice(0, 10) <= currentDate;
}

export function createInsightRequest(
  selection: RepresentativeSelectionV1,
  selectedHorizon: ForecastHorizon,
  news: NewsDataV1,
): InsightRequestV1 {
  const index = selectedHorizon - 1;
  const forecast = selection.forecasts[index];
  const metrics = selection.metricsByHorizon[index];
  const agreement = selection.modelAgreementByHorizon[index];
  const changePct = 100 * (forecast.point / selection.currentObservation.value - 1);
  return {
    route: {
      id: selection.route,
      name: ROUTE_LABELS[selection.route],
      asOf: selection.currentObservation.date,
    },
    current: {
      date: selection.currentObservation.date,
      value: selection.currentObservation.value,
    },
    selectedHorizon,
    direction: insightDirection(changePct),
    forecast: {
      date: forecast.targetDate,
      value: forecast.point,
      changePct,
      lower: forecast.lower90,
      upper: forecast.upper90,
      coveragePct: metrics.coverage.pct,
    },
    forecastPath: selection.forecasts.map((item) => ({
      horizon: item.horizonWeeks,
      date: item.targetDate,
      value: item.point,
      lower: item.lower90,
      upper: item.upper90,
    })),
    representativeModel: {
      name: selection.modelName,
      mapePct: metrics.mapePct,
      mse: metrics.mse,
      mase: metrics.mase,
      totalScore: metrics.totalScore,
    },
    modelAgreement: {
      up: agreement.up,
      down: agreement.down,
      flat: agreement.flat,
      total: 8,
    },
    news: news.articles.filter((article) => eligibleArticle(article, selection.currentObservation.date)).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      source: article.source,
      publishedAt: article.publishedAt,
      url: article.url,
      directionCode: article.directionCode,
      factor: article.factor,
      grade: article.grade,
      reason: article.reason,
    })),
  };
}
