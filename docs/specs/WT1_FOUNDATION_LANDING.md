# WT1 — Foundation, Landing, Shared Shell Greenfield Build Packet

## 0. 문서의 목적

이 문서는 빈 저장소에서 MOVE AI를 독립 구현할 때 WT1 담당자가 단독으로 사용하는 clean-room build packet이다.

목표는 “분위기가 비슷한 랜딩”이 아니라, 이 문서가 정의한 랜딩과 공통 업무화면 shell을 시각·동작·데이터 경계까지 정확히 구현하는 것이다.

허용 입력은 다음으로 한정한다.

1. 본 기능·디자인 명세
2. 권리 확인과 사용 승인이 완료된 Figma 또는 PNG 디자인 증거
3. 권리 확인과 사용 승인이 완료된 poster·video·icon 등 소유 미디어
4. `MOVE_AI_DATA_PACK`
5. 사용하는 프레임워크·브라우저·접근성 API의 공식 제3자 문서

허용 목록 밖의 코드, 저장소 정보, 배포 주소, 로컬 경로, 빌드 산출물은 입력으로 사용할 수 없다.

기존 화면을 개발자 도구로 검사하거나, DOM·style·event·asset을 추출하거나, 코드를 복사·변환·포팅하는 행위도 금지한다.

승인되지 않은 화면 자료, 제품 산출물, 코드 검색 결과는 구현 근거가 될 수 없다.

문서 안의 수치와 표시 문구는 임의의 디자인 제안이 아니라 구현 계약이다.

명시적으로 개선 후보라고 적지 않은 항목은 그대로 충족한다.

실행 코드와 특정 파일 구조는 이 문서에 포함하지 않는다.

## 1. 완료의 의미

WT1 완료는 다음 두 결과가 동시에 성립하는 상태다.

1. `/`가 본 문서의 정보 순서, 표시 문구, 영상 경험, 반응형 geometry를 갖는다.
2. `/freight-risk/*`가 본 문서의 Sidebar, topbar, route context, responsive shell을 갖는다.

영상이 없는 정적 대체 화면만 보이는 상태는 완료가 아니다.

공통 shell 없이 랜딩만 보이는 상태도 완료가 아니다.

shell이 있어도 각 페이지의 실제 업무 기능을 WT1이 임의로 채우는 것은 완료가 아니다.

DONE 선언 시 모든 acceptance cell의 값은 `CHECKED`여야 한다.

미검증 상태, `N/A`, “시간 부족”, “대략 유사”는 종료값으로 허용하지 않는다.

확인하지 못한 셀이 있으면 DONE을 선언하지 않고 작업을 계속한다.

## 2. Clean-room 입력 우선순위

| 우선순위 | input | 이 문서에서의 역할 |
|---:|---|---|
| 1 | 본 `WT1_FOUNDATION_LANDING.md` | UI·기능·표시 문구·geometry·상태·acceptance 판정 |
| 2 | 승인된 Figma 또는 PNG | 명세가 지정한 시각 배치와 asset crop 확인 |
| 3 | 승인된 소유 미디어와 권리·hash 등록부 | poster·video·icon의 동일성 및 사용 권한 확인 |
| 4 | `MOVE_AI_DATA_PACK` | 허용된 데이터와 route identity 확인 |
| 5 | 공식 제3자 문서 | 표준 API 사용법과 브라우저 동작 확인 |

입력 간 충돌이 있으면 표시 문구·기능·상태·geometry는 본 문서를 따른다. 승인된 디자인 증거는 본 문서에 없는 미세한 시각 정렬만 보조한다.

승인된 미디어가 본 문서와 충돌하면 임의 보정하지 않고 asset owner의 재승인을 받는다.

구현 시작 전에 입력 목록, 소유자, 권리 상태, 승인 일자, SHA-256을 clean-room input register에 기록한다.

허용 목록 밖의 코드·화면·asset을 열람한 사실이 있으면 즉시 기록하고 해당 정보에 의존한 구현을 폐기한 뒤 승인된 입력만으로 다시 작성한다.

비활성 또는 문서에 없는 스타일·이벤트를 기능으로 추정하지 않는다.

정적 랜딩의 설명 숫자는 업무 페이지의 계산값으로 해석하지 않는다.

## 3. 담당 범위

### 3.1 WT1이 소유하는 범위

- root route `/`의 진입 구조
- root route metadata
- 랜딩 독립 디자인 토큰
- 랜딩 header와 brand anchor
- `데모 사용` CTA
- 11초 hero video와 poster
- hero media lifecycle
- 영상 안의 5단계 장면 검수
- 세 개의 핵심 기능 card
- 세 card의 정적 illustration
- 네 개의 trust item
- 랜딩의 760px breakpoint
- 랜딩 접근성의 parity 범위와 승인된 보강
- 업무화면 공통 AppShell
- 공통 Sidebar
- 공통 topbar
- 공통 content frame
- mobile Sidebar drawer
- 공통 page metadata map
- 전역 route query/localStorage 계약
- page link의 route 보존
- 공통 focus ring, reduced-motion, portal reset 기반
- WT2~WT6가 소비할 shared token과 geometry 계약

### 3.2 WT1이 제공해야 하는 seam

- 현재 `routeId`를 읽고 유효화한 값
- route 변경 함수
- 현재 page id
- page별 eyebrow, title, description
- topbar action slot
- content slot
- mobile menu open/close state
- Sidebar active link state
- dialog portal이 shell 바깥에서도 동일 font와 box sizing을 쓰는 기반

### 3.3 WT1 비담당 범위

- Dashboard chart와 forecast 계산
- Models 8개 모델 비교와 tuning
- Network 지도, 항만, weather, chokepoint
- Allocation CVaR 계산과 CSV
- market/news/insight API 구현
- forecast snapshot data 생성 파이프라인
- Page 2 대표모델 저장 UI
- Page 3의 지도 전용 absolute header
- Page 4의 계산 입력과 결과 card
- 인증, 회원가입, 결제
- 랜딩 정적 65/35를 실제 최적화 결과로 만드는 일
- 랜딩 `1.1M TEU`를 Page 3 AIS 데이터에 연결하는 일

비담당 페이지에는 실제 기능처럼 보이는 가짜 widget을 만들지 않는다.

빈 page slot에는 해당 WT가 연결할 수 있는 명시적 integration boundary만 둔다.

## 4. Clean-room input map

| 계약 | 허용 입력 | 확인 포인트 |
|---|---|---|
| root surface | 본 문서 | viewport, scroll ownership, metadata, CTA navigation |
| landing visual | 본 문서와 승인된 Figma/PNG | 표시 문구, section 순서, geometry, crop, responsive layout |
| landing media | 승인된 소유 poster와 MP4 | 권리 상태, SHA-256, dimensions, codec, duration, ended frame |
| shared shell | 본 문서와 승인된 Figma/PNG | Sidebar, topbar, content slots, mobile drawer, focus state |
| route registry | `MOVE_AI_DATA_PACK`과 본 문서 | 13개 유효 route, 기본 route, 표시명 |
| platform behavior | 공식 제3자 문서 | autoplay, storage, focus, reduced motion, history API |

허용 입력에 없는 파일명, 디렉터리 구조, selector, class name, module 경계는 clean-room 입력이 아니다.

승인된 Figma/PNG에서 보이지 않는 동작을 추론하지 않는다. 동작과 상태는 본 문서를 따른다.

표시 문구는 본 문서의 문자열을 사용하며, 다른 화면에서 추출하거나 요약·번역하지 않는다.

## 5. Clean-room 선행조건

