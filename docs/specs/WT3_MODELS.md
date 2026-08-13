# WT3 — 예측 모델 디테일

## 0. 문서 목적과 판정 권위

이 문서는 Models 화면의 보이는 결과, 계산 규칙, 상호작용, 반응형 동작, 상태 전이, 접근성, 저장 및 소비자 인계를 규정한다. 문서에 없는 화면, 문구, 필드, 상태, 제어 또는 사용자 동작을 추가하지 않는다.

구현과 QA의 유일한 판정 권위는 이 명세 텍스트다. 지원 입력은 다음과 같이 사용한다.

1. `MOVE_AI_DATA_PACK`의 `13_MODEL_FORECAST_SNAPSHOT.xlsx`, `14_MODEL_EVALUATION.xlsx`, `15_MODEL_TUNING_CONFIG.xlsx`: 본 문서가 지정한 데이터 입력
2. 동결된 공유 DTO와 저장 키 계약: 본 문서가 지정한 경계 계약
3. 사용 중인 라이브러리의 공식 문서: 표준 API 사용 근거
4. 승인된 Figma 프레임과 PNG: `REFERENCE_ONLY`로 rough composition과 flow 참고 전용

보이는 배치·문구·수치 geometry·상태·상호작용과 데이터·계산 판정은 본 문서를 따른다. Figma/PNG와의 차이만으로 실패 또는 차단할 수 없고, pixel parity·image diff·SSIM·mismatch 비율은 구현 또는 QA 합격 기준으로 사용하지 않는다. 입력 충돌을 임의 보정값이나 새 사용자 기능으로 숨기지 않는다.

### 0.1 판정 언어

- `P0`: 데이터·계약·주요 기능·안전한 상태 전이를 깨는 출시 차단 결함
- `P1`: 본 명세의 주요 반응형 배치·computed style·상태·필수 상호작용 결함. Figma/PNG 차이만으로는 P1이 아니다.
- 완료 조건: `P0=0`, `P1=0`
- `CP1`은 중간 점검일 뿐 완료가 아니다.

---

## 1. 범위

WT3가 소유하는 범위는 다음과 같다.

- 8개 모델의 실측·1~4주 예측 경로 차트
- 최근/전체/사용자 조정 뷰포트
- 범례 필터와 대표모델 강조
- 자동·수동 대표모델 선택 및 점수 산정
- 8개 대표 카드와 6열·8행 성능표
- MAPE, MSE, MASE 검증 근거 대화상자
- 고급설정 재측정 서랍
- 재측정 전후 비교, 결과 유지, 이전 결과 복원
- 데이터 로딩·빈 결과·오류·부분 실패·재측정 상태
- 대표 선택과 재측정 결과의 저장 및 다른 화면 인계
- 1440×900, 375×812 주 판정과 900×900, 640×900 구간 점검

공통 셸, 항로 목록 자체, Dashboard, Allocation 계산과 화면은 WT3의 새 소유 범위가 아니다. WT3는 동결 계약을 통해서만 그 소비자에게 결과를 전달한다.

---

## 2. 고정 도메인

### 2.1 항로 순서

| 순서 | 코드 | 표시명 |
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

### 2.2 모델 레지스트리

아래 순서는 차트 범례, 대표 카드, agreement 구성원, 선택 옵션의 고정 순서다.

| 순서 | id | 표시명 | 계열 | 색상 | 기준 버전 |
|---:|---|---|---|---|---|
| 1 | `naive` | Naive | 기준모델 | `#64748b` | `last-observation-v1` |
| 2 | `sarimax` | SARIMAX | 통계 시계열 | `#38bdf8` | `statsmodels-0.14.6` |
| 3 | `lightgbm` | LightGBM | 트리 부스팅 | `#16a34a` | `lightgbm-4.7.0` |
| 4 | `xgboost` | XGBoost | 트리 부스팅 | `#f97316` | `xgboost-3.4.0` |
| 5 | `random_forest` | Random Forest | 트리 앙상블 | `#0f766e` | `scikit-learn-1.6.1` |
| 6 | `prophet` | Prophet | 추세·계절 | `#e11d48` | `prophet-1.3.0` |
| 7 | `timesfm` | TimesFM | 사전학습 모델 | `#0b1f5e` | `timesfm-2.0.2` |
| 8 | `chronos` | Chronos | 사전학습 모델 | `#7c3aed` | `chronos-forecasting-2.3.1` |

### 2.3 스냅샷과 평가 불변식

- 스키마: `glovis-freight-risk/v3`
- 실측 기간: `2022-11-07`부터 `2026-08-03`
- 항로별 실측 개수: 187
- 전망 시차: 1, 2, 3, 4주
- 전망 개수: 13항로 × 8모델 × 4시차 = 416
- 성능 묶음 개수: 416
- 모델·항로·시차별 외부평가 기록: 52개
- 초기 보정 표본: 26개
- PI90 목표 포함률: 0.90
- 구간 방식: 온라인 절대오차 conformal
- 학습창 기본 전략: expanding
- MASE 계절 시차: 52
- 단위: `USD/FEU`

항로, 모델, 시차, 날짜, 평가 개수, 구간 순서 중 하나라도 맞지 않으면 해당 묶음을 화면 계산에 부분 채택하지 않고 안전한 오류 상태로 보낸다.

---

## 3. 화면 정보 구조와 순서

표시 순서는 다음과 같으며 순서를 바꾸지 않는다.

1. 공통 상단바
2. Models 본문
3. 8개 모델 예측 비교 카드
4. 카드 제목·설명·상태 배지
5. 기간 제어·항로 선택·고급설정
6. 실측 및 8개 모델 범례
7. 높이 420px 예측 차트
8. 대표모델 선택 안내
9. 8개 대표 카드
10. 모델 성능 비교 카드
11. 성능 카드 제목·가중치 표시
12. 가로 스크롤을 소유하는 표 래퍼
13. 6열·8행 성능표
14. 평가 방법 안내
15. 조건부 검증 근거 포털
16. 조건부 고급설정 서랍
17. 조건부 재측정 비교 대화상자

### 3.1 상단바 표시 문구

- eyebrow: `MODEL VALIDATION`
- 제목: `예측 모델 디테일`
- 설명: `8개 모델의 1~4주 전망과 시차별 검증 성능을 비교합니다.`
- 기준 eyebrow: `데이터 기준`
- 기준값: `2026.08.03`

### 3.2 예측 비교 카드 표시 문구

- eyebrow: `EIGHT-MODEL FORECAST`
- 제목: `8개 모델의 1~4주 예측경로 확대 비교`
- 설명: `기본은 직전 4개 실측과 향후 1~4주 예측을 확대 비교하며, 휠·드래그·기간 버튼으로 2022년부터 과거 흐름을 탐색할 수 있습니다.`
- 배지: `동일 187주 입력`
- 문맥: `{항로명} · 직전 4주 + 향후 1~4주 · 전체 이력 탐색`
- 대표 상태: `{사용자 대표|자동 대표} {모델명} · 1주 기준`
- 서랍 버튼: `고급설정`
- 시차 버튼: `1주`, `2주`, `3주`, `4주`
- 항로 레이블: `조회 항로`

### 3.3 성능 카드 표시 문구

- eyebrow: `OUT-OF-SAMPLE SCORE`
- 제목: `모델 성능 비교`
- 설명: `{시차}주 외부평가 오차를 무차원 점수로 바꾼 뒤 동일가중으로 합산`
- 가중치: `MAPE 33.3%`, `MSE 33.3%`, `MASE 33.3%`
- 대표 기준: `대표모델 1주 기준`

