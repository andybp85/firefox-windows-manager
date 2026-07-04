# Sortable Tabs & Persistent Window Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-reorder tabs within a window (free reorder, drop position sets group membership) and drag-to-reorder window panels with an order that persists across restart.

**Architecture:** Extend the existing one-way flow — pure index/order math in `model.js` (unit-tested), browser mutations in `actions.js`, DOM/DataTransfer wiring in `dnd.js`. Window order persists per-window via the sessions API, exactly as window names already do. Native HTML5 drag-and-drop only; zero runtime dependencies.

**Tech Stack:** Firefox WebExtensions MV3, vanilla ES modules, `node:test` for pure-function unit tests, Playwright (scratchpad) for visual verification.

## Global Constraints

- Firefox-only MV3, `strict_min_version` 139.0; no runtime dependencies (prefer the platform).
- Match existing code style: **semicolons**, 4-space indent, ≤140-column lines.
- Pure logic lives in `src/model.js` and is unit-tested; browser mutations live in `src/actions.js`; DOM events live in `src/dnd.js`.
- Persist window order via `browser.sessions.setWindowValue(windowId, "order", i)` — same mechanism as window names.
- Drag "kind" is carried in the DataTransfer **MIME type** (`application/x-fwm-tab` / `-group` / `-window`), because only `dataTransfer.types` (not values) is readable during `dragover`.
- Cross-window tab moves keep today's behavior: append to the target window, ungrouped. Do **not** change this.
- `src/actions.js` and `src/dnd.js` are browser edges with no automated tests (no DOM in the `node:test` env). Their correctness rests on the unit-tested pure helpers they call, code review, and the Playwright render. This is intentional and consistent with the existing codebase.

---

### Task 1: Pure tab-position helpers

**Files:**
- Modify: `src/model.js` (add two exported functions)
- Test: `test/model.test.js` (add tests + extend import line)

**Interfaces:**
- Produces:
  - `insertIndexAmong(pointerY: number, rects: {top:number,bottom:number}[]) => number` — 0-based insert position: the count of rects whose vertical midpoint is above `pointerY`. `rects` are in DOM order. Returns `rects.length` to append; `0` for an empty list.
  - `absoluteTabIndex(orderedIds: number[], movedId: number, beforeId: number|null) => number` — the index to pass to `browser.tabs.move`. Computed on the list with `movedId` removed (move = remove-then-insert): the position of `beforeId`, or the list length when `beforeId` is `null` or not present.

- [ ] **Step 1: Extend the import line in the test file**

In `test/model.test.js`, replace the import on line 3:

```js
import { hostOf, buildModel, deriveCounts, allTabsOf, tabsToUnloadAllButActive, insertIndexAmong, absoluteTabIndex } from "../src/model.js";
```

- [ ] **Step 2: Write the failing tests**

Append to `test/model.test.js`:

```js
test("insertIndexAmong counts tiles whose midpoint sits above the pointer", () => {
    const rects = [
        { top: 0, bottom: 20 },   // midpoint 10
        { top: 20, bottom: 40 },  // midpoint 30
        { top: 40, bottom: 60 },  // midpoint 50
    ];
    assert.equal(insertIndexAmong(5, rects), 0);    // above all midpoints
    assert.equal(insertIndexAmong(25, rects), 1);   // between 1st and 2nd
    assert.equal(insertIndexAmong(45, rects), 2);   // between 2nd and 3rd
    assert.equal(insertIndexAmong(100, rects), 3);  // below all midpoints -> append
    assert.equal(insertIndexAmong(10, []), 0);      // empty container
});

test("absoluteTabIndex targets the position before the reference, minus the moved tab", () => {
    const ids = [1, 2, 3, 4];
    assert.equal(absoluteTabIndex(ids, 2, 4), 2);    // rest [1,3,4]: before 4 -> 2
    assert.equal(absoluteTabIndex(ids, 4, 2), 1);    // rest [1,2,3]: before 2 -> 1
    assert.equal(absoluteTabIndex(ids, 2, null), 3); // append -> rest length 3
    assert.equal(absoluteTabIndex([1, 2, 3], 1, 99), 2); // unknown ref -> append
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/model.test.js`
Expected: FAIL — `insertIndexAmong is not a function` / `absoluteTabIndex is not a function`.