구현을 시작하기 전에 아래 항목을 먼저 고정한다.

- clean-room input register의 승인 완료
- 승인된 각 Figma/PNG/미디어의 owner와 사용 권리 확인
- 승인된 각 binary asset의 SHA-256, byte size, dimensions 기록
- 미디어 codec, duration, frame rate 기록
- 운영 기준 브라우저와 버전
- OS scale 100%
- browser zoom 100%
- font loading 완료 조건
- network cache cold와 warm 검증 조건
- `/`의 1440×900, 900×900, 640×900, 375×812 candidate capture 계획
- `/freight-risk/dashboard?route=KNEI`의 같은 네 viewport candidate capture 계획
- Sidebar collapsed, hover-expanded, keyboard focus-within 상태 계획
- mobile drawer closed/open 상태 계획
- video poster, 장면 1~5, ended frame 검증 계획
- CTA navigation recording 계획
- autoplay 허용과 차단 환경 recording 계획

각 candidate capture에는 viewport, DPR, browser, 승인된 디자인 증거 ID, `capturedAt`, timezone을 기록한다.

frame 비교 시 스크롤 위치도 기록한다.

font가 달라진 capture는 acceptance 근거로 쓰지 않는다.

video frame은 임의 CSS fallback이 아니라 승인된 MP4의 decode 결과여야 한다.

## 6. Greenfield 산출물 구조 계약

구체적 framework 이름은 프로젝트 표준에 맞출 수 있다.

다만 책임 분리는 다음과 같아야 한다.

- root route entry
- landing route view
- landing media asset register
- landing-scoped styles
- freight-risk shell
- Sidebar component
- page metadata registry
- route registry adapter
- route persistence adapter
- shared visual tokens
- shared focus/reduced-motion rules
- shared test fixtures
- visual evidence directory

랜딩 토큰과 업무 shell 토큰을 하나의 theme로 합치지 않는다.

랜딩은 전통적인 white/blue marketing language다.

업무 shell은 밝은 neumorphic canvas language다.

두 visual language를 억지로 통일하면 parity 실패다.

## 7. 구현 순서 개요

1. 승인된 clean-room input과 asset 권리를 고정한다.
2. root route와 metadata를 세운다.
3. 랜딩의 정적 structure와 표시 문구를 세운다.
4. 승인된 poster와 11초 MP4를 연결한다.
5. media state와 five-stage evidence를 검증한다.
6. desktop geometry를 맞춘다.
7. 760px 이하 geometry를 맞춘다.
8. 공통 shell token과 Sidebar를 세운다.
9. route query/localStorage를 연결한다.
10. topbar/content frame/mobile drawer를 연결한다.
11. 접근성과 reduced-motion을 검증한다.
12. 시각 비교와 functional acceptance를 닫는다.

앞 단계의 acceptance가 끝나기 전 다음 단계의 스타일 보정으로 넘어가지 않는다.

## 8. Root route architecture

### 8.1 global document-root ownership

application root layout만 application 전체에서 유일한 `html`과 `body`를 렌더한다.

모든 nested route/page layout은 fragment, provider, framework metadata만 렌더한다.

nested route/page layout은 `html`, `head`, `body`, isolated subdocument, iframe을 절대 렌더하지 않는다.

모든 route는 하나의 document root를 공유하며 client navigation 중 document root를 교체하거나 중복 생성하지 않는다.

root route는 이 단일 document 안의 일반 landing route view다.

구체적인 framework와 파일 구조는 프로젝트 표준에 따르되 다음 관찰 가능한 계약은 고정한다.

root main surface는 width 100%다.

height와 min-height는 100dvh다.

margin은 0이다.

outer overflow는 hidden이다.

background는 white다.

랜딩 route view는 display block이며 width와 height는 100%다.

랜딩 route view의 accessible title은 `GLOVIS 해상운임 예측·운임 의사결정 플랫폼 소개`다.

application document root는 scroll하지 않는다.

랜딩 route view가 내부 scroll을 소유한다.

### 8.2 nested layout 규칙

landing과 모든 업무 route의 nested layout은 동일한 application root 아래에서 합성한다.

route별 layout은 필요한 fragment, provider, slot, metadata만 반환한다.

framework metadata API는 사용할 수 있지만 nested layout이 `head` element를 직접 소유하지 않는다.

표시 문구, 순서, CTA, crop, animation, scroll ownership은 route 전환 전후 동일해야 한다.

구조 변경이 asset load timing을 바꾸면 video lifecycle acceptance를 다시 실행한다.

SEO나 접근성 개선을 이유로 visible geometry를 바꾸지 않는다.

### 8.3 top-level navigation 경계

CTA는 현재 문서 계층의 최상위 dashboard로 이동해야 한다.

dashboard를 랜딩 surface 안에 중첩하지 않는다.

autoplay와 application route navigation이 공식 브라우저 동작 안에서 유지되는지 검증한다.

### 8.4 hydration acceptance regression

`/` direct load와 각 `/freight-risk/*` direct load에서 server markup과 hydrated DOM의 document-root 구조가 같아야 한다.

hydration 전후 `html`과 `body`는 각각 정확히 하나이며 application root layout이 계속 소유한다.

landing에서 dashboard로 이동하고 업무 page 사이를 이동해도 `html`, `head`, `body`가 추가·교체·중첩되지 않는다.

hydration mismatch, invalid DOM nesting, duplicate document element 관련 console error와 warning은 0건이어야 한다.

hydration 전후 metadata, route query, localStorage 우선순위, scroll ownership, 표시 문구가 바뀌거나 깜박이면 실패다.

## 9. Landing metadata 계약

- document language: Korean
- charset: UTF-8
- viewport: `width=device-width, initial-scale=1`
- title: `GLOVIS 해상운임 예측·운임 의사결정 플랫폼`
- description: `KCCI 운임 예측과 글로벌 항만 모니터링, 운임 의사결정을 지원하는 GLOVIS 해상운임 예측·운임 의사결정 플랫폼`
- html scroll behavior: smooth
- body margin: 0
- body background: `#f3f6fb`
- shell width: 100%
- shell min-height: 100vh
- shell background: white
- shell overflow: hidden
- shell max-width: 없음
- shell outer shadow: 없음
- footer: 없음

metadata 표시 문구를 마케팅 문장으로 재작성하지 않는다.

footer를 새로 넣지 않는다.

## 10. Landing section order

DOM과 화면 순서는 다음 네 영역으로 고정한다.

1. brand/CTA header
2. 11초 video hero
3. 핵심 기능 heading과 feature card 3개
4. service trust strip 4개

hero 위에 별도 slogan을 넣지 않는다.

feature 앞에 KPI strip을 넣지 않는다.

trust strip 뒤에 footer나 legal 표시 문구를 임의로 넣지 않는다.

## 11. Landing 독립 design tokens

| 용도 | 지정값 |
|---|---|
| navy | `#001c55` |
| deep navy | `#00133d` |
| blue | `#0968e8` |
| ink | `#12233f` |
| muted | `#64738b` |
| line | `#e6ebf3` |
| body canvas | `#f3f6fb` |
| shell/card | `#ffffff` |
| header brand | `#143c79` |
| CTA start | `#0753c7` |
| CTA end | `#0877ee` |
| section eyebrow | `#1671e6` |
| feature title | `#10284d` |
| feature description | `#748198` |
| hero background | `#010f2c` |
| trust start | `#001746` |
| trust end | `#002867` |
| trust symbol | `#87b9ff` |
| trust helper | `#9db3d4` |

font stack은 Arial, Apple SD Gothic Neo, Noto Sans KR, sans-serif 순서다.

