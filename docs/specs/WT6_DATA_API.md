# WT6 데이터·API clean-room 구현 명세

## 0. 문서 목적과 권위

이 문서는 WT6 데이터 계층을 과거 구현물과 독립적으로 재구축하기 위한 단일 명세다.

허용된 권위는 다음 세 종류뿐이다.

1. 승인 데이터 팩의 논리 항목 00부터 18까지.
2. 각 외부 서비스가 발행한 공식 API, 스키마, 인증, 이용 조건 문서.
3. 이 문서에 명시된 frozen contract 표와 알고리즘.

승인되지 않은 구현 계보, 배포 산출물, 캡처 파일, 브라우저 파생 덤프, 화면 DOM 조사 결과, revision metadata, filesystem 위치, 구현 파일은 입력 권위가 아니다.

기존 산출물을 복사하거나 변형해 fixture, forecast snapshot, policy, catalog, identity sidecar를 만들지 않는다.

과거 애플리케이션 코드를 읽고 값을 추출하는 생성기나 parser를 만들지 않는다.

모든 정적 데이터는 승인 데이터 팩에서 결정론적으로 다시 생성한다.

데이터 팩에 없고 공식 provider 응답으로도 확인되지 않는 값은 만들지 않는다.

공개 화면에 나타나는 copy와 상태도 이 문서의 frozen 표에 없으면 추가하지 않는다.

이 문서에 기록하는 digest는 알고리즘과 생성 규칙뿐이다. 이전 artifact의 고정 digest는 권위로 사용하지 않는다.

---

## 1. 완료 정의

WT6 완료는 파일 존재가 아니라 다음 조건을 모두 만족하는 상태다.

- forecast snapshot이 승인 데이터 팩만으로 재생성된다.
- 일곱 public API가 typed DataGateway와 동일한 wire contract를 사용한다.
- fixture, live, cached, unavailable 경로가 같은 runtime decoder를 통과한다.
- state, mode, unit, asOf, null, zero, provenance가 사실과 일치한다.
- market, news, insight, port, chokepoint, weather, tuning의 provider 정책이 실행 가능한 테스트로 고정된다.
- network catalog와 identity sidecar가 승인 데이터 팩에서 함께 재생성된다.
- malformed input, wrong domain state, extra key, upstream schema drift가 public DTO로 통과하지 않는다.
- cache, retry, timeout, abort, no-store 정책이 endpoint별 경계값에서 검증된다.
- Gemini가 없거나 실패해도 deterministic insight fallback이 동작한다.
- 다른 LLM runtime이나 API는 사용하지 않는다.
- tuning은 배포된 engine probe가 증명한 capability만 available로 표시한다.
- P0와 P1 open defect가 0이다.

중간 fixture나 gateway만 완성한 상태는 완료가 아니다.

---

## 2. 승인 데이터 팩 지도

다음 논리 항목은 번호와 의미가 frozen이다.

| ID | 승인 내용 | WT6 용도 |
|---:|---|---|
| 00 | API catalog | provider identity, 인증, endpoint capability |
| 01 | route·port catalog | route, port, chokepoint, 좌표, upstream identity |
| 02 | KCCI weekly | 13개 route 실제 관측 |
| 03 | USD/KRW ECB | FX reference와 변환 근거 |
| 04 | Brent | oil reference |
| 05 | VLSFO | bunker reference |
| 06 | HARPEX | reference index |
| 07 | PortWatch port traffic | port fixture와 집계 검증 |
| 08 | PortWatch chokepoint traffic | chokepoint fixture와 집계 검증 |
| 09 | weather API reference | provider field, unit, location capability |
| 10 | route news reference | route query profile, curated evidence, 한국어 현지화 문구 |
| 11 | optional PORT-MIS TEU | 선택 비교 자료이며 public tonnage unit의 대체 근거가 아님 |
| 12 | data manifest | 입력 provenance와 승인 상태 |
| 13 | model forecast snapshot | 8-model, 4-horizon forecast 근거 |
| 14 | model evaluation | metric과 evaluation record 근거 |
| 15 | model tuning config | window, parameter allowlist, engine policy |
| 16 | route events and corridors | 검증 사건과 corridor 근거 |
| 17 | runtime provider catalog | provider 순서, timeout, 인증, attribution |
| 18 | CVaR allocation config | downstream allocation handoff |

00부터 18까지 중 항목 자체가 optional이라고 표시된 경우를 제외하고 누락된 입력이 있으면 publish를 실패시킨다.

승인 데이터 팩 안의 임시 작업 파일, 보조 조사 산출물, 임의 summary, 독립 HTML은 권위가 아니다. numbered workbook과 12 manifest가 우선이다.

03과 11처럼 packaging 형태가 다른 항목도 논리 ID로 조회한다. 파일명 추측이나 최신 파일 자동 선택은 금지한다.

---

## 3. clean-room regeneration protocol

모든 fixture, forecast snapshot, policy artifact, network catalog, identity sidecar는 다음 순서로 생성한다.

1. 12 manifest에서 논리 ID와 승인 상태를 읽는다.
2. 필요한 00–18 입력의 media type, sheet, schema version, 관측 기간을 검증한다.
3. input bytes의 SHA-256을 계산하고 이번 실행 manifest에 기록한다.
4. workbook cell을 명시된 schema로 runtime parse한다.
5. trim, case fold, Unicode normalization, date conversion, rounding은 이 문서에 허용된 field에만 적용한다.
6. domain invariant와 golden count를 검증한다.
7. 정렬 규칙과 object key 순서를 적용한다.
8. UTF-8, LF, BOM 없음, trailing newline 한 개의 canonical bytes를 만든다.
9. output byte size와 SHA-256을 계산한다.
10. runtime decoder로 output 전체를 다시 검증한다.
11. 임시 output이 완전히 통과한 뒤 atomic publish한다.

동일 입력과 동일 generator version은 동일한 output SHA-256을 만들어야 한다.

현재 시각이 의미에 영향을 주는 field는 virtual clock을 입력으로 받고 manifest에 기록한다.

정렬은 locale 의존 정렬을 쓰지 않고 Unicode code-unit 오름차순을 사용한다.

number serialization은 finite decimal만 허용한다. NaN, Infinity, 음의 Infinity는 publish 실패다.

manual correction은 금지한다. 승인 데이터 팩 정정이 필요하면 먼저 데이터 팩을 재승인한다.

이전 output hash가 다르다는 이유로 이전 output을 재사용하지 않는다.

동일 logical artifact ID에 서로 다른 candidate가 있으면 자동 선택하지 않고 생성 실패로 처리한다.

---

## 4. 정적 artifact와 provenance

WT6가 생성하는 논리 artifact는 최소 다음과 같다.

- forecast-snapshot-v3
- snapshot-evaluation-v3
- market-reference-v1
- port-traffic-fixture-v1
- chokepoint-traffic-fixture-v1
- news-policy-v18
- insight-policy-v1
- network-catalog-seam-v1
- network-catalog-seam-identity-v1
- fixture-catalog-v1
- provenance-manifest-v1

각 provenance entry는 다음 field를 가진다.

| field | 규칙 |
|---|---|
| logicalArtifactId | stable ID |
| schemaVersion | artifact schema literal |
| mediaType | canonical media type |
| byteSize | 생성 bytes의 정수 크기 |
| sha256 | 생성 bytes의 lowercase SHA-256 |
| inputs | data-pack logical ID, input digest, sheet 또는 table, 관측 범위 |
| generator | generator ID와 version |
| parameters | 정렬, window, rounding, clock 등 의미 parameter |
| generatedAt | timezone 포함 ISO timestamp |
| rowCounts | domain별 count |
| attribution | 공개 가능한 attribution |
| usageNote | license와 caveat |
| validation | PASS 또는 실패 사유 |

manifest 자체도 canonical bytes로 만들고 별도 identity record에 digest와 byte size를 기록한다.

secret-bearing provider request는 provenance에 넣지 않는다.

공개 attribution URL이 필요하면 response meta에서 제공하되 생성 manifest에는 provider catalog의 논리 identity를 기록한다.

---

## 5. 아키텍처

구성 요소의 책임은 다음과 같다.

| 계층 | 책임 |
|---|---|
| DataGateway | consumer가 사용하는 typed domain interface |
| server gateway | mode, cache, provider, fallback orchestration |
| provider adapter | 외부 응답을 unknown으로 받아 구조 검증 |
| normalizer | canonical domain DTO 생성 |
| runtime decoder | public envelope, state, data, null invariant 검증 |
| fixture provider | 승인 데이터 팩에서 생성된 immutable payload 제공 |
| HTTP route | exact query/body parsing, status와 Cache-Control 적용 |
| client gateway | HTTP JSON을 method-specific decoder로 검증 |

raw provider body를 public API로 반환하지 않는다.

provider JSON은 항상 unknown으로 시작하고 record, array, feature, attributes, scalar type을 단계별로 검사한다.

fixture와 live는 서로 다른 public parser를 사용하지 않는다.

hybrid는 payload schema가 아니라 선택 전략이다.

consumer가 HTTP JSON을 caller-selected generic DTO로 cast하는 경로를 두지 않는다.

---

## 6. 일곱 public API

| domain | route | method | query/body |
|---|---|---|---|
| market | /api/freight-risk/market | GET | exact market query |
| news | /api/freight-risk/news | GET | news v18 compatibility query |
| insight | /api/freight-risk/insight | POST | exact InsightRequestV1 |
| tuning | /api/freight-risk/tune | GET | empty query |
| tuning | /api/freight-risk/tune | POST | exact TuneRequestV1 |
| port | /api/globe-port-traffic | GET | empty summary 또는 id와 optional days detail |
| chokepoint | /api/globe-chokepoint-traffic | GET | empty summary 또는 id detail |
| weather | /api/globe-weather | GET | empty query |

다른 public endpoint를 추가하지 않는다.

allocation simulation은 별도 HTTP endpoint가 아니다.

---

## 7. typed DataGateway

DataGateway는 다음 method를 제공한다.

~~~text
snapshot(signal?)
market(query, signal?)
news(query, signal?)
insight(body, signal?)
tuningHealth(emptyQuery, signal?)
tuningRun(body, signal?)
portSummary(emptyQuery, signal?)
portDetail(query, signal?)
chokeSummary(emptyQuery, signal?)
chokeDetail(query, signal?)
weather(emptyQuery, signal?)
~~~

각 method는 Promise of GatewayResultV1 with its exact domain data and domain state union을 반환한다.

exact method mapping은 다음과 같다.

| method | input | data | state |
|---|---|---|---|
| snapshot | AbortSignal optional | SnapshotDataV1 | READY or UNAVAILABLE |
| market | MarketQueryV1 | MarketDataV1 | LIVE, REFERENCE, UNAVAILABLE |
| news | NewsQueryV1 | NewsDataV1 | LIVE, UNAVAILABLE |
| insight | InsightRequestV1 | InsightDataV1 | LLM, DERIVED, UNAVAILABLE |
| tuningHealth | EmptyQueryV1 | TuningHealthDataV1 | LIVE, PARTIAL, UNAVAILABLE |
| tuningRun | TuneRequestV1 | TuneSuccessV1 | READY, UNAVAILABLE |
| portSummary | EmptyQueryV1 | PortTrafficDataV1 without detail | LIVE, PARTIAL, STALE, UNAVAILABLE |
| portDetail | PortDetailQueryV1 | PortTrafficDataV1 with detail | LIVE, PARTIAL, STALE, UNAVAILABLE |
| chokeSummary | EmptyQueryV1 | ChokepointTrafficDataV1 without detail | LIVE, STALE, UNAVAILABLE |
| chokeDetail | ChokepointDetailQueryV1 | ChokepointTrafficDataV1 with detail | LIVE, STALE, UNAVAILABLE |
| weather | EmptyQueryV1 | WeatherDataV1 | LIVE, PARTIAL, UNAVAILABLE |