- [ ] **Step 4: Implement the helpers**

Append to `src/model.js`:

```js
export function insertIndexAmong(pointerY, rects) {
    return rects.filter((r) => (r.top + r.bottom) / 2 < pointerY).length;
}

export function absoluteTabIndex(orderedIds, movedId, beforeId) {
    const rest = orderedIds.filter((id) => id !== movedId);
    if (beforeId == null) {
        return rest.length;
    }
    const i = rest.indexOf(beforeId);
    return i === -1 ? rest.length : i;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/model.test.js`
Expected: PASS (all existing + 2 new tests).

- [ ] **Step 6: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "feat: pure helpers for tab drop position and move index"
```

---

### Task 2: Pure window-order helpers

**Files:**
- Modify: `src/model.js` (add two exported functions)
- Test: `test/model.test.js` (add tests + extend import line)

**Interfaces:**
- Produces:
  - `sortWindowsByOrder(modelWindows: {id:number}[], orders: Record<number, number|undefined>) => same[]` — returns a new array sorted ascending by stored order; windows without a numeric order sort last, ascending by id.
  - `reorderWindowSequence(orderedIds: number[], movedId: number, beforeId: number|null) => number[]` — the new id sequence after moving `movedId` to just before `beforeId` (or to the end when `beforeId` is `null` or absent).

- [ ] **Step 1: Extend the import line in the test file**

In `test/model.test.js`, replace the import (now line 3, updated in Task 1):

```js
import { hostOf, buildModel, deriveCounts, allTabsOf, tabsToUnloadAllButActive, insertIndexAmong, absoluteTabIndex, sortWindowsByOrder, reorderWindowSequence } from "../src/model.js";
```

- [ ] **Step 2: Write the failing tests**

Append to `test/model.test.js`:

```js
test("sortWindowsByOrder orders by stored order, unordered windows last by id", () => {
    const mk = (id) => ({ id, name: null, groups: [], ungrouped: [], tabCount: 0 });
    const ws = [mk(10), mk(20), mk(30)];
    assert.deepEqual(sortWindowsByOrder(ws, { 10: 2, 20: 0, 30: 1 }).map((w) => w.id), [20, 30, 10]);
    assert.deepEqual(sortWindowsByOrder(ws, {}).map((w) => w.id), [10, 20, 30]);
    assert.deepEqual(sortWindowsByOrder(ws, { 30: 0 }).map((w) => w.id), [30, 10, 20]);
});

test("reorderWindowSequence moves a window before another or to the end", () => {
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 10, 30), [20, 10, 30]);
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 30, null), [10, 20, 30]);
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 20, 10), [20, 10, 30]);
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 30, 99), [10, 20, 30]); // unknown ref -> end
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/model.test.js`
Expected: FAIL — `sortWindowsByOrder is not a function` / `reorderWindowSequence is not a function`.

- [ ] **Step 4: Implement the helpers**

Append to `src/model.js`:

```js
export function sortWindowsByOrder(modelWindows, orders) {
    return modelWindows
        .map((w) => ({ w, order: typeof orders[w.id] === "number" ? orders[w.id] : Infinity }))
        .sort((a, b) => a.order - b.order || a.w.id - b.w.id)
        .map((keyed) => keyed.w);
}