---

## 4. 데스크톱 기본 기하

본 문서 §4의 1440×900 수치 geometry 계약에서 다음 기준을 사용한다.

| 요소 | 기준 |
|---|---|
| 닫힌 공통 사이드바 | 68px 고정 |
| 본문 시작 | 사이드바 오른쪽 |
| 상단바 | 최소 92px |
| 상단바 세로 여백 | 14px |
| 상단바 가로 여백 | `clamp(20px, 3vw, 44px)` |
| 본문 최대 폭 | 1580px |
| 본문 위 여백 | 24px |
| 본문 가로 여백 | `clamp(20px, 3vw, 44px)` |
| 본문 아래 여백 | 52px |
| 카드 내부 여백 | 22px |
| 카드 모서리 | 18px |
| 주요 내부 간격 | 18px |
| 차트 높이 | 420px |
| 대표 카드 | 4열 |
| 성능표 최소 폭 | 900px |
| 고급설정 서랍 | 560px |
| 비교 대화상자 | 최대 1000px |

첫 카드의 승인 기준점은 대략 `y=119`, 내부 제목 `y=142`, 범례 `y=231`, 기간 제어 `y=284`, 차트 `y=328`이다. 구현 차이로 제목과 차트 사이에 추가 세로 띠를 만들지 않는다.

---

## 5. 8개 모델 예측 차트

### 5.1 데이터 구성

- 실측 시리즈 id는 `actual`, 표시명은 `KCCI 실측`, 색상은 `#2f2f36`이다.
- 실측은 187개 전체를 보유하며 마지막 날짜는 `2026-08-03`이다.
- 각 모델 경로는 마지막 실측점 하나를 공통 시작점으로 사용하고 1~4주 전망점을 잇는다.
- 각 전망점은 `value`, `lower90`, `upper90`, 평가 Coverage를 가진다.
- 시차 버튼은 대표 카드와 성능표의 시차만 바꾸며 차트의 1~4주 경로를 잘라내지 않는다.

### 5.2 축과 선

- Y축 범위는 현재 보이는 실측값과 점 전망값으로 계산한다. PI90 상·하한은 범위 계산에 넣지 않는다.
- 여유값은 `max(1, range × 0.045, abs(midpoint) × 0.0025)`이다.
- Y축 하한은 0보다 작아지지 않는다.
- Y축 눈금은 7개를 기준으로 한다.
- 실측선 굵기: 2.6px
- 일반 모델선 굵기: 2.7px
- 대표모델선 굵기: 4.8px
- 모델선은 모두 실선이다.
- 모델에 임의 점선 패턴을 부여하지 않는다.
- 모델 hover 시 대상선은 5.4px, 다른 모델선은 opacity 0.13으로 낮춘다. 실측선은 유지한다.

### 5.3 기간과 탐색

- `최근`: 직전 4개 실측이 가로 범위의 25%, 향후 1~4주가 75%를 차지한다.
- `전체`: `2022-11-07`부터 4주 전망일까지의 달력 시간축을 사용한다.
- 사용자 조정 최소 범위는 14일이다.
- 휠, 확대·축소 버튼, 드래그, 좌우 화살표로 기간을 조정한다.
- 항로 변경은 `최근`으로 돌아간다.
- 시차 변경, 범례 필터, 재측정 결과 반영은 현재 기간을 유지한다.
- 초기화 버튼, 더블클릭, `Home`은 `최근`으로 돌아간다.
- `End`는 `전체`로 전환한다.
- `Escape`는 열린 툴팁을 닫는다.

### 5.4 툴팁 표시 문구와 필드

모델 전망 툴팁 순서:

1. `{모델명} {시차}주 예측`
2. `YYYY.MM.DD`
3. `예측값`
4. `PI90 하한`
5. `PI90 상한`
6. `구간 너비`
7. `실현 Coverage {소수점 한 자리}% · {hits}/{total}회 적중`

실측 툴팁은 제목, 날짜, 값만 보인다. 툴팁 바탕은 `#001290`, 테두리는 `#3fa1eb`이다.

### 5.5 범례

- 순서: `KCCI 실측` 다음 모델 레지스트리 8개
- 모델 항목은 색상, 모델명, 계열을 보인다.
- 대표모델에는 `대표` 배지를 보인다.
- 사용자가 유지한 재측정 결과에만 `LIVE` 배지를 보인다.
- 선택 모델 목록이 비어 있으면 8개 모델을 모두 보인다.
- 하나 이상 선택하면 선택된 모델만 보이되 실측은 항상 보인다.
- 초기화 표시 문구: `전체 보기 · N개 선택`

---

## 6. 대표모델 선택과 카드

### 6.1 표시 문구

- 제목: `1페이지에 반영할 대표모델 선택`
- 안내: `기본값은 Naive를 제외한 1주 성능 자동 1위이며, 아래 카드를 누르면 이 항로의 대표모델을 직접 지정합니다.`
- 자동 상태: `자동 선택 중 · {모델명}`
- 수동 상태 버튼: `자동 선택으로 복원`

### 6.2 자동 선택 공식

각 시차에서 8개 모델의 검증 지표를 사용한다.

```text
bestMape = min(all 8 mapePct)
bestMse  = min(all 8 mse)
bestMase = min(all 8 mase)

mapeScore = 100 × bestMape / max(model.mapePct, 1e-9)
mseScore  = 100 × bestMse  / max(model.mse, 1e-9)
maseScore = 100 × bestMase / max(model.mase, 1e-9)
totalScore = (mapeScore + mseScore + maseScore) / 3
```

- 자동 대표는 1주 지표만 사용한다.
- Naive는 자동 후보에서 제외한다.
- Coverage는 종합점수에 넣지 않는다.
- 정렬은 `totalScore 내림차순 → mapePct 오름차순 → mase 오름차순 → mse 오름차순 → 모델 레지스트리 순서`다.
- 수동 선택은 Naive를 포함한 8개 모델 모두 허용한다.

### 6.3 수동 선택

- 모델 카드를 누르면 현재 항로의 수동 대표가 된다.
- 이미 선택된 카드를 다시 눌러도 수동 상태를 유지한다.
- `자동 선택으로 복원`은 현재 항로의 수동 선택만 지운다.
- 저장된 재측정 결과는 대표 자동 복원으로 지우지 않는다.
- 저장값이 유효하지 않으면 자동 대표로 안전하게 돌아간다.

### 6.4 대표 카드

- 카드 순서는 모델 레지스트리 순서다.
- 각 카드는 계열, 모델명, 선택 시차, 전망값, 현재값 대비 변화율을 보인다.
- 재측정 모델의 버전 표시는 `{버전} · 재측정`이다.
- 배지 표시 문구는 조건에 따라 `기준선 · 자동선정 제외`, `자동 1위`, `사용자 대표` 중 하나다.
- 선택 상태는 색만으로 전달하지 않으며 `aria-pressed`와 보이는 배지를 함께 사용한다.

---

## 7. 성능표

### 7.1 구조

열 순서:

1. `예측모델`
2. `MAPE`
3. `MSE`
4. `MASE`
5. `종합점수`
6. `{시차}주 Coverage`

행은 8개이며 선택 시차의 `totalScore` 내림차순으로 정렬한다.

### 7.2 표시 규칙