PortDetailQueryV1 is exact id plus optional days.

ChokepointDetailQueryV1 is exact id only.

All inputs and outputs are readonly at the public seam.

EmptyQueryV1의 의미는 Readonly Record with string keys and never values다. runtime에서는 key가 하나라도 있으면 reject한다.

각 client method는 required domain decoder를 전달해야 한다.

generic envelope validation만 수행한 뒤 domain type을 주장하는 double assertion은 금지한다.

method decoder는 다음을 함께 검증한다.

- exact root keys
- exact meta와 cache keys
- exact error keys
- 해당 domain state membership
- state와 data null invariant
- domain data exact keys와 nested DTO
- tuple length와 order
- keyed record key와 inner identity equality

---

## 8. GatewayResultV1 frozen contract

root key는 정확히 다섯 개다.

| field | type | invariant |
|---|---|---|
| schemaVersion | literal move-ai/gateway/v1 | 항상 동일 |
| state | domain state union | method별 guard 필수 |
| data | domain DTO 또는 null | UNAVAILABLE이면 null |
| meta | GatewayMetaV1 | 항상 존재 |
| error | GatewayErrorV1 또는 null | 성공 data이면 null |

UNAVAILABLE이면 data는 null이고 error는 non-null이다.

UNAVAILABLE이 아닌 state이면 data는 non-null이고 error는 null이다.

validation error도 같은 envelope를 쓰며 domain state는 UNAVAILABLE이다.

bare domain root는 public API에서 금지한다.

### 8.1 GatewayMetaV1

meta key는 정확히 다음과 같다.

| field | type |
|---|---|
| mode | live, fixture, cached, unavailable |
| source | string |
| sourceUrl | string 또는 null |
| asOf | ISO date 또는 timestamp 또는 null |
| fetchedAt | ISO timestamp |
| unit | string 또는 null |
| isEstimate | boolean |
| attribution | string |
| warnings | string array |
| provider | string 또는 null |
| cache | GatewayCacheMetaV1 |

GatewayCacheMetaV1 key는 정확히 hit, stale, ageSeconds다.

mode가 cached이면 cache.hit은 true다.

cache.stale이 true이면 domain이 STALE을 지원할 때 state도 STALE이다. STALE이 없는 domain에서는 warning과 original semantic state를 유지한다.

fixture를 LIVE로 표현하지 않는다.

sourceUrl에는 credential이나 signed query를 넣지 않는다.

### 8.2 GatewayErrorV1

error key는 정확히 다음과 같다.

| field | type |
|---|---|
| code | stable string |
| message | safe Korean string |
| retryable | boolean |
| upstreamStatus | integer 또는 null |
| details | allowlisted object 또는 null |

필수 code는 다음 의미를 보존한다.

- INVALID_REQUEST
- REQUEST_TOO_LARGE
- RATE_LIMITED
- UPSTREAM_TIMEOUT
- UPSTREAM_RATE_LIMITED
- UPSTREAM_UNAVAILABLE
- NO_VALID_DATA
- ENGINE_UNAVAILABLE
- ENGINE_UNSCORABLE
- ENGINE_FAILURE
- CONTRACT_MISMATCH
- INTERNAL_FAILURE

reasonCode처럼 forward-additive인 field를 구현체 enum으로 임의 폐쇄하지 않는다.

stack, raw provider body, filesystem detail, credential은 error에 넣지 않는다.

---

## 9. domain state와 mode

| domain | state union |
|---|---|
| snapshot | READY, UNAVAILABLE |
| market | LIVE, REFERENCE, UNAVAILABLE |
| news | LIVE, UNAVAILABLE |
| insight | LLM, DERIVED, UNAVAILABLE |
| port | LIVE, PARTIAL, STALE, UNAVAILABLE |
| chokepoint | LIVE, STALE, UNAVAILABLE |
| weather | LIVE, PARTIAL, UNAVAILABLE |
| tuning health | LIVE, PARTIAL, UNAVAILABLE |
| tuning run | READY, UNAVAILABLE |

state는 데이터 의미이고 mode는 획득 경로다.

cache hit을 자동으로 STALE로 바꾸지 않는다. freshness window를 넘은 verified payload에만 STALE을 쓴다.

fixture market은 REFERENCE다.

fixture port와 chokepoint는 STALE이다.

fixture news와 weather는 승인 관측이 없으면 UNAVAILABLE이다.

Gemini output만 LLM이다.

deterministic insight는 DERIVED다.

---

## 10. HTTP status contract

| 상황 | status |
|---|---:|
| 정상 domain data | 200 |
| 표현 가능한 news, weather, market, traffic unavailable | 200 |
| invalid query 또는 body | 400 |
| body limit 초과 | 413 |
| rate limit | 429 |
| valid tuning input but unscorable | 422 |
| tuning engine or selected model unavailable | 503 |
| tuning execution failure | 502 |
| tuning timeout | 504 |
| unexpected server failure | 500 |

모든 status는 GatewayResultV1 body를 반환한다.

HTML error body와 HTTP 204는 금지한다.

---

## 11. mode 선택

허용 server mode는 fixture, live, hybrid다.

unknown mode는 startup validation failure다.

query로 mode를 변경하지 않는다.

fixture mode는 network를 호출하지 않는다.

live mode는 provider와 verified cache만 사용하며 실패를 fixture로 조용히 대체하지 않는다.

hybrid 순서는 fresh verified cache, live provider, 허용된 stale cache, 승인 fixture, unavailable이다.

선택 결과를 meta.mode, cache, warnings에 사실대로 기록한다.

news와 weather처럼 승인 fixture가 없는 domain은 fake data 없이 unavailable로 끝난다.

---

## 12. 공통 ID, unit, null, 시간 invariant

canonical route ID 순서는 다음과 같다.

KUWI, KUEI, KNEI, KMDI, KMEI, KAUI, KLEI, KLWI, KSAI, KWAI, KCI, KJI, KSEI.

model ID 순서는 다음과 같다.

naive, sarimax, lightgbm, xgboost, random_forest, prophet, timesfm, chronos.

unknown canonical ID는 빈 success가 아니라 INVALID_REQUEST다.

port marker ID와 upstream PortWatch ID는 다르다.

shared upstream series는 여러 marker가 참조할 수 있지만 aggregation은 한 번만 수행한다.

unit registry는 다음과 같다.

| domain value | exact unit |
|---|---|
| KCCI route freight | USD/FEU |
| FX | KRW/USD |
| Brent | USD/bbl |
| bunker | USD/MT |
| HARPEX | Index |
| port cargo | metric_tons_estimated |
| vessel calls | calls |
| chokepoint transit cargo | metric_tons_estimated |
| temperature | Celsius |
| precipitation | millimeter |
| visibility | meter |
| wind and gust | knot |
| wave height | meter |
| wave period | second |
| ocean current | km/h |

실제 관측 0은 number 0이다.

missing, parse failure, non-finite는 null이다.

previous가 null 또는 0 이하이면 percentage change는 null이다.

null을 UI에서 0으로 format하지 않는다.

asOf는 관측 또는 적용 기준, fetchedAt은 취득 또는 조립 시각, generatedAt은 파생 결과 생성 시각이다.

세 값을 서로 대체하지 않는다.

future observation과 future news는 request 기준일 이후면 제외한다.

date-only 값은 YYYY-MM-DD로 유지한다.

timestamp는 offset 또는 Z를 포함한다.

---

## 13. forecast snapshot contract

forecast snapshot은 승인 데이터 팩 02, 13, 14, 15를 결합해 재생성한다.

frozen cardinality는 다음과 같다.

| item | count |
|---|---:|
| routes | 13 |
| observation dates per route | 187 |
| models per route | 8 |
| horizons per model | 4 |
| forecast rows | 416 |
| metric rows | 416 |
| evaluation records per model-horizon | 52 |
| total evaluation records | 21,632 |
| initial calibration origins | 26 |

이 count 중 하나라도 다르면 publish하지 않는다.

### 13.1 root

root field는 정확히 schemaVersion, generatedAt, protocol, source, dates, routes다.

schemaVersion은 glovis-freight-risk/v3다.

dates는 187개 ISO date의 오름차순 unique tuple이다.

routes는 array가 아니라 route ID keyed record다.

source에는 승인 데이터 팩 logical IDs, periodStart, periodEnd, observationCount가 들어간다. 과거 파일명이나 과거 artifact digest를 넣지 않는다.

protocol field는 다음을 가진다.

- horizonsWeeks exact tuple 1, 2, 3, 4
- evaluationOrigins 52
- initialCalibrationOrigins 26
- targetCoverage 0.9
- intervalMethod online absolute-error conformal
- windowStrategy expanding
- targetAvailabilityRule target_index_lte_forecast_origin

### 13.2 route

각 route key는 inner id와 같아야 한다.

route field는 id, name, unit, values, models다.

unit은 USD/FEU다.

values는 dates와 positional alignment를 갖는 finite positive number 187개다.

models는 frozen model 순서의 exact 8-item tuple이다.

### 13.3 snapshot model

model field는 id, name, version, metricsByHorizon, evaluationByHorizon, forecasts다.

metricsByHorizon은 horizon 1, 2, 3, 4 exact tuple이다.

각 metric은 다음 field를 가진다.

- horizon
- mapePct
- mse
- rmse
- mase
- coverage90Pct
- hits
- total
- sampleSize

metrics는 finite다. hits는 0 이상 total 이하이고 coverage90Pct와 일관되어야 한다.

evaluationByHorizon은 horizon 1, 2, 3, 4 exact tuple이며 각 group records는 52개다.

각 evaluation record field는 다음과 같다.

- forecastOrigin
- targetDate
- predicted
- actual
- difference
- absoluteError
- apePct
- lower90
- upper90
- covered90

difference는 predicted minus actual이다.

absoluteError는 difference의 절대값이다.

covered90은 inclusive interval membership과 같아야 한다.

forecastOrigin은 targetDate보다 빠르며 target availability rule을 위반하지 않는다.

snapshot forecasts는 horizon 1, 2, 3, 4 exact tuple이다.

각 SnapshotForecastV1 field는 horizon, date, value, lower90, upper90, calibrationSampleSize다.

lower90은 value 이하이고 value는 upper90 이하다.

### 13.4 publish와 runtime

일부 model 실패를 naive 값 복사로 채우지 않는다.

누락 route, model, horizon, non-finite, nonpositive forecast, interval inversion, alignment mismatch는 모두 publish failure다.

request마다 전체 snapshot을 다시 parse하지 않는다.

build gate에서 전체 decoder를 실행하고 runtime은 prevalidated immutable value를 사용한다.

consumer는 동일 snapshot identity를 공유하고 object를 mutate하지 않는다.

fingerprinted asset만 immutable cache를 사용한다.

---

## 14. network catalog seam

NetworkCatalogSeamV1은 승인 데이터 팩 01, 09, 12에서 재생성한다.

schemaVersion은 network-catalog-seam/v1이다.

root field는 정확히 다음과 같다.

- schemaVersion
- capturedAt
- timezone
- referenceManifestSha256
- routes
- ports
- chokepoints
- weather

timezone은 Asia/Seoul이다.

referenceManifestSha256은 이번 생성 실행이 실제로 사용한 승인 데이터 팩 manifest bytes의 digest다. 과거 값을 고정 복사하지 않는다.

