# WT4 — 글로벌 항만 네트워크 clean-room 구축 명세

## 0. 목적과 판정 언어

이 문서는 글로벌 항만 네트워크 화면의 독립 구현 기준이다. 구현 권위는 아래 세 가지로 제한한다.

1. 승인된 데이터 팩 `01`, `09`, `12`를 입력으로 WT6가 결정론적으로 생성한 현재 canonical network catalog seam, manifest bytes와 identity.
2. traffic, corridor, event, provider enrichment에만 사용하는 승인된 데이터 팩 `07`, `08`, `16`, `17`.
3. 동결된 gateway 계약과 공통 route 계약.
4. 공식 MapLibre GL JS 배포 패키지와 공식 문서.

GeoLibre는 적법한 라이선스 범위에서 globe 운용 개념을 이해하는 참고 자료로만 사용할 수 있다. GeoLibre, deck.gl, Cesium 또는 다른 플랫폼을 화면 구조나 런타임 전체의 대체물로 도입하지 않는다.

판정 용어는 다음과 같다.

- `MUST`: 완료에 필수다.
- `MUST NOT`: 구현하면 결함이다.
- `SHOULD`: 다른 선택을 하려면 검증 근거가 필요하다.
- `P0`: 핵심 경로가 작동하지 않거나 사용자가 업무를 이어갈 수 없다.
- `P1`: 핵심 경로는 있으나 의미, 선택, 접근성 또는 반응형 동작이 틀렸다.

CP1은 중간 점검일 뿐 완료가 아니다. 최종 완료는 P0와 P1이 모두 0이고 이 문서의 종료 조건을 모두 충족한 상태다.

---

## 1. 소유 범위

WT4는 다음을 소유한다.

- 글로벌 네트워크 화면 본문과 지도 호스트.
- MapLibre WebGL2 3D globe 렌더러.
- 실제 그래픽 초기화 실패를 판별하는 준비 상태 관리.
- 그래픽 미지원 또는 context loss에서 사용하는 대화형 2D 지도.
- 13개 대표 해상 회랑.
- 57개 목적항 표식과 44개 보조 연결선.
- 11개 초크포인트 중심·회랑·게이트.
- 82개 기상 위치와 겹침 완화.
- route, port, chokepoint, overlap, weather 선택 상태.
- pan, zoom, fit, reset, focus 제어.
- 항만·초크포인트·기상 요약과 상세 패널.
- renderer와 데이터 장애의 분리.
- 키보드 탐색과 focus 복귀.
- 1440×900, 375×812 주 기준과 900, 640 중간 폭 검증.

WT4는 다음을 새로 정의하지 않는다.

- 공통 shell의 전역 navigation 구조.
- gateway 응답 스키마와 upstream 정규화 규칙.
- `NetworkCatalogSeamV1` 또는 `NetworkCatalogSeamIdentityV1`의 생산·재생성·수정.
- 다른 업무 화면의 계산 또는 추천 로직.
- 승인된 데이터 팩에 없는 항만, 회랑, 초크포인트, 기상 위치.
- 완성 화면에 없는 추가 배지, 필드, 패널, 모드 또는 설정.

---

## 2. WT6 canonical seam 소비 계약

### 2.1 입력 권위

WT6는 승인된 데이터 팩 `01/09/12`를 입력으로 현재 canonical catalog exact bytes와, 그 생성에 실제 사용한 승인 manifest exact bytes를 결정론적으로 생성한다. WT6는 같은 생성 실행에서 현재 `NetworkCatalogSeamIdentityV1`과 producer/provenance metadata를 계산해 두 exact-byte 입력과 함께 하나의 handoff로 제공한다. WT6는 `NetworkCatalogSeamV1`과 `NetworkCatalogSeamIdentityV1`의 유일한 생산자다. WT4는 이 handoff를 그대로 소비하며 카탈로그를 생성하거나 다시 쓰지 않는다. 데이터 팩은 생성 입력이며 identity 생산자가 아니다.

WT4가 소비하는 seam은 다음 identity를 함께 가져야 한다.

- WT6가 제공한 `NetworkCatalogSeamV1` 전체 구조.
- WT6가 제공한 `NetworkCatalogSeamIdentityV1` 전체 구조.
- 수신 identity의 `catalogSeamSha256`, `byteSize`와 counts.
- 수신 seam의 `referenceManifestSha256`.
- 같은 handoff의 WT6 producer/provenance metadata에 기록된 canonical catalog `byteSize`.
- WT6가 해당 catalog 생성에 실제 사용하고 같은 handoff로 제공한 승인 manifest exact bytes.

canonical seam의 불변 수량은 다음과 같다.

| 항목 | 수량 |
|---|---:|
| route | 13 |
| primary port | 13 |
| secondary port | 44 |
| 전체 port marker | 57 |
| 고유 PortWatch series | 56 |
| secondary connector | 44 |
| chokepoint | 11 |
| weather location | 82 |

기상 위치 82개는 부산 1개, 항만 57개, 초크포인트 11개, route 대표 위치 13개의 합이다.

### 2.2 소비 불변조건

- WT4는 seam의 ID, 좌표, 배열 순서, waypoint, 수량, upstream ID 또는 identity 필드를 수정하지 않는다.
- 모든 ID가 안정적이고 중복이 없는지 검증한다.
- route, port, chokepoint, weather 배열이 ID 오름차순인지 검증한다.
- route의 waypoint 순서가 보존됐는지 검증한다.
- 경도가 -180 이상 180 이하이고 위도가 -90 이상 90 이하인지 검증한다.
- 각 route에 primary port가 정확히 하나인지 검증한다.
- 모든 port가 존재하는 route를 참조하는지 검증한다.
- 모든 weather 항목이 존재하는 route, port 또는 chokepoint를 참조하는지 검증한다.
- weather ID가 종류와 대상 ID의 안정적 결합인지 검증한다.
- LA와 Long Beach는 서로 다른 표식과 ID를 유지한다.
- LA와 Long Beach가 하나의 PortWatch series를 공유해도 합계를 중복 집계하지 않는다.
- seam의 좌표 정밀도를 임의 반올림하지 않는다.
- consumer 편의를 위해 재정렬하거나 파생 카탈로그로 대체하지 않는다.

### 2.3 enrichment 입력 경계

승인된 데이터 팩 `07/08/16/17`은 traffic, corridor, event, provider enrichment 입력이다.

- enrichment는 canonical ID로 join한다.
- enrichment는 canonical ID, 좌표, 배열 순서, waypoint, 수량을 바꾸지 않는다.
- enrichment는 `catalogSeamSha256` 또는 `referenceManifestSha256`을 바꾸지 않는다.
- enrichment 누락 또는 실패가 canonical seam을 새로 만들게 해서는 안 된다.
- enrichment와 seam이 충돌하면 seam이 우선하며 해당 enrichment만 fail-closed한다.
- enrichment 결과를 `NetworkCatalogSeamV1` 또는 identity로 승격하지 않는다.

### 2.4 구조·identity 검증과 fail-closed

카탈로그는 화면 상태로 승격하기 전에 다음을 모두 검증한다.

- 입력이 WT6가 생산한 canonical seam과 identity의 동결된 DTO 구조 계약을 충족한다. 동결 대상은 필드 구조이며 digest 값은 현재 handoff의 실제 bytes에서만 계산한다.
- 수신한 canonical seam raw bytes의 길이를 직접 계산하고 `actual raw catalog byte length == received NetworkCatalogSeamIdentityV1.byteSize == same handoff producer/provenance metadata.byteSize`의 세 값 동등성을 확인한다.
- 수신한 canonical seam raw bytes를 parse, normalize 또는 다시 serialize하기 전에 SHA-256을 직접 계산한다.
- 계산한 seam digest가 수신한 `identity.catalogSeamSha256`과 일치하는지 확인한다.
- 같은 handoff에서 수신한 승인 manifest exact bytes의 SHA-256을 어떤 normalize 또는 재직렬화도 하기 전에 직접 계산한다.
- 계산한 manifest digest가 수신 canonical seam의 `referenceManifestSha256`과 일치하는지 확인한다.
- 허용된 필드만 존재한다.
- ID 형식, 좌표 형식, 좌표 범위가 유효하다.
- 정렬 순서와 중복 부재가 확인된다.
- 수량이 13/57/11/82와 일치한다.
- primary port 관계와 weather 대상 관계가 유효하다.
- 고유 PortWatch series가 56개다.
- 수신 identity의 counts와 canonical seam에서 직접 센 실제 수량이 일치한다.
- actual raw catalog byte length, 수신 identity `byteSize`, producer/provenance metadata `byteSize`, counts, seam digest, manifest digest 중 어느 하나라도 다르면 compatible로 승격하지 않는다.
- 비교 기준은 매번 같은 handoff에서 실제 수신한 canonical seam bytes, 승인 manifest exact bytes, identity와 producer/provenance metadata뿐이다.

