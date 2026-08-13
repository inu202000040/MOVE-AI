# WT2 — Main Dashboard Greenfield Build Packet

## 0. 문서의 목적

이 문서는 빈 저장소에서 Page 1 메인 대시보드를 처음부터 구축하는 담당자를 위한 greenfield build packet이다.

담당자는 이 문서, 승인된 Figma/PNG 기준, 승인된 데이터 팩, 동결 계약으로 다음을 재현해야 한다.

- 선택 노선의 전체 KCCI history
- 대표모델의 1~4주 forecast path
- PI90 interval
- 확대·축소·drag·keyboard chart navigation
- horizon별 readout
- 중복 없는 두 market card
- route news collection/cache
- forecast insight
- 현재 노선 전체이력 dialog
- 13개 전체노선 dialog

“데이터가 보이는 dashboard”는 충분하지 않다.

승인된 Figma/PNG 기준과 다른 component hierarchy, chart geometry, interaction, state transition은 실패다.

실행 코드는 이 문서에 포함하지 않는다.

## 1. 완료의 의미

WT2 완료는 다음이 동시에 성립하는 상태다.

1. KNEI deterministic smoke 값이 정확하다.
2. 13개 route를 바꿔도 같은 state/data contract로 렌더된다.
3. chart mouse, pointer, keyboard navigation이 승인 interaction contract와 같다.
4. forecast horizon 1~4주의 숫자와 PI90이 같다.
5. market 두 slot이 절대로 중복되지 않는다.
6. market provider 실패 때 synthetic data를 만들지 않는다.
7. news가 IDLE/LOADING/READY/ERROR/CACHED를 정확히 구분한다.
8. insight가 news와 forecast의 허용된 정보만 사용한다.
9. history와 all-routes dialog가 focus/scroll lifecycle까지 같다.
10. 1440/900/640/375 visual evidence가 모두 닫힌다.

모든 acceptance cell의 유일한 종료값은 `CHECKED`다.

미검증 상태, `N/A`, “대체 구현”, “향후 개선” 상태로 DONE을 선언하지 않는다.

## 2. Clean-room source of truth 우선순위

| 우선순위 | 승인 기준 | 용도 |
|---:|---|---|
| 1 | 승인된 Figma 프레임과 PNG 기준 이미지 | visible UI·geometry·order·responsive·interaction의 최종 판정 |
| 2 | 본 문서 | Dashboard 상세 동작·상태·acceptance 계약 |
| 3 | 동결된 공유 계약 | DTO, literal union, gateway envelope, query와 seam 판정 |
| 4 | 승인된 데이터 팩과 그로부터 생성한 fixture | 수치·시계열·이벤트·market·news·insight 검증 |

구현과 fixture는 과거 저장소, 배포 화면, API 캡처, 소스 덤프를 입력으로 사용하지 않는다.

Figma와 PNG가 충돌하면 승인 기록이 있는 최신 Figma 프레임을 우선하고, 데이터와 상태는 동결 계약 및 승인된 데이터 팩을 우선한다. 승인 기준끼리 충돌하면 임의로 해석하지 않고 contract freeze를 다시 연다.

본 문서의 `NEW MANDATORY`는 typed seam, truthfulness, 검증 gate처럼 **visible UI를 바꾸지 않는** greenfield 보강에만 우선한다. 승인 기준에 없는 card, tooltip field, badge, 표시 문구, status strip, action을 `NEW MANDATORY`라는 이름으로 선승인할 수 없다.

## 3. 담당 범위

### 3.1 WT2 소유 범위

- Dashboard page content
- dashboard section order
- dashboard grid와 responsive composition
- route selector의 dashboard 소비
- representative model의 dashboard 소비
- main forecast chart
- chart viewport state machine
- pointer/wheel/keyboard chart navigation
- current point tooltip과 PI90 range native `<title>`
- forecast horizon selector
- forecast readout
- two-slot market selector
- market mini chart와 상태 UI
- route news UI state machine
- route news cache adapter
- cross-tab news sync
- insight request와 UI state
- insight cache adapter
- current-route history dialog
- history event overlay/list/detail
- all-routes dialog
- all-routes 13 mini chart
- dashboard visual and functional tests
- dashboard evidence pack

### 3.2 WT2가 WT1에서 소비하는 seam

- AppShell
- Sidebar
- topbar
- `전체 노선` topbar action slot
- current routeId
- route change function
- route query/localStorage persistence
- shared tokens
- shared card surface
- shared focus ring
- shared portal reset

WT2가 Sidebar나 root route persistence를 다시 구현하지 않는다.

### 3.3 WT2가 WT3/WT6에서 소비하는 seam

WT3는 대표모델 결정의 단일 소유자다.

- WT2는 WT3가 생산한 `RepresentativeSelectionV1` 하나만 소비한다.
- `RepresentativeSelectionV1`에는 route/current observation, automatic/manual mode, selected model identity/version, 별도 automatic champion, 1주 score/Coverage, 동일 model의 1~4주 forecast·PI90·metric, tuning 반영 8-model agreement, baseline/tuned provenance, evaluation protocol, immutable revision이 들어간다.
- WT2는 representative localStorage를 직접 읽지 않는다.
- WT2는 tuning localStorage를 직접 읽지 않는다.
- WT2는 tuning overlay merge, 1주 champion 계산, manual override validation을 재구현하지 않는다.

#### 3.3.1 **NEW MANDATORY** Dashboard projection completeness

Dashboard는 선택 horizon의 readout·tooltip·model note와 insight request를 만들 때 선택 모델의 horizon별 MAPE, MSE, MASE, total score, Coverage, hits, total, sampleSize를 사용한다.

Dashboard의 `modelAgreement`는 선택 horizon에서 **tuning overlay까지 반영된 8개 모델 전체 forecast**를 마지막 실측 대비 ±3% threshold로 분류해 만든다.

따라서 WT2가 받는 `RepresentativeSelectionV1`은 WT3 §26.2의 DTO와 byte-level로 같은 아래 projection을 반드시 가진다. WT2용 축약 DTO를 하나 더 만들지 않는다.

```text
metricsByHorizon: [
  { horizonWeeks: 1|2|3|4, mapePct, mse, rmse, mase, mapeScore, mseScore, maseScore, totalScore,
    coverage: { pct, hits, total, sampleSize, target: 0.90, intervalMethod } } x 4 in horizon order
]
modelAgreementByHorizon: [
  { horizonWeeks: 1|2|3|4, thresholdPct: 3, up, down, flat, total: 8,
    members: [{ modelId, modelName, modelVersion, forecastSource, tuningRunHash,
                point, changePct, direction: "up"|"down"|"flat" } x 8 in registry order] } x 4 in horizon order
]
```

- `metricsByHorizon`은 선택된 동일 model의 baseline 또는 accepted tuning 결과다.
- `currentObservation`은 `{date,value,unit:"USD/FEU"}`이며 승인 데이터 팩의 periodEnd와 route 마지막 actual에 결속한다.
- `automaticChampion`은 manual 선택과 무관한 tuning 반영 1주 자동 1위이며 WT2가 재선정하지 않는다.
- `modelAgreementByHorizon`은 WT3 selector가 validated tuning store를 merge한 뒤 Naive를 포함한 canonical 8개 model 전체로 계산한다.
- `up + down + flat = total = members.length = 8`이고 각 member direction을 다시 센 값과도 같아야 한다.
- 변화율이 `>= 3%`면 up, `<= -3%`면 down, 그 사이는 flat이다.
- WT2는 selected horizon row를 lookup만 한다. 현재값·automatic champion·metric·agreement를 원시 데이터, tuning storage 또는 forecast point에서 다시 계산하면 P0다.
- WT2가 baseline metric을 tuned metric 대신 사용하거나 8-model agreement를 다시 계산하면 P0다.
- 위 tuple은 `representativeRevision` 계산 대상이며 byte fixture에도 포함한다.
- WT3 명세·공유 type·fixture가 이 expansion과 동일해지기 전 cross-WT contract freeze 상태는 `FAILED`이고 Phase 1을 시작하지 않는다.

WT6는 승인 데이터 팩 projection과 tune request/response transport만 소유한다.

- WT6는 champion이나 manual representative를 결정하지 않는다.
- WT2의 market/news/insight 입출력은 WT6 계약을 구현한 typed `DataGateway`만 통과한다.
- page component, hook, cache adapter에서 endpoint를 raw fetch하는 경로는 금지한다.
- typed gateway는 `GatewayResultV1<TData, TState>` runtime validation을 통과한 값만 WT2에 반환한다.

### 3.4 WT2 비담당 범위

- Models page table와 tuning dialog
- Network map와 AIS/weather/chokepoint
- Allocation CVaR simulation
- 승인 데이터 팩 생성기의 통계 학습
- market provider crawler 내부 구현
- news provider crawler 내부 구현
- LLM provider credential management
- 공통 Sidebar 디자인 변경
- landing

API endpoint가 없으면 contract fixture로 UI를 검증할 수는 있다.

그러나 배포 완료를 synthetic fixture에 연결된 상태로 선언하지 않는다.

## 4. Clean-room authority map

| 계약 | 승인 기준 | 확인 포인트 |
|---|---|---|
| page composition | Figma desktop/mobile 프레임 | section 순서, responsive composition, dialogs |
| geometry와 visual tokens | Figma inspection 값과 승인 PNG | size, spacing, color, typography, shadow, breakpoint 결과 |
| route/model/horizon registry | 동결 계약과 승인 데이터 팩 | ordering, labels, literal values |
| deterministic core | 승인 데이터 팩에서 생성한 fixture | 13 routes, observations, forecast, metrics, agreement |
| representative selection | WT3 동결 seam | `RepresentativeSelectionV1`의 단일 생산자 |
| route events | 승인 데이터 팩에서 생성한 fixture | markers, sources, empty routes |
| market/news/insight | WT6 동결 gateway 계약과 데이터 팩 fixture | query, provider state, cache, response envelope |
| shell/navigation | WT1 동결 seam | page id, route hydration, topbar action, drawer lifecycle |

모든 검수 근거는 Figma frame/node 식별자, PNG 기준 이미지 식별자, 데이터 팩 버전, 동결 계약 버전으로 기록한다. 과거 소스 파일명·줄 번호·저장소 식별자는 근거로 사용하지 않는다.

## 4.1 Required assets and immutable inputs

WT2는 다음 asset/input 없이 READY를 주장하지 않는다.

- 승인 데이터 팩에서 생성한 deterministic core fixture
- route registry와 Korean label map
- 8-model id/name/color registry
- 1·2·3·4 horizon registry
- route event catalog
- route event source title/date catalog
- shared icon set의 Database, Activity, Newspaper, Gauge, Refresh, Chevron, BarChart, X glyph
- WT1 shared font stack
- WT1 shared card/focus/portal tokens
- market state fixtures for LIVE/REFERENCE/UNAVAILABLE
- news state fixtures for IDLE/LOADING/READY/EMPTY/ERROR/CACHED
- insight state fixtures for waiting/loading/LLM/rule fallback
- WT3-produced `RepresentativeSelectionV1` ready/error fixtures
- WT6 `GatewayResultV1<TData, TState>` market/news/insight ready/unavailable fixtures

fixture metadata에는 schemaVersion, generatedAt, source period, observation count, 승인 데이터 팩 버전을 기록한다.

event fixture metadata에는 event id, date, affected routes, source title, 승인 데이터 팩 버전을 기록한다.

icon을 emoji나 임의 글자로 대체하지 않는다.

font load 실패 screenshot을 visual baseline으로 승인하지 않는다.

gateway fixture는 승인 데이터 팩에서 생성하며 request query/body, response state, redaction 여부를 기록한다.

secret이나 provider credential은 evidence asset에 포함하지 않는다.

## 4.2 NEW MANDATORY cross-WT data contracts

### 4.2.1 GatewayResultV1 envelope

market, news, insight의 typed gateway 결과는 모두 다음 root field를 삭제 없이 가진다.

| field | exact contract |
|---|---|
| `schemaVersion` | literal `move-ai/gateway/v1` |
| `state` | domain state enum |
| `data` | domain payload 또는 null |
| `meta` | 항상 존재하는 source/asOf/fetchedAt/mode/cache/warnings metadata |
| `error` | safe error object 또는 null |

- `UNAVAILABLE`이면 `data=null`이다.
- 그 외 state면 `data`는 non-null이고 domain runtime validator를 통과한다.
- WT2는 payload field를 반드시 `result.data.*`에서 읽는다.
- badge와 state machine은 `result.state`를 읽는다.
- source, provider, asOf, fetchedAt, cache, warning은 `result.meta.*`를 읽는다.
- error 표시 문구와 retry 가능성은 `result.error`를 읽는다.
- WT2가 raw response의 top-level `points`, `articles`, `headline`, `source`, `fetchedAt`을 읽으면 P0다.
- HTTP error status에서도 envelope validation을 먼저 수행하며 HTML/text body를 UI state로 직접 해석하지 않는다.
- typed `DataGateway` 밖의 direct endpoint call, response cast, message-string parsing은 금지한다.

### 4.2.2 DataGateway method boundary

| method | input | output |
|---|---|---|
| market | canonical market query | `GatewayResultV1<MarketDataV1, MarketGatewayState>` |
| news | canonical news query | `GatewayResultV1<NewsDataV1, NewsGatewayState>` |
| insight | validated insight body | `GatewayResultV1<InsightDataV1, InsightGatewayState>` |

- request serialization, abort signal, envelope parse, schema validation, safe error normalization은 gateway 책임이다.
- cache adapter는 validated result만 저장한다.
- retained cached data는 새 `UNAVAILABLE data=null` envelope와 별도 client state로 보존하며 새 실패 응답의 data처럼 위장하지 않는다.

### 4.2.3 Canonical query freeze

| domain | query field | exact value/source |
|---|---|---|
| market | `series` | `fx`, `oil`, `bunker`, `harpex` 중 선택값 |
| market | `from` | `2026-01-01` |
| market | `to` | 승인 데이터 팩 `periodEnd`; KNEI golden은 `2026-08-03` |
| market | `providerVersion` | `3` |
| news | `route` | WT1이 제공한 canonical route ID |
| news | `asOf` | literal `latest`; current market-monitoring window를 요청 |
| news | `providerVersion` | `18` |
| news | `retry` | `0` 또는 `1` |
| news | `refresh` | 명시적 사용자 갱신 token; cold request에서는 생략 |

- market `to`는 승인 데이터 팩 기준일이지만 news `asOf`는 의도적으로 `latest`다. 둘을 하나의 기준일로 합치지 않는다.
- news endpoint가 `latest`를 수신하면 server request 시각을 UTC 상한으로 삼고 검색식은 `when:90d`를 사용한다.
- News panel은 최신 사후 모니터링까지 표시할 수 있지만 Insight request는 `publishedAt <= RepresentativeSelectionV1.currentObservation.date`인 기사만 투영한다.
- 이 표와 WT6 canonical query table이 다르면 구현하지 않고 contract freeze를 다시 연다.

## 5. Clean-room verification inputs

구현 전 다음을 동결한다.

- 승인 Figma desktop/mobile frame과 component variant 식별자
- 승인 PNG 기준 이미지의 viewport와 상태 식별자
- 승인 데이터 팩 버전과 생성 fixture metadata
- 동결 공유 계약 버전
- browser/version
- OS scale 100%
- browser zoom 100%
- DPR
- font loaded confirmation
- KNEI route query state
- WT3 `RepresentativeSelectionV1` automatic/manual fixture 상태
- WT3 selector가 검증할 representative/tuning storage fixture 상태
- news cold/empty storage 상태
- news cached storage fixture
- market provider fixture timestamp
- 1440/900/640/375 PNG 기준 이미지
- chart interaction acceptance scenario
- 두 dialog interaction acceptance scenario

승인 PNG 기준 이미지는 다음 상태를 분리한다.

- deterministic core ready
- market loading
- market live
- market REFERENCE
- market unavailable
- news idle
- news loading without cache
- news ready
- news cached while refreshing
- news error retaining cache
- news empty
- insight waiting
- insight loading
- insight LLM
- insight rule fallback
- history dialog
- all-routes dialog

### 5.1 viewport 검수 깊이 — MANDATORY

viewport는 모두 버리는 셀 없이 확인하되 검수 깊이는 다음처럼 고정한다.

| viewport | 등급 | 필수 증거 | 판정 |
|---|---|---|---|
| 1440×900 | 상세 parity | Figma frame, full/crop PNG 기준, 구현 렌더, computed style, primary interaction recording | pixel·geometry·표시 문구 상세 승인 |
| 375×812 | 상세 parity | Figma frame, full/crop PNG 기준, 구현 렌더, overflow metric, touch/keyboard recording | pixel·geometry·표시 문구 상세 승인 |
| 900×900 | smoke | ready screenshot, breakpoint composition, dialog, market/news state, keyboard path, overflow | 구조·기능·상태 전이 승인 |
| 640×900 | smoke | ready screenshot, compact controls, dialog, market/news state, keyboard path, overflow | 구조·기능·상태 전이 승인 |

- `smoke`는 생략이나 미검증을 뜻하지 않는다. Figma/PNG와 구현 렌더의 full perceptual 비교 수치만 상세 셀처럼 요구하지 않는다.
- 900/640에서도 column 수, order, breakpoint, clipped control, document overflow, missing state, 표시 문구 차이는 자동 실패다.
- 1280px breakpoint는 별도 targeted structural smoke를 수행한다.
- `responsive cells: 24/24` 같은 기존 표기는 증거 index에서 `detail checked / smoke checked`로 분리한다.

