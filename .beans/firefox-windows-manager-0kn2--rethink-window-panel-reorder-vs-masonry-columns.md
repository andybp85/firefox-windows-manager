---
# firefox-windows-manager-0kn2
title: Rethink window-panel reorder vs. masonry columns
status: completed
type: feature
priority: normal
created_at: 2026-07-04T20:33:02Z
updated_at: 2026-08-04T22:05:09Z
---

Exploratory. Today windows have a single linear order (persisted via sessions 'order') and the CSS multi-column masonry auto-reflows that order into columns. Dropping a window onto another sets its order neighbor, but the panel lands at its order position — which may render in a different column than where it was released (layout balances by height). Explore alternatives: (a) fixed left-to-right columns as real drop buckets (per-window column index + order), or (b) a single-column vertical list where drop position always matches exactly. Both change the masonry feel. Decide desired UX before implementing. Related: reorder-window-panels (zbtb).

Direction decided (2026-08-04): option (a) — fixed columns as real drop buckets. Brainstorming toward spec.

- [x] Clarify UX questions — responsive count as today; folding into last visible column; new windows fill shortest column; implicit migration
- [x] Propose approaches, present design — flex column containers chosen; user approved
- [x] Write spec — docs/superpowers/specs/2026-08-04-sticky-window-columns-design.md
- [x] Implementation plan — docs/superpowers/plans/2026-08-04-sticky-window-columns.md

## Summary of Changes

Implemented on branch sticky-window-columns (merged to main):

- assignColumns + moveWindowAmongColumns pure model functions (TDD, 21 tests green); reorderWindowSequence retired.
- buildModel/fetchState carry per-window col + order sessions values.
- View renders real flex columns (.window-column, data-col-index); CSS multi-column masonry removed.
- Dnd window drops target columns via insertIndexAmong; drop payload { beforeWindowId, columnIds, columnIndex, windowId }.
- persistWindowLayout snapshots the whole visible layout on any window drop, pinning unassigned windows too.
- Resize listener re-renders when the fitting column count changes (COLUMN_WIDTH 360px).
- README + CHANGELOG updated. Manual Firefox smoke test still pending (implemented remotely).