검증 실패 시 동적 traffic/weather overlay는 차단한다. 이미 검증된 정적 geometry, 선택, pan, zoom, reset은 유지한다. 불완전한 값을 정상 데이터처럼 화면에 올리지 않는다.

---

## 3. 사용자 완료 시나리오

사용자는 3D와 허용된 2D 모두에서 다음 작업을 수행할 수 있어야 한다.

1. 13개 route 중 하나를 선택하고 전체 회랑을 본다.
2. 겹친 회랑 지점에서 후보를 확인하고 원하는 route를 고른다.
3. 57개 port 중 하나를 pointer 또는 keyboard로 선택한다.
4. 항만의 최근 7일 추정 물동량과 90일 추세를 확인한다.
5. 11개 chokepoint 중 하나를 선택하고 관련 route와 traffic을 확인한다.
6. 82개 weather 위치 중 하나를 선택하고 기상·해상 상태를 확인한다.
7. routes, chokepoints, combined focus를 전환한다.
8. 지도를 pan, zoom, fit하고 초기 위치로 reset한다.
9. 패널을 닫아 직전 선택으로 돌아간다.
10. 3D가 실제로 불가능해진 경우 동일한 항목과 패널을 2D에서 계속 사용한다.

---

## 4. 3D globe 우선 원칙

### 4.1 불변조건

- WebGL2 지원 환경의 첫 번째 renderer는 반드시 MapLibre 3D globe다.
- 지원 환경에서 2D를 먼저 표시하거나 정상 경로를 2D로 고정하면 P0다.
- 실제 MapLibre canvas가 존재해야 한다.
- 최종 projection은 `globe`여야 한다.
- 같은 MapLibre 배포 버전의 worker와 style 자산을 사용한다.
- worker와 style 자산은 same-origin으로 제공되고 정상 응답해야 한다.
- 준비 완료 전 route, port, chokepoint, weather 데이터 레이어를 설치하지 않는다.
- 빈 호스트, 오류 카드만 있는 화면, canvas 없는 정상 판정은 허용하지 않는다.

### 4.2 초기화 순서

1. shell과 지도 호스트를 먼저 안정적으로 렌더링한다.
2. 브라우저가 WebGL2를 제공하는 경우 실제 MapLibre Map 생성을 시도한다.
3. 생성 과정의 동기 GPU 오류와 초기 context 오류를 즉시 포착한다.
4. 생성자가 부분 객체를 반환할 수 있음을 전제로 후보를 다룬다.
5. 후보 canvas가 없거나 후보 canvas에서 WebGL2 context를 얻을 수 없으면 controls, data, listeners를 확장하지 않고 안전하게 폐기한다.
6. 후보가 최소 조건을 통과하면 `style.load`를 가장 이른 시점에 한 번 등록한다.
7. 등록 시 이미 style이 준비됐다면 같은 준비 함수를 microtask로 호출한다.
8. 이벤트와 이미 준비된 경로가 동시에 호출돼도 promotion은 한 번만 실행한다.
9. `style.load`에서 globe projection을 강제한 뒤 canvas, WebGL2 context, projection을 최종 확인한다.
10. 최종 확인 뒤에만 map 참조, navigation control, scale control, data, layers, selection handlers를 설치한다.
11. `load`와 `idle`에서도 projection이 `globe`인지 확인하고 필요하면 다시 적용한다.
12. cleanup 또는 실패 뒤 늦게 끝난 비동기 작업은 현재 renderer를 변경하지 못한다.

positive readiness를 Map 생성 직후 projection 값만으로 판정하지 않는다. healthy WebGL2 환경에서도 style 준비 전 projection이 아직 확정되지 않을 수 있다.

### 4.3 최소 globe와 점진적 확장

- 초기 style은 원격 타일에 의존하지 않는 최소 globe를 먼저 만든다.
- 최소 globe 준비가 확인된 뒤 배경 지도와 업무 데이터 레이어를 추가한다.
- 배경 지도, glyph, 장식 효과의 실패는 base globe 준비를 취소하지 않는다.
- decorative WebGL effects layer의 실패는 nonfatal이다.
- 일반 tile, glyph, style 또는 개별 데이터 오류를 GPU failure로 분류하지 않는다.
- 실제 route와 marker는 정적 카탈로그만으로 먼저 선택 가능해야 한다.
- traffic과 weather는 늦게 도착하는 점진적 정보다.

### 4.4 시각 분위기

- 지도는 전체 작업 영역을 채우는 몰입형 globe다.
- 바다는 깊은 navy 계열, 대기는 cyan-blue halo 계열이다.
- route는 cyan 계열과 어두운 외곽으로 육지·바다 위에서 읽혀야 한다.
- 선택 route와 connector는 amber 계열로 분명히 구별한다.
- chokepoint는 orange 계열 중심·회랑·게이트 계층을 유지한다.
- weather 상태는 normal, warning, severe 의미를 색과 문구로 함께 전달한다.
- 장식 효과는 route, marker, panel 가독성을 방해하지 않는다.
- 공통 shell은 밝은 표면, 지도는 어두운 immersive 영역을 유지한다.
- 지도 위 패널과 controls는 밝은 반투명 표면과 부드러운 입체감을 유지한다.

---

## 5. 3D 레이어와 상호작용 계층

### 5.1 필수 geometry

- 13개 route 회랑은 antimeridian을 안전하게 분리한다.
- 부산 출발 anchor와 57개 목적항을 연결한다.
- 44개 secondary port는 해당 route에 보조 connector를 가진다.
- chokepoint마다 중심, 대표 회랑, 양끝 gate를 가진다.
- weather 위치는 route, port, chokepoint 의미를 유지한다.

### 5.2 그리기 순서

아래에서 위 순서는 다음 의미를 보존한다.

1. 배경과 대기.
2. chokepoint 회랑과 halo.
3. route shadow와 route 본선.
4. secondary connector.
5. chokepoint 중심과 gate.
6. port 표식.
7. weather 표식.
8. 선택 및 hover 강조.

선택 geometry는 관련 없는 geometry보다 항상 분명해야 하며 hit 영역은 보이는 도형보다 넓게 제공한다.

### 5.3 focus mode

focus mode는 `routes`, `chokepoints`, `combined` 세 가지다.

- routes: route와 port가 우선이고 chokepoint는 약해진다.
- chokepoints: chokepoint와 관련 route가 우선이고 나머지 route는 약해진다.
- combined: 모든 네트워크 범주를 함께 읽을 수 있다.
- 현재 선택 항목은 focus mode보다 우선한다.
- mode는 radiogroup 의미와 arrow-key 이동을 제공한다.
- 2D에서도 같은 의미와 선택 결과를 유지한다.

### 5.4 pointer 선택 우선순위

한 번의 pointer intent는 하나의 action만 만든다.

1. 가장 가까운 weather target.
2. 가장 가까운 port target.
3. chokepoint target.
4. route target 전체.

- 빈 바다는 현재 선택을 지우지 않는다.
- 겹친 route는 ID로 중복 제거하고 전역 route 순서로 정렬한다.
- route 후보가 둘 이상이면 첫 항목을 임의 선택하지 않고 overlap panel을 연다.
- LA와 Long Beach처럼 가까운 port는 pointer hit 영역과 accessible target이 1:1이어야 한다.
- 한 port의 pointer click과 Enter는 반드시 같은 port panel을 연다.
- hit geometry가 겹치면 안정적 collision 배치 또는 개별 target 판정을 적용한다.

### 5.5 keyboard 탐색

- 네트워크 항목 탐색 control을 제공한다.
- route 13개, port 57개, chokepoint 11개를 검색하고 이동할 수 있다.
- ArrowUp/ArrowDown, Home/End, Enter/Space, Escape를 지원한다.
- weather target도 관련 port·route·chokepoint 문맥에서 keyboard로 선택 가능해야 한다.
- 선택 뒤 해당 항목을 fit하고 동일한 detail panel을 연다.
- panel close 뒤 마지막 trigger로 focus를 되돌린다.

---

## 6. route 상태와 camera

### 6.1 route 질의 동기화

- 주소 질의의 `route` 값이 유효하면 그 route를 초기 navigation route로 사용한다.
- 유효하지 않으면 승인된 기본 route를 사용한다.
- navigation route 변경은 질의 값, shell, 지도 focus를 원자적으로 맞춘다.
- port, chokepoint, weather 탐색은 navigation route를 임의 변경하지 않는다.
- map selection과 navigation route는 별도 상태로 유지한다.
- 새 선택 또는 renderer 전환이 기존 유효 route 질의를 지우면 P1이다.

### 6.2 selection 전이