## 6. Greenfield component boundaries

구현 framework와 파일명은 프로젝트 표준에 맞출 수 있다.

그러나 책임은 다음 단위로 분리한다.

- Dashboard page composer
- WT3 `RepresentativeSelectionV1` consumer adapter
- interactive time-series chart
- chart viewport controller
- forecast summary/readout
- horizon selector
- market slot selector
- typed market `DataGateway` consumer
- market mini chart
- typed news `DataGateway` consumer
- news cache adapter
- news panel
- typed insight `DataGateway` consumer
- insight cache adapter
- insight panel
- history event catalog adapter
- current-route history dialog
- all-routes trend dialog
- dialog lifecycle utility
- dashboard state fixtures
- Figma/PNG visual parity suite

하나의 거대한 component에서 gateway 호출, chart math, dialog, storage를 함께 처리하지 않는다.

UI component는 provider failure를 synthetic value로 바꾸지 않는다.

data selector는 표시 문구를 임의 생성하지 않는다.

## 7. 구현 순서 개요

1. 승인 Figma/PNG, 데이터 팩, 동결 계약과 data invariants를 동결한다.
2. WT1 AppShell seam에 빈 dashboard content를 연결한다.
3. WT3 `RepresentativeSelectionV1` consumer를 연결한다.
4. static hero chart를 정확히 그린다.
5. viewport interaction을 완성한다.
6. horizon/readout을 연결한다.
7. typed DataGateway로 market two-slot resource를 연결한다.
8. typed DataGateway로 news state/cache를 연결한다.
9. typed DataGateway로 insight state/cache를 연결한다.
10. current-route history dialog를 만든다.
11. all-routes dialog를 만든다.
12. responsive, accessibility, animation을 닫는다.
13. Figma/PNG visual parity와 functional matrix를 닫는다.

API부터 만들고 UI를 나중에 추측하지 않는다.

먼저 상태별 표시 surface를 정의한 후 각 resource를 연결한다.

## 8. Page route state와 topbar contract

Dashboard는 validated `routeId` query state를 사용한다.

기본 route는 KNEI다.

topbar eyebrow은 `ROUTE MARKET OVERVIEW`다.

topbar H1은 `메인 대시보드`다.

topbar description은 `운임과 시장 신호를 한 화면에서 확인합니다.`다.

topbar 오른쪽에는 dashboard에서만 `전체 노선` button이 있다.

button icon은 BarChart3 17px이다.

button text는 `전체 노선`이다.

button height는 42px이다.

button padding은 0 14px이다.

button radius는 10px이다.

button text는 11px/900이다.

button hover/focus/expanded는 blue background, white text, translateY(-1px)다.

640px 이하에서는 40×40 icon-only가 된다.

visible text는 visually hidden이지만 accessible name은 유지한다.

as-of chip은 승인 데이터 팩 기준일을 표시한다.

## 9. Dashboard section order

화면 정보 순서는 다음과 같다.

1. shared topbar
2. main grid left hero card heading
3. hero legend
4. chart navigation toolbar
5. main KCCI chart
6. forecast readout
7. chart footer
8. main grid right market selector
9. upper market card
10. lower market card
11. lower grid left AUTO INSIGHT
12. lower grid right ROUTE NEWS WATCH
13. portal history dialog when open
14. portal all-routes dialog when open

readout을 chart 위로 올리지 않는다.

news를 insight 왼쪽에 놓지 않는다.

market selector를 각 card 안에 중복 배치하지 않는다.

## 10. Dashboard layout geometry

desktop main grid는 `minmax(0,1.7fr) minmax(390px,1fr)`다.

effective gap은 22px이다.

hero card는 left column 전체를 차지한다.

market panel은 right column이다.

market panel은 selector와 two-card stack으로 나뉜다.

market stack desktop은 two rows다.

market stack gap은 22px이다.

lower grid는 equal two columns다.

lower grid gap은 22px이다.

lower grid top margin은 18px이다.

hero, insight, news card desktop padding은 22px이다.

market card padding은 18px이다.

card radius는 18px이다.

card background는 `#f1f2f9`다.

card shadow는 blue-tinted 10px/24px과 reverse white shadow다.

## 11. Width별 composition

### 11.1 1440px

- shared Sidebar 68px
- main width 1372px
- content horizontal inset는 clamp 결과 약 41~44px
- content usable width 약 1284~1290px
- main grid two columns
- right market column 최소 390px 충족
- 예상 ratio는 약 1.7:1
- market cards vertical
- lower insight/news two columns
- hero chart default height 300px
- no document horizontal overflow

### 11.2 900px

- shared Sidebar off-canvas 218px
- main left margin 0
- dashboard main grid one column
- market panel은 900 breakpoint에서 one column stack
- lower grid one column
- hero가 market보다 먼저 나타남
- topbar는 mobile menu와 전체노선 action 유지
- content horizontal inset 약 27px
- dialog width는 viewport-24px 범위
- no document horizontal overflow

### 11.3 640px

- topbar min-height 78px
- content padding 14px 12px 36px
- hero/insight/news card padding 16px
- section heading vertical stack
- route select full width
- chart toolbar wraps
- toolbar hint hidden
- toolbar buttons 38×38 minimum
- horizon selector full width 4 equal columns
- forecast summary padding 15px
- readout articles one column with separators
- all-routes action icon-only 40×40
- all-routes dialog header compact

### 11.4 375px

- content usable width 351px
- all primary cards one column
- route selector width 100%
- chart SVG stays inside card
- tooltip clamps to card center
- forecast endpoint and labels remain visible
- four horizon controls each remain tappable
- market tabs four columns within each row
- news button and badge wrap without overlap
- dialog width viewport-24px or viewport-20px per dialog
- no document horizontal overflow

1280px과 1200px dialog breakpoint도 별도로 확인한다.

### 11.5 Dashboard/market/readout final-cascade truth table — MANDATORY

이 표는 승인 Figma/PNG에서 확인된 **최종 computed layout** 기준이다. 구현과 computed-style ledger가 다르면 승인 기준을 다시 대조한다.

| viewport | shell | dashboard grid | market stack | lower grid | forecast lead | forecast detail |
|---|---|---|---|---|---|---|
| 1440×900 | sidebar 68px, main margin-left 68px | `minmax(0,1.7fr) minmax(390px,1fr)`, gap 22px | 1 column × 2 rows, gap 22px | 2 equal columns, gap 22px | `minmax(0,1.25fr) minmax(230px,.9fr)` | `minmax(240px,1.2fr) minmax(180px,.82fr) minmax(210px,1fr)` |
| 1280×900 | sidebar 68px, main margin-left 68px | 1 column | **1 column × 2 rows**, gap 22px | 2 equal columns | desktop 2-column lead 유지 | desktop 3-column detail 유지 |
| 900×900 | sidebar 218px off-canvas, main margin-left 0 | 1 column | 1 column | 1 column | 1 column, align-start, gap 6px | 2 columns; validation은 full row |
| 640×900 | sidebar 218px off-canvas, main margin-left 0 | 1 column | 1 column | 1 column | 1 column | 1 column |
| 375×812 | 별도 375 query 없음; `<=640` 결과 사용 | 1 column | 1 column | 1 column | 1 column | 1 column |

- 1280 market은 승인 기준에서 세로 2행이다. 이를 가로 2열로 구현하면 parity 실패다.
- `900`은 `@media (max-width:900px)`가 포함되는 경계라 market/lower/readout 전환이 모두 적용된다.
- `640`과 `375`에서도 selector는 `40px minmax(0,1fr)` row와 내부 4 equal tabs를 보존한다.
- market card padding 18px은 `<=640`의 hero/insight/news 16px 축소 대상이 아니다.
- 375 전용 규칙을 임의로 발명하지 않는다. 승인 Figma/PNG에 없는 overflow용 visible 재설계를 추가하지 않는다.

## 12. Shared visual tokens consumed by WT2

| purpose | value |
|---|---|
| navy | `#001290` |
| blue | `#15269d` |
| cyan | `#3fa1eb` |
| ink | `#141415` |
| muted | `#63666a` |
| line | `#e0e0e0` |
| canvas | `#f1f2f9` |
| up/cost risk | `#c84646` |
| down/cost relief | `#087352` |
| flat | `#52677c` or yellow-neutral treatment |
| manual | `#7c3aed` |
| actual line | `#2f2f36` |
| forecast zone | `rgba(63,161,235,.09)` |
| forecast divider | `rgba(21,38,157,.4)` |
| market FX | `#15269d` |
| market Brent | `#3fa1eb` |
| market VLSFO | `#008d83` |
| market HARPEX | `#7c3aed` |
| event marker | `#f28c28` |

상승 운임은 화주 비용 위험이므로 red다.

하락 운임은 비용 완화이므로 green이다.

주식 chart 관례로 색을 뒤집지 않는다.

## 13. Typography and spacing

- section H2: 18px, line-height 1.2, letter-spacing -.035em
- section description: dashboard computed 11px
- section heading bottom margin: 14px
- legend: 9px/750
- chart viewport range: 10px
- chart viewport helper: dashboard 8px
- chart navigation hint: dashboard 9px
- chart axis: dashboard 11px
- forecast label/axis: 11px 전후
- card body helper: 9~11px component별 승인 기준 유지
- focus outline: 3px cyan alpha, offset 2px
- mobile section H2: 16px

모든 작은 text를 한 번에 10px로 normalize하지 않는다.

현재 final cascade와 screenshot을 component별로 비교한다.

## 14. Route registry contract

registry order는 다음과 같다.

| order | id | label |
|---:|---|---|
| 1 | KUWI | 북미서안 |
| 2 | KUEI | 북미동안 |
| 3 | KNEI | 유럽 |
| 4 | KMDI | 지중해 |
| 5 | KMEI | 중동 |
| 6 | KAUI | 호주 |
| 7 | KLEI | 남미동안 |
| 8 | KLWI | 남미서안 |
| 9 | KSAI | 남아프리카 |
| 10 | KWAI | 서아프리카 |
| 11 | KCI | 중국 |
| 12 | KJI | 일본 |
| 13 | KSEI | 동남아 |

selector option은 `{권역명} · {코드}` 의미를 유지한다.

visible label은 `조회 항로`다.

label과 select의 gap은 5px이다.

label은 10px/800, shared muted color다.

select desktop min-width는 196px이다.

select height는 42px이다.

select padding은 0 38px 0 13px이다.

select radius는 10px이다.

select text는 12px/800이다.

final surface는 shared canvas와 inset blue/white shadow를 쓴다.

all-routes dialog도 이 순서를 사용한다.

invalid route는 WT1 seam에서 KNEI로 정규화된다.

route 변경 시 dashboard chart instance를 reset한다.

horizon, market tab 변경은 route를 바꾸지 않는다.

## 15. Deterministic data-pack contract

승인 데이터 팩 projection에는 13 routes가 있어야 한다.

각 route에는 187개 weekly observation이 있어야 한다.

date range는 2022-11-07부터 2026-08-03이다.

unit은 USD/FEU다.

각 route에는 8개 model 결과가 있어야 한다.

model order는 다음과 같다.

1. naive
2. sarimax
3. lightgbm
4. xgboost
5. random_forest
6. prophet
7. timesfm
8. chronos

horizon은 1, 2, 3, 4주다.

각 model/horizon에는 point, date, lower90, upper90, 평가 metrics가 있어야 한다.

데이터 누락을 zero나 직전값으로 채우지 않는다.

shape가 틀리면 deterministic core ERROR다.

external market/news failure는 deterministic core를 가리지 못한다.

## 16. Representative model selection

`RepresentativeSelectionV1`의 유일한 생산자와 selector 소유자는 WT3다.

| field | WT2 consumption contract |
|---|---|
| `route` | 현재 WT1 canonical route와 일치 |
| `currentObservation` | 승인 데이터 팩 periodEnd 및 route 마지막 actual과 결속된 date/value/`USD/FEU` |
| `modelId` | canonical 8-model id |
| `modelName` | registry display name |
| `modelVersion` | 실제 baseline 또는 accepted tuning version |
| `score1w` | finite 1주 종합점수 |
| `coverage1w` | finite percent, 0–100 |
| `selectionMode` | `automatic` 또는 `manual` |
| `forecastSource` | `baseline` 또는 `tuned` |
| `tuningRunHash` | 동결 계약의 tuning run identity; baseline이면 null |
| `evaluationProtocol` | 실제 평가 protocol canonical identity |
| `automaticChampion` | tuning 반영 1주 자동 1위 identity/version/score; manual helper에 사용 |
| `representativeRevision` | 동결 계약이 정의한 stable payload revision |
| `forecasts` | horizon 1,2,3,4 각각 정확히 하나의 targetDate, point, lower90, upper90 |
| `metricsByHorizon` | horizon 1,2,3,4 각각 선택 model의 metric score와 nested Coverage exact tuple |
| `modelAgreementByHorizon` | horizon 1,2,3,4 각각 threshold 3, tuning 반영 registry-order 8 members, up/down/flat/total |

WT2가 검증할 invariant는 다음과 같다.

- selected model id 하나가 네 horizon 모두에서 같다.
- `lower90 <= point <= upper90`다.
- `route`가 현재 route와 다르면 결과를 commit하지 않는다.
- `selectionMode`, `modelName`, `modelVersion`, `forecastSource`로 automatic/manual helper와 provenance를 그린다.
- horizon을 바꿔도 selection object, `modelId`, `representativeRevision`을 바꾸지 않는다.
- selected horizon의 metric/readout/model note는 같은 horizon의 `metricsByHorizon` item만 사용한다.
- insight agreement는 같은 horizon의 `modelAgreementByHorizon` item만 사용한다.
- current/readout 변화율의 분모와 insight `current`는 `currentObservation`만 사용한다.
- manual mode method notice의 자동 1위는 `automaticChampion`만 사용한다.
- selector error 또는 forecast 4개 누락은 deterministic core ERROR다.
- metric/agreement 4개 누락, horizon 중복, Coverage 산술 불일치, agreement member 순서/개수/방향/count 불일치도 deterministic core ERROR다.

다음 결정 로직은 WT3 내부 acceptance이며 WT2 구현 항목이 아니다.

- 자동 대표는 1주 external evaluation score로 결정한다.
- Naive는 자동 대표 후보에서 제외한다.
- valid manual representative가 있으면 override한다.
- invalid manual id면 자동 대표로 복귀한다.
- valid tuning run을 baseline projection에 merge한 뒤 champion과 path를 결정한다.

WT2는 위 규칙을 독립 구현하거나 검산용이라는 이유로 두 번째 champion selector를 만들지 않는다.

WT2는 representative/tuning storage presence를 직접 해석하지 않는다. 자동 대표와 manual 대표가 같은 id여도 `selectionMode`는 WT3 결과를 그대로 표시한다. `currentObservation`, `automaticChampion`, `metricsByHorizon`, `modelAgreementByHorizon`도 localStorage나 `scoresWithTuning` equivalent로 재구성하지 않는다.

## 17. KNEI smoke fixture

아래 값은 UI 하드코딩 값이 아니다.

승인 데이터 팩과 selector, representative path, format이 올바른지 확인하는 회귀 fixture다.

현재 실측은 4,884 USD/FEU다.

현재 실측일은 2026-08-03이다.

자동 대표는 SARIMAX다.

| horizon | target date | point | PI90 lower | PI90 upper |
|---:|---|---:|---:|---:|
| 1주 | 2026-08-10 | 4,829 | 4,482 | 5,175 |
| 2주 | 2026-08-17 | 4,791 | 4,227 | 5,355 |
| 3주 | 2026-08-24 | 4,767 | 3,936 | 5,599 |
| 4주 | 2026-08-31 | 4,754 | 3,440 | 6,068 |

1주 변화율은 약 -1.1%다.

±3% 임계 안이므로 direction은 보합이다.

1주 PI90 coverage는 46/52, 88.5%다.

숫자 format은 승인 Figma/PNG의 locale과 USD/FEU 표현을 따른다.

## 18. Hero heading exact contract

eyebrow은 `KCCI ROUTE FORECAST`다.

title은 `{노선명} 운임 추이·1~4주 전망`이다.

title 옆에는 circular `!` button이 있다.

lucide Info icon으로 바꾸지 않는다.

button size는 23×23px이다.

button text는 `!`, 11px/900이다.

button aria-label은 `{노선명} 과거 운임과 주요 사건 보기`다.

button은 aria-haspopup dialog를 가진다.

button은 aria-expanded를 가진다.

click은 tooltip이 아니라 full route history dialog를 연다.

description exact text는 `기본은 2026년 이후 · 휠로 2022년 10월 축부터 전체 기간 탐색`이다.

heading action은 route selector다.

## 19. Hero legend

legend item 1은 actual line이다.

label은 `KCCI 실측`이다.

color는 `#2f2f36`이다.

legend item 2는 representative model이다.

label은 model display name이다.

color는 model color registry다.

legend item 3은 interval이다.

label은 `90% 예측구간`이다.

visual은 filled range swatch다.

legend는 right aligned, wrap 가능, gap 12px이다.

## 20. Main chart input contract

