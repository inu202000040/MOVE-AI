# WT4 — Network 3D globe 텍스트 구현 계약

## 1. 핵심 원칙

Network의 정상 화면은 WebGL2 기반 MapLibre 3D globe다. 2D는 정상 개발안이 아니라 WebGL2 미지원, GPU 초기화 실패 또는 context loss에서만 사용하는 장애 대응 renderer다.

관찰 환경에서 3D가 시작되지 않았다는 사실을 정상 디자인 기준으로 사용하지 않는다. 정상 환경에서 3D globe가 뜨지 않으면 P0다.

카탈로그·gateway·좌표 계약은 `../docs/specs/WT4_NETWORK.md`를 함께 적용한다.

## 2. 필수 데이터 수량

| 항목 | 수량 |
|---|---:|
| route | 13 |
| primary port | 13 |
| secondary port | 44 |
| 전체 port marker | 57 |
| 고유 항만 traffic series | 56 |
| secondary connector | 44 |
| chokepoint | 11 |
| weather location | 82 |

## 3. 화면 구조

1. 공통 compact Sidebar.
2. 높이 60px Network header.
3. header 아래 전체 immersive renderer.
4. 우상단 focus/actions.
5. 독립 weather status.
6. 좌하단 접히는 legend.
7. 우하단 선택 detail aside.
8. MapLibre navigation/scale controls.

지도를 일반 content card 안의 작은 지도로 축소하지 않는다.

## 4. 3D visual

- 바다는 deep navy.
- globe 주변에는 cyan-blue atmosphere halo.
- route는 cyan 본선과 어두운 외곽선을 사용한다.
- 선택 route와 connector는 amber로 강조한다.
- chokepoint는 orange 중심·corridor·gate 계층이다.
- weather는 normal, warning, severe를 색과 문구로 함께 표현한다.
- panel과 controls는 밝은 반투명 surface, navy heading, 부드러운 shadow다.

레이어 순서:

1. 배경과 대기.
2. chokepoint corridor와 halo.
3. route shadow와 route line.
4. secondary connector.
5. chokepoint center와 gate.
6. port marker.
7. weather marker.
8. selection/hover 강조.

## 5. 3D 준비 상태

1. shell과 map host를 먼저 렌더링한다.
2. WebGL2 환경에서 MapLibre map 생성을 시도한다.
3. canvas와 WebGL2 context가 실제 존재하는지 확인한다.
4. style 준비 뒤 projection을 `globe`로 확정한다.
5. 그 다음 map reference, controls, catalog layers와 interactions를 한 번만 설치한다.
6. remote basemap, glyph, decorative effect 실패는 base globe를 내리지 않는다.
7. 일반 tile/API 오류를 GPU 오류로 오분류하지 않는다.

## 6. Controls와 동작

focus mode는 `routes`, `chokepoints`, `combined` 세 가지다. radiogroup과 arrow-key 이동을 제공한다.

필수 동작:

- drag rotate/pan.
- wheel/control zoom.
- reset.
- route fit.
- port fit.
- chokepoint corridor fit.
- network item search/navigation.
- pointer와 keyboard 선택.
- overlap route 후보 선택.
- legend toggle.

pointer 우선순위는 weather, port, chokepoint, route다. 한 번의 pointer intent는 하나의 action만 만든다. LA와 Long Beach는 pointer와 Enter 모두 각각 자신의 panel을 연다.

## 7. Detail panel

panel은 중앙 modal이 아니라 map 위 aside다. desktop에서 right 22px, bottom 76px, radius 18px, padding 18px을 유지한다.

목표 폭:

- route 310px.
- overlap 380px.
- weather 420px.
- chokepoint 500px.
- port 520px.

### Route

- eyebrow route code.
- title `{한국어 이름} 노선`.
- 출발 `부산항`.
- 등록 목적항 수.
- 전체 기본 해상 회랑 문구.
- 안내: `노선은 항만 선택을 위한 권역 필터입니다. 물동량은 각 항만 포인트를 선택해 확인하세요.`

### Overlap

- eyebrow `OVERLAPPING ROUTES`.
- title `겹친 노선 {N}개`.
- helper `이 지점을 통과하는 노선입니다. 확인할 노선을 선택하세요.`
- 각 row에 code, 이름, 목적항 수.

### Port

