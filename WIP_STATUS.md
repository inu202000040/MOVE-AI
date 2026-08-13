# MOVE-AI integration WIP

This branch is a directly editable integration checkpoint. It is not a release or QA PASS.

## Source pins

| Owner | Exact source SHA | Integration status |
| --- | --- | --- |
| WT1 Landing and shared shell | `85d2d5548b2f665d3bbaa02391c834c36ec4ba21` | Assembled |
| WT6 contracts/data gateway and artifacts | `303c118f83a53eb76d430b17320d3c252c5797c4` | Assembled |
| WT2 Dashboard | `e27dce73c48c4f65cac62376ac8420a2a3ab8eb6` | Assembled WIP |
| WT3 Models | `9e3c27764e4891839cd9855c0b9df4dc1ddbb04f` | Assembled WIP |
| WT4 Network | `b918ec02b1ca3d22d47485b97013ab4c5ca07787` | Assembled WIP |
| WT5 Allocation | `47055ef7d96de45428385cd85bfff3769af3375b` | Assembled WIP |

## Confirmed P0

1. Dashboard does not yet connect the WT3 production representative source.
2. Allocation does not yet connect the WT3 production representative source.
3. Network still needs capable-WebGL2 browser evidence for its 3D path.

Release completion must not be claimed while any item above remains open.

## Known incomplete seams

- Dashboard and Allocation are editable against the assembled WT3/WT6 seams, but their production representative bindings remain follow-up work.
- Network uses the split WT6 client gateway; its usable fallback is present, while supported-WebGL2 evidence remains pending.
- Page-complete P1 work is tracked in `reports/CP2_P1_LEDGER.md` for one batch before CP2.
