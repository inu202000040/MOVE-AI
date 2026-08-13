# WT3 — Models·대표모델·튜닝 텍스트 구현 계약

## 1. 책임

WT3는 8개 forecast path, 외부평가, 자동·수동 대표모델, 근거 dialog, 고급설정 drawer, 재측정 비교와 다른 화면에 전달할 대표모델 projection을 소유한다.

계산과 저장 계약은 `../docs/specs/WT3_MODELS.md`를 함께 적용한다.

## 2. 화면 순서

1. 공통 Header.
2. 8개 모델 forecast card.
3. 대표모델 선택 안내.
4. 모델 카드 8개.
5. 모델 성능 비교 card.
6. 6열×8행 table.
7. 조건부 metric 근거 dialog.
8. 조건부 고급설정 drawer.
9. 조건부 재측정 비교 dialog.

## 3. Header와 forecast card 문구

- Header eyebrow: `MODEL VALIDATION`
- 제목: `예측 모델 디테일`
- 설명: `8개 모델의 1~4주 전망과 시차별 검증 성능을 비교합니다.`
- 기준일: `2026.08.03`
- card eyebrow: `EIGHT-MODEL FORECAST`
- card 제목: `8개 모델의 1~4주 예측경로 확대 비교`
- 설명: `기본은 직전 4개 실측과 향후 1~4주 예측을 확대 비교하며, 휠·드래그·기간 버튼으로 2022년부터 과거 흐름을 탐색할 수 있습니다.`
- context: `동일 187주 입력`
- KNEI summary: `유럽 · 직전 4주 + 향후 1~4주 · 전체 이력 탐색`
- representative helper: `사용자 대표 SARIMAX · 1주 기준`
- action: `고급설정`

## 4. 8개 모델

순서는 고정한다.

1. Naive — 기준모델.
2. SARIMAX — 통계 시계열.
3. LightGBM — 트리 부스팅.
4. XGBoost — 트리 부스팅.
5. Random Forest — 트리 앙상블.
6. Prophet — 추세·계절.
7. TimesFM — 사전학습 모델.
8. Chronos — 사전학습 모델.

KCCI 실측은 별도 legend다. 대표모델에는 `대표` badge를 붙인다.

## 5. Forecast chart

- 기본 domain은 직전 실측 4개와 향후 1~4주다.
- chart 높이 420px 문맥을 유지한다.
- 실측 line과 8개 forecast path를 함께 표시한다.
- 일반 model path는 solid 약 2.7px, representative는 약 4.8px다.
- 모델별 임의 dashed line을 만들지 않는다.
- PI90 lower/upper와 point를 tooltip에 제공한다.
- 기간 controls는 `+`, `−`, `전체`, `최근`이다.
- Home은 최근, End는 전체다.
- 375에서 chart를 600px로 강제해 page scroll을 만들지 않고 usable width 약 302px에 맞춘다.

tooltip field 순서:

1. `{모델} {N}주 예측`
2. 날짜.
3. 예측값.
4. PI90 하한.
5. PI90 상한.
6. 상·하한 폭.
7. Coverage와 hits/52.

## 6. 대표모델 선택

- 안내 제목: `1페이지에 반영할 대표모델 선택`
- 설명: `기본값은 Naive를 제외한 1주 성능 자동 1위이며, 아래 카드를 누르면 이 항로의 대표모델을 직접 지정합니다.`
- action: `자동 선택으로 복원`
- 8개 model card는 category, name, selected horizon point, 현재 대비 %, 상태를 보여준다.
- Naive는 `기준선 · 자동선정 제외`다.
- 자동 winner는 `자동 1위`, manual selection은 `사용자 대표`다.

KNEI 1주 관찰값:

| 모델 | point | 변화 |
|---|---:|---:|
| Naive | 4,884 | 0.0% |
| SARIMAX | 4,829 | -1.1% |
| LightGBM | 4,728 | -3.2% |
| XGBoost | 4,647 | -4.9% |
| Random Forest | 4,701 | -3.7% |
| Prophet | 5,140 | +5.2% |
| TimesFM | 4,800 | -1.7% |
| Chronos | 4,531 | -7.2% |

## 7. 모델 성능 비교

- eyebrow: `OUT-OF-SAMPLE SCORE`
- 제목: `모델 성능 비교`
- 설명: `1주 외부평가 오차를 무차원 점수로 바꾼 뒤 동일가중으로 합산`
- weight: MAPE 33.3%, MSE 33.3%, MASE 33.3%.
- table columns: 예측모델, MAPE, MSE, MASE, 종합점수, 1주 Coverage.
- 8개 row를 모두 표시한다.
- 각 metric cell의 `근거 보기`로 별도 dialog를 연다.

KNEI 1주 기준 상위값:

- SARIMAX: MAPE 3.60%, MSE 22,818, MASE 0.037, 종합 99.5, Coverage 88.5% 46/52.
- TimesFM: 3.70%, 22,498, 0.038, 종합 98.2, Coverage 88.5% 46/52.
- Naive: 5.08%, 40,335, 0.051, 종합 66.4, Coverage 92.3% 48/52.

Coverage는 순위 계산에 넣지 않는다.

## 8. Metric 근거 dialog

MAPE, MSE, MASE는 각각 독립 dialog다.

각 dialog는 다음을 제공한다.

- metric 정의.
- 공식.
- 같은 최근 52회 rolling-origin 평가 설명.
- 52개 fold의 실제값과 예측값.
- 선택 모델·주차에 대한 합계와 최종 metric.

open 동안 body scroll을 잠그고 Escape/X/overlay로 닫으며 trigger focus를 복구한다.

## 9. 고급설정 drawer

- eyebrow와 제목으로 재측정 작업임을 명확히 한다.
- literal engine 상태는 LIVE, idle, running, success, error를 구별한다.
- 섹션 순서: `01 재측정 모델`, `02 학습창`, `03 하이퍼파라미터`.
- 선택 모델에 허용된 parameter만 보여준다.
- 지원하지 않는 모델을 실행 가능하게 표시하지 않는다.
- client validation failure는 기존 대표 결과를 유지한다.
- running 중 중복 실행을 막는다.
- success는 기존 결과와 새 결과 비교 dialog를 연다.
- `유지`, `이전 결과 복원`은 대표 projection을 원자적으로 갱신한다.

## 10. WT2·WT5 전달

전달값에는 현재 관측, 자동 winner, 사용자 선택 모델, 선택 mode, 1~4주 point/PI90, horizon별 metric, 8개 모델 agreement와 revision/provenance를 보존한다.

WT2와 WT5는 이를 다시 계산하거나 raw 저장소를 직접 해석하지 않는다. provenance-only 변경은 Allocation 계산을 다시 실행하지 않고 allocation-effective forecast가 달라질 때만 한 번 재실행한다.

## 11. 반응형

- 1440: forecast card와 chart가 주 콘텐츠 폭을 사용하고 table은 6열 유지.
- 900: 주요 context/tools는 2열 smoke.
- 640: 1열로 전환.
- 375: chart와 card가 viewport 안에 맞고 table wrapper만 가로 scroll을 소유한다.
- body나 page 전체는 가로 scroll을 갖지 않는다.
- drawer와 dialog는 viewport 안에 clamp한다.

## 12. 완료 기준

- 8 model path와 1~4주 PI90 정확.
- 자동·수동 대표와 복원 정확.
- metric 공식과 52-fold evidence 정확.
- drawer success/keep/rollback/error 동작.
- WT2·WT5 projection 전달과 stale 차단.
- 1440/375 상세, 900/640 smoke, overflow 0.
- 화면에 없는 health panel이나 새 tuning badge를 추가하지 않음.

