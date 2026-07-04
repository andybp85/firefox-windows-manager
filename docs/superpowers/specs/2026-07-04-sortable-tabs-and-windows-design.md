# Sortable Tabs & Persistent Window Order — Design

**Date:** 2026-07-04
**Status:** Approved

## Goal

Two drag-and-drop capabilities in the overview:

1. **Reorder tabs within a window** (bean `l6nj`) — drag a tab tile to a new
   position in the same window. Free reorder: the drop position determines
   group membership (drop inside a group joins it, drop in loose space leaves
   it). This changes the real Firefox tab order, so it persists natively.
2. **Reorder window panels** — drag a window to a new position in the
   overview. Firefox has no native window order, so a per-window `order` value
   is stored via the sessions API (mirroring how window names persist) and
   survives browser restart through session restore.

## Non-Goals

- Unifying cross-window tab moves with the new positional/group logic.
  Cross-window drops keep today's behavior: the tab is appended, ungrouped, to
  the target window. Deferred to a follow-up.
- Reordering a whole group as a block within a window. This iteration reorders
  individual tabs only.
- Touch / pointer-based drag. Native HTML5 DnD (mouse) only, as today.

## Architecture

Unchanged one-way data flow:

```
data.js (browser read edge)
  → model.js (pure)
  → view.js (render)
  → dnd.js / actions.js (mutating edges)
  → browser events → re-render
```

All new index/order arithmetic lives in `model.js` as pure, unit-tested
functions. All browser mutations live in `actions.js`. `dnd.js` owns DOM
event wiring and translates a drop into a call to a handler supplied by
`main.js`.

## Feature 1 — Reorder tabs within a window (free)

### Drop resolution

A drop resolves to a target `(windowId, groupId, index)` where `groupId` is a
real group id or `null` (ungrouped). The DOM structure already carries the
semantics:

- Dropping over a `.group-tabs` element → `groupId` = that group's id.
- Dropping over loose `.window-body` space (not inside a `.group-tabs`) →
  `groupId` = `null` (ungroup).

The insertion index within the drop container is computed from the pointer's
Y position relative to the vertical midpoints of the sibling tab tiles in that
container (see `insertIndexAmong` below).

### Translating to a Firefox move

`browser.tabs.move(tabId, {index})` uses an absolute window-wide index. The
model already sorts tabs by `tab.index`, so the rendered order matches
Firefox's order. Given the resolved drop, `actions.js` performs:

1. If joining a group different from the tab's current group:
   `browser.tabs.group({groupId, tabIds: [tabId]})`.
2. If leaving a group (drop resolved `groupId = null` and the tab is grouped):
   `browser.tabs.ungroup([tabId])`.
3. `browser.tabs.move(tabId, {index})` to the resolved absolute index.

Group/ungroup runs before move so the tab is in the right group run, then the
move places it at the exact index. The `tabs.onMoved` / group events already
subscribed in `data.js` trigger a re-render showing the new truth.

### Pure helper (model.js)

```js
// Index (0-based) at which to insert, given the pointer Y and the tiles'
// bounding rects in a single container. Returns tiles.length to append.
export function insertIndexAmong(pointerY, rects) { ... }
```

`rects` is an array of `{top, bottom}` in DOM order. The function returns the
count of tiles whose vertical midpoint is above `pointerY`. Pure and directly
unit-testable without a DOM.

Absolute-index resolution is also pure:

```js
// Given the window model, the target container (groupId|null), and the
// within-container insert position, return the absolute Firefox tab index.
export function absoluteTabIndex(windowVM, groupId, withinIndex) { ... }
```

## Feature 2 — Reorder window panels + persist

### Persistence

Each window stores an integer `order` via
`browser.sessions.setWindowValue(windowId, "order", i)`. This is the same
per-window persistence used for names and carries the same guarantee: values
survive a browser restart because session restore remaps them to the restored
window.

On any window reorder, `actions.js` reassigns a **dense** `0..n-1` order across
all windows in their new sequence and persists each. Dense (rather than sparse)
keeps ordering predictable and avoids drift.

### Reading & sorting

- `data.js` reads `order` alongside `name` for each window and passes an
  `orders` map into `buildModel`.
- `model.js` sorts windows: those with a stored `order` first, ascending by
  `order`; windows without one (brand-new) after, ascending by window id, so a
  newly opened window appears at the end until the user places it.

```js
// Pure: stable sort of window models by stored order, unordered last by id.
export function sortWindowsByOrder(modelWindows, orders) { ... }
```

### Interaction

- Each window header gains a grip handle (`⠿`, class `.window-drag-handle`) at
  its left. Dragging starts a **window** drag. The handle is visually and
  semantically distinct from the dblclick-to-rename name and from tab tiles.
- Dragging a window over another window marks that window as the insertion
  point. Drop places the dragged window immediately before the target (or after
  it if the pointer is in the target's lower half). The multi-column masonry
  layout reflows to the new order; a target-window highlight is sufficient — no
  pixel-precise indicator is needed because only the resulting order matters.

## DnD refactor (supporting both features)

`dnd.js` currently stores the drag kind as a data *value*
(`setData("application/x-kind", ...)`). Data values are not readable during
`dragover` (only the *types* are), so `dragover` cannot currently tell a
window drag from a tab drag. Fix: encode the kind in the MIME **type**:

- `application/x-fwm-tab`
- `application/x-fwm-group`
- `application/x-fwm-window`

with the element id as the value. During `dragover`, `event.dataTransfer.types`
reveals which kind is in flight, so the handler can choose the correct drop
target (tab position vs. window position) and highlight accordingly.

New DOM affordances:

- A drop-indicator line element inserted between tiles during a tab dragover.
- The `.window-drag-handle` grip in each window header.

Handler surface passed from `main.js` to `attachDnd` gains:

- `onReorderTab(tabId, windowId, groupId, withinIndex)` — intra-window reorder.
- `onReorderWindow(windowId, beforeWindowId | null)` — place a window before
  another (or at end when `null`).

Existing handlers (`onDropTab`, `onDropGroup`, `onDropTabNewWindow`,
`onDropGroupNewWindow`) are unchanged.

## Error handling

Every action is invoked through the existing `run()` wrapper in `main.js`,
which shows a toast on failure and logs to the console. Because rendering is
driven by browser events, a failed mutation simply leaves the last-known truth
on screen after the next event fires. No optimistic DOM mutation is performed —
the browser event is the single source of truth, as today.

## Testing

Pure `model.js` helpers get `node:test` unit tests:

- `insertIndexAmong` — pointer above all / below all / between midpoints;
  empty container returns 0.
- `absoluteTabIndex` — into a group at start/middle/end; into ungrouped space;
  window with and without groups.
- `sortWindowsByOrder` — all ordered; none ordered (falls back to id); mixed
  (unordered windows sort last by id); stability.

DnD wiring and visuals are verified through the existing Playwright render
harness (`scratchpad/shoot.mjs`), extended with the grip handle and a couple of
reordered windows/tabs.

## File touch list

- `src/model.js` — add `insertIndexAmong`, `absoluteTabIndex`,
  `sortWindowsByOrder`; apply the sort in `buildModel`.
- `src/data.js` — read per-window `order`; pass `orders` to `buildModel`.
- `src/actions.js` — add `reorderTab`, `reorderWindow`.
- `src/dnd.js` — MIME-type kinds, position detection, drop indicator, window
  handle + window drop targets, new handlers.
- `src/view.js` — render `.window-drag-handle` grip in window headers.
- `dashboard.css` — grip, drop-indicator line, window drop-target highlight.
- Tests alongside `model.js`.