업무 shell의 Pretendard stack을 랜딩에 강제로 주입하지 않는다.

## 12. Header 정밀 계약

header aria-label은 `상단 영역`이다.

desktop height는 78px이다.

layout은 `1fr auto` 두 column이다.

항목은 수직 중앙 정렬한다.

desktop horizontal padding은 5.25%다.

background는 `rgba(255,255,255,.97)`이다.

bottom border는 1px `rgba(220,229,242,.72)`다.

brand text는 `GLOVIS`다.

brand href는 `#top`이다.

brand aria-label은 `GLOVIS 해상운임 예측·운임 의사결정 플랫폼 홈`이다.

brand color는 `#143c79`다.

brand size는 19px이다.

brand weight는 900이다.

brand letter-spacing은 `-.02em`이다.

brand visual transform은 skewX(-8deg)다.

CTA 표시 문구는 `데모 사용`이다.

CTA href는 `/freight-risk/dashboard?route=KNEI`다.

CTA는 같은 application document 안에서 dashboard route로 이동해야 한다.

CTA desktop min-width는 104px이다.

CTA padding은 11px 19px이다.

CTA radius는 999px이다.

CTA text는 white, 12px, weight 800이다.

CTA gradient는 `#0753c7`에서 `#0877ee`다.

CTA shadow는 `0 8px 20px rgba(2,87,203,.22)`다.

로그인 icon, menu, 보조 CTA를 추가하지 않는다.

## 13. Hero geometry

section id는 `top`이다.

section aria-label은 `한국 중심 지구에서 글로벌 노선으로 이어지는 현대글로비스 해상운임 예측·운임 의사결정 플랫폼 소개 영상`이다.

width는 100%다.

desktop height는 `clamp(300px,39.2vw,500px)`다.

overflow는 hidden이다.

background는 `#010f2c`다.

video width/height는 100%다.

video object-fit은 cover다.

video object-position은 center 50%다.

hero 하단에는 1px `rgba(255,255,255,.24)` edge line이 있다.

text overlay, play badge, progress bar는 ready state에 없다.

## 14. Required media assets

### 14.1 poster

- format: JPEG
- dimensions: 2560×1080
- 승인 기준 size: 약 598,712 bytes
- storage: 권리 승인된 asset package
- role: video decode 전 첫 화면과 재생 불가 시 최소 시각 맥락

### 14.2 intro video

- format: MP4
- dimensions: 2560×1080
- duration: 약 11초
- 승인 기준 size: 약 5,567,964 bytes
- storage: 권리 승인된 asset package
- loop: false
- controls: false
- audio presentation: muted

### 14.3 asset 권리·hash gate

poster와 video는 다음 gate를 모두 통과하기 전 구현·배포·evidence에 사용할 수 없다.

- asset owner가 식별됨
- 제품 내 사용·복제·배포 권리가 서면 또는 승인 시스템에서 확인됨
- 제3자 권리 제한과 만료 조건이 확인됨
- 승인된 원본 binary의 SHA-256이 등록됨
- 구현에 포함된 binary의 SHA-256이 승인값과 일치함
- 권리 상태 또는 hash가 불명확하면 build acceptance가 P0로 실패함

asset register 필수 필드는 다음과 같다.

- logical asset name
- owner
- rights approval record ID
- permitted usage scope
- approval date와 expiry가 있으면 expiry
- SHA-256
- byte size
- width
- height
- codec
- duration
- frame rate
- poster/video aspect ratio
- approved baseline owner

“비슷한 지구 영상”으로 대체하지 않는다.

AI로 새로 생성한 영상은 parity asset이 아니다.

poster를 video 첫 frame의 저해상도 screenshot으로 대체하지 않는다.

## 15. Video element 정밀 계약

- autoplay enabled
- muted enabled
- playsinline enabled
- preload auto
- loop disabled
- browser controls disabled
- poster connected before first paint
- MP4 MIME type declared
- detailed aria-label connected

상세 aria-label은 다음과 같다.

`한국이 보이는 지구에서 여러 글로벌 노선이 펼쳐진 뒤 지구가 현대글로비스 로고의 O로 흔들림 없이 안착하는 인트로 영상`

script는 element 확보 후 muted를 다시 true로 보장한다.

document load 시 play를 요청한다.

play promise rejection은 화면 전체 오류로 던지지 않는다.

autoplay가 막힌 경우 document의 최초 pointerdown에서 한 번만 다시 시도한다.

retry listener는 성공 여부와 관계없이 반복 등록하지 않는다.

video 종료 후 자동 재시작하지 않는다.

video 종료 후 poster로 되돌리지 않는다.

video 종료 후 별도 overlay를 활성화하지 않는다.

## 16. Hero media 상태계약

| 상태 | 진입 조건 | 사용자에게 보이는 것 | 허용 동작 | 종료 조건 |
|---|---|---|---|---|
| LOADING | poster는 준비, video metadata/data 대기 | 승인된 poster가 hero를 채움 | CTA와 scroll 사용 가능 | can-play 또는 error |
| READY | video decode 가능, play 성공 | actual MP4 | muted inline playback | ended, pause, error |
| AUTOPLAY_BLOCKED | 최초 play rejection | poster 또는 멈춘 video frame | 최초 pointerdown 1회 retry | READY 또는 ERROR |
| ENDED | 약 11초 재생 완료 | MP4의 최종 brand frame | CTA/scroll 사용 가능 | reload 외 자동 전이 없음 |
| ERROR | asset load/decode 실패 | 승인된 poster와 대체 설명 | CTA/기능 설명 사용 가능 | 명시적 reload |
| REDUCED_MOTION | 승인된 접근성 보강에서 motion 축소 | 승인된 poster 우선 | CTA/scroll 사용 가능 | preference 변경 |
| CACHED | browser cache에서 asset 제공 | LOADING 없이 poster→video 가능 | READY와 동일 | READY/ENDED |
| EMPTY | videoSrc/posterSrc 계약 누락 | 허용되는 정상 UI 없음 | build failure | asset 연결 후만 해소 |

EMPTY를 fallback 디자인의 정상 상태로 취급하지 않는다.

EMPTY는 P0 integration failure다.

ERROR에서도 header, CTA, feature, trust strip은 완전히 사용 가능해야 한다.

CACHED는 별도 badge를 화면에 추가하는 뜻이 아니다.

## 17. 11초 영상의 5단계 motion acceptance

5단계는 새 CSS 애니메이션을 발명하라는 뜻이 아니다.

다섯 단계는 actual MP4 안에서 검수할 narrative checkpoint다.

정확한 timestamp는 승인된 MP4를 frame 단위로 샘플링해 evidence record에 기입한다.

소스에 없는 초 단위 timing을 추측해 문서에 고정하지 않는다.

| 단계 | actual visual checkpoint | 필수 evidence |
|---:|---|---|
| 1 | poster에서 한국이 보이는 지구 장면이 안정적으로 시작됨 | poster와 첫 decoded frame 비교 |
| 2 | 한국 중심 지구가 화면의 중심 narrative로 드러남 | globe 위치·scale·crop frame |
| 3 | 여러 글로벌 노선이 지구에서 펼쳐짐 | route가 충분히 식별되는 frame |
| 4 | 노선 장면이 정리되고 지구가 logo의 O 위치로 흔들림 없이 수렴함 | docking 직전/직후 frame pair |
| 5 | HYUNDAI GLOVIS 최종 lockup이 안정된 ended frame으로 남음 | ended event 이후 frame |

모든 단계에서 desktop cover crop과 mobile 16:9 crop을 각각 확인한다.