actual series에는 visibleHistory로 자르기 전 승인 데이터 팩의 모든 187 points를 공급한다.

viewport가 보이는 범위를 결정한다.

forecast series는 마지막 actual point를 첫 point로 포함한다.

그 뒤 같은 representative model id의 1~4주 point가 온다.

forecast line은 dashed다.

PI90은 네 개 horizon별 error bar다.

연속 polygon band로 바꾸지 않는다.

각 error bar에는 lower, upper, point, label, selected 여부가 있다.

selected horizon은 visual emphasis를 가진다.

chart default height는 300px이다.

SVG preserveAspectRatio는 `xMidYMid meet` 의미를 유지한다.

`none`으로 늘여 chart 비율을 왜곡하지 않는다.

## 21. Main chart time domain

full start boundary는 2022-10-01이다.

첫 actual observation은 2022-11-07이다.

initial start는 2026-01-01이다.

full end는 4주 forecast target까지다.

minimum viewport span은 8주다.

route change는 initial viewport로 reset한다.

horizon change는 viewport를 reset하지 않는다.

market tab change는 viewport를 reset하지 않는다.

news refresh는 viewport를 reset하지 않는다.

representative model change는 현재 viewport를 가능한 한 유지하되 contract reset key 동작을 검증한다.

## 22. Main chart y-domain

y-domain은 현재 viewport 안의 point로 매 interaction마다 다시 계산한다.

보이는 actual point를 포함한다.

보이는 forecast point를 포함한다.

보이는 PI90 lower/upper를 포함한다.

zero baseline을 강제하지 않는다.

min/max가 같은 경우 안전한 padding을 둔다.

upper/lower error bar가 clip되지 않도록 vertical margin을 둔다.

viewport 밖 point가 y-scale을 불필요하게 넓히지 않는다.

### 22.1 LineChart geometry formula freeze — MANDATORY

Dashboard hero와 market mini chart는 같은 동결 `LineChart` 수식을 사용한다.

```text
pad.top    = 24
pad.right  = 24
pad.bottom = xAxisLabel ? 52 : 38
pad.left   = yAxisLabel ? 82 : 64
plotLeft   = pad.left
plotRight  = measuredWidth - pad.right
endpointInset = interactiveNavigation ? 14 : 0
dataLeft   = plotLeft + endpointInset
dataRight  = plotRight - endpointInset

rawMin = min(visible actual/forecast point values and visible point/range lower/upper)
rawMax = max(same set)
yPad   = max(1, (rawMax - rawMin) * 0.13)       // Dashboard hero와 market
yMin   = max(0, rawMin - yPad)
yMax   = rawMax + yPad
y(value) = top + ((yMax-value)/(yMax-yMin))*(height-top-bottom)
```

- ResizeObserver width는 card 실측값을 반올림하고 최소 320px로 clamp한다.
- Dashboard hero는 `interactiveNavigation=true`이므로 양 endpoint inset이 각각 14px이다.
- market mini chart는 navigation이 없으므로 endpoint inset은 0px이며 axis label 때문에 plot padding은 `24/24/52/82`다.
- visible point가 0개인 비정상 transitional frame에서만 전체 point/range set을 domain fallback으로 쓴다.
- path는 viewport 경계에서 선이 끊기지 않도록 첫 visible point의 이전 1개와 마지막 visible point의 다음 1개까지 포함한다.
- non-`forecastOnly` y tick은 5개이고 `min + (max-min)*index/4`다.
- timeline x tick 수는 `clamp(floor((dataRight-dataLeft)/145),3,6)`이다. forecast focus이며 span이 420일 이하일 때는 viewport start, start~last-actual midpoint, last actual, 보이는 1~4주 forecast date를 중복 제거해 쓴다.
- PI90 cap half-width는 viewport span이 365일 초과면 5px, 아니면 8px이다. vertical/cap stroke는 selected horizon 4px, 나머지 2.5px, unselected opacity .55다.
- actual stroke는 2.6px이고 forecast stroke는 4.4px, dash는 `7 6`이다. visible actual point cadence는 `max(1,floor(renderedPoints/8))`; forecast endpoint는 radius 7 + radius 13/opacity .16 halo다.
- Dashboard forecast zone start는 `clamp(dataLeft + ((actualEndTime-viewStart)/viewSpan)*(dataRight-dataLeft), dataLeft, dataRight)`다. zone은 여기서 `plotRight`까지, plot top~bottom, radius8; divider도 같은 x다. final fill/stroke는 `rgba(63,161,235,.09)`/`rgba(21,38,157,.1)`, divider는 `rgba(21,38,157,.4)`, 1.5px, dash `5 5`; label은 blue, 10px/900, letter-spacing .08em이고 x=divider+14px, y=top+17px다.
- 위 수식을 `nice()`나 chart library auto-domain/auto-tick으로 치환해 pixel geometry를 바꾸면 실패다.

## 23. Forecast zone and endpoint geometry

마지막 actual date에 vertical forecast divider를 둔다.

divider는 blue dashed line이다.

forecast side에는 pale blue zone fill이 있다.

label은 `예측 구간`이다.

forecast path가 마지막 actual point에서 끊기지 않는다.

interactive Dashboard의 마지막 4주 point는 `dataRight = plotRight - 14`에 놓인다. market처럼 non-interactive chart에는 이 inset을 적용하지 않는다.

4주 label과 tooltip이 clip boundary 밖으로 나가지 않는다.

actual label은 마지막 actual point에만 표시한다.

전체 이력에서도 모든 actual point에 label을 붙이지 않는다.

## 24. Chart navigation toolbar exact contract

toolbar aria-label은 `차트 기간 탐색`이다.

toolbar min-height는 38px이다.

toolbar margin은 2px 0 4px이다.

toolbar padding은 5px 7px 5px 11px이다.

toolbar border는 1px `#d9e5ef`다.

toolbar radius는 10px이다.

toolbar background는 `#f7fafc`다.

left status는 current viewport start/end를 `YYYY.MM.DD – YYYY.MM.DD` 의미로 표시한다.

helper는 `실측 시작 {실제 첫 관측일}`이다.

interaction hint는 `휠 확대·축소 · 가로 드래그 이동`이다.

button order는 `+`, `−`, `전체`, `최근`이다.

desktop button min-width는 29px이다.

desktop button height는 28px이다.

button padding은 0 8px이다.

button radius는 7px이다.

hover/focus는 blue border/text와 pale blue background다.

disabled는 gray text/background와 default cursor다.

minimum span이면 `+`를 disabled한다.

full viewport면 `−`와 `전체`를 disabled한다.

initial viewport면 `최근`을 disabled한다.

## 25. Wheel zoom state transition

wheel은 browser page scroll 대신 chart zoom을 수행한다.

pointer x를 plot-relative anchor로 계산한다.

왼쪽에서 wheel하면 왼쪽 날짜를 더 안정적으로 유지한다.

오른쪽에서 wheel하면 오른쪽 날짜를 더 안정적으로 유지한다.

deltaMode line은 16px 환산 의미를 가진다.

deltaMode page는 chart height 환산 의미를 가진다.

normalized delta는 과도한 zoom을 막기 위해 clamp한다.

zoom factor는 exponential mapping이다.

viewport는 full boundary 밖으로 나가지 않는다.

viewport는 8주보다 좁아지지 않는다.

navigation 후 hover와 series focus를 clear한다.

## 26. Pointer drag state transition

left button만 drag를 시작한다.

pointer capture를 사용한다.

mouse는 pointerdown 직후 drag active가 될 수 있다.

touch/pen은 6px threshold 전까지 방향을 판정하지 않는다.

deltaX와 deltaY가 모두 6px 미만이면 대기한다.

vertical movement가 horizontal 이상이면 page scroll gesture로 남긴다.

horizontal movement가 우세하면 chart pan을 시작한다.

pan distance는 plot pixel 대비 current viewport time span으로 환산한다.

drag right는 승인 interaction scenario의 과거/미래 방향과 같아야 한다.

viewport는 full boundary에서 clamp한다.

pointerup과 pointercancel 모두 capture를 해제한다.

dragging cursor는 grabbing이다.

idle interactive cursor는 grab이다.

SVG touch-action은 pan-y다.

## 27. Button and keyboard navigation

| input | exact action |
|---|---|
| toolbar `+` | center anchor, factor 0.72 |
| toolbar `−` | center anchor, factor 1.38 |
| toolbar `전체` | full start부터 forecast end |
| toolbar `최근` | 2026-01-01 initial viewport |
| keyboard `+` | factor 0.72 |
| keyboard `=` | `+`와 동일 |
| keyboard `-` | factor 1.38 |
| ArrowLeft | viewport width의 -16% pan |
| ArrowRight | viewport width의 +16% pan |
| Home | recent viewport |
| End | full viewport |
| Escape | hover와 series focus clear |
| double click | recent viewport |

SVG는 tabIndex 0이다.

SVG aria-label은 wheel/drag 가능성을 설명한다.

interaction hint id를 aria-describedby로 연결한다.

keyboard `+/-`를 생략하면 기능 parity 실패다.

## 28. Chart hover, focus, tooltip

### 28.1 승인 Figma/PNG parity baseline

- actual 또는 forecast point hover/focus는 point tooltip을 연다.
- 동결 Dashboard projection의 `forecastSeries.points`는 date/value/label만 전달한다. 따라서 승인 point tooltip은 title, formatted date, `{value} USD/FEU`만 보인다.
- PI90 range `<g>`는 native `<title>`로 `{N}주 PI90 {date} · {value} · PI90 {lower}~{upper}`를 가진다. 이를 rich point tooltip이 이미 존재한다고 기록하지 않는다.
- conditional interval tooltip은 lower/upper가 point에 있을 때만 활성화되며 승인 Dashboard baseline에서는 그 branch가 실행되지 않는다.
- tooltip은 `width:max-content`, min-width 220px, max-width `min(380px,calc(100% - 20px))`, gap 8px, padding `16px 19px`, radius 12px다.
- final theme는 border `#3fa1eb`, background `#001290`, shadow `0 18px 40px rgba(0,18,144,.24)`다. title은 17px/1.35, date는 14px/1.6이다.
- position은 x percent를 26–74%로 clamp하고 y는 최소 8%에서 point보다 12% 위로 잡아 `translate(-50%,-100%)`한다. pointer-events는 none이다.
- `<=640`에서는 tooltip left 50%, min-width `min(260px,calc(100% - 20px))`의 승인 computed layout을 검증한다.
- chart navigation과 Escape는 stale tooltip/series focus를 닫는다.

### 28.2 **NEW MANDATORY** parity/enhancement 분리 gate

동결 `LineChart` contract는 lower/upper/Coverage를 받을 수 있지만 Dashboard `forecastSeries.points`는 그 field를 공급하지 않는다. 그러므로 다음을 강제한다.

- 이번 WT2 visible scope에서는 Dashboard forecast point에 lower/upper/Coverage를 주입하지 않는다.
- PI90 lower/upper, interval width, Coverage, hits/total을 rich point tooltip으로 보이면 **unapproved visible addition**으로 자동 실패다.
- `metricsByHorizon` 보강은 readout/model note/insight payload의 기존 visible behavior와 내부 seam 완결성을 위한 것이며 새 tooltip을 허가하지 않는다.
- 향후 별도 승인으로 enhancement를 추가한다면 승인 baseline 증거와 proposal 증거를 분리하고 새 acceptance를 받아야 한다. 현재 문서의 CHECKED cell로 선승인할 수 없다.
- 현재 허용되는 PI90 hover 정보는 §28.1의 range native `<title>`뿐이다.

## 29. Horizon selector contract

selector는 radiogroup이다.

button은 네 개다.

labels는 `1주`, `2주`, `3주`, `4주`다.

각 button은 radio role과 aria-checked를 가진다.

default selected horizon은 1주다.

container gap은 3px이다.

container padding은 3px이다.

container radius는 11px이다.

desktop button min-width는 43px이다.

desktop button min-height는 30px이다.

selected는 blue background, white text, small raised shadow다.

focus-visible은 2px cyan inset ring이다.

승인 interaction contract는 Tab과 click을 지원한다.

Arrow roving을 구현하지 않아도 parity지만 추가할 경우 별도 functional evidence가 필요하다.

horizon 변경은 chart viewport를 보존한다.

## 30. Forecast readout exact structure

readout outer margin-top은 18px이다.

outer padding은 17px 18px이다.

outer border는 blue 14% alpha다.

outer radius는 16px이다.

background는 pale blue diagonal gradient와 translucent white다.

top lead는 desktop two columns다.

eyebrow은 `FORECAST READOUT`이다.

headline 의미는 `{노선명} {N}주 후 운임은 {forecast}로 {상승|하락|보합} 전망입니다.`다.

helper 의미는 `현재 대비 {change} · PI90 범위는 {lower}~{upper} / FEU`다.

right side에는 horizon selector가 있다.

summary grid는 세 article이다.

개별 KPI tile 여섯 개로 쪼개지 않는다.

### 30.1 Readout computed geometry and typography — MANDATORY

- outer는 display grid, gap 14px, border `1px solid rgba(0,103,185,.14)`, background `linear-gradient(135deg,rgba(0,103,185,.065),rgba(0,166,206,.025)), rgba(255,255,255,.58)`다.
- lead는 columns `minmax(0,1.25fr) minmax(230px,.9fr)`, align-items end, gap 18px다. left text group은 gap 4px다.
- lead/article eyebrow은 blue, 8px/900, letter-spacing .1em이다.
- lead headline은 navy, 15px/1.35/900, letter-spacing -.025em이다.
- helper는 Dashboard final override 기준 11px/1.55, `#53687c`, desktop right aligned이고 bold는 11px다.
- tools는 min-width 0, grid, justify-items end, gap 7px이다.
- horizon control은 inline-flex, gap 3px, padding 3px, border `rgba(21,38,157,.13)`, radius 11px, background `#edf2fa`, inset shadow 두 개다.
- horizon button은 min `43×30`, padding `5px 9px`, radius 8px, 9px/850이다. selected는 white on `#15269d`, shadow `0 5px 12px rgba(21,38,157,.18)`; focus inset ring은 `#3fa1eb` 2px다.
- detail grid top border는 `rgba(0,44,95,.1)`다. article gap 10px, padding `14px 17px 0`, right separator 같은 색; 첫 article은 left padding 0, 마지막은 right padding/border 0이다.
- dt는 Dashboard final 9px/750, `#6b7f92`; dd는 17px/900/1.2, letter-spacing -.035em, nowrap; helper는 Dashboard final 8px/1.35다. validation dd만 15px다.
- flow는 space-between/gap 8px, PI90 lower/upper는 각각 flex 1이고 가운데 separator는 18×2px blue→cyan gradient다. validation two dl gap은 14px이다.

### 30.2 Readout breakpoint transitions — MANDATORY

| width | exact transition |
|---|---|
| 1440 | desktop lead 2 columns + detail 3 columns |
| 1280 | 변화 없음; desktop lead/detail 유지 |
| 900 | lead 1 column, align start, gap 6px; helper left; tools start; detail 2 columns; article 2 right border/padding 제거; validation spans both columns with left padding 0 and top separator |
| 640 | outer padding 15px; horizon selector width 100%, 4 equal grid columns; detail 1 column; 모든 article padding `12px 0`, right border 제거, article 1·2 bottom separator; last는 separator 없음 |
| 375 | 별도 query 없음; 640 규칙과 동일하며 four horizon control과 nowrap value가 351px content 안에 실제로 맞는지 detailed PNG comparison으로 확인 |

1280에서 readout을 조기 stack하거나 900에서 곧바로 detail 1열로 만들면 실패다.

## 31. Readout article 1 — current to forecast

article label은 `현재 운임 → {N}주 점예측`이다.

left dl label은 `마지막 실측`이다.

left value는 current USD value다.

left helper는 current date와 `USD/FEU`다.

center에는 right chevron이 있다.

right dl label은 `{N}주 예측`이다.

right value는 selected forecast point다.

right helper는 target date와 `USD/FEU`다.

## 32. Readout article 2 — PI90

article label은 `PI90 예측구간`이다.

left label은 `하한`이다.

left value는 selected lower다.

center는 blue-to-cyan horizontal line이다.

right label은 `상한`이다.

right value는 selected upper다.

helper는 `90% 구간 · USD/FEU` 의미다.

continuous band width를 별도 KPI로 추가하지 않는다.

## 33. Readout article 3 — representative and coverage

article label은 `대표 모델·외부평가`다.

auto mode label은 `자동 대표 모델`이다.

manual mode label은 `사용자 대표 모델`이다.

value는 model display name이다.

auto helper는 `1주 성능 기준 자동 선정` 의미다.

manual helper는 `2페이지에서 직접 선택` 의미다.

coverage label은 `{N}주 PI90 Coverage`다.

coverage value는 one decimal percent다.

helper는 `{hits}/{total} 적중 · {sampleSize}회`다.

model version이나 score를 별도 타일로 추가하지 않는다.

## 34. Direction calculation and color

변화율은 `(forecast-current)/current×100`이다.

변화율이 3% 이상이면 상승이다.

변화율이 -3% 이하이면 하락이다.

그 사이는 보합이다.

상승은 red cost-risk tone이다.

하락은 green cost-relief tone이다.

보합은 neutral tone이다.

8개 model agreement도 같은 threshold를 쓴다.

agreement는 insight request input이다.