- 자동 우승 모델은 자동 상태를 보인다.
- 수동 대표 행은 보라색 왼쪽 강조선을 가진다.
- 모델 셀은 색상, 모델명, 버전, 정보 제어를 보인다.
- 재측정 버전은 `{버전} · 재측정`으로 보인다.
- MAPE: 소수점 두 자리와 `%`
- MSE: 반올림한 정수와 천 단위 구분
- MASE: 소수점 세 자리
- 지표 제어 안내: `점수 {소수점 한 자리} · 근거 보기`
- 종합점수: 소수점 한 자리
- Coverage: 소수점 한 자리 `%`와 `{hits}/{total}`
- MAPE, MSE, MASE 셀은 각각 해당 검증 근거 대화상자를 여는 버튼이다.

### 7.3 평가 방법 안내

안내 영역은 다음 사실을 짧게 전달한다.

- 모든 모델은 같은 52개 rolling-origin 외부평가 기록으로 비교한다.
- MAPE, MSE, MASE를 무차원 점수로 바꿔 동일가중 합산한다.
- Coverage는 품질 맥락으로만 보이며 종합점수에는 들어가지 않는다.
- Naive는 기준선이며 자동 대표 후보에서 제외된다.
- 수동 대표는 자동 1위와 별개로 유지된다.
- `LIVE`는 사용자가 결과 유지를 선택한 재측정에만 붙는다.

---

## 8. KNEI 기준 골든

### 8.1 1주 순위와 표 값

| 순위 | 모델 | MAPE | MSE | MASE | 종합점수 | Coverage |
|---:|---|---:|---:|---:|---:|---:|
| 1 | SARIMAX | 3.60% | 22,818.49 | 0.037 | 99.53184164830071 | 88.5% |
| 2 | TimesFM | 3.70% | 22,498 | 0.038 | 98.2 | 88.5% |
| 3 | Naive | 5.08% | 40,335 | 0.051 | 66.4 | 92.3% |
| 4 | XGBoost | 5.42% | 45,024 | 0.053 | 62.1 | 96.2% |
| 5 | Random Forest | 5.94% | 45,700 | 0.057 | 58.2 | 98.1% |
| 6 | LightGBM | 5.83% | 52,428 | 0.058 | 56.2 | 94.2% |
| 7 | Chronos | 6.49% | 62,842 | 0.060 | 51.0 | 88.5% |
| 8 | Prophet | 12.01% | 194,618 | 0.121 | 24.0 | 96.2% |

화면 반올림은 표시 단계에서만 한다. 순위와 대표 선택에는 원시 정밀도를 사용한다.

### 8.2 대표 전망 투영

- 항로: `KNEI`
- 현재 관측: `2026-08-03`, `4,884 USD/FEU`
- 자동 대표: `sarimax`, `SARIMAX`, `statsmodels-0.14.6`

| 시차 | 목표일 | 전망 | PI90 하한 | PI90 상한 | MAPE | MSE | RMSE | MASE | 종합점수 | Coverage | agreement 상/하/보합 |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | 2026-08-10 | 4,828.98 | 4,482.47 | 5,175.49 | 3.60% | 22,818.49 | 151.06 | 0.037 | 99.531842 | 46/52 = 88.5% | 1/4/3 |
| 2 | 2026-08-17 | 4,791.32 | 4,227.22 | 5,355.43 | 6.80% | 68,438.82 | 261.61 | 0.067 | 80.101993 | 49/52 = 94.2% | 1/4/3 |
| 3 | 2026-08-24 | 4,767.23 | 3,935.75 | 5,598.72 | 11.19% | 181,485.66 | 426.01 | 0.111 | 78.678841 | 48/52 = 92.3% | 2/4/2 |
| 4 | 2026-08-31 | 4,753.74 | 3,439.80 | 6,067.68 | 15.55% | 342,939.33 | 585.61 | 0.157 | 73.651080 | 49/52 = 94.2% | 0/4/4 |

agreement 구성원은 매 시차마다 모델 레지스트리 순서의 8개를 모두 포함한다.

---

## 9. MAPE 검증 근거 대화상자

### 9.1 표시 문구와 구성

- eyebrow: `ROLLING-ORIGIN · OUTER EVALUATION`
- 제목: `{항로명} · {모델명} · {시차}주 MAPE 검증 근거`
- 닫기 제어는 의미가 분명한 접근성 이름을 가진다.
- KPI: MAPE, 평가 기록 수, 평균 절대오차, 평가 문맥
- 차트: 52개 목표일의 실측과 전망
- APE가 7%보다 큰 기록은 높은 오차 톤으로 구분한다.
- 툴팁: 목표일, 전망, 실측, 부호 있는 차이, APE
- 표 열: `목표일`, `예측값`, `실측값`, `차이`, `APE`

### 9.2 공식

```text
MAPE = (1/n) Σ |(A_t - F_t) / A_t| × 100
```

각 기록의 원시 정밀도로 계산한 평균이 성능표 값과 일치해야 한다.

---

## 10. MSE 검증 근거 대화상자

- 제목 형식은 MAPE와 같고 지표명만 MSE로 바뀐다.
- KPI: MSE, RMSE, 평가 기록 수, 최대 제곱오차 목표일
- 시각화: 실측 대 전망, 기록별 제곱오차 막대, 평균선
- 제곱오차 상위 5개는 높은 오차 톤으로 구분한다.
- 표: 목표일, 실측, 전망, 오차, 제곱오차

```text
MSE = (e₁² + … + eₙ²) / n
RMSE = √MSE
```

---

## 11. MASE 검증 근거 대화상자

고정 분모는 첫 외부평가 origin보다 앞선 학습 이력만 사용해 한 번 계산한다.

```text
scale_fixed = mean(|y_t - y_(t-52)|)
MAE_model = mean(|A_t - F_t|) over the 52 outer evaluations
MASE = MAE_model / scale_fixed
```

- KPI: MASE, 모델 MAE, 고정 scale, 평가 기록 수
- 시각화: 실측 대 전망, 모델 오차 대 scale, scaled error 막대
- scaled error 1을 기준선으로 보인다.
- 표와 툴팁은 상위 오차 기록을 식별할 수 있어야 한다.
- 해석: `<1`은 계절 Naive보다 낮은 오차, `=1`은 동일, `>1`은 높은 오차다.
- 외부평가 도중 얻은 미래 잔차를 분모에 섞지 않는다.

### 11.1 세 근거 대화상자 공통 동작

- 문서 최상위 포털에 표시한다.
- 배경 클릭, 닫기 제어, `Escape`로 닫는다.
- 열린 동안 본문을 inert 처리하고 스크롤을 잠근다.
- 열 때 첫 의미 있는 제어로 초점을 옮기고 닫을 때 원래 지표 버튼으로 복원한다.
- 대화상자 내부만 스크롤하며 배경은 움직이지 않는다.

---

## 12. 고급설정 재측정 서랍

### 12.1 허용 상태

사용자에게 보이는 상태는 다음 네 개뿐이다.

- `idle`
- `running`
- `success`
- `error`

연결 확인과 사전 검증은 내부 처리다. 새 상태 배지, 진단 패널, 별도 건강 상태를 만들지 않는다.

### 12.2 기하와 헤더

- 데스크톱 너비: 560px
- 모바일 너비: 100vw
- 높이: 100dvh
- 오른쪽에서 열린다.
- 헤더 eyebrow: `LIVE`
- 제목: `고급설정`
- 문맥: `{항로명} · Python 예측엔진`
- 닫기 제어는 서랍 닫기 의미의 접근성 이름을 가진다.