다섯 frame의 color, globe silhouette, route placement, final logo는 승인된 디자인 증거와 비교한다.

단계 3을 다섯 개 CSS route path draw로 대체하지 않는다.

단계 4를 임의의 spring animation으로 대체하지 않는다.

단계 5에 별도의 DOM logo를 덧씌우지 않는다.

영상 자체 최종 frame이 lockup이다.

## 18. Final animation 경계

승인된 종료 상태에는 MP4 위에 별도 final brand overlay가 없다.

문서에 없는 fade, earth dock, letter reveal, tagline animation을 새로 만들지 않는다.

video ended handler는 추가 DOM scene을 활성화하지 않는다.

5단계 video acceptance를 별도 CSS animation으로 대체하지 않는다.

별도 최종 overlay가 보이면 P0다.

## 19. Feature section heading

section id는 `features`다.

내부 heading wrapper id는 `about`이다.

section은 `feature-title`로 aria-labelledby 된다.

desktop padding은 62px 5.25% 52px이다.

background는 왼쪽 위의 약한 blue radial gradient와 `#f7faff → white` vertical gradient다.

heading wrapper max-width는 760px이다.

heading은 가운데 정렬한다.

heading bottom margin은 38px이다.

eyebrow 표시 문구는 `핵심 기능`이다.

H1 표시 문구는 `예측에서 선복계약 의사결정까지`다.

description 표시 문구는 `미래 스팟운임을 예측하고, 시나리오로 계약 비중을 추천하며, 글로벌 항로 상황을 모니터링합니다.`다.

eyebrow는 12px/900, `#1671e6`, letter-spacing `.08em`이다.

H1은 `clamp(24px,2.35vw,34px)`, weight 850, `#10243f`, letter-spacing `-.045em`이다.

description은 14px, `#748198`, top margin 13px이다.

문장 줄바꿈을 `<br>`로 임의 고정하지 않는다.

## 20. Feature grid 공통 contract

grid max-width는 1240px이다.

grid는 수평 중앙 정렬한다.

desktop은 equal 3 columns다.

gap은 22px이다.

card padding은 27px 27px 24px이다.

card border는 1px `#e4eaf3`다.

card radius는 10px이다.

card background는 `rgba(255,255,255,.92)`다.

card shadow는 `0 15px 38px rgba(17,65,127,.08)`다.

hover는 translateY(-4px)다.

hover shadow는 `0 20px 46px rgba(17,65,127,.14)`다.

hover transition은 180ms다.

heading row는 42px icon column과 1fr text column이다.

heading row gap은 13px이다.

icon은 42×42 circle이다.

icon gradient는 `#0255c8 → #0b75f0`다.

icon line art는 white, 약 23px다.

card H2는 17px/850, `#10284d`다.

body는 12px, line-height 1.65, `#748198`다.

visual panel은 height 152px다.

visual panel top margin은 22px이다.

visual panel radius는 8px이다.

card를 실제 dashboard interactive card처럼 만들지 않는다.

## 21. Feature card 1 정밀 계약

title은 `스팟운임 예측`이다.

body는 `과거 운임 데이터를 분석해 향후 스팟운임의 흐름과 불확실성 구간을 예측합니다.`다.

visual aria-label은 `미래 스팟운임 예측 추세 그래프`다.

visual은 정적 SVG다.

수평 grid line은 세 개다.

area는 blue gradient다.

polyline은 상승 흐름이다.

polyline stroke width는 3이다.

cap과 join은 round다.

중간 forecast point는 white fill, blue stroke circle이다.

`4주 예측`, `PI90` 같은 별도 badge를 추가하지 않는다.

이 visual을 업무 snapshot data에 연결하지 않는다.

## 22. Feature card 2 정밀 계약

article id는 `flow`다.

title은 `선복계약 비중 추천`이다.

body는 `예측 시나리오별 예상 조달비용과 CVaR를 비교해 장기계약·스팟 조달 비중을 추천합니다.`다.

panel aria-label은 `권장 선복계약 비중 장기계약 65퍼센트, 스팟 조달 35퍼센트`다.

donut outer size는 112×112다.

donut dark blue segment는 0~65%다.

donut light blue segment는 65~100%다.

center 표시 문구는 `65%`다.

legend 1은 `장기계약 65%`다.

legend 2는 `스팟 조달 35%`다.

pill은 `CVaR 위험 반영`이다.

65/35는 정적 기능 illustration이다.

Page 4 KNEI 계산값으로 바꾸지 않는다.

## 23. Feature card 3 정밀 계약

title은 `글로벌 물류 모니터링`이다.

body는 `전 세계 13개 주요 항로와 운하·해협·항만의 기상 상태와 물동량을 한 화면에서 모니터링합니다.`다.

panel aria-label은 `전 세계 13개 주요 항로와 운하, 해협, 항만의 기상 및 물동량 모니터링 화면`이다.

panel background는 blue ocean/grid gradient다.

land는 단순화한 SVG다.

route curve는 다섯 개다.

중심 hub가 있다.

port circle은 다섯 개다.

pink strait monitoring zone이 있다.

top-left 표시 문구는 `13 / 글로벌 항로`다.

top-right green status는 `기상 정상`이다.

bottom-right 표시 문구는 `항만 물동량 / 1.1M TEU`다.

bottom-left 표시 문구는 `운하·해협 감시`다.

`1.1M TEU` 뒤에 `/ 예시`를 붙이지 않는다.

이 값은 Page 3 AIS metric tons가 아니다.

Page 3 live data 단위로 재사용하지 않는다.

## 24. Trust strip 정밀 계약

section id는 `resources`다.

aria-label은 `서비스 강점`이다.

desktop은 equal 4 columns다.

min-height는 96px이다.

horizontal padding은 4.5%다.

background gradient는 `#001746 → #002867`다.

text는 white다.

항목 사이에는 opacity 11% white vertical divider가 있다.

symbol frame은 35×35 outlined circle이다.

symbol은 18px, `#87b9ff`다.

title은 12px/800이다.

description은 9px, `#9db3d4`다.

| 순서 | symbol | title | description |
|---:|---|---|---|
| 1 | `◎` | `글로벌 데이터 기반` | `다양한 항로 데이터 수집` |
| 2 | `✣` | `AI·딥러닝 모델` | `정확도 높은 예측` |
| 3 | `◷` | `실시간 모니터링` | `빠른 대응과 판단` |
| 4 | `♙` | `전문가 인사이트` | `의사결정 지원` |

순서를 바꾸지 않는다.

symbol을 임의의 다른 icon library glyph로 바꾸지 않는다.

## 25. Landing width별 geometry

### 25.1 1440px

- desktop rule 적용
- header height 78px
- header x padding 75.6px
- hero height 500px cap
- feature x padding 75.6px
- feature grid width 1240px
- grid left 약 100px
- card width 약 398.67px
- card gap 22px
- trust 4 columns
- horizontal overflow 0px

### 25.2 900px

- 900은 760보다 크므로 desktop rule 적용
- header height 78px
- header x padding 47.25px
- hero height 352.8px
- feature x padding 47.25px
- usable grid width 약 805.5px
- card width 약 253.83px
- card 3 columns 유지
- trust 4 columns 유지
- card 표시 문구 wrapping은 승인된 디자인 증거와 비교
- horizontal overflow 0px

### 25.3 640px

