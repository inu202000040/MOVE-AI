# WT6 — 데이터·API 텍스트 구현 계약

## 1. 책임

WT6는 승인 XLSX/JSON 입력을 결정론적 runtime artifact로 변환하고, 모든 화면이 소비하는 typed gateway와 public API를 제공한다. UI는 소유하지 않는다.

전체 field·query·provider 규칙은 `../docs/specs/WT6_DATA_API.md`를 함께 적용한다.

## 2. 승인 데이터 사용

- route/port catalog.
- KCCI weekly actual.
- FX, Brent, VLSFO, HARPEX reference.
- port/chokepoint traffic.
- weather reference locations.
- route news profile.
- model forecast/evaluation/tuning.
- route event/corridor.
- runtime provider policy.
- CVaR configuration.

artifact는 원본 application snapshot을 복사하지 않고 승인 data pack에서 재생성한다. 생성 manifest에는 입력 파일, 크기, digest, row count, date range, unit과 생성 시각을 기록한다.

## 3. 일곱 public API

1. market.
2. news.
3. insight.
4. tuning/health와 실행.
5. port traffic.
6. chokepoint traffic.
7. weather.

각 route는 exact query allowlist를 사용한다. unknown, duplicate, extra 또는 legacy query는 INVALID_REQUEST로 거부한다.

## 4. Gateway envelope

모든 method는 다음 의미를 공유한다.

- state: domain 상태.
- data: valid state의 완전한 domain DTO 또는 unavailable의 null.
- meta: source, provider, mode, asOf, fetchedAt, cache, warnings.
- error: safe code/message/retryable.

generic envelope만 검사한 뒤 임의 payload를 domain DTO로 승격하지 않는다. method별 decoder가 envelope, state, data, meta와 error를 구조적으로 검증해야 한다.

## 5. 상태와 mode

domain state와 transport mode를 혼합하지 않는다.

- mode: live, cached, fixture, reference, unavailable.
- cache hit은 domain state `CACHED`가 아니라 `meta.mode=cached`로 표현한다.
- stale fixture/cache는 LIVE가 아니다.
- unavailable은 data null과 안전한 error를 가진다.
- 실제 0은 숫자 0으로 보존한다.
- missing, invalid, non-finite는 null 또는 row rejection이다.

## 6. Snapshot

- route 13개.
- route마다 weekly observation 187개.
- model 8개.
- horizon 1~4주.
- model/horizon evaluation 52회.
- point, date, lower90, upper90, MAPE, MSE, MASE, score, Coverage를 보존한다.
- date/unit/null/0을 변조하지 않는다.

## 7. Market

exact query는 series, from, to, providerVersion이다.

provider chain:

- FX: ECB → Yahoo → FRED.
- Brent: USDA/EIA → Yahoo → FRED.
- VLSFO: USDA.
- HARPEX: 승인 reference fixture.

KNEI smoke:

- FX 1,427.048 KRW/USD, 2026.08.03.
- Brent 88.9 USD/bbl, 2026.08.03.
- HARPEX unit `Index`.

모든 provider 실패는 UNAVAILABLE/no-store다. synthetic series를 만들지 않는다.

## 8. News

- route별 frozen search profile.
- primary 30일, 부족하면 90일 보조 범위.
- 최종 최대 5개.
- future article을 Insight 근거에서 제외.
- relevance, direct operation impact, route/country/port match를 점수화한다.
- URL/title 중복을 제거한다.
- 동일 점수 retry는 첫 결과를 유지한다.
- article에는 grade, direction, verified, reason, signals, source, published/effective date를 보존한다.

최초 수집은 사용자 action 이후다. server와 client cache가 다른 route 결과를 섞지 않는다.

## 9. Insight

provider chain은 Gemini → deterministic rule fallback이다. 다른 LLM provider를 넣지 않는다.

- request는 route, current, selected horizon, representative forecast/metrics, 8-model agreement, filtered news를 사용한다.
- model 기준일 이후 news는 제외한다.
- strict output decoder를 통과한 결과만 사용한다.
- Gemini 성공만 저장한다.
- rule fallback은 장기 저장하지 않는다.
- API key가 없어도 deterministic rule로 화면이 완성된다.
- provider failure를 새 UI 기능으로 바꾸지 않는다.

## 10. Port·chokepoint·weather

### Port

- summary query는 빈 query.
- detail은 id와 optional days만.
- 57 marker, 56 unique traffic series.
- detail 90일 trend.
- unit estimated metric tons.

### Chokepoint

- summary query는 빈 query.
- detail은 id만.
- 11개.
- 물동량과 통항 척수를 구분한다.

### Weather

- summary query는 빈 query.
- 82개 location.
- temperature, precipitation, wind/gust, visibility, wave/period, sea temperature.
- condition과 risk reason.

각 domain 실패는 독립적이다. traffic/weather failure가 static network catalog나 renderer를 실패시키지 않는다.

## 11. Tuning

- health는 실제 실행 가능성과 engine/version/reason을 정확히 반환한다.
- 실행할 수 없는 model을 available로 표시하지 않는다.
- request parameter는 model별 type/range를 검증한다.
- forecast는 정확한 1~4주 tuple이다.
- stale observation origin, 잘못된 future dates, metric mismatch, revision mismatch를 거부한다.
- 성공 결과는 WT3가 keep하기 전 기존 대표 projection을 덮지 않는다.

## 12. Cache·retry·abort

- cache key는 method, exact query와 relevant version을 포함한다.
- valid decoded payload만 저장한다.
- unavailable과 rule fallback의 저장 정책을 지킨다.
- stale-while-revalidate는 truthful mode를 유지한다.
- route/query 변경은 이전 request를 abort하거나 late result를 무시한다.
- retry는 해당 domain만 다시 실행한다.
- no-store failure를 성공 cache로 승격하지 않는다.

## 13. HTTP 의미

- valid LIVE/REFERENCE/STALE/PARTIAL 결과는 계약된 success status.
- invalid query는 400 계열과 INVALID_REQUEST.
- tuning engine unavailable은 503 의미.
- 내부 예외 stack, credential, provider raw response를 client에 노출하지 않는다.
- error message는 안전하고 action 가능한 문구만 제공한다.

## 14. 검증

- data pack에서 새 artifact를 두 번 생성했을 때 byte/digest 동일.
- 13×187×8×4와 52 evaluation invariant.
- network 13/57/56/11/82 invariant.
- method별 decoder가 malformed state/data/meta/extra key를 거부.
- API 7개 build manifest 존재.
- exact query negative tests.
- null과 실제 0 golden.
- LIVE/CACHED/REFERENCE/STALE/UNAVAILABLE truth table.
- provider timeout, cache hit, retry, abort, late response test.
- secret와 개인 경로가 artifact/log에 없음.

