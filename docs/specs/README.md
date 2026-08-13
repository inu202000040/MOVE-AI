# MOVE-AI Worktree별 독립 구현 패킷

이 디렉터리는 승인된 기술명세·데이터팩·소유 자산만으로 빈 저장소에서 MOVE-AI를 독립 구현할 때 사용하는 작업 단위별 계약 모음이다. 목표는 기능만 흉내 낸 화면이 아니라, 동결된 정보 구조·표시 문구·수치·상호작용·시각 밀도를 충족하는 신규 구축이다.

이 문서는 실행 코드를 제공하지 않는다. 구현자는 모든 TS·TSX·CSS·HTML·테스트·생성 스크립트를 새로 작성해야 하며, 다른 애플리케이션 저장소나 배포물의 소스·번들·DOM·스타일을 구현 입력으로 사용해서는 안 된다.

### Clean-room 입력 경계

허용 입력은 다음으로 제한한다.

- 이 디렉터리의 승인된 WT 명세와 공통 계약표
- `REFERENCE_ONLY`로 등록된 승인 Figma·PNG와 그 권리·해시 manifest. rough composition과 flow 참고에만 사용한다.
- 승인된 소유 영상·로고와 그 권리·해시 manifest
- `MOVE_AI_DATA_PACK`의 승인된 데이터 파일과 API 문서
- 공식 제3자 패키지·API 문서와 해당 라이선스
- 문서에 명시된 수식·의사코드·golden 입력/출력

다음 행위는 자동 실패다.

- 기존 애플리케이션의 TS·TSX·CSS·HTML·테스트·생성 스크립트를 열거나 복사·변형하는 행위
- 기존 배포물의 JavaScript/CSS bundle을 내려받아 역추적하는 행위
- 기존 저장소·배포 사이트의 화면 캡처·DOM·computed style·영상·이미지·SVG를 디자인 또는 QA 기준으로 사용하는 행위
- 기존 snapshot·fixture·catalog·생성 JSON·테스트 golden을 입력으로 사용하는 행위
- 기존 저장소를 clone·fetch·fork·import하거나 commit·branch·patch·archive를 열람하는 행위
- 기존 파일 경로·행 번호·커밋 SHA·blob hash를 구현 기준으로 사용하는 행위
- 기존 snapshot·catalog·fixture를 복사하고 출처 표기만 바꾸는 행위
- 허용 입력 밖의 결과를 독립 구현이라고 기록하는 행위

표시 문구의 정확한 재현은 코드 복사를 뜻하지 않는다. 문구·수치·geometry는 이 명세 텍스트에서 읽고, 구현 코드는 독립적으로 작성한다.

구현과 QA의 유일한 판정 권위는 이 명세 텍스트다. Figma와 PNG는 `REFERENCE_ONLY`이며 rough composition과 flow만 참고한다. Figma/PNG와의 차이만으로 실패 또는 차단할 수 없고, pixel parity·image diff·SSIM·mismatch 비율은 구현 또는 QA 합격 기준으로 사용하지 않는다.

### 전역 document-root 계약

- 애플리케이션 최상위 root layout 한 곳만 `html`과 `body`를 렌더한다.
- 모든 하위 route/page layout은 fragment·provider·metadata만 반환하며 `html`, `head`, `body`, iframe 기반 격리 document를 만들지 않는다.
- 각 페이지는 공유 root document와 Shell 안에서 hydration되어야 한다.
- production cold load에서 `html=1`, `body=1`, nested document root 0, hydration mismatch 0을 자동 검사한다.

## 1. 문서 목록과 소유권

