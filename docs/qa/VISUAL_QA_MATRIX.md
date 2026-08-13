# WT7 clean-room visual QA matrix

Status: `HARNESS_READY / PENDING_CANDIDATE`

## Authority and decision rule

The approved `docs/specs/README.md` and `docs/specs/WT1_FOUNDATION_LANDING.md` through `WT6_DATA_API.md` are the normative visual and UX contract. Candidate PASS or FAIL is decided from those documents and exact-SHA browser evidence.

The Figma file `RvydVRm2bD59KlTzfemK7F` and all 13 committed PNG exports are `REFERENCE_ONLY`. They may help reviewers understand rough composition and flow, but they are not pixel-parity authority, mandatory acceptance evidence, or a substitute for required content. A mismatch with Figma alone is never a finding, and a Figma revision never blocks builders or QA.

The removed `MOVE_AI_IMPLEMENTATION_SPECS` overlay is not an authority. Any later text overlay remains audit-pending and cannot become the sole basis for PASS or FAIL.

No previous application, deployment, screenshot, DOM, CSS, source, test, or repository is a comparison input.

## Required evaluation dimensions

Every candidate is evaluated against the owning WT specification in all seven dimensions:

| Dimension | Required review |
|---|---|
| structure | specified section order, hierarchy, shared shell, and page composition |
| information density | enterprise decision-workbench density; no sparse or decorative substitution for required information |
| required UI | exact required cards, charts, KPIs, tables, labels, controls, dialogs, drawers, and panels |
| states | loading, ready, empty, error, unavailable, stale/cache/reference, and capability states applicable to the page |
| interactions | pointer, keyboard, focus, Escape, navigation, storage, retry, stale-response, pan/zoom, and selection behavior as specified |
| responsiveness | 1440x900 and 375x812 primary review; 900x900 and 640x900 breakpoint/overflow smoke |
| concept tokens | specified palette, depth, radii, typography, surfaces, inset/raised controls, tooltip treatment, and page-specific visual language |

Workspace pages must express the documented dense enterprise freight decision workbench and soft-neumorphic physical depth: `#f1f2f9` canvas, navy `#001290`, cobalt `#15269d`, cyan `#3fa1eb`, raised dual blue/white shadows, inset controls, 18px cards, and dark navy/cyan tooltips where the owning specification calls for them. Landing is a separate white/blue corporate marketing surface with a dark cinematic hero. Flat minimalism or missing information is a finding only when it violates these MD contracts, never merely because it differs from Figma.

## Contract routing

| Page / data owner | Normative contract | Browser route |
|---|---|---|
| Landing and shared shell (WT1) | `docs/specs/WT1_FOUNDATION_LANDING.md` | `/` plus shared workspace navigation |
| Dashboard (WT2) | `docs/specs/WT2_DASHBOARD.md` | `/freight-risk/dashboard?route=KNEI` |
| Models (WT3) | `docs/specs/WT3_MODELS.md` | `/freight-risk/models?route=KNEI` |
| Network (WT4) | `docs/specs/WT4_NETWORK.md` | `/freight-risk/network?route=KNEI` |
| Allocation (WT5) | `docs/specs/WT5_ALLOCATION.md` | `/freight-risk/allocation?route=KNEI` |
| Fixtures, API truth, cache, and runtime states (WT6) | `docs/specs/WT6_DATA_API.md` | consumed by WT1-WT5; no standalone visual page |

`docs/specs/README.md` applies to every row.

## Reference asset integrity

- All 13 committed reference PNGs retain their PNG signature, natural dimensions, byte count, SHA-256, and unique Figma node ID.
- Five page-ready references have 1440x900 and 375x812 exports. Allocation input, runtime states, and Network fallback have extra reference frames.
- There is no 900x900 or 640x900 Figma export. Those sizes are breakpoint smoke checks against the MD contracts, not invented image baselines.
- Reference integrity proves provenance only; it does not grant visual authority or require a pixel diff.

