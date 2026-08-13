# WT1 — Landing·공통 Shell 텍스트 구현 계약

## 1. 책임

WT1은 Landing 전체와 4개 업무 화면이 공유하는 Sidebar, Header, route 지속성을 소유한다. 업무 화면 본문은 소유하지 않는다.

계산·상태의 상세 계약은 `../docs/specs/WT1_FOUNDATION_LANDING.md`를 함께 적용한다.

## 2. Landing 표시 순서

1. 흰색 brand/CTA header.
2. 11초 소개 영상 hero.
3. `핵심 기능` eyebrow와 주제 문구.
4. 기능 카드 3개.
5. 서비스 강점 4개 trust strip.

footer, 별도 KPI strip, hero slogan 또는 추가 CTA를 넣지 않는다.

## 3. 정확한 표시 문구

### Header

- brand: `GLOVIS`
- CTA: `데모 사용`
- brand accessible name: `GLOVIS 화물구조망 홈`

### Feature heading

- eyebrow: `핵심 기능`
- 제목: `예측에서 선복계약 의사결정까지`
- 설명: `미래 스팟운임을 예측하고, 시나리오로 계약 비중을 추천하며, 글로벌 항로 상황을 모니터링합니다.`

### 카드 1

- 제목: `스팟운임 예측`
- 설명: `과거 운임 데이터를 분석해 향후 스팟운임의 흐름과 불확실성 구간을 예측합니다.`

### 카드 2

- 제목: `선복계약 비중 추천`
- 설명: `예측 시나리오별 예상 조달비용과 CVaR를 비교해 장기계약·스팟 조달 비중을 추천합니다.`
- 시각 보조값: `65%`, `장기계약 65%`, `스팟 조달 35%`, `CVaR 위험 반영`

### 카드 3

- 제목: `글로벌 물류 모니터링`
- 설명: `전 세계 13개 주요 항로와 운하·해협·항만의 기상 상태와 물동량을 한 화면에서 모니터링합니다.`
- 시각 보조값: `13`, `글로벌 항로`, `기상 정상`, `항만 물동량`, `1.1M TEU`, `운하·해협 감시`

### Trust strip

1. `글로벌 데이터 기반` / `다양한 항로 데이터 수집`
2. `AI·딥러닝 모델` / `정확도 높은 예측`
3. `실시간 모니터링` / `빠른 대응과 판단`
4. `전문가 인사이트` / `의사결정 지원`

## 4. 1440×900 기하

브라우저 CSS viewport는 1440×900을 기준으로 한다. 세로 scrollbar가 존재할 때 실제 content client width는 약 1428px일 수 있다.

| 영역 | 위치와 크기 |
|---|---|
| Header | top 0, height 78px, 좌우 padding 약 75px |
| Hero | top 78px, width 100%, height 500px |
| Feature section | hero 아래, 상단 padding 62px, 하단 padding 52px |
| 제목 block | 최대 폭 760px, 가운데 정렬 |
| Feature grid | 3열, 카드 약 399px, gap 22px |
| Feature card | radius 10px, padding 27px 27px 24px, 높이 약 300px |
| Trust strip | 4열, 높이 96px |

관찰 기준 typography:

- brand 19px/900.
- CTA 12px/800, pill radius 999px.
- feature H1 약 34px/850.
- card H2 17px/850.
- card 설명 12px, line-height 약 19.8px.

## 5. 375×812 기하

| 영역 | 위치와 크기 |
|---|---|
| Header | height 64px, 좌우 padding 20px |
| Hero | 16:9에 가까운 약 204~211px 높이 |
| Feature section | 좌우 20px, 상단 46px, 하단 36px |
| H1 | 24px/850 |
| Feature grid | 한 열 |
| 카드 | usable width 약 323~335px, padding 24px 22px 20px |
| Trust strip | 2열 유지, 약 166px 높이 |

문서 전체 가로 scroll은 0이다. trust strip을 한 열로 바꾸지 않는다.

## 6. 영상 계약

- 승인된 소유 media를 사용한다.
- duration은 11초다.
- 자동 재생, muted, playsInline.
- loop와 controls는 사용하지 않는다.
- 영상은 한 번 실행 후 마지막 프레임에 정지한다.
- reduced-motion은 움직임 없이 승인된 최종 프레임을 보여준다.
- poster, loading, decode failure 상태에서 레이아웃 높이는 유지한다.
- 임의 CSS 애니메이션이나 정적 지구 이미지를 원본 영상 대신 사용하지 않는다.

## 7. Landing 상호작용

- brand는 page top으로 이동한다.
- `데모 사용`은 Dashboard의 기본 route `KNEI`로 이동한다.
- 카드 전체를 임의 link로 만들지 않는다.
- 영상 click으로 play/pause control을 새로 추가하지 않는다.

## 8. 공통 업무 Shell

### Desktop

- collapsed Sidebar 68px.
- hover 또는 focus-within 확장 폭 244px.
- 확장은 overlay이며 main을 밀지 않는다.
- topbar는 sticky이며 약 92~96px 높이 문맥을 유지한다.
- navigation 순서는 Dashboard, Models, Network, Allocation이다.
- 모든 link는 현재 route query를 유지한다.

### 900 이하

- Sidebar는 폭 218px off-canvas drawer다.
- menu button은 40×40px다.
- 열리면 body scroll을 잠근다.
- Escape, 닫기 버튼, navigation 완료, unmount에서 lock을 정확히 복구한다.
- 닫은 뒤 menu opener로 focus를 돌린다.

### 375

- topbar 좌우 padding 14px.
- content usable width 약 351px.
- drawer와 portal은 viewport 밖으로 나가지 않는다.
- closed 상태에서 Sidebar rail이 보이지 않는다.

## 9. Route 지속성

초기 route 우선순위는 다음이다.

1. URL의 유효 route.
2. 저장된 유효 route.
3. `KNEI`.

route 변경은 URL, 저장값, Sidebar link, 현재 page를 하나의 transaction으로 갱신한다. invalid route는 하위 화면에 전달하지 않는다.

## 10. 완료 기준

- 영상이 실제 11초 media로 연결됨.
- Landing 문구와 순서가 정확함.
- 1440 3열/4열, 375 1열/2열 구성이 정확함.
- 업무 화면 모두 하나의 Shell을 사용함.
- mobile drawer focus, Escape, body lock이 정확함.
- route가 네 업무 화면을 이동해도 유지됨.
- 4개 viewport에서 document overflow 0.