| action | 설정 | 해제 | 유지 |
|---|---|---|---|
| port 선택 | port와 관련 map route | choke, weather, overlap | focus mode, navigation route |
| route 선택 | map route | port, choke, weather, overlap | focus mode, navigation route |
| chokepoint 선택 | chokepoint | port, map route, weather, overlap | focus mode, navigation route |
| weather 선택 | weather | 없음 | 기반 선택 전체 |
| overlap 후보 선택 | map route | overlap, port, choke, weather | navigation route |
| weather 닫기 | 기반 선택 복원 | weather | navigation route |

한 번에 detail aside는 하나만 보인다. 표시 우선순위는 weather, port, overlap, route, chokepoint 순이다.

### 6.3 camera

- reset은 승인된 기본 globe view로 돌아가며 선택을 자동 해제하지 않는다.
- route fit은 전체 회랑을 사용하고 antimeridian의 가장 짧은 범위를 선택한다.
- chokepoint fit은 중심점 하나가 아니라 회랑과 gate 범위를 사용한다.
- port fit은 route 문맥을 남기고 panel에 표식이 가려지지 않게 한다.
- weather 전환은 같은 위치에서 불필요한 camera jump를 만들지 않는다.
- 열린 panel의 크기를 safe padding에 반영한다.
- reduced motion에서는 모든 camera duration을 0으로 한다.

desktop panel safe padding은 오른쪽에 최대 560px 또는 지도 너비의 43%를 사용한다. mobile은 좌우 12px, 아래쪽은 최대 360px 또는 지도 높이의 46%를 사용한다.

---

## 7. 표시 문구와 공통 UI

### 7.1 header와 controls

- 공통 shell 안에서 네트워크 화면임을 나타내는 제목과 현재 route 문맥을 제공한다.
- focus control, reset, 네트워크 항목 탐색, 범례를 지도 위에서 접근 가능하게 배치한다.
- renderer 상태는 비차단 status로 알린다.
- 기상 상태는 renderer 상태와 분리해 알린다.
- 임의의 디버그 문자열, 내부 오류 stack 또는 과도한 연결 경고를 화면에 노출하지 않는다.

### 7.2 범례

범례의 초기값은 닫힘이다. 다음 의미를 모두 제공한다.

1. 부산항.
2. 목적항 57개.
3. 대표 해상 회랑.
4. 동일 route 권역 연결.
5. 해협.
6. 운하.
7. 기상 상태.
8. traffic이 준비되면 AIS 7일 추정 통과량, 아니면 초크포인트 회랑 11개.

3D footer는 `드래그 회전 · 표식 클릭은 상세 정보`, 2D footer는 `드래그 이동 · 표식 클릭은 상세 정보`다. Escape로 닫고 trigger로 focus를 복귀한다.

### 7.3 공통 panel

- panel은 modal이 아닌 `aside` 의미다.
- 비동기 상세 로딩 중 `aria-busy`를 제공한다.
- close control은 시각적으로 X이며 44×44px 이상의 hit area와 명확한 accessible name을 가진다.
- Escape는 최상위 panel 하나만 닫는다.
- 본문이 길면 panel 내부만 scroll한다.
- 핵심 값은 chart와 별도로 text KPI와 accessible summary로 제공한다.
- desktop에서 오른쪽 22px, 아래 76px에 배치한다.
- radius 18px, padding 18px, 밝은 반투명 표면과 navy heading을 사용한다.

desktop 목표 너비는 route 310px, overlap 380px, weather 420px, chokepoint 500px, port 520px이다. 모든 너비는 viewport 내부로 clamp한다.

---

## 8. Route와 overlap panel

### 8.1 Route panel

- eyebrow는 route code다.
- title은 route 한국어 이름과 `노선`을 결합한다.
- `출발` 값은 `부산항`이다.
- `등록 목적항`은 해당 route의 실제 port 수다.
- `기본 해상 회랑`은 승인된 데이터의 전체 경유 문구를 줄임 없이 표시한다.
- 안내 문구: `노선은 항만 선택을 위한 권역 필터입니다. 물동량은 각 항만 포인트를 선택해 확인하세요.`
- close accessible name: `노선 정보 닫기`.

### 8.2 Overlap panel

- eyebrow: `OVERLAPPING ROUTES`.
- title: `겹친 노선 {N}개`.
- 도움말: `이 지점을 통과하는 노선입니다. 확인할 노선을 선택하세요.`
- 각 row는 code, route 이름, 목적항 수를 제공한다.
- row 최소 높이는 52px이며 keyboard 선택이 가능하다.
- 후보 선택 뒤 overlap을 닫고 route panel로 전환한다.
- close accessible name: `겹친 노선 목록 닫기`.

---

## 9. Port panel과 traffic

### 9.1 header와 상태

eyebrow는 route code, IMF PORTWATCH, 상태 label을 함께 표시한다.

| 상태 | 표시 label |
|---|---|
| LIVE | `DAILY SIGNAL` |
| PARTIAL | `일부 항만 연결` |
| STALE | `최근 정상값` |
| UNAVAILABLE 또는 loading | `연결 확인 중` |

- title은 항만 한국어 이름이다.
- subtitle은 국가와 route 이름이다.
- shared series일 때만 `LA/LB 공동 집계`를 표시한다.
- close accessible name은 `항만 물동량 정보 닫기`다.

### 9.2 KPI

다음 여섯 항목을 유지한다.

1. 최근 7일 추정 물동량.
2. 전주 대비.
3. 수입 추정.
4. 수출 추정.
5. 컨테이너선 입항.
6. 데이터 기준일.

- 실제 0은 dash나 unavailable로 바꾸지 않는다.
- null percent는 0%로 표시하지 않는다.
- 증가와 감소는 sign과 text를 함께 사용한다.
- 단위는 estimated metric tons이며 TEU라고 부르지 않는다.
- summary 오류가 나도 항만 identity, marker, route, weather action은 유지한다.
- retry는 traffic만 다시 요청하며 renderer를 재시작하지 않는다.

### 9.3 chart와 표시 문구

- chart eyebrow: `PORTWATCH · RECENT 90 DAYS`.
- chart title: `일별 추정 물동량 7일 이동합계`.
- unit: `AIS 추정 · t`.
- UI는 상세 범위 90일을 명시적으로 요청한다.
- client adapter는 누락된 `days`에 임의의 90을 덧붙이지 않는다.
- chart는 날짜 오름차순의 7일 이동합계를 사용한다.
- pointer tooltip과 별도로 latest/min/max accessible summary를 제공한다.
- 실제 0만 이어지는 경우 `최근 7일 PortWatch 활동 미포착 · 0은 데이터 없음이 아닌 유효한 관측값입니다.`를 표시한다.
- chart 전체가 실제 0이면 `API 연결 정상 / 최근 90일 PortWatch 활동 관측 0`을 표시한다.
- action 문구는 `항만 기상 보기`다.
- AIS 기반 추정치이며 공식 TEU가 아님을 명시한다.

---

## 10. Chokepoint panel과 traffic

- title은 chokepoint 한국어 이름이다.
- LIVE는 `LIVE`, STALE은 `최근 정상값`, UNAVAILABLE 또는 loading은 `연결 확인 중`으로 표시한다.
- STALE이면 원래 관측 기준 시각과 cached/fixture 성격을 숨기지 않는다.
- close accessible name은 `초크포인트 정보 닫기`다.
- 대표 통과 구간, 대표 경로 이용, 데이터 기준일, 연결 노선, 우회·서비스별 route를 표시한다.
- route는 사용자가 이해하는 한국어 이름과 승인된 순서를 유지한다.
- KPI는 최근 7일 추정 통과량, 전주 대비, 컨테이너선 통항이다.
- metric control은 `추정 물동량`과 `통항 척수`를 제공하고 keyboard roving을 지원한다.
- chart group은 `PORTWATCH TREND`와 `최근 7일 이동합계`를 표시한다.
- unavailable이어도 center, corridor, gate, 관련 route 강조는 유지한다.
- 0과 unavailable을 같은 값으로 보이지 않는다.
- 대표 회랑을 행정수역, 안전수역 또는 법적 통항 경계라고 부르지 않는다.
- AIS 기반 참고 지표임을 표시한다.

---

## 11. Weather panel과 marker

### 11.1 panel

- eyebrow는 `LIVE WEATHER`와 관측 시각을 표시한다.
- close accessible name은 `기상 정보 닫기`다.
- title, subtitle, condition label, risk label을 제공한다.
- metric은 기온, 강수, 풍속·돌풍, 가시거리 실측, 파고·주기, 해수면 온도다.
- null은 missing 표시를 사용하고 0으로 바꾸지 않는다.
- METAR station과 거리가 모두 있을 때만 가시거리 관측 정보를 보인다.
- risk reason이 있으면 문구로 함께 표시한다.
- footer는 `운항 승인용이 아닌 노선 위험 모니터링용 참고 실황입니다.`다.
- weather 실패는 port, route, chokepoint를 숨기거나 renderer를 전환하지 않는다.

### 11.2 glyph