agreement를 새 standalone card로 만들지 않는다.

## 35. Chart footer

left exact pattern은 `KOBC KCCI · 마지막 실측 {date}`다.

Database icon은 14px이다.

right exact pattern은 `선택 예측 대상 {date}`다.

footer는 top border를 가진다.

footer padding-top은 11px이다.

footer font는 dashboard computed 10px 전후다.

`마지막 실적` 같은 다른 단어로 바꾸지 않는다.

## 36. Core dashboard state model

| state | trigger | visual | policy |
|---|---|---|---|
| LOADING | 승인 fixture의 첫 decode | scoped skeleton 또는 stable shell | whole app 차단 금지 |
| READY | registry/data/model path valid | full hero/readout | normal |
| EMPTY | valid route에 0 observation | explicit data-empty core | 배포 fixture에서는 fail |
| ERROR | schema/model/horizon 누락 | clear deterministic core error | synthetic fill 금지 |
| CACHED | verified bundled data-pack projection | READY와 동일, source date 표시 | fake LIVE badge 금지 |

승인 bundled projection을 사용하므로 core는 즉시 deterministic READY다.

market/news/insight 상태가 core를 loading/error로 덮지 않는다.

## 37. Market selector exact contract

selector outer는 두 row다.

outer gap은 5px이다.

outer padding은 5px이다.

outer border는 `rgba(21,38,157,.12)` 1px이다.

outer radius는 13px이다.

outer background는 `rgba(255,255,255,.74)`다.

outer shadow는 `0 8px 22px rgba(15,52,82,.06)`다.

row labels는 `상단`, `하단`이다.

각 row는 40px label column과 1fr tabs다.

tabs는 4 equal columns다.

tab gap은 5px이다.

tab height는 34px이다.

tab radius는 9px이다.

tab text는 10px/900, letter-spacing -.02em이다.

inactive는 transparent background와 `#52667a` text다.

hover는 pale blue background와 blue text다.

active는 shared blue background, white text, `0 6px 14px rgba(0,114,188,.22)` shadow다.

focus-visible은 2px `#f6a800`, offset 2px이다.

각 row는 tablist role을 가진다.

각 button은 tab role과 aria-selected를 가진다.

각 button은 해당 panel id를 aria-controls로 가진다.

option order는 다음과 같다.

1. 환율
2. Brent
3. VLSFO
4. HARPEX

initial upper는 fx다.

initial lower는 oil이다.

## 38. Two-slot selection invariant

upper와 lower는 항상 서로 다른 series다.

현재 slot의 현재 value를 다시 누르면 no-op다.

upper에서 lower의 value를 선택하면 lower는 이전 upper value로 swap된다.

lower에서 upper의 value를 선택하면 upper는 이전 lower value로 swap된다.

제3의 value를 선택하면 대상 slot만 바뀐다.

중간 render에서도 duplicate card를 보여주지 않는다.

swap은 두 resource request를 각 새 series에 맞게 발생시킨다.

market selection은 route와 chart viewport를 바꾸지 않는다.

## 39. Market metadata

| id | tab | local loading/error label | successful payload label | unit | line color |
|---|---|---|---|---|---|
| fx | 환율 | `USD/KRW` | `USD/KRW` | `KRW/USD` | `#15269d` |
| oil | Brent | `Brent 유가` | `Brent 유가` | `USD/bbl` | `#3fa1eb` |
| bunker | VLSFO | `VLSFO 벙커유` | `글로벌 20항 평균 VLSFO 0.5%` | `USD/MT` | `#008d83` |
| harpex | HARPEX | `HARPEX` | `HARPEX Index` | `Index` | `#7c3aed` |

VLSFO를 부산 단일 벙커유로 표시하지 않는다.

HARPEX REFERENCE 값을 LIVE로 과장하지 않는다.

## 40. Market request contract

WT2는 typed `DataGateway.market`에 canonical query object를 전달한다.

KNEI golden query는 `series={series}`, `from=2026-01-01`, `to=2026-08-03`, `providerVersion=3`의 구조다.

실제 `to`는 browser today가 아니라 승인 데이터 팩 `periodEnd`다.

gateway 결과는 `GatewayResultV1<MarketDataV1, MarketGatewayState>`다.

- `result.state`: LIVE, REFERENCE, UNAVAILABLE.
- `result.data.series`.
- `result.data.label`.
- `result.data.unit`.
- `result.data.provider`.
- `result.data.aggregation`.
- `result.data.observationStart`.
- `result.data.observationEnd`.
- `result.data.points`.
- `result.data.attempts`.
- `result.meta.source`, `result.meta.provider`, `result.meta.asOf`, `result.meta.fetchedAt`, `result.meta.cache`, `result.meta.warnings`.
- `result.error`의 safe code/message/retryable.

point는 date, value, week를 가진다.

UNAVAILABLE이면 `result.data`는 null이며 data field에 접근하지 않는다.

request start 시 이전 payload를 null로 전환한다.

새 title 아래 이전 series chart가 잠시 남으면 실패다.

`result.data.series`가 request series와 다르면 discard한다.

unmount 또는 series change 시 stale response가 overwrite하지 못하게 한다.

## 41. Market provider and cache

| series | provider order | success cache |
|---|---|---|
| fx | ECB → Yahoo `KRW=X` → FRED `DEXKOUS` | max-age900, s-maxage3600, SWR86400 |
| oil | USDA/EIA → Yahoo `BZ=F` → FRED `DCOILBRENTEU` | same |
| bunker | USDA Daily Bunker Fuel Prices | same |
| harpex | approved HARPEX data-pack fixture | same |

provider timeout은 약 7초다.

모든 provider 실패는 no-store다.

FX는 ECB EUR cross-rate일 수 있다.

KNEI 승인 smoke fixture에서 FX latest는 1,427.048, date 2026-08-03이다.

market LIVE는 요청 기준기간 provider success를 뜻한다.

현재 시각의 실시간 quote라는 뜻이 아니다.

## 42. Market card visual contract

market card는 section과 role tabpanel을 가진다.

heading title은 `result.data.label` 또는 local metadata label이다.

description은 `result.data.provider`와 `result.meta.source`다.

right badge는 LOADING, LIVE, REFERENCE, UNAVAILABLE 중 하나다.

line chart height는 208px이다.

x-axis label은 `날짜`다.

y-axis label은 unit이다.

points는 주별 마지막 관측이다.

footer left는 latest value와 unit이다.

footer right는 aggregation과 latest observation date다.

chart y-domain은 series 값에 맞춘다.

두 card의 y-axis를 서로 공유하지 않는다.

### 42.1 Market exact computed geometry/color/type — MANDATORY

- market panel은 rows `auto minmax(0,1fr)`, gap 12px이다. selector는 §37의 two-row/4-tab geometry를 한 번만 렌더하고 card 안에 복제하지 않는다.
- 각 market card는 padding 18px, radius 18px, transparent 1px border, canvas `#f1f2f9`, shadows `10px 10px 24px rgba(21,38,157,.13)`와 `-10px -10px 24px rgba(255,255,255,.9)`다.
- heading은 flex/space-between, align-start, gap 14px, margin-bottom 14px다. title은 navy `#001290`, 18px/1.2, letter-spacing -.035em; description은 Dashboard final 11px/1.45, `#63666a`, margin-top 5px다.
- badge는 min-height 22px, padding `0 8px`, pill, 9px/900, letter-spacing .07em이다. LIVE=`#087352/#e5f7ef`, REFERENCE=`#6d28d9/#f0e9ff`, LOADING=`#52667a/#edf2f7`, UNAVAILABLE=`#9c3c3c/#fdeaea`다.
- plot SVG height는 208px이고 width는 ResizeObserver 실측값, 최소 logical width 320px이다. axis title이 둘 다 있으므로 padding은 top/right/bottom/left `24/24/52/82`; navigation이 없어 endpoint inset은 0이다.
- plot y-domain, 5 y-tick, 3–6 x-tick 수식은 §22.1과 같다. grid는 final `#d9dbe8` dashed `3 4`; Dashboard axis text는 `#718398`, 11px/650; axis title은 `#40556d`, 11px/850, letter-spacing .015em이다.
- market path는 3px, round cap/join이다. point radius는 일반 3.8px, last 5.5px, white stroke 2px이다. line color는 FX `#15269d`, Brent `#3fa1eb`, VLSFO `#008d83`, HARPEX `#7c3aed`다.
- footer는 flex/space-between, gap 10px, padding-top 11px, top border `rgba(99,102,106,.16)`, Dashboard final 10px, muted `#728398`; latest strong은 navy 14px이다.
- responsive row/column 전환은 §11.5와 같고 1440/1280/900/640/375 모두 selector order와 upper/lower DOM order를 유지한다.

### 42.2 Market state geometry — MANDATORY

LOADING, UNAVAILABLE, validated EMPTY는 chart/footer 자리에 같은 external-empty box를 쓴다: min-height 150px, centered grid, gap 7px, `#8a9aab`, center aligned. icon은 승인 Figma component 22px, strong은 `#415b72` 11px, helper는 Dashboard final 10px다.

- LOADING 시작과 series switch 순간에는 payload/chart/footer를 즉시 제거한다.
- LIVE/REFERENCE에서 points가 있으면 exact chart+footer를 렌더하고 state badge만 truthfully 다르게 한다.
- UNAVAILABLE은 chart/footer를 렌더하지 않으며 이전 series의 title/source/points/latest를 한 frame도 남기지 않는다.
- same slot의 request id/series가 현재 selection과 다르면 결과를 commit하지 않는다.
- 1440과 375는 detailed state crop을, 900과 640은 loading→ready 및 ready→unavailable 구조 smoke를 남긴다.

## 43. Market states

### 43.1 LOADING

badge는 LOADING이다.

card title은 selected metadata label이다.

description은 `외부 공개 데이터 연결`이다.

strong은 `시장 데이터를 불러오는 중입니다.`다.

helper는 `실제 공급원 응답을 기다리고 있습니다.`다.

이전 chart는 보이지 않는다.

### 43.2 LIVE

provider source가 표시된다.

weekly line chart가 표시된다.

latest value/date가 표시된다.

### 43.3 REFERENCE

`REFERENCE` badge가 표시된다.

line chart가 있으면 표시한다.

`REFERENCE` 성격을 숨기지 않는다.

### 43.4 UNAVAILABLE

`result.state=UNAVAILABLE`, `result.data=null`이다.

provider failure source는 `result.meta.source`에서 표시한다.

원인과 retry 가능성은 `result.error`에 진단값으로 보존한다. market card에는 별도 error paragraph나 retry action을 추가하지 않고 아래 strong/helper만 표시한다.

client request exception의 source는 `외부 공급원 연결 실패`다.

strong은 `외부 자료를 불러오지 못했습니다.`다.

helper는 `임의 수치 대신 연결 상태를 표시합니다.`다.

empty illustration/표시 문구가 표시된다.

synthetic chart를 그리지 않는다.

previous 다른 series chart를 유지하지 않는다.

### 43.5 EMPTY

WT6 validator가 허용한 non-UNAVAILABLE envelope에서 `result.data.points`가 0개인 fixture만 explicit empty다.

connection state와 empty data를 구분한다.

WT6가 `NO_VALID_DATA`를 UNAVAILABLE로 정규화한 경우에는 EMPTY를 합성하지 않고 UNAVAILABLE/error code에 맞는 verified-empty 표시 문구를 사용한다.

## 44. News panel heading exact contract

eyebrow은 `ROUTE NEWS WATCH`다.

title은 `{노선명} 항로 운임 영향 뉴스`다.

description은 `최근 30일 항로 뉴스를 우선하고, 부족할 때만 90일 범위의 B등급 보조자료로 최대 5건 표시`다.

heading action에는 state/source badge와 action button이 있다.

button labels는 세 개만 사용한다.

- `뉴스 수집`
- `뉴스 갱신`
- `갱신 중`

button min-height는 34px이다.

button padding은 0 12px이다.

button radius는 9px이다.

button은 blue background, white text, 9px/900이다.

loading 중 disabled와 spinner가 있다.

## 45. News request contract

뉴스는 최초 page 진입 때 자동 gateway request를 시작하지 않는다.

먼저 route cache를 읽는다.

cache가 없으면 IDLE이다.

사용자 click으로 typed `DataGateway.news` collection을 시작한다.

KNEI golden query는 `route={routeId}`, `asOf=latest`, `providerVersion=18`, `retry={0|1}`, optional `refresh={token}` 구조다.

`asOf`는 frozen query literal `latest`다. KCCI 데이터 팩 기준일을 news 검색 상한으로 재사용하지 않는다.

- server는 `latest`를 현재 UTC 시각으로 resolve하고 Google query에는 `when:90d`를 사용한다.
- primary admission은 resolve된 asOf의 최근 30일, fallback admission은 최근 90일이다.
- 이 최신 기사 목록은 News panel용이다. Insight serializer는 모델 기준일 이후 기사를 별도로 제외한다.

표시 상한 5건은 `latest` query가 아니라 v18 news contract의 고정 정책이다.

gateway transport cache mode는 no-store다.

gateway 결과는 `GatewayResultV1<NewsDataV1, NewsGatewayState>`다.

- `result.state`: LIVE 또는 UNAVAILABLE.
- `result.data.routeId`.
- `result.data.stage`: `FILTERED`.
- `result.data.llmAnalyzed`: false.
- `result.data.window`.
- `result.data.policy`.
- `result.data.stats`.
- `result.data.articles`.
- `result.data.attempts`.
- `result.meta.source`, `result.meta.asOf`, `result.meta.fetchedAt`, `result.meta.cache`, `result.meta.warnings`.
- `result.error`의 safe code/message/retryable.

UNAVAILABLE이면 `result.data=null`이다. zero-article와 provider failure는 `result.error.code`로 구분하고 null data에서 articles를 읽지 않는다.

news API 자체를 LLM analyzed라고 표시하지 않는다.

## 46. News collection algorithm

primary lookback은 30일이다.

5개 미만이면 90일 B-grade fallback을 허용한다.

maximum displayed articles는 5개다.

첫 LIVE `result.data.articles`가 5개 미만이거나 첫 result가 `UNAVAILABLE/NO_VALID_DATA`이면 retry=1을 한 번만 요청한다.

LIVE result가 하나 이상이면 두 LIVE result의 `data.articles` 중 article 수가 더 큰 것을 채택한다.

두 result가 모두 `UNAVAILABLE/NO_VALID_DATA`이면 `data=null`을 유지하고 verified empty state로 간다.

같은 수일 때는 **첫 응답 `retry=0`을 유지**한다. 선택식은 `retried.articles.length > first.articles.length ? retried : first`이며 `>=`가 아니다.

- retry가 더 많을 때만 retry payload 전체를 채택한다.
- 동률에서 fetchedAt, source, article id, alphabetic order로 추가 tie-break하지 않는다.
- first가 LIVE article 1개 이상이고 retry가 실패하면 first를 유지한다.
- 위 선택은 article merge가 아니라 payload 단위 선택이다. 두 응답의 기사를 합쳐 5개를 만들지 않는다.

기사 link canonicalization을 적용한다.

title normalize를 적용한다.

약 80% 유사 title은 duplicate 후보로 제거한다.

기사 전문을 저장하지 않는다.

title, short summary, source, date, 동결 계약의 article link와 분류만 저장한다.

항만 홍보나 다른 선종 기사로 5개를 강제로 채우지 않는다.

## 47. News cache contract

현재 key는 동결 cache namespace 아래 `route-news:v19:{routeId}` 의미구조다.

asOf를 v19 key에 넣지 않는다.

legacy key는 같은 동결 namespace 아래 `route-news:v18:{routeId}:{asOf}` 의미구조다.

legacy 중 최신 valid payload를 v19로 migrate할 수 있다.

route 변경 시 해당 route v19 cache를 읽는다.

cache schema validation에 실패하면 discard한다.

storage event를 listen해 다른 tab update를 반영한다.

기존 cached results가 있을 때 refresh failure로 cache를 지우지 않는다.

empty/UNAVAILABLE gateway result도 기존 larger cache를 파괴하지 않는다.

article이 하나 이상인 adopted LIVE gateway result만 v19 localStorage에 저장한다.

0-article payload는 새 cache로 persist하지 않는다.

adopted `result.state`가 LIVE가 아니면 error code에 따라 READY_EMPTY 또는 ERROR를 고르고 UI status를 숨기지 않는다.

news route cache를 전역 한 key로 합치지 않는다.

## 48. News state machine

| state | payload | surface | action |
|---|---|---|---|
| IDLE | none | collection 전 empty card | 뉴스 수집 |
| LOADING | none | spinner와 processing 표시 문구 | 갱신 중 disabled |
| READY | articles | stats+up to 5 articles | 뉴스 갱신 |
| READY_EMPTY | `UNAVAILABLE`, `data=null`, `error.code=NO_VALID_DATA` | verified empty 표시 문구 | 뉴스 수집/갱신 |
| LOADING_CACHED | cached articles | prior articles + persistence bar | 갱신 중 disabled |
| ERROR | none | unavailable source/error surface | 뉴스 수집 |
| ERROR_CACHED | cached articles | prior articles + failure badge/bar | 뉴스 갱신 |
| CACHED | storage payload on entry | articles immediately | 뉴스 갱신 |

cached refresh 중 blank panel로 바꾸지 않는다.