| 문서 | 담당 | 유일한 쓰기 범위 | 입력 생산자 | 출력 소비자 |
|---|---|---|---|---|
| `WT1_FOUNDATION_LANDING.md` | WT1 | 공통 Shell·Sidebar·Landing·공용 primitive | design owner·Master | WT2·WT3·WT4·WT5 |
| `WT2_DASHBOARD.md` | WT2 | Dashboard 화면·전용 chart/dialog/news UI | WT1·WT3·WT6 | Master·통합 Visual QA |
| `WT3_MODELS.md` | WT3 | Models 화면·평가근거·튜닝 UI·대표모델 selector·저장 생산자 | WT1·WT6 | WT2·WT5 |
| `WT4_NETWORK.md` | WT4 | MapLibre·route/port/choke/weather 시각화·panel | WT1·WT6 | Master·통합 Visual QA |
| `WT5_ALLOCATION.md` | WT5 | CVaR Worker·Allocation 화면·CSV | WT1·WT3·WT6 | Master·통합 Visual QA |
| `WT6_DATA_API.md` | WT6 | fixture/live adapter·route handler·provider·meta·snapshot/tune transport | approved data owner·Master | WT2·WT3·WT4·WT5 |

Master는 페이지 구현을 대신하지 않는다. Master는 exact SHA, 증거팩, 계약 변경, 병합 순서와 최종 배포만 관리한다.

## 2. 구현 입력 우선순위

서로 다른 허용 입력이 충돌할 때 다음 순서를 적용한다.

1. 사용자가 승인해 이 디렉터리에 반영한 최신 WT별 명세와 동결 계약
2. `MOVE_AI_DATA_PACK`과 공식 데이터 원천 문서
3. 승인된 소유 영상·로고·문구 inventory
4. 공식 제3자 패키지·API 문서
5. `REFERENCE_ONLY` 승인 Figma·PNG. rough composition과 flow 참고 전용이며 판정 권위가 아니다.

허용 입력 사이의 충돌은 Master가 결정하고 결정 ledger에 남긴다. 승인 없이 화면·계약을 축약하거나, 허용 입력 밖의 구현을 근거로 새 요구를 만들지 않는다.

### 2.1 승인 입력 manifest를 먼저 동결한다

구현 시작 전 `ALLOWED_INPUTS_MANIFEST`를 만든다. 각 항목은 다음을 가진다.

- 저장소 상대경로 또는 공식 HTTPS URL
- 종류: `spec`, `design`, `owned-asset`, `data`, `third-party-doc`, `third-party-package`
- SHA-256과 byte size(로컬 파일인 경우)
- `capturedAt`: UTC offset 포함 ISO-8601 timestamp
- `timezone`: 기본값 `Asia/Seoul`
- 소유권·라이선스·사용 승인 근거
- 생성되는 derived artifact와 재생성 명령
- secret·cache·build artifact 제외 규칙

manifest에 없는 파일은 구현 입력으로 사용할 수 없다. snapshot·catalog·fixture는 승인 데이터에서 결정론적으로 재생성하고 입력 hash와 생성기 버전을 기록한다.

## 2.2 이 패킷이 답해야 하는 질문

각 WT 문서는 빈 저장소에서 시작하는 담당자에게 다음을 순서대로 답해야 한다.

1. 작업을 시작하기 전에 어떤 명세·데이터·소유 자산을 확보해야 하는가.
2. 어떤 공통 계약이 먼저 freeze되어야 하는가.
3. 첫 commit에서 어떤 최소 구조를 만들어야 하는가.
4. 기능보다 먼저 고정해야 하는 시각 geometry와 정보구조는 무엇인가.
5. 어떤 fixture로 ready/loading/empty/error 상태를 재현하는가.
6. 어떤 순서로 기능·data·interaction을 추가하는가.
7. 동결 명세·계약과 달라지기 쉬운 지점과 금지되는 임의 해석은 무엇인가.
8. 어떤 증거가 있어야 다음 commit과 병합으로 넘어갈 수 있는가.
9. 외부 API·GPU·Worker가 실패해도 데모가 어떻게 계속 사용 가능한가.
10. 무엇이 남아 있으면 절대로 `완료`라고 말하면 안 되는가.

## 3. 정밀 구현의 의미

정밀 구현은 아래 네 계층을 모두 만족해야 한다.

### 3.1 명세 기반 시각 일치

