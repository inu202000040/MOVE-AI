import type { GatewayResultV1 } from "../../contracts/gateway";
import marketArtifact from "../generated/market-reference-v1.json";
import portArtifact from "../generated/port-traffic-fixture-v1.json";
import chokeArtifact from "../generated/chokepoint-traffic-fixture-v1.json";
import snapshotArtifact from "../generated/forecast-snapshot-v3.json";
import { finite, record, string } from "../artifacts/decoder-core";
import {
  chokeFromArtifact,
  decodeChokepointTrafficDataV1,
  decodeInsightDataV1,
  decodeInsightRequestV1,
  decodeMarketDataV1,
  decodePortTrafficDataV1,
  decodeSnapshotDataV1,
  decodeUnavailableData,
  marketFromArtifact,
  portFromArtifact,
  type ChokepointDetailQueryV1,
  type ChokepointTrafficDataV1,
  type EmptyQueryV1,
  type InsightDataV1,
  type InsightRequestV1,
  type MarketDataV1,
  type MarketQueryV1,
  type NewsQueryV1,
  type PortDetailQueryV1,
  type PortTrafficDataV1,
  type SnapshotDataV1,
  type TuneRequestV1,
} from "./domains";
import { gatewaySuccess, gatewayUnavailable, parseGatewayResultV1 } from "./result";

const FIXTURE_CLOCK = "2026-08-13T00:00:00+09:00";
const SNAPSHOT_STATES = ["READY", "UNAVAILABLE"] as const;
const MARKET_STATES = ["LIVE", "REFERENCE", "UNAVAILABLE"] as const;
const PORT_STATES = ["LIVE", "PARTIAL", "STALE", "UNAVAILABLE"] as const;
const CHOKE_STATES = ["LIVE", "STALE", "UNAVAILABLE"] as const;
const INSIGHT_STATES = ["LLM", "DERIVED", "UNAVAILABLE"] as const;