- mobile rule 적용
- header height 64px
- header x padding 20px
- CTA min-width 해제
- CTA padding 9px 14px
- hero aspect-ratio 16:9
- hero height 360px
- feature padding 46px 20px 36px
- heading bottom margin 28px
- description 12px, line-height 1.6
- grid 1 column
- card width 600px
- card padding 24px 22px 20px
- trust 2 columns
- trust outer padding 12px 16px
- trust item left aligned
- trust item padding 14px 12px
- horizontal overflow 0px

### 25.4 375px

- mobile rule 적용
- header height 64px
- header x padding 20px
- hero height 약 210.94px
- feature content width 335px
- feature grid 1 column
- trust inner width 약 343px
- trust 2 columns 유지
- trust title/helper가 잘리지 않아야 함
- 별도 trust 1-column breakpoint를 추가하지 않음
- document horizontal overflow 0px

760px 경계 양쪽 759px와 761px도 별도 확인한다.

## 26. Landing interaction contract

### 26.1 brand

- click은 `#top`으로 이동
- smooth scroll은 일반 motion 환경에서 유지
- keyboard Enter로 동일 동작
- visible focus가 승인된 보강으로 존재해야 함

### 26.2 CTA

- click은 같은 application document의 dashboard route로 이동
- query는 `route=KNEI`
- landing route view 내부에 dashboard를 중첩하지 않음
- keyboard Enter로 동일 동작
- focus ring이 pill 밖에서 잘리지 않음

### 26.3 feature card

- pointer hover에서 4px 상승
- shadow transition 180ms
- click action 없음
- cursor를 clickable로 위장하지 않음
- keyboard focus target으로 임의 전환하지 않음

### 26.4 video

- ready state에서 별도 visible control 없음이 parity 기본
- autoplay 차단 시 최초 pointerdown retry 1회
- ended 후 loop 없음
- page scroll과 pointer retry가 충돌하지 않음

## 27. Landing animation과 reduced motion

reduced-motion에서는 smooth scroll을 해제한다.

dead final overlay animation도 정지한다.

기본 계약은 reduced-motion에서도 autoplay 자체를 중지하지 않는다.

접근성 보강을 승인받으면 reduced-motion에서 poster 정지를 우선할 수 있다.

보강 시 일반 motion screenshot과 reduced-motion screenshot을 둘 다 제출한다.

보강으로 hero 높이, poster crop, CTA geometry가 바뀌면 안 된다.

card hover transition도 reduced-motion에서 제거할 수 있다.

5단계 MP4 parity는 일반 motion 환경에서 반드시 별도로 검수한다.

## 28. Shared shell design tokens

| 용도 | value |
|---|---|
| navy | `#001290` |
| blue | `#15269d` |
| cyan | `#3fa1eb` |
| ink | `#141415` |
| muted | `#63666a` |
| line | `#e0e0e0` |
| canvas | `#f1f2f9` |
| danger/up | `#c84646` |
| success/down | `#087352` |
| manual purple | `#7c3aed` |
| dark tooltip | `#001290` |

업무 font stack은 Pretendard, Noto Sans KR, Inter, system 순서다.

일반 card는 canvas background다.

일반 raised shadow는 `10px 10px 24px rgba(21,38,157,.13)`와 반대편 white shadow 조합이다.

card radius는 18px이다.

form inset surface는 blue-tinted inner shadow와 white reverse inner shadow를 함께 쓴다.

dark tooltip은 navy background, cyan border, white text다.

dark tooltip shadow는 `0 18px 40px rgba(0,18,144,.24)`다.

## 29. Shared page metadata map

| page | title | eyebrow | description |
|---|---|---|---|
| dashboard | `메인 대시보드` | `ROUTE MARKET OVERVIEW` | `운임과 시장 신호를 한 화면에서 확인합니다.` |
| models | `예측 모델 디테일` | `MODEL VALIDATION` | `8개 모델의 1~4주 전망과 시차별 검증 성능을 비교합니다.` |
| network | `글로벌 항만 네트워크` | `PORT NETWORK OVERVIEW` | `13개 노선의 대표 항만과 AIS 기반 물동량 신호를 탐색합니다.` |
| allocation | `선복물량 최적화` | `CVAR ALLOCATION` | `100,000개 운임경로를 고정운임·Spot 배분으로 전환합니다.` |

page title이나 eyebrow를 담당 WT가 임의 재작성하지 못하게 registry로 제공한다.

## 30. Sidebar 정밀 DOM과 순서

aside aria-label은 `해상운임 예측·운임 의사결정 플랫폼 페이지 메뉴`다.

brand icon은 Ship 22px이다.

brand title은 `해상운임 예측·운임 의사결정 플랫폼`이다.

brand helper는 `MARITIME FREIGHT FORECASTING & RATE DECISION PLATFORM`이다.

nav label은 `워크스페이스`다.

menu 순서는 고정한다.

| no | label | icon | route |
|---:|---|---|---|
| 01 | Dashboard | LayoutDashboard 18px | `/freight-risk/dashboard` |
| 02 | Models | BarChart3 18px | `/freight-risk/models` |
| 03 | Network | Globe2 18px | `/freight-risk/network` |
| 04 | Allocation | Gauge 18px | `/freight-risk/allocation` |

모든 href에는 현재 유효 `routeId` query를 붙인다.

brand href는 같은 route의 dashboard다.

active link에는 aria-current를 둔다.

active visual은 inset/raised blue treatment다.

## 31. Sidebar 정밀 geometry와 behavior

Sidebar는 fixed이고 z-index 70이다.

desktop collapsed width는 68px이다.

desktop padding은 18px 9px 14px이다.

brand icon frame은 38×38, radius 12px이다.

nav item min-height는 48px이다.

nav item radius는 13px이다.

nav item bottom margin은 8px이다.

main margin-left는 항상 68px이다.

901px 이상에서 hover 또는 focus-within이면 Sidebar width가 244px로 확장된다.

확장은 overlay 방식이다.

main content는 244px만큼 밀리지 않는다.

expanded 내부 유효폭은 226px이다.

expanded nav min-height는 54px이다.

width/padding transition은 약 280ms cubic-bezier(.2,.8,.2,1)이다.

shadow transition은 약 220ms다.

expanded title은 12px이다.

expanded helper는 8px이다.

reduced-motion에서는 expansion transition을 제거한다.

Sidebar와 모든 descendant는 border-box다.

Sidebar anchor는 inherited color와 no underline을 자체 선언한다.

app 조상 reset에만 의존하지 않는다.

## 32. Mobile Sidebar contract

900px 이하에서 desktop hover expansion을 사용하지 않는다.

Sidebar width는 218px이다.

Sidebar padding은 20px 14px 16px이다.

기본 상태는 viewport 왼쪽 밖이다.

mobile menu button으로 drawer를 연다.

main margin-left는 0이다.

mobile menu button은 40×40이다.

기준 표시 문구는 open/closed 모두 `메뉴 열기`이고 icon만 Menu/PanelLeftClose로 바뀐다.

open 상태는 boolean aria-expanded로 노출한다.

drawer open 시 모든 label과 icon이 보인다.

close 동작은 같은 menu button 재클릭, Sidebar link navigation, Escape다.

mobile drawer backdrop은 없으므로 scrim close는 N/A다.

drawer open 중에는 기존 body overflow inline 값을 저장한 뒤 mobile viewport에서만 overflow를 hidden으로 잠근다.

toggle, navigation, Escape, viewport 전환, unmount로 drawer가 닫히면 저장한 overflow 값과 기존 style attribute 유무를 정확히 복원한다.

desktop hover/focus expansion에는 body scroll lock을 적용하지 않는다.

close 완료 후 opener가 존재하면 다음 animation frame에 focus를 opener로 복귀시킨다.

