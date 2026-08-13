# WT5 — CVaR 배분 의사결정 화면 Greenfield 구축 명세

## 0. 문서 목적

이 문서는 WT5를 독립적으로 구현하는 담당자에게 주는 clean-room 실행 명세다.

WT5 담당자는 이 문서만으로 화면, 계산 엔진, Worker, 상태, CSV, 테스트를 구축할 수 있어야 한다.

완료 기준은 "얼추 비슷한 데모"가 아니라 승인된 설계와 기능·수치·상태·시각이 일치하는 제품 수준이다.

판단이 충돌하면 아래 권위 순서를 따른다.

1. 승인된 Figma 화면 구조와 prototype interaction
2. 승인된 1440×900·375×812 PNG 및 900×900·640×900 보조 PNG
3. 데이터 팩 18의 입력 fixture와 표시 데이터
4. frozen DTO, 특히 `RepresentativeSelectionV1`과 typed gateway 계약
5. 본 문서의 결정론적 수식, 상수, golden 값, 상태·접근성·반응형 계약

임의의 UI 재해석, 차트 단순화, 계산 근사, 샘플 수 축소는 허용하지 않는다.

승인된 Figma/PNG에 없는 기능을 접근성·보안·성능 개선이라는 이유로 필수 구현에 추가하지 않는다.

다음 항목을 임의로 추가하면 자동 `CHANGES_REQUESTED`다.

- 승인 화면에 없는 Worker 호환모드·fallback badge·watchdog UI
- 승인 화면에 없는 Spectrum keyboard 후보 이동·hover guide·hover marker
- 승인 화면에 없는 drawer 예측 대상일
- 승인 화면에 없는 상세 dialog sticky shell·별도 sorting/loading 상태
- 승인 화면에 없는 대표모델 version·provenance·manual/automatic badge
- 승인 화면에 없는 focus trap·초기 focus·trigger focus 복원 동작을 parity 완료 조건으로 주장하는 것
- 승인 화면에 없는 서버 simulation API 또는 축소된 scenario/candidate 계산

---

## 1. WT5 완료 선언의 의미

WT5가 완료되었다고 말하려면 다음 조건을 모두 충족해야 한다.

- 대표모델의 1주부터 4주까지 예측을 동일 모델 ID로 인계받는다.
- 100,000개 4주 경로를 정확한 seed와 난수 순서로 생성한다.
- 101개 고정 비중 후보를 모두 평가한다.
- CVaR 90 계산이 기준 숫자와 허용오차 안에서 일치한다.
- 기본 화면, 입력 drawer, 두 차트, 상세 dialog 세 탭, CSV가 모두 동작한다.
- 최초 계산, 재계산, 입력 변경, 항로 변경, Worker 오류 상태가 §20·§51 계약대로 분리된다.
- 1440×900과 375×812의 승인 PNG 시각 검수를 통과하고 900×900·640×900 breakpoint smoke를 통과한다.
- 승인 상호작용에 존재하는 dialog semantics, Escape, overlay close, body scroll lock, chart accessible name을 동일하게 구현한다.
- 계산 실패 시 이전 결과를 새 결과처럼 표시하지 않는다.
- 테스트가 UI 문자열뿐 아니라 golden 수치와 byte-level CSV 계약을 검증한다.

위 항목 중 하나라도 빠지면 완료가 아니라 미완료다.

---

## 2. 범위

WT5가 소유하는 범위는 다음과 같다.

- CVaR 배분 페이지 전체 콘텐츠 영역
- 배분 입력 요약 strip
- 우측 입력 drawer
- 추천 고정/Spot 비중 카드
- 결과 KPI 카드 4개
- 고정운임 대 Spot 비교 차트
- 3단계 계산 흐름 안내
- 고정–Spot 101개 후보 spectrum 차트
- 상승·하락 위험 분해 카드
- 시뮬레이션 상세 dialog
- 상세 dialog의 비중별 결과 탭
- 상세 dialog의 운임경로 분포 탭
- 상세 dialog의 계산 방법 탭
- 추천 비중 100,000행 CSV 생성과 다운로드
- 결정론적 시뮬레이션 순수 엔진
- Worker 실행 어댑터
- §20–§24와 동일한 Blob Worker 생성·진행률·stale message 차단·resource 정리
- WT2/WT3/WT6로부터 받는 읽기 전용 계약
- WT5 단위·통합·접근성·시각 회귀 테스트

---

## 3. 비범위

WT5는 다음 항목을 구현하거나 재정의하지 않는다.

- 전체 앱 shell, 전역 header, 좌측 navigation
- 항로 원천 데이터 수집
- 예측 모델 학습 또는 튜닝
- 대표모델 점수 산정
- 뉴스, 시장, 항만, 병목, 날씨 gateway
- snapshot 생성 파이프라인
- 사용자 인증과 권한
- 계약 체결 또는 주문 실행
- 실제 선사 Spot 견적 조회
- 여러 항로를 동시에 최적화하는 portfolio 모델
- 선박·컨테이너 물리 배차
- 서버 측 장기 저장
- 입력값 localStorage 영속화
- 결과를 실제 청구 금액으로 표현하는 기능

비범위 기능을 임의로 추가해 WT5의 화면 구조를 바꾸지 않는다.

---

## 4. Clean-room 구현 권위

구현과 검수에는 다음 자료만 사용한다.

| 영역 | 권위 자료 | 사용 목적 |
|---|---|---|
| 화면 계층·문구·상호작용 | 승인된 Figma 화면과 prototype | visible section, 순서, 상태, overlay 동작 |
| geometry·색상·breakpoint | 승인된 1440×900·375×812 PNG와 900×900·640×900 보조 PNG | 배치, 크기, 간격, 줄바꿈, overflow |
| route·관측·예측 데이터 | 데이터 팩 18 | KNEI 기준 입력과 13개 항로 표시 데이터 |
| WT3/WT6 인계 | frozen DTO와 typed gateway 계약 | 대표모델, snapshot, keep/rollback, 오류 경계 |
| 계산 결과 | 본 문서의 PRNG·경로·CVaR 수식, 상수, golden 값 | 결정론, 후보 선택, CSV 수치 |
| 제품 상태 | 본 문서의 runtime·responsive·a11y·acceptance 절 | 실행 상태와 검수 기준 |

### 4.1 active visible inventory

이 inventory보다 visible section, card, badge, button, field, tab을 늘리거나 줄이면 자동 `CHANGES_REQUESTED`다.

1. `ANALYSIS INPUT` summary: 항로, 대표모델, 1주 종합점수·Coverage, 판단시점, 물동량, 고정운임, 조건부 progress, `데이터 입력`.
2. `RECOMMENDED MIX`: donut, 고정운임·Spot 대응·분석 경로 세 row, KPI 네 개와 HelpBubble 네 개, 추천 이유, `시뮬레이션 상세 결과 보기`.
3. `CONTRACT VS SPOT`: 대표모델 이름 badge, selected horizon의 PI90 하한·점예측·상한·입력 고정운임, footer 두 칸, 점예측·예측 대상일.
4. 3-step flow: `100,000개 4주 운임경로 생성` → `선택 시점에서 101개 배분비율 평가` → `최종 총비용이 낮은 비중 추천`.
5. `FIXED–SPOT SPECTRUM`: 다섯 legend, dual-axis chart, 추천 band/line/세 point, pointer tooltip, `Spot 상승손실`·`Spot 하락손실` 두 카드.
6. `DECISION INPUT` drawer: 항로, 판단 시점, 고정 물동량, 고정계약 운임, 추천 성향, 1~4주 미니카드, proxy note, `취소`, `100,000개 분석 실행`.
7. `SIMULATION RESULT TRACE` dialog: stats 다섯 개, tabs 세 개, `추천 비중 CSV`, close.
8. allocation tab: 101행 표와 추천 badge.
9. paths tab: `JOINT 4-WEEK PATHS`, `100,000개 생성 완료`, 250개 표시 path, 네 legend, 두 meta 문구, 9개 percentile의 7열 표.
10. method tab: 상단 설명, 지정된 여섯 formula block, `해석 주의` box.

다음은 active visible inventory에 없다.

- representative version·provenance·manual/automatic badge
- Worker execution mode, fallback, timeout, elapsed-time badge
- 별도 empty/skeleton/CSV progress/sorting progress UI
- 서버 simulation 상태
- 여러 항로 동시 최적화나 선박 배차 UI

### 4.2 권위 자료 확인 gate

구현 전 승인된 Figma의 visible inventory, overlay 상태, viewport별 frame을 이 문서 §4.1·§28–§50과 대조한다.

PNG는 KNEI, DPR 1, `ko-KR`, Asia/Seoul, font loading 완료 상태를 사용한다.

데이터 팩 18의 KNEI 관측·네 forecast·route catalog가 frozen DTO 검증을 통과하는지 확인한다.

승인 자료 사이에 충돌이 있으면 임의 보간하지 않고 UI는 Figma/PNG, 데이터 shape은 frozen DTO, 계산 수치는 본 문서 수식과 golden을 우선한다.

권위 자료가 개정되면 기존 PNG를 조용히 교체하지 않고 변경 사유와 계약 영향 승인을 먼저 남긴다.

권위 자료 확인 전에는 시각 기준과 numeric golden을 임의로 다시 정하지 않는다.

---

## 5. 최초 contract freeze 회의

코드를 작성하기 전에 WT2, WT3, WT6와 30분 freeze를 수행한다.

freeze 결과는 저장소의 공용 contract 파일과 fixture로 남긴다.

반드시 합의할 항목은 다음과 같다.

- route ID와 route code의 구분
- route name의 한국어 표시값
- value의 단위 `USD/FEU`
- 현재 운임의 기준 date
- 모델 ID 8종 enum
- 대표모델 자동/수동 선택 규칙
- 1주 점수와 Coverage의 소수점 표시
- 1주부터 4주 forecast의 날짜와 숫자
- forecast interval이 PI90임을 나타내는 필드
- snapshot loading/error 계약
- 전역 route 변경 callback
- 전역 representative model override callback
- WT6의 `GatewayResultV1<TData, TState>`와 typed `DataGateway` seam fixture
- WT3의 `RepresentativeSelectionV1` DTO와 revision 규칙
- 비정상 입력을 throw할지 화면 오류로 바꿀 경계

freeze 이후 필드 이름이나 단위를 단독으로 바꾸지 않는다.

계약 변경은 네 WT 모두가 같은 revision을 승인해야 한다.

---

## 6. WT3 → WT5 `RepresentativeSelectionV1` handoff 계약

`RepresentativeSelectionV1`은 WT3가 단독 소유하는 selector DTO다.

이 DTO와 이를 만드는 pure selector는 WT3가 소유하는 frozen cross-worktree seam이다.

WT5는 대표모델을 새로 고르거나 tuning overlay를 다시 merge하지 않는다.

자동 1주 champion 선택, Naive 제외, manual override 검증, invalid manual fallback은 모두 WT3 selector 안에서 끝난다.

WT5는 WT3가 반환한 DTO를 field rename, 확장, flatten, 재계산 없이 그대로 소비한다.

대표모델 ID는 네 horizon 모두 동일해야 한다.

각 horizon에서 다른 최고 모델을 섞는 것은 금지한다.

DTO contract identity는 타입 이름 `RepresentativeSelectionV1`로 고정한다.

필수 root field는 WT3 `RepresentativeSelectionV1`과 byte-level로 동일해야 한다.

| 필드 | 형식 | 제약 |
|---|---|---|
| `route` | string | canonical 13-route ID |
| `currentObservation` | object | `{date,value,unit:"USD/FEU"}`; route 마지막 actual과 snapshot periodEnd에 결속 |
| `modelId` | model enum | snapshot의 8종 중 하나 |
| `modelName` | string | 사용자 표시 이름 |
| `modelVersion` | non-empty string | baseline 또는 실제 tuned model version |
| `score1w` | finite number | 1주 종합점수 |
| `coverage1w` | finite number | percent, 0–100 |
| `selectionMode` | enum | `automatic` 또는 `manual` |
| `forecastSource` | enum | `baseline` 또는 `tuned` |
| `tuningRunHash` | SHA-256 또는 null | baseline이면 null, tuning이면 required |
| `evaluationProtocol` | non-empty string | 점수·구간을 만든 평가 protocol identity |
| `automaticChampion` | object | tuning merge 후 1주 자동 1위의 ID/name/version/score1w |
| `representativeRevision` | non-empty immutable string | selector 결과 revision |
| `forecasts` | exactly 4 items | horizon 1,2,3,4 각각 하나 |
| `metricsByHorizon` | exactly 4 items | 선택한 동일 model의 1~4주 metric·score·Coverage |
| `modelAgreementByHorizon` | exactly 4 items | tuning 반영 8-model member와 up/down/flat count |