| condition | glyph |
|---|---|
| clear | ☀ |
| night | ☾ |
| rain | ☔ |
| snow | ❄ |
| storm | ϟ |
| wind | ≋ |
| wave | ≈ |
| cloud, fog, unavailable | ☁ |

### 11.3 declutter

- warning, severe, 현재 선택, hover가 일반 항목보다 우선한다.
- primary 위치가 secondary 위치보다 우선한다.
- 같은 우선순위는 안정적인 ID 순서로 결정한다.
- zoom과 화면 거리에 따라 겹침을 줄이되 후보 registry 82개를 삭제하지 않는다.
- globe 뒤쪽 marker는 숨긴다.
- 정지 상태에서 표식이 흔들리거나 순서가 바뀌지 않는다.
- reduced motion에서는 marker animation을 중지한다.

---

## 12. Frozen gateway 소비 계약

### 12.1 단일 소비 경계

화면은 동결된 DataGateway의 method별 decoder를 통해서만 데이터를 받는다.

- port summary: 빈 query.
- port detail: `id`와 선택적 `days`만.
- chokepoint summary: 빈 query.
- chokepoint detail: `id`만.
- weather summary: 빈 query.

허용되지 않는 동작은 다음과 같다.

- 임의 JSON을 generic 결과로 단언하기.
- bare-root legacy payload를 정상 envelope로 변환하기.
- port detail에 암묵적 `days=90`을 합성하기.
- chokepoint detail에 추가 query를 넣기.
- extra field, 잘못된 state, 잘못된 meta 또는 잘못된 data를 허용하기.
- 한 도메인의 payload를 다른 도메인 결과로 승격하기.

### 12.2 독립 상태

port, chokepoint, weather 상태는 서로 독립이다.

- port: LIVE, PARTIAL, STALE, UNAVAILABLE.
- chokepoint: LIVE, STALE, UNAVAILABLE.
- weather: LIVE, PARTIAL, UNAVAILABLE.

한 도메인의 실패가 다른 도메인, renderer 또는 정적 카탈로그를 실패시켜서는 안 된다.

### 12.3 진실성

- `asOf`, `fetchedAt`, provider, attribution, cache 상태를 의미대로 유지한다.
- frozen fixture 또는 stale cache를 LIVE로 표시하지 않는다.
- missing, parse failure, non-finite 값은 null 또는 row rejection으로 처리한다.
- 실제 관측 0만 숫자 0으로 유지한다.
- null, 0, unavailable을 서로 구별한다.
- previous 값이 없거나 0 이하이면 변화율은 null이다.
- metric tons는 추정값임을 표시한다.
- UNAVAILABLE 응답은 저장 가능한 성공처럼 다루지 않는다.
- 선택이 바뀌면 이전 detail 요청을 중단하거나 늦은 응답을 무시한다.
- retry는 해당 도메인만 다시 요청한다.

---

## 13. 오류 분류와 renderer 상태

### 13.1 상태 흐름

```text
boot
  → globe_starting
      → globe_ready
      → static2d(webgl2_unsupported)
      → static2d(gpu_init_failed)

globe_ready
  → globe_ready(background_degraded)
  → globe_ready(data_degraded)
  → static2d(context_lost)

static2d
  → static2d(data_degraded)
  → explicit globe retry
```

### 13.2 2D 전환이 허용되는 경우

자동 2D 전환은 다음 실제 그래픽 실패에만 허용한다.

- WebGL2를 제공하지 않는 환경.
- MapLibre가 usable WebGL2 canvas를 만들지 못한 GPU 초기화 실패.
- 준비된 3D canvas의 context loss.

worker, tile, glyph, style의 일반 요청 오류와 port/chokepoint/weather API 오류는 WebGL2 미지원으로 분류하지 않는다. 가능한 globe와 정적 geometry를 유지하고 해당 부분만 degrade한다.

### 13.3 표시 문구

- WebGL2 미지원: `WebGL2 미지원 · 2D 지도 모드`.
- GPU 초기화 실패: `3D 가속 초기화 실패 · 2D 지도 모드`.
- context loss: `3D 그래픽 연결 끊김 · 2D 지도 모드`.
- background 지연: `배경 지도 연결 지연`.
- background 지연 설명: `네트워크 레이어는 계속 사용할 수 있습니다.`

오류 원인을 사용자 문구와 machine-readable reason으로 분리한다. 내부 예외 내용은 사용자 화면에 직접 표시하지 않는다.

### 13.4 recovery

- 2D 전환은 한 번만 일어나며 반복 mount loop를 만들지 않는다.
- 실패한 부분 객체와 등록된 listener를 안전하게 정리한다.
- 현재 route, port, chokepoint, weather, focus mode, panel data를 보존한다.
- API 요청을 취소하거나 다시 시작하지 않는다.
- 명시적 retry 중에도 2D 지도는 계속 사용할 수 있다.
- 늦은 3D callback이 현재 2D 상태를 덮지 않는다.

---

## 14. 대화형 2D fallback

### 14.1 완료 정의

2D fallback은 오류 카드가 아니라 실제 운영 가능한 지도다.

- 같은 13 route, 57 port, 44 connector, 11 chokepoint, 82 weather registry를 사용한다.
- 정적 Mercator 배경과 SVG/DOM geometry를 사용한다.
- pan, zoom, reset이 작동한다.
- route, port, chokepoint, weather pointer 선택이 작동한다.
- keyboard selection이 작동한다.
- overlap 선택과 focus mode가 3D와 같은 결과를 만든다.
- 같은 detail panel과 gateway data를 사용한다.
- antimeridian route가 화면 전체를 잘못 가로지르지 않는다.
- 배경 자산이 없어도 ocean, graticule, 모든 geometry와 상호작용을 유지한다.
- 정상 WebGL2 환경의 기본 renderer로 선택되지 않는다.

### 14.2 상태 보존

3D에서 2D로 전환할 때 다음을 보존한다.

- navigation route와 map route.
- 선택 port 또는 chokepoint.
- 열려 있는 weather와 기반 선택.
- focus mode와 범례 상태.
- traffic/weather 응답.
- 가능한 범위의 camera 중심과 zoom 문맥.

### 14.3 pointer 결정성

- port마다 독립된 accessible target과 pointer hit target을 가진다.
- 겹치는 표식은 시각 위치를 안정적으로 조정할 수 있으나 실제 좌표 의미는 유지한다.
- pointer click과 Enter가 서로 다른 panel을 열면 P1이다.
- LA와 Long Beach 각각 pointer click과 Enter에서 자신의 ID와 이름을 연다.

---

## 15. 반응형 계약

### 15.1 공통

- 높이는 `100dvh`, 최소 높이는 620px다.
- page 자체의 가로 scroll은 0이다.
- renderer는 header 아래 남는 영역을 채운다.
- detail panel만 내부 세로 scroll을 가질 수 있다.
- 공통 shell overlay가 열려도 selection과 renderer 상태를 유지한다.
- browser zoom 200%에서 핵심 controls와 close action에 접근 가능해야 한다.

### 15.2 1440×900 주 기준

- compact rail은 68px다.
- header 높이는 60px다.
- renderer는 rail 오른쪽, header 아래 전체 영역을 채운다.
- actions는 위쪽 오른편, 범례는 아래쪽 왼편, detail panel은 아래쪽 오른편에 둔다.
- MapLibre navigation과 scale control이 panel 또는 범례에 완전히 가리지 않는다.
- 선택 대상은 safe padding 안에서 보인다.
- port 520px, chokepoint 500px, weather 420px, route 310px, overlap 380px 목표 너비를 유지한다.

### 15.3 900 폭 smoke

- shell navigation은 overlay 형태다.
- renderer는 전체 폭을 사용한다.
- menu open 시 의도한 영역만 pointer를 차단한다.
- menu close 뒤 resize, selection, camera를 유지한다.
- controls와 panel이 겹치지 않는다.

### 15.4 640 폭 smoke

- header 높이는 60px다.
- actions는 좌우 12px 범위 안에 둔다.
- detail panel은 좌우 18px 안쪽에 clamp하고 `box-sizing: border-box`를 적용한다.
- panel 최대 높이는 61vh 또는 520px 중 작은 값이다.
- chart와 KPI가 가로 overflow를 만들지 않는다.
- close target과 reset은 viewport 안에 남는다.
- 선택 marker는 panel 위의 남은 지도 영역에서 보인다.

### 15.5 375×812 주 기준

- 좁은 폭에서 header의 보조 text는 숨길 수 있으나 menu와 핵심 controls는 유지한다.
- focus option을 제거하지 않는다.
- detail panel은 실제 client viewport 기준 좌우 18px 안쪽에 둔다.
- panel 너비는 client viewport에서 36px을 뺀 값 이하이고 `box-sizing: border-box`다.
- panel heading과 본문 왼쪽이 잘리지 않는다.
- 최대 높이는 61vh 또는 520px 중 작은 값이다.
- port KPI 여섯 개를 모두 볼 수 있다.
- weather metric은 두 열 또는 한 열로 재배치할 수 있다.
- overlap row의 이름과 후보 수를 읽을 수 있다.
- 범례, close, reset, pan controls가 서로 가리지 않는다.
- 2D fallback의 실제 지도와 선택 흐름을 반드시 검증한다.

