import assert from "node:assert/strict"
import { test } from "node:test"
import {
    absoluteTabIndex, allTabsOf, assignColumns, buildModel, deriveCounts, hostOf, insertIndexAmong,
    moveWindowAmongColumns, reorderWindowSequence, sortWindowsByOrder, tabsToUnloadAllButActive,
} from "../src/model.js"

const win = (id, extra = {}) => ({ focused: false, id, incognito: false, type: "normal", ...extra })
const tab = (id, windowId, extra = {}) => ({
    active: false, discarded: false, favIconUrl: "", groupId: -1, id, index: id,
    title: `Tab ${id}`, url: `https://site${id}.example/page`, windowId, ...extra,
})
const group = (id, windowId, extra = {}) => ({ collapsed: false, color: "blue", id, title: `G${id}`, windowId, ...extra })

test("hostOf extracts host, falls back to raw string for non-URLs", () => {
    assert.equal(hostOf("https://example.com/a/b?c=1"), "example.com")
    assert.equal(hostOf("about:blank"), "about:blank")
    assert.equal(hostOf("not a url"), "not a url")
})

test("buildModel nests groups and ungrouped tabs under their window, ordered by tab index", () => {
    const windows = [win(1)]
    const tabs = [
        tab(10, 1, { groupId: 100, index: 0 }),
        tab(11, 1, { groupId: -1, index: 1 }),
        tab(12, 1, { groupId: 100, index: 2 }),
    ]
    const groups = [group(100, 1, { color: "cyan", title: "Research" })]
    const model = buildModel(windows, tabs, groups, {})

    assert.equal(model.windows.length, 1)
    const w = model.windows[0]
    assert.equal(w.groups.length, 1)
    assert.equal(w.groups[0].title, "Research")
    assert.deepEqual(w.groups[0].tabs.map(t => t.id), [10, 12])
    assert.deepEqual(w.ungrouped.map(t => t.id), [11])
    assert.equal(w.tabCount, 3)
    assert.equal(w.groups[0].tabs[0].host, "site10.example")
})

test("buildModel applies window names and defaults missing names to undefined", () => {
    const model = buildModel([win(1), win(2)], [tab(10, 1), tab(20, 2)], [], { 1: "Work" })
    assert.equal(model.windows[0].name, "Work")
    assert.equal(model.windows[1].name, undefined)
})

test("buildModel drops group references with no matching group definition into ungrouped", () => {
    const model = buildModel([win(1)], [tab(10, 1, { groupId: 999 })], [], {})
    assert.equal(model.windows[0].groups.length, 0)
    assert.deepEqual(model.windows[0].ungrouped.map(t => t.id), [10])
})

test("deriveCounts totals windows, groups, and tabs", () => {
    const model = buildModel(
        [win(1), win(2)],
        [tab(10, 1, { groupId: 100 }), tab(11, 1), tab(20, 2)],
        [group(100, 1)],
        {},
    )
    assert.deepEqual(deriveCounts(model.windows), { groups: 1, tabs: 3, windows: 2 })
    assert.deepEqual(model.counts, { groups: 1, tabs: 3, windows: 2 })
})

test("allTabsOf returns grouped tabs then ungrouped tabs", () => {
    const model = buildModel(
        [win(1)],
        [tab(10, 1, { groupId: 100, index: 0 }), tab(11, 1, { index: 1 })],
        [group(100, 1)],
        {},
    )
    assert.deepEqual(allTabsOf(model.windows[0]).map(t => t.id), [10, 11])
})

test("tabsToUnloadAllButActive skips active and already-discarded tabs, scoped to all", () => {
    const model = buildModel(
        [win(1), win(2)],
        [
            tab(10, 1, { active: true }),
            tab(11, 1, { discarded: true }),
            tab(12, 1),
            tab(20, 2, { active: true }),
            tab(21, 2),
        ],
        [],
        {},
    )
    assert.deepEqual(tabsToUnloadAllButActive(model, "all").sort((a, b) => a - b), [12, 21])
})

test("tabsToUnloadAllButActive scoped to one window ignores other windows", () => {
    const model = buildModel(
        [win(1), win(2)],
        [tab(10, 1, { active: true }), tab(11, 1), tab(20, 2), tab(21, 2)],
        [],
        {},
    )
    assert.deepEqual(tabsToUnloadAllButActive(model, { windowId: 1 }), [11])
})

test("insertIndexAmong counts tiles whose midpoint sits above the pointer", () => {
    const rects = [
        { bottom: 20, top: 0 },   // midpoint 10
        { bottom: 40, top: 20 },  // midpoint 30
        { bottom: 60, top: 40 },  // midpoint 50
    ]
    assert.equal(insertIndexAmong(5, rects), 0)    // above all midpoints
    assert.equal(insertIndexAmong(25, rects), 1)   // between 1st and 2nd
    assert.equal(insertIndexAmong(45, rects), 2)   // between 2nd and 3rd
    assert.equal(insertIndexAmong(100, rects), 3)  // below all midpoints -> append
    assert.equal(insertIndexAmong(10, []), 0)      // empty container
})

test("absoluteTabIndex targets the position before the reference, minus the moved tab", () => {
    const ids = [1, 2, 3, 4]
    assert.equal(absoluteTabIndex(ids, 2, 4), 2)    // rest [1,3,4]: before 4 -> 2
    assert.equal(absoluteTabIndex(ids, 4, 2), 1)    // rest [1,2,3]: before 2 -> 1
    assert.equal(absoluteTabIndex(ids, 2, null), 3) // append -> rest length 3
    assert.equal(absoluteTabIndex([1, 2, 3], 1, 99), 2) // unknown ref -> append
})

test("sortWindowsByOrder orders by stored order, unordered windows last by id", () => {
    const mk = id => ({ groups: [], id, name: undefined, tabCount: 0, ungrouped: [] })
    const ws = [mk(10), mk(20), mk(30)]
    assert.deepEqual(sortWindowsByOrder(ws, { 10: 2, 20: 0, 30: 1 }).map(w => w.id), [20, 30, 10])
    assert.deepEqual(sortWindowsByOrder(ws, {}).map(w => w.id), [10, 20, 30])
    assert.deepEqual(sortWindowsByOrder(ws, { 30: 0 }).map(w => w.id), [30, 10, 20])
})

test("reorderWindowSequence moves a window before another or to the end", () => {
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 10, 30), [20, 10, 30])
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 30, null), [10, 20, 30])
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 20, 10), [20, 10, 30])
    assert.deepEqual(reorderWindowSequence([10, 20, 30], 30, 99), [10, 20, 30]) // unknown ref -> end
})

const colWin = (id, extra = {}) => ({ groups: [], id, tabCount: 0, ungrouped: [], ...extra })

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

test("buildModel sorts windows by stored order", () => {
    const windows = [win(1), win(2), win(3)]
    const tabs = [tab(10, 1), tab(20, 2), tab(30, 3)]
    const model = buildModel(windows, tabs, [], {}, { 1: 2, 2: 0, 3: 1 })
    assert.deepEqual(model.windows.map(w => w.id), [2, 3, 1])
})
