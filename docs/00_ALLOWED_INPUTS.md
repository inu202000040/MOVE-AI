# 00. Allowed Inputs Manifest

상태: `CP0_DRAFT`

기준일: `2026-08-13 Asia/Seoul`

이 문서는 최종 구현이 사용할 수 있는 입력을 명시한다. 목록에 없는 애플리케이션 코드·스타일·테스트·생성 산출물은 사용하지 않는다.

## 1. 디자인 입력

| 입력 | 상태 | 동결 조건 |
|---|---|---|
| Figma UI 원본 | `APPROVED_CLEAN_ROOM_V1` | `MOVE AI Clean-room UI`, file key `RvydVRm2bD59KlTzfemK7F`, [Figma 파일](https://www.figma.com/design/RvydVRm2bD59KlTzfemK7F), 실제 생성 시각과 frame ID는 `03_FIGMA_DESIGN_BASELINE.md`에 기록 |
| UI PNG exports | `APPROVED_PRIMARY_V1` | `design/exports/`의 1440×900·375×812 주 화면, Allocation drawer, runtime states, Network 2D fallback; bytes·SHA-256 동결 |
| Landing 영상·poster·로고 | `PENDING_USER_SUPPLY` | 원본 파일, 사용 권한, bytes, SHA-256 |

현재 승인된 Figma와 PNG는 `2026-08-13`에 새로 생성한 clean-room 디자인이다. 이를 과거 시각에 만들어진 파일로 소급 표기하지 않는다. 별도의 이전 디자인 파일을 추가하려면 실제 파일·버전·생성 기록을 별도 입력으로 등록해야 한다.

필수 PNG 최소 세트:

- Landing, Dashboard, Models, Network, Allocation의 `1440x900` 및 `375x812` ready 화면 — 현재 승인 완료
- `900x900`, `640x900`은 구현 후 breakpoint smoke로 검증하며 primary Figma source는 1440·375로 고정
- loading, empty/unavailable, error, 주요 modal/drawer/panel
- hover, focus, selected 상태
- Network WebGL2 3D 정상 상태와 장애 시 2D fallback

## 2. 구현 명세

다음 clean-room 문서는 WT별 정제가 완료되고 금지 참조 검사를 통과한 버전만 허용한다.

| 문서 | 상태 | SHA-256 |
|---|---|---|
| `docs/specs/README.md` 공통 운영 규칙 | `APPROVED` | `be766e2c3cc60406ad60d64e8fad9ec3c92867a8ed72a51142761b703d4aa5fd` |
| `docs/specs/WT1_FOUNDATION_LANDING.md` | `APPROVED` | `e09a7d55a11f71cee1bd7408c1531c1c57b2673964759536dccafd7333473531` |
| `docs/specs/WT2_DASHBOARD.md` | `APPROVED` | `a611a9712ede969e7e88537777983cde59c26136294dacdb6ead6baa4ce4659f` |
| `docs/specs/WT3_MODELS.md` | `APPROVED` | `702e611a4017eeb9b3a50708f2fcc31098c86a20c731cc6e4debfbf7a3f3d6c6` |
| `docs/specs/WT4_NETWORK.md` | `APPROVED` | `632790a809dbcc59944a91be8dedd696433317324019701549d6d2281da63809` |
| `docs/specs/WT5_ALLOCATION.md` | `APPROVED` | `a7e78e3e8850689216ce37966bdf53ee120d2abe166d87c63f0d073f2a8b34d5` |
| `docs/specs/WT6_DATA_API.md` | `APPROVED` | `4fca56132506218b8e8a4fe287889ad1e3eac295bce38bffa9516ea833597ef0` |

WT7 clean-room provenance/visual-input 검사와 WT8 cross-contract/data-lineage 검사는 위 exact bytes에서 모두 `P0=0, P1=0`으로 종료됐다. 문서를 수정하면 해당 SHA와 두 PASS는 즉시 무효가 된다.

허용 문서는 기능, 표시 문구, 수식, DTO, 데이터 변환 규칙, 디자인 치수, 상태 전이, acceptance 조건만 포함해야 한다. 이전 구현의 저장소명·URL·커밋·파일 경로·행 번호·파일 hash·코드 비교 지시는 포함하지 않는다.

## 3. 승인된 데이터 입력

데이터 패키지 식별자: `MOVE_AI_DATA_PACK/APP_USED_DATA`

브라우저가 XLSX를 직접 읽는 것은 금지한다. WT6 생성기가 원천을 검증하고 canonical JSON과 manifest를 만든다.

| ID | 파일 | Bytes | SHA-256 | 주요 소비자 |
|---:|---|---:|---|---|
| 00 | `00_API_CATALOG.xlsx` | 32,351 | `423544876b745a09eda602858d8659d2103a943bc7f55cda2d23790e707b71c0` | WT6 |
| 01 | `01_ROUTE_PORT_CATALOG.xlsx` | 47,539 | `baae5167e2a73cc81e4adefc57bcafaeefe5a0fb5f4297b3d730c1261a0be38a` | WT1~WT6 |
| 02 | `02_KCCI_WEEKLY.xlsx` | 155,927 | `ee03da280ab5d520f44ee738e857e382e2268648bef494f3dfff4402a116b8fd` | WT2·WT3·WT5·WT6 |
| 03 | `03_USDKRW_ECB.xlsx` | 427,569 | `54f976eec014c453ca115bf83aa12a776625b39c7238e922d498888eaef76d99` | WT2·WT6 |
| 04 | `04_BRENT_EIA.xlsx` | 99,961 | `7608b039c11fe55dd0310ba7dad5596e51846847b7a212aa8da8ba6955f3ba5e` | WT2·WT6 |
| 05 | `05_VLSFO_USDA.xlsx` | 108,429 | `2fd22fa5f47d02e7edc48b9999e377ff4d9d2a3e8e66a1d591b435480c52be37` | WT2·WT6 |
| 06 | `06_HARPEX_REFERENCE.xlsx` | 13,544 | `544302ac112733f91032bd78b254b5009c7250b6376f641c34bfe64a0d809804` | WT2·WT6 |
| 07 | `07_PORTWATCH_PORT_TRAFFIC.xlsx` | 1,616,510 | `b2bf91993b776e1a2451f5a5b3b2ca299e590527c3eb8707a6a70753c033403d` | WT4·WT6 |
| 08 | `08_PORTWATCH_CHOKEPOINT_TRAFFIC.xlsx` | 255,340 | `72a2bee17955d4a00baaa9a4930ea41b4610169940476d8dd3d4d14fbf853529` | WT4·WT6 |
| 09 | `09_WEATHER_API_REFERENCE.xlsx` | 23,546 | `2798b8ad5668f4df3a6d84306cb3ceb2ced4903842f144be8de4d420308dc87e` | WT4·WT6 |
| 10 | `10_ROUTE_NEWS_REFERENCE.xlsx` | 21,346 | `6886e9684f6297b5854c87dcbea8b9098b487df4661825add1163c6db7e23431` | WT2·WT6 |
| 11 | `11_PORTMIS_TEU_OPTIONAL.xlsx` | 11,871 | `170bcbf9a43ebc1da549ce929eaf501efe4faa0c5db3ca02e279202db913c7cf` | WT4·WT6 optional |
| 12 | `12_DATA_MANIFEST.xlsx` | 18,969 | `991690557c80d0820228f8d6c63b78c82e74677d64aa91ba1be2906b681bfa71` | WT6·QA |
| 13 | `13_MODEL_FORECAST_SNAPSHOT.xlsx` | 151,229 | `0297028336741e43cbc9820ce9d8c387d45682b68035a26cadc80cc4505e7c4c` | WT2·WT3·WT5·WT6 |
| 14 | `14_MODEL_EVALUATION.xlsx` | 2,309,944 | `3973875c93a68c430be9fa2c9d7fde1b806c1f238dde0d680bbd7396af6e8f1e` | WT2·WT3·WT5·WT6 |
| 15 | `15_MODEL_TUNING_CONFIG.xlsx` | 22,336 | `32e1d0bde567585f21ced1d1564c04da0de9613a9c9a70119b6278c552119c3a` | WT3·WT6 |
| 16 | `16_ROUTE_EVENTS_AND_CORRIDORS.xlsx` | 67,294 | `2bfe8ed28f43baf82268ae012d228c6051fb47898548a719afbcb07f3322fe02` | WT2·WT4·WT6 |
| 17 | `17_RUNTIME_PROVIDER_CATALOG.xlsx` | 23,309 | `a11e7bff4bd204eb6daeb974630cd5d57fa6f0fec13da451b2815809c4b01e7f` | WT6·QA |
| 18 | `18_CVAR_ALLOCATION_CONFIG.xlsx` | 19,735 | `9da8647b07057bee547d5b0d9c90369957b9534fa3e79f3d0b2877023b504652` | WT5·WT6 |
| 19 | `19_KCCI_ROUTE_TRENDS_REFERENCE.html` | 42,093 | `ec9c2bac58ef66c65cb4822717f064027b9d40c9586d907dcde45b58e7cddacc` | `QUARANTINED`; package inventory에만 기록하며 구현·시각 QA 입력으로 직접 열람하지 않음 |

패키지 검증 파일:

- `APP_DATA_USAGE_MANIFEST.json`: SHA-256 `47f01f91233e63a59207daf154246113a84abb1587bea168f618a83d21798e93`
- `PACKAGE_MANIFEST.json`: SHA-256 `8d35ec037144ef024ceaafbb6cf1266d6d9f74238369f9c013614c8f74825c18`
- `SHA256SUMS.txt`: SHA-256 `25f678142dce948bca64809bb7043422d0e0eddc4bff6e628877334eb8e8e2e4`

## 4. 공식 제3자 입력

- React, TypeScript, 빌드 도구: 새 저장소의 package lock으로 버전을 동결한다.
- MapLibre GL JS: 공식 npm package와 공식 문서만 사용한다. worker와 CSS는 설치된 package에서 생성하며 package bytes/hash와 라이선스를 기록한다.
- 시장·뉴스·기상·PortWatch provider: `00_API_CATALOG.xlsx`와 `17_RUNTIME_PROVIDER_CATALOG.xlsx`에 승인된 endpoint만 사용한다.
- AI insight: Gemini 또는 결정론적 rule fallback만 사용한다. OpenAI API는 사용하지 않는다.

## 5. 금지 입력

- 이전 애플리케이션 저장소와 프로토타입 저장소의 TS, TSX, CSS, HTML, JS, test, fixture, generated JSON
- 이전 저장소의 Git commit, branch, patch, cherry-pick, archive 또는 code export
- 이전 저장소나 배포 사이트의 화면 캡처, DOM, computed style, 이미지, 영상, SVG, catalog 또는 시각 비교 결과
- 이전 저장소의 clone, fetch, fork, import와 파일명·행 번호·함수 구조 열람
- 이전 소스 파일 경로·행 번호·파일 hash를 구현 지시로 사용하는 문서
- 이전 snapshot·catalog·news artifact 복사
- 비밀키, `.env.local`, model cache, dependency cache, build output

`19_KCCI_ROUTE_TRENDS_REFERENCE.html`의 허용 가능한 데이터·상호작용 요구는 승인된 WT2 명세에 독립 기술된 항목만 사용한다. HTML·CSS·JavaScript 자체는 구현 입력이 아니다.

## 6. 시작 게이트

다음 core 시작 게이트는 모두 충족됐다.

- Figma 원본과 PNG export가 실제 파일/버전으로 등록됨
- WT1~WT6 clean-room MD가 WT7 금지참조 검사 PASS
- WT1~WT6 계약이 WT8 교차검사 PASS
- 데이터 SHA-256 검증 PASS
- `02_FROZEN_CONTRACTS_DRAFT.md`의 core 계약 동결

따라서 WT1~WT6의 독립 구현을 시작할 수 있다. 단, 승인 원본이 없는 Landing 영상·poster·logo는 새로 만들거나 대체했다고 속이지 않고 placeholder로 유지하며, 해당 자산 등록 전에는 WT1 PAGE_COMPLETE와 최종 release를 선언하지 않는다.