중첩 shape도 WT3와 동일하다.

```text
currentObservation = { date, value, unit: "USD/FEU" }

automaticChampion = {
  modelId, modelName, modelVersion, score1w
}

metricsByHorizon[h] = {
  horizonWeeks,
  mapePct, mse, rmse, mase,
  mapeScore, mseScore, maseScore, totalScore,
  coverage: {
    pct, hits, total, sampleSize,
    target: 0.90,
    intervalMethod
  }
}

modelAgreementByHorizon[h] = {
  horizonWeeks,
  thresholdPct: 3,
  up, down, flat, total: 8,
  members: [
    {
      modelId, modelName, modelVersion,
      forecastSource, tuningRunHash,
      point, changePct,
      direction: "up" | "down" | "flat"
    } x 8 in registry order
  ]
}
```

WT5는 `metricsByHorizon`과 `modelAgreementByHorizon`을 allocation 계산에 다시 투입하지 않는다. 두 필드는 동일 shared DTO/revision 검증을 위해 보존하며 화면에도 새 영역으로 노출하지 않는다.

각 forecast 필드는 다음과 같다.

| 필드 | 제약 |
|---|---|
| `horizonWeeks` | 1, 2, 3, 4 중 하나 |
| `targetDate` | ISO date |
| `point` | finite, 0보다 큼 |
| `lower90` | finite, 0보다 큼 |
| `upper90` | finite, 0보다 큼 |
| interval 순서 | `lower90 <= point <= upper90` |

forecast field 이름은 반드시 `targetDate`, `point`, `lower90`, `upper90`을 사용한다.

`date`, `value`, `lower`, `upper` 별칭을 WT5 boundary에 추가하지 않는다.

`modelVersion`, `forecastSource`, `tuningRunHash`, `evaluationProtocol`, `representativeRevision`은 stale calculation 차단과 provenance를 위한 내부 metadata다.

WT5 화면에는 승인된 Figma와 동일하게 상단 `대표모델 {modelName}`, `1주 종합점수 {score1w}점 · Coverage {coverage1w}%`, comparison badge `{modelName}`만 표시한다.

`modelVersion`, `selectionMode`, `forecastSource`, `tuningRunHash`, `evaluationProtocol`, `representativeRevision`, `automaticChampion`, `metricsByHorizon`, `modelAgreementByHorizon`을 새 badge·helper·카드로 노출하지 않는다.

`representativeRevision`은 DTO에서 자기 자신을 제외한 모든 field를 stable-key JSON으로 직렬화한 SHA-256에 `rep-v1:` prefix를 붙여 WT3가 발급한다.

`tuningRunHash`와 `representativeRevision`은 WT3만 생성·발급한다. WT5는 frozen DTO에 실린 두 값을 구조·형식·revision 일관성 규칙으로 검증하고 그대로 소비하며, 어느 실행 경계에서도 새로 계산하거나 보정하거나 대체하지 않는다.

같은 revision에서 모든 field와 forecast byte가 같아야 한다.

field가 달라졌는데 revision을 재사용하면 contract failure다.

revision은 shared DTO 검증과 provenance identity로 보존한다. allocation-effective field가 그대로인데 revision만 바뀐 경우 WT5 자동 재실행 key는 바뀌지 않는다.

current 관측의 유일한 기준값은 `RepresentativeSelectionV1.currentObservation`이다.

WT5가 별도 context에서 `currentDate`나 `currentRate`를 중복 공급하거나 다시 계산하지 않는다.

route display name/code만 DTO 밖에 필요하면 최소 read-only route catalog projection으로 받되 `routeId`는 `RepresentativeSelectionV1.route`와 같아야 한다.

네 horizon 중 하나라도 빠지면 silent fallback을 하지 않는다.

오류 문구는 `${route.id} 항로의 ${selection.modelName} ${horizon}주 예측값이 없습니다.` 형식을 따른다.

다른 모델의 같은 horizon 값으로 메우는 것은 금지한다.

시뮬레이션 `current`는 검증된 `selection.currentObservation.value`를 그대로 사용한다.

`currentObservation`이 누락·non-finite·0 이하이거나 snapshot 마지막 actual/periodEnd와 불일치하면 WT3 handoff 오류로 차단하며 1주 point로 조용히 대체하지 않는다.

### 6.1 표시 formatter 계약

`money(value)`는 `'$' + Math.round(value).toLocaleString('en-US')`다.

`compactMoney(value)`는 절대값이 1,000,000 이상이면 `$${(value/1_000_000).toFixed(2)}M`, 1,000 이상이면 `$${(value/1_000).toFixed(0)}K`, 그 미만이면 `money(value)`다.

예측 대상일은 ISO date를 UTC midnight로 해석한 뒤 `ko-KR`의 `year:'numeric', month:'2-digit', day:'2-digit'`로 표시한다.

표시 formatter 결과를 다시 계산 입력으로 parsing하지 않는다.

### 6.2 자동 재실행 key와 실행 input

자동 재실행을 판단하는 `routeSimulationKey`에는 allocation에 실제 영향을 주는 `selection.route`, `currentObservation.value`, 선택 모델의 `modelName`, `score1w`, `coverage1w`, 1~4주 targetDate/point/lower90/upper90를 넣는다.

`representativeRevision` 전체를 그대로 key로 쓰지 않는다. manual 선택 모델과 allocation input이 그대로인데 비선택 모델 agreement만 바뀐 경우 CVaR를 불필요하게 재실행하지 않는다.

이 seam 값이 바뀌면 이전 Worker를 terminate·dispose하고 현재 draft horizon/volume/riskWeight와 새 horizon 기준 fixed default로 새 run을 시작한다.

사용자가 drawer에서 바꾸는 `horizon`, `volume`, `fixed`, `riskWeight`는 자동 재실행 key에 넣지 않는다. 이 값은 `100,000개 분석 실행`을 눌렀을 때만 immutable `RunInput`으로 확정된다.

각 실제 run의 evidence용 canonical input identity가 필요하면 route/selection seam과 확정된 `RunInput`, engine contract version을 모두 포함할 수 있다. 이 identity는 자동 effect dependency와 다른 개념이다.

UI label, elapsed time, progress, browser locale는 어느 identity에도 넣지 않는다.

같은 자동 재실행 key의 단순 React rerender만으로 중복 run을 시작하지 않는다.

### 6.3 WT3 keep/rollback seam golden

WT3는 baseline, tuned-candidate, keep-published, rollback-published `RepresentativeSelectionV1` fixture를 WT5와 공유한다.

각 fixture는 DTO identity, expected allocation-effective key, expected representativeRevision을 가진다.

`결과 유지` 또는 `이전 결과로 되돌리기`가 publish되어 route/current/modelName/score1w/coverage1w/네 forecast 중 하나가 바뀌면 정확히 한 번 재실행한다.

keep/rollback 뒤 allocation-effective key가 직전과 같고 provenance/revision만 바뀌면 재실행하지 않는다.

rollback 뒤 candidate Worker의 늦은 done/progress/error는 모두 무시한다.

keep golden은 WT3가 제공한 tuned forecast와 동일한 WT5 input identity/result anchor를 검증한다.

rollback golden은 같은 route의 pre-tuning DTO와 동일 signature 및 기준 CVaR result 복원을 검증한다.

WT5 test가 자체 임의 tuning 숫자를 만들지 않는다.

WT3가 versioned fixture와 expected identity를 제공하지 않으면 seam은 미완료다.

### 6.4 WT6 typed data seam

WT6는 public API와 fixture를 모두 `GatewayResultV1<TData, TState>`로 반환하고 WT2–WT5에 typed `DataGateway`를 제공한다.

WT5는 remote allocation simulation API를 호출하지 않지만 validated snapshot/registry 취득 경계에서 같은 `DataGateway` parser와 error contract를 소비한다.

`DataGateway` 경계를 통과할 수 있는 값은 schema 검증과 decoding을 완료한 exact `GatewayResultV1<TData, TState>`뿐이다.

bare-root snapshot/API payload, invalid envelope, schema-mismatched payload는 adapter wrapping이나 부분 채택 없이 fail closed한다.

legacy bare-root를 envelope로 감싸는 adapter 또는 fixture 예외를 만들지 않는다. WT5도 raw payload를 직접 parsing하거나 `GatewayResultV1`로 재포장하지 않는다.

WT5 consumer seam fixture에는 snapshot READY, schema error, unavailable, representative keep, representative rollback이 모두 포함돼야 한다.

---

## 7. Greenfield 모듈 경계

구현은 다음 책임을 분리한다.

- frozen 입력·출력·상태 계약
- DOM과 무관한 결정론적 계산과 golden assertion
- Blob Worker 생성, lifecycle, progress, stale sequence 조정
- reducer와 derived selectors
- 전체 페이지 조합과 상단 요약 strip
- 입력 drawer
- donut·KPI 추천 영역
- 고정 대 Spot 비교 차트
- 101개 후보 spectrum 차트
- 상승·하락 위험 분해
- 상세 dialog shell과 세 tab
- CSV serialization과 download
- fixture, viewport, a11y 검증 도구

실제 모듈 이름은 구현 환경 convention에 맞출 수 있다.

그러나 순수 엔진, runtime 어댑터, UI, CSV 직렬화의 경계는 유지한다.

UI 컴포넌트 안에 100,000경로 계산을 직접 넣지 않는다.

UI 컴포넌트가 Worker 수식을 별도로 복제하지 않는다.

---

## 8. 계산 입력 계약

계산 한 번의 immutable 입력 snapshot은 다음 의미를 가진다.

| 필드 | 형식 | 기본값/제약 |
|---|---|---|
| route seed key | canonical route ID | 계산 시작 시 고정 |
| current rate | USD/FEU | 최신 route 값 |
| forecasts | 4 tuples | point, lower90, upper90 |
| representative model | ID + version | `RepresentativeSelectionV1` 그대로 |
| forecast provenance | `forecastSource` + `tuningRunHash` | baseline이면 `tuningRunHash` null |
| evaluation protocol | string | DTO exact value |
| representative revision | string | shared DTO 검증·provenance identity; 단독 rerun trigger 아님 |
| selected horizon | integer | 기본 1, 범위 1–4 |
| volume | FEU | 기본 1,000, 최소 1 |
| fixed rate | USD/FEU | 기본 `round(point1w × 1.035)` |
| risk weight | number | 0.5, 1, 2 중 하나 |
| scenario count | integer | 정확히 100,000 |
| candidate count | integer | 정확히 101 |
| CVaR alpha | number | 정확히 0.90 |
| weekly correlation | number | 정확히 0.75 |

UI draft와 실행 입력을 같은 객체로 사용하지 않는다.

실행 버튼을 누르는 순간 draft를 검증하고 immutable `lastInput`을 만든다.

결과 카드와 상세 dialog는 반드시 `lastInput`을 표시한다.

계산 중 drawer에서 draft를 바꿔도 진행 중 계산의 입력은 변하지 않는다.

계산 완료 뒤 draft와 `lastInput`이 다르면 화면에 "입력 변경됨" 상태를 표시할 수 있다.

단, 기존 결과의 숫자를 새 draft label과 섞어 표시해서는 안 된다.

---

## 9. 결정론 상수

다음 상수는 환경별로 축소하거나 변경하지 않는다.

| 상수 | 값 |
|---|---:|
| 시나리오 수 | 100,000 |
| 후보 수 | 101 |
| 고정 비중 후보 | 0%, 1%, …, 100% |
| CVaR 신뢰수준 | 90% |
| tail 개수 | 10,000 |
| 주간 latent shock 상관계수 | 0.75 |
| 독립 noise 계수 | `sqrt(1 - 0.75²)` |
| 독립 noise 계수 수치 | 약 0.6614378277661477 |
| 상세 경로 sample | 처음 250개 |
| seed 초기값 | 20,260,803 |

모바일에서 경로 수를 줄이는 것은 금지한다.

개발 모드에서 후보를 11개로 줄이는 것도 금지한다.