---

## 16. 접근성과 motion

- 지도 영역에 명확한 accessible name을 제공한다.
- status announcement는 중복 없이 한 번 전달한다.
- 의미 있는 모든 pointer action은 keyboard 경로를 가진다.
- focus indicator는 밝은 표면과 어두운 지도 모두에서 보인다.
- close, reset, mode, zoom, panel action은 44×44px 이상의 hit area를 가진다.
- 색만으로 route, selection, risk 또는 증감 상태를 전달하지 않는다.
- chart는 최신값, 최소값, 최대값과 단위를 text로 제공한다.
- decorative effects는 accessibility tree에서 제외한다.
- reduced motion에서는 camera animation, marker animation, panel transition, renderer crossfade를 중지한다.
- selection과 위험 상태의 시각 구분은 reduced motion에서도 유지한다.

---

## 17. lifecycle과 성능

- shell은 renderer 준비를 기다리지 않고 즉시 보인다.
- 정적 카탈로그는 원격 traffic/weather를 기다리지 않는다.
- 첫 usable network는 원격 데이터 응답 전에 선택 가능해야 한다.
- style 준비 promotion, controls 설치, data 설치는 각각 한 번만 실행한다.
- style 재적용은 idempotent해야 한다.
- marker declutter와 resize는 animation frame 단위로 제한한다.
- 동일 ID hover를 반복 갱신하지 않는다.
- 선택 detail만 요청하고 이전 detail 요청은 정리한다.
- navigation 왕복 뒤 listener, canvas, marker, worker가 중복되지 않는다.
- renderer 전환 뒤 orphan resource가 남지 않는다.
- context 실패 환경에서 2D는 가능한 즉시 시작하며 blank host를 거치지 않는다.

---

## 18. 금지 사항

### 18.1 기능 축약 금지

- route를 13개 미만으로 줄이지 않는다.
- port를 57개 미만으로 줄이지 않는다.
- LA와 Long Beach를 하나의 marker로 합치지 않는다.
- PortWatch series를 57개라고 표시하지 않는다.
- 11개 chokepoint의 corridor 또는 gate를 생략하지 않는다.
- weather registry를 82개 미만으로 줄이지 않는다.
- overlap panel을 첫 route 자동 선택으로 대체하지 않는다.
- focus mode 세 가지를 하나의 toggle로 줄이지 않는다.
- traffic chart를 KPI 하나로 대체하지 않는다.
- 2D fallback을 오류 카드로 대체하지 않는다.

### 18.2 의미 변경 금지

- estimated metric tons를 TEU라고 부르지 않는다.
- 대표 회랑을 실제 AIS track 또는 선사 schedule이라고 부르지 않는다.
- 정적 카탈로그를 LIVE API 성공이라고 표시하지 않는다.
- 실제 0을 unavailable로 표시하지 않는다.
- unavailable을 숫자 0으로 표시하지 않는다.
- tile 또는 API 실패를 WebGL2 실패라고 표시하지 않는다.
- GPU 실패를 네트워크 연결 실패라고 표시하지 않는다.
- weather를 운항 승인 정보라고 표시하지 않는다.

### 18.3 시각 축약 금지

- globe를 일반 content card 안의 작은 지도로 바꾸지 않는다.
- detail panel을 중앙 modal로 바꾸지 않는다.
- 밝은 overlay를 임의의 어두운 generic panel로 바꾸지 않는다.
- route와 chokepoint 계층을 단순 그리기 순서로 뒤집지 않는다.
- 모든 weather marker를 강제로 표시해 읽을 수 없게 만들지 않는다.
- mobile에서 focus controls를 숨기지 않는다.

---

## 19. 검증 계약

### 19.1 정적 검증

- WT6가 승인 입력 `01/09/12`로 결정론적으로 생성한 현재 seam bytes, manifest bytes와 identity를 변경 없이 소비한다.
- 실제 seam raw bytes의 SHA-256을 재계산해 수신 `identity.catalogSeamSha256`과 비교한다.
- `actual raw catalog byte length == received NetworkCatalogSeamIdentityV1.byteSize == same handoff producer/provenance metadata.byteSize`를 검증하고, 구조 counts를 수신 identity counts와 비교한다.
- 같은 handoff의 승인 manifest exact bytes SHA-256을 재계산해 수신 seam의 `referenceManifestSha256`과 비교한다.
- 현재 handoff bytes에서 계산한 값 이외의 별도 digest를 검증 입력으로 사용하지 않는지 확인한다.
- `07/08/16/17` enrichment가 canonical ID, 좌표, 수량, identity를 바꾸지 않는지 검증한다.
- 카탈로그 구조, 관계, 정렬, 좌표 범위, 수량을 검증한다.
- gateway decoder가 extra field, 잘못된 meta/state/data를 거부하는지 검증한다.
- bare-root legacy payload를 거부하는지 검증한다.
- port detail의 선택적 days와 chokepoint detail의 id-only 규칙을 검증한다.
- 부분 Map 객체에서 control과 data 설치가 0회인지 검증한다.
- 이미 준비된 style과 이중 ready 호출에서 promotion이 1회인지 검증한다.
- 일반 tile/style 오류가 2D 전환을 만들지 않는지 검증한다.
- valid map에서 globe projection, controls, data promotion이 각 1회인지 검증한다.
- LA와 Long Beach의 pointer/keyboard 선택 결정성을 검증한다.

### 19.2 실제 WebGL2 브라우저

실제 Chrome 또는 Edge의 WebGL2 지원 환경에서 cold load를 검증한다.

필수 증거:

- WebGL2 context가 non-null이다.
- MapLibre canvas가 존재하고 유지된다.
- projection이 `globe`다.
- `globe_ready`와 최종 load 상태가 확인된다.
- same-origin worker와 style이 정상 응답한다.
- 13 route, 57 port, 11 chokepoint, 82 weather registry가 연결된다.
- route, port, chokepoint, weather 선택이 작동한다.
- fatal console error와 unhandled rejection이 0이다.
- 1440×900과 375×812에서 확인한다.

software-only 또는 WebGL2가 비활성인 환경은 3D 성공 증거로 인정하지 않는다.

### 19.3 실제 fallback 브라우저

WebGL2 미지원과 context loss를 각각 강제로 검증한다.

필수 증거:

- MapLibre canvas가 정상 renderer로 남지 않는다.
- 대화형 2D 지도가 보인다.
- route 13, port 57, chokepoint 11, weather 82 target이 존재한다.
- pan이 viewport를 바꾸고 reset이 초기 viewport를 복원한다.
- route, port, chokepoint, weather pointer와 keyboard 선택이 작동한다.
- panel과 질의 route가 전환 전 상태를 유지한다.
- 오류 카드만 있는 화면이 아니다.
- 1440×900, 375×812, 900 폭, 640 폭에서 document overflow와 fatal overlay가 0이다.

### 19.4 데이터 장애 분리

아래 장애를 각각 독립적으로 주입한다.

- port unavailable, choke 정상, weather 정상.
- choke unavailable, port 정상, weather 정상.
- weather unavailable, port 정상, choke 정상.
- background tile 지연.
- 잘못된 gateway envelope.
- 카탈로그 관계 불일치.

각 경우 정적 geometry와 관련 없는 도메인은 계속 작동해야 한다.

### 19.5 주요 사용자 시나리오

1. 유효 route 질의로 cold load 후 올바른 route가 선택된다.
2. 겹친 route 지점에서 overlap 후보를 고른다.
3. KUWI 문맥에서 LA와 Long Beach를 각각 pointer와 Enter로 선택한다.
4. port panel에서 weather를 열고 닫아 같은 port panel로 돌아온다.
5. Suez chokepoint를 선택하고 관련 route와 두 traffic metric을 확인한다.
6. focus mode 세 가지를 pointer와 keyboard로 전환한다.
7. 실제 0 traffic과 unavailable을 서로 다른 화면 상태로 확인한다.
8. 3D context loss 뒤 같은 선택이 2D에 남는다.
9. mobile에서 모든 panel heading, 본문, close control이 viewport 안에 있다.

---

## 20. Renderer 세부 계약 보강

### 20.1 기본 view와 Map 설정

