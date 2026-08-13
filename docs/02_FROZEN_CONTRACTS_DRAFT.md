# 02. Frozen Contracts

상태: `CP0_CORE_FROZEN`

동결 시각: `2026-08-13 Asia/Seoul`

권위 입력: 승인된 Figma·PNG, clean-room WT 명세, `MOVE_AI_DATA_PACK/APP_USED_DATA`

이 문서는 신규 구현의 공통 seam을 동결한다. 이전 애플리케이션의 타입·함수·storage key를 호환성 목적으로 복사하지 않는다.

## 1. Route identity

기본 route는 `KNEI`다.

| 순서 | ID | 표시명 |
|---:|---|---|
| 1 | `KUWI` | 북미서안 |
| 2 | `KUEI` | 북미동안 |
| 3 | `KNEI` | 유럽 |
| 4 | `KMDI` | 지중해 |
| 5 | `KMEI` | 중동 |
| 6 | `KAUI` | 호주 |
| 7 | `KLEI` | 남미동안 |
| 8 | `KLWI` | 남미서안 |
| 9 | `KSAI` | 남아프리카 |
| 10 | `KWAI` | 서아프리카 |
| 11 | `KCI` | 중국 |
| 12 | `KJI` | 일본 |
| 13 | `KSEI` | 동남아 |

유효 route 판정은 정확한 ID allowlist로 수행한다. 부분 일치와 임의 대소문자 보정은 금지한다.

## 2. URL 계약

| Page | URL |
|---|---|
| Landing | `/` |
| Dashboard | `/freight-risk/dashboard?route={routeId}` |
| Models | `/freight-risk/models?route={routeId}` |
| Network | `/freight-risk/network?route={routeId}` |
| Allocation | `/freight-risk/allocation?route={routeId}` |

초기 route 해석 우선순위:

1. 유효한 URL `route`
2. 유효한 `move-ai:route:v1` localStorage
3. `KNEI`

route 변경은 URL `replaceState`, storage 저장, 동일 origin route event 발행을 하나의 transaction으로 처리한다.

## 3. Storage 계약

| 목적 | Key prefix |
|---|---|
| route | `move-ai:route:v1` |
| representative selection | `move-ai:representative:v1:` |
| tuning result | `move-ai:tuning:v1:` |
| route news | `move-ai:route-news:v1:` |
| forecast insight | `move-ai:forecast-insight:v1:` |

모든 storage payload는 `schemaVersion`, `savedAt`, domain identity를 가진다. `JSON.parse` 결과를 타입 단언하지 않고 완전한 구조 decoder를 통과시킨다. 손상·미래 schema·route mismatch payload는 부분 채택하지 않고 제거한다.

## 4. Gateway envelope

모든 public gateway 결과는 다음 공통 envelope를 가진다.

```ts
type DataMode = "live" | "cached" | "fixture" | "reference" | "unavailable";

type GatewayResultV1<TData, TState extends string> = {
  schemaVersion: "move-ai/gateway-v1";
  state: TState;
  data: TData | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  meta: {
    mode: DataMode;
    source: string;
    sourceUrl: string | null;
    asOf: string | null;
    fetchedAt: string;
    unit: string | null;
    isEstimate: boolean;
    cache: {
      hit: boolean;
      stale: boolean;
      ageSeconds: number | null;
    };
  };
};
```

규칙:

- `mode=unavailable`이면 `data=null`, `error!=null`이다.
- fixture/reference/cached 값을 UI에서 LIVE로 표시하지 않는다.
- `state`는 method별 정확한 literal allowlist를 가진다.
- public HTTP와 storage 경계에서 envelope와 domain data를 모두 구조 검증한다.
- upstream JSON은 `unknown`으로 받고 검증 전 타입 단언하지 않는다.

## 5. DataGateway 메서드

```ts
interface DataGateway {
  snapshot(signal?: AbortSignal): Promise<SnapshotResult>;
  market(query: MarketQuery, signal?: AbortSignal): Promise<MarketResult>;
  news(query: NewsQuery, signal?: AbortSignal): Promise<NewsResult>;
  insight(query: InsightQuery, signal?: AbortSignal): Promise<InsightResult>;
  tuningHealth(signal?: AbortSignal): Promise<TuningHealthResult>;
  tune(request: TuneRequest, signal?: AbortSignal): Promise<TuneResult>;
  portSummary(signal?: AbortSignal): Promise<PortSummaryResult>;
  portDetail(query: PortDetailQuery, signal?: AbortSignal): Promise<PortDetailResult>;
  chokeSummary(signal?: AbortSignal): Promise<ChokeSummaryResult>;
  chokeDetail(query: ChokeDetailQuery, signal?: AbortSignal): Promise<ChokeDetailResult>;
  weather(signal?: AbortSignal): Promise<WeatherResult>;
}
```

Query key는 method별 exact allowlist다. 알 수 없는 key, 중복 key, 빈 값, 범위 밖 값은 `INVALID_REQUEST`로 거부한다.

## 6. Snapshot 계약

데이터팩 동결값:

- 13 routes
- route당 KCCI history 187 observations
- 8 models: `naive`, `sarimax`, `lightgbm`, `xgboost`, `random_forest`, `prophet`, `timesfm`, `chronos`
- horizon `[1,2,3,4]`
- route×model forecast group당 정확히 4 forecasts
- rolling evaluation origin 52
- 단위 `USD/FEU`
- 기준일과 target date는 데이터팩 값이며 현재 시스템 날짜로 재작성하지 않는다.