테스트 속도를 위한 작은 fixture는 단위 테스트 전용으로만 사용한다.

제품 코드의 기본 상수를 fixture 값으로 바꾸지 않는다.

---

## 10. route seed 규칙

seed는 canonical route ID로부터 계산한다.

초기 accumulator는 20,260,803이다.

route ID의 UTF-16 code unit을 앞에서부터 순회한다.

각 문자에서 `Math.imul(accumulator, 31) + charCode`와 같은 32-bit 연산 의미를 적용한다.

마지막 값은 unsigned 32-bit로 변환한다.

같은 route ID는 Worker와 테스트에서 같은 seed를 만들어야 한다.

route display name은 seed에 사용하지 않는다.

locale, timezone, 렌더 순서도 seed에 관여하지 않는다.

기준 KNEI seed는 `2401817482`다.

---

## 11. PRNG 규칙

PRNG는 다음 Mulberry32 알고리즘만 사용한다.

입력 seed는 초기화 시 `seed >>> 0`으로 한 번 정규화하고, 내부 `state`는 항상 uint32 의미로 유지한다.

uniform 한 개를 생성할 때 state는 정확히 한 번 전진하며 연산 순서는 다음과 같다.

```text
state = (state + 0x6D2B79F5) >>> 0;
t = state;
t = Math.imul(t ^ (t >>> 15), t | 1);
t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
output = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
```

`>>>`, `^`, `|`는 JavaScript bitwise 연산의 32-bit coercion을 그대로 적용하고 `Math.imul`은 signed 32-bit 곱의 하위 32-bit 결과를 사용한다. 각 문장은 위 순서대로 평가하며 중간식을 합치거나 재배열하지 않는다.

`t ^= ...`의 우변을 먼저 계산한 뒤 xor 대입하며, 마지막 `>>> 0`에서만 출력 numerator를 uint32로 바꾼다. 반환값은 `[0,1)` 범위다.

Web Crypto, `Math.random`, 외부 random package로 대체하지 않는다.

floating-point 연산을 미리 반올림하지 않는다.

Worker와 golden test는 위 JavaScript 32-bit coercion과 연산 순서를 그대로 사용한다.

PRNG 호출 횟수를 바꾸는 부가 기능을 경로 loop 안에 넣지 않는다.

진행률 계산은 난수를 소비하지 않는다.

샘플 경로 저장 여부도 난수 소비 순서에 영향을 주지 않는다.

---

## 12. 정규 난수 규칙

정규 난수는 Box–Muller transform의 cosine branch를 사용한다.

두 uniform 값이 0이면 각각 다시 뽑는다.

uniform 재추출 역시 동일 PRNG stream을 소비한다.

정규 난수 cache를 추가하지 않는다.

sine branch를 두 번째 값으로 재사용하지 않는다.

분포 library의 normal sampler로 바꾸지 않는다.

이 규칙은 golden 결과를 byte 수준으로 재현하기 위한 계약이다.

---

## 13. 4주 Spot 경로 생성

각 scenario는 현재 운임에서 시작하는 5개 점을 가진다.

점 순서는 `current, week1, week2, week3, week4`다.

각 horizon의 forecast tuple은 `point, lower90, upper90`다.

하방 scale은 `max(1, (point - lower90) / 1.645)`다.

상방 scale은 `max(1, (upper90 - point) / 1.645)`다.

week1 latent shock은 새 표준정규 `z`다.

week2 이후 latent shock은 `0.75 × previousZ + sqrt(1-0.75²) × newNormal`이다.

`z < 0`이면 하방 scale을 쓴다.

그 외에는 상방 scale을 쓴다.

Spot 운임은 `max(1, point + z × selectedScale)`이다.

각 scenario에서 네 horizon을 모두 순서대로 생성한다.

선택 horizon만 필요하다는 이유로 나머지 주차 난수 생성을 건너뛰지 않는다.

101개 후보 평가는 선택 horizon의 Spot 값만 사용한다.

상세 경로 탭은 네 horizon 전체를 사용한다.

처음 250개 scenario만 상세 sample path로 보관한다.

250개 이후에도 동일한 4주 생성 연산은 계속 수행한다.

선택 horizon의 100,000개 Spot 배열은 Float64 정밀도를 유지한다.

PI90 밖 경로 표식은 선택 Spot이 선택 horizon의 lower90 미만 또는 upper90 초과인지 뜻한다.

이 표식은 경제적 CVaR tail과 같은 개념이 아니다.

UI와 문서에서 둘을 혼용하지 않는다.

---

## 14. 후보별 비용 정의

후보 고정 비중을 `q`로 둔다.

`q`는 0.00부터 1.00까지 0.01 간격이다.

Spot 비중은 `1 - q`다.

물동량은 `V`, 고정운임은 `F`, scenario Spot은 `S`다.

총 비용은 `q × V × F + (1-q) × V × S`다.

전체 평균 예상 비용은 100,000개 총 비용의 산술평균이다.

동일 식을 정리한 `V × (qF + (1-q) × meanSpot)`을 사용할 수 있다.

정리식을 쓸 때도 `meanSpot`은 반올림하지 않은 값이어야 한다.

평균단가/FEU는 예상 비용을 V로 나눈다.

V가 0인 입력은 허용하지 않는다.

---

## 15. 경제적 후회비용 정의

Spot이 고정운임보다 낮으면 고정계약으로 잃은 기회를 하락 손실로 본다.

그 값은 `q × V × (F-S)`다.

Spot이 고정운임 이상이면 미고정 물량의 상승 비용을 상승 손실로 본다.

그 값은 `(1-q) × V × (S-F)`다.

두 경우 모두 loss는 0 이상이다.

Spot과 고정운임이 정확히 같으면 상승 분기로 들어가지만 loss는 0이다.

UI의 사람이 읽는 방향 label은 절대 차이가 0.005 미만일 때 `가격 동일`로 표시할 수 있다.

계산과 CSV branch는 strict 비교를 유지한다.

UI label tolerance가 수치 계산을 바꾸면 안 된다.

---

## 16. CVaR 90 정의

후보마다 후회비용 100,000개를 구한다.

상위 10,000개가 CVaR tail이다.

전체 sort 대신 quickselect를 사용할 수 있다.

threshold index는 `scenarioCount - tailCount`, 즉 90,000이다.

threshold보다 큰 loss를 먼저 모두 더한다.

동률 loss는 원래 scenario 순서대로 tail이 정확히 10,000개가 될 때까지 더한다.

이 tie rule을 지키지 않으면 상승/하락 분해가 달라질 수 있다.

CVaR은 선택된 10,000개 loss 합을 10,000으로 나눈 값이다.

상승 손실 합도 같은 10,000으로 나눈다.

하락 손실 합도 같은 10,000으로 나눈다.

따라서 `CVaR = 상승 손실 + 하락 손실`이 floating tolerance 안에서 성립해야 한다.

각 방향에 속한 건수로 따로 나누지 않는다.

CVaR을 운임 자체의 tail 평균으로 계산하지 않는다.

CVaR을 단순 90th percentile로 표시하지 않는다.

---

## 17. 목적함수와 추천 후보

목적함수는 `예상 비용 + riskWeight × CVaR`이다.

위험 성향 0.5는 평균비용 우선이다.

위험 성향 1은 비용·위험 균형이다.

위험 성향 2는 위험 방어 우선이다.

후보는 고정 0%부터 100%까지 오름차순으로 평가한다.

현재 best보다 목적함수가 엄격히 작을 때만 갱신한다.

목적함수가 정확히 같으면 더 낮은 고정 비중이 유지된다.

결과는 101개 후보 전체와 추천 후보 index를 함께 보존한다.

선택된 horizon Spot 배열과 처음 250개 path도 보존한다.

baseline과 meanSpot은 내부 결과에 보존한다.

기본 UI에 baseline을 새 KPI로 임의 추가하지 않는다.

---

## 18. 위험 성향 표시 문구

위험 성향 0.5의 이름은 `평균비용 우선`이다.

설명은 `평소 예상 조달비용이 낮은 배분을 우선합니다.`다.

위험 성향 1의 profile 이름은 `비용·위험 균형`이다.

drawer select option에서만 `비용·위험 균형 · 권장`으로 표시한다.

설명은 `평균비용과 Spot 급등·하락 위험을 함께 고려합니다.`다.

위험 성향 2의 이름은 `위험 방어 우선`이다.

설명은 `평균비용이 조금 늘더라도 극단적인 손실을 줄이는 배분을 우선합니다.`다.

기본 선택은 1이다.

표시 문구를 `안정형`, `공격형`처럼 재해석하지 않는다.

---

## 19. 결과 계약

Worker `done` root는 다음 필드를 정확히 담는다.

- `type: "done"`
- `results`: fixed share 0~100 오름차순 101개 candidate
- `best`: `results` 안의 추천 candidate
- `meanSpot`
- `baseline = volume × fixed`
- `riskWeight`
- `tailCount = 10,000`
- `spots`: 선택 horizon의 `Float64Array(100,000)`
- `samplePaths`: 처음 250개 4주 path와 PI90 outside flag
- `rho = 0.75`

scenario count, candidate count, 추천 Spot share, 평균단가/FEU, Spot이 fixed보다 큰 확률은 위 root와 `lastInput`에서 UI가 파생한다. Worker 결과에 계약에 없는 중복 field를 추가하지 않는다.

모든 계산값은 number 상태로 유지하고 렌더 단계에서만 표시 반올림한다.

결과 JSON 직렬화 때문에 Float64Array가 일반 배열로 바뀌는 경계를 명시한다.

Worker transfer를 사용할 때 buffer ownership을 한 번만 넘긴다.

상세 dialog가 닫혀도 main result에 필요한 배열을 잃지 않는다.

---

## 20. 계산 runtime 상태기계

runtime state는 `result`, `lastInput`, `progress`, `running`, `error` 조합으로 표현한다.

| 조합 | 의미 |
|---|---|
| `result=null, running=false, error=null` | 최초 effect 직전의 짧은 준비 상태 |
| `result=null, running=true, error=null` | Blob Worker 계산 중 |
| `result!=null, running=false, error=null` | 현재 run 완료 |
| `result=null, running=false, error!=null` | 현재 run 실패 |

`idle`과 `error`를 같은 빈 카드로 표현하지 않는다.

새 run 시작 시 sequence ID를 1 증가시킨다.

기존 Worker가 있으면 terminate한다.

새 run에서 error를 null로 만든다.

새 run 시작과 동시에 `result=null`로 만든다.

이전 성공 결과를 stale card나 background result로 보존하지 않는다.

상세 dialog는 닫는다.

progress는 2%에서 시작한다.

검증된 immutable input을 `lastInput`에 저장한다.

메시지마다 sequence ID를 비교한다.

stale sequence의 progress, done, error는 모두 무시한다.

unmount 이후 state update를 하지 않는다.

---

## 21. Blob Worker 계약

계산 Worker는 `Blob`과 object URL로 생성한다.

별도 module Worker, server simulation, cooperative main-thread fallback을 추가하지 않는다.

`createCvarSimulationWorker()`의 반환값은 `{worker, dispose}`이며 `dispose`는 해당 object URL을 revoke한다.

Worker 입력은 `forecasts`, `current`, `selectedHorizon`, `fixed`, `volume`, `alpha`, `riskWeight`, `seed`, `rho`다.

Worker 출력은 `progress` 또는 `done`이다. runtime exception은 `worker.onerror`로 처리한다.

`done`에서 `spots.buffer`를 transferable로 main thread에 넘기고, `results`, `best`, `meanSpot`, `baseline`, `riskWeight`, `tailCount`, `samplePaths`, `rho`를 함께 반환한다.

새 run을 시작하면 기존 Worker를 `terminate()`하고 기존 object URL을 `dispose()`한다.

정상 `done`, `worker.onerror`, unmount에서도 Worker와 object URL을 정리한다.

Worker 오류의 사용자 문구는 정확히 `시뮬레이션 계산 중 오류가 발생했습니다. 다시 실행해 주세요.`다.

Worker 생성 실패용 별도 UI, timeout, retry button, fallback mode를 승인 기능인 것처럼 만들지 않는다.

---

## 22. stale run 차단

매 실행 때 `runSequenceRef`를 1 증가시킨다.

message와 error handler는 자신이 시작될 때 캡처한 sequence와 현재 sequence가 다르면 아무 state도 변경하지 않는다.