배열 count는 routes 13, ports 57, chokepoints 11, weather 82다.

unique port upstream series는 56개다.

### 14.1 catalog record

route record field는 id, primaryPortId, waypointCoordinates다.

port record field는 id, routeId, longitude, latitude, upstreamPortWatchId, primary다.

chokepoint record field는 id, longitude, latitude, upstreamPortWatchId다.

weather record field는 id, kind, entityId, longitude, latitude다.

kind는 port, chokepoint, route 중 하나다.

coordinate는 longitude, latitude 순서다.

route waypoint order는 geometry 의미이므로 정렬하지 않는다.

각 top-level array는 id Unicode code-unit 오름차순이다.

object key order는 이 절의 field order다.

coordinate를 화면 표시 자릿수로 반올림하지 않는다.

shared upstream identity는 두 marker record에 보존하되 unique series 계산에서는 한 번만 센다.

### 14.2 identity sidecar

NetworkCatalogSeamIdentityV1은 catalog canonical bytes를 만든 뒤 같은 실행에서 생성한다.

identity는 최소 다음을 가진다.

- schemaVersion
- catalogSeamSha256
- byteSize
- routeCount
- portCount
- uniquePortSeriesCount
- chokepointCount
- weatherCount
- referenceManifestSha256

catalogSeamSha256은 이번 생성 bytes에서 계산한다.

catalog와 sidecar를 독립 입력에서 따로 만들지 않는다.

gateway와 consumer는 동일 catalog decoder와 identity assertion을 사용한다.

digest, count, reference manifest가 하나라도 다르면 traffic과 weather overlay data를 적용하지 않고 CONTRACT_MISMATCH로 처리한다.

geometry 탐색 자체는 consumer 소유 registry가 유효한 경우 유지할 수 있지만 mismatched observations를 결합하지 않는다.

---

## 15. cache, retry, abort core

cache key는 domain, normalized request, provider version, contract version, mode를 포함한다.

secret, authorization, raw cookie를 cache key에 넣지 않는다.

동일 key concurrent request는 single-flight한다.

cache에는 normalized payload, storedAt, source asOf, schema version, payload digest를 저장한다.

read 시 digest와 decoder를 다시 검증한다.

corrupt cache는 miss이며 warning을 남긴다.

validation error, 401, 403, unavailable은 장기 cache하지 않는다.

retryable 조건은 network failure, timeout, 408, 425, 429, 5xx다.

400, 401, 403과 validation 404는 retry하지 않는다.

429 Retry-After는 bounded safe range에서만 존중한다.

공통 backoff는 bounded exponential plus jitter이며 test에서는 virtual clock과 fixed seed를 사용한다.

request AbortSignal은 provider fetch, retry delay, body read에 전파한다.

timer는 finally에서 해제한다.

client abort는 upstream failure metric으로 세지 않는다.

---

## 16. market contract

### 16.1 exact query

MarketQueryV1 field는 정확히 series, from, to, providerVersion이다.

series는 fx, oil, bunker, harpex 중 하나다.

from과 to는 valid ISO date이며 from은 to보다 늦을 수 없다.

providerVersion은 literal 3이다.

누락, duplicate, unknown key, unknown series, invalid date, wrong version은 400 INVALID_REQUEST다.

type assertion이나 fabricated providerVersion으로 invalid query를 typed object로 만들지 않는다.

### 16.2 response

MarketDataV1 field는 다음과 같다.

- series
- label
- unit
- provider
- aggregation
- observationStart
- observationEnd
- points
- attempts

point는 date, week, value를 가진다.

points는 date 오름차순 unique다.

value는 finite이며 domain상 허용되지 않은 nonpositive row는 reject한다.

attempt에는 provider, safe result code, elapsedMs만 둔다.

### 16.3 provider chain

FX 의미는 KRW per USD다.

primary는 ECB reference rate다.

같은 date의 KRW per EUR를 USD per EUR로 나눠 KRW per USD를 만든다.

날짜가 다른 두 rate를 결합하거나 denominator 0인 row를 사용하지 않는다.

fallback 순서는 Yahoo KRW quote, FRED DEXKOUS다.

quote 방향과 inversion 여부를 provider normalization metadata에 기록한다.

서로 다른 provider의 partial point를 splice하지 않고 충분한 첫 provider series 하나를 선택한다.

Brent primary는 USDA catalog가 지정한 dataset, fallback은 Yahoo Brent proxy, 그 다음 FRED Brent series다.

proxy 사용은 warning에 명시한다.

bunker는 USDA catalog의 global 20-port average이며 특정 route의 실제 quote로 표현하지 않는다.

HARPEX는 승인 데이터 팩 06의 reference series다.

HARPEX state는 REFERENCE이며 unit은 exact string Index다.

승인 reference anchor는 다음 네 행을 포함해야 한다.

| date | value |
|---|---:|
| 2026-07-17 | 2340 |
| 2026-07-24 | 2340 |
| 2026-07-31 | 2343 |
| 2026-08-07 | 2346 |

네 market series를 합산한 invented composite를 만들지 않는다.

### 16.4 timeout와 cache

각 provider attempt timeout은 7초다.

성공 또는 REFERENCE header는 public max-age 900, shared max-age 3600, stale-while-revalidate 86400초다.

전체 provider failure와 invalid request는 no-store다.

fixture state는 REFERENCE이고 fixture asOf를 현재 시각으로 바꾸지 않는다.

---

## 17. news request와 root

NewsQueryV1 typed field는 route, asOf, providerVersion, retry이며 refresh만 optional이다.

route는 canonical route ID다.

asOf는 latest 또는 ISO date다.

providerVersion은 literal 18이다.

retry는 literal 0 또는 1이다.

refresh는 opaque cache-bust string이며 관측 기준일을 바꾸지 않는다.

public v18 compatibility parser는 다음 frozen behavior를 가진다.

- missing 또는 unknown route는 KNEI
- missing 또는 invalid asOf는 latest
- providerVersion은 18로 normalize
- retry가 exact 1일 때만 1, 그 외 0
- refresh는 존재하면 보존
- unknown key는 무시

typed client는 언제나 canonical required field를 모두 보낸다.

NewsDataV1 field는 routeId, stage, llmAnalyzed, window, policy, stats, articles, attempts다.

stage는 FILTERED이고 llmAnalyzed는 false다.

final display maximum은 5개다.

latest는 request 시각의 UTC date로 resolve한다.

retry 0은 실제 30-day fetch, retry 1은 실제 90-day fetch다.

response window와 attempt는 실제 provider request 범위를 기록한다.

---

## 18. news provider fan-out

provider version은 18이다.

다음 다섯 provider group을 병렬 호출한다.

| provider | official interface | timeout |
|---|---|---:|
| Container News | WordPress posts API | 7초 |
| gCaptain | WordPress posts API | 7초 |
| Google News | RSS search | 8초 |
| Bing News | RSS search | 5초 |
| GDELT | DOC article list | 10초 |

translation call timeout은 text당 5초다.

route-total timeout은 두지 않는다. 각 call timeout과 retry window만 적용한다.

WordPress request는 after, before, per_page 50, date descending, 필요한 date, link, title, excerpt field, freight rates search를 사용한다.

Google query variant는 broad route, route, official route, optional local route 순서다.

variant는 순차 실행하고 non-empty 첫 feed에서 멈춘다. 실패 또는 빈 feed 사이 delay는 300ms다.

query construction은 다음 frozen formula를 따른다.

~~~text
containerQuery =
  container shipping OR container freight OR liner shipping OR ocean freight OR sea freight

routeQuery =
  containerQuery AND operationalQuery AND destinationQuery AND dateQuery

broadRouteQuery =
  destinationQuery AND (container OR liner OR port)
  AND (freight OR shipping OR congestion OR service OR surcharge)
  AND dateQuery

officialRouteQuery =
  destinationQuery
  AND (Maersk OR MSC OR CMA CGM OR Hapag-Lloyd OR ONE OR COSCO OR HMM OR port OR terminal)
  AND operationalQuery AND dateQuery

localRouteQuery = approved localQuery AND dateQuery

gdeltRouteQuery =
  first eight matchTerms joined by OR
  AND (container shipping OR container freight OR freight rate OR blank sailing OR port congestion)
~~~

dateQuery는 retry 0일 때 resolved asOf를 포함하는 30 UTC calendar days, retry 1일 때 90 UTC calendar days를 표현한다.

primary window는 asOf minus 29 days 00:00:00Z부터 asOf 23:59:59Z까지다.

extended window는 asOf minus 89 days 00:00:00Z부터 asOf 23:59:59Z까지다.

curated boundary notice만 primary 시작 7일 전까지 허용할 수 있으며 effectiveAt이 asOf 이하이고 isBoundary true여야 한다.

Bing은 route query RSS를 사용하고 documented wrapped target이 있으면 실제 target URL로 normalize한다.

GDELT은 첫 8개 route match term과 container freight terms를 사용하고 maximum 100, date descending 범위를 요청한다.

merge order는 GDELT, Google, Bing, Container News, gCaptain이다. network completion order를 사용하지 않는다.

일부 provider 실패는 성공 provider 결과를 폐기하지 않는다.

provider JSON, RSS, attributes는 구조 검증 후 normalize한다.

news request User-Agent 의미는 Mozilla/5.0 compatible GLOVIS-FreightRisk/1.1로 고정하며 provider가 연락 가능한 식별자를 요구하면 승인 provider catalog의 server-only 식별자를 결합한다.

publishedAt과 public URL이 없는 row는 reject한다.

future article은 reject한다.

full article text를 재배포하지 않는다.

---

## 19. frozen route news profile

모든 route의 operationalQuery는 다음 의미 그룹의 OR 결합이다.

- freight rate, spot rate, contract rate, FAK, GRI, PSS, BAF, surcharge
- blank sailing, port omission, booking suspension, service suspension, capacity cut, new service, schedule reliability
- port congestion, terminal congestion, closure, strike, delay, rerouting, diversion, typhoon, hurricane, drought
- fuel surcharge, bunker fuel, war risk, emissions surcharge, equipment shortage

route profile은 승인 데이터 팩 10의 array order를 보존한다.

| route | destination identity | match and port terms |
|---|---|---|
| KUWI | US West Coast, USWC, Transpacific West Coast | Los Angeles, Long Beach, Oakland, Seattle, Tacoma, San Pedro Bay |
| KUEI | US East Coast, USEC, US Gulf | Savannah, Charleston, Norfolk, New York, New Jersey, Jacksonville, Jaxport, Panama Canal |
| KNEI | North Europe, Europe | Rotterdam, Hamburg, Bremerhaven, Antwerp, Suez, Red Sea |
| KMDI | Mediterranean, Türkiye, Turkey | Izmit, Mersin, Piraeus, Valencia, Barcelona, Algeciras, Suez |
| KMEI | Middle East, UAE, Saudi Arabia | Jebel Ali, Jeddah, Dammam, Red Sea, Hormuz, Bab el-Mandeb |
| KAUI | Australia | Port Botany, Sydney, Melbourne, Brisbane, Fremantle |
| KLEI | East Coast South America, ECSA, Brazil | Santos, Paranagua, Navegantes, Rio Grande |
| KLWI | West Coast South America, WCSA, Mexico, Chile, Peru | Manzanillo, Lazaro Cardenas, Callao, San Antonio, Valparaiso |
| KSAI | South Africa | Durban, Gqeberha, Ngqura, Cape Town |
| KWAI | West Africa, Nigeria, Ghana, Cote d Ivoire | Lagos, Apapa, Tema, Abidjan, Lome |
| KCI | China | Shanghai, Ningbo, Shenzhen, Yantian, Qingdao, Tianjin |
| KJI | Japan | Yokohama, Nagoya, Kobe, Tokyo, Osaka |
| KSEI | Southeast Asia, ASEAN, Indonesia, Vietnam, Singapore, Malaysia, Thailand, Philippines | Tanjung Priok, Cai Mep, Hai Phong, Tuas, Pasir Panjang, Port Klang, Manila, Laem Chabang |

