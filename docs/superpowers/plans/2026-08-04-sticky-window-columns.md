# Sticky Window Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Window panels stay in the column and vertical slot the user drops them in, persisted across restarts.

**Architecture:** Real flex column containers replace CSS multi-column masonry. Each window persists `col` and
`order` session values. A pure `assignColumns` folds assignments into the visible column count and fills
unassigned windows into the shortest column. Drops snapshot the whole visible layout back to `sessions`.

**Tech Stack:** Vanilla ES modules, WebExtension `sessions`/`windows`/`tabs` APIs, Node built-in test runner.

Spec: `docs/superpowers/specs/2026-08-04-sticky-window-columns-design.md`. Bean: `firefox-windows-manager-0kn2`.

## Global Constraints

- Firefox 139+ (`tabGroups`); no dependencies, no build step.
- House style: no semicolons, no parens on single-param arrows, no braces on single-statement blocks,
  object keys and import lists alphabetized, 4-space indent, ≤140-col lines.
- CSS: native nesting, properties alphabetized per block.
- One-way flow stays: `data.js` (read) → `model.js` (pure) → `view.js` (render) → `dnd.js`/`actions.js` (write).
- All commits: `npm test` green first; commit message ends with the Claude co-author/session trailer.

---

### Task 1: Pure model — `assignColumns`

**Files:**
- Modify: `src/model.js` (append after `sortWindowsByOrder`)
- Test: `test/model.test.js`

**Interfaces:**
- Consumes: window VMs as built today (`id`, `tabCount`; Task 3 adds `col`/`order` — tests here fake them directly).
- Produces: `assignColumns(modelWindows, visibleCount)` → array of `visibleCount` arrays of window VMs.
  Assigned windows sort by `(col, order, id)` with `col` clamped to the last visible column; windows without a
  numeric `col` fill the shortest column (height estimate: `3 + tabCount` per window) in input sequence.

- [x] **Step 1: Write the failing tests** (append to `test/model.test.js`; add `assignColumns` to the import list, alphabetized)

```js
const colWin = (id, extra = {}) => ({ groups: [], id, tabCount: 0, ungrouped: [], ...extra })

test("assignColumns puts assigned windows in their column, ordered by (col, order, id)", () => {
    const ws = [colWin(1, { col: 1, order: 0 }), colWin(2, { col: 0, order: 1 }), colWin(3, { col: 0, order: 0 })]
    const cols = assignColumns(ws, 2)
    assert.deepEqual(cols.map(c => c.map(w => w.id)), [[3, 2], [1]])
})

test("assignColumns folds out-of-range columns into the last visible one, after its own windows", () => {
    const ws = [colWin(1, { col: 3, order: 0 }), colWin(2, { col: 1, order: 0 })]
    const cols = assignColumns(ws, 2)
    assert.deepEqual(cols.map(c => c.map(w => w.id)), [[], [2, 1]])
})

test("assignColumns fills unassigned windows into the shortest column by tab-count estimate", () => {
    const ws = [colWin(1, { col: 0, order: 0, tabCount: 9 }), colWin(2, { tabCount: 1 }), colWin(3, { tabCount: 1 })]
    const cols = assignColumns(ws, 2)
    assert.deepEqual(cols.map(c => c.map(w => w.id)), [[1], [2, 3]])
})

test("assignColumns with one visible column stacks everything in sequence", () => {
    const ws = [colWin(1, { col: 2, order: 0 }), colWin(2)]
    const cols = assignColumns(ws, 1)
    assert.deepEqual(cols.map(c => c.map(w => w.id)), [[1, 2]])
})

test("assignColumns is deterministic for mixed assigned and unassigned windows", () => {
    const ws = [colWin(1, { col: 1, order: 0 }), colWin(2, { tabCount: 4 }), colWin(3, { tabCount: 2 })]
    const a = assignColumns(ws, 2).map(c => c.map(w => w.id))
    const b = assignColumns(ws, 2).map(c => c.map(w => w.id))
    assert.deepEqual(a, b)
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `assignColumns is not a function` (or not exported).

- [x] **Step 3: Implement** (append to `src/model.js`)

```js
// Height estimate in tab-tile units: a panel costs its header (~3 tiles) plus
// one unit per tab. Pure stand-in for DOM measurement, good enough to pick the
// shortest column for windows the user has not placed yet.
const WINDOW_HEIGHT_COST = 3