navigation으로 shell이 교체돼도 합의된 mobile menu trigger에 focus를 복귀시킨다.

focus trap은 요구하지 않는다.

drawer가 document horizontal overflow를 만들면 안 된다.

## 33. General topbar and content frame

Page 1, 2, 4 topbar는 sticky다.

topbar z-index는 50이다.

topbar min-height는 약 92px이다.

padding은 `14px clamp(20px,3vw,44px)`이다.

background는 `rgba(241,242,249,.94)`다.

backdrop blur는 16px이다.

shadow는 `8px 8px 22px rgba(21,38,157,.08)`와 reverse white shadow다.

content max-width는 1580px이다.

content는 중앙 정렬한다.

content padding은 `24px clamp(20px,3vw,44px) 52px`이다.

dashboard에만 `전체 노선` action을 표시한다.

as-of chip은 label/value 두 줄이다.

Network는 별도 60px absolute header를 사용하므로 일반 topbar height를 강요하지 않는다.

## 34. Shared typography

- page eyebrow: 10px, weight 900, letter-spacing .17em
- page H1: 23px
- page description: 11px
- section eyebrow: 10px 목표
- section H2: 18px
- section helper: 약 10~11px
- route select: 12px
- as-of label/value: 9px / 11px
- status badge: 9px
- Sidebar expanded title/helper: 12px / 8px
- 640px 이하 page H1: 18px
- 640px 이하 section H2: 16px
- 640px 이하 page eyebrow와 description: hidden

작은 component text를 전역으로 무조건 키우지 않는다.

실제 computed style과 screenshot을 기준으로 component별 확인한다.

## 35. Shell width별 geometry

### 35.1 1440px

- Sidebar collapsed 68px
- main left 68px
- main width 1372px
- topbar sticky min-height 약 92px
- topbar horizontal padding 약 41.16px, clamp 최대 44px 이하
- content horizontal padding 동일 scale
- Sidebar hover width 244px overlay
- main width와 left offset 불변
- page title/description/as-of 한 줄 배치

### 35.2 900px

- max-width 900 rule 적용
- main left 0
- Sidebar 218px off-canvas
- mobile menu 40×40 visible
- desktop Sidebar rail hidden offscreen
- topbar는 mobile trigger를 포함한 grid
- content horizontal padding 약 27px
- drawer open 시 body/right edge overflow 없음

### 35.3 640px

- topbar min-height 78px
- topbar padding 10px 14px
- content padding 14px 12px 36px
- H1 18px
- page eyebrow/description hidden
- section H2 16px
- page controls는 필요한 경우 vertical stack
- route select full width가 되는 page section을 지원

### 35.4 375px

- main width 375px
- Sidebar closed 시 보이는 rail 없음
- drawer width 218px
- topbar x padding 14px
- content usable width 351px
- focus outline이 viewport 밖으로 잘리지 않음
- fixed/portal overlay가 375px 폭을 넘지 않음
- document horizontal overflow 0px

## 36. Route query and persistence contract

route input 우선순위는 다음과 같다.

1. 현재 URL query의 유효 route
2. `localStorage['freight-risk-route']`의 유효 route
3. fallback `KNEI`

유효성은 13개 route registry로 판정한다.

invalid query를 page component에 전달하지 않는다.

route 변경 시 in-memory route state를 갱신한다.

route 변경 시 `freight-risk-route`를 갱신한다.

route 변경 시 현재 URL의 query를 replace한다.

route 변경 시 shared route-change notification을 발행해 shell과 모든 live page consumer를 동기화한다.

Sidebar href 네 개가 즉시 새 route를 반영한다.

페이지 이동 후에도 route가 유지된다.

hard refresh 후에도 같은 route가 유지된다.

URL의 유효 query가 localStorage보다 우선한다.

landing CTA는 저장 route와 관계없이 KNEI로 고정한다.

landing 자체에는 업무 route state를 주입하지 않는다.

## 37. Other storage ownership boundary

WT1은 다음 key의 namespace만 알고 seam을 보존한다.

- `glovis-freight-risk:model-tuning:v2`
- `glovis-freight-risk:representative-model:v1`
- shared contract가 정의한 route news cache namespace
- shared contract가 정의한 forecast insight cache namespace

WT1이 이 payload schema를 재정의하지 않는다.

WT1이 page navigation 때 이 값을 지우지 않는다.

WT1이 logout 같은 미존재 동작으로 storage 전체를 clear하지 않는다.

## 38. Shared state contract

| 영역 | READY | LOADING | EMPTY | ERROR | CACHED |
|---|---|---|---|---|---|
| shell metadata | registry resolved | app boot | unknown page | registry fault | build bundle |
| route | valid query/storage/fallback | hydration reconciliation | invalid input rejected | storage unavailable | valid stored route |
| Sidebar | page+route links ready | icon skeleton 불필요 | menu 0개는 build error | safe KNEI links | current route persisted |
| landing media | actual video | poster shown | P0 missing asset | poster+표시 문구 remain | browser cache hit |

shell deterministic content에 불필요한 whole-page spinner를 넣지 않는다.

storage API가 차단되어도 URL route와 KNEI fallback으로 동작한다.

storage 접근은 safe adapter로 감싸되 URL 우선순위와 visible route 결과를 바꾸지 않는다.

hydration 전후 route가 깜박이면 실패다.

## 39. Focus, keyboard, hover, click

공통 focus outline은 3px `rgba(63,161,235,.52)`다.

outline offset은 2px이다.

Sidebar hover와 keyboard focus-within expansion 결과는 같아야 한다.

Sidebar link Enter는 route query를 보존한다.

mobile menu Enter/Space는 drawer를 연다.

같은 mobile menu button의 Enter/Space는 open 상태를 toggle한다.

Sidebar link 활성화는 drawer를 닫고 해당 page로 이동한다.

Escape는 drawer를 닫고 body lock을 복원한 뒤 opener focus를 복귀시킨다.

brand click은 current route dashboard로 간다.

topbar control tab order는 visual order와 같다.

focus indicator가 raised shadow에 묻히면 안 된다.

hover-only 정보는 두지 않는다.

## 40. Portal isolation contract

WT2~WT6 dialog가 document body로 portal될 수 있다.

portal overlay와 후손은 border-box를 자체 보장한다.

button, input, select는 font를 inherit한다.

theme variables가 app ancestor 밖에서도 유효해야 한다.

focus-visible rule이 portal에서도 유효해야 한다.

width 100% input이 padding 때문에 overflow하면 WT1 foundation failure다.

portal z-index는 Sidebar와 topbar 위에 올라갈 수 있는 scale을 제공한다.

## 41. 접근성 계약

기준 시각 상태와 필수 접근성 동작을 함께 검증하되 evidence state를 구분해 기록한다.

반드시 유지할 현재 요소:

- Korean lang
- document title/description
- labeled header/hero/features/trust
- single landing H1
- decorative icons aria-hidden
- detailed video aria-label
- feature visual labels
- Sidebar aside label
- active link aria-current
- mobile menu accessible name

필수 접근성 동작:

- visible focus ring
- skip link
- video fallback description
- reduced-motion poster option
- mobile drawer boolean aria-expanded
- mobile drawer open 중 body scroll lock
- Escape close
- mobile drawer close 후 trigger focus return

접근성 동작 때문에 표시 문구와 geometry가 바뀌면 design owner 승인이 필요하다.

captions나 transcript를 추가하면 별도 design surface로 처리하고 parity screenshot을 오염시키지 않는다.

## 42. 성능과 caching

poster와 MP4의 packaging 방식은 저장소 표준을 따를 수 있다.