- 초기 center는 `[126.2, 27.5]`다.
- 초기 zoom은 `1.42`다.
- 초기 bearing은 `-7`도다.
- 초기 pitch는 `0`도다.
- projection은 style 준비 뒤 반드시 `globe`다.
- world wrap, antimeridian, 좌표 정규화는 공식 MapLibre 동작을 따른다.
- scroll zoom, drag rotate, touch zoom/rotate, keyboard navigation을 제공한다.
- 사용자 입력으로 pitch가 바뀌더라도 reset은 pitch 0으로 돌아간다.
- resize는 실제 host 크기를 기준으로 하고 shell overlay animation에 의한 resize storm을 만들지 않는다.
- 같은 host에 canvas를 둘 이상 유지하지 않는다.

### 20.2 준비 단계와 오류 경계

준비 단계는 다음 순서를 가진다.

| 단계 | 성공 조건 | 실패 처리 |
|---|---|---|
| host | 유효한 크기와 DOM 연결 | shell은 유지하고 재측정 |
| Map 생성 | 후보 객체와 canvas 접근 가능 | 실제 GPU 실패면 2D |
| context | canvas WebGL2 context non-null | 후보 폐기 후 2D |
| style | 최소 style의 `style.load` | 해당 오류 진단, 정상 context를 미지원으로 오판 금지 |
| globe | `getProjection().type === "globe"` | projection 재적용 후 다시 확인 |
| promotion | controls와 업무 레이어 설치 1회 | 중복 호출 무시 |
| ready | canvas 유지, 상호작용 가능 | `globe_ready` 알림 |

- 준비 latch는 비동기 작업 전에 잠근다.
- 이미 준비된 style과 `style.load` event가 함께 도착해도 promotion은 한 번이다.
- 준비 전에는 `mapRef`, controls, data-dependent listener를 외부 상태에 공개하지 않는다.
- 부분 객체 cleanup 중 발생하는 부가 예외는 원래 GPU 오류를 가리지 않는다.
- 최소 style 준비 시간은 target browser에서 8초 이내를 기본 예산으로 삼는다.
- 원격 배경의 지연을 최소 style timeout으로 오인하지 않는다.
- `load`와 `idle`은 projection 유지 확인에 사용하되 업무 레이어 promotion의 중복 trigger가 아니다.

### 20.3 대기와 장식 효과

- 대기 halo와 우주 배경은 globe 형상을 읽게 해야 한다.
- 별은 360개, meteor slot은 4개를 고정 seed로 생성한다.
- 장식 효과는 decorative WebGL effects layer로 구현한다.
- 별과 meteor는 hit 대상이 아니며 accessibility tree에 나타나지 않는다.
- 장식 layer 설치 실패는 globe, route, marker를 실패시키지 않는다.
- reduced motion에서는 meteor 이동과 깜박임을 중지한다.

### 20.4 controls

- navigation control은 promotion 뒤 한 번 추가한다.
- scale control은 다른 overlay와 겹치지 않게 왼쪽 아래에 둔다.
- reset은 공통 action 영역에 둔다.
- focus mode, 범례, 네트워크 항목 탐색은 renderer와 독립된 DOM control이다.
- control이 준비 전에 Map transform을 읽지 않는다.
- 3D cleanup 뒤 control callback이 남아 state를 바꾸지 않는다.

### 20.5 배경과 업무 레이어의 분리

- 배경 지도 실패와 업무 geometry 실패를 분리한다.
- 배경이 지연돼도 globe, atmosphere, route, connector, port, chokepoint, weather는 남는다.
- 업무 geometry는 검증된 카탈로그를 사용하며 원격 tile 완료를 기다리지 않는다.
- glyph 또는 아이콘 decode 실패 시 의미가 유지되는 vector/DOM 대체 표현을 사용한다.
- 배경 오류를 전체 연결 실패 문구로 승격하지 않는다.

---

## 21. 카탈로그·geometry 세부 계약 보강

### 21.1 route identity

정확한 route code 집합은 다음 13개다.

`KAUI`, `KCI`, `KJI`, `KLEI`, `KLWI`, `KMDI`, `KMEI`, `KNEI`, `KSAI`, `KSEI`, `KUEI`, `KUWI`, `KWAI`.

- 이 집합 밖의 code를 route로 승격하지 않는다.
- route ID, primary port, waypoint는 WT6 canonical seam 값을 그대로 사용한다.
- route 표시 이름과 경유 문구는 동결 route 계약 또는 허용된 enrichment를 canonical route ID로 join한다.
- route별 waypoint 순서는 항해 순서이며 ID 정렬로 바꾸지 않는다.
- 각 route의 geometry는 하나 이상의 유효한 segment를 가져야 한다.
- 부산 anchor에서 목적 권역까지 의미가 끊기지 않아야 한다.
- 같은 해역을 공유하는 route를 좌표가 가깝다는 이유로 하나로 합치지 않는다.
- route는 대표 해상 회랑이며 실시간 선박 궤적이 아니다.

### 21.2 antimeridian과 topology

- 연속 waypoint 경도 차이가 180도를 넘으면 antimeridian에서 segment를 나눈다.
- split 전후의 route ID와 선택 의미는 같다.
- 3D에서는 가장 짧은 globe arc를 사용한다.
- 2D에서는 필요한 world segment만 복제해 화면 전체를 가로지르는 잘못된 선을 만들지 않는다.
- route hit 결과는 여러 segment에서 같은 ID가 나와도 한 후보로 합친다.
- selected route 강조는 모든 segment에 동시에 적용한다.

### 21.3 port

각 port 항목은 다음 의미를 가진다.

- 안정적 marker ID.
- 소속 route code.
- longitude와 latitude.
- upstream PortWatch ID.
- primary 여부.
- 표시 이름, 국가, route 문맥.

각 route는 primary marker 하나와 0개 이상의 secondary marker를 가진다. secondary marker마다 같은 route의 primary 문맥과 연결되는 connector가 하나 있다. 전체 connector는 44개다.

- port hit target은 보이는 점보다 넓고 최소 반경 13px 의미를 가진다.
- 가까운 marker의 hit 영역은 서로의 ID를 가로채지 않는다.
- 선택 port는 route focus와 무관하게 항상 식별 가능하다.
- shared series 표식은 marker identity와 traffic series identity를 별도로 보존한다.

### 21.4 chokepoint

정확한 chokepoint ID 집합은 다음 11개다.

`bab-el-mandeb`, `cape-good-hope`, `dover-strait`, `gibraltar-strait`, `hormuz-strait`, `korea-strait`, `luzon-strait`, `malacca-strait`, `panama-canal`, `suez-canal`, `taiwan-strait`.

각 항목은 다음을 가진다.

- center 좌표.
- kind와 한국어 표시 이름.
- 대표 통과 범위 문구.
- upstream PortWatch ID.
- 관련 기본 route와 대체 route.
- 대표 corridor 폭과 방향.
- 양끝 gate.

- corridor pointer hit 폭은 최소 32px 의미를 가진다.
- center, corridor, gate는 하나의 selection identity를 공유한다.
- 관련 route 순서는 전역 route 순서를 유지한다.
- traffic이 없어도 center, corridor, gate와 관련 route는 보인다.

### 21.5 weather identity

- 부산 weather ID는 고유하며 port registry와 충돌하지 않는다.
- port weather는 port ID를 참조한다.
- chokepoint weather는 chokepoint ID를 참조한다.
- route weather는 승인된 route 대표 위치를 참조한다.
- route 대표 weather 위치는 WT6 canonical seam에 포함된 좌표를 그대로 사용한다.
- marker 위치와 panel identity가 어긋나지 않는다.
- 82개 registry는 항상 유지하고 declutter는 현재 화면의 표시 집합만 줄인다.

### 21.6 weather declutter 경계

- zoom `2.15` 미만에서는 normal secondary weather를 숨길 수 있다.
- zoom `2.15` 이상에서는 거리 조건을 만족하는 normal secondary weather를 표시한다.
- warning, severe, selected, hover 항목은 이 zoom 경계보다 우선한다.
- primary와 chokepoint 항목은 normal secondary보다 우선한다.
- 같은 화면 cell에서는 위험도, 선택, 종류, ID 순으로 안정적으로 결정한다.
- globe 회전 중 뒤쪽 항목은 투영 가능 여부와 globe-facing 판정으로 숨긴다.
- 경계 `2.14`와 `2.15`에서 불안정한 왕복 flicker가 없어야 한다.

---

## 22. 상호작용·panel 세부 계약 보강

### 22.1 hit dispatcher

pointer dispatcher는 한 번의 query 결과를 모아 한 action만 만든다.

- weather DOM target을 가장 먼저 확인한다.
- port DOM target과 port hit geometry를 다음으로 확인한다.
- chokepoint hit geometry를 다음으로 확인한다.
- 마지막으로 모든 route hit geometry를 확인한다.
- 후보 거리, 명시적 target, visual z-order를 함께 사용한다.
- event bubbling 순서만으로 선택 결과를 결정하지 않는다.
- selection action 뒤 같은 pointer event가 다른 항목을 열지 않는다.

### 22.2 hover