export function assignColumns(modelWindows, visibleCount) {
    const columns = Array.from({ length: visibleCount }, () => [])
    const heightOf = column => column.reduce((h, w) => h + WINDOW_HEIGHT_COST + w.tabCount, 0)

    const assigned = modelWindows
        .filter(w => typeof w.col === "number")
        .sort((a, b) => a.col - b.col || (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)
    for (const w of assigned) columns[Math.min(w.col, visibleCount - 1)].push(w)

    for (const w of modelWindows.filter(w => typeof w.col !== "number")) {
        const shortest = columns.reduce((best, c) => heightOf(c) < heightOf(best) ? c : best, columns[0])
        shortest.push(w)
    }
    return columns
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test` — all pass, including the 13 pre-existing tests.

- [x] **Step 5: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "Add assignColumns: pure sticky-column layout"
```

### Task 2: Pure model — `moveWindowAmongColumns`

**Files:**
- Modify: `src/model.js` (append)
- Test: `test/model.test.js`

**Interfaces:**
- Produces: `moveWindowAmongColumns(columnIds, movedId, targetIndex, beforeId)` → new `number[][]`.
  `columnIds` is the current layout as arrays of window ids; the moved id is removed from wherever it is and
  inserted in column `targetIndex` before `beforeId` (append when `beforeId` is `null` or not in that column).
  Input arrays are not mutated. `reorderWindowSequence` is NOT removed yet — `actions.js` still imports it
  until Task 6.

- [x] **Step 1: Write the failing tests** (append; import `moveWindowAmongColumns`, alphabetized)

```js
test("moveWindowAmongColumns moves a window between columns before a reference", () => {
    const next = moveWindowAmongColumns([[1, 2], [3]], 1, 1, 3)
    assert.deepEqual(next, [[2], [1, 3]])
})

test("moveWindowAmongColumns appends when beforeId is null or unknown", () => {
    assert.deepEqual(moveWindowAmongColumns([[1, 2], [3]], 1, 1, null), [[2], [3, 1]])
    assert.deepEqual(moveWindowAmongColumns([[1, 2], [3]], 1, 1, 99), [[2], [3, 1]])
})

test("moveWindowAmongColumns reorders within a column and does not mutate its input", () => {
    const input = [[1, 2, 3]]
    const next = moveWindowAmongColumns(input, 3, 0, 1)
    assert.deepEqual(next, [[3, 1, 2]])
    assert.deepEqual(input, [[1, 2, 3]])
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test` — FAIL on the three new tests.

- [x] **Step 3: Implement** (append to `src/model.js`)

```js
export function moveWindowAmongColumns(columnIds, movedId, targetIndex, beforeId) {
    const next = columnIds.map(ids => ids.filter(id => id !== movedId))
    const target = next[targetIndex]
    const i = beforeId == null ? -1 : target.indexOf(beforeId)
    target.splice(i === -1 ? target.length : i, 0, movedId)
    return next
}
```

- [x] **Step 4: Run tests to verify they pass** — `npm test`, all green.

- [x] **Step 5: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "Add moveWindowAmongColumns: pure column-drop math"
```

### Task 3: `buildModel` carries `col`/`order`; `data.js` fetches `col`

**Files:**
- Modify: `src/model.js` (`buildModel` signature and window VM)
- Modify: `src/data.js` (`fetchState`)
- Test: `test/model.test.js`

**Interfaces:**
- Produces: `buildModel(windows, tabs, groups, names = {}, orders = {}, cols = {})`; each window VM gains
  `col: cols[w.id]` and `order: orders[w.id]` (both `number | undefined`), keys alphabetized in the literal.
- Consumes (data.js): `browser.sessions.getWindowValue(w.id, "col")`.

- [x] **Step 1: Write the failing test** (append)

```js
test("buildModel passes through col and order session values, undefined when absent", () => {
    const model = buildModel([win(1), win(2)], [tab(10, 1), tab(20, 2)], [], {}, { 1: 0 }, { 1: 2 })
    assert.equal(model.windows[0].col, 2)
    assert.equal(model.windows[0].order, 0)
    assert.equal(model.windows[1].col, undefined)
    assert.equal(model.windows[1].order, undefined)
})
```

- [x] **Step 2: Run tests to verify it fails** — `npm test`, FAIL: `col` is `undefined`… actually FAIL on
  `model.windows[0].col` being `undefined` instead of `2`.

- [x] **Step 3: Implement.** In `src/model.js`, change the signature line to

```js
export function buildModel(windows, tabs, groups, names = {}, orders = {}, cols = {}) {
```

and the window VM literal to

```js
        return {
            col: cols[w.id],
            focused: !!w.focused,
            groups: groupModels,
            id: w.id,
            incognito: !!w.incognito,
            name: names[w.id] || undefined,
            order: orders[w.id],
            tabCount: wTabs.length,
            ungrouped,
        }
```

In `src/data.js`, extend the per-window reads and pass `cols` through:

```js
    const cols = {}
    const names = {}
    const orders = {}
    await Promise.all(
        windows.map(async w => {
            const [col, name, order] = await Promise.all([
                browser.sessions.getWindowValue(w.id, "col"),
                browser.sessions.getWindowValue(w.id, "name"),
                browser.sessions.getWindowValue(w.id, "order"),
            ])
            cols[w.id] = typeof col === "number" ? col : undefined
            names[w.id] = name || undefined
            orders[w.id] = typeof order === "number" ? order : undefined
        }),
    )

    return buildModel(windows, tabs, groups, names, orders, cols)
```

- [x] **Step 4: Run tests to verify they pass** — `npm test`; also `node --check src/data.js`.

- [x] **Step 5: Commit**

```bash
git add src/model.js src/data.js test/model.test.js
git commit -m "Carry col/order session values through the model"
```

### Task 4: View renders real columns; CSS flex columns

**Files:**
- Modify: `src/view.js` (`render`, import), `dashboard.css` (`.windows-grid`), `test/preview.html`

**Interfaces:**
- Consumes: `assignColumns` from Task 1.
- Produces: `render(model, { columnCount, tabGroupsSupported })`; `columnCount` defaults to `1`. The grid
  contains exactly `columnCount` `div.window-column` children, each with `dataset.colIndex` set, window
  panels as direct children. Task 5's dnd relies on `.window-column` and `data-col-index`.

- [x] **Step 1: Implement view.** In `src/view.js` add the import at the top:

```js
import { assignColumns } from "./model.js"
```

and replace the grid loop in `render` with:

```js
    const columnCount = options.columnCount ?? 1
    const grid = el("div", "windows-grid")
    assignColumns(model.windows, columnCount).forEach((column, i) => {
        const columnEl = el("div", "window-column")
        columnEl.dataset.colIndex = String(i)
        for (const windowVM of column) columnEl.append(renderWindow(windowVM))
        grid.append(columnEl)
    })
    root.append(grid)
```

- [x] **Step 2: Replace the `.windows-grid` CSS.** In `dashboard.css`, replace the `.windows-grid` block and
  its masonry comment with:

```css
/* Real flex columns — each is a drop bucket, so a dropped panel stays where it
   was released instead of re-packing by height like CSS multi-column did. */
.windows-grid {
    align-items: flex-start;
    display: flex;
    gap: 1.25rem;
}

/* min-height keeps an emptied column droppable. */
.window-column {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 3rem;
    min-width: 0;
}
```

and delete `break-inside: avoid;` from the `.window` block (columns no longer split panels).

- [x] **Step 3: Update the preview fixture.** In `test/preview.html`, change the render call to
  `document.getElementById("app").append(render(model, { columnCount: 2 }))`.

- [x] **Step 4: Verify** — `npm test` (still green), `node --check src/view.js`, and
  `npx --yes lightningcss-cli --targets 'firefox >= 139' dashboard.css -o /dev/null` parses clean.
  If a browser is available, open `test/preview.html` over a local HTTP server and confirm two columns.

- [x] **Step 5: Commit**

```bash
git add src/view.js dashboard.css test/preview.html
git commit -m "Render window panels into real flex columns"
```

### Task 5: Dnd — window drops target columns

**Files:**
- Modify: `src/dnd.js`

**Interfaces:**
- Consumes: `.window-column` / `data-col-index` from Task 4; `insertIndexAmong` from the model.
- Produces: `handlers.onReorderWindow({ beforeWindowId, columnIds, columnIndex, windowId })` —
  `columnIds: number[][]` is the full current layout read from the DOM; `beforeWindowId` is `null` for
  column end. Task 6's main wiring consumes exactly this shape. `resolveWindowDrop` is deleted.

- [ ] **Step 1: Implement.** In `src/dnd.js`:

Add next to `tilesOf`:

```js
function panelsOf(columnEl) {
    return [...columnEl.querySelectorAll(":scope > .window")]
}
```

Delete `resolveWindowDrop`. In the `dragover` listener, replace the `kind === "window"` branch with:

```js
        if (kind === "window") {
            const column = event.target.closest(".window-column")
            if (!column) return
            event.preventDefault()
            event.dataTransfer.dropEffect = "move"
            clearHighlights()
            column.classList.add("window-drop-target")
            return
        }
```

In the `drop` listener, replace the `kind === "window"` branch with:

```js
        if (kind === "window") {
            const column = event.target.closest(".window-column")
            clearHighlights()
            if (!column) return
            event.preventDefault()
            const id = Number(event.dataTransfer.getData(MIME.window))
            if (Number.isNaN(id)) return
            const grid = column.closest(".windows-grid")
            const columnIds = [...grid.querySelectorAll(".window-column")]
                .map(c => panelsOf(c).map(w => Number(w.dataset.windowId)))
            const others = panelsOf(column).filter(p => Number(p.dataset.windowId) !== id)
            const k = insertIndexAmong(event.clientY, others.map(p => p.getBoundingClientRect()))
            handlers.onReorderWindow({
                beforeWindowId: k < others.length ? Number(others[k].dataset.windowId) : null,
                columnIds,
                columnIndex: Number(column.dataset.colIndex),
                windowId: id,
            })
            return
        }
```

The `.window-drop-target` highlight now lands on the column element; the existing
`.window.window-drop-target` CSS rule moves in Task 6's cleanup? No — fix it here: in `dashboard.css`,
move the rule out of the `.window` nesting into a top-level block:

```css
/* Insertion target while dragging a window panel to reorder it. */
.window-column.window-drop-target {
    outline: 2px dashed var(--accent);
    outline-offset: 3px;
}
```

(delete the `&.window-drop-target` block inside `.window`).

- [ ] **Step 2: Verify** — `node --check src/dnd.js`; `npm test`; lightningcss parse of `dashboard.css`.

- [ ] **Step 3: Commit**

```bash
git add src/dnd.js dashboard.css
git commit -m "Window drops target real columns in dnd"
```

### Task 6: Actions + main wiring; retire the linear order path

**Files:**
- Modify: `src/actions.js`, `src/main.js`, `src/model.js`, `test/model.test.js`

**Interfaces:**
- Consumes: `moveWindowAmongColumns` (Task 2), dnd payload (Task 5).
- Produces: `persistWindowLayout(columnIds)` in `actions.js` — writes `col` and `order` session values for
  every window in the snapshot. `reorderWindow` and `reorderWindowSequence` are deleted (superseded; the
  full-layout snapshot re-sequences target AND source columns, and pins previously-unassigned windows so
  they stop reflowing — the spec's compaction requirement falls out of it).

- [ ] **Step 1: Implement actions.** In `src/actions.js`, replace `reorderWindow` with:

```js
export async function persistWindowLayout(columnIds) {
    await Promise.all(columnIds.flatMap((ids, col) =>
        ids.flatMap((id, order) => [
            browser.sessions.setWindowValue(id, "col", col),
            browser.sessions.setWindowValue(id, "order", order),
        ]),
    ))
}
```

and drop `reorderWindowSequence` from the model import (leaving `absoluteTabIndex, tabsToUnloadAllButActive`).

- [ ] **Step 2: Wire main.** In `src/main.js`:

Import changes: replace `reorderWindow` with `persistWindowLayout` in the actions import (alphabetized), and
add `moveWindowAmongColumns` to a model import:

```js
import { moveWindowAmongColumns } from "./model.js"
```

Add the column-count constant and helper after `const app = …`:

```js
const COLUMN_WIDTH = 360 // px: ~340px panel plus grid gap

const columnCount = () => Math.max(1, Math.floor(app.clientWidth / COLUMN_WIDTH))
```

In `rerender`, track the rendered count and pass it through:

```js
async function rerender() {
    state.model = await fetchState()
    state.renderedColumns = columnCount()
    const tree = render(state.model, { columnCount: state.renderedColumns, tabGroupsSupported: hasTabGroups() })
    tree.classList.add("just-updated")
    app.replaceChildren(tree)
    requestAnimationFrame(() => tree.classList.remove("just-updated"))
}
```

(`state` literal becomes `{ model: undefined, renderedColumns: 1 }`.) After `main()`'s definition, register:

```js
window.addEventListener("resize", debounce(() => {
    if (columnCount() !== state.renderedColumns) rerender()
}, 150))
```

Replace the `onReorderWindow` handler in `attachDnd` with:

```js
    onReorderWindow: async ({ beforeWindowId, columnIds, columnIndex, windowId }) => {
        await run(persistWindowLayout(moveWindowAmongColumns(columnIds, windowId, columnIndex, beforeWindowId)))
        rerender()
    },
```

- [ ] **Step 3: Delete the dead model code.** Remove `reorderWindowSequence` from `src/model.js` and its two
  tests (`"reorderWindowSequence moves a window before another or to the end"`) from `test/model.test.js`;
  remove it from the test file's import list. `sortWindowsByOrder` stays (buildModel's base sequence).

- [ ] **Step 4: Verify** — `npm test` all green; `node --check` on `src/actions.js src/main.js src/model.js`;
  `grep -rn reorderWindowSequence src test` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add src/actions.js src/main.js src/model.js test/model.test.js
git commit -m "Persist full column layout on window drop"
```

### Task 7: Docs, changelog, package

**Files:**
- Modify: `README.md`, `CHANGELOG.md`
- Bean: `firefox-windows-manager-0kn2`

- [ ] **Step 1: README.** Replace the reorder bullet and the re-pack caveat paragraph (README lines 26–29)
  with:

```markdown
- **Reorder window panels** — drag the `⠿` grip in a window header onto any column, at any height.
  Panels are sticky: each window remembers its column and position (via session values) and stays
  put across re-renders and restarts.

Column count still follows the viewport width. When the window is too narrow to show a panel's
assigned column, that column folds into the last visible one; widen the window and it unfolds. New
browser windows appear in whichever column is currently shortest until you place them.
```

- [ ] **Step 2: CHANGELOG.** Under `## [Unreleased]`, add (create the `### Changed` heading if the style-pass
  entry's section is still there, append to it):

```markdown
- Window panels now live in real columns and stay where you drop them. Each window stores a column
  and a position (`sessions` values `col` and `order`); dropping any window pins the whole visible
  layout. Narrow viewports fold higher columns into the last visible one. Previously the CSS
  multi-column layout could re-pack a dropped panel into a different column.
```

- [ ] **Step 3: Manual smoke test** (needs Firefox): load via `about:debugging`, open the overview — drag a
  window to another column, reload the overview tab, confirm it stayed; narrow the overview window below two
  columns' width, confirm folding; restore width, confirm the assignment returns.

- [ ] **Step 4: Update the bean and commit.** Check off the plan/implementation items in bean
  `firefox-windows-manager-0kn2`, append a `## Summary of Changes` section, set `-s completed`.

```bash
git add README.md CHANGELOG.md .beans
git commit -m "Document sticky window columns"
```

- [ ] **Step 5: Package (optional, on request):** `npm run package` rebuilds `tab-window-manager.xpi`.

---

## Self-review notes

- Spec coverage: storage (T3, T6), assignColumns semantics (T1), data.js (T3), view/CSS (T4), dnd (T5),
  actions/main/resize (T6), errors (existing `run()` path, unchanged), tests (T1–T3, T6), docs (T7). The
  spec's "re-sequence target, compact source" is implemented as the full-layout snapshot in T6 — a strict
  superset, noted there.
- Type consistency: `onReorderWindow({ beforeWindowId, columnIds, columnIndex, windowId })` matches between
  T5 (producer) and T6 (consumer); `assignColumns`/`moveWindowAmongColumns` names and arities match T1/T2.