### 12.3 섹션 01 — 재측정 모델

- 번호: `01`
- 제목: `재측정 모델`
- 안내: `한 번에 한 모델을 다시 검증합니다.`
- 선택 항목: 모델 레지스트리 8개
- 범례에서 한 모델만 선택된 경우 그 모델을 초기값으로 사용한다.
- 그 외에는 현재 대표모델을 초기값으로 사용한다.
- 프리셋: `엔진 기본`, `안정형`, `변화 민감형`
- 사용자가 매개변수를 직접 바꾸면 사용자 설정 상태로 전환한다.

### 12.4 섹션 02 — 학습창

- 번호: `02`
- 제목: `학습창`
- 안내: `각 fold에서 모델이 볼 수 있는 과거 범위입니다.`
- `Expanding` → `expanding`
- `최근 104주` → `rolling_104`
- `최근 52주` → `rolling_52`

### 12.5 섹션 03 — 하이퍼파라미터

- 번호: `03`
- 제목: `하이퍼파라미터`
- 안내: `허용 범위 안에서만 엔진에 전달됩니다.`
- Naive 안내: `Naive는 마지막 실측값을 그대로 사용하는 기준모델이라 조정할 하이퍼파라미터가 없습니다.`

### 12.6 검증 주의

- 제목: `검증 주의`
- 같은 외부평가 기록을 반복해 조정하면 과적합될 수 있음을 알린다.
- 최종 배포 판단에는 별도의 최종 holdout이 필요함을 알린다.
- 재측정이 최적 성능을 보장한다고 표현하지 않는다.

### 12.7 하단 제어 표시 문구

- 보조 버튼: `기본값 복원`
- 주요 버튼: `재측정하고 반영`
- 실행 중 주요 버튼: `실제 모델 계산 중…`
- 기본값 복원은 선택 모델의 매개변수만 초기화하며 학습창 선택은 유지한다.

---

## 13. 모델별 매개변수 계약

범위를 벗어나거나 step과 맞지 않는 값은 요청 전에 거부한다. 숫자 입력은 유한수만 허용한다.

### 13.1 SARIMAX

| 필드 | 기본값 | 범위/선택 | step |
|---|---:|---|---:|
| `p` | 1 | 0..3 | 1 |
| `d` | 1 | 0..2 | 1 |
| `q` | 1 | 0..3 | 1 |
| `trend` | `t` | `n`, `c`, `t`, `ct` | — |
| `seasonal_p` | 0 | 0..1 | 1 |
| `seasonal_d` | 0 | 0..1 | 1 |
| `seasonal_q` | 0 | 0..1 | 1 |
| `seasonal_period` | 52 | 4..52 | 1 |
| `maxiter` | 60 | 20..150 | 10 |

### 13.2 LightGBM

| 필드 | 기본값 | 범위 | step |
|---|---:|---:|---:|
| `n_estimators` | 80 | 20..500 | 10 |
| `learning_rate` | 0.04 | 0.005..0.3 | 0.005 |
| `num_leaves` | 15 | 4..127 | 1 |
| `max_depth` | 4 | 2..12 | 1 |
| `min_child_samples` | 8 | 2..40 | 1 |
| `subsample` | 0.9 | 0.5..1 | 0.05 |
| `colsample` | 0.9 | 0.5..1 | 0.05 |
| `reg_lambda` | 0.5 | 0..20 | 0.1 |

### 13.3 XGBoost

| 필드 | 기본값 | 범위 | step |
|---|---:|---:|---:|
| `n_estimators` | 80 | 20..500 | 10 |
| `learning_rate` | 0.04 | 0.005..0.3 | 0.005 |
| `max_depth` | 3 | 2..12 | 1 |
| `min_child_weight` | 3 | 1..20 | 1 |
| `subsample` | 0.9 | 0.5..1 | 0.05 |
| `colsample` | 0.9 | 0.5..1 | 0.05 |
| `reg_lambda` | 1 | 0..20 | 0.1 |

### 13.4 Random Forest

| 필드 | 기본값 | 범위 | step |
|---|---:|---:|---:|
| `n_estimators` | 100 | 20..500 | 10 |
| `max_depth` | 8 | 2..20 | 1 |
| `min_samples_leaf` | 3 | 1..20 | 1 |
| `max_features` | 0.75 | 0.2..1 | 0.05 |

### 13.5 Prophet

| 필드 | 기본값 | 범위 | step |
|---|---:|---:|---:|
| `changepoint_prior_scale` | 0.1 | 0.001..0.5 | 0.005 |
| `seasonality_prior_scale` | 10 | 0.01..20 | 0.1 |
| `changepoint_range` | 0.8 | 0.5..0.95 | 0.05 |

### 13.6 TimesFM과 Chronos

| 모델 | 필드 | 기본값 | 범위 | step |
|---|---|---:|---:|---:|
| TimesFM | `context_length` | 187 | 52..187 | 1 |
| Chronos | `context_length` | 187 | 52..187 | 1 |

### 13.7 프리셋 핵심값

지정하지 않은 필드는 모델 기본값을 유지한다.

| 프리셋 | 핵심 변경 |
|---|---|
| 안정형 SARIMAX | `trend=c`, `maxiter=100` |
| 안정형 LightGBM | `n_estimators=180`, `learning_rate=0.02`, `min_child_samples=14`, `reg_lambda=2` |
| 안정형 XGBoost | `n_estimators=180`, `learning_rate=0.02`, `min_child_weight=6`, `reg_lambda=2` |
| 안정형 Random Forest | `n_estimators=240`, `max_depth=7`, `min_samples_leaf=5`, `max_features=0.65` |
| 안정형 Prophet | `changepoint_prior_scale=0.03`, `seasonality_prior_scale=15`, `changepoint_range=0.8` |
| 안정형 TimesFM/Chronos | `context_length=187` |
| 변화 민감형 SARIMAX | `p=2`, `q=2`, `maxiter=100` |
| 변화 민감형 LightGBM | `n_estimators=120`, `learning_rate=0.08`, `num_leaves=31`, `max_depth=6`, `min_child_samples=4`, `reg_lambda=0.2` |
| 변화 민감형 XGBoost | `n_estimators=120`, `learning_rate=0.08`, `max_depth=6`, `min_child_weight=1`, `reg_lambda=0.2` |
| 변화 민감형 Random Forest | `n_estimators=180`, `max_depth=14`, `min_samples_leaf=1`, `max_features=1` |
| 변화 민감형 Prophet | `changepoint_prior_scale=0.25`, `seasonality_prior_scale=5`, `changepoint_range=0.9` |
| 변화 민감형 TimesFM/Chronos | `context_length=78` |

---

## 14. 재측정 요청 계약

재측정은 동결된 `TuneRequestV1`을 사용한다.

```text
TuneRequestV1 = {
  routeCode,
  modelId,
  dates: 187 ordered ISO dates,
  values: 187 finite observations,
  trainingWindow: "expanding" | "rolling_104" | "rolling_52",
  parameters: Record<string, string | number>,
  evaluationOrigins: 52
}
```

- 허용된 13개 항로와 8개 모델만 받는다.
- 날짜는 중복 없이 오름차순이어야 한다.
- 날짜와 값의 길이는 같아야 한다.
- 관측값과 숫자 매개변수는 유한수여야 한다.
- 모델별 허용 필드, 타입, 범위, step을 검증한다.
- 검증 실패는 네트워크 요청 전에 입력 오류로 보여 주며 기존 결과를 보존한다.
- 실제 모델 계산만 허용하며 합성 성공 결과를 만들지 않는다.
- 긴 실행은 내부적으로 최대 약 10분을 허용하되 새 사용자 상태를 추가하지 않는다.