route·대표모델·예측 seam 변경으로 새 run이 시작되면 이전 run의 늦은 progress/done/error는 모두 폐기한다.

새 run 시작 시 `running=true`, `error=null`, `result=null`, `detailOpen=false`, `progress=2`, `lastInput=next` 순서의 의미를 보존한다.

---

## 23. resource 정리

정상 완료와 오류에서 Worker를 terminate하고 object URL을 revoke한다.

unmount에서도 현재 Worker를 terminate·dispose하고 Worker handle을 null로 만든다.

여러 번 재계산해도 Worker와 object URL이 누적되지 않아야 한다.

---

## 24. 진행률 계약

progress는 0–100 정수로 렌더한다.

경로 생성 stage는 약 2–28%다.

기준 raw path milestone 0, 20,000, 40,000, 60,000, 80,000을 유지한다.

해당 stage raw fraction은 0, .056, .112, .168, .224다.

후보 0% 완료 시 28%다.

후보 10%부터 90%까지는 대략 35–91%로 증가한다.

후보 100%에서 98%다.

done message에서 100%가 된다.

30% 미만 stage 문구는 `운임경로 생성 중`이다.

30% 이상 stage 문구는 `배분비율 평가 중`이다.

progress는 뒤로 가지 않는다.

로딩 애니메이션만 있고 수치가 없는 구현은 허용하지 않는다.

승인 Figma/PNG에는 별도 `role="progressbar"`/`aria-valuenow` 표시가 없다. 이를 parity 필수로 추가하지 않는다.

---

## 25. page 초기 상태

선택 horizon 기본값은 1주다.

volume 기본값은 1,000 FEU다.

fixed rate 기본값은 `round(1주 point × 1.035)`다.

fixed rate 최소값은 1이다.

risk weight 기본값은 1이다.

drawer는 닫혀 있다.

detail dialog는 닫혀 있다.

detail tab 기본값은 비중별 결과다.

result와 lastInput은 없다.

progress는 0이다.

running은 false다.

error는 없다.

페이지 mount 직후 기본 입력으로 자동 계산을 시작한다.

allocation draft와 result는 localStorage에 저장하지 않는다.

전역 route/model selection만 상위 앱 계약을 따른다.

---

## 26. 자동 재실행 경계

route가 변경되면 자동 재실행한다.

`RepresentativeSelectionV1`의 allocation-effective key가 변경되면 자동 재실행한다.

route/current/modelName/score1w/coverage1w 또는 네 forecast가 바뀌면 자동 재실행한다. modelVersion, forecastSource, tuningRunHash, evaluationProtocol, representativeRevision만 바뀌고 effective field가 그대로면 재실행하지 않는다.

네 forecast의 targetDate, point, lower90, upper90 중 하나가 변경돼도 자동 재실행한다.

WT3 keep/rollback도 allocation-effective key가 바뀔 때만 정확히 한 번 자동 재실행한다.

이 경우 fixed rate를 새 선택 horizon point의 103.5% 반올림 값으로 재설정한다.

현재 horizon, volume, risk weight는 보존한다.

horizon 변경만으로는 자동 실행하지 않는다.

volume 변경만으로는 자동 실행하지 않는다.

fixed rate 변경만으로는 자동 실행하지 않는다.

risk weight 변경만으로는 자동 실행하지 않는다.

이 네 draft 변경은 사용자가 실행 버튼을 눌러야 반영된다.

horizon을 바꾸는 즉시 fixed draft는 해당 horizon point의 103.5%로 재설정한다.

drawer가 열린 상태에서 route를 바꾸면 상위 route도 즉시 변경된다.

그 결과 자동 run이 시작되어도 drawer는 열린 상태를 유지할 수 있다.

---

## 27. drawer draft와 취소 의미

drawer의 필드는 page draft 자체를 편집한다.

닫기, 취소, X, Escape는 draft를 이전 값으로 되돌리지 않는다.

이 행동은 현재 런타임 계약이다.

취소를 rollback처럼 구현하지 않는다.

이름이 오해를 부를 수 있으므로 QA에 이 의미를 명시한다.

이전 결과는 재실행 전까지 `lastInput` 기준으로 유지한다.

drawer draft label을 이전 결과 위에 덮어쓰지 않는다.

실행 버튼을 누르면 drawer를 닫고 새 계산을 시작한다.

number input은 `Math.max(1, Number(value))`로 최소값을 적용한다. 별도 field error UI나 오류 focus 이동을 추가하지 않는다.

---

## 28. 상단 입력 요약 strip

eyebrow는 `ANALYSIS INPUT`이다.

route name과 route code를 함께 표시한다.

대표모델 이름을 표시한다.

모델 품질 문구는 `1주 종합점수 x.x점 · Coverage y.y%` 형식이다.

선택 horizon을 `n주`로 표시한다.

volume은 천 단위 separator와 `FEU`를 표시한다.

fixed rate는 통화 형식과 `USD/FEU` 의미를 표시한다.

running이면 진행 stage와 percent를 표시한다.

우측 primary button 문구는 `데이터 입력`이다.

요약 strip은 카드처럼 과도하게 분절하지 않는다.

desktop에서 최소 높이는 78px다.

padding은 세로 16px, 가로 20px다.

item gap은 18px다.

하단 margin은 22px다.

좁은 화면에서 정보와 action이 자연스럽게 wrap되어야 한다.

---

## 29. 입력 drawer 표시 내용

drawer는 body portal로 렌더한다.

semantic role은 dialog다.

`aria-modal=true`를 사용한다.

accessible label은 `배분 분석 데이터 입력`이다.

eyebrow는 `DECISION INPUT`이다.

title은 `배분 분석 데이터 입력`이다.

description은 `고정 물동량과 고정운임, 판단 시점 및 추천 성향을 입력합니다.`다.

field 순서는 다음과 같다.

1. `항로`
2. `판단 시점`
3. `고정 물동량`
4. `고정계약 운임`
5. `추천 성향`

항로 select는 상위 route 목록을 사용한다.

판단 시점은 1주, 2주, 3주, 4주다.

volume input은 min 1, step 10이다.

fixed input은 min 1, step 1이다.

risk profile은 §18의 세 표시 문구를 사용한다.

### 29.1 field 값과 화면 반영 기준

| field | option/value | 변경 시 의미 |
|---|---|---|
| 항로 | canonical 13개 route; visible option은 `{routeName} · {routeId}` | WT1 shared `changeRoute(routeId)` seam을 즉시 호출 |
| 판단 시점 | `1주`, `2주`, `3주`, `4주` | 선택 horizon을 바꾸고 fixed draft를 해당 주 point×1.035 반올림으로 즉시 재설정; 아직 계산은 실행하지 않음 |
| 고정 물동량 | number, min 1, step 10, unit `FEU` | 다음 실행의 모든 비용 금액에 사용 |
| 고정계약 운임 | number, min 1, step 1, unit `USD/FEU` | 다음 실행의 fixed cost·손실 방향·초과확률 기준 |
| 추천 성향 | `0.5`, `1`, `2` | 다음 실행의 `expected + riskWeight×CVaR` 비교에 사용 |

항로를 바꾸는 지정 transaction은 다음 순서다.

1. drawer select가 WT1 shared `changeRoute(routeId)` seam을 호출한다.
   WT1 seam은 한 transaction에서 shared route state를 갱신하고 canonical route를 `STORAGE_KEYS.route`에 저장하며 현재 query를 replace하고 shared route-change publication을 발행한다.
   WT5는 localStorage나 history를 직접 읽고 쓰는 private route transaction을 구현하지 않는다.
2. WT3 selector가 새 route의 manual 대표모델이 유효하면 그것을, 아니면 새 route의 1주 automatic champion을 반환한다.
3. 선택한 동일 model ID의 1·2·3·4주 forecast 네 개를 가져온다. 주차별로 다른 모델을 섞지 않는다.
4. summary의 항로·대표모델·1주 점수·Coverage, drawer의 네 forecast 카드, comparison badge/lines, path chart input이 새 route 값으로 함께 바뀐다.
5. 현재 `horizon`, `volume`, `riskWeight`는 유지한다.
6. `fixed`는 새 route의 현재 선택 horizon `round(point×1.035)`로 재설정한다.
7. 이전 Worker를 terminate/dispose하고 새 route 계산을 자동 시작한다.
8. drawer는 자동으로 닫지 않는다. 실행 중에도 새 route의 입력과 네 forecast card를 보여준다.
9. 이전 route Worker의 늦은 progress/done/error는 sequence가 달라 폐기한다.

항로 변경 뒤 일부 영역만 이전 route 값을 유지하거나, fixed만 이전 route 값을 유지하거나, 이전 result를 새 route label 아래 표시하면 실패다.

최초 페이지 진입의 route 해석 우선순위 valid URL query → valid `STORAGE_KEYS.route` → `KNEI`와 query/storage 정규화도 WT1 shared route seam이 단독 소유한다. WT5는 검증된 route state만 소비하며 invalid query/storage를 자체 해석하지 않는다.

Dashboard·Models·Network·Allocation 사이를 이동해도 같은 route query가 유지되고 새로고침 뒤 같은 항로가 복원돼야 한다.

### 29.2 summary에서 draft와 실행값 구분

summary의 판단시점·물동량·고정운임은 완료/실행 중인 `lastInput`이 있으면 그 값을 먼저 표시한다.

drawer에서 값을 수정만 하고 실행하지 않은 동안에는 기존 result와 summary가 기존 `lastInput`을 유지한다.

항로·대표모델 표시만 상위 route seam 변경을 즉시 반영한다. 이 때문에 route select는 일반 draft field와 달리 즉시 자동 run을 시작한다.

---

## 30. drawer 예측 미니카드

section label은 `대표모델 1~4주 예측`이다.

미니카드는 정확히 네 개다.

각 카드는 주차를 표시한다.

각 카드는 point forecast를 USD/FEU로 표시한다.

각 카드는 PI90 lower와 upper를 표시한다.

선택 horizon 카드는 시각적으로 강조한다.

네 카드에 서로 다른 모델명을 붙이면 안 된다.

미니카드에는 target date, 모델명, score, Coverage를 추가하지 않는다.

PI90을 confidence가 보장된 실제 견적 범위로 표현하지 않는다.

proxy 설명은 다음 문구를 그대로 사용한다.

`선택 항로 대표모델의 1·2·3·4주 점예측과 PI90을 시뮬레이션 중심과 변동 폭으로 사용합니다. KCCI는 개별 선사의 실제 Spot 견적이 아닌 시장운임 대용변수입니다.`

footer secondary button은 `취소`다.

footer primary button은 `100,000개 분석 실행`이다.

running 중 primary 문구는 `분석 실행 중…`이다.

running 중 중복 실행을 막는다.

---

## 31. drawer interaction

desktop drawer width는 `min(540px, 100vw)`다.

높이는 viewport 전체다.

Escape는 drawer를 닫는다.

overlay 바깥을 직접 누르면 닫는다.

drawer 내부 mousedown은 닫기를 유발하지 않는다.

drawer가 열리면 body scroll을 잠근다.

기존 body overflow 값을 복원한다.

승인 상호작용에는 initial focus 이동, focus trap, 닫힌 뒤 trigger focus 복원이 없다. parity 구현에서 이 동작을 새로 추가하지 않는다.

---

## 32. 추천 비중 카드

eyebrow는 `RECOMMENDED MIX`다.

title은 `고정운임·Spot 권고 비중`이다.

description은 `예상 비용과 불리한 상황의 후회비용을 함께 고려합니다.`다.

상태 label은 상황별로 `준비 중`, `계산 중`, `계산 완료`, `계산 오류`다.

donut 중심에는 추천 fixed percent를 큰 숫자로 표시한다.

행 1은 `고정운임`과 fixed percent다.

행 2는 `Spot 대응`과 spot percent다.

행 3은 `분석 경로`와 `100,000개`다.

fixed와 spot 합은 항상 100%다.

완료 전 donut와 비중 row는 `0%`, KPI는 `—`를 표시하고 상세 버튼은 disabled다.

계산 중 reason 문구는 `100,000개 운임경로와 101개 배분안을 계산하고 있습니다.`다.

완료 reason은 `${profile.name} 기준에서 예상 비용 ${expected}과 후회비용 ${cvar}을 함께 반영한 최종 총비용 ${objective}이 101개 배분안 중 가장 낮습니다.` 형식이다.

