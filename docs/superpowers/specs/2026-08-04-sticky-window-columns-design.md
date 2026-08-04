# Sticky Window Columns — Design

Date: 2026-08-04
Bean: `firefox-windows-manager-0kn2`
Status: approved

## Problem

Window panels flow through CSS multi-column masonry (`columns: 340px`), which balances by height.
Windows have one linear `order` (a `sessions` window value), so a panel dropped in one column can
re-pack into another after the model re-renders. The drop point and the landing point disagree.

## Goal

Columns become real drop buckets. A window stays in the column you drop it in, at the vertical
position you drop it at, across re-renders and restarts. The responsive feel is kept: column count
still follows viewport width, with no new settings UI.

## Non-goals

- Kanban-style user-created columns or a fixed user-chosen column count.
- Persisting per-viewport layouts. One assignment is stored; narrow viewports fold it.
- Changing tab/group drag-and-drop, which already works within window panels.

## Storage

Two `sessions` window values per window:

- `col` (new, integer ≥ 0) — the column the user assigned the window to. Absent until the user
  first drags the window.
- `order` (existing, integer ≥ 0) — reinterpreted as position within the window's column. Legacy
  single-sequence values migrate implicitly; no data rewrite.

`src/data.js` fetches `col` per window alongside the existing `name` and `order` reads.

## Model (`src/model.js`, pure)

New `assignColumns(modelWindows, visibleCount)` returns an array of `visibleCount` column arrays:

1. Clamp: a window with `col >= visibleCount` folds into the last visible column. Folded and native
   occupants of a column sort together by `(col, order, id)`.
1. Unassigned windows (no `col` — including all pre-migration windows, in legacy `order` sequence)
   fill the currently shortest column. Column height is estimated purely as
   `HEADER_COST + tabCount` per window, so the function stays testable without DOM measurement.
1. Deterministic: same inputs, same layout. Nothing is written to `sessions` until a drag.

`buildModel` output adds `col` per window (from the session value, else `undefined`).

## View (`src/view.js`)

`render(model, { columnCount })` wraps panels in `columnCount` `.window-column` flex children
inside `.windows-grid` (flex row replaces CSS `columns`). Panel and drip-skirt styling unchanged.
Empty columns render as drop targets with a min-height.

## Drag and drop (`src/dnd.js`)

A window drag targets a `.window-column`; `insertIndexAmong` (already used for tab tiles) resolves
the vertical slot from panel midpoints. The drop reports `{ columnIndex, beforeWindowId,
orderedIds }` where `orderedIds` is the target column's current sequence.

## Actions (`src/actions.js`)

`reorderWindow` becomes column-aware: write `col = columnIndex` for the moved window, then
re-sequence `order` (0..n) for the target column via `reorderWindowSequence`, and compact the
source column's `order` values when the window changed columns. Drops made on a narrow (folded)
viewport write the folded position as seen — last visible column index, not the stored one.

## Main (`src/main.js`)

A debounced resize listener recomputes `columnCount = max(1, floor(gridWidth / COLUMN_WIDTH))`
(`COLUMN_WIDTH` ≈ 340px + gap, one constant) and re-renders when the count changes.

## Errors

Session reads already default safely (`typeof order === "number"`); `col` follows the same guard.
A failed write surfaces through the existing `run()` toast path.

## Testing (`test/model.test.js`)

Unit tests for `assignColumns`: clamping/folding order, shortest-column fill for unassigned
windows, mixed assigned/unassigned, determinism, `visibleCount: 1`. Per-column re-sequencing
reuses `reorderWindowSequence`, which keeps its existing tests.

## Docs

README: replace the "may re-pack into a different column" caveat with the sticky-column behavior
and the narrow-viewport folding rule. CHANGELOG: minor (user-visible behavior change).