no-cache loading과 cached loading을 같은 screenshot으로 검수하지 않는다.

## 49. News state 표시 문구

### 49.1 loading without payload

strong: `노선 뉴스를 수집하고 정제하는 중입니다.`

helper: `항로·운임 관련성 필터와 URL·제목 유사도 중복 제거를 적용합니다.`

### 49.2 idle

strong: `아직 이 항로의 뉴스를 수집하지 않았습니다.`

helper: `버튼을 누르면 뉴스 수집·필터·중복 제거 후 왼쪽 예측 설명에서 Gemini 해석을 자동 생성합니다.`

### 49.3 verified empty

strong: `검증 가능한 운임 영향 기사가 없습니다.`

helper: `단순 항만 홍보나 다른 선종 기사로 5개를 채우지 않습니다.`

### 49.4 cached refresh failure

badge 표시 문구는 `갱신 실패 · 이전 데이터` 의미를 유지한다.

기존 article list와 fetched metadata를 보존한다.

## 50. News stats strip

READY payload에 stats가 있으면 four-cell strip을 표시한다.

known cells는 수집 후보, filter pass, duplicate removed와 최종 selection 의미다.

strip은 4 equal columns다.

gap은 1px이다.

border/radius는 1px/10px이다.

cell background는 pale surface다.

label은 8px 전후다.

value는 11px navy다.

API attempts raw payload를 사용자 card에 덤프하지 않는다.

## 51. News article visual and fields

각 article은 external link다.

target은 새 tab이다.

rel safety를 적용한다.

grid columns는 32px, 1fr, 18px이다.

index는 two-digit `01`~`05`다.

index frame은 28×28, radius 9px이다.

badge row에는 다음이 올 수 있다.

- grade `S · {gradeLabel}`
- grade `A · {gradeLabel}`
- grade `B · {gradeLabel}`
- direction text
- `검증 완료`
- `기간 직전 공지`

title은 최대 2 lines다.

summary는 최대 2 lines다.

metadata line은 impact signals 또는 factor, source, published date, optional effective date다.

reason line은 `선정 근거 · {reason}`이다.

right에는 chevron이 있다.

hover 시 title이 blue로 바뀐다.

## 52. News truthfulness disclaimer

card 하단에는 다음 의미를 유지한다.

- 선정 뉴스는 왼쪽 Gemini 해석의 보조 근거다.
- 뉴스는 model input이 아니다.
- 뉴스는 인과 근거가 아니다.
- model current date 이후 기사는 사후 monitoring용이다.
- S는 실제 가격·운항 변경이다.
- A는 직접 운영 영향이다.
- B는 시장 참고 자료다.
- search window가 있으면 기간을 표시한다.

기사 제목에서 인과를 확정적으로 재작성하지 않는다.

### 52.1 News full computed visual contract — MANDATORY

- lower grid는 1440/1280에서 two equal columns, gap 22px, margin-top 18px이고 `<=900`에서 one column이다. News card는 desktop/900 padding 22px, `<=640` padding 16px이다.
- heading은 §42.1의 section heading geometry/type을 공유한다. actions는 flex nowrap, align-center/end, gap 8px; badge는 max-width 210px, ellipsis/nowrap이고 button과 겹치지 않는다.
- collect button은 min-height 34px, padding `0 12px`, gap 7px, border `#0b72bc`, radius 9px, white on `#0072bc`, shadow `0 8px 18px rgba(0,114,188,.16)`, 9px/900이다. hover `#005f9f`, focus outline `3px rgba(0,114,188,.24)`/offset2, disabled opacity .64/cursor wait, spinner duration .85s linear이다.
- persistence bar는 flex wrap/space-between, gap 12px, margin `2px 0 10px`, padding `9px 11px`, radius 10px, `#526b80` on `#eef6fc`, inset border `#d9e8f3`, 9px다. left span gap 6px/nowrap, timestamp strong `#0b3156` 10px, helper flex basis 190px/right/line1.4다.
- stats strip은 four equal columns, gap 1px, margin `2px 0 8px`, 1px `#dbe7f0`, radius10/overflow hidden/background same. cell은 padding `9px 10px`, gap3, `#71869a` on `#f7fbfe`, 8px; b는 `#0b3156` 11px다.
- article row는 columns `32px 1fr 18px`, gap10, align-start, padding `14px 3px`, final divider `rgba(99,102,106,.15)`; last divider 0이며 middle child가 min-width 0을 가진다.
- index는 28×28, radius9, 9px/900, final blue `#15269d` on canvas `#f1f2f9`, shadows `4px 4px 9px rgba(21,38,157,.11)`와 reverse white다.
- badge row는 flex-wrap, gap5, margin-bottom6. 각 badge는 min-height18, padding `2px 7px`, pill, 7px/900/line1이다.
- badge palette는 exact하다: S `#a53819/#fff0e7`, A `#075c9a/#e8f4ff`, B `#596a7a/#eef2f5`, UP `#b83232/#fff0f0`, DOWN `#075fa8/#eaf5ff`, MIXED/NEUTRAL `#66531b/#fff8dd`, VERIFIED `#087352/#e8f8f2`, BOUNDARY `#9c5a08/#fff1d7`.
- title은 final `#2f2f36`, 11px/1.45, 2-line clamp; hover는 `#15269d`. summary는 Dashboard final 10px/1.45, margin `4px 0`, 2-line clamp. metadata와 reason은 Dashboard final 9px/1.45; reason margin-top5, `#62758a`다.
- disclaimer는 margin `12px 0 0`, padding `10px 12px`, radius9, final `#41516d` on `#e8edf8`, inset shadows, 9px/1.55다.

### 52.2 News visible-state composition — MANDATORY

| state | heading badge/action | body | persistence/stats/list | disclaimer |
|---|---|---|---|---|
| IDLE | INPUT/`수집 전`, `뉴스 수집` | 150px externalEmpty + §49.2 | 없음 | 유지 |
| LOADING cold | LOADING/`갱신 중`, disabled | spinner 24px + §49.1 | 없음 | 유지 |
| READY | LIVE/source, `뉴스 갱신` | 없음 | persistence + optional stats + max 5 rows | 유지 |
| LOADING_CACHED | LOADING/`갱신 중`, disabled | blank replacement 없음 | 기존 persistence/stats/list 유지; bar helper는 직전 결과 유지 표시 문구 | 유지 |
| ERROR_CACHED | UNAVAILABLE/`갱신 실패 · 이전 데이터`, `뉴스 갱신` | blank replacement 없음 | 기존 persistence/stats/list 유지; failure helper | 유지 |
| verified empty | INPUT/`payload.source`, collect action | 150px externalEmpty + §49.3 | 없음 | 유지 |
| CACHED entry | cached payload의 truthful source state, `뉴스 갱신` | 없음 | 즉시 persistence/stats/list | 유지 |

- `externalEmpty` geometry/type은 §42.2와 같고 News icon/spinner는 24px이다.
- card 높이를 맞추려고 fake skeleton row나 placeholder article을 추가하지 않는다.
- 1440과 375는 IDLE, cold loading, ready, cached refresh/error를 detailed capture한다. 900과 640은 동일 state가 blank/overlap/overflow 없이 전환되는 smoke다.

## 53. Insight panel heading exact contract

eyebrow은 `AUTO INSIGHT`다.

title은 `예측 방향 자동 설명`이다.

description은 `정량 예측과 검증 뉴스를 함께 해석`이다.

panel은 news panel 왼쪽이다.

panel은 aria-busy를 loading과 연결한다.

badge labels는 상태에 따라 다음 중 하나다.

- `분석 중`
- `Gemini 해설`
- `규칙형 해설`
- `Gemini 연결 중`
- `해석 대기`

## 54. Insight trigger boundary

news article이 없으면 external insight request를 시작하지 않는다.

news READY 후 request를 시작한다.

selected horizon이 바뀌면 cache key와 request를 재평가한다.

representative model이 바뀌면 재평가한다.

forecast path가 바뀌면 재평가한다.

route가 바뀌면 이전 request를 abort한다.

stale response가 새 route panel을 overwrite하지 못한다.

## 55. Insight request contract

method는 POST다.

WT2는 typed `DataGateway.insight`만 호출하며 page/component의 raw POST는 금지한다.

gateway transport cache mode는 no-store다.

body semantic fields는 다음과 같다.

- route
- current date/value
- selectedHorizon
- direction
- selected forecast point/PI90
- forecastPath 1..4
- representative model
- modelAgreement up/down/flat/total
- news

field source는 고정한다.

- `current`는 `RepresentativeSelectionV1.currentObservation`이다.
- selected forecast/PI90는 `forecasts[horizon]`, representative metric은 `metricsByHorizon[horizon]`이다.
- `modelAgreement` count는 `modelAgreementByHorizon[horizon]`의 up/down/flat/total이다. WT2가 8 members에서 다시 count하지 않는다.
- manual notice용 automatic model은 `automaticChampion`이다.
- Insight request body와 cache key에는 `representativeRevision`이 없다. request identity는 route ID, current date, selected horizon, selected model ID, news fetchedAt의 고정 조합을 사용한다.
- `representativeRevision`을 cache key에 추가하는 것은 별도 stale-cache hardening이므로 사용자 승인과 cache migration fixture 없이는 구현하지 않는다.
- 위 값을 원시 데이터/tuning localStorage나 별도 score projection으로 다시 계산하지 않는다.

news는 publishedAt이 currentDate 이하인 것만 전달한다.

look-ahead article을 forecast explanation 근거로 보내지 않는다.

news article payload는 필요한 short fields만 보낸다.

## 56. Insight response contract

gateway 결과는 `GatewayResultV1<InsightDataV1, InsightGatewayState>`다.

`result.state`는 `LLM`, `DERIVED`, `UNAVAILABLE` 중 하나다.

`result.data.engine`은 `GEMINI`, `RULE_FALLBACK` 중 하나다.

non-UNAVAILABLE에서 다음 field는 모두 `result.data.*`다.

- model
- generatedAt
- headline
- summary
- confidence `높음|보통|낮음`
- quantitativeBasis array
- upwardFactors array
- downwardFactors array
- caution

source, asOf, fetchedAt, cache, warnings는 `result.meta.*`에서 읽는다.

UNAVAILABLE이면 `result.data=null`이고 실패 이유와 retry 가능성은 `result.error`에서 읽는다.

provider order는 Gemini, deterministic rule fallback이다.

Gemini timeout은 약 25초다.

LLM key가 없어도 rule fallback으로 deterministic core가 동작해야 한다.

## 57. Insight cache contract

LLM success만 저장한다.

key는 동결 cache namespace 아래 `forecast-insight:v1:{routeId}:{currentDate}:{horizon}w:{modelId}:{newsFetchedAt}` 의미구조다.

RULE_FALLBACK은 장기 저장하지 않는다.

cache schema를 validate한다.

cached LLM을 찾으면 network request 전에 사용한다.

news fetchedAt이 바뀌면 다른 key다.

horizon이 바뀌면 다른 key다.

model이 바뀌면 다른 key다.

## 58. Insight visual structure

topline에는 direction pill만 있다. response의 `confidence` field는 visible UI에 렌더하지 않는다. confidence를 새 label로 활성화하면 unapproved visible addition이다.

direction pill은 상승/하락/보합 tone이다.

headline은 14px, navy, line-height 1.5다.

summary는 13px/650, line-height 1.8다.

evidence grid는 two columns다.

left box heading은 `정량 근거`다.

right box heading은 `뉴스 신호`다.

upward factor는 `상방` label을 쓴다.

downward factor는 `하방` label을 쓴다.

factor에는 source external link가 있다.

news factor가 없으면 직접 연결할 검증 뉴스가 없다는 표시 문구를 보인다.

model note가 representative model을 설명한다.

method notice가 caution과 engine 성격을 설명한다.

manual representative면 자동 선정 1위도 helper에 밝힌다.

### 58.1 Insight exact computed geometry/color/type — MANDATORY

- card는 desktop/900 padding 22px, `<=640` 16px이고 shared 18px radius/canvas/neumorphic surface다. lower-grid 위치·breakpoint는 §52.1과 같다.
- topline은 flex/center/space-between, gap12; `<=640`에서는 column/align-start다.
- direction pill은 width max-content, inline-flex/center, gap10, padding `10px 14px`, radius12. icon은 20px, value는 15px/900, small은 Dashboard final 9px/750/opacity .72다.
- direction palette는 상승 `#a43d3d/#fff0ee`, 하락 `#087352/#e8f7f0`, 보합 `#735900/#fff5d7`이다.
- headline은 block, margin-top17, navy, 14px/1.5. summary는 margin `8px 0 17px`, `#344d63`, 13px/650/1.8이다.
- payload가 있을 때만 evidence grid를 렌더한다: 2 equal columns, gap10, margin-bottom12; `<=640` 1 column. box는 padding12, border `#dce7f0`, radius11, background `rgba(248,251,253,.82)`.
- evidence heading은 flex/center, gap6, navy 10px/850. list는 gap6, margin `9px 0 0`, padding-left15. li/p는 `#526a7f`, 9px/1.5. source link는 margin-left5, blue, 8px/800, underline/offset2다.
- model note는 flex/center, gap12, padding13, radius12, final transparent border/canvas, shadows `5px 5px 12px rgba(21,38,157,.1)`와 reverse white. accent rail은 width7/stretch; strong 11px navy, detail은 Dashboard final 10px.
- method notice는 margin `12px 0 0`, padding `10px 12px`, radius9, final `#41516d/#e8edf8`, inset shadows, 9px/1.55다.

### 58.2 Model note and method notice 표시 문구 composition

model note line 1은 `{사용자 선택 대표 모델|자동 대표 모델} · {modelName}`다.

line 2는 `{N}주 MAPE {mapePct.toFixed(1)}% · MSE {mse locale integer} · MASE {mase.toFixed(2)} · 종합 {totalScore.toFixed(1)}점`이다. 네 metric은 같은 selected horizon row에서 읽는다.

method notice는 `payload.caution`이 있으면 그것을, 없으면 `뉴스는 예측의 직접 인과 근거가 아니라 방향을 설명하는 보조 신호로만 사용합니다.`를 먼저 쓴 뒤 다음 suffix 하나를 붙인다.

- RULE_FALLBACK: `현재는 LLM 연결 없이 동일 입력을 규칙형으로 종합했습니다.`
- payload 있음: `{payload.model ?? "LLM"}이 입력된 정량 데이터와 기사 ID만 사용해 해석했습니다.`
- payload 없음 + news 있음: `정제된 뉴스가 준비되어 Gemini 자동 해석을 실행하고 있습니다.`
- payload 없음 + news 없음: `뉴스를 수집하면 Gemini 자동 해석을 실행합니다.`
- manual mode이면 마지막에 `자동 선정 1위는 {automaticChampion.modelName}입니다.`를 붙인다.

## 59. Insight states

### 59.1 WAITING

badge는 `해석 대기`다.

default direction/readout summary는 deterministic forecast로 보인다.

helper는 뉴스를 수집하면 해석한다고 설명한다.

### 59.2 CONNECTING

news가 있고 request 시작 전/초기면 `Gemini 연결 중`이다.

stale unrelated insight를 표시하지 않는다.

### 59.3 LOADING

badge는 `분석 중`이다.

aria-busy true다.

### 59.4 LLM GEMINI

badge는 `Gemini 해설`이다.

`result.data`의 headline/summary/evidence/caution을 보인다.

### 59.5 DERIVED

badge는 `규칙형 해설`이다.

rule fallback임을 notice에서 명시한다.

### 59.6 CACHED

saved LLM을 즉시 표시한다.

화면에 임의 CACHED badge를 추가하지 않고 engine badge를 유지한다.

### 59.7 UNAVAILABLE

- `result.state=UNAVAILABLE`, `result.data=null`이다.
- visible composition은 payload가 없는 deterministic headline/summary, direction pill, model note, method notice를 유지한다. evidence grid는 렌더하지 않는다.
- news가 있으면 badge text는 `Gemini 연결 중`, news가 없으면 `해석 대기`다. 승인 Figma/PNG에 없는 UNAVAILABLE banner, error paragraph, retry button, confidence label을 추가하지 않는다.
- `result.error`는 typed gateway의 진단/stale-control에 쓰되 이번 visible surface에 새 문구를 만들지 않는다.
- retained cached LLM이 동결 cache key로 조회되면 기존 LLM content/engine badge를 표시한다. 임의 cache warning bar를 추가하지 않는다.

### 59.8 Visible-state composition invariant

| condition | badge text | headline/summary | evidence | model/method |
|---|---|---|---|---|
| news 없음, payload 없음 | `해석 대기` | deterministic fallback | 없음 | 항상 표시 |
| news 있음, request 전/실패 후 payload 없음 | `Gemini 연결 중` | deterministic fallback | 없음 | 항상 표시 |
| request loading | `분석 중` | 직전 payload가 없으면 deterministic fallback | payload가 있으면 승인 lifecycle대로 유지, 없으면 없음 | 항상 표시 |
| Gemini LLM | `Gemini 해설` | payload | 2 boxes | 항상 표시 |
| rule fallback | `규칙형 해설` | payload | 2 boxes | 항상 표시 + rule suffix |
| cached LLM | engine에 맞는 기존 badge | cached payload | 2 boxes | 항상 표시 |

state를 설명하려고 새 skeleton, status strip, retry action 또는 error card를 추가하면 실패다.