KLEI와 KLWI의 승인 local-language terms, KCI의 중국어 terms, KJI의 일본어 terms는 데이터 팩 10의 Unicode bytes를 보존한다.

없는 countries, coreTerms, riskTerms, exclusionTerms field를 route별로 추론해 만들지 않는다.

---

## 20. news scoring, grade, direction

normalization 순서는 publish date parse, window filter, exact title source suffix 제거, lowercase search text 구성이다.

market-related context는 container, shipping, freight, ocean, liner, port, vessel, carrier, tariff, canal, supply chain, trade route를 포함한다.

container context는 container 표현, TEU, 승인 다국어 container 표현 또는 known liner와 shipping, freight, rate, surcharge, service 결합이다.

known liner set은 MSC, Maersk, Hapag-Lloyd, COSCO, OOCL, CMA CGM, HMM, Evergreen, Yang Ming, ZIM, Ocean Network Express다.

exclusion family는 cruise, passenger, ferry, yacht, naval, tanker, dry bulk, PCTC, ro-ro, car carrier, air freight, parcel, warehouse, factory, shipyard, newbuild, automotive logistics다.

corporate noise family는 earnings, share, stock, dividend, executive, appointment, acquisition, award, ceremony, record throughput, master plan, first call, largest ship다.

direct rate hit가 있으면 exclusion과 corporate noise에도 계속 평가할 수 있다.

impact signal increment는 다음과 같다.

| signal | examples | increment | display |
|---|---|---:|---|
| directRate | rate, GRI, FAK, PSS, surcharge, index, tender | 10 | 운임·할증료 |
| capacity | blank sailing, capacity change, service suspension, omission, booking suspension | 7 | 선복·결항 |
| disruption | congestion, queue, closure, strike, reroute, conflict, weather, canal restriction | 7 | 운항·항만 차질 |
| operatingCost | bunker, fuel, Brent, BAF, ETS, insurance | 6 | 연료·운항비 |
| equipment | equipment, empty container, reefer, chassis shortage | 6 | 컨테이너 장비 |
| demand | booking demand, peak season, inbound or outbound trade move, trade volume | 3 | 수요 변화 |
| tradePolicy | tariff, sanction, customs, restriction, ban | 4 | 통상정책 |

strong impact는 directRate, capacity, disruption, operatingCost, equipment 중 하나다.

soft impact는 demand 또는 tradePolicy가 impact language와 결합하거나 둘이 함께 있는 경우다.

grade는 numeric cutoff가 아니라 다음 rule이다.

- S: directRate 또는 booking suspension, port closure, terminal closure, forced reroute, port omission
- A: S가 아니고 capacity, disruption, operatingCost, equipment 중 하나
- B: 나머지 contextual 또는 fallback

gradeLabel exact strings는 S 직접 가격·운항, A 직접 운영 영향, B 시장 참고다.

direction은 번역 전 title token으로 분류한다.

- UP: surge, rise, rate hike, rate increase, freight increase, disruption, strike, congestion, attack, tariff, closure, surcharge, omission
- DOWN: fall, drop, decline, ease, reopen, capacity increase, new service, capacity addition
- 양쪽 hit: MIXED
- 어느 쪽도 없음: NEUTRAL

direction display는 상승 압력, 하락 압력, 혼합 신호, 방향 불확실이다.

factor priority는 노무, 지정학, 통상, 항만, 선복, 시장동향 순서다.

curated article의 direction, factor, grade는 데이터 팩 10 값을 그대로 사용한다.

### 20.1 admission and score

direct 또는 contextual candidate는 다음을 모두 통과한다.

1. date window와 non-empty title
2. maritime context와 route match term
3. container context 또는 route-scoped port context
4. exclusion and corporate noise rule
5. KCI, KJI, KSEI는 Korea or Busan 결합, destination port plus operational signal, 또는 approved route-port context
6. strong or soft impact가 없으면 route-scoped market-related contextual B만 허용

direct routeScore는 impactScore times 10 plus route hits times 2 plus port hits times 3 plus brand boost plus route-scope boost다.

Hyundai Glovis brand boost는 5, route-scoped boost는 1이다.

contextual B score는 route hits times 2 plus port hits times 3 plus port-hit bonus 8이다.

90-day fallback은 route-scoped provider만 허용하고 score는 4 plus route hits times 2 plus port hits times 3 plus port bonus 8 plus container bonus 3 minus primary-window-outside penalty 20이다.

fallback impactScore는 1이고 grade는 B다.

### 20.2 ordering and dedupe

pool priority는 direct, contextual, fallback이다.

pre-dedupe sort는 routeScore descending, articlePriority descending, publishedAt descending, stable encounter order다.

canonical URL normalization은 fragment removal, lowercase hostname, leading www removal, tracking query removal, remaining query key sort, duplicate slash collapse, trailing slash removal 순서다.

tracking key family는 utm prefix, cmpid, fbclid, gclid, guccounter, mc_cid, mc_eid, ocid, ref, ref_src, source다.

title normalization은 NFKC, lowercase, common entity spacing, non-letter-or-number spacing, whitespace collapse, trim 순서다.

fuzzy token은 길이 1 이하와 a, an, and, as, at, by, for, from, in, is, of, on, or, the, to, with, breaking, latest, news, report, reports, says, update, updates를 제거한다.

dedupe 순서는 exact canonical URL, exact normalized title, 4일 이내 token-set Jaccard 0.8 이상이다.

같은 key score tie는 먼저 만난 provider merge-order item을 유지한다.

curated는 S, A, B 순서, publishedAt descending, 데이터 팩 catalog order다.

curated는 dynamic보다 앞에 둔다.

remainingSlots는 max 0 and 5 minus curated count다.

dynamic은 remainingSlots plus 3개까지 번역 시도한 뒤 remainingSlots만 선택한다.

final ID는 display order에 따른 문자열 1부터 5다.

### 20.3 stats

| field | exact meaning |
|---|---|
| fetchedCandidates | provider merge 후 raw candidate count, curated 제외 |
| filteredCandidates | pool merge 후 fuzzy dedupe 전 count |
| duplicatesRemoved | exact key encounters plus URL, title, near-title removals |
| selectedArticles | curated plus dynamic final count, maximum 5 |
| successfulProviders | raw count가 1 이상인 attempt 수 |
| candidateBreakdown.directImpact | direct map size |
| candidateBreakdown.contextual | contextual map size |
| candidateBreakdown.routeFallback | fallback map size |

---

## 21. NewsArticleV1 and localization

NewsArticleV1 field는 정확히 다음과 같다.

- id
- title
- summary
- originalTitle
- source
- publishedAt
- effectiveAt 또는 null
- url
- direction
- directionCode
- factor
- relevance
- impactScore
- impactSignals
- grade
- gradeLabel
- reason
- isBoundary
- provenance

directionCode는 UP, DOWN, MIXED, NEUTRAL 중 하나다.

grade는 S, A, B 중 하나다.

provenance는 VERIFIED 또는 LIVE_SEARCH다.

relevance는 ROUTE다.

URL은 http 또는 https scheme만 허용한다.

dynamic localization 순서는 다음과 같다.

1. exact approved Korean localization key lookup
2. title 300자와 summary 900자를 translation provider에 병렬 요청
3. 둘 중 하나라도 실패하면 pair 전체 fallback
4. fallback title은 original title
5. source summary에 한국어가 없으면 route, impact signal, translation delay template 사용
6. originalTitle은 항상 원문 보존

승인된 exact Korean localization 여섯 개는 다음과 같다.

| original title | Korean title | Korean summary |
|---|---|---|
| Carrier Discounts Push Container Spot Rates Lower Ahead of August GRIs | 8월 일괄운임인상 앞두고 선사 할인 확대…컨테이너 스폿 운임 하락 | 8월 일괄운임인상(GRI)을 앞두고도 선사 주도의 가격 인상이 나타나지 않으면서 태평양 횡단 및 아시아–유럽 컨테이너 스폿 운임이 또 한 주 한 자릿수 하락했습니다. |
| Container Spot Rates Fall for Third Straight Week as Demand Continues to Ease | 수요 둔화에 컨테이너 스폿 운임 3주 연속 하락 | 글로벌 컨테이너 스폿 운임이 3주째 하락했습니다. 수요 약화와 조기 선적 특수 종료가 주요 동서 항로 운임에 하방 압력을 가했습니다. |
| MSC announces new Far East-Europe freight rates | MSC, 극동발 유럽행 신규 FAK 운임 발표 | MSC가 극동에서 북유럽·지중해·흑해로 향하는 화물의 신규 FAK(품목무차별운임)를 발표했습니다. 새 운임은 2026년 8월 15일부터 적용되며 유효기간은 8월 31일을 넘지 않습니다. |
| MSC announces new Europe freight rates from South Asia | MSC, 남아시아발 유럽행 신규 FAK 운임 발표 | MSC가 스리랑카·방글라데시·인도·파키스탄발 유럽행 화물에 새로운 FAK 운임을 적용합니다. 2026년 8월 16일부터 시행되며 유효기간은 8월 31일을 넘지 않습니다. |
| CMA CGM Posts Strong Q2 Earnings as Middle East Disruptions Boost Shipping Rates | 중동발 차질로 운임 상승…CMA CGM 2분기 실적 호조 | CMA CGM은 견조한 세계 교역과 운임 상승, 강한 화물 수요에 힘입어 2분기 이익이 크게 늘었다고 밝혔습니다. 중동발 공급망 차질도 운임 상승에 영향을 준 것으로 분석됐습니다. |
| Japan Post targets container imports from South Korea | 일본우편, 한국발 컨테이너 전자상거래 물량 공략 | 일본우편이 해상 소액화물의 소비세 면제 혜택을 활용해 한국발 전자상거래 수요 확보에 나섰습니다. KSE글로벌로지스틱스와 제휴해 화장품 등 한국 상품을 카페리 컨테이너로 운송합니다. |

date-only curated article은 정오 UTC timestamp로 materialize한다.

번역 실패는 article failure가 아니다.

### 21.1 news state and cache

valid article이 1개 이상이면 LIVE, 0개면 UNAVAILABLE이다.

5개 이상일 때만 public max-age 900, shared max-age 3600, stale-while-revalidate 21600초를 사용한다.

1–4개는 표시할 수 있지만 no-store다.

0개와 provider total failure도 no-store다.

fake article을 만들지 않는다.

retry 1 result가 valid LIVE이면 첫 result와 article count를 비교하고 더 큰 쪽을 선택한다. 같으면 첫 result를 유지한다.

retry 실패면 첫 valid result를 유지한다.

refresh 실패 시 consumer retained data는 원래 fetchedAt과 asOf를 유지한다.

---

## 22. InsightRequestV1

POST body maximum은 256KB다.

root key는 정확히 route, current, selectedHorizon, direction, forecast, forecastPath, representativeModel, modelAgreement, news다.

route는 id, name, asOf를 가진다.

current는 date, value를 가진다.

selectedHorizon은 1, 2, 3, 4 중 하나다.