---

## 33. 결과 KPI 4개

KPI 순서는 고정한다.

첫 KPI label은 `예상 비용`이다.

첫 KPI helper는 `100,000개 전체 평균`이다.

첫 HelpBubble 본문은 `100,000개 운임경로의 평균 조달비용입니다.`다.

둘째 KPI label은 `Spot 고정운임 초과확률`이다.

둘째 helper는 `100,000개 경로 기준`이다.

둘째 HelpBubble 본문은 `선택 시점의 Spot 운임이 입력 고정운임보다 높은 경로 비율입니다.`다.

확률은 strict `S > F` scenario 비율이다.

셋째 KPI label은 `후회비용`이다.

셋째 helper는 `최악 10,000개 평균`이다.

셋째 HelpBubble 본문은 `불리한 10% 경로의 평균 경제손실인 CVaR90입니다.`다.

넷째 KPI label은 `최종 총비용`이다.

넷째 helper는 선택한 risk profile 이름이다.

넷째 HelpBubble 본문은 `예상 비용에 위험 반영 강도만큼 후회비용을 더한 비교점수입니다.`다.

최종 총비용은 `expected + weight × CVaR` 비교 점수다.

실제 invoice나 확정 지출로 오해하지 않도록 help를 제공한다.

currency compact 표시는 `$4.85M`, `$176K` 형식을 따른다.

tooltip 또는 상세 표에서는 더 정밀한 값을 제공한다.

detail button 문구는 `시뮬레이션 상세 결과 보기`다.

result가 없거나 running이면 detail button을 disabled 처리한다.

### 33.1 추천 카드 value mapping

| visible 영역 | 기준값 |
|---|---|
| donut와 고정운임 row | `result.best.share` |
| Spot 대응 row | `100 - result.best.share` |
| 분석 경로 | literal `100,000개` |
| 예상 비용 | `result.best.expected` |
| Spot 고정운임 초과확률 | `100 × count(result.spots > lastInput.fixed) / result.spots.length` |
| 후회비용 | `result.best.cvar` |
| 최종 총비용 | `result.best.objective` |
| 위험 성향 helper/reason | `RISK_PROFILES[lastInput.riskWeight].name` |

KPI와 reason이 서로 다른 run이나 현재 drawer draft를 섞어 읽으면 실패다. 모두 같은 `result`와 `lastInput`에서 렌더한다.

---

## 34. 메인 2열 geometry

desktop decision grid는 `1fr 1.12fr`다.

column gap은 22px다.

양쪽 주요 카드는 min-height 550px다.

카드 padding은 세로 22px, 가로 24px다.

카드 radius는 18px다.

배경은 canvas token을 사용한다.

shadow는 공통 neumorphic token을 사용한다.

1280px 이하에서 한 열로 전환한다.

한 열에서는 min-height 강제를 제거한다.

추천 ratio 영역은 desktop에서 205px와 나머지 영역이다.

donut 외경은 195px다.

donut inner inset은 30px다.

donut 중심 percent font는 34px다.

KPI grid는 desktop에서 2열이다.

KPI padding은 14px다.

KPI value font는 19px다.

---

## 35. 고정운임 대 Spot 비교 차트

eyebrow는 `CONTRACT VS SPOT`이다.

title은 `고정운임 vs Spot 전망`이다.

description은 `${horizon}주 운임 전망 · PI90과 입력 고정운임을 비교합니다.` 형식이다.

우측 action badge에는 대표모델의 `modelName`만 표시한다. version·provenance·selection mode badge는 추가하지 않는다.

차트는 selected horizon의 lower90, point, upper90, fixed를 같은 scale에 표시한다.

y축 domain은 네 값의 min/max를 구하고 `max(8, range×0.24, rawMax×0.035)` padding을 상·하에 적용하며 하한은 0보다 작아지지 않게 한다.

배경 horizontal grid line은 위에서 아래까지 정확히 다섯 개이며 왼쪽에 해당 USD tick label을 표시한다.

기준 SVG viewBox는 720×300이다.

plotLeft는 72다.

plotRight는 500이다.

plotTop은 30이다.

plotBottom은 248이다.

lower 색은 `#087352`다.

upper 색은 `#d64545`다.

point 색은 `#3fa1eb`다.

fixed 색은 `#7c3aed`다.

lower와 upper guide는 dashed style이다.

point와 fixed guide는 solid style이다.

네 값 모두 plotRight 끝에 같은 색 circle을 갖고 오른쪽에 `상한 ($...)`, `점예측 ($...)`, `하한 ($...)`, `고정운임 ($...)` label을 표시한다.

label 간 최소 vertical gap은 25px다.

label을 옮겼다면 원래 데이터 위치와 connector로 연결한다.

값 label이 겹친 채로 두지 않는다.

footer 첫 칸은 `Spot 운임 전망 범위`와 `{lower} → {upper}`, 둘째 칸은 `입력 고정운임`과 `{fixed} / FEU`다.

하단에는 `점예측 {point} / FEU`와 `예측 대상 {YYYY.MM.DD}`를 표시한다.

comparison chart SVG의 min-height는 285px다. 양쪽 상위 decision card의 min-height는 §34의 550px다.

horizontal range bar 하나로 단순화하지 않는다.

---

## 36. 계산 흐름 안내

흐름은 정확히 세 단계다.

1단계 문구는 `100,000개 4주 운임경로 생성`이다.

2단계 문구는 `선택 시점에서 101개 배분비율 평가`다.

3단계 문구는 `최종 총비용이 낮은 비중 추천`이다.

각 단계는 번호와 연결선을 갖는다.

모바일에서도 순서가 보존된다.

이 영역을 일반 설명 paragraph 하나로 합치지 않는다.

---

## 37. 101개 spectrum 차트

eyebrow는 `FIXED–SPOT SPECTRUM`이다.

title은 `고정운임 0%에서 100%까지 비교`다.

description은 `100,000개 운임 시나리오에 101개 배분비율을 적용합니다.`다.

legend 표시 순서는 `예상 비용`, `후회비용`, `최종 총비용`, `Spot 상승손실`, `Spot 하락손실`이다.

기준 SVG viewBox는 920×360이다.

padding은 left 76, right 76, top 42, bottom 48이다.

x축은 fixed 0%부터 100%다.

각 1% 후보가 정확히 하나의 data point다.

visible x tick label은 `0%`, `20%`, `40%`, `60%`, `80%`, `100%`다.

추천 비중을 중심으로 ±2.5% 너비 band를 그린다.

추천 share에는 vertical line과 `추천 {share}%` label을 표시한다.

추천 expected, objective, CVaR 위치에 서로 다른 색·크기의 circle 세 개를 표시한다.

왼쪽 y축은 expected와 objective를 공유한다.

왼쪽 axis title은 `예상·최종 총비용`이다.

왼쪽 domain은 두 series의 min/max에 12% padding을 더한다.

오른쪽 y축은 CVaR다.

오른쪽 axis title은 `후회비용`이다.

오른쪽 max는 CVaR max의 1.12배다.

expected line은 cyan 계열이다.

objective line은 purple 계열이다.

CVaR line은 navy 계열이다.

상승 risk area는 red 계열이다.

하락 risk area는 cyan 계열이다.

하락 area는 `0 → down`, 상승 area는 `down → down+up`의 누적 영역으로 그린다. 이를 expected/objective 금액 축의 면적으로 잘못 그리지 않는다.

single y-axis로 모든 값을 억지로 합치지 않는다.

viewBox를 760×338 같은 임의 geometry로 바꾸지 않는다.

---

## 38. spectrum hover

pointer 위치를 가장 가까운 integer fixed percent로 반올림한다.

0–100 범위를 clamp한다.

tooltip에는 fixed percent가 있다.

tooltip에는 spot percent가 있다.

tooltip에는 expected cost가 있다.

tooltip에는 average cost/FEU가 있다.

tooltip에는 CVaR가 있다.

tooltip에는 objective가 있다.

tooltip에는 상승 손실과 하락 손실이 있다.

tooltip horizontal position은 `left: clamp(24%, hovered.share%, 76%)` 의미로 제한해 양끝에서 잘리지 않게 한다.

pointer leave에서 tooltip을 지운다.

hover는 tooltip만 변경한다. 추천 band·추천 vertical line·추천 세 point는 고정되어 있으며 hover guide나 hover marker를 추가하지 않는다.

현재 SVG의 `tabIndex=0`은 보존하지만 Arrow/Page/Home/End 후보 이동이나 keyboard tooltip을 새로 구현하지 않는다.

---

## 39. 상승·하락 위험 분해

추천 후보의 CVaR를 두 component로 나눠 표시한다.

첫 카드 visible title은 `Spot 상승손실`이다.

첫 설명은 `Spot 운임이 고정운임보다 높을 때 Spot 배분에서 발생하는 추가비용`이다.

둘째 카드 visible title은 `Spot 하락손실`이다.

둘째 설명은 `Spot 운임이 낮을 때 고정 배분으로 놓친 비용절감 기회`다.

두 표시값의 합은 후회비용 KPI와 rounding tolerance 안에서 일치한다.

bar 길이는 전체 CVaR 대비 비율이다.

양수인 매우 작은 값도 최소 4% 시각 폭을 갖는다.

시각 최소 폭 때문에 실제 비율 label을 조작하지 않는다.

0은 0 폭과 `$0`로 표시한다.

모바일에서는 두 카드가 한 열로 쌓인다.

---

## 40. 상세 dialog shell

상세는 body portal로 렌더한다.

semantic element는 dialog 역할을 가진다.

`aria-modal=true`를 사용한다.

accessible label은 `100,000개 시뮬레이션 상세 결과`다.

eyebrow는 `SIMULATION RESULT TRACE`다.

title은 `100,000개 시뮬레이션 상세 결과`다.

description은 `추천 비중을 만든 101개 배분안과 운임경로 분포를 확인합니다.`다.

header action은 `추천 비중 CSV`와 close다.

desktop size는 `min(1180px, calc(100vw - 30px))`다.

desktop max height는 `min(800px, calc(100dvh - 30px))`다.

radius는 22px다.

승인 geometry대로 dialog header, stats, tab strip은 flex 고정 영역이다. allocation table, paths panel, method panel은 각각 남은 높이 안에서 scroll한다. allocation table header는 vertical scroll 중 상단에 고정한다.

---

## 41. 상세 dialog summary stats

상단 stats는 다음 다섯 개다.

- `미래 Spot 경로` — `100,000개`
- `배분비중 후보` — `101개`
- `총 비용 평가` — `10,100,000건`
- `꼬리 기준` — `CVaR 90`
- `추천 배분` — `고정 ${share}%`

900px 이하에서 stats는 3열로 바뀐다.

마지막 stat은 2열을 span한다.

640px 이하에서 2열로 바뀐다.

마지막 stat은 전체 row를 span한다.

숫자를 `약 1천만`으로만 축약하지 않는다.

---

## 42. 상세 tab 계약

tab은 정확히 세 개다.

첫 tab은 `비중별 결과 101개`다.

둘째 tab은 `운임경로 분포`다.

셋째 tab은 `계산 방법`이다.

semantic tablist, tab, tabpanel 관계를 구현한다.

선택된 tab은 `aria-selected=true`다.

tabpanel은 연결된 tab ID를 `aria-labelledby`로 참조한다.

dialog open 시 첫 tab 또는 직전 명시 상태가 아니라 계약상 첫 tab을 선택한다.

Escape는 detail dialog를 먼저 닫는다.

detail과 drawer가 동시에 열릴 수 없도록 orchestration한다.

승인 상호작용은 tab click과 일반 Tab 이동만 제공한다. Arrow/Home/End tab navigation, focus trap, opener focus 복원을 추가하지 않는다.

---

## 43. 비중별 결과 표

표는 101개 후보를 fixed 0%부터 100%까지 표시한다.

column 순서는 다음과 같다.

1. `배분비율`
2. `예상 비용`
3. `평균단가/FEU`
4. `후회비용`
5. `Spot 상승손실`
6. `Spot 하락손실`
7. `최종 총비용`

table min-width는 850px다.

좁은 viewport에서는 dialog 내부 horizontal scroll을 쓴다.

table header는 vertical scroll 중 sticky다.

추천 row는 승인 PNG와 동일한 background와 `추천` text badge로 강조한다. 승인 화면에 없는 별도 border를 추가하지 않는다.