function stateGuard<const T extends readonly string[]>(states: T) {
  return (value: unknown): value is T[number] =>
    typeof value === "string" && (states as readonly string[]).includes(value);
}

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
  async snapshot(_signal?: AbortSignal): Promise<GatewayResultV1<SnapshotDataV1, (typeof SNAPSHOT_STATES)[number]>> {
    void _signal;
    const result = gatewaySuccess({ state: "READY", data: decodeSnapshotDataV1(snapshotArtifact), mode: "fixture", source: "forecast-snapshot-v3", asOf: "2026-08-03", fetchedAt: FIXTURE_CLOCK, unit: "USD/FEU", isEstimate: true, attribution: "KOBC KCCI and approved model workbooks" });
    return parseGatewayResultV1(result, decodeSnapshotDataV1, stateGuard(SNAPSHOT_STATES));
  }

  async market(query: MarketQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<MarketDataV1, (typeof MARKET_STATES)[number]>> {
    void _signal;
    const data = marketFromArtifact(marketArtifact, query.series, query.from, query.to);
    if (data.points.length === 0) {
      return parseGatewayResultV1(unavailable("market-reference-v1", "요청 범위에 유효한 시장 데이터가 없습니다.", "EMPTY_DATE_RANGE"), decodeMarketDataV1, stateGuard(MARKET_STATES));
    }
    const result = gatewaySuccess({ state: "REFERENCE", data, mode: "fixture", source: "market-reference-v1", asOf: data.observationEnd, fetchedAt: FIXTURE_CLOCK, unit: data.unit, isEstimate: false, attribution: "Approved market reference workbooks", provider: data.provider });
    return parseGatewayResultV1(result, decodeMarketDataV1, stateGuard(MARKET_STATES));
  }

  async news(_query: NewsQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    void _query;
    void _signal;
    return parseGatewayResultV1(unavailable("news-policy-v18", "승인된 정적 기사 관측값이 없어 뉴스 fixture를 제공하지 않습니다.", "NO_APPROVED_ARTICLES"), decodeUnavailableData, stateGuard(["UNAVAILABLE"]));
  }

  async insight(body: InsightRequestV1, _signal?: AbortSignal): Promise<GatewayResultV1<InsightDataV1, (typeof INSIGHT_STATES)[number]>> {
    void _signal;
    const data = deterministicInsight(body);
    const result = gatewaySuccess({ state: "DERIVED", data, mode: "fixture", source: "insight-policy-v1", asOf: null, fetchedAt: FIXTURE_CLOCK, unit: "USD/FEU", isEstimate: true, attribution: "Deterministic rule fallback", warnings: ["Gemini was not invoked by the fixture provider."], provider: "RULE_FALLBACK" });
    return parseGatewayResultV1(result, decodeInsightDataV1, stateGuard(INSIGHT_STATES));
  }

  async tuningHealth(_query: EmptyQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    void _query;
    void _signal;
    return parseGatewayResultV1(unavailable("tuning-config-v1", "배포된 tuning engine probe가 없습니다.", "ENGINE_OFFLINE"), decodeUnavailableData, stateGuard(["UNAVAILABLE"]));
  }

  async tuningRun(_body: TuneRequestV1, _signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    void _body;
    void _signal;
    return parseGatewayResultV1(unavailable("tuning-config-v1", "배포된 tuning engine이 없어 실행할 수 없습니다.", "ENGINE_OFFLINE"), decodeUnavailableData, stateGuard(["UNAVAILABLE"]));
  }

  async portSummary(_query: EmptyQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, (typeof PORT_STATES)[number]>> {
    void _query;
    void _signal;
    return this.portResult(portFromArtifact(portArtifact));
  }

  async portDetail(query: PortDetailQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<PortTrafficDataV1, (typeof PORT_STATES)[number]>> {
    void _signal;
    const details = record(portArtifact, "$portArtifact").details;
    if (typeof details !== "object" || details === null || Array.isArray(details)) throw new Error("INVALID_PORT_ARTIFACT");
    if (!Object.hasOwn(details, query.id)) throw new Error("UNKNOWN_PORT_ID");
    return this.portResult(portFromArtifact(portArtifact, query.id, query.days ?? 180));
  }

  private portResult(data: PortTrafficDataV1): GatewayResultV1<PortTrafficDataV1, (typeof PORT_STATES)[number]> {
    const result = gatewaySuccess({ state: "STALE", data, mode: "fixture", source: "port-traffic-fixture-v1", asOf: data.commonObservationDate, fetchedAt: FIXTURE_CLOCK, unit: "metric_tons_estimated,calls", isEstimate: true, attribution: "IMF PortWatch", warnings: ["Approved historical fixture; not live."], provider: "PortWatch", stale: true });
    return parseGatewayResultV1(result, decodePortTrafficDataV1, stateGuard(PORT_STATES));
  }

  async chokeSummary(_query: EmptyQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, (typeof CHOKE_STATES)[number]>> {
    void _query;
    void _signal;
    return this.chokeResult(chokeFromArtifact(chokeArtifact));
  }

  async chokeDetail(query: ChokepointDetailQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<ChokepointTrafficDataV1, (typeof CHOKE_STATES)[number]>> {
    void _signal;
    const details = record(chokeArtifact, "$chokeArtifact").details;
    if (typeof details !== "object" || details === null || Array.isArray(details)) throw new Error("INVALID_CHOKE_ARTIFACT");
    if (!Object.hasOwn(details, query.id)) throw new Error("UNKNOWN_CHOKEPOINT_ID");
    return this.chokeResult(chokeFromArtifact(chokeArtifact, query.id));
  }

  private chokeResult(data: ChokepointTrafficDataV1): GatewayResultV1<ChokepointTrafficDataV1, (typeof CHOKE_STATES)[number]> {
    const result = gatewaySuccess({ state: "STALE", data, mode: "fixture", source: "chokepoint-traffic-fixture-v1", asOf: data.latestObservationDate, fetchedAt: FIXTURE_CLOCK, unit: "metric_tons_estimated,calls", isEstimate: true, attribution: "IMF PortWatch", warnings: ["Approved historical fixture; not live."], provider: "PortWatch", stale: true });
    return parseGatewayResultV1(result, decodeChokepointTrafficDataV1, stateGuard(CHOKE_STATES));
  }

  async weather(_query: EmptyQueryV1, _signal?: AbortSignal): Promise<GatewayResultV1<never, "UNAVAILABLE">> {
    void _query;
    void _signal;
    return parseGatewayResultV1(unavailable("network-catalog-seam-v1", "승인된 정적 날씨 관측값이 없어 weather fixture를 제공하지 않습니다.", "NO_APPROVED_OBSERVATIONS"), decodeUnavailableData, stateGuard(["UNAVAILABLE"]));
  }
}

function deterministicInsight(value: InsightRequestV1): InsightDataV1 {
  const root = decodeInsightRequestV1(value);
  const routeName = string(root.route.name, "route.name");
  const currentValue = finite(root.current.value, "current.value");
  const forecastValue = finite(root.forecast.value, "forecast.value");
  const direction = root.direction;
  const move = currentValue > 0 ? ((forecastValue - currentValue) / currentValue) * 100 : 0;
  return decodeInsightDataV1({ engine: "RULE_FALLBACK", model: null, generatedAt: FIXTURE_CLOCK, headline: `${routeName} 운임은 ${direction}권으로 전망합니다.`, summary: `현재 운임 대비 ${Math.abs(move).toFixed(1)}% ${move > 0 ? "상승" : move < 0 ? "하락" : "변화 없음"}을 가리킵니다. 승인된 정량 입력만 사용한 결정론적 분석입니다.`, confidence: "낮음", quantitativeBasis: [`현재 ${Math.round(currentValue)} USD/FEU`, `전망 ${Math.round(forecastValue)} USD/FEU`], upwardFactors: [], downwardFactors: [], caution: "예측보다 실제 변동 범위를 우선 확인해야 합니다." });
}

export const fixtureDataGateway = new FixtureDataGateway();
