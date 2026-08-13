import type { GatewayResultV1 } from "../../contracts/gateway";
import marketArtifact from "../generated/market-reference-v1.json";
import portArtifact from "../generated/port-traffic-fixture-v1.json";
import chokeArtifact from "../generated/chokepoint-traffic-fixture-v1.json";
import snapshotArtifact from "../generated/forecast-snapshot-v3.json";
import { record } from "../artifacts/decoder-core";
import {
  chokeFromArtifact,
  decodeInsightRequestV1,
  marketFromArtifact,
  portFromArtifact,
  type ChokepointDetailQueryV1,
  type ChokepointTrafficDataV1,
  type InsightDataV1,
  type InsightRequestV1,
  type MarketDataV1,
  type MarketQueryV1,
  type NewsDataV1,
  type NewsQueryV1,
  type PortDetailQueryV1,
  type PortTrafficDataV1,
  type SnapshotDataV1,
  type TuneRequestV1,
  type TuneSuccessV1,
  type TuningHealthDataV1,
} from "./domains";
import {
  decodeChokepointDetailResultV1,
  decodeChokepointSummaryResultV1,
  decodeInsightResultV1,
  decodeMarketResultV1,
  decodeNewsResultV1,
  decodePortDetailResultV1,
  decodePortSummaryResultV1,
  decodeSnapshotResultV1,
  decodeTuningHealthResultV1,
  decodeTuningRunResultV1,
  decodeWeatherUnavailableResultV1,
  type ChokepointStateV1,
  type InsightStateV1,
  type MarketStateV1,
  type NewsStateV1,
  type PortStateV1,
  type SnapshotStateV1,
  type TuningHealthStateV1,
  type TuningRunStateV1,
} from "./method-decoders";
import { gatewaySuccess, gatewayUnavailable } from "./result";

const FIXTURE_CLOCK = "2026-08-13T00:00:00+09:00";

function unavailable(source: string, message: string, reasonCode: string) {
  return gatewayUnavailable({
    state: "UNAVAILABLE",
    code: "NO_VALID_DATA",
    message,
    reasonCode,
    source,
    fetchedAt: FIXTURE_CLOCK,
    attribution: "MOVE AI approved data pack",
  });
}

export class FixtureDataGateway {
  async snapshot(_signal?: AbortSignal): Promise<GatewayResultV1<SnapshotDataV1, SnapshotStateV1>> {
    void _signal;
    return decodeSnapshotResultV1(gatewaySuccess({
      state: "READY",
      data: snapshotArtifact,
      mode: "fixture",
      source: "forecast-snapshot-v3",
      asOf: "2026-08-03",
      fetchedAt: FIXTURE_CLOCK,
      unit: "USD/FEU",
      isEstimate: true,
      attribution: "KOBC KCCI and approved model workbooks",
    }));
  }