---

## 15. 재측정 응답 계약

응답 봉투는 `GatewayResultV1<TuneSuccessV1, TuneRunState>`를 사용한다.

```text
GatewayResultV1 = {
  schemaVersion: "move-ai/gateway/v1",
  state: "READY" | "UNAVAILABLE",
  data,
  meta,
  error
}
```

- `READY`: `data`는 존재하고 `error`는 null이다.
- `UNAVAILABLE`: `data`는 null이고 안전한 오류 정보만 제공한다.
- 화면은 이 봉투 밖의 임의 응답 형태를 직접 소비하지 않는다.

`TuneSuccessV1`은 다음 의미를 보존한다.

```text
TuneSuccessV1 = {
  status: "success",
  routeCode,
  modelId,
  modelVersion,
  forecastOrigin,
  maseProtocol: "seasonal-naive-52-fixed",
  trainingWindow,
  evaluationOrigins: 52,
  parameters: Record<string, string | number>,
  forecasts: [h1, h2, h3, h4],
  metricsByHorizon: [h1, h2, h3, h4],
  evaluationByHorizon: [h1, h2, h3, h4],
  elapsedMs,
  methodologyKo
}
```

전망 항목:

```text
{ horizon, targetDate, value, lower90, upper90 }
```

전망 항목에는 `calibrationSampleSize`를 추가하지 않는다.

지표 항목:

```text
{
  horizon, mapePct, mse, rmse, mase,
  coverage90Pct, hits, total, sampleSize
}
```

평가 기록:

```text
{
  forecastOrigin, targetDate, predicted, actual, difference,
  absoluteError, apePct, lower90, upper90, covered90
}
```

검증 규칙:

- 전망·지표·평가 그룹은 모두 시차 1, 2, 3, 4의 고정 튜플이다.
- 모든 수치는 유한수이며 오차 지표는 음수가 아니다.
- `lower90 <= value <= upper90`를 만족한다.
- Coverage는 0..100, 횟수는 정수, `0 <= hits <= total`이다.
- 각 평가 그룹은 52개 기록을 가진다.
- 요청 항로·모델·origin과 응답이 일치한다.
- 하나라도 어긋나면 전체 재측정 결과를 거부하고 기존 기준값을 유지한다.

---

## 16. 재측정 상태 전이

### 16.1 idle

- 입력과 제어가 활성화된다.
- 저장된 유효 결과가 있으면 해당 값이 기준 화면에 반영된다.

### 16.2 running

- 모델·프리셋·학습창·매개변수·제출 제어를 비활성화한다.
- 실행 중에는 서랍 닫기, 배경 클릭, `Escape`를 막는다.
- 진행 문구는 `실제 모델 계산 중…`이다.
- 현재 차트와 성능표는 마지막 유효 결과를 계속 보인다.

### 16.3 success

- 후보 결과를 검증한 뒤 차트와 성능표에 임시 반영한다.
- 즉시 전후 비교 대화상자를 연다.
- 사용자가 결과 유지를 선택하기 전에는 영구 저장하지 않는다.

### 16.4 error

- 안전한 한국어 오류 문구를 보인다.
- 서랍을 열린 채로 둔다.
- 기준 결과와 저장된 결과를 변경하지 않는다.
- 입력을 고쳐 다시 실행할 수 있다.

---

## 17. 재측정 전후 비교 대화상자

### 17.1 표시 문구

- eyebrow: `RE-MEASUREMENT RESULT`
- 제목: `이전 결과와 재측정 결과 비교`
- 문맥: 항로, 모델, 실행 시간
- 닫기 접근성 이름: `비교창 닫고 결과 유지`
- 이전 메타: `직전 재측정 결과` 또는 `내장 기준 결과`
- 현재 메타: `이번 재측정 결과`
- 표본 배지: 두 결과가 같은 52개 평가 기록을 썼음을 표시
- 하단 안내: `새 결과는 이미 그래프와 성능표에 반영됐습니다.`

### 17.2 비교 내용

- MAPE 전후와 개선량을 요약한다.
- 1주 전망 이동은 성능 개선과 별개로 보여 준다.
- 행 순서: `1주 예측 운임`, `1주 PI90 구간`, `MAPE`, `MSE`, `MASE`, `PI90 Coverage`, `1주 종합순위`
- 비교 차트는 1~4주 전망을 보인다.
- 이전 결과는 회색 점선, 이번 결과는 남색 실선이다.
- 설정 영역은 학습창과 변경된 매개변수를 보인다.
- 변경이 없으면 변경 없음 상태를 보인다.
- 전체 8개 모델 가운데 순위의 전후 위치를 보인다.

### 17.3 결정

- 보조 버튼: `이전 결과로 되돌리기`
- 주요 버튼: `결과 유지`
- 결과 유지: 후보를 저장하고 `LIVE` 상태로 확정한다.
- 이전 결과로 되돌리기: 후보를 버리고 직전 유효 결과를 복원한다.
- 되돌리기는 이전 범례 선택과 차트 기간도 복원한다.
- 닫기 제어, 배경 클릭, `Escape`는 결과 유지와 동일하게 처리한다.

---

## 18. 저장 계약

동결된 저장 키 상수를 사용한다. 논리 키는 다음 세 범주다.

- 항로: `move-ai:route:v1`
- 재측정: `move-ai:tuning:v1:`
- 대표모델: `move-ai:representative:v1:`

### 18.1 재측정 저장

- 항로별, 모델별로 검증이 끝난 `TuneSuccessV1`만 저장한다.
- 결과 유지 후에만 저장한다.
- 항목 하나가 잘못되면 그 항목만 버리고 다른 유효 항목은 유지한다.
- 저장이 차단돼도 현재 탭의 확정 결과는 유지하고 비차단 경고만 보인다.

### 18.2 대표 저장

- 항로별 수동 모델 id만 저장한다.
- 자동 상태는 수동 항목이 없는 상태다.
- 모델 id가 레지스트리에 없으면 해당 항목을 버리고 자동 대표를 사용한다.

### 18.3 항로 동기화

- 초기 항로 우선순위: 유효한 query → 유효한 저장 항로 → `KNEI`
- 항로 변경은 화면 상태, query, 저장 항로, 공통 셸 이벤트를 한 동작으로 갱신한다.
- 다른 탭의 유효한 저장 변경은 storage event로 다시 계산한다.
- 같은 셸 안의 화면 이동도 현재 항로를 유지한다.

---

## 19. `RepresentativeSelectionV1` 인계

WT3는 canonical 스냅샷, 검증된 재측정 저장, 검증된 대표 저장을 합쳐 동결된 `RepresentativeSelectionV1` 하나를 생산한다.

```text
RepresentativeSelectionV1 = {
  route,
  currentObservation: { date, value, unit: "USD/FEU" },
  modelId,
  modelName,
  modelVersion,
  score1w,
  coverage1w,
  selectionMode: "automatic" | "manual",
  forecastSource: "baseline" | "tuned",
  tuningRunHash: string | null,
  evaluationProtocol,
  automaticChampion: { modelId, modelName, modelVersion, score1w },
  representativeRevision,
  forecasts: [h1, h2, h3, h4],
  metricsByHorizon: [h1, h2, h3, h4],
  modelAgreementByHorizon: [h1, h2, h3, h4]
}
```

