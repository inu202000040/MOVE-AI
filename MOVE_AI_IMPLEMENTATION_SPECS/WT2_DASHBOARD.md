# WT2 — Dashboard 텍스트 구현 계약

## 1. 책임과 입력

WT2는 Dashboard 본문, KCCI chart, forecast readout, 시장지표 두 슬롯, 자동설명, route 뉴스와 두 대화상자를 소유한다. 공통 Shell은 WT1, 대표모델 projection은 WT3, 외부 데이터는 WT6에서 소비한다.

계산·gateway 상세는 `../docs/specs/WT2_DASHBOARD.md`를 함께 적용한다.

## 2. 화면 순서

1. 공통 Header.
2. KCCI route forecast hero.
3. Forecast readout.
4. 시장지표 선택기와 시장지표 카드 2개.
5. 왼쪽 자동설명, 오른쪽 route 뉴스.
6. 조건부 과거 운임·사건 dialog.
7. 조건부 전체 노선 dialog.

## 3. Header 문구

- eyebrow: `ROUTE MARKET OVERVIEW`
- 제목: `메인 대시보드`
- 설명: `운임과 시장 신호를 한 화면에서 확인합니다.`
- action: `전체 노선`
- 기준 label: `데이터 기준`
- KNEI 기준일: `2026.08.03`

## 4. Hero 문구와 구조

- eyebrow: `KCCI ROUTE FORECAST`
- 제목: `유럽 운임 추이·1~4주 전망`
- 설명: `기본은 2026년 이후 · 휠로 2022년 10월 축부터 전체 기간 탐색`
- 정보 버튼: `!`
- selector label: `조회 항로`
- option 형식: `{권역명} · {코드}`
- legend 순서: `KCCI 실측`, 대표모델 이름, `90% 예측구간`
- 기간 summary: `2026.01.01 – 2026.08.31`
- helper: `실측 시작 2022.11.07`
- interaction helper: `휠 확대·축소 · 가로 드래그 이동`
- buttons: `+`, `−`, `전체`, `최근`

KNEI 대표모델은 SARIMAX이며 1~4주 값은 다음이다.

| 주차 | 날짜 | point | PI90 lower | PI90 upper |
|---:|---|---:|---:|---:|
| 1 | 2026.08.10 | 4,828.98 | 4,482.47 | 5,175.49 |
| 2 | 2026.08.17 | 4,791.32 | 4,227.22 | 5,355.43 |
| 3 | 2026.08.24 | 4,767.23 | 3,935.75 | 5,598.72 |
| 4 | 2026.08.31 | 4,753.74 | 3,439.80 | 6,067.68 |

마지막 실측은 2026.08.03, 4,884 USD/FEU다.

## 5. Forecast readout

- region name: `{노선명} {N}주 운임 예측 요약`
- eyebrow: `FORECAST READOUT`
- KNEI 1주 headline: `유럽 1주 후 운임은 $4,829로 보합 전망입니다.`
- 주차 radio 순서: 1주, 2주, 3주, 4주.
- helper: `현재 대비 -1.1% · PI90 범위는 $4,482~$5,175 / FEU`

세 article 순서는 고정한다.

1. `현재 운임 → 1주 점예측`: 마지막 실측, 날짜, 단위, 선택 주차 point.
2. `PI90 예측구간`: 하한, 상한, `90% 구간 · USD/FEU`.
3. `대표 모델·외부평가`: 사용자 대표 모델, Coverage, hits/52.

KNEI 1주 Coverage는 88.5%, 46/52 적중이다.

## 6. 차트 동작

- wheel은 중심 기준 확대·축소한다.
- 가로 drag는 기간을 이동한다.
- `전체`는 2022년 시작 전체 이력, `최근`은 기본 기간으로 복귀한다.
- Home은 최근, End는 전체 의미로 사용한다.
- hover/focus는 날짜, 실제값 또는 forecast point를 표시한다.
- forecast는 1~4주 endpoint와 PI90 cap으로 표시한다.
- 주차를 바꿔도 chart viewport는 유지한다.
- route 변경 시 새 route 기본 viewport로 reset한다.

## 7. 시장지표

