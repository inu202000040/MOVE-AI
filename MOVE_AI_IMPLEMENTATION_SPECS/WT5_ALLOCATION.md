# WT5 — CVaR 배분 최적화 텍스트 구현 계약

## 1. 목적과 책임

이 화면은 물동량 자체를 예측하는 화면이 아니다. 입력한 총 물동량을 고정계약 운임과 Spot으로 몇 %씩 나눌지 추천한다.

WT3가 제공한 같은 대표모델의 1~4주 point/PI90을 사용하고, WT6 validated snapshot과 route context를 소비한다. 계산과 DTO는 `../docs/specs/WT5_ALLOCATION.md`를 함께 적용한다.

## 2. 화면 순서

1. 공통 Header.
2. 현재 분석 입력값 strip.
3. 추천 비중 card와 KPI.
4. 고정운임 vs Spot 전망 card.
5. 3단계 계산 흐름.
6. 101개 비중 spectrum.
7. Spot 상승·하락 손실 card.
8. 조건부 입력 drawer.
9. 조건부 상세 결과 dialog.

## 3. Header와 입력 요약

- eyebrow: `CVAR ALLOCATION`
- 제목: `선복물량 최적화`
- 설명: `100,000개 운임경로를 고정운임·Spot 배분으로 전환합니다.`
- 기준일: `2026.08.03`
- region name: `현재 분석 입력값`
- eyebrow: `ANALYSIS INPUT`

KNEI 기본 표시:

| 항목 | 값 |
|---|---|
| 항로 | `유럽 · KNEI` |
| 대표모델 | `SARIMAX` |
| helper | `1주 종합점수 99.5점 · Coverage 88.5%` |
| 판단시점 | `1주` |
| 물동량 | `1,000 FEU` |
| 고정운임 | `$4,998/FEU` |
| action | `데이터 입력` |

## 4. 입력 drawer

- eyebrow: `DECISION INPUT`
- 제목: `배분 분석 데이터 입력`
- 설명: `고정 물동량과 고정운임, 판단 시점 및 추천 성향을 입력합니다.`
- fields 순서: 항로, 판단 시점, 고정 물동량, 고정계약 운임, 추천 성향.
- units: FEU, USD/FEU.
- 판단 시점: 1주, 2주, 3주, 4주.
- 추천 성향: `평균비용 우선`, `비용·위험 균형 · 권장`, `위험 방어 우선`.
- helper: `평균비용과 Spot 급등·하락 위험을 함께 고려합니다.`

대표모델 1~4주 mini card:

| 주차 | point | PI90 |
|---:|---:|---|
| 1주 | $4,829 | $4,482~$5,175 |
| 2주 | $4,791 | $4,227~$5,355 |
| 3주 | $4,767 | $3,936~$5,599 |
| 4주 | $4,754 | $3,440~$6,068 |

footer actions는 `취소`, `100,000개 분석 실행`이다. draft 변경은 실행 전 결과에 반영하지 않는다. 취소는 실행값을 보존한다.

## 5. 추천 비중 card

- eyebrow: `RECOMMENDED MIX`
- 제목: `고정운임·Spot 권고 비중`
- 설명: `예상 비용과 불리한 상황의 후회비용을 함께 고려합니다.`
- 상태: `계산 완료`
- donut center: `13%`, `고정운임`
- breakdown: 고정운임 13%, Spot 대응 87%, 분석 경로 100,000개.

KPI 순서:

1. `예상 비용` — `$4.85M`, `100,000개 전체 평균`.
2. `Spot 고정운임 초과확률` — `21.5%`, `100,000개 경로 기준`.
3. `후회비용` — `$176K`, `최악 10,000개 평균`.
4. `최종 총비용` — `$5.03M`, `비용·위험 균형 기준`.

reason:

`비용·위험 균형 기준에서 예상 비용 $4.85M과 후회비용 $176K을 함께 반영한 최종 총비용 $5.03M이 101개 배분안 중 가장 낮습니다.`

action은 `시뮬레이션 상세 결과 보기`다.

## 6. 고정운임 vs Spot 전망

- eyebrow: `CONTRACT VS SPOT`
- 제목: `고정운임 vs Spot 전망`
- 설명: `1주 운임 전망 · PI90과 입력 고정운임을 비교합니다.`
- 대표모델 badge: `SARIMAX`.

한 chart에서 다음 네 가로선을 구별한다.

- 상한 $5,175.
- 고정운임 $4,998.
- 점예측 $4,829.
- 하한 $4,482.

하단 정보:

- `Spot 운임 전망 범위` $4,482 → $5,175.
- `입력 고정운임` $4,998 / FEU.
- `점예측` $4,829 / FEU.
- `예측 대상 2026.08.10`.

## 7. 계산 흐름

1. `100,000개 4주 운임경로 생성`
2. `선택 시점에서 101개 배분비율 평가`
3. `최종 총비용이 낮은 비중 추천`

## 8. Spectrum

- eyebrow: `FIXED–SPOT SPECTRUM`
- 제목: `고정운임 0%에서 100%까지 비교`
- 설명: `100,000개 운임 시나리오에 101개 배분비율을 적용합니다.`
- legend 순서: 예상 비용, 후회비용, 최종 총비용, Spot 상승손실, Spot 하락손실.
- 후보는 고정 0%부터 100%까지 1% 간격 101개다.
- 추천 focus band는 고정 13%다.
- hover는 선택 후보의 비율과 비용 breakdown만 갱신한다.
- arrow/Page/Home/End 후보 탐색이나 vertical hover guide를 새로 추가하지 않는다.

risk cards:

- `Spot 상승손실` $172K — `Spot 운임이 고정운임보다 높을 때 Spot 배분에서 발생하는 추가비용`.
- `Spot 하락손실` $4K — `Spot 운임이 낮을 때 고정 배분으로 놓친 비용절감 기회`.

## 9. 계산 로직

기본값:

- horizon 1주.
- volume 1,000 FEU.
- fixed rate는 1주 point×1.035를 정수 반올림한 4,998.
- riskWeight 1.
- scenario 100,000개.
- 후보 101개.
- CVaR 90 tail 10,000개.
- 주간 상관 0.75.

각 후보의 목적함수:

`예상 비용 + riskWeight × CVaR90(경제적 후회비용)`

CVaR는 총 비용 자체의 상위 percentile이 아니라 각 scenario에서 사후 최적 배분 대비 불리해진 경제적 후회비용의 최악 10% 평균이다.

volume은 금액을 선형 배율하지만 현재 수식에서는 추천 비율을 바꾸지 않는다. 추천 비율을 바꾸는 입력은 horizon, fixed rate, riskWeight, forecast distribution이다.

KNEI golden:

- route seed 2,401,817,482.
- 추천 고정 13%, Spot 87%.
- expected cost 4,852,053.80057031.
- CVaR 176,052.3334165.
- objective 5,028,106.13398681.

## 10. 상세 결과 dialog

- 제목: `100,000개 시뮬레이션 상세 결과`
- eyebrow: `SIMULATION RESULT TRACE`
- 설명: `추천 비중을 만든 101개 배분안과 운임경로 분포를 확인합니다.`
- actions: `추천 비중 CSV`, close.

summary stats:

- 미래 Spot 경로 100,000개.
- 배분비중 후보 101개.
- 총 비용 평가 10,100,000건.
- 꼬리 기준 CVaR 90.
- 추천 배분 고정 13%.

tabs:

1. `비중별 결과 101개`
2. `운임경로 분포`
3. `계산 방법`

비중별 table은 7열이다.

1. 배분비율.
2. 예상 비용.
3. 평균단가/FEU.
4. 후회비용.
5. Spot 상승손실.
6. Spot 하락손실.
7. 최종 총비용.

추천 row는 `고정 13% · Spot 87% 추천`, `$4.85M`, `$4,852`, `$176K`, `$172K`, `$4K`, `$5.03M`이다.

CSV는 header 포함 100,001행 scenario export 계약을 따른다.

## 11. route·대표모델 변화

- route select는 WT1 route transaction을 사용한다.
- URL, 저장값, Sidebar, page state를 동시에 갱신한다.
- route 또는 allocation-effective 대표 forecast가 바뀌면 정확히 한 번 재실행한다.
- revision/provenance만 바뀌고 계산 입력이 같으면 재실행하지 않는다.
- late worker 결과는 현재 run을 덮지 못한다.
- invalid 대표 projection은 부분 채택하지 않고 fail-closed한다.

## 12. 반응형·완료 기준

- 1440에서 추천 card와 비교 chart가 2열 문맥을 유지한다.
- 375에서 입력 summary, cards, chart, risk cards는 1열이다.
- 640 drawer는 viewport 안에 있고 footer actions를 사용할 수 있다.
- 상세 dialog는 stats, tab strip과 현재 tab content를 읽을 수 있다.
- page 전체 horizontal overflow 0.
- 100,000×101 golden과 deterministic repeat가 일치.
- 입력 실행/취소, route 변경, 대표 keep/rollback, stale worker가 모두 검증됨.
- 화면에 없는 호환 mode, watchdog, 새 retry panel을 추가하지 않음.