전망 튜플:

```text
{ horizonWeeks, targetDate, point, lower90, upper90 }
```

지표 튜플의 각 항목:

```text
{
  horizonWeeks, mapePct, mse, rmse, mase,
  mapeScore, mseScore, maseScore, totalScore,
  coverage: { pct, hits, total, sampleSize, target: 0.90, intervalMethod }
}
```

agreement 튜플의 각 항목:

```text
{
  horizonWeeks,
  thresholdPct: 3,
  up, down, flat, total,
  members: [8 models in registry order]
}
```

각 구성원:

```text
{
  modelId, modelName, modelVersion,
  forecastSource: "baseline" | "tuned",
  tuningRunHash: string | null,
  point, changePct,
  direction: "up" | "down" | "flat"
}
```

### 19.1 생산 규칙

- 수동 id가 현재 항로의 레지스트리에 있으면 수동 대표, 아니면 재측정 병합 후의 1주 자동 대표를 쓴다.
- 선택 모델 하나를 1~4주 전망과 지표 전체에 동일하게 적용한다.
- 전망, 지표, agreement는 각각 시차 1, 2, 3, 4 순서의 고정 튜플이다.
- `currentObservation`은 현재 항로의 마지막 실측 날짜와 값이다.
- `deltaPct = changePct = 100 × (point / currentObservation.value - 1)`이다.
- `deltaPct >= +3`은 UP(`up`), `deltaPct <= -3`은 DOWN(`down`), 그 사이는 FLAT(`flat`)이다. `+3`과 `-3`은 각각 UP과 DOWN에 포함한다.
- 매 시차 `up + down + flat = total = 8`이어야 한다.
- Naive는 agreement에는 포함하고 자동 대표 선택에서만 제외한다.
- `automaticChampion`은 수동 선택 여부와 무관하게 현재 병합 결과의 자동 1위다.
- `forecastSource=tuned`는 사용자가 유지했고 전체 계약 검증을 통과한 결과에만 허용한다.
- `forecastSource=baseline`이면 `tuningRunHash=null`이다.
- 대표 모델, 버전, 프로토콜, 유효 전망·지표·agreement가 바뀌면 revision도 달라져야 한다.

### 19.2 canonical 직렬화와 식별값 소유권

WT3가 `tuningRunHash`와 `representativeRevision`의 생성 및 검증을 단독 소유한다. 다른 화면은 값을 새로 만들지 않고 WT3 결과를 소비하며, 수신 시 아래 규칙으로 유효성만 확인한다.

두 식별값은 같은 canonical JSON 직렬화를 사용한다.

1. 입력은 아래에 명시한 semantic projection의 JSON object 하나다. projection에 열거되지 않은 저장 봉투 필드와 volatile 저장 timestamp는 포함하지 않는다.
2. 모든 object key를 각 깊이에서 재귀적으로 사전식 오름차순 정렬한다. 비교는 key의 Unicode code point 순서다.
3. array 순서는 그대로 보존한다. 전망·지표는 1, 2, 3, 4주 순서이며 agreement는 4개 시차와 각 시차의 모델 레지스트리 8개 순서를 보존한다.
4. 값은 JSON primitive, object, array만 허용한다. `undefined`, 함수, binary 값, 사용자 정의 변환은 허용하지 않는다.
5. string은 JSON escape 규칙을 적용하고 boolean과 null은 각각 `true`, `false`, `null`로 직렬화한다.
6. number는 유한수만 허용하고 JSON의 가장 짧은 왕복 가능한 10진 표현을 사용한다. `-0`은 `0`으로 정규화한다. `NaN`, 양·음의 무한대는 직렬화 전에 거부한다.
7. key와 값 사이, 항목 사이, 줄 사이에 공백이나 개행을 넣지 않는다.
8. 완성된 문자열을 UTF-8 byte sequence로 인코딩한다.

#### 19.2.1 `tuningRunHash`

검증을 통과한 `TuneSuccessV1`에서 아래 필드만 같은 이름과 구조로 투영한다.

```text
{
  status,
  routeCode,
  modelId,
  modelVersion,
  forecastOrigin,
  maseProtocol,
  trainingWindow,
  evaluationOrigins,
  parameters,
  forecasts,
  metricsByHorizon,
  evaluationByHorizon,
  elapsedMs,
  methodologyKo
}
```

- `tuningRunHash` 자체와 저장 timestamp는 projection에 넣지 않는다.
- `forecasts`, `metricsByHorizon`, `evaluationByHorizon`의 튜플 및 기록 순서는 검증된 응답 순서를 보존한다.
- 계산식은 `tuningRunHash = lowercaseHex(SHA-256(UTF8(canonicalJson(tuningProjection))))`이다.
- 결과는 접두사 없는 소문자 16진수 64자여야 한다.
- 생성 시 전체 응답을 먼저 검증한 뒤 계산한다. 검증 시 같은 projection으로 다시 계산해 저장값과 일치하는지 확인한다.

#### 19.2.2 `representativeRevision`

검증을 통과한 `RepresentativeSelectionV1`에서 `representativeRevision`만 제외하고 다음 semantic projection을 만든다.

```text
{
  route,
  currentObservation,
  modelId,
  modelName,
  modelVersion,
  score1w,
  coverage1w,
  selectionMode,
  forecastSource,
  tuningRunHash,
  evaluationProtocol,
  automaticChampion,
  forecasts,
  metricsByHorizon,
  modelAgreementByHorizon
}
```

- 선택 모델의 id·표시명·버전·선택 방식·전망 출처·재측정 식별값과 평가 프로토콜을 모두 포함한다.
- `currentObservation`, 1~4주 전망, 1~4주 지표, 4개 시차 × 8개 모델 agreement 전체를 포함한다.
- `representativeRevision` 자체와 저장 timestamp는 projection에 넣지 않는다.
- 계산식은 `representativeRevision = "rep-v1:" + lowercaseHex(SHA-256(UTF8(canonicalJson(representativeProjection))))`이다.
- 결과는 `rep-v1:` 다음에 소문자 16진수 64자가 이어져야 한다.
- 생성 시 projection의 모든 계약 조건을 먼저 검증한 뒤 계산한다. 검증 시 같은 projection으로 다시 계산해 전달값과 일치하는지 확인한다.
- semantic 값 하나라도 바뀌면 새 식별값을 만든다. object key의 삽입 순서나 저장 timestamp만 바뀌면 식별값은 바뀌지 않는다.

### 19.3 실패 차단

다음 조건이면 소비자 인계를 차단한다.

- 비유한 수치
- 누락·중복·순서 오류가 있는 시차
- `lower90 > point` 또는 `point > upper90`
- 항로·모델·날짜 불일치
- 선택 모델과 전망·지표 모델의 불일치
- Coverage 산술 불일치
- agreement 구성원 8개 또는 합계 불일치
- canonical 직렬화 입력의 비유한 수치 또는 허용되지 않은 값
- 재계산한 `tuningRunHash` 또는 `representativeRevision` 불일치
- DTO revision 불일치

소비자는 원시 저장값을 직접 해석하거나 자동 대표와 재측정 결과를 다시 계산하지 않는다.

### 19.4 Dashboard 인계

- 전체 `RepresentativeSelectionV1`을 전달한다.
- 선택 시차의 읽기값은 `metricsByHorizon`에서 가져온다.
- 합의 정보는 같은 시차의 `modelAgreementByHorizon`에서 가져온다.
- 모델명, 버전, 점수, Coverage, 전망, 자동·수동 상태는 DTO 값만 표시한다.