- route code, traffic provider, 상태 label.
- title 항만 한국어 이름, subtitle 국가와 route.
- KPI: 최근 7일 추정 물동량, 전주 대비, 수입 추정, 수출 추정, 컨테이너선 입항, 기준일.
- chart eyebrow `PORTWATCH · RECENT 90 DAYS`.
- chart title `일별 추정 물동량 7일 이동합계`.
- unit `AIS 추정 · t`.
- action `항만 기상 보기`.

추정 metric tons를 TEU라고 쓰지 않는다.

### Chokepoint

- title 한국어 이름.
- 대표 통과 구간, 관련 route, 기준일.
- KPI: 최근 7일 추정 통과량, 전주 대비, 컨테이너선 통항.
- metric controls `추정 물동량`, `통항 척수`.
- chart group `PORTWATCH TREND`, `최근 7일 이동합계`.

### Weather

- eyebrow `LIVE WEATHER`와 관측 시각.
- title, subtitle, condition, risk.
- 기온, 강수, 풍속·돌풍, 가시거리, 파고·주기, 해수면 온도.
- footer `운항 승인용이 아닌 노선 위험 모니터링용 참고 실황입니다.`

## 8. 범례

초기값은 닫힘이다. 다음 8개 의미를 제공한다.

1. 부산항.
2. 목적항 57개.
3. 대표 해상 회랑.
4. 동일 route 권역 연결.
5. 해협.
6. 운하.
7. 기상 상태.
8. traffic 준비 시 AIS 7일 추정 통과량, 아니면 chokepoint corridor 11개.

footer는 3D에서 `드래그 회전 · 표식 클릭은 상세 정보`, 2D에서 `드래그 이동 · 표식 클릭은 상세 정보`다.

## 9. 2D 장애 fallback

2D fallback은 오류 card가 아니라 같은 업무를 계속 수행하는 지도다.

- 같은 13/57/44/11/82 registry.
- Mercator 배경과 SVG/DOM geometry.
- pan, zoom, reset.
- route, port, chokepoint, weather pointer/keyboard 선택.
- overlap과 focus mode.
- 같은 detail panel과 data.
- antimeridian 안전 처리.
- background 자산이 없어도 ocean, graticule, geometry와 interactions 유지.

표시 문구:

- `WebGL2 미지원 · 2D 지도 모드`
- `3D 가속 초기화 실패 · 2D 지도 모드`
- `3D 그래픽 연결 끊김 · 2D 지도 모드`
- `배경 지도 연결 지연`
- `네트워크 레이어는 계속 사용할 수 있습니다.`

## 10. 상태 진실성

- port: LIVE, PARTIAL, STALE, UNAVAILABLE.
- chokepoint: LIVE, STALE, UNAVAILABLE.
- weather: LIVE, PARTIAL, UNAVAILABLE.
- 실제 0, null, unavailable을 구분한다.
- stale/fixture를 LIVE로 표시하지 않는다.
- domain 실패는 다른 domain, renderer, 정적 catalog를 내리지 않는다.
- retry는 해당 domain만 다시 요청한다.

## 11. 반응형

### 1440×900

- Sidebar 68px.
- header left 68px, height 60px.
- renderer top 60px, left 68px, right/bottom 0.
- actions top 8px/right 20px.
- legend bottom 24px/left 88px.
- detail right 22px/bottom 76px.

### 900·640

- Sidebar는 overlay.
- renderer left 0, width 100%.
- 640 header는 60px.
- actions와 panel을 viewport 좌우 12~18px 안에 둔다.

### 375×812

- panel은 실제 client width 기준 좌우 18px 이상.
- width는 client width-36px 이하.
- max-height는 min(61vh, 520px).
- heading, 첫 KPI, close가 잘리지 않는다.
- panel 내부만 scroll한다.
- focus controls, legend, reset을 숨기지 않는다.

## 12. 완료 기준

- 실제 WebGL2 환경에서 canvas, projection=globe, same-origin worker/style 확인.
- 13 route, 57 port, 11 chokepoint, 82 weather interaction.
- 3D route/port/choke/weather/overlap/focus/pan/reset 동작.
- WebGL2 unsupported와 context loss에서 usable 2D.
- pointer와 keyboard가 같은 ID를 선택.
- panel이 1440/375 viewport 내부.
- 900/640 smoke와 overflow 0.
- fatal console, hydration overlay, unhandled rejection 0.