Forecast tuple:

```ts
type ForecastPointV1 = {
  horizonWeeks: 1 | 2 | 3 | 4;
  targetDate: string;
  point: number;
  lower90: number;
  upper90: number;
  calibrationSampleSize?: number;
};
```

항상 `lower90 <= point <= upper90`, finite number, 정확한 horizon order를 검증한다.

## 7. RepresentativeSelection 계약

WT3가 생산하고 WT2·WT5가 소비한다.

필수 의미:

- route identity
- current observation `{date,value,unit}`
- automatic champion
- 실제 selected model `{id,name,version}`
- selection mode `automatic | manual`
- 동일 selected model의 정확한 1~4주 forecast tuple
- 동일 selected model의 정확한 1~4주 metrics tuple
- horizon별 8개 model agreement members
- forecast source, tuning run hash, evaluation protocol
- monotonic `representativeRevision`

WT2와 WT5는 원본 tuning store를 독자적으로 합치거나 서로 다른 horizon의 모델을 섞지 않는다.

Allocation 재실행 key는 실제 계산 입력만 포함한다.

```text
routeId + currentObservation + selected model identity
+ selected score/coverage + exact 1..4 forecast tuple
```

provenance/revision만 바뀌고 계산 입력이 같으면 재실행하지 않는다.

## 8. Network catalog 계약

승인 데이터팩으로 매번 재생성한다.

- routes: 13
- port markers: 57
- unique PortWatch series: 56
- chokepoints: 11
- weather locations: 82

catalog은 `schemaVersion`, `capturedAt`, `timezone`, source file hashes, deterministic `catalogSha256`을 가진다. route/port/choke/weather ID·좌표·sort·count를 구조 검증한다.

WebGL2 지원 환경에서는 MapLibre globe projection이 필수다. 2D fallback은 WebGL2 미지원 또는 context loss에서만 사용하며 정상 환경의 대체 구현으로 사용할 수 없다.

## 9. Market·News·Insight 상태

- FX `KRW/USD`
- Brent `USD/bbl`
- VLSFO `USD/metric ton`
- HARPEX `Index`; 공개 latest four reference를 full live series로 표현하지 않는다.
- News는 route relevance, dedupe, 시간상한, provider attempt/stats를 보존한다.
- Insight engine은 `GEMINI | RULE_FALLBACK`만 허용한다. OpenAI API와 관련 환경변수는 금지한다.
- `cached`는 domain state가 아니라 `meta.mode`로 표현한다.

## 10. CVaR 계약

`18_CVAR_ALLOCATION_CONFIG.xlsx`에서 재현한다.

- scenarios: 100,000
- allocation candidates: 101 (`0..100%`, 1% step)
- alpha: `0.9`
- weekly correlation: `0.75`
- asymmetric sigma: `(point-lower90)/1.645`, `(upper90-point)/1.645`
- objective: `expectedProcurementCost + riskWeight * CVaR90`
- route별 seed를 사용한 결정론적 PRNG

CVaR는 불리한 10%의 경제적 후회비용 평균이다. 총비용 percentile 또는 운임 percentile로 바꾸지 않는다.

## 11. Shell 계약

공통 Shell만 route/navigation/storage를 소유한다.

- Desktop rail: collapsed 68px, expanded 244px
- `<=900px`: off-canvas drawer 218px
- drawer open 시 body scroll lock
- Escape/close/navigation/unmount 시 정확히 복원
- opener focus restore
- page metadata는 dashboard/models/network/allocation의 단일 registry
- 각 페이지는 자체 Sidebar·Topbar·route owner를 만들지 않는다.

## 12. Null·0·단위·시간

- `null`은 미수집·미제공이며 숫자 `0`과 다르다.
- unit은 데이터팩과 provider 계약의 canonical string을 사용한다.
- `asOf`는 원천 관측일, `fetchedAt`은 수집 시각이다.
- fixture의 과거 `asOf`를 현재 날짜로 바꾸지 않는다.
- `isEstimate`와 source attribution을 UI에 보존한다.

## 13. 동결값과 남은 release 입력

- Figma: `MOVE AI Clean-room UI`, file key `RvydVRm2bD59KlTzfemK7F`; frame ID와 PNG bytes/SHA-256은 `03_FIGMA_DESIGN_BASELINE.md`가 소유한다.
- runtime: Node `>=22.13.0`, React/React DOM/RSC `19.2.8`, vinext `1.0.0-beta.5`, Vite `8.2.1`, TypeScript `6.0.3`; exact transitive graph는 `package-lock.json`이 소유한다.
- public API paths: `/api/freight-risk/market`, `/api/freight-risk/news`, `/api/freight-risk/insight`, `/api/freight-risk/tune`, `/api/globe-port-traffic`, `/api/globe-chokepoint-traffic`, `/api/globe-weather`.
- WT1~WT6 명세의 exact SHA-256은 `00_ALLOWED_INPUTS.md`가 소유하며 변경 시 WT7·WT8 PASS가 무효다.
- Landing 영상·poster·logo는 아직 승인 원본이 없으므로 WT1이 명시적 placeholder를 유지한다. 이 항목은 비시각 core와 다른 페이지 구현을 막지 않지만, WT1 PAGE_COMPLETE와 최종 release는 막는다.

위 동결값을 깨는 변경은 Master 승인 없이 금지한다. additive optional field도 owner와 소비자 test가 함께 있어야 한다.