색만으로 추천 여부를 전달하지 않는다.

dialog open 또는 이 tab 선택 시 추천 row를 중앙 부근으로 scroll한다.

layout 완료 뒤 requestAnimationFrame 시점에 scroll한다.

101개 모두 실제 결과를 표시한다.

10% 간격으로 샘플링한 11개만 표시하지 않는다.

table의 `예상 비용` HelpBubble은 `100,000개 운임경로의 평균 조달비용입니다.`다.

table의 `후회비용` HelpBubble은 `불리한 10,000개 경제손실의 평균인 CVaR90입니다.`다.

---

## 44. 운임경로 분포 차트

section eyebrow는 `JOINT 4-WEEK PATHS`다.

title은 `${route.name} · 4주 운임경로`다.

description은 `PI90 폭과 주간 연결성을 반영한 미래 운임경로입니다.`다.

우측 badge는 `100,000개 생성 완료`다.

SVG viewBox는 900×300이다.

padding은 left 72, right 28, top 35, bottom 44다.

y domain은 current, 네 horizon의 lower/upper, 250개 sample path 전체값의 min/max에 span×8% padding을 적용하고 하한은 0보다 작아지지 않게 한다.

horizontal grid line과 y tick은 정확히 다섯 개다.

처음 250개 sample path를 현재부터 week4까지 그린다.

current는 모든 path의 동일 시작점이다.

대표모델 point path를 강조한다.

각 horizon의 PI90은 해당 주차 x 위치에 vertical interval line과 상·하단 cap으로 표시한다. 주차 사이를 채운 연속 면적 band를 새로 만들지 않는다.

선택 horizon에는 폭 140의 vertical focus band를 두고 plot 좌우 경계를 넘지 않도록 clamp한다.

선택 horizon PI90 밖으로 끝난 sample은 tail visual style로 구분한다.

이 visual tail을 CVaR tail이라고 label하지 않는다.

정상 sample과 outside sample의 legend를 제공한다.

legend 표시 순서는 `모델 점예측`, `PI90`, `일반 경로`, `PI90 밖 꼬리 경로`다.

하단 meta 첫 줄은 `대표모델 {modelName} · 1~4주 PI90 반영`이다.

둘째 줄은 `계산 100,000개 · 화면 표시 250개 · 시차상관 0.75` 형식이다.

모바일 chart는 horizontal scroll을 허용한다.

모바일 SVG min-width는 680px다.

path 수를 viewport에 따라 줄이지 않는다.

선택 horizon focus band와 `판단 시점 {n}주` label을 표시한다. fixed-rate guide는 이 경로 차트에 추가하지 않는다.

판단시점 label x도 좌우 62px 여백 안으로 clamp한다.

---

## 45. 운임 percentile 계산

percentile 표는 선택 horizon Spot 100,000개를 사용한다.

정렬은 detail dialog가 열리고 paths tab이 선택될 때 lazy 수행한다.

메인 화면 계산 완료만으로 불필요한 전체 sort를 하지 않는다.

정렬은 `open && tab === "paths" && result`일 때만 `Array.from(result.spots).sort(...)`로 계산한다. dialog를 닫거나 다른 tab으로 이동하면 별도 영속 cache를 유지하지 않는다.

percentile 목록은 P1, P5, P10, P25, P50, P75, P90, P95, P99다.

index는 `round((n-1) × p)`다.

보간 percentile로 바꾸지 않는다.

표의 정확한 7개 열은 `운임 분위수`, `Spot 운임/FEU`, `고정운임 대비`, `추천비중 총비용`, `실효단가/FEU`, `경제손실`, `손실 방향`이다.

절대 차이가 0.005 미만이면 UI 방향은 `가격 동일`이다.

그 외 S < F면 visible direction은 `Spot 하락손실`이다.

그 외는 `Spot 상승손실`이다.

정렬은 paths tab이 열린 동안 synchronous `useMemo`로 수행한다. 별도 sorting loading/error 상태를 만들지 않는다.

---

## 46. 계산 방법 탭 표시 블록

계산 방법 tab에는 여섯 개 번호 block이 있다.

각 block의 title과 formula는 다음 문자열과 일치한다.

1. `PI90을 주차별 변동 폭으로 변환` — `하락폭=(점예측-하한)÷1.645 · 상승폭=(상한-점예측)÷1.645`
2. `비대칭 Spot 운임 생성` — `Spotₜ=점예측ₜ+Zₜ×상승·하락 변동폭ₜ`
3. `주차 간 시차상관 적용` — `Zₜ=0.75×Zₜ₋₁+0.661×새 충격`
4. `현재부터 4주까지 경로 연결` — `현재 → 1주 → 2주 → 3주 → 4주`
5. `101개 고정·Spot 비중별 비용 평가` — `비용ᵢ=물동량×[고정비중×고정운임+Spot비중×Spotᵢ]`
6. `CVaR90 후회비용과 최종 총비용 계산` — `후회ᵢ=현재 배분비용ᵢ-min(전량 고정비용, 전량 Spot비용ᵢ)`

상단 설명은 `주차별 점예측과 PI90으로 연결된 Spot 운임경로 100,000개를 만든 뒤, 같은 경로에 고정운임 비중 0~100%의 101개 배분안을 적용해 평균비용과 최악 10%의 후회비용을 비교합니다.`다.

주의 box title은 `해석 주의`다.

주의 본문은 `PI90만으로 미래 운임의 전체 확률분포가 결정되는 것은 아닙니다. 표준정규분포와 주간 상관 0.75는 현재 데모 가정이며 실제 운영 단계에서는 rolling-backtest 잔차로 보정해야 합니다.`다.

설명 tab을 일반 마케팅 문구로 대체하지 않는다.

---

## 47. CSV 다운로드 계약

CSV는 추천 후보 하나와 선택 horizon의 100,000개 scenario를 직렬화한다.

네 주차 path 전체를 CSV에 넣지 않는다.

101개 후보 summary를 같은 CSV에 섞지 않는다.

header는 정확히 다음 순서다.

`scenario,route,horizon_weeks,fixed_share_pct,spot_share_pct,spot_rate_usd_feu,fixed_cost_usd,spot_cost_usd,total_cost_usd,economic_loss_usd,loss_direction`

데이터 행은 정확히 100,000개다.

header를 포함한 총 행은 100,001개다.

scenario는 1부터 100,000까지다.

route는 canonical route code다.

horizon은 lastInput selected horizon이다.

fixed와 spot share는 integer percent다.

모든 운임·비용 numeric field는 `toFixed(2)` 의미로 직렬화한다.

loss direction은 S < F일 때 `spot_down_opportunity`다.

그 외에는 `spot_up_cost`다.

S = F이면 loss 0이고 `spot_up_cost`다.

파일은 UTF-8 BOM으로 시작한다.

줄바꿈은 LF로 고정한다.

파일명은 `cvar-simulation-{route}-{horizon}w-fixed-{share}pct.csv`다.

CSV formula injection을 막기 위해 route field가 위험 prefix를 갖지 않도록 canonical enum을 사용한다.

현재 main thread에서 header 배열과 100,000개 row 문자열을 만든 뒤 한 번에 Blob으로 생성한다.

별도 CSV Worker, chunked progress, `CSV 생성 중` UI를 추가하지 않는다.

download object URL은 사용 후 revoke한다.

---

## 48. 시각 token

핵심 navy는 `#001290`다.

blue는 `#15269d`다.

cyan은 `#3fa1eb`다.

ink는 `#141415`다.

muted는 `#63666a`다.

canvas는 `#f1f2f9`다.

dark shadow token은 `rgba(21, 38, 157, 0.13)`다.

soft dark shadow token은 `rgba(20, 20, 21, 0.08)`다.

light shadow token은 `rgba(255, 255, 255, 0.9)`다.

`.inputSummary`와 main `.card` radius는 desktop 18px다.

drawer의 input/select radius는 10px다.

기본 neumorphic shadow는 `10px 10px 24px` dark와 `-10px -10px 24px` light 조합이다.

badge min-height는 22px다.

badge horizontal padding은 8px다.

badge는 pill radius다.

badge font size는 9px다.

일반 primary/detail button min-height는 40px이고 detail header action은 38px다. 승인 geometry를 44px로 임의 확대하지 않는다.

button horizontal padding은 15px다.

button radius는 10px다.

button font size는 11px다.

section title desktop font size는 18px다.

모바일 section title은 16px다.

브랜드 token을 비슷한 임의 색으로 치환하지 않는다.

---

## 49. viewport 검증 우선순위

시각 parity의 주 기준은 다음 두 viewport다.

| 구분 | viewport | 목적 |
|---|---|---|
| PRIMARY | 1440×900 | desktop geometry, drawer, dialog, chart parity |
| PRIMARY | 375×812 | 실제 mobile stacking, chart/table scroll, overlay parity |
| SMOKE | 900×900 | summary wrap과 dialog stats breakpoint 오류 확인 |
| SMOKE | 640×900 | compact breakpoint 앞뒤의 잘림·overflow 확인 |

모든 검수 이미지는 동일 browser, 동일 font loading 완료, DPR 1 기준으로 생성한다.

animation과 cursor blink를 정지한다.

timezone은 Asia/Seoul로 고정한다.

locale은 `ko-KR`로 고정한다.

fixture는 KNEI golden을 사용한다.

각 이미지는 해당 deterministic state marker를 기다린 뒤 캡처한다.

1440과 375는 ready·drawer·detail 3 tabs·Spectrum hover·Worker error를 승인 PNG와 직접 비교한다.

900과 640은 전체 시각 세트를 만들지 않고 page overflow, action clipping, dialog bounds, chart/table scroll만 확인한다.

---

## 50. responsive 규칙

1280px 이하에서 main decision grid는 한 열이다.

한 열에서 card min-height는 해제한다.

900px 이하에서 summary item과 action은 wrap한다.

900px 이하 progress width는 `min(320px, 50vw)`다.

900px 이하 detail stats는 3열이다.

900px 이하 tabs는 available width를 채운다.

640px 이하 main card padding은 16px다.

640px 이하 `.inputSummary`와 main `.card` radius는 15px다.

640px 이하 summary padding은 14px다.

640px 이하 ratio grid는 한 열이다.

640px 이하 KPI grid는 한 열이다.

640px 이하 risk cards는 한 열이다.

640px 이하 comparison footer는 한 열이다.

640px 이하 method blocks는 한 열이다.

640px 이하 spectrum은 horizontal scroll이다.

spectrum SVG min-width는 720px다.

640px 이하 drawer width는 100vw다.

drawer body padding은 세로 18px, 가로 16px다.

640px 이하 detail size는 `calc(100vw - 12px)` × `calc(100dvh - 12px)`다.

640px 이하 detail radius는 16px다.

640px 이하 detail header description은 반드시 `display:none`이다.

640px 이하 CSV action은 icon과 accessible label을 유지한다.

640px 이하 path SVG min-width는 680px다.

모바일에서 chart 자체를 삭제하거나 table을 카드 3개로 축약하지 않는다.

---

## 51. active runtime 상태

페이지 mount와 route/대표모델/forecast seam 변경 시 즉시 Worker 계산을 시작한다.

running에서는 상단 progress와 `운임경로 생성 중` 또는 `배분비율 평가 중`을 표시하고 이전 result는 제거한다.

success에서는 현재 sequence의 result만 표시한다.

Worker error에서는 정확히 `시뮬레이션 계산 중 오류가 발생했습니다. 다시 실행해 주세요.`를 표시하고 이전 result는 복원하지 않는다.

오류 뒤 사용자는 `데이터 입력`에서 다시 `100,000개 분석 실행`을 눌러 재실행한다. 별도 retry 전용 버튼은 추가하지 않는다.

active page에는 별도 snapshot skeleton, compatibility mode, timeout, CSV generating, percentile sorting 상태가 없다. 이를 새 UI로 추가하지 않는다.

WT3 handoff 자체가 malformed하거나 1~4주가 불완전하면 synthetic 값으로 계산하지 않고 상위 데이터 계약 오류로 차단한다.

---

## 52. interaction acceptance

페이지 진입 시 자동 계산이 한 번만 시작된다.

React Strict Mode 이중 effect에서도 실제 유효 run이 중복되지 않는다.

`데이터 입력` click은 drawer를 연다.

drawer horizon 변경은 fixed draft를 즉시 갱신한다.

