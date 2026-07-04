import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOf, buildModel, deriveCounts, allTabsOf, tabsToUnloadAllButActive, insertIndexAmong, absoluteTabIndex } from "../src/model.js";

const win = (id, extra = {}) => ({ id, focused: false, incognito: false, type: "normal", ...extra });
const tab = (id, windowId, extra = {}) => ({
    id, windowId, url: `https://site${id}.example/page`, title: `Tab ${id}`,
    favIconUrl: "", active: false, discarded: false, groupId: -1, index: id, ...extra,
});
const group = (id, windowId, extra = {}) => ({ id, windowId, title: `G${id}`, color: "blue", collapsed: false, ...extra });

test("hostOf extracts host, falls back to raw string for non-URLs", () => {
    assert.equal(hostOf("https://example.com/a/b?c=1"), "example.com");
    assert.equal(hostOf("about:blank"), "about:blank");
    assert.equal(hostOf("not a url"), "not a url");
});

test("buildModel nests groups and ungrouped tabs under their window, ordered by tab index", () => {
    const windows = [win(1)];
    const tabs = [
        tab(10, 1, { index: 0, groupId: 100 }),
        tab(11, 1, { index: 1, groupId: -1 }),
        tab(12, 1, { index: 2, groupId: 100 }),
    ];
    const groups = [group(100, 1, { title: "Research", color: "cyan" })];
    const model = buildModel(windows, tabs, groups, {});

    assert.equal(model.windows.length, 1);
    const w = model.windows[0];
    assert.equal(w.groups.length, 1);
    assert.equal(w.groups[0].title, "Research");
    assert.deepEqual(w.groups[0].tabs.map((t) => t.id), [10, 12]);
    assert.deepEqual(w.ungrouped.map((t) => t.id), [11]);
    assert.equal(w.tabCount, 3);
    assert.equal(w.groups[0].tabs[0].host, "site10.example");
});

test("buildModel applies window names and defaults missing names to null", () => {
    const model = buildModel([win(1), win(2)], [tab(10, 1), tab(20, 2)], [], { 1: "Work" });
    assert.equal(model.windows[0].name, "Work");
    assert.equal(model.windows[1].name, null);
});

test("buildModel drops group references with no matching group definition into ungrouped", () => {
    const model = buildModel([win(1)], [tab(10, 1, { groupId: 999 })], [], {});
    assert.equal(model.windows[0].groups.length, 0);
    assert.deepEqual(model.windows[0].ungrouped.map((t) => t.id), [10]);
});

test("deriveCounts totals windows, groups, and tabs", () => {
    const model = buildModel(
        [win(1), win(2)],
        [tab(10, 1, { groupId: 100 }), tab(11, 1), tab(20, 2)],
        [group(100, 1)],
        {},
    );
    assert.deepEqual(deriveCounts(model.windows), { windows: 2, groups: 1, tabs: 3 });
    assert.deepEqual(model.counts, { windows: 2, groups: 1, tabs: 3 });
});

test("allTabsOf returns grouped tabs then ungrouped tabs", () => {
    const model = buildModel(
        [win(1)],
        [tab(10, 1, { index: 0, groupId: 100 }), tab(11, 1, { index: 1 })],
        [group(100, 1)],
        {},
    );
    assert.deepEqual(allTabsOf(model.windows[0]).map((t) => t.id), [10, 11]);
});

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
    );
    assert.deepEqual(tabsToUnloadAllButActive(model, "all").sort((a, b) => a - b), [12, 21]);
});

test("tabsToUnloadAllButActive scoped to one window ignores other windows", () => {
    const model = buildModel(
        [win(1), win(2)],
        [tab(10, 1, { active: true }), tab(11, 1), tab(20, 2), tab(21, 2)],
        [],
        {},
    );
    assert.deepEqual(tabsToUnloadAllButActive(model, { windowId: 1 }), [11]);
});

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