## 60. Current-route history dialog trigger

hero title 옆 `!`로 연다.

open state에서 trigger aria-expanded는 true다.

dialog는 body portal이다.

overlay click은 dialog 바깥 target일 때만 닫는다.

X click으로 닫는다.

Escape로 닫는다.

open 동안 body scroll을 lock한다.

close 시 이전 body overflow를 복원한다.

close 다음 animation frame에 original `!` trigger로 focus를 되돌린다.

dialog close button은 autoFocus된다.

## 61. History dialog geometry

overlay z-index는 1400이다.

overlay padding은 desktop 20px이다.

overlay background는 `rgba(0,24,58,.64)`다.

overlay blur는 8px이다.

dialog width는 `min(1180px,100vw-40px)`다.

dialog max-height는 `100vh-40px`다.

dialog radius는 24px이다.

dialog background는 `#f5f8fc`다.

dialog shadow는 `0 30px 90px rgba(0,18,47,.38)`다.

head padding은 22px 26px 18px이다.

body max-height는 `100vh-154px`다.

body padding은 20px 26px 22px이다.

dialog animation은 260ms cubic-bezier(.2,.8,.2,1) scale/translate fade다.

reduced-motion에서는 overlay/dialog animation을 제거한다.

## 62. History dialog exact heading

eyebrow pattern은 `FULL ROUTE HISTORY · {routeId}`다.

H2 pattern은 `{노선명} 과거 운임 추이·주요 사건`이다.

helper pattern은 `{firstDate}~{lastDate} · 주간 {N}개 관측값 · USD/FEU`다.

KNEI 기준 N은 187이다.

close aria-label은 `과거 운임 창 닫기`다.

H2는 24px desktop이다.

close는 42×42 circular button이다.

hover/focus는 blue tone, slight rotate, visible outline이다.

## 63. History KPI row

KPI는 four columns다.

항목은 다음이다.

1. 마지막 운임
2. 최근 52주 최고
3. 최근 52주 최저
4. 전체기간 변화

각 KPI는 white card다.

padding은 14px 16px이다.

radius는 14px이다.

label은 10px/800이다.

value는 20px/900이다.

up/down color는 승인 history tone을 따른다.

최근 52주는 observation 기준으로 계산한다.

full change는 first to latest다.

## 64. History chart

chart heading eyebrow은 `KCCI WEEKLY FREIGHT RATE`다.

chart title은 `주간 운임과 사건 발생 시점` 의미다.

chart fixed height는 360px이다.

chart container min-width는 640px이다.

narrow dialog에서는 horizontal scroll을 허용한다.

pad는 top56, right24, bottom48, left72 의미다.

line color는 `#0879c0`이다.

line width는 3px이다.

latest point는 blue fill, white stroke다.

hover는 crosshair와 date/value tooltip을 보인다.

tooltip value는 `/ FEU`를 포함한다.

## 65. History event interaction

toggle label은 `주요 사건 ON` 또는 `주요 사건 OFF`다.

toggle은 aria-pressed를 가진다.

history dialog의 first mount와 route change에서는 eventsVisible을 true로 두고 첫 event를 선택한다.

같은 route에서 dialog만 닫았다 다시 열면 toggle과 active event를 보존한다.

event marker는 orange diamond와 vertical dashed line이다.

marker hit target은 transparent하고 focusable하다.

marker hover는 event를 선택한다.

marker focus는 event를 선택한다.

marker Enter/Space는 selection 동작을 제공해야 한다.

selected marker는 darker orange와 stronger line이다.

chart legend는 KCCI line과 주요 사건을 구분한다.

helper는 line hover로 weekly value를 확인한다고 설명한다.

## 66. History event list/detail

left panel eyebrow은 `EVENT TIMELINE`이다.

count 표시 문구는 `이 항로의 주요 사건 {N}건`이다.

event card columns는 date 72px, text 1fr, chevron 18px이다.

selected card는 orange inset indicator와 pale orange background다.

detail은 date/source, title, summary, external source link를 가진다.

external link 표시 문구는 `원문 출처 보기`다.

KCI와 KJI는 verified event가 없다.

이 경우 strong은 `검증해 표시할 사건이 없습니다.` 의미다.

helper는 근거 불명확 사건을 임의 추가하지 않는다고 설명한다.

detail empty는 `선택된 사건이 없습니다.` 의미다.

### 66.1 Exact verified event catalog

승인 event catalog에는 10개 event가 있다.

| id | date | short/title | affected routes | source |
|---|---|---|---|---|
| panama-drought-2023 | 2023-08-08 | 파나마 통항 제한 / 파나마운하 가뭄·통항 제한 | KUEI | Panama Canal Authority |
| red-sea-2023 | 2023-12-19 | 홍해·희망봉 우회 / 홍해 위기·희망봉 우회 | KNEI, KMDI, KMEI | Maersk |
| capacity-crunch-2024 | 2024-05-13 | 2024 선복 압박 / 홍해 우회·혼잡·조기 성수기 | KUWI, KUEI, KNEI, KMDI, KAUI, KLEI, KLWI | Freightos |
| africa-surge-2024 | 2024-05-13 | 아프리카 급등 / 홍해 우회 여파·아프리카 운임 급등 | KSAI, KWAI | UNCTAD |
| singapore-congestion-2024 | 2024-05-30 | 싱가포르 혼잡 / 싱가포르 선박 몰림·항만 혼잡 | KSEI | Maritime and Port Authority of Singapore |
| tariff-frontloading-2025 | 2025-05-12 | 관세 유예·선적 러시 / 미·중 관세 유예·선적 앞당김 | KUWI, KUEI | C.H. Robinson |
| south-america-east-gri-2025 | 2025-06-01 | 남미동안 GRI / 극동발 남미동안 운임인상(GRI) | KLEI | Hapag-Lloyd |
| south-america-west-delay-2025 | 2025-06-02 | 남미서안 선복 축소 / 남미서안 항만 지연·선복 축소 | KLWI | C.H. Robinson |
| hormuz-2026 | 2026-03-01 | 호르무즈 운항 중단 / 호르무즈 해협 운항 중단·우회 | KMEI | Maersk |
| early-peak-2026 | 2026-06-02 | 2026 조기 성수기 / 조기 성수기·6월 운임인상 | KUWI, KUEI, KNEI, KMDI | Freightos |

event summary와 source link identity는 승인 데이터 팩의 event catalog에서 읽는다.

위 표에 없는 사건을 화면 밀도를 채우기 위해 추가하지 않는다.

KCI와 KJI에는 affected event가 0개다.

| route | expected event count |
|---|---:|
| KUWI | 2 |
| KUEI | 4 |
| KNEI | 3 |
| KMDI | 3 |
| KMEI | 2 |
| KAUI | 1 |
| KLEI | 2 |
| KLWI | 2 |
| KSAI | 1 |
| KWAI | 1 |
| KCI | 0 |
| KJI | 0 |
| KSEI | 1 |

## 67. History disclaimer

표시 문구는 다음과 같다.

`주황색 표시는 사건과 운임 변동 시점이 겹친다는 뜻이며, 해당 사건이 운임 변화를 단독으로 일으켰다는 인과관계를 의미하지 않습니다.`

이를 “사건 때문에 운임이 변했다”로 축약하지 않는다.

## 68. History responsive contract

900px 이하 overlay padding은 10px이다.

dialog width는 viewport-20px이다.

dialog max-height는 viewport-20px이다.

dialog radius는 19px이다.

body max-height는 viewport-132px이다.

body padding은 16px이다.

KPI는 two columns다.

event section은 one column이다.

620px 이하 head padding은 17px 17px 14px이다.

H2는 19px이다.

helper는 10px이다.

close는 38×38이다.

event card date column은 66px이다.

## 68.1 전체 그래프 승인 기준

current-route 전체 이력과 13개 전체노선 그래프는 승인 Figma/PNG 및 승인 데이터 팩에서 생성한 경량 fixture를 함께 기준으로 사용한다.

- title: `KCCI 13개 항로 운임 추이`
- series: KCCI 13개 노선, 2022-11-07~2026-08-03 주간 운임, USD/FEU
- interaction: 독립 Y축, latest point/value, pointer crosshair, 보간 tooltip, 주요 사건 ON/OFF, 사건 hover/focus tooltip, 근거·출처 details
- responsive layout: desktop 3열, 820px 이하 2열, 520px 이하 1열

topbar `전체 노선`은 승인된 13개 small-multiple 구성·순서·표시 문구·사건·출처·tooltip 동작을 구현한다.

전망 영역 옆 `!`로 여는 current-route 전체 이력은 같은 데이터 팩 projection에서 선택 route series와 해당 route event만 사용한다. 13개 grid를 그대로 넣지 않고, 선택 route 한 개를 확대해 current-route history dialog 계약에 맞춘다.

WT6가 승인 데이터 팩의 KCCI weekly 및 route-event table을 동결 계약의 경량 fixture로 생성하고, WT2는 runtime validation을 통과한 fixture를 렌더한다. 서로 다른 생성 결과가 나오면 조용히 한쪽을 선택하지 않고 route/date별 검증 보고서로 해소한 뒤 contract를 동결한다.

## 69. All-routes trigger and lifecycle

topbar `전체 노선` button으로 연다.

open state에서 aria-expanded true다.

dialog는 body portal이다.

X, overlay click, Escape로 닫는다.

open 동안 body scroll을 lock한다.

close 시 original topbar trigger로 focus를 되돌린다.

close button은 autoFocus된다.

all-routes dialog는 매 open마다 eventsVisible을 true로 reset한다.

dialog를 route selector로 사용하지 않는다.

mini chart click으로 current route를 변경하지 않는다.

## 70. All-routes dialog geometry

overlay z-index는 1500이다.

overlay desktop padding은 18px이다.

overlay background는 `rgba(0,24,58,.67)`다.

overlay blur는 9px이다.

dialog width는 `min(1580px,100vw-36px)`다.

dialog max-height는 `100vh-36px`다.

dialog radius는 24px이다.

dialog background는 `#f2f6fb`다.

dialog shadow는 `0 34px 100px rgba(0,18,47,.42)`다.

head padding은 18px 24px 16px이다.

body max-height는 `100vh-132px`다.

body padding은 14px 20px 20px이다.

grid desktop은 three columns다.

grid gap은 14px이다.

## 71. All-routes exact heading and notice

eyebrow은 `ALL KCCI ROUTES · 13`이다.

H2는 `KCCI 13개 항로 운임 추이`다.

helper는 `{firstDate}~{latestDate} · 주간 187개 관측값 · 각 그래프 독립 Y축 · USD/FEU` 의미다.

toggle은 `주요 사건 ON/OFF`다.

notice 표시 문구는 다음과 같다.

`주황색 표시는 공신력 있는 자료와 운임 변동 시점이 겹치는 주요 사건입니다. 단독 인과관계를 뜻하지 않습니다.`

sources summary는 `표시된 주요 사건 {N}건의 근거·출처 보기`다.

승인 event catalog에서 N은 10이다.

## 72. All-routes card exact contract

13 cards는 route registry order다.

card는 route name과 route code를 표시한다.

latest date를 표시한다.

latest value를 표시한다.

change tone을 표시한다.

각 card는 독립 y-axis다.

chart viewBox 의미는 480×208이다.

pad는 top34, right14, bottom28, left52다.

line은 `#0072bc`, width 2.2다.

line 아래에는 동일 blue의 20%→1.5% vertical gradient area가 있다.

latest halo와 point가 있다.

rate hover는 crosshair와 date/value tooltip을 연다.

event marker는 focusable orange diamond다.

event hover/focus는 event date/source/title tooltip을 연다.

event hover 시 rate hover를 clear한다.

all-routes marker의 동결 keyboard contract는 Tab focus로 tooltip을 노출하는 것이다.

관찰용 marker이므로 Enter/Space로 route를 바꾸거나 dialog를 닫지 않는다.

card 자체는 route 선택 button이 아니다.

## 73. All-routes sources details

details는 grid 아래에 있다.

details background는 white다.

radius는 13px이다.

desktop source list는 two columns다.

각 item은 date, title, affected route names, source external link를 가진다.

source link pattern은 `{source} 원문`이다.

640px 이하 source list는 one column이다.

승인된 source link identity가 없는 event를 임의 생성하지 않는다.

## 74. All-routes responsive contract

1200px 이하 grid는 two columns다.

900px 이하 dialog width는 min(760px, viewport-24px)다.

900px 이하 overlay padding은 12px이다.

900px 이하 grid는 one column이다.

640px 이하 head는 align-start, padding 14px이다.

640px 이하 H2는 19px이다.

640px 이하 helper는 9px이다.

640px 이하 controls는 column-reverse다.

640px 이하 toggle min-height는 32px이다.

640px 이하 close는 34×34이다.

640px 이하 body padding은 10px이다.

reduced-motion에서는 overlay/dialog animation이 없다.

## 75. Dashboard interaction inventory

| control | hover | focus | click/pointer | keyboard |
|---|---|---|---|---|
| route selector | native/visual border | visible ring | route change | native select |
| `!` | blue fill | blue fill+ring | history open | Enter/Space |
| chart point | tooltip | series/point semantics | hover only | Escape clear |
| chart canvas | grab | visible focus | wheel/drag/dblclick | +,=,-,arrows,Home,End,Esc |
| horizon | selected/hover | inset cyan ring | horizon change | Tab+Enter/Space |
| market tab | active/hover | visible ring | select/swap | Tab+Enter/Space |
| news collect | darken | visible ring | collect/refresh | Enter/Space |
| news article | title blue | visible link focus | new tab | Enter |
| history event marker | stronger orange | stronger orange | select | Enter/Space로 select |
| all-routes event marker | stronger orange | tooltip 노출 | hover/focus only | Tab focus; route action 없음 |
| dialog X | blue/rotate | visible ring | close | Enter/Space |
| overlay | none | none | target-self close | Escape via window |

## 76. Animation contract

chart series opacity/stroke transitions are 180ms where present.

toolbar hover transition is about 150ms.

button/card interactions use 150~180ms.

news spinner rotates in 850ms linear loop during loading only.

history overlay fade is 200ms.

history dialog entrance is 260ms.

all-routes dialog entrance is 280ms.

reduced-motion removes dialog and series transitions.

data change로 chart가 과도하게 재생되는 animation을 추가하지 않는다.

drag에는 inertia를 발명하지 않는다.

## 77. Accessibility contract

main chart SVG is focusable.

main chart aria-label이 wheel/drag를 설명한다.

toolbar range는 aria-live polite다.

horizon은 radiogroup/radio다.

market rows는 tablist/tab이다.

dialog는 role dialog, aria-modal true다.

dialog heading id를 aria-labelledby로 연결한다.

close button accessible name을 제공한다.

event marker는 accessible label에 date/title을 포함한다.

승인 dialog contract는 initial close-button focus와 trigger focus return은 제공하지만 완전한 Tab focus trap은 제공하지 않는다.

focus trap을 추가하면 post-parity accessibility enhancement로 별도 검증한다.

news external link는 keyboard reachable이다.

focus return은 두 dialog 모두 필수다.

body scroll lock 해제 누락은 accessibility failure다.

tooltip만으로 필수 data를 숨기지 않는다.

PI90와 coverage는 readout에서도 읽을 수 있다.

## 78. Loading, empty, error, cached global matrix

| resource | loading | empty | error | cached | ready |
|---|---|---|---|---|---|
| deterministic data pack | scoped boot | core data empty | schema error | bundled asset | 187 points |
| representative | WT3 selector resolve | no valid selection | selector/path contract error | WT3-owned manual state reflected | `RepresentativeSelectionV1` 1~4 path |
| market slot | spinner/metadata title | 0 points | UNAVAILABLE | HTTP cache | LIVE/REFERENCE chart |
| route news | processing 표시 문구 | verified no articles | error/no cache | v19 articles retained | up to 5 articles |
| insight | analysis state | waiting without news | rule fallback | saved LLM | LLM/DERIVED content |
| history events | chart still ready | KCI/KJI event empty | catalog fault | static catalog | markers/list |
| dialogs | entrance | event empty allowed | render error boundary | data already local | interactive |

각 resource state는 다른 resource를 가리지 않는다.

## 79. Data flow sequence

1. WT1 shell이 valid routeId를 제공한다.
2. WT6 transport의 승인 데이터 팩 projection을 검증하고 current route actual 187 points를 선택한다.
3. 현재 route로 WT3 selector가 생산한 `RepresentativeSelectionV1`을 받는다.
4. WT2는 route/currentObservation, selected identity/version, automaticChampion, provenance/protocol/revision, forecast 4개, metric 4개, agreement 4×8을 검증하며 champion/tuning merge·metric/agreement 재계산은 실행하지 않는다.
5. selection의 동일 model 1~4주 forecast/error bars를 chart에 전달한다.
6. default horizon 1주 readout을 만든다.
7. typed `DataGateway.market`으로 upper fx, lower oil 결과를 독립 요청한다.
8. route v19 news cache를 읽는다.
9. cache가 없으면 news IDLE을 유지한다.
10. cache가 있으면 news와 eligible insight cache를 표시한다.
11. 사용자 collection 시 `DataGateway.news`에 literal `asOf=latest`를 전달한다.
12. LIVE `result.data.articles`를 filter/dedupe 후 retained cache 정책으로 채택한다.
13. eligible news가 있으면 `DataGateway.insight`에 currentDate 이하 article만 전달한다.
14. 각 resource UI는 `result.state`, `result.data`, `result.meta`, `result.error`를 서로 섞지 않고 소비한다.
15. history/all-routes dialog는 validated local data-pack fixture에서 그린다.