selector는 상단과 하단 두 행이며 각 행에 `환율`, `Brent`, `VLSFO`, `HARPEX` 네 tab이 있다.

동일 지표를 두 슬롯에 동시에 선택할 수 없다. 상단에서 하단의 현재 지표를 선택하면 두 값이 swap된다.

각 카드:

- title, provider 설명, truth badge.
- 높이 208px line chart.
- y축은 해당 unit, x축은 `날짜`.
- latest value와 관측일 footer.

KNEI 관찰 기본값:

- 상단 USD/KRW: 1,427.048 KRW/USD, 2026.08.03.
- 하단 Brent: 88.9 USD/bbl, 2026.08.03.
- HARPEX 단위는 `Index`다.

상태는 LOADING, LIVE, REFERENCE, UNAVAILABLE을 구별한다. 이전 series chart를 새 요청 동안 남기지 않는다.

## 8. 자동설명

- eyebrow: `AUTO INSIGHT`
- 제목: `예측 방향 자동 설명`
- 설명: `정량 예측과 검증 뉴스를 함께 해석`
- badge는 `분석 중`, `Gemini 해설`, `규칙형 해설`, `Gemini 연결 중`, `해석 대기` 중 하나다.
- confidence 필드는 화면에 새 label로 표시하지 않는다.
- `정량 근거`와 `뉴스 신호` 두 box를 사용한다.
- 상승 factor는 `상방`, 하락 factor는 `하방`을 쓴다.
- 대표모델 note와 method notice는 항상 유지한다.

외부 키가 없거나 provider가 실패하면 deterministic rule fallback을 사용한다. 임의 수치나 새 error panel을 만들지 않는다.

## 9. Route 뉴스

- eyebrow: `ROUTE NEWS WATCH`
- 제목: `{노선명} 항로 운임 영향 뉴스`
- 설명: `최근 30일 항로 뉴스를 우선하고, 부족할 때만 90일 범위의 B등급 보조자료로 최대 5건 표시`
- action labels: `뉴스 수집`, `뉴스 갱신`, `갱신 중`.

첫 진입은 자동 수집하지 않는다. 유효 cache가 없으면 IDLE이고 사용자가 `뉴스 수집`을 눌러 시작한다.

기사 row 구조:

1. `01`~`05` index.
2. grade/direction/검증 badge.
3. 제목 최대 2줄.
4. summary 최대 2줄.
5. source/date/effective date.
6. `선정 근거 · ...`.
7. 외부 link chevron.

뉴스는 forecast 모델 입력 또는 인과 증거라고 표현하지 않는다.

## 10. 대화상자

### 과거 운임·사건

Hero `!`로 연다. 전체 이력 chart, KPI, 사건 marker toggle과 사건 detail을 제공한다.

### 전체 노선

Header의 `전체 노선`으로 연다. 13개 route를 registry 순서로 보여준다.

공통 동작:

- body portal.
- open 동안 body scroll lock.
- initial focus 제공.
- X, overlay target-self, Escape로 닫기.
- 닫은 뒤 trigger focus 복귀.

## 11. 반응형

| viewport | 본문 grid | 시장지표 | 하단 grid | readout |
|---|---|---|---|---|
| 1440 | hero/market 1.7fr : min 390px, gap 22px | 세로 2행 | 2열 | lead 2열, detail 3열 |
| 900 | 1열 | 1열 | 1열 | lead 1열, detail 2열+validation full row |
| 640 | 1열 | 1열 | 1열 | 전체 1열 |
| 375 | 1열 | 1열 | 1열 | 전체 1열 |

375에서 selector, chart, tooltip, 4개 주차 radio, 뉴스 action이 viewport를 넘지 않는다.

## 12. 완료 기준

- 대표모델과 선택 horizon 수치가 WT3 projection과 일치.
- chart wheel/drag/button/keyboard 동작.
- 시장 두 슬롯 swap과 중복 방지.
- news IDLE/LOADING/READY/CACHED/ERROR 동작.
- 자동설명 Gemini/rule fallback과 look-ahead 차단.
- 두 dialog lifecycle과 focus 복귀.
- 1440/375 상세, 900/640 smoke, horizontal overflow 0.
- 화면에 없는 confidence, retry bar, status card를 추가하지 않음.