drawer cancel은 draft를 보존하고 닫는다.

drawer route 변경은 상위 route를 즉시 바꾼다.

실행 click은 입력 snapshot을 고정하고 계산한다.

계산 중 연속 route 변경은 마지막 route 결과만 남긴다.

detail button은 완료 전에 작동하지 않는다.

detail open 시 추천 row가 보인다.

tab 전환은 URL이나 전역 route를 바꾸지 않는다.

CSV는 현재 draft가 아니라 lastInput/result를 사용한다.

spectrum hover가 candidate 결과와 정확히 일치한다.

Escape가 열린 overlay를 하나만 닫는다.

background scroll은 overlay 중 잠긴다.

---

## 53. 접근성 acceptance

모든 form field에 visible label이 있다.

단위는 placeholder에만 의존하지 않는다.

drawer는 `<aside role="dialog" aria-modal="true" aria-label="배분 분석 데이터 입력">`이다.

detail은 `<section role="dialog" aria-modal="true" aria-label="100,000개 시뮬레이션 상세 결과">`다.

상세 tabs는 `tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby` 관계를 유지한다.

comparison chart와 path chart는 `role="img"`와 현재 동적 `aria-label`을 유지한다.

HelpBubble button은 동적 `aria-label="{label} 설명"`과 `role="tooltip"`을 유지한다.

donut 정보는 text row로도 완전히 전달된다.

차트 색상만으로 series를 구분하지 않는다.

추천 row는 text badge를 가진다.

reduced motion 환경에서 불필요한 transition을 줄인다.

승인 상호작용에 없는 focus trap, initial focus, opener focus restore, tab Arrow/Home/End handler, Spectrum keyboard 후보 탐색, progressbar role을 parity 필수로 추가하지 않는다.

---

## 54. KNEI golden 입력

golden snapshot schema는 `glovis-freight-risk/v3`다.

snapshot generatedAt은 `2026-08-10T03:24:03+00:00`다.

route는 KNEI다.

최신 관측일은 `2026-08-03`이다.

current rate는 `4884`다.

자동 representative model은 SARIMAX다.

1주 score는 `99.531841648`다.

1주 Coverage는 `88.5`다.

week1 target date는 `2026-08-10`이다.

week1 point/lower/upper는 `4828.98 / 4482.47 / 5175.49`다.

week2 target date는 `2026-08-17`이다.

week2 point/lower/upper는 `4791.32 / 4227.22 / 5355.43`다.

week3 target date는 `2026-08-24`다.

week3 point/lower/upper는 `4767.23 / 3935.75 / 5598.72`다.

week4 target date는 `2026-08-31`이다.

week4 point/lower/upper는 `4753.74 / 3439.80 / 6067.68`이다.

기본 fixed rate는 `round(4828.98 × 1.035) = 4998`이다.

기본 volume은 1,000이다.

기본 horizon은 1이다.

기본 risk weight는 1이다.

route seed는 `2401817482`다.

---

## 55. KNEI golden 엔진 결과

mean Spot은 `4830.245747781964`다.

Spot fixed 초과 확률은 `0.21475000`다.

추천 fixed share는 `13`이다.

추천 spot share는 `87`이다.

추천 expected cost는 `4852053.80057031`이다.

추천 average cost/FEU는 `4852.05380057`이다.

추천 CVaR는 `176052.33341650`이다.

추천 upward component는 `171726.88913581`이다.

추천 downward component는 `4325.44428070`이다.

추천 objective는 `5028106.13398681`이다.

engine assertion tolerance는 각 값 절대오차 `1e-6` 이하로 한다.

upward + downward와 CVaR 차이도 `1e-6` 이하로 한다.

첫 다섯 selected-horizon Spot은 다음 순서다.

1. `4795.12639911`
2. `5142.99375507`
3. `4581.69753348`
4. `5003.27600658`
5. `4933.67719446`

전체 selected Spot min은 `3863.81009913`이다.

전체 selected Spot max는 `5752.29912743`이다.

250 sample 중 selected PI90 밖 count는 `33`이다.

---

## 56. KNEI 후보 anchor 결과

고정 0% expected는 `4830245.747782`다.

고정 0% CVaR는 `201847.179944`다.

고정 0% upward는 같은 값이다.

고정 0% downward는 `0`이다.

고정 0% objective는 `5032092.927726`이다.

고정 10% expected는 `4847021.173004`다.

고정 10% CVaR는 `181667.031802`다.

고정 10% upward는 `181569.615701`이다.

고정 10% downward는 `97.416100`이다.

고정 10% objective는 `5028688.204805`다.

고정 20% expected는 `4863796.598226`이다.

고정 20% CVaR는 `170856.736430`이다.

고정 20% upward는 `133240.936076`이다.

고정 20% downward는 `37615.800354`다.

고정 20% objective는 `5034653.334656`이다.

고정 50% expected는 `4914122.873891`이다.

고정 50% CVaR는 `269864.522620`이다.

고정 50% upward는 `4287.546101`이다.

고정 50% downward는 `265576.976518`이다.

고정 50% objective는 `5183987.396511`이다.

고정 100% expected는 `4998000`이다.

고정 100% CVaR는 `538732.694131`이다.

고정 100% upward는 `0`이다.

고정 100% downward는 `538732.694131`이다.

고정 100% objective는 `5536732.694131`이다.

이 anchor들은 후보 loop 누락과 axis 데이터 오류를 잡는다.

---

## 57. KNEI golden UI 표시

donut은 `13%`를 표시한다.

Spot row는 `87%`를 표시한다.

예상 비용 KPI는 `$4.85M`을 표시한다.

초과확률 KPI는 `21.5%`를 표시한다.

후회비용 KPI는 `$176K`를 표시한다.

최종 총비용 KPI는 `$5.03M`을 표시한다.

상승 손실은 `$172K`를 표시한다.

하락 손실은 `$4K`를 표시한다.

comparison point label은 `$4,829`다.

comparison fixed label은 `$4,998`이다.

소수 반올림은 locale formatter contract로 고정한다.

엔진 값을 UI 표시값으로 다시 parsing해 계산에 사용하지 않는다.

---

## 58. 단위 테스트 목록

- route seed의 KNEI 값 검증
- PRNG 첫 N개 값 snapshot 검증
- Box–Muller zero uniform 재추출 검증
- asymmetric scale 상·하방 검증
- 4주 rho 연산 순서 검증
- 100,000개 Spot 첫 다섯 값 검증
- Spot min/max 검증
- sample path 250개 검증
- PI90 outside count 33 검증
- strict Spot > fixed 확률 검증
- economic loss 상승 branch 검증
- economic loss 하락 branch 검증
- equality branch 검증
- quickselect threshold와 tie fill 검증
- tail count 정확히 10,000 검증
- CVaR component 합 검증
- 후보 101개 검증
- tie일 때 낮은 fixed share 선택 검증
- 세 risk weight별 목적함수 검증
- Blob Worker golden 결과 검증
- 새 run이 이전 Worker를 terminate하고 stale message를 무시하는지 검증
- CSV header 지정 순서 검증
- CSV BOM과 LF 검증
- CSV 100,001행 검증
- CSV filename 검증
- percentile index 규칙 검증

---

## 59. component 통합 테스트

- mount 직후 자동 run 1회
- route 변경 직후 자동 run
- model override 변경 직후 자동 run
- forecast signature 변경 직후 자동 run
- horizon 변경만으로 run되지 않음
- volume 변경만으로 run되지 않음
- fixed 변경만으로 run되지 않음
- risk 변경만으로 run되지 않음
- horizon 변경 시 fixed draft reset
- drawer cancel에서 draft 보존
- drawer route change가 parent callback 호출
- stale Worker done 무시
- stale Worker error 무시
- Worker runtime error가 지정 오류 문구와 `result=null`을 만드는지 검증
- detail disabled 조건
- 추천 row 자동 scroll
- percentile lazy sort
- CSV가 lastInput 사용
- body scroll lock 복원
- nested Escape 우선순위

---

## 60. runtime E2E 테스트

allocation page를 route query와 함께 직접 열어야 한다.

hard refresh 후 snapshot과 계산이 완료되어야 한다.

다른 페이지에서 client navigation으로 진입해도 같은 결과여야 한다.

뒤로 가기 후 재진입에서 Worker leak가 없어야 한다.

route를 빠르게 세 번 바꾸고 마지막 route만 표시해야 한다.

drawer open 상태에서 route를 바꾸고 자동 계산을 확인한다.

저사양 CPU throttle에서 progress가 갱신되어야 한다.

Worker `onerror` fixture에서 지정 오류 문구와 이전 결과 제거를 확인한다.

100,000행 CSV 다운로드를 실제 parsing해 행 수를 검증한다.

승인된 failure injection의 allowlisted expected error를 제외하고 unexpected console error, hydration warning, unhandled rejection은 0건이어야 한다.

network panel에 allocation simulation HTTP 요청이 없어야 한다.

세 번 연속 재계산 후 retained heap이 지속 증가하지 않아야 한다.

---

## 61. PNG 검수 matrix

PRIMARY 1440×900과 375×812에서 아래 상태를 직접 비교한다.

| state group | 각 viewport의 필수 capture |
|---|---|
| RUNNING | 경로 생성 10%대, 후보 평가 60%대 |
| READY | 계산 완료 전체 페이지와 지정된 KNEI KPI |
| INTERACTION | spectrum pointer 13% tooltip |
| DRAWER/DETAIL | drawer 기본, drawer 4주, detail allocation, paths, method |
| ERROR | Worker error 표시 문구와 result 제거 |

900×900과 640×900에서는 full capture matrix 대신 overflow·dialog bounds·chart scroller smoke만 수행한다.

horizontal chart scroller는 375에서 시작 위치와 이동 후 위치를 추가 캡처한다.

failure injection 이미지는 검수 기록에 fixture ID와 허용 error code를 기록한다.

승인된 failure injection에서 의도적으로 발생시킨 error만 console/network evidence allowlist에 넣을 수 있다.

그 외 unexpected console error, hydration warning, unhandled rejection, asset 404, failed network request는 모든 capture에서 0건이어야 한다.

총 capture set과 파일명 convention을 CI artifact로 고정한다.

---

## 62. 승인 PNG 판정

기준 이미지는 승인된 Figma에서 확정한 PNG다.

font와 shared shell 차이는 별도 mask가 아니라 같은 공용 token으로 해결한다.

전체 불일치 pixel 비율은 0.5% 이하를 목표로 한다.

anti-aliasing 때문에 허용된 pixel도 최대 color distance를 제한한다.

카드 위치, chart viewBox, label 위치는 geometry assertion으로 별도 검사한다.

text wrapping은 승인 없이 바뀌면 실패다.

차트 series 수와 axis 수를 DOM assertion으로 검사한다.

mobile horizontal overflow는 body가 아니라 chart scroller 내부에만 있어야 한다.

drawer와 detail overlay가 viewport 밖으로 잘리지 않아야 한다.

불일치가 생기면 기준 이미지를 즉시 갱신하지 않는다.

원인, 의도, Figma/PNG 근거를 리뷰한 뒤에만 기준 이미지를 갱신한다.

---

## 63. 성능 budget

100,000×101 계산은 Worker 안에서 수행해 main UI를 막지 않는다.

progress update는 지나치게 잦아 렌더를 방해하지 않게 throttle한다.

101개 후보 chart 렌더는 계산 결과를 복사해 재계산하지 않는다.

percentile sort는 paths tab이 활성화될 때 `useMemo([open, tab, result])`로 수행한다.

CSV 완료 뒤 임시 buffer와 object URL을 해제한다.

detail close에서 main result는 보존하되 sorted array는 별도 영속 cache로 보존하지 않는다.

성능 개선을 이유로 numeric contract를 바꾸지 않는다.

---

## 64. forbidden simplifications