direction은 상승, 하락, 보합 중 하나다.

forecast field는 date, value, changePct, lower, upper, coveragePct다.

forecastPath는 horizon 1, 2, 3, 4 exact tuple이며 각 item은 horizon, date, value, lower, upper를 가진다.

representativeModel은 name, mapePct, mse, mase, totalScore를 가진다.

modelAgreement는 up, down, flat, total을 가진다.

total은 exact 8이고 up plus down plus flat과 같아야 한다.

news는 0–5개 InsightNewsV1다.

InsightNewsV1 field는 id, title, summary, source, publishedAt, url, directionCode, factor, grade, reason이다.

모든 number는 finite다.

current, forecast, path value는 positive다.

lower는 value 이하이고 value는 upper 이하다.

coveragePct는 0부터 100이다.

changePct가 3 이상이면 상승, -3 이하이면 하락, 그 사이는 보합이다. request direction이 계산 결과와 다르면 400이다.

server는 publishedAt이 current date 이후인 news를 다시 제거한다.

unknown key, malformed ISO, invalid URL, wrong tuple order는 400이다.

request body를 그대로 log하지 않는다.

---

## 23. Gemini-only insight

runtime LLM provider는 Gemini 하나뿐이다.

다른 LLM SDK, endpoint, API key, fallback provider를 추가하지 않는다.

OpenAI runtime과 API는 사용하지 않는다.

key 우선순위는 GEMINI_API_KEY, GOOGLE_API_KEY다.

model candidate 순서는 configured model 또는 gemini-2.5-flash, gemini-flash-latest, gemini-2.5-flash-lite이며 duplicate를 제거한다.

candidate loop 전체 timeout은 25초다.

404만 다음 Gemini candidate로 이동한다.

다른 failure, missing key, exhausted candidates, malformed output은 deterministic rule fallback으로 간다.

request는 official generateContent interface, server-only API-key header, JSON response MIME, exact output schema를 사용한다.

maximum output token은 2048, thinking budget은 1024다.

provider response는 unknown으로 시작하고 첫 candidate non-thought text를 결합해 JSON parse한 뒤 exact runtime decoder를 통과해야 한다.

schema가 맞지 않으면 Gemini success로 표시하지 않는다.

Gemini success state는 LLM, engine은 GEMINI, model은 actual candidate다.

fallback state는 DERIVED, engine은 RULE_FALLBACK, model은 null이다.

모든 insight response는 no-store다.

### 23.1 system instruction

다음 의미 rule 아홉 개를 모두 포함한다.

1. 부산발 컨테이너 운임을 설명하는 물류 분석가다.
2. 입력에 포함된 정량 예측과 검증 뉴스만 사용한다.
3. direction은 계산 엔진 결론이므로 바꾸지 않는다.
4. 입력에 없는 숫자, 사건, 출처, 인과관계를 만들지 않는다.
5. 정량 예측을 주 근거로 두고 뉴스는 압력의 설명 근거로만 사용한다.
6. 뉴스와 예측 방향이 다르면 반대 신호로 명시한다.
7. 인과를 단정하지 않고 압력, 요인, 가능성으로 표현한다.
8. factor evidenceId는 입력 news id만 사용한다.
9. 구간과 모델 disagreement를 confidence와 caution에 반영하고 USD/FEU 기준, 비권고 문구를 유지한다.

headline은 한 문장, summary는 2–3문장이다.

output root required field는 headline, summary, confidence, quantitativeBasis, upwardFactors, downwardFactors, caution이다.

additional property는 금지한다.

confidence는 높음, 보통, 낮음 중 하나다.

quantitativeBasis는 2–4개 string이다.

upwardFactors와 downwardFactors는 각각 최대 2개이며 item field는 factor, evidenceId exact 두 개다.

unknown evidenceId는 provider output rejection 사유다.

---

## 24. deterministic insight fallback

계산식은 다음과 같다.

~~~text
intervalWidthPct = 100 × (upper - lower) ÷ max(value, 1)
selectedAgreementCount = direction에 해당하는 up, down, flat count
selectedAgreement = selectedAgreementCount ÷ max(total, 1)
dominantDirection = count descending stable sort
~~~

dominant tie priority는 상승, 보합, 하락이다.

confidence rule은 다음과 같다.

- 높음: intervalWidthPct 20 이하 and selectedAgreement 0.7 이상 and coveragePct 85 이상
- 보통: 높음이 아니고 intervalWidthPct 35 이하 and selectedAgreement 0.5 이상
- 낮음: 그 외

금액은 nearest integer en-US dollar, change와 interval width는 소수 1자리, MAPE는 소수 1자리, MASE는 소수 2자리다.

signed move는 positive면 절대값 percent 상승, negative면 절대값 percent 하락, zero면 변동 없음이다.

headline exact template은 다음 의미다.

- agreement: route 항로는 selected horizon주 후 direction권으로 전망됩니다.
- conflict: route 항로의 선택 모델은 direction이지만 모델 투표는 dominant 우세입니다.

summary는 current date/value, forecast value, signed move, threshold direction, exact model vote, news가 인과 확정이 아니라는 문장을 포함한다.

exact fallback text template은 다음과 같다.

~~~text
agreement headline:
<route name> 항로는 <selected horizon>주 후 <direction>권으로 전망됩니다.

conflict headline:
<route name> 항로의 선택 모델은 <direction>이지만 모델 투표는 <dominant direction> 우세입니다.

agreement vote:
<total>개 모델 중 <selected count>개가 같은 방향입니다.

conflict vote:
모델 투표는 상승 <up>·보합 <flat>·하락 <down>으로 <dominant direction> 의견이 가장 많아 선택 모델 전망과 엇갈립니다.

summary:
<current date> 기준 <current USD>인 운임은 <forecast USD>로 <signed move>할 전망입니다. 설정된 분류 기준에서는 <direction>이며, <vote text> 검증 뉴스는 예측의 원인 확정이 아니라 상·하방 위험 신호로 함께 해석했습니다.

low caution:
예측구간이 넓거나 모델 의견이 엇갈려 점예측보다 상·하한 범위를 우선 확인해야 합니다.

other caution:
뉴스는 방향을 설명하는 보조 신호이며 예측값의 직접적인 인과 근거는 아닙니다.
~~~

quantitativeBasis는 exact 세 줄이다.

1. PI90 lower–upper and interval width
2. model name, MAPE, MASE
3. 모델 의견 상승, 보합, 하락 count

낮음 caution은 점예측보다 상하한 범위를 우선 확인하라는 문구다.

그 외 caution은 뉴스가 직접 인과 근거가 아니라는 문구다.

upwardFactors는 input order의 UP 첫 2개, downwardFactors는 DOWN 첫 2개다.

MIXED와 NEUTRAL은 fallback factor 배열에 넣지 않는다.

factor는 article.factor가 비어 있지 않으면 그것을, 아니면 title을 쓴다.

evidence는 같은 ID article의 summary, source, publishedAt, url에서만 구성한다.

generatedAt은 injected clock을 사용한다.

---

## 25. insight output

InsightDataV1 field는 정확히 다음과 같다.

- engine
- model
- generatedAt
- headline
- summary
- confidence
- quantitativeBasis
- upwardFactors
- downwardFactors
- caution

engine은 GEMINI 또는 RULE_FALLBACK이다.

model은 Gemini일 때 actual model string, rule fallback이면 null이다.

factor는 input evidence 밖의 사건을 만들지 않는다.

provider prompt, hidden reasoning, raw error는 반환하지 않는다.

---

## 26. port traffic contract

PortTrafficDataV1 root field는 다음과 같다.

- fetchedAt
- commonObservationDate
- source
- attribution
- methodologyNote
- caveats
- units
- markerCount
- uniqueSeriesCount
- availableMarkerCount
- availableSeriesCount
- summaries
- optional detail

summaries는 PortSummaryV1 array가 아니라 port ID keyed readonly record다.

record key는 summary.portId와 같아야 한다.

markerCount는 57, uniqueSeriesCount는 56이다.

units cargo는 metric_tons_estimated, vesselCalls는 calls다.

summary query에서는 detail key를 생략한다.

### 26.1 exact query

summary query는 empty query만 허용한다.

detail query key는 id와 optional days만 허용한다.

legacy port key, summary의 days, duplicate key, extra key는 400 INVALID_REQUEST다.

id는 canonical port ID다.

days가 missing 또는 non-finite이면 180이다.

finite days는 JavaScript Math.round 의미로 반올림한 뒤 30–730으로 clamp한다.

1은 30, 180.4는 180, 180.5는 181, 900은 730이다.

unknown id는 400이다.

### 26.2 PortSummaryV1

field는 정확히 다음과 같다.

- portId
- routeCode
- portWatchId
- sharedSeries
- sharedWithPortIds
- observedAt
- observedDays7d
- previousObservedDays7d
- estimatedImportTons7d
- estimatedExportTons7d
- estimatedTotalTons7d
- previousEstimatedImportTons7d
- previousEstimatedExportTons7d
- previousEstimatedTotalTons7d
- estimatedTotalTonsChangePercent
- containerVesselCalls7d
- previousContainerVesselCalls7d
- vesselCallsChangePercent

위 field를 ports, inbound, outbound 같은 축약 DTO로 바꾸지 않는다.

shared upstream series는 각 marker에 표시하되 fetch와 total aggregation은 한 번만 한다.

missing daily value와 non-finite는 null이다.

actual observed zero는 0이다.

rolling aggregate에 필요한 row가 missing이면 aggregate는 null이고 observedDays count가 coverage를 설명한다.

### 26.3 PortDetailV1

detail field는 portId, routeCode, portWatchId, sharedSeries, sharedWithPortIds, points다.

point는 다음 field를 가진다.

- date
- estimatedImportTons
- estimatedExportTons
- estimatedTotalTons
- containerVesselCalls
- estimatedImportTons7d
- estimatedExportTons7d
- estimatedTotalTons7d
- containerVesselCalls7d

points는 date 오름차순이다.

초기 rolling window가 성립하지 않으면 rolling field는 null이다.

### 26.4 PortWatch provider

official ArcGIS feature interface와 승인 provider catalog를 사용한다.

request field는 allowlist만 사용한다.

unique upstream ID chunk size는 8, concurrency는 3, page size는 1000이다.

한 series maximum page는 50이다.

exceededTransferLimit가 true이면 stable order로 다음 page를 가져온다.

object ID 또는 documented stable identity로 duplicate page row를 막는다.

page attempt timeout은 12초다.

최초 호출 포함 maximum 3 attempts, 즉 retry 2회다.

backoff는 첫 실패 후 350ms, 둘째 실패 후 700ms다.

response JSON은 unknown에서 feature array, attributes object, required scalar를 검증한다.

partial series failure를 zero로 바꾸지 않는다.

### 26.5 state and cache

모든 required series가 fresh하면 LIVE다.

일부 valid series만 있으면 PARTIAL이다.

live failure 후 verified stale cache 또는 approved fixture를 쓰면 STALE이다.

valid series가 없으면 UNAVAILABLE이다.

fixture는 STALE, mode fixture, cache stale true다.

LIVE summary header는 public 300, shared 21600, stale-while-revalidate 86400초다.

PARTIAL, STALE, detail header는 public 60, shared 600, stale-while-revalidate 3600초다.

UNAVAILABLE과 invalid request는 no-store다.

approved fixture asOf는 데이터 팩 07의 실제 latest observation을 사용하며 생성 시각으로 덮어쓰지 않는다.

---

## 27. chokepoint traffic contract