## 80. LocalStorage and query contract

WT2가 직접 소비하는 keys는 동결 계약의 다음 의미구조다.

- WT1-owned route key
- `route-news:v19:{routeId}`
- legacy route-news v18 keys
- `forecast-insight:v1:{route}:{date}:{horizon}w:{model}:{newsFetchedAt}`

WT3-owned tuning/representative keys는 WT2가 직접 읽거나 parse하지 않는다. 그 변화는 WT3 selector가 새 `RepresentativeSelectionV1`을 발행하는 방식으로만 WT2에 전달된다.

route query가 valid하면 storage보다 우선한다.

route change는 location query와 route storage를 갱신한다.

WT2는 tuning/representative payload schema를 읽거나 변경하지 않는다.

news만 cross-tab storage event 동기화를 명시적으로 가진다.

storage parse error는 page crash가 아니라 해당 cache miss다.

storage quota error로 deterministic core가 깨지면 안 된다.

## 81. Network and race safety

market series change는 이전 typed gateway result를 ignore한다.

route news collection은 이전 route gateway request를 abort한다.

route change 중 old cached news를 새 route 아래 표시하지 않는다.

insight route/horizon/model/news key change는 이전 gateway request를 abort한다.

late response는 current key와 일치할 때만 commit한다.

gateway result가 runtime validation에 실패하면 해당 resource를 UNAVAILABLE/error로 만들고 raw payload를 부분 사용하지 않는다.

page/component 안에 market/news/insight transport request를 조립하는 두 번째 path가 있으면 P0다.

refresh double click은 loading disabled로 중복 요청을 막는다.

news retry는 최대 한 번이다.

provider timeout은 UI 전체를 block하지 않는다.

## 82. No synthetic fallback policy

deterministic core는 approved bundled data-pack projection만 사용한다.

market failure는 empty/unavailable card로 표시한다.

news failure는 cache를 보존하거나 error를 표시한다.

insight LLM failure는 deterministic rule fallback을 사용할 수 있다.

rule fallback은 fake LLM이 아니다.

rule fallback badge와 notice를 명시한다.

시장 line을 random points로 채우지 않는다.

뉴스를 sample headline으로 채우지 않는다.

history event를 추정으로 추가하지 않는다.

## 83. 절대 임의축약 금지사항

- actual 187 points를 최근 8개 point로 축약 금지
- 13 route를 일부 route로 축약 금지
- 8 model registry를 3 model로 축약 금지
- 1~4주 path를 1주만 표시 금지
- PI90 네 error bar를 하나의 단일 band로 대체 금지
- `!`를 tooltip icon으로 변경 금지
- wheel anchor zoom 생략 금지
- horizontal drag 생략 금지
- 6px gesture threshold 생략 금지
- keyboard `+`, `=`, `-` 생략 금지
- Arrow/Home/End/Escape 생략 금지
- y-domain viewport recompute 생략 금지
- endpoint inset 생략 금지
- horizon change 때 viewport reset 금지
- market slot 중복 허용 금지
- market switch 중 stale payload 표시 금지
- UNAVAILABLE에 synthetic chart 금지
- news 자동 fetch 금지
- news cache refresh 중 blank 처리 금지
- news 5개 강제 채움 금지
- insight에 currentDate 이후 news 전달 금지
- rule fallback을 LLM badge로 표시 금지
- history dialog를 작은 tooltip로 축약 금지
- all-routes dialog를 route list로 축약 금지
- all-routes card click으로 route 변경 금지
- dialog focus return/scroll lock 생략 금지
- 인과관계 disclaimer 축약 금지

## 84. Clean-room deviation risks와 재발금지

다음 구현 편차를 허용하지 않는다.

- 승인 데이터 팩과 다른 단순 gateway·fixture를 사용해 187/13/8/4 invariant를 깨뜨리는 것
- PI90을 horizon별 error bar hierarchy 대신 연속 polygon band로 바꾸는 것
- SVG 비율 처리로 chart geometry를 늘이거나 찌그러뜨리는 것
- keyboard handler에서 `+`와 `-` parity를 빠뜨리는 것
- readout을 여러 개별 tile이나 추가 model version/score로 바꿔 세 article hierarchy를 깨뜨리는 것
- all-routes observational surface에 route 선택 action을 추가하는 것
- 승인 Figma/PNG에 없는 mobile fixed action이나 provenance 문장을 추가하는 것

재발 방지 gate:

- Figma/PNG 및 데이터 팩 식별자 동결
- 187/13/8/4 invariant test 선행
- KNEI smoke fixture 선행
- chart interaction matrix 전부 통과
- readout DOM hierarchy PNG 확인
- all-routes observational-only test
- unapproved visible UI inventory 0건

## 85. 단계별 구현과 commit 계획

### Phase 0 — clean-room authority/data freeze

산출물:

- 승인 Figma frame과 PNG state inventory
- 승인 데이터 팩 버전 및 fixture generation report
- event catalog validation report
- `RepresentativeSelectionV1` contract fixture validation
- WT3 projection field audit: currentObservation, automaticChampion, forecasts, metricsByHorizon nested Coverage, modelAgreementByHorizon registry-order 8 members, representativeRevision
- `GatewayResultV1<TData, TState>` market/news/insight fixture validation
- canonical query ledger
- state별 PNG 기준 inventory
- visible 표시 문구 ledger
- Dashboard visible-inventory ledger; absent UI ledger에는 rich PI90/Coverage tooltip, insight confidence, explicit insight error/retry UI를 기록

commit intent: `docs(wt2): freeze dashboard clean-room contracts`

acceptance:

- Figma/PNG, 데이터 팩, 동결 계약 식별자와 승인 기록 존재
- 187/13/8/4 invariant 확인
- KNEI smoke 확인
- WT3/WT6 contract fixtures runtime validation 통과
- WT2와 WT3 `RepresentativeSelectionV1` fixture가 동일 schema/property/value 계약을 통과하고 visible inventory에 unapproved addition 0건

### Phase 1 — shell integration and deterministic consumers

산출물:

- dashboard route entry
- WT1 AppShell consumption
- WT3 `RepresentativeSelectionV1` consumer
- WT6 approved data-pack projection consumer
- local horizon presentation selector
- error boundaries

commit intent: `feat(wt2): establish dashboard deterministic core`

acceptance:

- KNEI route direct load
- query route change
- representative automatic/manual consumption은 WT3 selector output과 일치
- WT2-owned champion/tuning merge와 direct representative storage read 0건

### Phase 2 — static hero chart parity

산출물:

- heading/legend
- actual line
- forecast path
- four PI90 error bars
- forecast zone/divider
- footer

commit intent: `feat(wt2): reproduce KCCI forecast chart`

acceptance:

- screenshot before interaction
- KNEI points and labels exact
- no continuous invented band

### Phase 3 — chart viewport interaction

산출물:

- toolbar
- wheel anchor zoom
- pointer drag
- keyboard navigation
- tooltip

commit intent: `feat(wt2): add exact chart period navigation`

acceptance:

- full input matrix pass
- 8-week min span
- route-only reset

### Phase 4 — horizon readout

산출물:

- radiogroup
- three-article readout
- direction threshold
- coverage

commit intent: `feat(wt2): connect horizon forecast readout`

acceptance:

- KNEI 1~4 numbers exact
- auto/manual helper exact
- viewport preserved

### Phase 5 — two-slot market

산출물:

- selector rows
- swap invariant
- typed market `DataGateway` consumer
- four state surfaces
- mini chart

commit intent: `feat(wt2): integrate non-duplicating market signals`

acceptance:

- all selection transitions pass
- stale payload absent
- no synthetic fallback
- envelope/state/data/meta/error validation pass
- UNAVAILABLE data=null pass

### Phase 6 — route news

산출물:

- IDLE/LOADING/READY/ERROR/CACHED state
- typed news `DataGateway` consumer
- v19 cache/migration
- retry selection
- article list/stats

commit intent: `feat(wt2): build cached route news workflow`

acceptance:

- no automatic initial fetch
- request literal `asOf=latest`; data-pack periodEnd를 news 상한으로 보내는 요청 0건
- existing cache survives failure
- max five verified articles
- UNAVAILABLE data=null과 `NO_VALID_DATA`/provider error 분기 통과

### Phase 7 — forecast insight

산출물:

- typed insight `DataGateway` consumer와 request serializer
- cache key
- LLM/rule states
- evidence/caution UI

commit intent: `feat(wt2): explain forecasts with bounded insight`

acceptance:

- no look-ahead news
- rule fallback labeled
- only LLM persisted
- envelope/state/data/meta/error validation pass

### Phase 8 — history dialog

산출물:

- KPI
- 187-point chart
- event toggle/markers/list/detail
- lifecycle

commit intent: `feat(wt2): add full route history dialog`

acceptance:

- KCI/KJI empty state
- trigger focus return
- disclaimer exact

### Phase 9 — all-routes dialog

산출물:

- 13 mini charts
- independent y scales
- events toggle/tooltips
- source details
- lifecycle

commit intent: `feat(wt2): add all-route trend comparison dialog`

acceptance:

- registry order 13/13
- no route selection behavior
- focus return

### Phase 10 — responsive/accessibility/evidence

산출물:

- 1440/900/640/375 layouts
- reduced-motion
- keyboard/focus QA
- Figma/PNG visual parity report
- functional report

commit intent: `test(wt2): close dashboard parity evidence`

acceptance:

- all matrices CHECKED
- no P0/P1
- no unapproved UI differences

각 phase는 별도 review 가능한 commit으로 남긴다.

API와 unrelated page change를 WT2 commit에 섞지 않는다.

## 86. Visual evidence matrix — core

| surface | viewport/state | 비교 핵심 | evidence | 종료값 |
|---|---|---|---|---|
| dashboard | 1440 ready · detailed | 1.7:1 hero/market, lower 2-col, exact computed geometry/type/color | Figma/PNG+구현 렌더+computed style | CHECKED |
| dashboard | 900 ready · smoke | all primary stacks 1-col, states/actions/overflow | 구현 렌더+structural assertions | CHECKED |
| dashboard | 640 ready · smoke | compact card/readout, states/actions/overflow | 구현 렌더+structural assertions | CHECKED |
| dashboard | 375 ready · detailed | no overflow, labels visible, exact computed geometry/type/color | Figma/PNG+구현 렌더+computed style | CHECKED |
| hero | KNEI 1w | actual/forecast/error bars | crop PNG comparison | CHECKED |
| hero | KNEI 4w | selected endpoint emphasis | crop PNG comparison | CHECKED |
| toolbar | recent | dates/button disabled state | crop PNG comparison | CHECKED |
| toolbar | full | full range/button state | crop PNG comparison | CHECKED |
| tooltip | forecast point | 승인 기준의 title/date/value only; rich PI90/Coverage content absent | crop PNG comparison | CHECKED |
| readout | auto | three articles | crop PNG comparison | CHECKED |
| readout | manual | manual helper | crop PNG comparison | CHECKED |

## 87. Visual evidence matrix — market/news/insight

| surface | state | 비교 핵심 | evidence | 종료값 |
|---|---|---|---|---|
| market | initial fx/oil ready | two distinct cards | crop PNG comparison | CHECKED |
| market | swapping | selector/card titles | recording | CHECKED |
| market | loading | stale chart absent | state PNG | CHECKED |
| market | REFERENCE | REFERENCE truth | state PNG | CHECKED |
| market | unavailable | no synthetic chart | state PNG | CHECKED |
| news | idle | 표시 문구/button | crop PNG comparison | CHECKED |
| news | loading cold | spinner/process 표시 문구 | crop PNG comparison | CHECKED |
| news | ready 5 | stats/articles/badges | crop PNG comparison | CHECKED |
| news | verified empty | empty 표시 문구 | crop PNG comparison | CHECKED |
| news | cached refresh | prior list+bar | crop PNG comparison | CHECKED |
| news | cached error | failure+prior list | crop PNG comparison | CHECKED |
| insight | waiting | deterministic summary | crop PNG comparison | CHECKED |
| insight | loading | analysis badge | crop PNG comparison | CHECKED |
| insight | Gemini | evidence/caution | crop PNG comparison | CHECKED |
| insight | rule | rule badge/notice | crop PNG comparison | CHECKED |
| all three panels | 1440+375 detailed | exact geometry/type/color/표시 문구, no invented UI | Figma/PNG+구현 렌더+computed style | CHECKED |
| all three panels | 900+640 smoke | breakpoint/state/action/keyboard/overflow | structural assertions+state capture | CHECKED |

## 88. Visual evidence matrix — dialogs

| surface | viewport/state | 비교 핵심 | evidence | 종료값 |
|---|---|---|---|---|
| history | 1440 KNEI | width/KPI/chart/events | Figma/PNG+구현 렌더 | CHECKED |
| history | 900 KNEI · smoke | KPI2/event1, lifecycle/overflow | structural assertions+state capture | CHECKED |
| history | 375 KNEI | scroll/compact header | Figma/PNG+구현 렌더 | CHECKED |
| history | KCI empty | factual event empty | crop PNG comparison | CHECKED |
| history | event selected | marker/list/detail sync | recording | CHECKED |
| all-routes | 1440 | 13 cards/3 columns | Figma/PNG+구현 렌더 | CHECKED |
| all-routes | 900 · smoke | 1 column/dialog inset, lifecycle/overflow | structural assertions+state capture | CHECKED |
| all-routes | 640 · smoke | compact controls/sources, lifecycle/overflow | structural assertions+state capture | CHECKED |
| all-routes | 375 | no overflow/tooltips clamp | Figma/PNG+구현 렌더 | CHECKED |
| all-routes | events off | markers all hidden | recording | CHECKED |

## 89. Functional tests — deterministic core

| id | test | expected | 종료값 |
|---|---|---|---|
| WT2-F001 | KNEI direct load | 187 actual points available | CHECKED |
| WT2-F002 | registry count | 13 routes | CHECKED |
| WT2-F003 | model count | 8 per route | CHECKED |
| WT2-F004 | horizon count | 1,2,3,4 | CHECKED |
| WT2-F005 | KNEI current | 4,884 at 2026-08-03 | CHECKED |
| WT2-F006 | KNEI auto champion | SARIMAX | CHECKED |
| WT2-F007 | KNEI 1w | 4829, 4482–5175 | CHECKED |
| WT2-F008 | KNEI 2w | 4791, 4227–5355 | CHECKED |
| WT2-F009 | KNEI 3w | 4767, 3936–5599 | CHECKED |
| WT2-F010 | KNEI 4w | 4754, 3440–6068 | CHECKED |
| WT2-F011 | KNEI coverage | 46/52=88.5% | CHECKED |
| WT2-F012 | KNEI direction | 보합 | CHECKED |
| WT2-F013 | manual representative | same id path 1~4 | CHECKED |
| WT2-F014 | invalid manual id | auto fallback | CHECKED |
| WT2-F015 | route selector all routes | title/data update | CHECKED |
| WT2-F016 | route change | location query/storage/sidebar destination update | CHECKED |
| WT2-F017 | representative source | WT3 `RepresentativeSelectionV1` only | CHECKED |
| WT2-F018 | WT2 ownership scan | champion/tuning merge와 representative/tuning storage parse 0건 | CHECKED |
| WT2-F019 | selector lineage | data-pack/tuning lineage와 current route 일치 | CHECKED |
| WT2-F020 | current observation seam | DTO date/value/unit equals route last actual and periodEnd | CHECKED |
| WT2-F021 | automatic champion seam | manual helper uses DTO automaticChampion; local champion scan 0건 | CHECKED |
| WT2-F022 | horizon metric tuple | exact 4, selected model/forecast horizon 결속 | CHECKED |
| WT2-F023 | agreement tuple | exact 4 rows × registry-order 8 members, threshold=3, counts exact | CHECKED |
| WT2-F024 | representative revision guard | any DTO revision change invalidates stale consumer result | CHECKED |

## 90. Functional tests — chart interaction