### 19.5 Allocation 인계

- Dashboard와 동일한 DTO instance/revision을 전달한다.
- 계산에 영향을 주는 키는 `route`, `currentObservation.value`, `modelName`, `score1w`, `coverage1w`, 4개 전망이다.
- 계산 영향 키가 바뀌면 이전 작업을 취소하고 한 번만 다시 실행한다.
- provenance나 revision만 바뀌고 계산 영향 값이 같으면 다시 실행하지 않는다.
- 늦게 도착한 이전 작업 결과는 채택하지 않는다.
- 잘못된 DTO를 부분 채택하거나 다른 모델로 조용히 대체하지 않는다.
- WT5는 WT3가 만든 `tuningRunHash`와 `representativeRevision`을 소비하고 canonical 규칙으로 검증만 하며 새 값을 생성하지 않는다.

---

## 20. 시각 토큰과 타이포그래피

### 20.1 색상

| 역할 | 값 |
|---|---|
| navy | `#001290` |
| blue | `#15269d` |
| cyan | `#3fa1eb` |
| orange final alias | `#3fa1eb` |
| ink | `#141415` |
| muted | `#63666a` |
| line | `#e0e0e0` |
| canvas | `#f1f2f9` |
| nm dark | `rgba(21,38,157,.13)` |
| nm dark soft | `rgba(20,20,21,.08)` |
| nm light | `rgba(255,255,255,.9)` |

### 20.2 글꼴

- 글꼴 묶음: Pretendard → Noto Sans KR → Inter → system sans
- 페이지 eyebrow: 10px / 900 / 0.17em
- 페이지 h1: 23px
- 페이지 설명: 11px
- 섹션 eyebrow: 10px
- 섹션 h2: 18px
- 차트 축: 약 10px
- 성능표 헤더: 10px
- 성능표 주요 텍스트: 13px
- helper: 8px 기준
- 서랍 h2: 데스크톱 20px, 모바일 18px
- 비교 대화상자 h2: 데스크톱 23px, 모바일 18px

둥근 흰 카드와 회색 테두리 중심의 일반 SaaS 테마, 어두운 사이드바 팔레트, 모델 색상 통합, 범례의 단일 select 대체, 성능표의 카드 대체는 허용하지 않는다.

---

## 21. 반응형 계약

### 21.1 1440×900

- 사이드바 68px, 상단바 92px, 본문은 오른쪽에 배치한다.
- 첫 카드 제목과 도구는 같은 상단 문맥 안에서 조밀하게 배치한다.
- 차트 시작점이 승인 기준보다 약 45px 아래로 밀리거나 카드가 약 33px 더 커지는 추가 간격을 두지 않는다.
- 차트 높이는 420px다.
- 대표 카드는 4열이다.
- 성능표는 6열과 8행을 한 카드 안에서 유지한다.
- 서랍은 560px, 비교 대화상자는 최대 1000px다.

### 21.2 900×900

- 사이드바는 닫힌 상태이며 메뉴 제어를 보인다.
- 상단 도구는 필요한 만큼 줄바꿈한다.
- 대표 카드는 2열이다.
- 성능표만 자체 가로 스크롤을 가진다.
- 서랍은 최대 560px를 유지한다.

### 21.3 640×900

- 대표 카드는 1열이다.
- 카드 상단 동작은 세로로 정렬한다.
- 차트는 사용 가능한 폭에 맞추며 600px 최소 폭을 강제하지 않는다.
- 문서와 차트는 가로 스크롤을 만들지 않는다.
- 검증 근거, 재측정 필드, 학습창 제어, 설정 변경 영역은 1열이다.
- 성능표 래퍼만 가로 스크롤을 가진다.

### 21.4 375×812

- 사이드바는 닫히고 상단 제목은 넘치지 않는다.
- 데이터 기준 블록은 숨긴다.
- 카드 바깥 여백은 12px, 카드 내부 유효 폭은 약 302px다.
- 제목, 문맥, 도구는 조밀한 한 열로 쌓는다.
- 문맥과 도구 사이에 90~110px의 빈 공간을 추가하지 않는다.
- 범례와 차트를 승인 기준보다 약 250px 아래로 미는 여백을 만들지 않는다.
- 시차 버튼 4개는 한 줄에 들어간다.
- 항로 선택은 전체 폭이다.
- 차트는 약 302px 폭에 맞고 가로 스크롤이 없다.
- 대표 카드는 1열이다.
- 성능표만 가로 스크롤을 가진다.
- 서랍은 100vw다.
- 비교 대화상자는 최대 97dvh이며 하단 결정 버튼이 보인다.
- 근거 대화상자의 닫기 제어가 항상 보이고 내부 표만 필요한 스크롤을 가진다.

---

## 22. 상태와 오류 처리

### 22.1 로딩

- 승인 레이아웃의 카드 높이와 순서를 유지하는 skeleton을 사용한다.
- 차트와 표가 서로 다른 시점에 도착해 레이아웃이 크게 뛰지 않게 한다.

### 22.2 빈 결과

- 유효한 항로지만 데이터가 없으면 차트와 표 대신 같은 카드 안에 비차단 빈 상태를 보인다.
- 대표 선택과 재측정 제출은 비활성화한다.

### 22.3 기본 데이터 오류

- 스냅샷 또는 계약 검증 실패 시 잘못된 수치를 부분 표시하지 않는다.
- 화면 구조를 유지하고 안전한 오류 설명과 다시 시도 동작만 보인다.

### 22.4 재측정 오류

- 기존 기준값 또는 직전 유지 결과를 보존한다.
- 후보의 일부 전망이나 일부 지표를 섞지 않는다.
- 서랍에서 오류와 재시도 가능 상태를 보인다.

### 22.5 저장 오류

- 현재 탭에서 사용자가 확정한 결과는 유지한다.
- 영구 보존이 되지 않았음을 비차단 방식으로 알린다.
- 기존 유효 저장 묶음을 훼손하지 않는다.

---

## 23. 키보드, 초점, 접근성

- 모든 범례, 기간, 시차, 항로, 대표 카드, 지표 근거, 서랍, 비교 결정 제어는 키보드로 도달하고 실행할 수 있다.
- 초점 표시를 제거하지 않는다.
- 범례와 대표 카드는 색만으로 상태를 전달하지 않는다.
- 차트에는 현재 항로, 기간, 8개 모델 비교 목적을 설명하는 접근성 이름 또는 설명을 제공한다.
- 아이콘 전용 제어는 명확한 접근성 이름을 가진다.
- 대화상자와 서랍은 적절한 role, 제목 연결, focus trap을 가진다.
- 닫을 때 연 제어로 초점을 복원한다.
- 실행 중 닫기 차단은 보이는 비활성 상태와 보조기술 상태가 일치해야 한다.
- 표 헤더 관계와 정렬 상태를 보조기술이 알 수 있어야 한다.
- 텍스트와 제어 대비는 WCAG AA를 충족한다.

### 23.1 모션 감소

`prefers-reduced-motion: reduce`에서는 서랍·대화상자·선 강조 전환을 즉시 또는 최소 전환으로 바꾼다. 기능과 상태 변화 자체는 유지한다.

---

## 24. 금지 사항

