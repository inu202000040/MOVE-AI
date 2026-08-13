# 01. Repository Structure and Ownership

상태: `CP0_DRAFT`

## 1. 목표 구조

```text
MOVE-AI/
├─ app/
│  ├─ contracts/                 # WT10: 공통 DTO·route·storage·state
│  ├─ data/
│  │  ├─ generated/             # WT6 생성 산출물, 직접 편집 금지
│  │  ├─ manifest/              # source hash·schema·capturedAt
│  │  └─ runtime/               # Gateway adapters·decoders
│  ├─ components/
│  │  └─ shell/                 # WT1: shared Shell·Sidebar·Topbar
│  ├─ freight-risk/
│  │  ├─ dashboard/             # WT2
│  │  ├─ models/                # WT3
│  │  ├─ network/               # WT4
│  │  └─ allocation/            # WT5
│  ├─ api/                      # WT6 public route handlers
│  ├─ layout.tsx                # WT1
│  └─ page.tsx                  # WT1 Landing entry
├─ public/
│  ├─ owned/                    # 권리 확인된 영상·poster·로고
│  └─ vendor/                   # 공식 package에서 재추출, license 포함
├─ inputs/
│  ├─ design/                   # Figma export·PNG manifest
│  └─ data/                     # 승인 데이터 package 또는 fetch pointer
├─ scripts/
│  ├─ generate-data/            # WT6: XLSX → canonical JSON
│  ├─ verify-inputs/            # hash·schema·provenance gate
│  └─ qa/                       # WT7·WT8·WT10
├─ tests/
│  ├─ contracts/                # WT10
│  ├─ wt1/ ... wt6/            # 각 Builder
│  ├─ visual/                   # WT7
│  └─ functional/               # WT8
├─ docs/
│  ├─ 00_ALLOWED_INPUTS.md
│  ├─ 01_REPOSITORY_STRUCTURE.md
│  ├─ 02_FROZEN_CONTRACTS_DRAFT.md
│  ├─ PROVENANCE.md
│  ├─ DATA_MANIFEST.md
│  └─ THIRD_PARTY_NOTICES.md
└─ evidence/                    # 최종 후보 SHA의 생성 증거만
```

## 2. 소유권

| 담당 | 유일한 쓰기 범위 | 의존 입력 |
|---|---|---|
| WT1 | Landing, shared Shell·Sidebar·Topbar, 공통 visual tokens | Figma·PNG, route contract |
| WT2 | Dashboard UI·chart·dialogs·news/insight client | WT1, WT3 projection, WT6 gateway |
| WT3 | Models UI·metrics·tuning·representative producer | WT1, WT6 |
| WT4 | MapLibre globe·2D fallback·network panels | WT1, WT6 catalog/gateway |
| WT5 | CVaR engine·Worker·Allocation UI·CSV | WT1, WT3 selection, WT6 snapshot |
| WT6 | source validation·data generator·gateway·API handlers | data pack·provider docs |
| WT7 | Figma/PNG visual comparison과 4 viewport evidence | WT1~WT6 candidate |
| WT8 | 기능·계산·데이터·cross-page 검사 | WT2~WT6 |
| WT9 | PASS SHA 조립·production smoke·배포 준비 | WT7·WT8 PASS |
| WT10 | scaffold·contracts·package/test manifest·독립성 검사 | CP0 contracts |

Master는 페이지 코드를 직접 수정하지 않고 계약 승인, exact SHA 확인, 병합·푸시만 담당한다.

## 3. 병렬 시작 규칙

1. 새 저장소 root commit을 만든다.
2. `00_ALLOWED_INPUTS.md`와 공통 계약을 먼저 동결한다.
3. 최소 scaffold가 typecheck 가능한 즉시 WT1~WT6 worktree를 동시에 연다.
4. WT2~WT5는 live API를 기다리지 않고 WT6가 정의한 동일 DTO fixture로 구현한다.
5. breaking contract change는 Master 승인 없이는 금지한다. optional field만 additive로 허용한다.
6. Builder는 기존 저장소나 프로토타입을 열지 않고 담당 MD·Figma/PNG·data pack·공식 문서만 사용한다.

## 4. 통합 순서

```text
WT10 scaffold/contracts
→ WT1 shared shell
→ WT6 data/gateway
→ WT3 representative/tuning
→ WT2 dashboard
→ WT4 network
→ WT5 allocation
→ WT7/WT8 final gates
→ WT9 integration/release
```

서로 파일이 겹치지 않는 기능은 순서와 무관하게 병렬 개발한다. 위 순서는 최종 조립의 semantic dependency 순서다.

## 5. 커밋 체크포인트

- `structure`: 빈 route와 page IA
- `visual`: Figma/PNG geometry와 responsive
- `core`: 페이지 핵심 기능
- `data`: fixture/gateway/storage handoff
- `states`: loading/empty/error/cached/fallback
- `qa`: browser/golden/accessibility
- `review-fixes`: P0/P1 delta만 수정

커밋 수가 적거나 많다는 사실은 독립 구현 증거가 아니다. 각 commit은 실제 작성 범위와 입력 manifest에 일치해야 한다.