어떤 packaging에서도 승인된 SHA-256, dimensions, codec, duration과 권리 상태가 같아야 한다.

asset별 cache를 지원하는 경우 poster와 video의 cache identity를 분리한다.

poster는 first paint 전에 경로가 확정돼야 한다.

video cache warm 상태에서도 ended/loop behavior가 달라지면 안 된다.

## 43. 절대 임의축약 금지사항

- 11초 MP4를 CSS globe animation으로 대체 금지
- poster 생략 금지
- video asset 미연결 금지
- EMPTY를 정상 fallback으로 표시 금지
- five-stage evidence를 하나의 첫/끝 screenshot으로 축약 금지
- CTA query 삭제 금지
- CTA target `_top` 누락 금지
- feature card를 두 개로 축약 금지
- trust item을 세 개로 축약 금지
- feature body 표시 문구 요약 금지
- 65/35를 실제 Page 4 값으로 변경 금지
- `1.1M TEU`를 AIS live data로 재사용 금지
- 900px에서 mobile landing layout 조기 적용 금지
- 375px에서 trust를 임의 1열 전환 금지
- Sidebar collapsed width를 82px/236px로 되돌리기 금지
- desktop expansion 때 main content 밀기 금지
- route query 없는 Sidebar href 금지
- invalid route를 하위 page로 통과 금지
- page별 metadata 재작성 금지
- 랜딩과 업무 shell theme 혼합 금지
- 비담당 page에 fake 기능 추가 금지

## 44. Clean-room 재발금지 gate

primary media가 연결되지 않아 정적 CSS globe나 route fallback만 보이는 상태는 graceful fallback이 아니라 P0 wiring failure다.

EMPTY를 정상 기대값으로 고정하지 않는다.

CSS로 만든 11초 scene이나 route draw를 승인된 MP4 대신 사용하지 않는다.

feature visual에 `4주 예측`, `PI90`, `정적 기능 예시`, `/ 예시` 같은 표시 문구를 추가하지 않는다.

재발 방지 gate는 다음과 같다.

- 권리·hash gate를 통과한 asset register 없이는 hero 완료 금지
- READY에서 actual video element 존재 검사
- decoded media 검사
- EMPTY 상태 capture를 정상 evidence로 제출 금지
- five-stage frame evidence 필수
- 표시 문구 checklist 필수
- 승인되지 않은 CSS animation을 media 대체물로 사용 금지

## 45. 단계별 구현과 검증 계획

### Stage 0 — clean-room input authorization

산출물:

- 승인된 input register
- Figma/PNG owner와 rights 상태
- media rights·SHA-256 register
- 네 viewport의 candidate capture 계획
- video 5단계 검증 계획

acceptance:

- 허용 입력만 등록됨
- 승인되지 않은 외부 반입물·코드·asset 참조 없음
- poster와 MP4의 권리·hash gate 통과

### Stage 1 — root boundary

산출물:

- root route
- metadata
- landing route fragment
- outer/inner scroll boundary

acceptance:

- 100dvh wrapper
- internal scroll ownership
- no footer/no extra section

### Stage 2 — static landing layout

산출물:

- header
- feature heading
- three cards
- trust strip
- 표시 문구

acceptance:

- section order 일치
- 표시 문구 checklist 일치
- 1440 desktop geometry 일치

### Stage 3 — approved media

산출물:

- 승인된 poster
- 승인된 MP4
- autoplay/retry lifecycle
- ended behavior

acceptance:

- 포함 asset SHA-256과 승인값 일치
- video duration 검증
- five-stage evidence 검증
- no overlay/no loop

### Stage 4 — responsive landing

산출물:

- 760 breakpoint
- 640/375 layouts
- contract 안의 overflow 처리

acceptance:

- 900 remains desktop landing
- 640 one-card/two-trust
- 375 two-trust/no overflow

### Stage 5 — shared shell

산출물:

- AppShell
- Sidebar
- topbar
- content frame
- metadata registry

acceptance:

- collapsed/expanded geometry
- page metadata 표시 문구 일치
- page content slots stable

### Stage 6 — route context and mobile drawer

산출물:

- query/storage precedence
- route-preserving links
- mobile drawer
- mobile-only body scroll lock
- Escape/navigation/toggle/unmount close lifecycle
- opener focus return

acceptance:

- invalid query normalized
- cross-page route retained
- 900/640/375 drawer behavior 일치
- open 중 body overflow hidden, close 후 이전 값과 style attribute 정확히 복원
- Escape와 navigation 후 trigger focus 복귀
- desktop hover/focus expansion은 body를 잠그지 않음

### Stage 7 — accessibility and final evidence

산출물:

- focus/reduced-motion rules
- visual matrix
- functional results
- visual comparison report
- keyboard/mobile lifecycle recording

acceptance:

- every matrix cell CHECKED
- no open P0/P1
- known differences list empty or explicitly approved

각 단계는 앞 단계의 acceptance가 완료된 뒤 진행한다.

media asset과 비담당 page 기능을 같은 검증 단위에 섞지 않는다.

## 46. Visual evidence matrix

아래 `종료값`은 구현 전 상태표가 아니라 DONE 때 허용되는 유일한 값이다.

| surface | viewport/state | 비교 핵심 | 필수 evidence | 종료값 |
|---|---|---|---|---|
| landing | 1440×900 cold | header, 500px hero, 3 cards | approved design evidence + candidate capture | CHECKED |
| landing | 900×900 cold | desktop 3 cards 유지 | approved design evidence + candidate capture | CHECKED |
| landing | 640×900 cold | 16:9 hero, 1 card, 2 trust | approved design evidence + candidate capture | CHECKED |
| landing | 375×812 cold | narrow 표시 문구, 2 trust, no overflow | approved design evidence + candidate capture | CHECKED |
| video | poster | 2560×1080 crop/color | approved poster + decoded frame comparison | CHECKED |
| video | stage 1 | first globe reveal | timestamped frame comparison | CHECKED |
| video | stage 2 | Korea-centered globe | timestamped frame comparison | CHECKED |
| video | stage 3 | global routes | timestamped frame comparison | CHECKED |
| video | stage 4 | O docking | timestamped frame-pair comparison | CHECKED |
| video | stage 5/ended | final lockup remains | ended recording | CHECKED |
| video | autoplay blocked | poster then one retry | interaction recording | CHECKED |
| video | error | poster/표시 문구/CTA usable | state screenshot | CHECKED |
| shell | 1440 collapsed | 68px rail, main left68 | approved design evidence + candidate capture | CHECKED |
| shell | 1440 hover | 244px overlay, no reflow | before/after recording | CHECKED |
| shell | 1440 focus-within | keyboard expansion | focus recording | CHECKED |
| shell | 900 closed/open | 218px drawer | approved design evidence + candidate capture | CHECKED |
| shell | 640 | 78px topbar, 12px content inset | approved design evidence + candidate capture | CHECKED |
| shell | 375 | no horizontal overflow | screenshot+metric | CHECKED |
| shell | 375 drawer open | body overflow hidden, drawer x=0 | runtime metric + screenshot | CHECKED |
| shell | 375 drawer close | prior body overflow/style restored, trigger focus | runtime metric + keyboard recording | CHECKED |
| shell | 1440 body state | hover/focus expansion does not lock body | runtime metric | CHECKED |
| shell | reduced motion | no rail transition | recording | CHECKED |

## 47. Functional test matrix