export function reorderWindowSequence(orderedIds, movedId, beforeId) {
    const rest = orderedIds.filter((id) => id !== movedId);
    if (beforeId == null || !rest.includes(beforeId)) {
        return [...rest, movedId];
    }
    const i = rest.indexOf(beforeId);
    return [...rest.slice(0, i), movedId, ...rest.slice(i)];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/model.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "feat: pure helpers for window sort and reorder sequence"
```

---

### Task 3: Apply window order in the model and read it from sessions

**Files:**
- Modify: `src/model.js` (`buildModel` signature + sort)
- Modify: `src/data.js` (`fetchState` reads per-window `order`)
- Test: `test/model.test.js` (add one test)

**Interfaces:**
- Consumes: `sortWindowsByOrder` (Task 2).
- Produces: `buildModel(windows, tabs, groups, names = {}, orders = {})` — now sorts the returned windows by stored order. `orders` maps windowId → integer order (or `undefined`).

- [ ] **Step 1: Write the failing test**

Append to `test/model.test.js`:

```js
test("buildModel sorts windows by stored order", () => {
    const windows = [win(1), win(2), win(3)];
    const tabs = [tab(10, 1), tab(20, 2), tab(30, 3)];
    const model = buildModel(windows, tabs, [], {}, { 1: 2, 2: 0, 3: 1 });
    assert.deepEqual(model.windows.map((w) => w.id), [2, 3, 1]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/model.test.js`
Expected: FAIL — windows come back in `[1, 2, 3]` order (no sort applied yet).

- [ ] **Step 3: Update `buildModel`**

In `src/model.js`, change the signature and the return. Replace:

```js
export function buildModel(windows, tabs, groups, names = {}) {
```

with:

```js
export function buildModel(windows, tabs, groups, names = {}, orders = {}) {
```

Then replace the final return statement:

```js
    return { windows: modelWindows, counts: deriveCounts(modelWindows) };
```

with:

```js
    const ordered = sortWindowsByOrder(modelWindows, orders);
    return { windows: ordered, counts: deriveCounts(ordered) };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/model.test.js`
Expected: PASS.

- [ ] **Step 5: Read `order` in `fetchState`**

In `src/data.js`, replace the names block:

```js
    const names = {};
    await Promise.all(
        windows.map(async (w) => {
            names[w.id] = (await browser.sessions.getWindowValue(w.id, "name")) || null;
        }),
    );

    return buildModel(windows, tabs, groups, names);
```

with:

```js
    const names = {};
    const orders = {};
    await Promise.all(
        windows.map(async (w) => {
            const [name, order] = await Promise.all([
                browser.sessions.getWindowValue(w.id, "name"),
                browser.sessions.getWindowValue(w.id, "order"),
            ]);
            names[w.id] = name || null;
            orders[w.id] = typeof order === "number" ? order : undefined;
        }),
    );

    return buildModel(windows, tabs, groups, names, orders);
```

- [ ] **Step 6: Verify the whole suite passes**

Run: `node --test`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/model.js src/data.js test/model.test.js
git commit -m "feat: sort overview windows by persisted order"
```

---

### Task 4: Reorder actions (browser edges)

**Files:**
- Modify: `src/actions.js` (add `reorderTab`, `reorderWindow`; extend the model import)

**Interfaces:**
- Consumes: `absoluteTabIndex`, `reorderWindowSequence` (Tasks 1-2).
- Produces:
  - `reorderTab({ orderedIds, tabId, fromGroupId, toGroupId, beforeId }) => Promise<void>` — joins/leaves the target group only when it changes, then moves the tab to the computed absolute index.
  - `reorderWindow(orderedIds, windowId, beforeWindowId) => Promise<void>` — computes the new dense order sequence and persists each window's index via `sessions.setWindowValue(id, "order", i)`.

No automated test (browser edge — see Global Constraints). The index math is covered by Task 1/2 tests; group/move sequencing is verified by review and the user's manual Firefox smoke test.

- [ ] **Step 1: Extend the model import**

In `src/actions.js`, replace line 1:

```js
import { tabsToUnloadAllButActive } from "./model.js";
```

with:

```js
import { absoluteTabIndex, reorderWindowSequence, tabsToUnloadAllButActive } from "./model.js";
```

- [ ] **Step 2: Add the two actions**

In `src/actions.js`, add after the existing `closeGroup` function (before `closeWindow`):

```js
export async function reorderTab({ orderedIds, tabId, fromGroupId, toGroupId, beforeId }) {
    if (toGroupId !== fromGroupId) {
        if (toGroupId == null) {
            await browser.tabs.ungroup([tabId]);
        } else {
            await browser.tabs.group({ groupId: toGroupId, tabIds: [tabId] });
        }
    }
    const index = absoluteTabIndex(orderedIds, tabId, beforeId);
    await browser.tabs.move(tabId, { index });
}

export async function reorderWindow(orderedIds, windowId, beforeWindowId) {
    const sequence = reorderWindowSequence(orderedIds, windowId, beforeWindowId);
    await Promise.all(
        sequence.map((id, i) => browser.sessions.setWindowValue(id, "order", i)),
    );
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check src/actions.js`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/actions.js
git commit -m "feat: reorderTab and reorderWindow actions"
```

---

### Task 5: Tab reorder end-to-end (DnD MIME refactor + position + indicator)

**Files:**
- Modify: `src/dnd.js` (full rewrite — MIME-typed kinds, tab position resolution, drop indicator)
- Modify: `src/main.js` (wire `onReorderTab`; import `reorderTab`)
- Modify: `dashboard.css` (`.drop-indicator`)

**Interfaces:**
- Consumes: `insertIndexAmong` (Task 1); `reorderTab` (Task 4); existing handlers `onDropTab`, `onDropGroup`, `onDropTabNewWindow`, `onDropGroupNewWindow`.
- Produces: `attachDnd(container, handlers)` now also calls `handlers.onReorderTab({ orderedIds, tabId, fromGroupId, toGroupId, beforeId })` when a tab is dropped within its own window. Cross-window tab drops still call `onDropTab(id, windowId)` (append). Existing group and new-window drops are unchanged in behavior, now keyed by MIME type.

This rewrite preserves all existing drop behavior; it adds intra-window tab reordering. Window dragging is added in Task 6.

- [ ] **Step 1: Rewrite `src/dnd.js`**

Replace the entire contents of `src/dnd.js` with:

```js
import { insertIndexAmong } from "./model.js";

// Drag "kind" is carried in the MIME type: during dragover only the set of
// types is readable, not their values, so the kind must live in the type.
const MIME = {
    group: "application/x-fwm-group",
    tab: "application/x-fwm-tab",
};

function kindOf(dataTransfer) {
    if (dataTransfer.types.includes(MIME.tab)) return "tab";
    if (dataTransfer.types.includes(MIME.group)) return "group";
    return null;
}

// The group-tabs box (drop = join that group) or the loose window-body area
// (drop = ungroup). Null when the pointer is over neither.
function dropContainer(target) {
    const groupTabs = target.closest(".group-tabs");
    if (groupTabs) {
        return { el: groupTabs, groupId: Number(groupTabs.closest(".group").dataset.groupId) };
    }
    const body = target.closest(".window-body");
    if (body) return { el: body, groupId: null };
    return null;
}

function tilesOf(el) {
    return [...el.querySelectorAll(":scope > .tab")];
}

// Resolve a tab drop to { windowId, groupId, beforeId, orderedIds }. beforeId
// is the window-wide tab id to insert before, or null for the window's end.
function resolveTabDrop(container, clientY) {
    const win = container.el.closest(".window");
    const allTiles = [...win.querySelectorAll(".tab")];
    const orderedIds = allTiles.map((t) => Number(t.dataset.tabId));

    const tiles = tilesOf(container.el);
    const k = insertIndexAmong(clientY, tiles.map((t) => t.getBoundingClientRect()));

    let beforeId = null;
    if (k < tiles.length) {
        beforeId = Number(tiles[k].dataset.tabId);
    } else if (tiles.length > 0) {
        const next = allTiles[allTiles.indexOf(tiles[tiles.length - 1]) + 1];
        beforeId = next ? Number(next.dataset.tabId) : null;
    }

    return { windowId: Number(win.dataset.windowId), groupId: container.groupId, beforeId, orderedIds };
}

export function attachDnd(container, handlers) {
    let indicator = null;

    const clearIndicator = () => {
        indicator?.remove();
        indicator = null;
    };
    const clearHighlights = () => {
        for (const el of container.querySelectorAll(".drop-target")) {
            el.classList.remove("drop-target");
        }
    };
    const placeIndicator = (el, clientY) => {
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.className = "drop-indicator";
        }
        const tiles = tilesOf(el);
        const k = insertIndexAmong(clientY, tiles.map((t) => t.getBoundingClientRect()));
        if (k < tiles.length) el.insertBefore(indicator, tiles[k]);
        else el.appendChild(indicator);
    };

    const dropZone = (target) =>
        target.closest(".window-body") || target.closest(".new-window-dropzone");

    container.addEventListener("dragstart", (event) => {
        const tab = event.target.closest(".tab");
        if (tab) {
            event.dataTransfer.setData(MIME.tab, tab.dataset.tabId);
            event.dataTransfer.effectAllowed = "move";
            return;
        }
        const group = event.target.closest(".group");
        if (group) {
            event.dataTransfer.setData(MIME.group, group.dataset.groupId);
            event.dataTransfer.effectAllowed = "move";
        }
    });

    container.addEventListener("dragover", (event) => {
        const kind = kindOf(event.dataTransfer);
        if (!kind) return;
        const zone = dropZone(event.target);
        if (!zone) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        zone.classList.add("drop-target");
        if (kind === "tab") {
            const c = dropContainer(event.target);
            if (c) placeIndicator(c.el, event.clientY);
        }
    });

    container.addEventListener("dragleave", (event) => {
        const zone = dropZone(event.target);
        if (zone) zone.classList.remove("drop-target");
    });

    container.addEventListener("dragend", () => {
        clearIndicator();
        clearHighlights();
    });

    container.addEventListener("drop", (event) => {
        const kind = kindOf(event.dataTransfer);
        clearIndicator();
        const zone = dropZone(event.target);
        clearHighlights();
        if (!kind || !zone) return;
        event.preventDefault();

        const rawId = event.dataTransfer.getData(kind === "tab" ? MIME.tab : MIME.group);
        const id = Number(rawId);
        if (rawId === "" || Number.isNaN(id)) return;

        if (zone.classList.contains("new-window-dropzone")) {
            if (kind === "tab") handlers.onDropTabNewWindow(id);
            else handlers.onDropGroupNewWindow(id);
            return;
        }

        const windowId = Number(zone.closest(".window").dataset.windowId);
        if (kind === "group") {
            handlers.onDropGroup(id, windowId);
            return;
        }

        // kind === "tab": reorder within the same window, else cross-window append.
        const draggedTile = document.querySelector(`.tab[data-tab-id="${id}"]`);
        const fromWindowId = draggedTile ? Number(draggedTile.dataset.windowId) : NaN;
        const c = dropContainer(event.target);
        if (c && fromWindowId === windowId) {
            const drop = resolveTabDrop(c, event.clientY);
            const fromGroup = draggedTile.closest(".group");
            handlers.onReorderTab({
                orderedIds: drop.orderedIds,
                tabId: id,
                fromGroupId: fromGroup ? Number(fromGroup.dataset.groupId) : null,
                toGroupId: drop.groupId,
                beforeId: drop.beforeId,
            });
        } else {
            handlers.onDropTab(id, windowId);
        }
    });
}
```

- [ ] **Step 2: Wire `onReorderTab` in `main.js`**

In `src/main.js`, replace the import block (lines 4-7):

```js
import {
    focusTab, closeTab, unloadTab, unloadAllButActive, closeGroup, closeWindow, renameWindow,
    moveTabToWindow, moveTabToNewWindow, moveGroupToWindow, moveGroupToNewWindow,
} from "./actions.js";
```

with:

```js
import {
    focusTab, closeTab, unloadTab, unloadAllButActive, closeGroup, closeWindow, renameWindow,
    moveTabToWindow, moveTabToNewWindow, moveGroupToWindow, moveGroupToNewWindow, reorderTab,
} from "./actions.js";
```

Then replace the `attachDnd(...)` call at the bottom:

```js
attachDnd(app, {
    onDropTab: (tabId, windowId) => run(moveTabToWindow(tabId, windowId)),
    onDropGroup: (groupId, windowId) => run(moveGroupToWindow(groupId, windowId)),
    onDropTabNewWindow: (tabId) => run(moveTabToNewWindow(tabId)),
    onDropGroupNewWindow: (groupId) => run(moveGroupToNewWindow(groupId)),
});
```

with:

```js
attachDnd(app, {
    onDropTab: (tabId, windowId) => run(moveTabToWindow(tabId, windowId)),
    onDropGroup: (groupId, windowId) => run(moveGroupToWindow(groupId, windowId)),
    onDropTabNewWindow: (tabId) => run(moveTabToNewWindow(tabId)),
    onDropGroupNewWindow: (groupId) => run(moveGroupToNewWindow(groupId)),
    onReorderTab: (args) => run(reorderTab(args)),
});
```

- [ ] **Step 3: Add the drop-indicator style**

In `dashboard.css`, add after the `.tab.discarded` rules (the tab-tiles section):

```css
/* Insertion line shown between tiles while dragging a tab to reorder it. */
.drop-indicator {
    height: 2px;
    margin: 1px 0;
    background: var(--accent);
    border-radius: 1px;
    pointer-events: none; /* never intercept drag events targeting the tiles */
}
```

- [ ] **Step 4: Syntax-check the changed JS**

Run: `node --check src/dnd.js && node --check src/main.js`
Expected: no output (exit 0).

- [ ] **Step 5: Verify the suite still passes**

Run: `node --test`
Expected: PASS (unchanged — this task adds no unit tests).

- [ ] **Step 6: Commit**

```bash
git add src/dnd.js src/main.js dashboard.css
git commit -m "feat: reorder tabs within a window by dragging"
```

---

### Task 6: Window reorder end-to-end (grip handle + window drag/drop)

**Files:**
- Modify: `src/view.js` (render `.window-drag-handle` grip)
- Modify: `src/dnd.js` (full rewrite — adds window kind, drop targets, `onReorderWindow`)
- Modify: `src/main.js` (wire `onReorderWindow`; import `reorderWindow`)
- Modify: `dashboard.css` (`.window-drag-handle`, `.window.window-drop-target`)

**Interfaces:**
- Consumes: `reorderWindow` (Task 4); everything from Task 5.
- Produces: dragging a window's grip handle reorders window panels; `attachDnd` calls `handlers.onReorderWindow({ orderedIds, windowId, beforeWindowId })`.

- [ ] **Step 1: Render the grip handle**

In `src/view.js`, inside `renderWindow`, replace the `header.append(...)` call:

```js
    header.append(
        name,
        el("span", "window-tabcount", `${windowVM.tabCount} tabs`),
        actions,
    );
```

with a grip prepended:

```js
    const grip = el("span", "window-drag-handle", "⠿"); // ⠿
    grip.draggable = true;
    grip.setAttribute("aria-label", "Drag to reorder window");
    grip.title = "Drag to reorder";
    header.append(
        grip,
        name,
        el("span", "window-tabcount", `${windowVM.tabCount} tabs`),
        actions,
    );
```

- [ ] **Step 2: Rewrite `src/dnd.js` to add window dragging**

Replace the entire contents of `src/dnd.js` with (Task 5 version plus the window kind):

```js
import { insertIndexAmong } from "./model.js";

// Drag "kind" is carried in the MIME type: during dragover only the set of
// types is readable, not their values, so the kind must live in the type.
const MIME = {
    group: "application/x-fwm-group",
    tab: "application/x-fwm-tab",
    window: "application/x-fwm-window",
};

function kindOf(dataTransfer) {
    if (dataTransfer.types.includes(MIME.tab)) return "tab";
    if (dataTransfer.types.includes(MIME.group)) return "group";
    if (dataTransfer.types.includes(MIME.window)) return "window";
    return null;
}

// The group-tabs box (drop = join that group) or the loose window-body area
// (drop = ungroup). Null when the pointer is over neither.
function dropContainer(target) {
    const groupTabs = target.closest(".group-tabs");
    if (groupTabs) {
        return { el: groupTabs, groupId: Number(groupTabs.closest(".group").dataset.groupId) };
    }
    const body = target.closest(".window-body");
    if (body) return { el: body, groupId: null };
    return null;
}

function tilesOf(el) {
    return [...el.querySelectorAll(":scope > .tab")];
}

// Resolve a tab drop to { windowId, groupId, beforeId, orderedIds }. beforeId
// is the window-wide tab id to insert before, or null for the window's end.
function resolveTabDrop(container, clientY) {
    const win = container.el.closest(".window");
    const allTiles = [...win.querySelectorAll(".tab")];
    const orderedIds = allTiles.map((t) => Number(t.dataset.tabId));

    const tiles = tilesOf(container.el);
    const k = insertIndexAmong(clientY, tiles.map((t) => t.getBoundingClientRect()));

    let beforeId = null;
    if (k < tiles.length) {
        beforeId = Number(tiles[k].dataset.tabId);
    } else if (tiles.length > 0) {
        const next = allTiles[allTiles.indexOf(tiles[tiles.length - 1]) + 1];
        beforeId = next ? Number(next.dataset.tabId) : null;
    }

    return { windowId: Number(win.dataset.windowId), groupId: container.groupId, beforeId, orderedIds };
}

// Resolve a window drop to { orderedIds, beforeWindowId }. Drop before the
// target window, or after it (beforeWindowId = the next window, or null) when
// the pointer is past the target's vertical midpoint.
function resolveWindowDrop(grid, targetWindow, clientY) {
    const ids = [...grid.querySelectorAll(".window")].map((w) => Number(w.dataset.windowId));
    const targetId = Number(targetWindow.dataset.windowId);
    const rect = targetWindow.getBoundingClientRect();
    let beforeWindowId = targetId;
    if (clientY > rect.top + rect.height / 2) {
        const i = ids.indexOf(targetId);
        beforeWindowId = i + 1 < ids.length ? ids[i + 1] : null;
    }
    return { orderedIds: ids, beforeWindowId };
}

export function attachDnd(container, handlers) {
    let indicator = null;

    const clearIndicator = () => {
        indicator?.remove();
        indicator = null;
    };
    const clearHighlights = () => {
        for (const el of container.querySelectorAll(".drop-target, .window-drop-target")) {
            el.classList.remove("drop-target", "window-drop-target");
        }
    };
    const placeIndicator = (el, clientY) => {
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.className = "drop-indicator";
        }
        const tiles = tilesOf(el);
        const k = insertIndexAmong(clientY, tiles.map((t) => t.getBoundingClientRect()));
        if (k < tiles.length) el.insertBefore(indicator, tiles[k]);
        else el.appendChild(indicator);
    };

    const dropZone = (target) =>
        target.closest(".window-body") || target.closest(".new-window-dropzone");

    container.addEventListener("dragstart", (event) => {
        const handle = event.target.closest(".window-drag-handle");
        if (handle) {
            event.dataTransfer.setData(MIME.window, handle.closest(".window").dataset.windowId);
            event.dataTransfer.effectAllowed = "move";
            return;
        }
        const tab = event.target.closest(".tab");
        if (tab) {
            event.dataTransfer.setData(MIME.tab, tab.dataset.tabId);
            event.dataTransfer.effectAllowed = "move";
            return;
        }
        const group = event.target.closest(".group");
        if (group) {
            event.dataTransfer.setData(MIME.group, group.dataset.groupId);
            event.dataTransfer.effectAllowed = "move";
        }
    });

    container.addEventListener("dragover", (event) => {
        const kind = kindOf(event.dataTransfer);
        if (!kind) return;

        if (kind === "window") {
            const target = event.target.closest(".window");
            if (!target) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            clearHighlights();
            target.classList.add("window-drop-target");
            return;
        }

        const zone = dropZone(event.target);
        if (!zone) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        zone.classList.add("drop-target");
        if (kind === "tab") {
            const c = dropContainer(event.target);
            if (c) placeIndicator(c.el, event.clientY);
        }
    });

    container.addEventListener("dragleave", (event) => {
        const zone = dropZone(event.target);
        if (zone) zone.classList.remove("drop-target");
    });

    container.addEventListener("dragend", () => {
        clearIndicator();
        clearHighlights();
    });

    container.addEventListener("drop", (event) => {
        const kind = kindOf(event.dataTransfer);
        clearIndicator();

        if (kind === "window") {
            const target = event.target.closest(".window");
            clearHighlights();
            if (!target) return;
            event.preventDefault();
            const id = Number(event.dataTransfer.getData(MIME.window));
            const targetId = Number(target.dataset.windowId);
            if (Number.isNaN(id) || id === targetId) return;
            const { orderedIds, beforeWindowId } = resolveWindowDrop(target.closest(".windows-grid"), target, event.clientY);
            handlers.onReorderWindow({ orderedIds, windowId: id, beforeWindowId });
            return;
        }

        const zone = dropZone(event.target);
        clearHighlights();
        if (!kind || !zone) return;
        event.preventDefault();

        const rawId = event.dataTransfer.getData(kind === "tab" ? MIME.tab : MIME.group);
        const id = Number(rawId);
        if (rawId === "" || Number.isNaN(id)) return;

        if (zone.classList.contains("new-window-dropzone")) {
            if (kind === "tab") handlers.onDropTabNewWindow(id);
            else handlers.onDropGroupNewWindow(id);
            return;
        }

        const windowId = Number(zone.closest(".window").dataset.windowId);
        if (kind === "group") {
            handlers.onDropGroup(id, windowId);
            return;
        }

        // kind === "tab": reorder within the same window, else cross-window append.
        const draggedTile = document.querySelector(`.tab[data-tab-id="${id}"]`);
        const fromWindowId = draggedTile ? Number(draggedTile.dataset.windowId) : NaN;
        const c = dropContainer(event.target);
        if (c && fromWindowId === windowId) {
            const drop = resolveTabDrop(c, event.clientY);
            const fromGroup = draggedTile.closest(".group");
            handlers.onReorderTab({
                orderedIds: drop.orderedIds,
                tabId: id,
                fromGroupId: fromGroup ? Number(fromGroup.dataset.groupId) : null,
                toGroupId: drop.groupId,
                beforeId: drop.beforeId,
            });
        } else {
            handlers.onDropTab(id, windowId);
        }
    });
}
```

- [ ] **Step 3: Wire `onReorderWindow` in `main.js`**

In `src/main.js`, replace the import block:

```js
import {
    focusTab, closeTab, unloadTab, unloadAllButActive, closeGroup, closeWindow, renameWindow,
    moveTabToWindow, moveTabToNewWindow, moveGroupToWindow, moveGroupToNewWindow, reorderTab,
} from "./actions.js";
```

with:

```js
import {
    focusTab, closeTab, unloadTab, unloadAllButActive, closeGroup, closeWindow, renameWindow,
    moveTabToWindow, moveTabToNewWindow, moveGroupToWindow, moveGroupToNewWindow, reorderTab, reorderWindow,
} from "./actions.js";
```

Then add the window handler to the `attachDnd(...)` call — replace:

```js
    onReorderTab: (args) => run(reorderTab(args)),
});
```

with:

```js
    onReorderTab: (args) => run(reorderTab(args)),
    onReorderWindow: ({ orderedIds, windowId, beforeWindowId }) =>
        run(reorderWindow(orderedIds, windowId, beforeWindowId)),
});
```

- [ ] **Step 4: Add grip and window-drop-target styles**

In `dashboard.css`, add the grip style in the window-header section (near `.window-name`):

```css
/* Drag handle for reordering window panels. */
.window-drag-handle {
    color: var(--muted);
    cursor: grab;
    font-size: 0.95rem;
    line-height: 1;
    user-select: none;
}

.window-drag-handle:hover {
    color: var(--accent);
}

.window-drag-handle:active {
    cursor: grabbing;
}
```

And add the window drop-target highlight after the `.window.focused` rule:

```css
/* Insertion target while dragging a window panel to reorder it. */
.window.window-drop-target {
    outline: 2px dashed var(--accent);
    outline-offset: 3px;
}
```

- [ ] **Step 5: Syntax-check the changed JS**

Run: `node --check src/dnd.js && node --check src/main.js && node --check src/view.js`
Expected: no output (exit 0).

- [ ] **Step 6: Verify the suite still passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/view.js src/dnd.js src/main.js dashboard.css
git commit -m "feat: reorder window panels by dragging, order persists"
```

---

## Final verification (after all tasks)

- Run `node --test` — all unit tests pass.
- Render the overview via the scratchpad Playwright harness (`scratchpad/shoot.mjs`), confirming each window header shows the `⠿` grip at the left and the layout is intact. (The live drag interactions — insertion line, window highlight — are verified manually in Firefox; the render confirms the static affordances and that nothing regressed.)
- Manual Firefox smoke test (by the user): load via `about:debugging`, drag a tab within a window (into and out of a group), and drag a window panel to a new position; reopen the overview to confirm the window order persisted.