ChokepointTrafficDataV1 root field는 fetchedAt, latestObservationDate, source, attribution, methodologyNote, summaries, optional detail이다.

summaries는 chokepoint ID keyed readonly record다.

record key는 inner chokepointId와 같아야 한다.

app set은 11개이고 full approved catalog count 28은 provenance에 보존한다.

summary query는 empty only다.

detail query는 exact id key 하나만 허용한다.

days, duplicate, extra key는 400이다.

unknown id는 400이다.

### 27.1 summary and detail

summary field는 다음과 같다.

- chokepointId
- portwatchId
- observedAt
- containerVessels7d
- estimatedTransitTons7d
- previousContainerVessels7d
- previousEstimatedTransitTons7d
- vesselChangePercent
- transitTonsChangePercent

detail은 chokepointId, portwatchId, points를 가진다.

point field는 date, containerVessels7d, estimatedTransitTons7d다.

summary response에서는 detail key를 생략한다.

tonnage는 estimated metric tons이며 TEU가 아니다.

missing 또는 non-finite vessel and tonnage는 null이다.

actual observed zero는 0이다.

previous가 null 또는 0 이하이면 change percent는 null이다.

### 27.2 provider, state, cache

official PortWatch daily chokepoint interface를 사용한다.

attempt timeout은 12초이고 automatic retry는 0회다.

full fresh success는 LIVE다.

verified stale cache 또는 fixture는 STALE, mode cached 또는 fixture, cache.stale true다.

valid data가 없으면 UNAVAILABLE이다.

LIVE header는 public 900, shared 10800, stale-while-revalidate 86400초다.

STALE header는 public 60, shared 600, stale-while-revalidate 3600초다.

UNAVAILABLE과 invalid request는 no-store다.

---

## 28. weather contract

WeatherDataV1 root field는 fetchedAt, source, attribution, locationCount, visibilityObservationCount, observations, warnings다.

query는 empty only이며 어떤 key도 400 INVALID_REQUEST다.

catalog location count는 82다.

observations는 stable observation key keyed readonly record다.

record key는 inner key와 같아야 한다.

catalog identity와 live observation을 분리한다.

관측 실패 때문에 catalog marker를 삭제하지 않는다.

fixture 관측이 승인되지 않은 경우 state는 UNAVAILABLE, data는 null이다.

빈 record를 LIVE로 반환하지 않는다.

### 28.1 WeatherObservationV1

identity field는 다음과 같다.

- key
- kind
- entityId
- nameKo
- subtitleKo
- routeCode 또는 null
- longitude
- latitude

kind는 port, chokepoint, route 중 하나다.

atmosphere field는 다음과 같다.

- observedAt 또는 null
- condition
- conditionLabel
- risk
- riskLabel
- riskReasons
- temperatureC 또는 null
- precipitationMm 또는 null
- visibilityM 또는 null
- visibilityIsMinimum
- visibilityObservedAt 또는 null
- visibilityStationId 또는 null
- visibilityStationDistanceKm 또는 null
- windSpeedKn 또는 null
- windDirectionDeg 또는 null
- windGustKn 또는 null
- isDay 또는 null

marine field는 다음과 같다.

- waveHeightM 또는 null
- waveDirectionDeg 또는 null
- wavePeriodS 또는 null
- seaSurfaceTemperatureC 또는 null
- oceanCurrentKmh 또는 null
- oceanCurrentDirectionDeg 또는 null

marine provider가 없는 location에서도 field를 생략하지 않고 null로 둔다.

### 28.2 provider orchestration

atmosphere provider는 MET Norway Locationforecast다.

82 coordinate를 concurrency 8로 호출한다.

timeout은 20초다.

429에서만 maximum 1 retry다.

official policy를 충족하는 식별 가능한 server-only User-Agent를 사용한다.

marine provider는 Open-Meteo Marine이다.

coordinate chunk size는 24이고 timeout은 20초다.

marine missing을 zero로 바꾸지 않는다.

visibility provider는 AviationWeather METAR이다.

METAR payload는 gzip 또는 plain body를 지원한다.

timeout은 25초, retryable failure maximum 1 retry다.

station maximum distance는 75km다.

observation maximum age는 3시간이고 future tolerance는 15분이다.

visibility가 minimum report면 visibilityIsMinimum은 true다.

station ID와 distance를 함께 보존한다.

멀리 떨어진 station 값을 현장 관측처럼 표시하지 않는다.

### 28.3 condition and risk

condition enum은 clear, night, cloud, fog, rain, snow, storm, wind, wave, unavailable이다.

risk enum은 normal, warning, severe다.

risk threshold는 다음과 같다.

| signal | warning | severe |
|---|---:|---:|
| wind gust | 28kn 이상 | 40kn 이상 |
| wave height | 3m 이상 | 5m 이상 |
| visibility | 5000m 미만 | 1000m 미만 |
| precipitation | 7.5mm 이상 | storm rule |

storm condition은 severe다.

condition wave threshold는 3.5m 이상, wind threshold는 gust 25kn 이상이다.

condition precedence는 storm, snow or rain, fog, wave, wind, cloud or clear or night 순서다.

모든 matching 위험 원인을 riskReasons에 보존한다.

missing gust, visibility, marine을 zero threshold로 평가하지 않는다.

### 28.4 state and cache

필수 provider와 충분한 location이 성공하면 LIVE다.

일부 provider 또는 location만 성공하면 PARTIAL이다.

모든 observation이 실패하면 UNAVAILABLE이다.

LIVE와 PARTIAL header는 public 300, shared 1800, stale-while-revalidate 7200초다.

UNAVAILABLE과 invalid request는 no-store다.

PARTIAL warning은 실패 provider와 affected count를 safe code로 기록한다.

v1에서는 live와 fixture observation을 한 response에 섞지 않는다.

---

## 29. tuning architecture and health

static snapshot의 8-model 결과와 live tuning capability는 별개다.

snapshot에는 8 model 결과가 모두 필요하지만 live tuning은 current deployment probe가 성공한 model만 available이다.

browser가 engine을 직접 호출하지 않는다.

server gateway는 protected local development engine 또는 approved production HTTPS engine에 연결한다.

production에서 localhost, loopback, link-local, private address는 거부한다. 승인 private network 예외는 explicit allowlist가 있어야 한다.

### 29.1 capability table

| model | runtime requirement |
|---|---|
| naive | deterministic numeric runtime |
| sarimax | pinned statsmodels |
| lightgbm | pinned lightgbm and native library |
| xgboost | pinned xgboost and native library |
| random_forest | pinned scikit-learn and seed |
| prophet | pinned prophet and backend |
| timesfm | package, torch, official local weights, resource probe |
| chronos | package, torch, official local weights, resource probe |

package import만으로 available을 선언하지 않는다.

TimesFM과 Chronos는 official weight existence, readability, expected digest, memory readiness, inference probe를 모두 통과해야 한다.

운영 중 weight를 자동 download하지 않는다.

다른 model ID로 naive를 실행하지 않는다.

### 29.2 GET health query and result

GET query는 empty only다.

TuningHealthDataV1 field는 serviceVersion, capabilities다.

capabilities는 frozen model order의 exact 8-item tuple이다.

각 capability field는 다음과 같다.

- id
- available
- execution
- version
- reasonCode
- checkedAt
- probeId
- probeStatus

execution은 native 또는 external이다.

available이면 version, probeId가 non-null이고 probeStatus는 PASS, reasonCode는 null이다.

unavailable이면 reasonCode는 non-empty string이고 probeStatus는 PASS가 아니다.

reasonCode는 forward-additive string이다.

대표 reason은 PACKAGE_MISSING, WEIGHTS_MISSING, WEIGHTS_HASH_MISMATCH, MEMORY_LIMIT, ENGINE_OFFLINE, MODEL_DISABLED, PROBE_STALE, DEPLOYMENT_MISMATCH다.

probe artifact는 deployment ID, engine version, checkedAt, model ID, dependency and weight version, latency, safe result code, artifact digest를 가진다.

current deployment ID와 engine version이 다르거나 freshness window를 넘은 probe는 available 근거가 아니다.

8개 모두 available이면 health state LIVE, 일부면 PARTIAL, 0개면 UNAVAILABLE이다.

legacy health body처럼 ok true 하나만 있는 응답은 capability 증거가 아니다.

health response는 no-store다.

capability 0개인 health response status는 503이고 state는 UNAVAILABLE이다.

---

## 30. TuneRequestV1

POST body maximum은 2MB다.

root key는 정확히 routeCode, modelId, dates, values, trainingWindow, evaluationOrigins, parameters다.

routeCode는 13 canonical ID 중 하나다.

modelId는 8 model ID 중 하나다.

dates와 values 길이는 같아야 하며 108 이상 10000 이하다.

dates는 ISO weekly date, strictly ascending, unique다.

values는 finite positive number다.

trainingWindow는 expanding, rolling_104, rolling_52 중 하나다.

evaluationOrigins는 integer 36–52다.

parameters value는 string 또는 number만 허용한다.

model별 parameter key, type, range, default는 승인 데이터 팩 15의 allowlist를 그대로 사용한다.

unknown parameter, boolean, null, array, object, non-finite number는 400이다.

selected model capability가 current health에서 unavailable이면 engine을 호출하지 않고 503이다.

동일 route, model, normalized input digest는 single-flight한다.

---

## 31. TuneSuccessV1

tuning output은 SnapshotForecastV1을 재사용하지 않는다.

TuneSuccessV1 field는 정확히 다음과 같다.

- status
- routeCode
- modelId
- modelVersion
- forecastOrigin
- maseProtocol
- trainingWindow
- evaluationOrigins
- parameters
- forecasts
- metricsByHorizon
- evaluationByHorizon
- elapsedMs
- methodologyKo

status는 literal success다.

maseProtocol은 seasonal-naive-52-fixed다.

parameters는 실제 적용된 normalized string or number record다.

forecasts는 TuneForecastV1 exact 4-item tuple다.

TuneForecastV1 field는 horizon, date, value, lower90, upper90다.

calibrationSampleSize field를 추가하지 않는다.

metricsByHorizon은 exact horizon 1, 2, 3, 4 tuple다.

evaluationByHorizon도 exact horizon 1, 2, 3, 4 tuple이며 각 group은 evaluationOrigins와 일치하는 record count를 가진다.

bare metrics field를 반환하지 않는다.

modelVersion은 실제 package, model, weight version을 추적할 수 있어야 한다.

methodologyKo는 실제 model과 window를 설명한다.

engine response는 unknown으로 시작하고 exact tuples, request route/model identity, finite values, interval order를 검증한다.

success state는 READY이고 response는 no-store다.

성공을 canonical snapshot에 자동 publish하지 않는다.

### 31.1 failure mapping

| condition | status | code |
|---|---:|---|
| invalid input | 400 | INVALID_REQUEST |
| body too large | 413 | REQUEST_TOO_LARGE |
| rate limited | 429 | RATE_LIMITED |
| valid but unscorable | 422 | ENGINE_UNSCORABLE |
| engine or model unavailable | 503 | ENGINE_UNAVAILABLE |
| execution failure | 502 | ENGINE_FAILURE |
| total timeout | 504 | UPSTREAM_TIMEOUT |

total tuning timeout은 10분이다.

AbortSignal을 engine request에 전파한다.

failure에서 synthetic forecast를 반환하거나 canonical snapshot을 수정하지 않는다.

---

## 32. provider and environment policy

공식 provider documentation set은 다음 topic을 포함한다.