- section 순서, 카드 개수와 배치가 같다.
- 기준 viewport에서 header·sidebar·content inset이 같다.
- 주요 heading, label, helper, badge의 computed font size·weight·line-height가 같다.
- 색상, gradient, border, radius, shadow, surface depth가 같다.
- chart plot 영역, axis, tick, legend, tooltip, empty overlay가 같은 위치와 밀도를 가진다.
- loading·ready·empty·error·cached·REFERENCE 상태 각각이 명세가 정한 시각 위계를 가진다.
- hover·focus·selected·disabled·pressed 상태를 브라우저 screenshot과 computed style로 확인한다.

시각 판정은 이 명세의 표시 문구·UI inventory·수치 geometry·computed style·상태·상호작용을 실제 브라우저 screenshot, 측정값, 녹화로 증명한다.

### 3.2 기능 일치

- 같은 control이 같은 상태 전이를 만든다.
- URL query, localStorage, page 간 handoff가 동일하다.
- modal/drawer의 열기·닫기·Escape·overlay·focus 복원 규칙이 동일하다.
- chart 확대·축소·drag·keyboard·tooltip 동작이 동일하다.
- 오류가 발생한 원인을 다른 오류로 오표기하지 않는다.

### 3.3 데이터·수치 일치

- 같은 fixture와 seed에서 화면 수치가 허용오차 안에서 같다.
- 단위, 기준일, source, estimate 여부를 바꾸지 않는다.
- null, missing, 실제 0을 구분한다.
- fixture/cached/reference 값을 LIVE로 표시하지 않는다.
- page 간 대표모델·예측·coverage·version이 조용히 다른 값으로 바뀌지 않는다.

### 3.4 운영 일치

- production build와 실제 배포 URL에서 검증한다.
- cold load와 hard reload를 포함한다.
- 지원 브라우저와 GPU capability를 명시한다.
- 외부 API·Worker·WebGL·CSP 실패 시에도 계약된 fallback을 실제 사용할 수 있다.

## 4. 금지되는 완료 판정

다음은 단독으로 완료 증거가 될 수 없다.

- typecheck 통과
- build 통과
- route가 HTTP 200을 반환함
- asset URL이 HTTP 200을 반환함
- 구현 파일에 특정 문자열이나 CSS token이 존재함
- DOM에 button·canvas·SVG가 존재함
- 가로 overflow가 없음
- fixture count가 맞음
- Node 정규식 테스트가 통과함
- 오류 카드가 표시됨

이 항목들은 필요한 하위 검증일 뿐이다. 실제 브라우저에서 명세의 표시 문구·수치 geometry·computed style·상태·상호작용을 증명하지 않았다면 시각·상호작용 PASS를 줄 수 없다.

## 5. 작업 시작 전 필수 기준 자산

각 WT는 구현 전에 다음 자료를 확보한다.

1. 1440×900 ready 브라우저 screenshot 계획
2. 375×812 ready 브라우저 screenshot 계획
3. 900×900 breakpoint smoke screenshot 계획
4. 640×900 breakpoint smoke screenshot 계획
5. loading 상태 screenshot 계획
6. empty 또는 unavailable 상태 screenshot 계획
7. error와 retry 상태 screenshot 계획
8. 주요 modal/drawer open 상태 screenshot 계획
9. hover·focus·selected 상태 screenshot 계획
10. 10~20초 상호작용 녹화
11. 동일 화면을 만드는 fixture와 입력값
12. 디자인 토큰·geometry·typography 수치표

명세에 필요한 데이터·소유 자산이 없는 상태에서 임의 구현을 시작하지 않는다. 필수 입력을 얻지 못한 상태는 `BLOCKED_INPUT`, 구현하지 못한 상태는 `INCOMPLETE`, 외부환경에 따라 달라지는 상태는 `DEPLOYMENT_DEPENDENT`로 기록한다. `REFERENCE_ONLY` Figma/PNG의 부재나 차이만으로 `BLOCKED_INPUT`을 선언하지 않는다.

## 6. 화면 캡처 파일 규칙

캡처는 아래 규칙으로 저장한다.