| id | test | expected | 종료값 |
|---|---|---|---|
| WT1-F01 | `/` direct load | correct landing, no outer scroll | CHECKED |
| WT1-F01A | root hydration ownership | one html/body, no nested document elements, console error/warning 0 | CHECKED |
| WT1-F01B | landing→dashboard client navigation | document root reused, no hydration mismatch or invalid nesting | CHECKED |
| WT1-F02 | title/description verify | 지정 metadata | CHECKED |
| WT1-F03 | GLOVIS click | smooth top navigation | CHECKED |
| WT1-F04 | CTA click in landing surface | top-level KNEI dashboard | CHECKED |
| WT1-F05 | CTA keyboard Enter | same navigation | CHECKED |
| WT1-F06 | cold media load | poster precedes video | CHECKED |
| WT1-F07 | autoplay allowed | muted inline actual MP4 plays | CHECKED |
| WT1-F08 | autoplay rejected | first pointerdown retries once | CHECKED |
| WT1-F09 | second pointerdown | no repeated retry registration | CHECKED |
| WT1-F10 | video ended | no loop, no poster reset, no overlay | CHECKED |
| WT1-F11 | media decode error | poster, CTA, 표시 문구 remain | CHECKED |
| WT1-F12 | video asset absent fixture | build/test fails as P0 | CHECKED |
| WT1-F13 | 760 boundary | 지정 layout switch | CHECKED |
| WT1-F14 | 375 trust | two columns remain readable | CHECKED |
| WT1-F15 | feature cards hover | -4px and shadow only | CHECKED |
| WT1-F16 | root localStorage route=KMEI | CTA remains KNEI | CHECKED |
| WT1-F17 | dashboard no query/no storage | KNEI selected | CHECKED |
| WT1-F18 | valid URL route=KMEI | URL wins | CHECKED |
| WT1-F19 | invalid URL + valid storage | stored route wins | CHECKED |
| WT1-F20 | invalid URL + invalid storage | KNEI wins | CHECKED |
| WT1-F21 | route change | state/storage/query update | CHECKED |
| WT1-F21A | route change notification | shell과 live page consumer가 같은 route로 동기화 | CHECKED |
| WT1-F22 | Sidebar page navigation | current route retained | CHECKED |
| WT1-F23 | Sidebar brand | same-route dashboard | CHECKED |
| WT1-F24 | active page link | aria-current and active visual | CHECKED |
| WT1-F25 | desktop Sidebar hover | expands 68→244 without reflow | CHECKED |
| WT1-F26 | desktop Sidebar keyboard | focus-within expansion | CHECKED |
| WT1-F27 | mobile menu | opens 218px drawer | CHECKED |
| WT1-F28 | mobile Escape | drawer close, body 복원, trigger focus 복귀 | CHECKED |
| WT1-F28A | mobile toggle close | drawer close, body 복원, trigger focus 복귀 | CHECKED |
| WT1-F28B | mobile navigation close | route 보존, body 복원, 새 shell trigger focus 복귀 | CHECKED |
| WT1-F28C | mobile unmount | 이전 body overflow와 style attribute 정확히 복원 | CHECKED |
| WT1-F28D | desktop expansion | body scroll lock 없음 | CHECKED |
| WT1-F29 | storage unavailable | URL/fallback still works | CHECKED |
| WT1-F30 | portal fixture | box sizing/font/focus inherited explicitly | CHECKED |

## 48. Visual comparison acceptance

baseline과 candidate는 같은 viewport, DPR, zoom, font, data, scroll position을 쓴다.

video 비교는 승인된 MP4의 같은 timestamp frame을 쓴다.

volatile browser rendering 차이는 별도 mask로 기록한다.

표시 문구, logo, route, CTA, section, card boundary는 mask하지 않는다.

권장 automated gate는 SSIM 0.995 이상이다.

권장 mismatch pixel 비율은 0.5% 이하다.

24×24px보다 큰 연속 mismatch 영역은 사람이 반드시 검토한다.

header/hero 경계가 2px 이상 어긋나면 numeric score와 관계없이 fail이다.

card column 수, trust column 수, Sidebar width가 다르면 즉시 fail이다.

font fallback으로 한글 line wrap이 바뀌면 fail이다.

video frame이 다른 asset이면 비교 수치와 관계없이 fail이다.

approved accessibility focus ring은 focus-state baseline과만 비교한다.

## 49. Required evidence pack

- clean-room input register
- Figma/PNG/media owner와 rights approval record
- 승인 asset과 포함 asset의 SHA-256 비교 보고서
- 표시 문구 checklist
- candidate computed-value report
- width geometry measurement report
- approved design evidence IDs
- candidate screenshots
- visual comparison report
- five-stage video frames
- ended/autoplay-blocked recording
- route persistence recording
- Sidebar hover/focus recording
- mobile drawer recording
- mobile body-lock/close/focus-return recording
- functional test report
- browser console report
- known difference report

known difference report가 비어 있으면 `none`이라고 명시한다.

미확인 항목을 known difference로 밀어 넣지 않는다.

## 50. Self-review checklist

| review | 질문 | 종료값 |
|---|---|---|
| scope | WT1 소유와 비소유가 분리됐는가 | CHECKED |
| truth | clean-room 입력 우선순위가 지켜졌는가 | CHECKED |
| architecture | root outer/inner scroll 경계가 정확한가 | CHECKED |
| hydration | root layout만 html/body를 소유하고 nested document element가 없는가 | CHECKED |
| 표시 문구 | 모든 지정 text가 일치하는가 | CHECKED |
| rights | 모든 Figma/PNG/media의 권리와 SHA-256이 승인됐는가 | CHECKED |
| media | poster와 actual 11초 MP4가 연결됐는가 | CHECKED |
| animation | 5단계가 MP4 frame으로 검수됐는가 | CHECKED |
| states | LOADING/READY/ERROR/CACHED/EMPTY 경계가 명확한가 | CHECKED |
| desktop | 1440과 900 geometry가 맞는가 | CHECKED |
| mobile | 640과 375 geometry가 맞는가 | CHECKED |
| shell | Sidebar 68/244/218 계약이 맞는가 | CHECKED |
| route | query/storage/fallback이 맞는가 | CHECKED |
| interaction | hover/focus/click/keyboard가 맞는가 | CHECKED |
| drawer a11y | aria-expanded/body lock/Escape/focus return이 맞는가 | CHECKED |
| motion | ended/reduced-motion 경계가 맞는가 | CHECKED |
| evidence | visual comparison과 recording이 있는가 | CHECKED |
| regression | primary media EMPTY가 정상 상태로 허용되지 않는가 | CHECKED |

## 51. 최종 DONE gate

다음 조건을 전부 만족할 때만 WT1을 DONE으로 선언한다.

- visual evidence matrix의 모든 셀이 CHECKED
- functional test matrix의 모든 셀이 CHECKED
- self-review의 모든 셀이 CHECKED
- clean-room input 권리와 asset SHA-256 기록 완료
- 11초 video가 실제로 decode되고 재생됨
- five-stage frame evidence 완료
- empty primary media state가 존재하지 않음
- 1440/900/640/375 visual comparison 통과
- Sidebar 68→244 overlay 동작 통과
- mobile 218px drawer 동작 통과
- mobile drawer body lock/복원, Escape, focus return 통과
- route query/localStorage persistence 통과
- Page 2~4 담당자가 shell seam을 소비할 수 있음
- open P0 없음
- open P1 없음
- 미검증 상태를 종료 상태값으로 사용하지 않음

완료 보고에는 “대략”, “거의”, “일단”, “데모 수준”이라는 표현을 사용하지 않는다.

완료 보고는 증거 경로와 CHECKED 수를 함께 제시한다.