| provider | required official documentation |
|---|---|
| ECB | reference rates, currency quote semantics, date |
| FRED | observation API and units |
| USDA catalog | dataset field semantics for Brent and bunker |
| Yahoo market data | chart response structure and quote direction |
| PortWatch | ArcGIS pagination, field schema, port and chokepoint methodology |
| MET Norway | Locationforecast schema and User-Agent policy |
| Open-Meteo | Marine variables, units, batching |
| AviationWeather | METAR response, timestamp, visibility |
| WordPress providers | posts query and rendered field semantics |
| Google and Bing News | RSS item semantics |
| GDELT | DOC query, date range, result fields |
| Gemini | generateContent request, JSON schema response, API-key header |

provider behavior가 데이터 팩 00 또는 17과 공식 docs 사이에서 충돌하면 자동 추측하지 않는다. provider capability를 unavailable로 닫고 승인 갱신을 요구한다.

server-only environment name은 다음과 같다.

- MOVE_AI_DATA_MODE
- approved domain mode overrides
- GEMINI_API_KEY
- GOOGLE_API_KEY
- GEMINI_INSIGHT_MODEL
- KCCI_ENGINE_URL
- KCCI_ENGINE_TOKEN
- KCCI_MAX_REQUEST_BYTES
- MET_NO_USER_AGENT

engine environment는 host, port, comparison origins, conformal origins, minimum train weeks, ridge validation weeks, bootstrap repetitions, random seed, maximum request bytes를 명시한다.

secret은 public client prefix를 사용하지 않는다.

선택 provider key가 없으면 해당 capability를 unavailable로 표현한다.

Gemini key가 없으면 insight 전체가 unavailable이 아니라 deterministic fallback이다.

### 32.1 security

browser에서 provider를 직접 호출하지 않는다.

provider key와 engine token은 client bundle, HTML, source map, error, log에 없어야 한다.

outbound host는 provider registry allowlist에서만 만든다.

사용자 입력 URL을 fetch하지 않는다.

redirect final host도 allowlist를 검사한다.

HTTPS certificate validation을 끄지 않는다.

body hard limit은 JSON parse 전에 검사한다.

engine URL은 request query나 body에서 받지 않는다.

upstream error body를 public response에 넣지 않는다.

same-origin CORS가 기본이다.

news URL은 safe scheme을 검사한다.

### 32.2 observability

metric dimension은 domain, state, mode, provider, cache hit, safe error code다.

route ID와 model ID는 frozen low-cardinality label로만 쓴다.

news full title, URL, raw body는 metric label이 아니다.

latency는 total, provider, normalization, cache로 나눈다.

retry, timeout, partial coverage, stale age, tuning queue와 failure를 기록한다.

active generated artifact digest와 data-pack manifest digest는 deployment metadata에 기록하되 public UI copy로 노출하지 않는다.

---

## 33. deterministic fixture catalog

모든 fixture는 승인 데이터 팩에서 생성하거나 명시적 synthetic failure constructor로 만든다.

success data fixture는 이전 runtime artifact를 복사하지 않는다.

failure constructor는 secret이나 실제 private body를 포함하지 않는다.

각 fixture manifest item은 fixture ID, domain, normalized request, state, mode, asOf, fetchedAt, artifact digest, expected status, expected Cache-Control, expected consumer state를 가진다.

fixture clock과 request ID는 fixed input이다.

### 33.1 common boundary fixtures

- malformed JSON
- wrong schemaVersion
- missing or extra root key
- missing or extra meta, cache, error key
- wrong domain state
- data from a different domain
- unavailable with non-null data
- success with null data
- malformed nested DTO
- non-finite number
- actual zero and missing null in same payload
- future asOf
- timeout before headers
- timeout during body
- network reset
- 408, 425, 429 with bounded Retry-After, 500, 503
- abort during backoff
- corrupt cache digest
- stale cache inside window
- expired cache beyond window

### 33.2 domain fixtures

market:

- four series reference
- each primary success and fallback order
- invalid unit
- mismatched date join
- HARPEX REFERENCE and exact Index unit

news:

- five-provider partial success
- 30-day four results and 90-day five results
- zero, one through four, five results
- exact URL duplicate
- exact title duplicate
- fuzzy duplicate within four days
- future and boundary article
- translation failure
- invalid URL
- all provider failure

insight:

- Gemini success
- first candidate 404 then second success
- missing key
- timeout
- malformed JSON
- valid JSON with wrong schema
- unknown evidence ID
- deterministic fallback
- confidence exact boundaries

port:

- full, partial, stale, unavailable
- 57 markers and 56 unique series
- shared upstream series
- previous zero
- missing daily field
- actual observed zero
- detail day default, rounding, clamping

chokepoint:

- live, stale, unavailable
- 11 app entries and 28 full catalog provenance
- previous zero
- missing and non-finite field

weather:

- atmosphere only
- marine only
- METAR only
- partial
- all fail
- station over 75km
- stale METAR
- future METAR
- null gust and visibility
- all risk boundaries

tuning:

- eight available probes
- partial probes
- no deployed probe
- stale probe
- deployment mismatch
- weight missing
- weight digest mismatch
- engine offline
- valid run
- malformed tuple
- request identity mismatch
- unscorable
- timeout

---

## 34. golden data anchors

Golden values are regenerated from approved data pack and checked semantically; existing artifact bytes are not reused.

### 34.1 forecast golden

- route count 13
- dates 187
- model count per route 8
- horizon order 1, 2, 3, 4
- forecasts 416
- metrics 416
- evaluation rows 21,632
- evaluation records 52 per model-horizon
- KNEI selected SARIMAX sample from approved data pack is checked field by field

### 34.2 catalog golden

- routes 13
- port markers 57
- unique upstream port series 56
- chokepoints 11
- full chokepoint provenance count 28
- weather locations 82
- all identity and coordinate fields match approved data pack 01 and 09
- catalog sidecar digest equals newly generated catalog bytes
- sidecar reference manifest digest equals the actual approved manifest used in the same run

### 34.3 freshness golden

승인 데이터 팩에서 현재 관측 anchor를 읽고 다음 expected date를 검증한다.

| domain | asOf |
|---|---|
| KCCI | 2026-08-03 |
| ECB | 2026-08-11 |
| Brent | 2026-08-03 |
| VLSFO | 2026-08-05 |
| HARPEX | 2026-08-07 |
| port | 2026-08-07 |
| chokepoint | 2026-08-09 |

각 date를 build date로 덮어쓰지 않는다.

### 34.4 KNEI rule fallback golden

input은 승인 forecast and news data에서 결정론적으로 materialize한다.

- route KNEI, 유럽
- current date 2026-08-03
- current value 4884
- selected horizon 1
- SARIMAX point 4828.98
- interval 4482.47 to 5175.49
- MAPE 3.6
- MASE 0.037
- coverage 88.5
- direction 보합
- agreement up 1, flat 3, down 4, total 8

expected headline은 유럽 항로의 선택 모델은 보합이지만 모델 투표는 하락 우세입니다.

expected confidence는 낮음이다.

expected summary는 다음과 같다.

2026-08-03 기준 $4,884인 운임은 $4,829로 1.1% 하락할 전망입니다. 설정된 분류 기준에서는 보합이며, 모델 투표는 상승 1·보합 3·하락 4으로 하락 의견이 가장 많아 선택 모델 전망과 엇갈립니다. 검증 뉴스는 예측의 원인 확정이 아니라 상·하방 위험 신호로 함께 해석했습니다.

expected quantitative basis는 rounded interval 4482–5175, width 14.4 percent, SARIMAX MAPE 3.6 percent, MASE 0.04, vote 1, 3, 4를 포함한다.

eligible UP evidence는 승인 데이터 팩 10에서 current date 이전 KNEI evidence를 input order로 사용한다.

fixture ID는 새 fixture generator가 발급하고 문서에서 임의 article ID를 만들지 않는다.

### 34.5 confidence boundary golden

- 20, 0.7, 85를 모두 exact 포함하면 높음
- 높음 조건 하나를 벗어나도 35와 0.5를 포함하면 보통
- 그 외 낮음

floating comparison은 inclusive boundary를 테스트한다.

---

## 35. query and decoder acceptance

각 public endpoint는 다음 negative case를 실행한다.

market:

- missing required key
- duplicate key
- extra key
- wrong providerVersion
- invalid series
- invalid or reversed date

news typed client:

- required canonical fields emitted
- retry 0 and 1 exact
- optional refresh only

news compatibility route:

- missing or unknown route becomes KNEI
- invalid asOf becomes latest
- unknown key ignored
- wrong providerVersion normalized to 18

port:

- empty summary accepted
- id detail accepted
- id and valid days accepted
- legacy port rejected
- summary days rejected
- extra and duplicate rejected

chokepoint:

- empty summary accepted
- id detail accepted
- days rejected
- extra and duplicate rejected

weather and tuning health:

- empty accepted
- any query key rejected

insight and tuning run:

- exact key set accepted
- extra, missing, malformed, oversized rejected

client decoder:

- arbitrary string state rejected
- correct envelope with wrong domain payload rejected
- malformed nested array or record rejected
- unavailable invariant rejected when contradictory
- keyed summary identity mismatch rejected
- tuple wrong order or length rejected

---

## 36. integration acceptance

### 36.1 market

- four series units are exact
- primary and every fallback order are executable
- FX same-date join and quote direction are correct
- providers are not spliced
- HARPEX is REFERENCE and Index
- invalid request is 400 and no-store
- provider unavailable data is null and no-store

### 36.2 news and insight

- five providers run in parallel groups
- provider merge order is deterministic
- 30-day and actual 90-day requests are observable in safe attempt metadata
- future article is rejected
- URL, title, fuzzy dedupe counters are exact
- curated ordering precedes dynamic
- Korean six-entry localization map is byte-exact to approved data pack 10
- 1–4 articles are no-store
- no article produces no fake data
- Gemini success validates exact schema
- Gemini 404 candidate flow works
- Gemini missing, failure, malformed output becomes DERIVED
- no second LLM request occurs
- server rejects future insight evidence
- insight is always no-store

### 36.3 port and chokepoint

- pagination, transfer limit, page cap work
- port chunk 8, concurrency 3, timeout 12, retry 2, backoff 350 and 700 are exact
- shared upstream series fetched and aggregated once
- 57 and 56 counts are exact
- summaries are keyed records
- missing stays null and observed zero stays zero
- previous zero percentage stays null
- detail days default, round, clamp are exact
- port full, partial, stale, unavailable state is truthful
- chokepoint 11 and full provenance 28 are exact
- chokepoint timeout 12 and retry 0 are exact
- traffic unavailable is data null and no-store

### 36.4 weather

- catalog 82 matches network seam
- MET concurrency 8, timeout 20, 429 retry 1
- marine chunk 24 and timeout 20
- METAR timeout 25, retry 1, maximum 75km, maximum age 3h, future tolerance 15m
- null gust, visibility, marine stay null
- condition precedence and risk threshold boundaries are exact
- full, partial, unavailable state is truthful
- unavailable is no-store

### 36.5 tuning

- health exact 8 capability tuple
- no current deployed probe means no available model
- stale or mismatched probe is rejected
- legacy ok-only health is rejected
- selected model capability is rechecked before run
- request range, weekly date, value, parameter allowlist validation is exact
- success uses TuneForecastV1 exact tuple with no calibrationSampleSize
- metrics and evaluation exact tuples
- output request identity matches input
- status and error mapping are exact
- total timeout 10 minutes and abort work under virtual clock
- failure does not mutate forecast snapshot

---

## 37. consumer seam contract