- port hover는 항만 이름과 route 문맥을 표시한다.
- chokepoint hover는 이름과 kind를 표시한다.
- port 또는 chokepoint hover가 시작되면 route hover를 약화한다.
- selected 항목은 hover 종료로 약해지지 않는다.
- pointer leave는 해당 hover만 해제한다.
- 2D에서도 native title 하나로 축약하지 않고 같은 정보 의미를 제공한다.

### 22.3 panel priority와 복원

표시 priority는 다음과 같다.

1. weather.
2. port.
3. overlap.
4. route.
5. chokepoint.
6. none.

- weather를 port에서 열면 weather close 뒤 같은 port panel을 복원한다.
- weather를 route 또는 chokepoint에서 열면 각각의 기반 선택을 복원한다.
- impossible state는 deterministic priority를 적용하고 진단 상태로 남긴다.
- panel close가 navigation route를 바꾸지 않는다.

### 22.4 Port panel 추가 규칙

- loading 문구는 `57개 항만의 최신 물동량을 연결하고 있습니다.`다.
- 선택 port summary 실패 문구는 `이 항만의 물동량 요약을 불러오지 못했습니다.`다.
- recent total과 vessel calls가 모두 0일 때만 valid-zero 안내를 보인다.
- chart tooltip은 pointer move 중에만 보이고 pointer leave에서 지운다.
- detail 응답이 현재 selected port와 일치할 때만 반영한다.
- portWatchId와 관측 기준일을 사용자가 확인할 수 있다.
- shared series일 때 공동 집계 의미를 숨기지 않는다.
- chart가 없어도 여섯 KPI, identity, retry, weather action을 유지한다.

### 22.5 Chokepoint panel 추가 규칙

- `대표 통과 구간`, `대표 경로 이용`, `통항 데이터 기준일`, `연결 노선`, `우회·서비스별` row를 제공한다.
- traffic line은 추정 통과량과 통항 척수를 독립적으로 전환한다.
- chart detail은 최근 120개 rolling point 의미를 보존한다.
- tooltip은 pointer move와 leave에 맞춰 보이고 숨긴다.
- unavailable 상태에서도 설명, route 관계, geometry는 남는다.
- base 설명은 발광 띠가 대표 통과 회랑이고 양끝 점선이 입·출구 gate임을 알린다.

### 22.6 Weather panel 추가 규칙

- visibility는 관측값과 station ID가 모두 있을 때만 보인다.
- station 정보에는 항만과의 거리와 관측 시각을 표시한다.
- wind direction, wave direction, ocean current speed, ocean current direction은 payload에 있어도 새 KPI로 추가하지 않는다.
- severe는 red 계열, warning은 amber 계열, normal은 cyan/green 계열을 사용한다.
- 색과 함께 risk label과 reason을 표시한다.
- 관측값이 없으면 weather 전용 notice를 보이고 기반 panel로 돌아갈 수 있다.

### 22.7 범례 geometry

- desktop trigger는 아래 24px, 왼쪽 88px 문맥에 둔다.
- open panel은 trigger 위에 놓고 두 열을 기본으로 한다.
- 폭은 430px 이하이며 viewport를 넘지 않는다.
- 900 이하에서는 왼쪽 16px, 640 이하에서는 왼쪽 12px와 한 열을 사용한다.
- 375 주 기준에서는 왼쪽 8px 안쪽에 둔다.
- open 상태에서도 범례 밖 지도 pointer가 살아 있다.
- trigger의 시각 높이와 별개로 hit area는 44px 이상이다.

---

## 23. Traffic·weather 상태 세부 계약 보강

### 23.1 Port summary와 detail

- summary의 keys는 marker ID다.
- marker count는 57, unique series count는 56이다.
- detail의 port ID도 marker ID다.
- summary와 detail cache 및 loading은 독립적이다.
- recent window는 관측 기준일 포함 7일이다.
- previous window는 그 직전 7일이다.
- previous 관측이 없거나 denominator가 0 이하면 변화율은 null이다.
- detail은 UI가 요청한 90일 범위를 반환하고 날짜 오름차순이다.
- 7일 rolling 계산에 필요한 warm-up은 gateway 책임이며 UI가 raw row를 계산하지 않는다.
- PARTIAL은 일부 series만 사용할 수 있을 때다.
- STALE은 허용된 최신 기준보다 오래된 검증 데이터다.
- stale와 partial 조건이 함께면 STALE 표시가 우선한다.

### 23.2 Chokepoint summary와 detail

- summary keys는 chokepoint ID다.
- 최근 7일과 이전 7일의 vessel count와 estimated transit tons를 제공한다.
- 각 series의 관측 기준 시각을 보존한다.
- detail은 7일 rolling point의 날짜 오름차순을 제공한다.
- PARTIAL을 chokepoint v1 state에 임의 추가하지 않는다.
- cached 또는 fixture 결과는 원래 asOf와 STALE 의미를 유지한다.

### 23.3 Weather aggregation

- registry key는 82개이며 응답 observations도 계약상 같은 key 공간을 사용한다.
- MET Norway Locationforecast, Open-Meteo Marine, AviationWeather METAR의 역할을 혼합하지 않는다.
- weather와 marine 관측 시각을 각각 보존한다.
- METAR는 거리와 시간 조건을 만족하는 port visibility에만 사용한다.
- provider 일부 실패는 PARTIAL이며 성공한 관측을 유지한다.
- 전체 관측을 사용할 수 없을 때만 UNAVAILABLE이다.
- visibility, gust, wave가 missing이면 null이며 숫자 0을 만들지 않는다.

### 23.4 condition과 risk

- storm과 snow는 일반 rain보다 우선한다.
- 낮은 visibility는 fog 의미를 가진다.
- 높은 wave와 gust는 clear code보다 운항 위험 표시에서 우선한다.
- warning 경계는 강수 7.5mm 이상, visibility 5km 미만, gust 28kn 이상, wave 3m 이상을 포함한다.
- severe 경계는 visibility 1km 미만, gust 40kn 이상, wave 5m 이상을 포함한다.
- 여러 reason이 있으면 모두 표시하며 하나만 남기지 않는다.
- condition과 risk는 별도 값이며 같은 label로 합치지 않는다.

### 23.5 cache와 재시도 의미

- LIVE cache와 STALE cache를 같은 상태로 표시하지 않는다.
- UNAVAILABLE은 성공 payload처럼 장기 보존하지 않는다.
- retry는 선택 항목과 현재 renderer를 유지한다.
- renderer remount가 gateway summary를 중복 요청하지 않는다.
- 늦은 detail 응답이 새 선택을 덮지 않는다.

---

## 24. 2D viewport·geometry 세부 계약 보강

### 24.1 투영과 world 처리

- longitude와 latitude는 Web Mercator로 변환한다.
- Mercator latitude는 극점 발산을 막는 안전 범위로 제한한다.
- antimeridian split은 3D route와 같은 topology를 보존한다.
- port, chokepoint, weather는 동일한 viewport transform을 사용한다.
- zoom은 pointer 또는 control 중심을 기준으로 안정적으로 적용한다.
- pan은 pointer capture를 사용하고 선택 click과 구별되는 이동 임계값을 둔다.

### 24.2 초기 viewport와 reset

- 기본 viewBox는 `0 18 1000 464`다.
- pan 뒤 viewBox가 실제로 바뀌어야 한다.
- reset 뒤 정확히 기본 viewBox로 돌아온다.
- fit은 현재 panel safe padding을 고려한다.
- renderer 전환 뒤 가능한 범위에서 3D center와 zoom 문맥을 이어받는다.

### 24.3 2D 그리기 순서

1. ocean과 background.
2. graticule.
3. chokepoint corridor와 halo.
4. route와 connector.
5. chokepoint center와 gate.
6. port.
7. weather.
8. hover와 selection.

- 3D focus opacity와 selection override 의미를 유지한다.
- 배경 decode 실패 시 ocean과 graticule을 유지한다.
- SVG 또는 DOM layer가 pointer target과 accessible target을 분리해 중복 event를 만들지 않는다.
- mode badge는 작고 비차단이어야 하며 오류 카드처럼 지도 영역을 대체하지 않는다.

### 24.4 2D controls

- pan, zoom in, zoom out, reset을 제공한다.
- focus mode와 범례는 3D와 같은 DOM controls를 재사용한다.
- keyboard explorer selection은 해당 geometry를 fit한다.
- 선택 panel은 3D와 같은 component와 상태를 사용한다.
- pointer drag 뒤 의도하지 않은 marker click이 발생하지 않는다.

---

## 25. 반응형·시각 세부 계약 보강

### 25.1 desktop geometry

1440×900에서 다음 배치를 유지한다.

- compact rail 너비 68px.
- header: left 68px, top 0, right 0, height 60px.
- renderer: top 60px, left 68px, right 0, bottom 0.
- actions: top 8px, right 20px.
- weather status: top 122px, right 20px.
- legend: bottom 24px, left 88px.
- detail panel: right 22px, bottom 76px.