```text
evidence/
  wt{N}/
    baseline/
      {route}-{state}-{viewport}-{interaction}.png
    candidate/
      {route}-{state}-{viewport}-{interaction}.png
    diff/
      {route}-{state}-{viewport}-{interaction}-diff.png
    videos/
      {route}-{scenario}-{viewport}.webm
    computed/
      {route}-{state}-{viewport}.json
```

예시:

```text
KNEI-ready-1440x900-default.png
KNEI-ready-1440x900-sidebar-hover.png
KNEI-error-375x812-retry.png
KMDI-ready-900x900-dialog-open.png
```

## 7. 명세 기반 시각 증거 게이트

각 화면 셀은 다음 세 자료를 가져야 한다.

| 증거 | 필수 내용 |
|---|---|
| 명세 기대값 | 해당 표시 문구·UI inventory·수치 geometry·computed style·state·interaction 조항 |
| 브라우저 screenshot | 신규 구현의 동일 viewport·fixture·state와 스크롤 위치 |
| 런타임 증거 | geometry/computed-style 측정값과 필요한 interaction recording |

표시 문구·UI inventory·수치 geometry·computed style·state·interaction 중 명세 위반이 있으면 실패다. Figma/PNG는 baseline 또는 diff 대상으로 사용하지 않으며 그 차이만으로 실패하거나 차단하지 않는다. pixel parity·overlay/perceptual diff·SSIM·mismatch 비율은 판정에 사용하지 않는다.

### 7.1 기본 viewport 매트릭스

| 상태 | 1440×900 | 900×900 | 640×900 | 375×812 |
|---|---|---|---|---|
| initial loading | CHECKED 필요 | smoke | smoke | CHECKED 필요 |
| ready default | CHECKED 필요 | CHECKED 필요 | CHECKED 필요 | CHECKED 필요 |
| primary interaction | CHECKED 필요 | smoke | smoke | CHECKED 필요 |
| modal/drawer/panel | CHECKED 필요 | smoke | smoke | CHECKED 필요 |
| empty/unavailable | CHECKED 필요 | smoke | smoke | CHECKED 필요 |
| error/retry | CHECKED 필요 | smoke | smoke | CHECKED 필요 |

`미검증`, `코드만 확인`, `test contract만 존재`는 완료 상태가 아니다.

## 8. 기능 시나리오 게이트

모든 페이지는 최소 다음을 검증한다.

1. 직접 URL 진입
2. 새로고침
3. 다른 page에서 route query를 유지한 이동
4. localStorage가 비어 있는 clean browser
5. 유효한 저장 상태 복원
6. 손상된 저장 상태 무시
7. fixture ready
8. live ready
9. cached/reference
10. partial
11. unavailable
12. 요청 중 route 변경과 stale response 무시
13. keyboard only 흐름
14. reduced-motion
15. narrow viewport

## 9. 오류 분류 원칙

서로 다른 실패 원인을 하나의 문구로 합치지 않는다.

| 실패 계층 | 예시 | 화면 처리 원칙 |
|---|---|---|
| Capability | WebGL2 미지원, Worker 미지원 | 지원요건 설명 + 실제 usable fallback |
| Asset | JS worker, font, icon, video 누락 | 누락 자산 명시 + 안전한 대체표현 |
| Rendering | GPU context 상실, canvas init 실패 | 재초기화 + 2D/static mode 전환 |
| Network | tile/provider timeout, DNS, CORS | 마지막 정상값 또는 REFERENCE 데이터 + 재시도 |
| Data | schema invalid, unit mismatch | 데이터 사용 중단 + 진실한 오류 상태 |
| Auth | API key/permission 없음 | secret 미노출 + 기능별 unavailable |
| Compute | tuning/Worker/CVaR 실패 | 이전 결과를 새 입력처럼 보이지 않게 제거 |

오류문구에는 실제 원인과 사용자가 할 수 있는 다음 행동이 맞아야 한다.

## 10. Commit 단계

각 WT는 최소 다음 checkpoint를 별도 commit으로 남긴다.