| id | test | expected | 종료값 |
|---|---|---|---|
| WT2-C001 | initial viewport | starts 2026-01-01 | CHECKED |
| WT2-C002 | full boundary | starts 2022-10-01 | CHECKED |
| WT2-C003 | wheel center | anchored zoom | CHECKED |
| WT2-C004 | wheel left | left date anchor stable | CHECKED |
| WT2-C005 | wheel right | right date anchor stable | CHECKED |
| WT2-C006 | zoom minimum | never below 8 weeks | CHECKED |
| WT2-C007 | mouse drag | horizontal pan | CHECKED |
| WT2-C008 | touch <6px | no pan yet | CHECKED |
| WT2-C009 | vertical touch | page scroll preserved | CHECKED |
| WT2-C010 | horizontal touch | chart pan starts | CHECKED |
| WT2-C011 | pointer cancel | capture/drag cleared | CHECKED |
| WT2-C012 | toolbar + | factor .72 | CHECKED |
| WT2-C013 | toolbar − | factor 1.38 | CHECKED |
| WT2-C014 | toolbar 전체 | full viewport | CHECKED |
| WT2-C015 | toolbar 최근 | initial viewport | CHECKED |
| WT2-C016 | double click | initial viewport | CHECKED |
| WT2-C017 | keyboard + | zoom in | CHECKED |
| WT2-C018 | keyboard = | zoom in | CHECKED |
| WT2-C019 | keyboard - | zoom out | CHECKED |
| WT2-C020 | ArrowLeft | -16% pan | CHECKED |
| WT2-C021 | ArrowRight | +16% pan | CHECKED |
| WT2-C022 | Home | initial viewport | CHECKED |
| WT2-C023 | End | full viewport | CHECKED |
| WT2-C024 | Escape | hover/focus clear | CHECKED |
| WT2-C025 | navigation after hover | stale tooltip absent | CHECKED |
| WT2-C026 | horizon change | viewport unchanged | CHECKED |
| WT2-C027 | market change | viewport unchanged | CHECKED |
| WT2-C028 | route change | viewport reset | CHECKED |
| WT2-C029 | y recompute | only visible ranges drive domain | CHECKED |
| WT2-C030 | endpoint | 4w label/tooltip not clipped | CHECKED |
| WT2-C031 | hero plot inset | interactive dataLeft/dataRight each plot edge +14px | CHECKED |
| WT2-C032 | market plot inset | noninteractive endpoint inset 0px | CHECKED |
| WT2-C033 | y padding | non-forecastOnly max(1, visible range×13%), lower clamp 0 | CHECKED |
| WT2-C034 | y ticks | exactly 5 and linear endpoints | CHECKED |
| WT2-C035 | x ticks | clamp(floor(plotWidth/145),3,6) and forecast-focus dates | CHECKED |
| WT2-C036 | PI90 cap | >365d half-width5, otherwise8; selected4px/unselected2.5px | CHECKED |
| WT2-C037 | tooltip baseline | Dashboard point title/date/value only; interval renderer not activated | CHECKED |

## 91. Functional tests — market

| id | test | expected | 종료값 |
|---|---|---|---|
| WT2-M001 | initial slots | upper fx, lower oil | CHECKED |
| WT2-M002 | upper current click | no-op | CHECKED |
| WT2-M003 | lower current click | no-op | CHECKED |
| WT2-M004 | upper chooses lower | swap | CHECKED |
| WT2-M005 | lower chooses upper | swap | CHECKED |
| WT2-M006 | upper chooses third | upper only changes | CHECKED |
| WT2-M007 | lower chooses third | lower only changes | CHECKED |
| WT2-M008 | all transitions | slots never duplicate | CHECKED |
| WT2-M009 | request query | exact series/from/to/version | CHECKED |
| WT2-M010 | switch loading | old payload hidden | CHECKED |
| WT2-M011 | stale response | ignored | CHECKED |
| WT2-M012 | LIVE | chart/latest rendered | CHECKED |
| WT2-M013 | REFERENCE | truth badge rendered | CHECKED |
| WT2-M014 | UNAVAILABLE | no synthetic points | CHECKED |
| WT2-M015 | empty points | explicit empty | CHECKED |
| WT2-M016 | VLSFO label | global 20-port average | CHECKED |
| WT2-M017 | HARPEX | Index unit/REFERENCE | CHECKED |
| WT2-M018 | FX smoke | 1427.048 at period end fixture | CHECKED |
| WT2-M019 | gateway envelope | schemaVersion/state/data/meta/error exact | CHECKED |
| WT2-M020 | market unavailable | `state=UNAVAILABLE`, `data=null` | CHECKED |
| WT2-M021 | market metadata | source/asOf/fetchedAt/cache는 `result.meta`에서 표시 | CHECKED |
| WT2-M022 | 1280 composition | dashboard 1-col + market cards vertical 1-col×2-row (specificity regression sentinel) | CHECKED |
| WT2-M023 | 900 composition | market cards 1-col at inclusive boundary | CHECKED |
| WT2-M024 | 640/375 geometry | selector 40px+4 tabs, card padding18, chart208, no overflow | CHECKED |

## 92. Functional tests — news and insight

| id | test | expected | 종료값 |
|---|---|---|---|
| WT2-N001 | cold entry | no automatic fetch | CHECKED |
| WT2-N002 | cold UI | IDLE + 뉴스 수집 | CHECKED |
| WT2-N003 | collect | LOADING 표시 문구 | CHECKED |
| WT2-N004 | first <5 | retry exactly once | CHECKED |
| WT2-N005 | retry larger | larger payload retained | CHECKED |
| WT2-N005A | retry equal count | first retry=0 payload retained byte-for-byte | CHECKED |
| WT2-N006 | duplicate titles | normalized dedupe | CHECKED |
| WT2-N007 | 30-day enough | no 90-day fill | CHECKED |
| WT2-N008 | 30-day short | 90-day B fallback | CHECKED |
| WT2-N009 | max items | at most 5 | CHECKED |
| WT2-N010 | no verified items | empty 표시 문구 | CHECKED |
| WT2-N011 | v19 cache entry | immediate cached render | CHECKED |
| WT2-N012 | v18 migration | latest valid to v19 | CHECKED |
| WT2-N013 | storage event | cross-tab update | CHECKED |
| WT2-N014 | refresh cached | previous articles remain | CHECKED |
| WT2-N015 | refresh error cached | failure+previous articles | CHECKED |
| WT2-N016 | route change | route-specific cache only | CHECKED |
| WT2-N017 | news asOf | literal `latest` | CHECKED |
| WT2-N018 | news query sentinel | data-pack periodEnd를 news `asOf`로 보내는 요청 0건 | CHECKED |
| WT2-N019 | news gateway envelope | payload는 `result.data.*`, provenance는 `result.meta.*` | CHECKED |
| WT2-N020 | news unavailable | `data=null`; NO_VALID_DATA와 provider failure 분기 | CHECKED |
| WT2-I001 | no news | no insight request | CHECKED |
| WT2-I002 | news ready | insight POST | CHECKED |
| WT2-I003 | look-ahead article | excluded | CHECKED |
| WT2-I004 | Gemini response | Gemini badge/content | CHECKED |
| WT2-I005 | Gemini missing/failure | rule fallback badge/content | CHECKED |
| WT2-I006 | malformed Gemini response | rejected then rule fallback | CHECKED |
| WT2-I007 | rule fallback | not persisted | CHECKED |
| WT2-I008 | LLM result | exact cache key persisted | CHECKED |
| WT2-I009 | cached LLM | used before network | CHECKED |
| WT2-I010 | horizon change | new key/request | CHECKED |
| WT2-I011 | representative change | new key/request | CHECKED |
| WT2-I012 | stale insight | cannot overwrite current | CHECKED |
| WT2-I013 | insight gateway envelope | LLM/DERIVED data와 meta/error 위치 exact | CHECKED |
| WT2-I014 | insight unavailable | `state=UNAVAILABLE`, `data=null` | CHECKED |
| WT2-I015 | request ownership | market/news/insight raw endpoint call 0건 | CHECKED |
| WT2-I016 | request metric source | selected horizon metricsByHorizon row only | CHECKED |
| WT2-I017 | request agreement source | selected horizon DTO counts only; local 8-model reduce 0건 | CHECKED |
| WT2-I018 | visible parity | confidence/error/retry/new status UI absent | CHECKED |

## 93. Functional tests — dialogs

| id | test | expected | 종료값 |
|---|---|---|---|
| WT2-D001 | `!` click | history dialog opens | CHECKED |
| WT2-D002 | history open | body scroll locked | CHECKED |
| WT2-D003 | history X | closes | CHECKED |
| WT2-D004 | history overlay | target-self closes | CHECKED |
| WT2-D005 | history Escape | closes | CHECKED |
| WT2-D006 | history close | trigger focus restored | CHECKED |
| WT2-D007 | history KPI | all four accurate | CHECKED |
| WT2-D008 | history hover | weekly tooltip | CHECKED |
| WT2-D009 | event toggle | markers all on/off | CHECKED |
| WT2-D010 | event focus | event selected | CHECKED |
| WT2-D011 | event Enter/Space | event selected | CHECKED |
| WT2-D012 | event card | marker/detail sync | CHECKED |
| WT2-D013 | KCI history | factual empty events | CHECKED |
| WT2-D014 | KJI history | factual empty events | CHECKED |
| WT2-D014A | history same-route reopen | prior toggle/event selection retained | CHECKED |
| WT2-D014B | history route change | events ON and first event reset | CHECKED |
| WT2-D015 | all-routes trigger | dialog opens | CHECKED |
| WT2-D016 | all-routes count | 13 cards | CHECKED |
| WT2-D017 | all-routes order | registry exact | CHECKED |
| WT2-D018 | independent y | route scales differ correctly | CHECKED |
| WT2-D019 | rate hover | date/value tooltip | CHECKED |
| WT2-D020 | event focus | event tooltip | CHECKED |
| WT2-D021 | event toggle | all card markers on/off | CHECKED |
| WT2-D021A | all-routes reopen | event toggle resets ON | CHECKED |
| WT2-D022 | source details | all event sources available | CHECKED |
| WT2-D023 | mini card click | route does not change | CHECKED |
| WT2-D024 | all-routes close | topbar focus restored | CHECKED |
| WT2-D025 | body overflow restore | prior value restored | CHECKED |

## 94. Figma/PNG parity acceptance

승인 Figma/PNG 기준과 구현 렌더는 같은 viewport, state, route, 데이터 팩 fixture를 사용한다.

viewport, DPR, browser zoom, font, route, storage fixture를 같게 한다.

market/news timestamps는 fixture로 고정한다.

고정할 수 없는 fetchedAt만 명시적 mask를 허용한다.

route name, forecast value, PI90, date, provider state는 mask하지 않는다.

dialog source count와 card count는 mask하지 않는다.

권장 automated gate는 SSIM 0.995 이상이다.

권장 mismatch pixel 비율은 0.5% 이하다.

24×24px보다 큰 contiguous mismatch는 manual review한다.

column count, card order, chart boundary, dialog width 차이는 numeric score와 무관하게 fail이다.

chart line antialias 차이는 허용 mask가 아니라 PNG overlay manual review 대상이다.

PI90를 band로 바꾼 차이는 fail이다.

font fallback으로 한글 wrap이 바뀌면 fail이다.

375px에서 1px이라도 document horizontal overflow가 있으면 fail이다.

### 94.1 Core 100% / minor visual 95% automatic release gate — MANDATORY

두 점수를 평균내지 않는다. 먼저 core를 binary gate로 통과한 뒤 minor visual floor를 평가한다.

```text
coreLogicPass = passed required functional/invariant/state tests / applicable required tests
minorVisualPass = passed non-structural computed-style/PNG comparison assertions / applicable minor assertions

release =
  coreLogicPass == 100%
  AND minorVisualPass >= 95%
  AND detailed viewport Figma/PNG gates pass
  AND openP0 == 0
  AND openP1 == 0
  AND unapprovedVisibleAdditions == 0
```

core에는 route/representative/readout 수치, chart 수식·viewport, two-slot swap, gateway/query/cache/race, news retry tie-break, insight payload, dialog lifecycle, accessibility keyboard, responsive structure/state가 포함된다. 하나라도 실패·skip·미실행이면 자동 실패다.

minor visual은 구조·표시 문구·data·state를 제외한 anti-alias, shadow softness, 1px 이하의 비핵심 장식 assertion만 집계한다. 다음은 minor로 낮출 수 없으며 numeric similarity와 무관하게 자동 실패다.

- column/row 수, order, breakpoint, card/plot bounds, chart height/axis/tick/cap/inset 수식 차이.
- visible 표시 문구, value, date, badge truth, font fallback로 인한 wrap 차이.
- missing state/action/focus, stale payload, synthetic data, document overflow.
- 승인 기준에 없는 card, rich PI90/Coverage tooltip, confidence, status/error bar, retry action 또는 표시 문구.
- 1440/375 detailed evidence 누락 또는 900/640 smoke evidence 누락.

95%는 minor floor일 뿐이며 §94의 SSIM 0.995, mismatch 0.5%, contiguous mismatch/manual review처럼 더 엄격한 surface gate를 완화하지 않는다.

test/evidence aggregator는 `coreLogicPass`, `minorVisualPass`, detailed/smoke cell, P0/P1, unapproved addition count를 machine-readable report로 만들고 위 조건 중 하나라도 false면 non-zero로 종료한다. 수동 DONE 문구가 이 exit를 덮을 수 없다.

## 95. Required evidence pack

- 승인 Figma frame/node inventory
- 승인 PNG viewport/state inventory
- 승인 데이터 팩과 생성 fixture version report
- route-event catalog validation report
- 표시 문구 ledger
- computed-style ledger
- component state inventory
- 1440/900/640/375 screenshots
- crop-level PNG comparisons
- full-page PNG comparisons
- wheel anchor recording
- pointer drag recording
- keyboard navigation recording
- horizon viewport-preservation recording
- market swap recording
- news cold/cache/error recordings
- insight LLM/rule recordings
- history dialog lifecycle recording
- all-routes lifecycle recording
- functional test report
- browser console report
- data-pack-generated gateway fixture report
- known difference report

known difference가 없으면 `none`으로 기록한다.

검증하지 않은 동작을 known difference로 넘기지 않는다.

## 96. Console and robustness gate

hydration warning 0건이어야 한다.

unhandled promise rejection 0건이어야 한다.

stale state update warning 0건이어야 한다.

invalid SVG attribute warning 0건이어야 한다.

duplicate id warning 0건이어야 한다.

dialog open/close 뒤 body overflow leak 0건이어야 한다.

route change 뒤 old market/news/insight flash 0건이어야 한다.

external provider offline에서도 hero/readout는 정상이어야 한다.

localStorage unavailable에서도 location query route와 deterministic core는 정상이어야 한다.

## 97. Self-review checklist

| review | question | 종료값 |
|---|---|---|
| authority | 승인 Figma/PNG, 데이터 팩, 동결 계약 식별자가 있는가 | CHECKED |
| scope | WT2와 WT1/3/6 경계가 지켜졌는가 | CHECKED |
| representative owner | WT3 selector만 소비하고 WT2 재계산이 0건인가 | CHECKED |
| gateway | market/news/insight가 typed `GatewayResultV1<TData, TState>`만 소비하는가 | CHECKED |
| query | market from/to/version과 news literal latest/version이 frozen 값인가 | CHECKED |
| order | section 순서가 exact한가 | CHECKED |
| data | 187/13/8/4 invariant가 맞는가 | CHECKED |
| fixture | KNEI smoke가 모두 맞는가 | CHECKED |
| chart | actual/path/error bars가 맞는가 | CHECKED |
| viewport | wheel/drag/button/keyboard가 모두 맞는가 | CHECKED |
| readout | three-article hierarchy가 맞는가 | CHECKED |
| market | two-slot swap/no-duplicate가 맞는가 | CHECKED |
| news | IDLE/LOADING/READY/ERROR/CACHED가 맞는가 | CHECKED |
| insight | look-ahead/cache/rule 경계가 맞는가 | CHECKED |
| history | KPI/chart/events/lifecycle가 맞는가 | CHECKED |
| all-routes | 13 independent charts/lifecycle가 맞는가 | CHECKED |
| responsive | 1440/900/640/375가 맞는가 | CHECKED |
| accessibility | focus/ARIA/keyboard가 맞는가 | CHECKED |
| evidence | PNG comparison/recording/report가 모두 있는가 | CHECKED |
| regression | clean-room deviation risk가 재발하지 않았는가 | CHECKED |

## 98. 최종 DONE gate

다음 조건을 전부 만족할 때만 WT2를 DONE으로 선언한다.

- core visual matrix 전 셀 CHECKED
- market/news/insight visual matrix 전 셀 CHECKED
- dialog visual matrix 전 셀 CHECKED
- deterministic functional tests 전 셀 CHECKED
- chart tests 전 셀 CHECKED
- market tests 전 셀 CHECKED
- news/insight tests 전 셀 CHECKED
- dialog tests 전 셀 CHECKED
- self-review 전 셀 CHECKED
- 1440/375 detailed Figma/PNG comparison과 computed-style gate 통과
- 900/640 structural/state/interaction smoke gate 통과
- core logic pass 100%
- minor visual pass 95% 이상이며 §94의 더 엄격한 surface threshold도 통과
- KNEI smoke values 전부 일치
- 187/13/8/4 invariants 일치
- external failure에서 synthetic data 0건
- market/news/insight raw fetch 0건
- UNAVAILABLE envelope의 non-null data 0건
- WT2-owned tuning merge/champion selector/direct representative storage read 0건
- WT2-owned currentObservation/automaticChampion/metric/agreement 재계산 0건
- RepresentativeSelectionV1 exact DTO/revision fixture 일치
- news literal `asOf=latest` request와 Insight 기준일 이후 기사 제외가 각각 증명됨
- stale resource flash 0건
- dialog focus/scroll leak 0건
- open P0 0건
- open P1 0건
- unapproved visible additions 0건
- automated release aggregator exit 0
- 미검증 상태를 종료 상태로 사용하지 않음

완료 보고에는 승인 Figma/PNG, 데이터 팩, 동결 계약 식별자를 적는다.

완료 보고에는 CHECKED cell 수를 적는다.

완료 보고에는 Figma/PNG visual evidence 식별자를 적는다.

“얼추 비슷함”, “데모로 충분함”, “핵심만 구현”이라는 표현은 완료 근거가 아니다.