- 8개 중 일부 모델을 숨겨 기본 화면을 단순화하지 않는다.
- 모든 모델선을 점선으로 만들지 않는다.
- 작은 화면 차트에 고정 600px 폭을 강제하지 않는다.
- Coverage를 종합점수에 넣지 않는다.
- Naive를 자동 대표 후보에 넣지 않는다.
- 1주 지표를 2~4주에 재사용하지 않는다.
- 재측정 후보를 결과 유지 전에 저장하지 않는다.
- 실패한 후보를 기준값과 섞지 않는다.
- 검증되지 않은 저장값을 신뢰하지 않는다.
- 소비자가 대표 선택, 점수, agreement를 별도로 재계산하게 하지 않는다.
- 실행 중 서랍을 닫아 진행 상태를 잃게 하지 않는다.
- 본 문서와 지정 데이터 팩에 없는 보이는 화면·필드·배지·진단 상태를 추가하지 않는다.

---

## 25. 필수 검증 시나리오

### 25.1 기본 화면

1. KNEI가 초기 항로로 열린다.
2. 187개 실측과 8개 모델의 1~4주 경로가 보인다.
3. 1주 자동 대표는 SARIMAX다.
4. 성능표는 8행이고 골든 순서와 값을 따른다.
5. 모델선은 실선이며 대표선만 4.8px로 강조된다.

### 25.2 시차와 범례

1. 1주에서 4주까지 전환할 때 카드와 표 값이 해당 시차로 바뀐다.
2. 차트의 네 전망점은 유지된다.
3. 범례 단일 선택과 다중 선택이 동작한다.
4. 실측은 항상 남는다.
5. 범례 변경 후 차트 기간이 유지된다.

### 25.3 대표 선택

1. 수동 대표를 선택하면 카드, 차트 강조, 표 강조, 저장, 인계가 함께 바뀐다.
2. 같은 카드를 다시 눌러도 수동 상태다.
3. 자동 복원은 수동 선택만 지운다.
4. 다른 항로의 수동 선택에는 영향을 주지 않는다.
5. 잘못된 저장 모델은 자동 대표로 돌아간다.

### 25.4 검증 근거

1. MAPE, MSE, MASE가 서로 다른 공식과 시각화를 보인다.
2. 각 대화상자는 52개 평가 기록을 사용한다.
3. 계산 결과가 성능표 원시 값과 일치한다.
4. 배경 inert, 스크롤 잠금, focus trap, 닫기 후 초점 복원이 동작한다.

### 25.5 재측정 성공

1. 유효한 요청이 running으로 전환된다.
2. 실행 중 입력과 닫기가 차단된다.
3. 전체 응답 검증 후 후보가 임시 반영되고 비교 대화상자가 열린다.
4. 비교에는 1~4주 전망, 지표, Coverage, 순위, 설정 변경이 보인다.
5. 결과 유지 후에만 저장되고 `LIVE`가 보인다.
6. 자동 대표와 agreement가 유지 결과로 다시 계산된다.
7. 소비자 DTO가 새 유효 결과와 revision을 전달한다.

### 25.6 재측정 복원과 실패

1. 이전 결과 복원은 후보를 버리고 차트, 표, 범례, 기간을 복원한다.
2. 입력 오류는 요청 전 거부하고 기준값을 보존한다.
3. 연결 오류와 실행 오류는 기존 결과를 보존한다.
4. 시차 누락, 날짜 불일치, 구간 역전, 비유한 수치, 평가 개수 오류는 전체 후보를 거부한다.

### 25.7 저장과 화면 간 인계

1. valid query, valid 저장 항로, KNEI 순서로 초기 항로를 정한다.
2. 항로 변경이 query, 저장, 셸 이벤트를 함께 갱신한다.
3. 다른 탭의 대표·재측정 변경이 다시 반영된다.
4. 유효 대표 hydration, 결과 유지, 이전 결과 복원이 소비자에 전달된다.
5. 계산 영향 값 변경은 한 번만 재실행한다.
6. provenance만 바뀐 경우 재실행하지 않는다.
7. 늦은 이전 작업 결과는 버린다.
8. 잘못된 DTO는 실패 차단한다.

### 25.8 반응형

1. 1440×900에서 본 문서가 지정한 카드 시작점, 420px 차트, 4열 카드, 6열 표를 확인한다.
2. 375×812에서 제목·문맥·도구 사이의 과도한 빈 공간이 없고 차트가 약 302px에 맞는다.
3. 900×900에서 대표 카드가 2열이다.
4. 640×900에서 대표 카드와 설정 영역이 1열이다.
5. 모든 크기에서 문서 가로 넘침이 없고 성능표만 자체 가로 스크롤을 가진다.

---

## 26. 시각 승인 기준

1440×900과 375×812에서는 같은 fixture·항로·상태·스크롤 위치의 브라우저 screenshot을 남기고, 900×900과 640×900에서는 같은 조건의 smoke screenshot을 남긴다. 수치 geometry와 style은 DOM 측정값·computed style로, 상태와 상호작용은 screenshot·recording으로 본 문서에 대조한다.

Figma/PNG는 `REFERENCE_ONLY`로 rough composition과 flow만 참고한다. Figma/PNG 차이만으로 실패하거나 차단하지 않으며 pixel parity·image diff·SSIM·mismatch 비율을 만들거나 판정에 사용하지 않는다.

| 항목 | 허용 편차 |
|---|---:|
| 상단바 높이 | 2px |
| 사이드바 폭 | 1px |
| 본문 가로 시작과 여백 | 2px |
| 주요 카드 모서리 위치 | 4px |
| 차트 높이 | 4px |
| 표 행 높이 | 3px |
| 글자 크기 | 1px |
| 모서리 반경 | 2px |

다음은 수치 허용 편차와 무관한 실패다.

- 문구, 항목 순서, 모델 순서, 표 열 순서 불일치
- 1440에서 차트 시작이 눈에 띄게 아래로 밀림
- 375에서 문맥·도구·범례 사이에 큰 빈 띠가 생김
- 모델선 점선화 또는 대표 강조 굵기 불일치
- 작은 화면 차트의 가로 스크롤
- 닫기 제어 또는 결정 버튼 잘림
- 문서 전체 가로 넘침

---

## 27. 완료 판정

다음 항목이 모두 충족돼야 완료다.

- 1440×900, 375×812 browser screenshot과 computed-style/geometry/state/interaction 증거가 본 명세 기준 통과
- 900×900, 640×900 smoke screenshot과 구간 점검 통과
- 8개 모델 차트, 카드, 표의 순서와 골든 통과
- MAPE, MSE, MASE 공식과 52개 근거 통과
- 자동·수동 대표 선택과 KNEI 골든 통과
- 유효 재측정 성공, 결과 유지, 이전 결과 복원 통과
- 입력·연결·응답·저장 실패 시 기준값 보존 통과
- 동결 Tune DTO 및 `RepresentativeSelectionV1` 검증 통과
- 저장, 탭 간 갱신, Dashboard·Allocation 인계 통과
- 키보드, focus trap, 초점 복원, 스크롤 잠금, 모션 감소 통과
- 문서 가로 넘침과 사용자 동작 중 오류 없음
- 남은 `P0=0`, `P1=0`

완료 기록에는 판정에 사용한 본 문서 section ID, browser evidence ID, 데이터 팩 버전, 네 화면 크기 결과, 수치 골든 결과, 상태 시나리오 결과, 접근성 결과, 남은 P0/P1만 적는다. 구현 위치나 과거 구현 이력은 완료 증거로 사용하지 않는다.