열린 panel과 controls가 MapLibre navigation, scale, legend를 완전히 덮지 않는다.

### 25.2 900×900

- rail 확장은 renderer 폭을 밀지 않고 overlay로 동작한다.
- renderer와 header는 left 0, width 100%다.
- actions 최대 폭은 viewport에서 좌우 16px을 뺀 값이다.
- legend는 왼쪽 16px 안쪽이다.
- menu close 뒤 canvas 크기와 2D viewport를 재확인한다.
- panel은 desktop 목표 너비를 사용하되 viewport 내부로 clamp한다.

### 25.3 640×900

- header padding은 8px 12px이다.
- actions는 top 8px, right 12px이다.
- weather status는 top 118px, right 12px이다.
- legend는 bottom 14px, left 12px이다.
- detail panel은 bottom 58px, 좌우 18px 안쪽이다.
- panel 최대 높이는 `min(61vh, 520px)`다.
- panel 내부 chart와 긴 metadata가 가로 scroll을 만들지 않는다.

### 25.4 375×812과 landscape

- 실제 client width를 기준으로 panel 좌우가 각각 18px 이상 남는다.
- nominal viewport와 client viewport 차이를 고정 숫자로 가정하지 않는다.
- heading, eyebrow, close, 첫 KPI column이 왼쪽에서 잘리지 않는다.
- actions는 top 8px, right 8px이며 viewport에서 좌우 8px을 뺀 폭 안에 있다.
- legend는 left 8px이다.
- panel bottom은 58px 문맥을 유지한다.
- 812×375 landscape에서도 close, reset, focus mode, 선택 target에 접근할 수 있다.
- 세로 공간이 부족하면 panel 내부 scroll을 사용하고 page scroll은 만들지 않는다.

### 25.5 overlay 시각값

- panel 표면은 `rgba(241, 242, 249, .96)` 계열이다.
- panel border는 `rgba(63, 161, 235, .22)` 계열이다.
- panel shadow는 `0 18px 44px rgba(0, 18, 144, .22)` 의미를 유지한다.
- backdrop blur는 16px 문맥이다.
- heading은 navy, eyebrow는 panel semantic color다.
- definition tile은 밝은 inset surface다.
- focus ring은 배경과 최소 두 단계 이상 구별되고 잘리지 않는다.

---

## 26. 상태·수명·수화·검증 시나리오 보강

### 26.1 상태 분리

다음 상태를 하나의 `loading/error` 값으로 합치지 않는다.

- renderer mode와 renderer readiness.
- WebGL2/GPU/context 상태.
- background 상태.
- port summary와 port detail.
- chokepoint summary와 chokepoint detail.
- weather summary.
- navigation route와 map route.
- route, port, chokepoint, overlap, weather selection.
- focus mode와 legend open.

### 26.2 hydration

- server markup은 deterministic shell과 준비 상태만 제공한다.
- WebGL2와 renderer mode는 client mount 뒤 결정한다.
- 중첩 document root를 렌더링하지 않는다.
- random decorative DOM을 server와 client에서 다르게 만들지 않는다.
- 첫 render에서 브라우저 전용 값으로 text를 바꾸지 않는다.
- 모든 viewport에서 document root는 하나이고 hydration overlay가 없어야 한다.

### 26.3 persistence

- map selection, camera, legend open을 영구 저장하지 않는다.
- renderer mode는 실제 capability 결과이며 영구 사용자 선호로 강제하지 않는다.
- navigation route 질의만 공통 route 계약에 따라 유지한다.
- renderer 전환과 page 왕복이 유효 route 질의를 지우지 않는다.

### 26.4 cleanup

- page 왕복 10회 뒤 listener 수가 증가하지 않는다.
- MapLibre canvas가 중복되지 않는다.
- worker가 orphan으로 남지 않는다.
- 2D marker와 accessible target이 중복되지 않는다.
- summary 요청이 remount loop에 빠지지 않는다.
- renderer 전환 5회에서 selection과 panel 상태가 안정적이다.

### 26.5 필수 시나리오 행렬

| 시나리오 | 필수 결과 |
|---|---|
| WebGL2 cold load | 실제 canvas, globe projection, worker/style 정상, fatal 0 |
| KNEI route | route panel, 부산 출발, 승인된 목적항 수와 경유 문구 |
| 겹친 route | 중복 없는 후보, 임의 첫 선택 없음 |
| KUWI LA/LB | marker 두 개, shared series, pointer/Enter 각각 정확한 panel |
| valid zero port | 여섯 KPI, zero 문구, unavailable 오판 없음 |
| port→weather→port | weather priority, close 뒤 같은 port 복원 |
| Suez | corridor/gate/center, 관련 route, 두 metric |
| focus mode | 세 mode와 keyboard roving, selected override |
| zoom 2.14/2.15 | declutter 경계 안정, 위험/선택 우선 |
| WebGL2 미지원 | usable 2D, 13/57/11/82, 오류 카드만 표시 금지 |
| background 실패 | 3D 유지, 업무 geometry와 panel 사용 가능 |
| API 단일 실패 | 해당 panel만 degrade, 다른 도메인과 renderer 유지 |
| context loss | 같은 선택과 data를 보존한 2D 전환 |
| keyboard only | route/port/choke 탐색, focus 복귀, Escape ownership |
| 375 fallback | 지도 보임, panel clamp, overflow 0, controls 접근 가능 |

### 26.6 증거 최소 집합

- 실제 WebGL2 GPU가 활성인 Chrome 또는 Edge cold load.
- 1440×900과 375×812의 globe canvas, projection, readiness, interaction.
- 900×900과 640×900의 반응형 smoke.
- 강제 WebGL2 미지원과 context loss의 2D interaction.
- route, port, chokepoint, weather, overlap, focus, pan/reset recording.
- panel DOMRect가 client viewport 내부라는 수치.
- route 13, port 57, chokepoint 11, weather 82 accessible target 수.
- console fatal, unhandled rejection, hydration error가 모두 0이라는 기록.
- type, lint, build, catalog/gateway/renderer 검증 결과.

---

## 27. 종료 판정

다음 항목이 모두 `VERIFIED`여야 한다.

### 27.1 카탈로그

- route 13, primary port 13, secondary port 44.
- port marker 57, 고유 PortWatch series 56.
- connector 44, chokepoint 11, weather location 82.
- ID, 정렬, 좌표, 관계, 수량 검증 통과.
- LA와 Long Beach의 별도 marker와 공유 series 의미 유지.

### 27.2 3D renderer

- WebGL2 지원 브라우저에서 MapLibre가 첫 renderer다.
- 실제 WebGL2 canvas가 존재한다.
- projection이 `globe`다.
- worker와 style이 정상 응답한다.
- 부분 Map 객체에서 조기 control/data 설치가 없다.
- 준비 promotion은 한 번만 실행된다.
- 일반 tile/style/data 오류가 정상 globe를 2D로 내리지 않는다.
- 1440×900과 375×812 실제 브라우저 증거가 있다.

### 27.3 2D fallback

- WebGL2 미지원, GPU 초기화 실패, context loss에서 즉시 usable하다.
- 13/57/11/82를 같은 카탈로그로 표시한다.
- pan, zoom, reset, focus, overlap, pointer, keyboard가 작동한다.
- 3D의 선택, panel, route 질의, data를 보존한다.
- 정상 WebGL2 환경을 대신하지 않는다.

### 27.4 UI와 데이터

- route, overlap, port, chokepoint, weather panel이 모두 작동한다.
- panel 표시 우선순위와 close/focus 복귀가 맞다.
- port/chokepoint/weather 장애가 독립적이다.
- LIVE, PARTIAL, STALE, UNAVAILABLE을 계약대로 표시한다.
- null, 실제 0, unavailable을 구분한다.
- estimated metric tons와 AIS 참고 성격을 정확히 표시한다.
- 표시 문구가 이 문서와 승인된 공통 언어를 따른다.

### 27.5 반응형과 접근성

- 1440×900과 375×812 주 기준이 통과한다.
- 900과 640 폭 smoke가 통과한다.
- page 가로 overflow가 0이다.
- mobile panel이 client viewport 안에 clamp된다.
- pointer와 keyboard가 같은 항목을 선택한다.
- 44×44px hit area, focus 표시, Escape, focus 복귀가 통과한다.
- reduced motion에서도 모든 기능과 의미를 사용할 수 있다.

### 27.6 최종 게이트

- type 검증, lint, build, 관련 검증 묶음이 통과한다.
- 실제 WebGL2 3D와 실제 2D fallback을 각각 검증했다.
- fatal console error, hydration overlay, unhandled rejection이 0이다.
- P0=0, P1=0이다.
- renderer와 카탈로그가 단순 존재가 아니라 실제 상호작용으로 확인됐다.
- 후속 검토가 가능한 하나의 일관된 변경 경계로 전달된다.
