# 03. Figma Design Baseline

상태: `REFERENCE_ONLY`

이 파일은 2026-08-13에 기능 명세만으로 제작한 초기 시각 가안의 사실 기록이다. 구성과 화면 흐름을 이해하는 선택 참고자료이며 최종 디자인·기능·로직 계약은 아니다. 삭제하거나 승인된 완성 디자인으로 다시 표기하지 않는다.

기록 시각: `2026-08-13T13:16:12+09:00`

## 1. 파일 식별자

- 이름: `MOVE AI Clean-room UI`
- Figma file key: `RvydVRm2bD59KlTzfemK7F`
- URL: <https://www.figma.com/design/RvydVRm2bD59KlTzfemK7F>
- 제작 입력: 승인된 clean-room 구현 명세, 동결 계약, 승인 데이터팩
- 제외 입력: 이전 애플리케이션 저장소·배포 사이트·프로토타입의 코드, CSS, DOM, 화면 캡처, Git history

이 파일은 위 기록 시각에 새로 만든 초기 가안이다. 과거 시각에 제작된 파일로 소급 표기하지 않으며, 현재 구현 기준은 승인된 `docs/specs/`의 clean-room 계약이다.

## 2. Foundations

- 변수 컬렉션 4개
- 변수 55개: Primitives 16, Semantic 24, Spacing 10, Radius 5
- Noto Sans KR text styles 8개
- elevation styles 2개
- 제품 TEXT node의 missing font 0건
- 제품 TEXT node의 비-Noto Sans KR font 0건

## 3. 공용 컴포넌트

| 컴포넌트 | Figma node ID | 계약 |
|---|---|---|
| `DataBadge` | `4:33` | LIVE, CACHED, REFERENCE, UNAVAILABLE |
| `Button` | `4:66` | Medium/Large × Primary/Secondary × Default/Hover/Disabled |
| `Card` | `5:17` | Default/Brand × Default/Hover |
| `Sidebar` | `6:198` | Desktop collapsed/expanded, mobile drawer, 4 active pages |
| `WorkspaceHeader` | `6:213` | Desktop/Mobile, editable title/context/route |

## 4. 구현 화면 프레임

| 페이지 | Desktop / 보조 | Mobile | 주요 내용 |
|---|---|---|---|
| Landing | `7:2` · 1440×900 | `7:36` · 375×812 | hero, CTA, owned-media placeholder, capability cards |
| Dashboard | `8:2` · 1440×900 | `8:91` · 375×812 | KCCI/대표모델, 1–4주, 시장지표, 뉴스·자동설명 |
| Models | `11:2` · 1440×900 | `11:96` · 375×812 | 8개 모델 차트, 52회 평가, 대표모델, 튜닝 진입 |
| Network | `12:2` · 1440×900 | `12:75` · 375×812 | WebGL2 3D globe 정상안, 항로·항만·초크·기상, detail panel |
| Allocation | `13:2` · 1440×900 | `13:84` · 375×812 | 입력 summary, 13/87 권고, range chart, CVaR spectrum |
| Allocation input | `13:140` · 640×812 | — | 항로, horizon, FEU, fixed rate, risk profile, 1–4주 전망 |
| Runtime states | `15:2` · 1440×900 | — | loading, empty, error, unavailable, cached, reference |
| Network fallback | — | `15:41` · 375×812 | WebGL 장애 전용 interactive 2D fallback |

## 5. PNG export manifest

모든 파일은 이 Figma 가안의 해당 frame을 직접 export한 신규 산출물이다. 구도 참고로만 사용할 수 있고 pixel parity 기준이나 필수 acceptance로 사용하지 않는다.

| 파일 | Bytes | SHA-256 |
|---|---:|---|
| `allocation-1440x900.png` | 151,927 | `4f47757227072064e180838f9cc1e464c6bac61d4537a659be687ef61cc34e96` |
| `allocation-375x812.png` | 43,886 | `dd3a7eced66e4a3e0e8c41554efd9bdb9a39c8465ef67b998d1bd694807d8ad1` |
| `allocation-data-input-640x812.png` | 105,974 | `ecc3fc3f40cef3031a239ab883f4088bce192b2686475422944938e16afc2907` |
| `dashboard-1440x900.png` | 147,228 | `5bc61ed4adb9b598be48fbf8f228b487dfb3aa0e5b86877a1c00fd9f4a26c5a5` |
| `dashboard-375x812.png` | 39,452 | `8e0b6840b287b7a791ef4aa16b56f3edadbd1c2464324c8be3b73a3220d7295b` |
| `landing-1440x900.png` | 61,605 | `4693cf741eebfe24de320f4248eee29f327438d7459cbb4cc52f5be00f9a2af5` |
| `landing-375x812.png` | 27,294 | `5b35c0403a46f1e79962cbee4573f20ebd1429890ff15005837ac71c7884ae66` |
| `models-1440x900.png` | 136,417 | `b9420b17db20c407636bfaeb6fa0f3c394f65d267aac2a977965d97f12628019` |
| `models-375x812.png` | 51,490 | `7c47a76b1f1ae5ed5f177149b99afa0aa36e8f1fe28ef9e0e010390a270eccfa` |
| `network-1440x900.png` | 472,709 | `9e6c14eace01ceb074d0e46fb278dbca60bf32693d083215559e526fa904fa79` |
| `network-375x812.png` | 187,442 | `1a34e591527fa83e9ed7088eb7853b09d360566ab62532e4ea37a0e87c9c897d` |
| `network-fallback-375x812.png` | 43,056 | `2b8a6b3ac0d9661a4b087005b381f45a1a8a4de1ead7316445079312216abb69` |
| `runtime-states-1440x900.png` | 123,713 | `4d23f834cd79f343b5df1e6ac93026b4fb7d30f969a117a2688dbd9c435e8dc7` |

## 6. 참고 범위와 우선순위

- 모든 frame과 PNG는 `REFERENCE_ONLY`다.
- 구현자는 구도와 흐름만 참고하며 그대로 복제하지 않는다.
- Figma에 없는 카드·차트·KPI·상태·상호작용도 `docs/specs`가 요구하면 반드시 구현한다.
- Figma와 `docs/specs`가 다르면 `docs/specs`가 우선하며, Figma 불일치만으로 WT7이 실패 판정을 내리지 않는다.
- 보이는 결과를 포함한 최종 구현·QA 기준은 승인된 `docs/specs/`의 clean-room 계약이다.

- Landing 11초 실제 영상·poster·logo는 소유 자산을 받기 전까지 Figma와 PNG에서 명시적 placeholder다.
- 900px·640px은 텍스트 계약에 따라 구현 단계 breakpoint smoke로 검증한다.