  async market(query: MarketQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<MarketDataV1, MarketStateV1>> {
    void _signal;
    const data = marketFromArtifact(marketArtifact, query.series, query.from, query.to);
    if (data.points.length === 0) {
      return decodeMarketResultV1(
        unavailable("market-reference-v1", "요청 범위에 유효한 시장 데이터가 없습니다.", "EMPTY_DATE_RANGE"),
        query,
      );
    }
    return decodeMarketResultV1(gatewaySuccess({
      state: "REFERENCE",
      data,
      mode: "fixture",
      source: "market-reference-v1",
      asOf: data.observationEnd,
      fetchedAt: FIXTURE_CLOCK,
      unit: data.unit,
      isEstimate: false,
      attribution: "Approved market reference workbooks",
      provider: data.provider,
    }), query);
  }

  async news(query: NewsQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<NewsDataV1, NewsStateV1>> {
    void _signal;
    return decodeNewsResultV1(
      unavailable("news-policy-v18", "승인된 정적 기사 관측값이 없어 뉴스 fixture를 제공하지 않습니다.", "NO_APPROVED_ARTICLES"),
      query,
    );
  }

  async insight(body: InsightRequestV1, _signal?: AbortSignal): Promise<GatewayResultV1<InsightDataV1, InsightStateV1>> {
    void _signal;
    const request = decodeInsightRequestV1(body);
    const data = deterministicInsight(request);
    return decodeInsightResultV1(gatewaySuccess({
      state: "DERIVED",
      data,
      mode: "fixture",
      source: "insight-policy-v1",
      asOf: request.route.asOf,
      fetchedAt: FIXTURE_CLOCK,
      unit: "USD/FEU",
      isEstimate: true,
      attribution: "Deterministic rule fallback",
      warnings: ["Gemini was not invoked by the fixture provider."],
      provider: "RULE_FALLBACK",
    }), request);
  }

  async tuningHealth(_signal?: AbortSignal): Promise<GatewayResultV1<TuningHealthDataV1, TuningHealthStateV1>> {
    void _signal;
    return decodeTuningHealthResultV1(
      unavailable("tuning-config-v1", "배포된 tuning engine probe가 없습니다.", "ENGINE_OFFLINE"),
    );
  }

  async tuningRun(body: TuneRequestV1, _signal?: AbortSignal): Promise<GatewayResultV1<TuneSuccessV1, TuningRunStateV1>> {
    void _signal;
    return decodeTuningRunResultV1(
      unavailable("tuning-config-v1", "배포된 tuning engine이 없어 실행할 수 없습니다.", "ENGINE_OFFLINE"),
      body,
    );
  }

  async portSummary(_signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>> {
    void _signal;
    return decodePortSummaryResultV1(this.portEnvelope(portFromArtifact(portArtifact)));
  }

  async portDetail(query: PortDetailQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, PortStateV1>> {
    void _signal;
    const details = record(portArtifact, "$portArtifact").details;
    if (typeof details !== "object" || details === null || Array.isArray(details)) throw new Error("INVALID_PORT_ARTIFACT");
    if (!Object.hasOwn(details, query.id)) throw new Error("UNKNOWN_PORT_ID");
    return decodePortDetailResultV1(this.portEnvelope(portFromArtifact(portArtifact, query.id, query.days ?? 180)), query);
  }

  async chokeSummary(_signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>> {
    void _signal;
    return decodeChokepointSummaryResultV1(this.chokeEnvelope(chokeFromArtifact(chokeArtifact)));
  }

  async chokeDetail(query: ChokepointDetailQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, ChokepointStateV1>> {
    void _signal;
    const details = record(chokeArtifact, "$chokeArtifact").details;
    if (typeof details !== "object" || details === null || Array.isArray(details)) throw new Error("INVALID_CHOKE_ARTIFACT");
    if (!Object.hasOwn(details, query.id)) throw new Error("UNKNOWN_CHOKEPOINT_ID");
    return decodeChokepointDetailResultV1(this.chokeEnvelope(chokeFromArtifact(chokeArtifact, query.id)), query);
  }

  async weather(_signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    void _signal;
    return decodeWeatherUnavailableResultV1(
      unavailable("network-catalog-seam-v1", "승인된 정적 날씨 관측값이 없어 weather fixture를 제공하지 않습니다.", "NO_APPROVED_OBSERVATIONS"),
    );
  }

  private portEnvelope(data: PortTrafficDataV1) {
    return gatewaySuccess({
      state: "STALE",
      data,
      mode: "fixture",
      source: "port-traffic-fixture-v1",
      asOf: data.commonObservationDate,
      fetchedAt: FIXTURE_CLOCK,
      unit: "metric_tons_estimated,calls",
      isEstimate: true,
      attribution: "IMF PortWatch",
      warnings: ["Approved historical fixture; not live."],
      provider: "PortWatch",
      stale: true,
    });
  }

  private chokeEnvelope(data: ChokepointTrafficDataV1) {
    return gatewaySuccess({
      state: "STALE",
      data,
      mode: "fixture",
      source: "chokepoint-traffic-fixture-v1",
      asOf: data.latestObservationDate,
      fetchedAt: FIXTURE_CLOCK,
      unit: "metric_tons_estimated,calls",
      isEstimate: true,
      attribution: "IMF PortWatch",
      warnings: ["Approved historical fixture; not live."],
      provider: "PortWatch",
      stale: true,
    });
  }
}

function deterministicInsight(request: InsightRequestV1): InsightDataV1 {
  const selectedVotes = request.direction === "상승"
    ? request.modelAgreement.up
    : request.direction === "하락"
      ? request.modelAgreement.down
      : request.modelAgreement.flat;
  const voteOrder = [
    { direction: "상승", count: request.modelAgreement.up, priority: 0 },
    { direction: "보합", count: request.modelAgreement.flat, priority: 1 },
    { direction: "하락", count: request.modelAgreement.down, priority: 2 },
  ].sort((left, right) => right.count - left.count || left.priority - right.priority);
  const dominantDirection = voteOrder[0].direction;
  const agrees = dominantDirection === request.direction;
  const intervalWidthPct = 100 * (request.forecast.upper - request.forecast.lower) / Math.max(request.forecast.value, 1);
  const agreement = selectedVotes / Math.max(request.modelAgreement.total, 1);
  const confidence = intervalWidthPct <= 20 && agreement >= 0.7 && request.forecast.coveragePct >= 85
    ? "높음"
    : intervalWidthPct <= 35 && agreement >= 0.5
      ? "보통"
      : "낮음";
  const formatUsd = (value: number) => Math.round(value).toLocaleString("en-US");
  const move = 100 * (request.forecast.value - request.current.value) / request.current.value;
  const signedMove = move > 0 ? `${Math.abs(move).toFixed(1)}% 상승` : move < 0 ? `${Math.abs(move).toFixed(1)}% 하락` : "변동 없음";
  const headline = agrees
    ? `${request.route.name} 항로는 ${request.selectedHorizon}주 후 ${request.direction}권으로 전망됩니다.`
    : `${request.route.name} 항로의 선택 모델은 ${request.direction}이지만 모델 투표는 ${dominantDirection} 우세입니다.`;
  const voteText = agrees
    ? `${request.modelAgreement.total}개 모델 중 ${selectedVotes}개가 같은 방향입니다.`
    : `모델 투표는 상승 ${request.modelAgreement.up}·보합 ${request.modelAgreement.flat}·하락 ${request.modelAgreement.down}으로 ${dominantDirection} 의견이 가장 많아 선택 모델 전망과 엇갈립니다.`;
  const factor = (article: InsightRequestV1["news"][number]) => ({
    factor: article.factor.trim() || article.title,
    evidenceId: article.id,
  });
  return {
    engine: "RULE_FALLBACK",
    model: null,
    generatedAt: FIXTURE_CLOCK,
    headline,
    summary: `${request.current.date} 기준 ${formatUsd(request.current.value)} USD/FEU인 운임은 ${formatUsd(request.forecast.value)} USD/FEU로 ${signedMove}할 전망입니다. 설정된 분류 기준에서는 ${request.direction}이며, ${voteText} 검증 뉴스는 예측의 원인 확정이 아니라 상·하방 위험 신호로 함께 해석했습니다.`,
    confidence,
    quantitativeBasis: [
      `PI90 ${formatUsd(request.forecast.lower)}–${formatUsd(request.forecast.upper)} USD/FEU · 구간 폭 ${intervalWidthPct.toFixed(1)}%`,
      `${request.representativeModel.name} · MAPE ${request.representativeModel.mapePct.toFixed(1)}% · MASE ${request.representativeModel.mase.toFixed(2)}`,
      `모델 의견 상승 ${request.modelAgreement.up}·보합 ${request.modelAgreement.flat}·하락 ${request.modelAgreement.down}`,
    ],
    upwardFactors: request.news.filter((article) => article.directionCode === "UP").slice(0, 2).map(factor),
    downwardFactors: request.news.filter((article) => article.directionCode === "DOWN").slice(0, 2).map(factor),
    caution: confidence === "낮음"
      ? "예측구간이 넓거나 모델 의견이 엇갈려 점예측보다 상·하한 범위를 우선 확인해야 합니다."
      : "뉴스는 방향을 설명하는 보조 신호이며 예측값의 직접적인 인과 근거는 아닙니다.",
  };
}

export const fixtureDataGateway = new FixtureDataGateway();
