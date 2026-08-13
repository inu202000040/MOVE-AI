# WT7 clean-room visual QA matrix

Status: `HARNESS_READY / PENDING_CANDIDATE`

Authority is limited to clean-room main commit `2c83561796b8014ea686db6e7a4c8a8ebd91eb8b`, Figma file `RvydVRm2bD59KlTzfemK7F`, and the approved files recorded in `qa/visual-baseline.manifest.json`. No previous application, deployment, screenshot, DOM, CSS, or repository is a comparison input.

## Baseline verification

- All 13 committed PNGs must pass PNG signature and IHDR checks.
- File byte count and SHA-256 must match the approved Figma baseline table.
- All 13 Figma node IDs must be unique, present in the approved baseline document, and have the recorded natural dimensions.
- Five page-ready baselines have direct 1440×900 and 375×812 exports.
- Allocation input, runtime states, and Network fallback are supplemental state frames.
- There is deliberately no 900×900 or 640×900 Figma export. Those sizes are breakpoint smoke checks against the approved primary layouts and WT specifications, not invented image baselines.

Run the gate with:

```text
npm run test:qa
```

## Viewport × state matrix

The harness expands five pages × six state groups × four viewports into 120 required cells.

| State group | 1440×900 | 375×812 | 900×900 | 640×900 |
|---|---|---|---|---|
| initial loading | detailed primary | detailed primary | smoke | smoke |
| ready default | detailed primary | detailed primary | smoke | smoke |
| primary interaction | detailed primary | detailed primary | smoke | smoke |
| modal/drawer/panel | detailed primary | detailed primary | smoke | smoke |
| empty/unavailable | detailed primary | detailed primary | smoke | smoke |
| error/retry | detailed primary | detailed primary | smoke | smoke |

Pages are Landing (`wt1`), Dashboard (`wt2`), Models (`wt3`), Network (`wt4`), and Allocation (`wt5`). The default deterministic route is `KNEI`. WT6 supplies state fixtures but has no standalone visual page.

Detailed primary cells require baseline, candidate, and diff evidence. Smoke cells require candidate evidence, viewport/overflow/console metrics, breakpoint assertions, and a written comparison to the approved primary composition. A smoke cell must not claim a nonexistent direct Figma PNG.

## State evidence routing

| State | Approved visual source | Required runtime proof |
|---|---|---|
| loading | runtime states frame `15:2` plus page specification | loading marker; no stale ready data |
| ready | page-specific 1440/375 frame | deterministic fixture; exact copy/order/geometry |
| empty/unavailable | runtime states frame `15:2` plus page specification | truthful state/mode; no invented data |
| error/retry | runtime states frame `15:2` plus page specification | injected failure identity; retry result |
| interaction | page frame plus approved component variants | pointer and keyboard state; focus evidence |
| modal/drawer/panel | page specification; Allocation frame `13:140` where applicable | open/close/Escape/body-lock/overflow |
| Network WebGL fallback | frame `15:41` | forced capability failure; interactive 2D continuity |

## Evidence naming

For each expanded cell, write evidence only after the candidate exact SHA is frozen:

```text
evidence/wt{N}/baseline/{route}-{state}-{viewport}-{interaction}.png
evidence/wt{N}/candidate/{route}-{state}-{viewport}-{interaction}.png
evidence/wt{N}/diff/{route}-{state}-{viewport}-{interaction}-diff.png
evidence/wt{N}/videos/{route}-{scenario}-{viewport}.webm
evidence/wt{N}/computed/{route}-{state}-{viewport}.json
```

Names use lowercase state/interaction tokens, the exact viewport token (`1440x900`, `375x812`, `900x900`, or `640x900`), and uppercase canonical route IDs. Do not create placeholder evidence files. Missing evidence remains `PENDING_CANDIDATE` or `INCOMPLETE`, never `PASS`.

## Per-cell acceptance

- Exact candidate SHA, URL, route, fixture, locale `ko-KR`, timezone `Asia/Seoul`, DPR, browser, and capability are recorded.
- Baseline and candidate use the same state and deterministic fixture.
- Copy, information order, geometry, typography, colors, state truthfulness, clipping, and overflow are reviewed.
- Pointer, keyboard, focus, Escape, navigation, storage, stale-response, and reduced-motion behaviors applicable to the cell are exercised.
- Unexpected console errors, hydration warnings, unhandled rejections, asset failures, and failed requests are zero.
- A baseline/candidate/diff trio alone does not override a functional or state mismatch.

The Landing owned video, poster, and logo remain `PENDING_USER_SUPPLY`; placeholder parity cannot be promoted to final page or release completion.