| consumer | snapshot | market | news | insight | tuning | port | chokepoint | weather |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dashboard | required | required | required | required | none | none | none | none |
| model lab | required | none | none | none | required | none | none | none |
| globe | route registry | none | none | none | none | required | required | required |
| allocation | required | none | none | none | none | none | none | none |

모든 consumer는 같은 method-specific decoder를 사용한다.

consumer가 독자적인 envelope, fallback shape, unit conversion, route registry를 만들지 않는다.

dashboard는 market unit을 KCCI value와 합산하지 않는다.

dashboard는 LLM과 DERIVED를 구분하고 refresh failure에서 previous validated news를 retained stale로 표시한다.

model lab은 static 8-model display와 live capability를 구분한다.

globe는 catalog marker와 observation 상태를 분리하고 port, chokepoint, weather를 독립 상태로 렌더한다.

allocation은 동일 representative model의 exact four forecast tuple을 사용한다.

### 37.1 client state machine

client resource state는 idle, loading, ready, refreshing, error다.

domain state는 별도 field로 유지한다.

첫 load failure에는 retained data가 없다.

refresh failure에는 같은 normalized key의 previous validated data만 retained할 수 있다.

retained data는 original asOf, fetchedAt, stale 표시를 유지한다.

query key가 바뀌면 다른 key data를 retained하지 않는다.

이전 request는 AbortController로 취소한다.

late response가 current key를 덮지 않게 request identity를 검사한다.

HTTP status가 success여도 body decoder를 건너뛰지 않는다.

CONTRACT_MISMATCH를 generic network failure로 숨기지 않는다.

### 37.2 visible state wording

| state | accessible Korean label |
|---|---|
| LIVE | 실시간 데이터 |
| REFERENCE | 기준 데이터 |
| PARTIAL | 일부 데이터 |
| STALE | 이전 관측 데이터 |
| UNAVAILABLE | 데이터 연결 불가 |
| LLM | AI 생성 인사이트 |
| DERIVED | 규칙 기반 인사이트 |
| READY | 실행 가능 |

mode fixture는 별도 FIXTURE provenance chip을 표시한다.

mode cached는 CACHED chip과 age를 표시한다.

UNAVAILABLE default copy는 데이터를 불러올 수 없습니다.다.

retryable action copy는 다시 시도다.

source attribution과 asOf는 접근 가능한 footer에 남긴다.

port, chokepoint, weather failure를 하나의 globe-wide failure로 합치지 않는다.

### 37.3 visual handoff

badge minimum height는 22px, horizontal padding 8px, font size 9px, pill radius다.

interactive tooltip target은 minimum 44 by 44px다.

LIVE와 READY는 green, REFERENCE와 DERIVED는 blue, PARTIAL과 STALE은 amber, UNAVAILABLE은 red, LLM은 purple semantic token이다.

색상만으로 상태를 전달하지 않는다.

공통 canvas는 #f1f2f9, ink #141415, muted #63666a, brand navy #001290, brand blue #15269d, card radius 18px다.

이 절은 consumer 표시 계약이며 WT6가 새로운 screen을 추가하라는 뜻이 아니다.

---

## 38. responsive acceptance handoff

고정 viewport는 1440×900, 900×900, 640×900, 375×812다.

WT6는 각 viewport에서 사용할 deterministic state fixture와 expected state, meta, copy를 제공한다.

consumer visual acceptance는 다음을 검증한다.

- desktop badge, attribution, asOf, retry action
- 900 width wrapped header와 partial state
- 640 breakpoint warning wrapping
- mobile badge stack and 44px retry target
- source and asOf not clipped
- no horizontal overflow
- ko-KR locale
- Asia/Seoul timezone
- fixed clock and request identity

필수 fixture composition은 다음과 같다.

- dashboard: market REFERENCE, news UNAVAILABLE, insight DERIVED
- model lab: tuning PARTIAL and disabled reason
- globe: port STALE, chokepoint UNAVAILABLE, weather PARTIAL
- allocation: snapshot normal and unavailable handoff

live provider screenshot을 deterministic baseline으로 쓰지 않는다.

---

## 39. cold-load acceptance

clean browser storage와 empty HTTP cache에서 canonical consumer route를 직접 연다.

각 consumer를 hard refresh, client navigation, back and forward navigation으로 검증한다.

snapshot, market, news, insight, tuning health, port, chokepoint, weather가 method-specific decoder를 통과해야 한다.

request cancellation과 late stale overwrite가 없어야 한다.

Cache-Control, status, content type을 기록한다.

console error, hydration warning, unhandled rejection은 0건이다.

client assets와 network request에서 secret substring이 없어야 한다.

unavailable fixture에서도 page 전체가 blank가 되면 실패다.

---

## 40. forbidden implementations

- 과거 저장소나 기존 runtime artifact를 fixture input으로 사용
- 과거 애플리케이션 source를 추출하거나 parse하는 generator
- 브라우저 파생 덤프, DOM 조사 dump, screenshot OCR을 data authority로 사용
- 이전 snapshot, catalog, manifest, identity sidecar를 복사
- hard-coded 이전 artifact digest를 승인 근거로 사용
- fixture와 live에서 다른 response shape
- generic envelope만 검사하고 caller generic type으로 assertion
- upstream JSON structural validation 생략
- domain state와 mode 혼용
- fixture를 LIVE로 표시
- unavailable with non-null data
- missing or non-finite를 zero로 변환
- observed zero를 null로 변환
- future observation 포함
- fetchedAt을 asOf로 표시
- provider failure에서 random value 생성
- fake news or fake weather 생성
- estimated tonnage를 TEU로 표시
- shared series duplicate aggregation
- port and chokepoint summary를 array로 노출
- weather identity, risk, marine field 삭제
- unit이 다른 market series 합산
- unknown market series를 fx로 fallback
- insight rule fallback을 LLM으로 표시
- Gemini 외 LLM runtime 사용
- malformed Gemini output을 success cast
- tuning unavailable model을 available로 표시
- TimesFM or Chronos name으로 naive 실행
- legacy ok-only health를 capability 증거로 사용
- production localhost engine 접근 가능 가정
- user-supplied outbound URL fetch
- API key client exposure
- raw upstream error exposure
- failure response long cache
- port, chokepoint, weather를 global failure 하나로 합치기

---

## 41. required test groups

### 41.1 artifact regeneration

- each required data-pack logical input is approved
- input digest recorded from actual bytes
- deterministic run produces the same SHA-256
- canonical UTF-8, LF, no BOM, one trailing newline
- no locale-dependent sort
- output digest and byte size match identity record
- manifest self-identity matches actual manifest bytes
- atomic publish preserves prior valid artifact on failure
- no previous artifact read is required

### 41.2 envelope and DTO

- exact root, meta, cache, error keys
- state guard per method
- data decoder per method
- null and error invariants
- no extra nested field
- exact tuple and record identity
- state and mode truthfulness
- ISO date and timestamp validation
- unit registry
- no non-finite JSON

### 41.3 cache and retry

- exact header per endpoint and state
- no-store invalid and unavailable
- single-flight
- corrupt cache rejection
- fresh and stale age boundaries
- 408, 425, 429, 5xx retry allowlist
- 400, 401, 403 non-retry
- bounded Retry-After
- abort during fetch, body, backoff
- timer cleanup

### 41.4 provenance and security

- generated artifacts trace only to 00–18 logical inputs
- provider attribution and usage note
- no credential in sourceUrl, attempt, error, log
- no public client secret
- outbound allowlist and redirect host validation
- production engine scheme and network restrictions

---

## 42. release gates

Gate A — clean-room authority

- only approved data pack 00–18, official provider docs, and frozen tables are used
- forbidden prior inputs audit has zero hits

Gate B — deterministic artifacts

- every fixture, snapshot, policy, catalog, sidecar is regenerated
- repeated generation produces the same SHA-256
- provenance chain and identities pass

Gate C — public seam

- all seven routes exist
- exact query and body parser pass
- typed DataGateway and method-specific decoders pass
- public and fixture envelope shape is identical

Gate D — truthfulness

- state, mode, unit, asOf, fetchedAt, generatedAt pass
- null and zero round-trip pass
- fixture is never LIVE
- unavailable data is null

Gate E — snapshot and network

- 13 by 187 by 8 by 4 snapshot passes
- 416 forecasts and metrics, 21,632 evaluation records pass
- 13, 57, 56, 11, 82 network counts pass
- catalog identity sidecar matches generated bytes

Gate F — providers

- market chains and units pass
- news five-provider fan-out and 30 to 90 behavior pass
- Gemini-only and deterministic fallback pass
- port, chokepoint, weather orchestration pass
- tuning current deployment capability truth passes

Gate G — runtime policy

- cache, retry, timeout, abort, no-store pass
- malformed upstream and domain payload rejection pass
- security and redaction pass

Gate H — consumer handoff

- shared fixtures compile and decode for dashboard, model lab, globe, allocation
- four viewport fixture handoff is complete
- cold-load and console gates pass

Gate I — quality

- contract, feature, integration, type, lint, build gates pass
- P0 equals 0
- P1 equals 0
- evidence matrix has no missing row

---

## 43. evidence matrix

| requirement | generated evidence | automated assertion |
|---|---|---|
| clean-room inputs | input authority report | only logical IDs 00–18 |
| deterministic generation | two-run byte report | all digest and bytes equal |
| forecast snapshot | count and formula report | 13, 187, 8, 4, 416, 21,632 |
| network seam | catalog and identity report | 13, 57, 56, 11, 82 and digest equality |
| envelope | endpoint capture matrix | exact keys, state, data, error |
| query contract | negative request matrix | exact status and INVALID_REQUEST |
| null and zero | boundary fixture report | round-trip identity |
| market | provider attempt matrix | order, timeout, unit, cache |
| news | provider and dedupe report | window, order, counters, cache |
| insight | Gemini and fallback report | schema, candidate, no second LLM |
| port | coverage and detail report | pagination, shared series, days |
| chokepoint | state report | retry 0, null, stale, no-store |
| weather | location and threshold report | 82, provider limits, risk |
| tuning | deployment capability report | exact health and run DTO |
| security | bundle, log, outbound report | zero secret and SSRF violations |
| consumer seam | shared fixture report | all consumer decoders pass |
| cold load | browser network report | no console or contract error |

Evidence generated during implementation records environment, clock, provider capability, generator version, and an evidence-run identity. An implementation lineage identifier is never normative authority in this specification.

---

## 44. final self-review

- CHECKED — no unapproved implementation lineage, filesystem location, implementation filename, or preexisting artifact digest remains.
- CHECKED — no instruction extracts or parses prior application source.
- CHECKED — every static artifact is regenerated from approved data pack 00–18.
- CHECKED — DataGateway methods and exact envelope are self-contained.
- CHECKED — all query policies are self-contained.
- CHECKED — all domain states and HTTP status mappings are self-contained.
- CHECKED — all units and null-zero rules are self-contained.
- CHECKED — all cache, timeout, retry, abort, fallback rules are self-contained.
- CHECKED — snapshot and network cardinalities are self-contained.
- CHECKED — market provider order and HARPEX Index unit are self-contained.
- CHECKED — news profiles, scoring, dedupe, localization, windows, cache are self-contained.
- CHECKED — Gemini is the only LLM and deterministic fallback is self-contained.
- CHECKED — port, chokepoint, weather DTO and orchestration are self-contained.
- CHECKED — tuning health, request, success tuples, failures, deployment truth are self-contained.
- CHECKED — golden fixtures and negative cases are self-contained.
- CHECKED — consumer, responsive, cold-load, security, release acceptance are self-contained.
- CHECKED — P0 and P1 completion gates require zero open defects.