- 100,000개를 1,000개로 축소 금지
- 101개 후보를 11개로 축소 금지
- 네 horizon 중 선택 horizon만 생성 금지
- 각 horizon마다 다른 대표모델 사용 금지
- `Math.random` 사용 금지
- symmetric interval로 평균화 금지
- rho 제거 금지
- CVaR를 percentile 하나로 대체 금지
- 경제적 후회비용 대신 총비용 tail 사용 금지
- 상승·하락 component denominator 변경 금지
- objective에서 riskWeight 누락 금지
- 결과를 invoice로 표현 금지
- Worker 실패를 영구 loading으로 방치 금지
- Worker 오류 시 임의 축소 계산이나 synthetic 결과 생성 금지
- old result와 new draft label 혼합 금지
- detail 101행을 pagination 명목으로 일부 누락 금지
- CSV를 summary 101행으로 바꾸기 금지
- comparison chart를 단일 range bar로 바꾸기 금지
- spectrum dual axis 제거 금지
- chart SVG geometry 임의 변경 금지
- 모바일에서 chart 삭제 금지
- route/model 누락을 다른 모델로 메우기 금지
- synthetic 값으로 오류 숨기기 금지

---

## 65. Clean-room 해석 금지

comparison chart는 720×300의 네 수평 guide 표현을 유지하며 640×258 range bar로 바꾸지 않는다.

spectrum은 920×360 dual-axis를 유지하며 760×338 single-scale 형태로 바꾸지 않는다.

카드 계층, 표시 문구, 계산 흐름 순서는 승인된 Figma/PNG를 따른다.

comparison badge에는 `DERIVED` 같은 새 표식을 넣지 않고 대표모델 이름만 표시한다.

detail open 문구와 action 구조, CSV 줄바꿈과 byte 규칙을 임의 변경하지 않는다.

구현자는 이 문서의 frozen DTO와 수식 계약으로 새로 구축한다.

---

## 66. 구현 단계

### Stage 0 — 권위 자료 확인

- 승인된 Figma visible inventory와 interaction 확인
- 1440·375 주 PNG와 900·640 보조 PNG 조건 확인
- 데이터 팩 18 KNEI fixture와 frozen DTO 정합성 확인
- 본 문서 numeric golden과 시각 상태 승인 확인

Acceptance: §4.2 gate 통과.

### Stage 1 — 계약과 fixture freeze

- `RepresentativeSelectionV1` handoff contract 추가
- provenance/revision DTO 검증과 allocation-effective run key 추가
- WT3 keep/rollback seam fixture 추가
- WT6 `GatewayResultV1`/`DataGateway` consumer fixture 추가
- calculation input/result contract 추가
- KNEI fixture와 golden expectation 추가
- 표시 문구, token, viewport 조건 추가

Acceptance: contract parser와 fixture integrity test 통과.

### Stage 2 — 순수 계산 엔진

- seed와 PRNG 구현
- Box–Muller 구현
- 4주 경로 구현
- 후보 비용과 loss 구현
- quickselect CVaR 구현
- 추천 reducer 구현
- 101개와 golden 테스트 추가

Acceptance: KNEI 모든 engine golden 오차 1e-6 이하.

### Stage 3 — runtime 실행 계층

- Blob Worker 생성 함수 추가
- sequence cancellation과 progress 추가
- terminate와 resource cleanup 추가

Acceptance: KNEI Worker golden, result-null lifecycle, stale-run, dispose test 통과.

### Stage 4 — page 기본 구조

- page state/reducer와 mount 자동 run 추가
- summary strip과 drawer 추가
- 지정된 표시 문구와 validation 추가

Acceptance: state boundary, overlay/Escape/body-lock 통합 테스트 통과.

### Stage 5 — 추천·비교 결과

- donut과 KPI 추가
- comparison chart와 3-step flow 추가
- running/error UI 추가

Acceptance: 1440×900·375×812 승인 PNG core 검수 통과.

### Stage 6 — spectrum과 risk

- 101-point dual-axis spectrum 추가
- pointer hover tooltip과 selected band 추가
- risk breakdown 추가

Acceptance: candidate tooltip numeric test와 chart geometry test 통과.

### Stage 7 — 상세 dialog

- dialog shell과 allocation table 추가
- paths chart와 percentile lazy sort 추가
- method tab 추가

Acceptance: 세 tab, Escape, scroll, a11y test 통과.

### Stage 8 — CSV와 hardening

- 지정된 CSV serializer 추가
- download resource cleanup 추가

Acceptance: 100,001행 byte contract 통과.

### Stage 9 — full visual and runtime QA

- 1440·375 승인 PNG parity와 900·640 smoke 수행
- 시각 허용치와 performance measurement 확인
- evidence matrix 완성

Acceptance: 아래 release gate 전부 통과.

각 stage 완료점은 build와 관련 test를 통과해야 한다.

---

## 67. evidence matrix

| 요구 | 증거 artifact | 자동 검증 | 수동 검증 |
|---|---|---|---|
| clean-room 권위 | Figma/PNG·데이터 팩 18 승인 기록 | fixture 조건 검사 | reviewer approval |
| 대표모델 동일 ID 4주 | `RepresentativeSelectionV1` fixture | contract test | drawer 4카드 확인 |
| 대표 provenance | frozen `modelVersion`·`forecastSource`·`tuningRunHash`·`evaluationProtocol`·`representativeRevision` | revision 검증 | WT3 handoff review |
| tuning keep/rollback | shared revision fixture | effective-key 변경 시 once, 불변 시 no-run | WT3→WT5 recording |
| typed data seam | `GatewayResultV1` consumer fixture | parser/state test | WT6 handoff review |
| 100,000 scenarios | engine result metadata | 지정값 assertion | detail stat 확인 |
| 101 candidates | candidate array | length assertion | table/spectrum 확인 |
| seed 결정론 | KNEI fixture | seed golden | 해당 없음 |
| CVaR 90 | golden result | 1e-6 assertion | method 표시 문구 확인 |
| Worker lifecycle | runtime event log fixture | result-null/cancellation test | rapid route change |
| Blob Worker | deterministic Worker fixture | KNEI golden·stale sequence·dispose test | rapid route change |
| recommendation UI | 1440·375 승인 PNG | DOM value test | visual review |
| comparison geometry | SVG geometry expectation | attribute test | 승인 PNG 비교 |
| spectrum dual axes | series expectation | DOM/scale test | hover review |
| risk breakdown | result fixture | sum assertion | bar/value review |
| detail allocation | 101-row fixture | row count test | recommended scroll |
| detail paths | 250 sample fixture | path/count test | chart review |
| percentiles | sorted golden | index test | table review |
| method tab | 표시 문구 목록 | 지정 text test | readability review |
| CSV | golden bytes | byte/row test | spreadsheet open |
| responsive/state | 1440·375 parity + 900·640 smoke 기록 | image/overflow test | device/state review |
| semantics | dialog/tab/chart ARIA expectation | 지정 attribute test | Escape·overlay·body-lock 확인 |
| resource cleanup | lifecycle counters | leak regression | devtools check |

모든 evidence는 해당 검증 실행과 연결한다.

스크린샷만으로 수치 정확성을 주장하지 않는다.

단위 테스트만으로 시각 일치를 주장하지 않는다.

---

## 68. release gate

Release gate A는 build와 type check 통과다.

Release gate B는 KNEI golden 전체 통과다.

Release gate C는 Blob Worker KNEI golden과 stale sequence/resource cleanup 통과다.

Release gate D는 1440·375 승인 PNG 비교와 900·640 smoke 통과다.

Release gate E는 runtime E2E와 cold direct load 통과다.

Release gate F는 승인 상호작용에 존재하는 dialog/tab/chart semantics와 Escape·overlay·body-lock 통과다.

Release gate G는 CSV 100,001행 검증 통과다.

Release gate H는 console과 network error 0건이다.

Release gate I는 open critical/high defect 0건이다.

Release gate J는 evidence matrix의 모든 행에 실제 artifact가 연결된 상태다.

gate를 수동 메모만으로 bypass하지 않는다.

기준 이미지 변경은 reviewer 두 명의 승인 대상으로 둔다.

---

## 69. 구현자 self-review checklist

- REQUIRED — 승인된 Figma/PNG, 데이터 팩 18, frozen DTO, 본문 수식·golden 외 구현 흔적에 의존하지 않았다. 종료값: `CHECKED`.
- REQUIRED — 네 horizon이 같은 model ID다. 종료값: `CHECKED`.
- REQUIRED — `RepresentativeSelectionV1`을 rename/recompute 없이 소비한다. 종료값: `CHECKED`.
- REQUIRED — modelVersion, forecastSource, tuningRunHash, evaluationProtocol, representativeRevision은 DTO 검증/provenance에 보존하되 단독 rerun trigger로 쓰지 않았다. 종료값: `CHECKED`.
- REQUIRED — WT3 keep/rollback은 allocation-effective key 변경 시 once, 불변 시 no-run golden을 통과한다. 종료값: `CHECKED`.
- REQUIRED — drawer 미니카드에는 주차·point·PI90만 표시하고 targetDate를 추가하지 않았다. 종료값: `CHECKED`.
- REQUIRED — scenario 수가 모든 환경에서 100,000이다. 종료값: `CHECKED`.
- REQUIRED — candidate 수가 모든 환경에서 101이다. 종료값: `CHECKED`.
- REQUIRED — PRNG와 normal sampler 순서가 기준과 같다. 종료값: `CHECKED`.
- REQUIRED — rho 0.75와 asymmetric scale을 지켰다. 종료값: `CHECKED`.
- REQUIRED — CVaR tail이 정확히 10,000개다. 종료값: `CHECKED`.
- REQUIRED — tie fill이 원래 scenario 순서다. 종료값: `CHECKED`.
- REQUIRED — objective와 tie-break가 정확하다. 종료값: `CHECKED`.
- REQUIRED — KNEI seed와 첫 다섯 Spot이 일치한다. 종료값: `CHECKED`.
- REQUIRED — KNEI 추천이 13/87이다. 종료값: `CHECKED`.
- REQUIRED — KNEI UI 표시가 지정된 표시 문구와 format을 쓴다. 종료값: `CHECKED`.
- REQUIRED — Blob Worker가 100,000×101을 계산한다. 종료값: `CHECKED`.
- REQUIRED — 새 run에서 result가 null이고 이전 성공 결과를 보존하지 않는다. 종료값: `CHECKED`.
- REQUIRED — stale run이 결과를 덮지 않는다. 종료값: `CHECKED`.
- REQUIRED — done/error/unmount에서 Worker terminate와 object URL revoke가 있다. 종료값: `CHECKED`.
- REQUIRED — draft와 lastInput을 분리했다. 종료값: `CHECKED`.
- REQUIRED — 자동 재실행 경계가 계약과 같다. 종료값: `CHECKED`.
- REQUIRED — drawer cancel이 rollback하지 않는다. 종료값: `CHECKED`.
- REQUIRED — comparison viewBox와 plot geometry가 정확하다. 종료값: `CHECKED`.
- REQUIRED — spectrum viewBox와 dual axes가 정확하다. 종료값: `CHECKED`.
- REQUIRED — 101행 detail 표가 모두 보인다. 종료값: `CHECKED`.
- REQUIRED — 250개 path와 nine percentiles가 있다. 종료값: `CHECKED`.
- REQUIRED — 계산 방법 여섯 block과 caution이 있다. 종료값: `CHECKED`.
- REQUIRED — CSV header, BOM, LF, row count가 정확하다. 종료값: `CHECKED`.
- REQUIRED — 1440·375 parity와 900·640 smoke를 통과했다. 종료값: `CHECKED`.
- REQUIRED — 승인 화면에 없는 focus trap/restore, chart keyboard 후보 탐색, compatibility UI를 추가하지 않았다. 종료값: `CHECKED`.
- REQUIRED — body 전체 horizontal overflow가 없다. 종료값: `CHECKED`.
- REQUIRED — 오류에서 fake result를 만들지 않는다. 종료값: `CHECKED`.
- REQUIRED — 승인 failure injection 외 unexpected error가 0건이다. 종료값: `CHECKED`.
- REQUIRED — evidence matrix가 실제 artifact로 채워졌다. 종료값: `CHECKED`.

---

## 70. 최종 handoff 문구

WT5 담당자는 완료 시 다음 사실을 수치로 보고한다.

- 구현 stage 완료 내역
- KNEI golden test 결과
- Blob Worker KNEI golden 최대 오차
- 1440·375 승인 PNG 불일치 비율과 900·640 smoke 결과
- CSV 실제 행 수와 byte 계약 결과
- cold-load E2E 결과
- 접근성 자동검사 결과
- 남은 결함 수와 severity

`화면 구현 완료` 같은 포괄 문장만으로 handoff하지 않는다.

모든 수치와 artifact가 연결되면 WT5를 제품 수준 완료로 판정한다.