Run the QA-owned gate directly, without changing WT10-owned package scripts:

```text
npx tsx --test tests/qa/**/*.test.ts
```

## Viewport x state matrix

The harness expands five pages x six state groups x four viewports into 120 required cells.

| State group | 1440x900 | 375x812 | 900x900 | 640x900 |
|---|---|---|---|---|
| initial loading | detailed primary | detailed primary | smoke | smoke |
| ready default | detailed primary | detailed primary | smoke | smoke |
| primary interaction | detailed primary | detailed primary | smoke | smoke |
| modal/drawer/panel | detailed primary | detailed primary | smoke | smoke |
| empty/unavailable | detailed primary | detailed primary | smoke | smoke |
| error/retry | detailed primary | detailed primary | smoke | smoke |

Detailed primary cells require exact-SHA candidate screenshots, applicable video/computed evidence, browser interaction results, and a written MD-contract assessment. Smoke cells require candidate evidence, viewport/overflow/console metrics, breakpoint assertions, and state continuity. Figma reference images and pixel diffs are optional diagnostics at every size.

## State evidence routing

| State | Normative source | Required runtime proof | Optional rough reference |
|---|---|---|---|
| loading | owning page spec plus WT6 | loading marker; no stale ready data | runtime frame `15:2` |
| ready | owning page spec plus WT6 fixture contract | deterministic fixture; exact required copy, order, cards, charts, KPIs, and geometry | page 1440/375 frame |
| empty/unavailable | owning page spec plus WT6 truth rules | truthful state/mode; no invented data | runtime frame `15:2` |
| error/retry | owning page spec plus WT6 error rules | injected failure identity; scoped retry result | runtime frame `15:2` |
| interaction | owning page interaction contract | pointer and keyboard state; focus evidence | page/component frame |
| modal/drawer/panel | owning page and WT1 shell contracts | open/close/Escape/body-lock/focus/overflow | Allocation frame `13:140` where useful |
| Network renderer/fallback | WT4 plus WT6 catalog/state contracts | capable 3D globe and forced-failure interactive 2D continuity | fallback frame `15:41` |

## Evidence naming

Write evidence only after the candidate exact SHA is frozen:

```text
evidence/wt{N}/candidate/{route}-{state}-{viewport}-{interaction}.png
evidence/wt{N}/videos/{route}-{scenario}-{viewport}.webm
evidence/wt{N}/computed/{route}-{state}-{viewport}.json
```

Optional Figma reference copies and diagnostic diffs, when useful, use:

```text
evidence/wt{N}/reference/{route}-{state}-{viewport}-{interaction}.png
evidence/wt{N}/diff/{route}-{state}-{viewport}-{interaction}-diff.png
```

Names use lowercase state/interaction tokens, the exact viewport token (`1440x900`, `375x812`, `900x900`, or `640x900`), and uppercase canonical route IDs. Do not create placeholder evidence files. Missing required candidate/browser evidence remains `PENDING_CANDIDATE` or `INCOMPLETE`, never `PASS`. Missing optional Figma/diff evidence cannot fail a cell.

## Per-cell acceptance

- Record exact candidate SHA, URL, route, fixture, locale `ko-KR`, timezone `Asia/Seoul`, DPR, browser, and capability.
- Review all seven dimensions against the owning MD contract and cite the relevant requirement for every P0/P1.
- Exercise all applicable pointer, keyboard, focus, Escape, navigation, storage, stale-response, retry, and reduced-motion behavior.
- Require zero unexpected console errors, hydration warnings, unhandled rejections, asset failures, and failed requests.
- Treat Figma only as optional composition/flow context. A Figma-only mismatch is not reportable, and similarity to Figma cannot override a missing required card, chart, KPI, state, interaction, responsive behavior, or concept token.

The Landing owned video, poster, and logo remain `PENDING_USER_SUPPLY`; placeholder parity cannot be promoted to final page or release completion.