1. `inputs`: 승인 입력 manifest·디자인 inventory·fixture 계약
2. `structure`: 동결 IA·표시 문구·section 순서
3. `visual`: tokens·geometry·responsive
4. `core`: 핵심 기능과 상태 전이
5. `data`: gateway·storage·page handoff
6. `states`: loading/empty/error/cached/fallback
7. `visual-qa`: 명세·수치 geometry·computed style·state·interaction의 브라우저 증거 기반 수정
8. `a11y`: keyboard/focus/reduced-motion
9. `qa`: 브라우저 매트릭스와 회귀 테스트
10. `review-fixes`: 교차검수 P0/P1 일괄 수정

Commit은 완료 선언이 아니다. 마지막 증거 매트릭스가 채워질 때까지 담당 WT는 계속 작업한다.

## 11. PASS 무효화 규칙

- 새 commit이 생기면 변경 영역의 기존 PASS는 자동 무효다.
- 공통 Shell·token 변경은 WT1과 모든 소비 page의 시각 PASS를 무효화한다.
- gateway schema·meta 변경은 WT6와 모든 소비 page의 기능 PASS를 무효화한다.
- representative/tuning storage 변경은 WT2·WT3·WT5 PASS를 무효화한다.
- Network catalog·weather coordinate 변경은 WT4·WT6 PASS를 무효화한다.
- CSS·문구만 변경했더라도 affected viewport 캡처는 다시 만든다.

## 12. Worktree handoff 형식

```text
status: READY_FOR_REVIEW
worktree: WT{N}
exact full SHA:
allowed inputs manifest path:
allowed inputs manifest SHA-256:
capturedAt ISO-8601 with offset:
timezone: Asia/Seoul
modified files summary:
untracked files summary:
changed files:
spec authority sections:
browser screenshots:
computed-style/geometry/state reports:
interaction recordings:
functional scenarios passed:
responsive cells: 24/24 CHECKED
browser/capability matrix:
targeted tests:
production build:
P0/P1:
P2 and approval:
deployment-dependent items:
known gaps:
```

증거가 없는 항목은 PASS가 아니라 `INCOMPLETE`다.

## 13. 최종 Definition of Done

다음이 모두 참일 때만 해당 WT를 완료로 판정한다.

- 명세 기대값, 브라우저 screenshot, 런타임 증거가 모든 필수 셀에 존재한다.
- 1440·375의 모든 필수 상태가 `CHECKED`이고 900·640 breakpoint smoke가 통과한다.
- 동결 명세와 다른 문구·정보 순서·핵심 geometry가 없다.
- 기능 시나리오가 같은 상태 전이를 만든다.
- golden fixture 수치가 허용오차 안에서 같다.
- 오류별 문구와 fallback이 실제 원인에 맞다.
- keyboard·focus·reduced-motion 검증이 끝났다.
- production deployment cold load가 통과했다.
- P0/P1이 0이다.
- 승인되지 않은 P2가 없다.
- `DEPLOYMENT_DEPENDENT`, 미검증, 코드-only 항목이 없다.
- 사용자 또는 지정 Visual QA가 명세 기반 브라우저 증거를 승인했다.

## 14. 자동 실패 조건

- Landing video·poster가 없는데 정적 fallback을 정상 완료로 인정한 것
- Network에서 WebGL2 초기화가 실패했는데 asset·catalog 테스트만으로 지도 PASS를 준 것
- Network 오류 원인을 지도 연결 실패라고 잘못 표시한 것
- 실제 2D/static map 없이 "정적 catalog가 보존된다"고 표현한 것
- 브라우저 검증을 하지 않은 상태를 timebox 사유로 병합한 것
- live tuning 전체 capability가 없는데 Models 전체 기능이 완성됐다고 표현한 것
- API fixture/reference 상태를 LIVE처럼 보이게 한 것
- 테스트 개수와 HTTP 200을 제품 완성률로 사용한 것

각 WT 문서는 위 조건을 자기 화면의 자동 실패 검사로 구체화한다. 구현 과정에서 얻은 교훈은 일반적인 오류 예방 규칙으로만 기록하며, 금지된 애플리케이션 코드·경로·SHA를 예시로 싣지 않는다.
