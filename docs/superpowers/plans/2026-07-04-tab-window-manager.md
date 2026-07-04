# Firefox Tab & Window Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Firefox MV3 extension whose toggleable full-page overview shows every window, tab group, and tab in an
exploded layout and lets the user name windows, close/move/unload tabs and groups, and move things between windows by drag
and drop.

**Architecture:** A non-persistent background script owns the toolbar button and keyboard shortcut and toggles a single
dashboard tab. The dashboard is vanilla HTML/CSS/ES-modules with a one-way data flow: `data.js` reads the browser and feeds
a pure `model.js` that produces a normalized view model; `view.js` renders it to the DOM; `actions.js` and `dnd.js` are the
only code that calls mutating browser APIs; browser change events re-run the whole cycle so the browser stays the single
source of truth.

**Tech Stack:** Firefox WebExtensions (Manifest V3), vanilla HTML/CSS/JavaScript ES modules, no build step, no runtime
dependencies. Tests use Node's built-in `node:test` runner against the pure `model.js`.

## Global Constraints

- Manifest V3 WebExtension; Firefox only.
- `browser_specific_settings.gecko.strict_min_version` = `139.0` (required for the `tabGroups` API).
- Permissions are exactly: `tabs`, `tabGroups`, `sessions`. No `storage`, no `<all_urls>`.
- No framework, no bundler, no build step. Vanilla HTML/CSS/JS with native ES modules.
- Zero runtime dependencies. The only dev tooling is Node's built-in `node:test` (`node --test`).
- Keyboard shortcut: `Ctrl+Shift+E` (default) / `Command+Shift+E` (mac).
- Tab tiles show favicon + title + host only — never screenshots.
- Window names persist via `browser.sessions.setWindowValue` / `getWindowValue` (key `"name"`), never `storage`.
- `model.js` is pure: no DOM, no `browser.*`, no I/O. All browser access lives in `data.js` / `actions.js` / `dnd.js` /
  `background.js`.
- Max line length 140 columns; 4-space indentation in new files.

---

## File Structure

```text
firefox-windows-manager/
├── manifest.json          # MV3 manifest: action, command, permissions, background, min version
├── background.js          # toolbar/command listeners → toggle the single dashboard tab
├── dashboard.html         # the full-page overview shell; loads src/main.js as a module
├── dashboard.css          # exploded-layout styling (window panels, group sections, tiles, toast)
├── icons/
│   └── icon.svg           # toolbar + extension icon (SVG; Firefox renders it directly)
├── src/
│   ├── model.js           # PURE: buildModel, deriveCounts, allTabsOf, tabsToUnloadAllButActive, hostOf
│   ├── data.js            # browser reads: fetchState() → model, subscribe(onChange) → unsubscribe
│   ├── actions.js         # browser mutations: close/focus/unload/rename/move for tabs & groups
│   ├── view.js            # PURE render: render(model) → detached DOM node (no listeners, no API)
│   ├── dnd.js             # drag & drop wiring: attachDnd(container, model, actions)
│   └── main.js            # bootstrap: fetch → render → subscribe (debounced) → event delegation
├── test/
│   └── model.test.js      # node:test unit tests for src/model.js
├── package.json           # { "type": "module", scripts.test = "node --test" }
└── README.md              # what it is, install (about:debugging), shortcuts, permissions, dev/test
```

Responsibility boundaries:

- **Pure core** (`model.js`) is the only unit-tested code; everything else is verified by loading the unpacked extension.
- **Read edge** (`data.js`) and **write edge** (`actions.js`, `dnd.js`) are the *only* places `browser.*` mutating/reading
  calls appear. `view.js` receives a plain object and returns DOM; it imports nothing from `browser`.
- **`main.js`** is the composition root: it wires data → view and delegates DOM events to `actions`/`dnd`.

---

### Task 1: Extension shell — manifest, icon, background toggle, npm test wiring

Delivers a loadable extension: a toolbar button and `Ctrl+Shift+E` that open a placeholder dashboard tab, and re-invoking
either **focuses the existing tab instead of opening a second one**. Also stands up `npm test` (green with zero tests) so
later tasks have a runner.

**Files:**

- Create: `manifest.json`
- Create: `icons/icon.svg`
- Create: `background.js`
- Create: `dashboard.html` (placeholder body for now)
- Create: `dashboard.css` (minimal; expanded in Task 6)
- Create: `package.json`
- Create: `.gitattributes` is NOT needed; skip.

**Interfaces:**

- Consumes: nothing.
- Produces: extension id `tab-window-manager@firefox-windows-manager`; dashboard page reachable at
  `browser.runtime.getURL("dashboard.html")`; the command name `"toggle-overview"`.

- [ ] **Step 1: Write `package.json`**

```json
{
    "name": "firefox-windows-manager",
    "version": "1.0.0",
    "description": "Toggleable full-page overview to manage Firefox windows, tab groups, and tabs.",
    "type": "module",
    "private": true,
    "scripts": {
        "test": "node --test"
    }
}
```

- [ ] **Step 2: Verify the test runner is wired (no tests yet)**

Run: `npm test`
Expected: exits 0. Node prints a summary like `tests 0` / `pass 0` (wording varies by Node version); the key is a clean
exit code, not a crash.

- [ ] **Step 3: Write `icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="6" y="6" width="24" height="24" rx="4" fill="#4c6ef5"/>
    <rect x="34" y="6" width="24" height="24" rx="4" fill="#7048e8"/>
    <rect x="6" y="34" width="24" height="24" rx="4" fill="#7048e8"/>
    <rect x="34" y="34" width="24" height="24" rx="4" fill="#4c6ef5"/>
</svg>
```

- [ ] **Step 4: Write `manifest.json`**

```json
{
    "manifest_version": 3,
    "name": "Tab & Window Manager",
    "version": "1.0.0",
    "description": "A toggleable full-page overview to manage Firefox windows, tab groups, and tabs.",
    "browser_specific_settings": {
        "gecko": {
            "id": "tab-window-manager@firefox-windows-manager",
            "strict_min_version": "139.0"
        }
    },
    "permissions": ["tabs", "tabGroups", "sessions"],
    "background": {
        "scripts": ["background.js"]
    },
    "action": {
        "default_title": "Open Tab & Window Overview",
        "default_icon": "icons/icon.svg"
    },
    "icons": {
        "48": "icons/icon.svg",
        "96": "icons/icon.svg"
    },
    "commands": {
        "toggle-overview": {
            "suggested_key": {
                "default": "Ctrl+Shift+E",
                "mac": "Command+Shift+E"
            },
            "description": "Toggle the Tab & Window overview"
        }
    }
}
```

- [ ] **Step 5: Write `background.js`**

```javascript
const DASHBOARD_URL = browser.runtime.getURL("dashboard.html");

async function toggleOverview() {
    const existing = await browser.tabs.query({ url: DASHBOARD_URL });
    if (existing.length > 0) {
        const tab = existing[0];
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        return;
    }
    await browser.tabs.create({ url: DASHBOARD_URL });
}

browser.action.onClicked.addListener(toggleOverview);
browser.commands.onCommand.addListener((command) => {
    if (command === "toggle-overview") {
        toggleOverview();
    }
});
```

- [ ] **Step 6: Write placeholder `dashboard.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tab & Window Overview</title>
    <link rel="stylesheet" href="dashboard.css">
</head>
<body>
    <main id="app">
        <p>Overview loading…</p>
    </main>
</body>
</html>
```

- [ ] **Step 7: Write minimal `dashboard.css`**

```css
:root {
    color-scheme: light dark;
    font-family: system-ui, -apple-system, sans-serif;
}

body {
    margin: 0;
    padding: 1rem;
}
```

- [ ] **Step 8: Manually verify the toggle in Firefox**

1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → select `manifest.json`.
2. Click the toolbar button. Expected: a new tab opens showing "Overview loading…".
3. Click the toolbar button again. Expected: focus returns to the **same** tab — no second tab is created.
4. Switch to another tab, press `Ctrl+Shift+E` (or `Cmd+Shift+E`). Expected: the existing overview tab is focused.
   (If the shortcut does nothing, it may collide with a Firefox default; note it and confirm the toolbar button works.
   Remap path is documented in the README in Task 9.)

- [ ] **Step 9: Commit**

```bash
git add manifest.json icons/icon.svg background.js dashboard.html dashboard.css package.json \
    docs/superpowers/plans/2026-07-04-tab-window-manager.md
git commit -m "feat: extension shell with toggleable dashboard tab"
```

---

### Task 2: Pure model — buildModel, deriveCounts, hostOf

Delivers the tested core that turns raw browser objects into the normalized view model the UI renders.

**Files:**

- Create: `src/model.js`
- Test: `test/model.test.js`

**Interfaces:**

- Consumes: raw browser shapes. Tabs: `{ id, windowId, url, title, favIconUrl, active, discarded, groupId, index }`
  (`groupId === -1` means ungrouped). Windows: `{ id, focused, incognito, type }`. Groups:
  `{ id, windowId, title, color, collapsed }`. Names: `{ [windowId]: string }`.
- Produces (used by every later task):
  - `hostOf(url: string) → string`
  - `buildModel(windows, tabs, groups, names?) → Model`
  - `deriveCounts(modelWindows) → { windows: number, groups: number, tabs: number }`
  - `Model = { windows: WindowVM[], counts: { windows, groups, tabs } }`
  - `WindowVM = { id, name: string|null, focused: boolean, incognito: boolean, groups: GroupVM[],
    ungrouped: TabVM[], tabCount: number }`
  - `GroupVM = { id, title: string, color: string, collapsed: boolean, windowId, tabs: TabVM[] }`
  - `TabVM = { id, windowId, title: string, url: string, host: string, favIconUrl: string,
    active: boolean, discarded: boolean, groupId: number }`

- [ ] **Step 1: Write the failing tests**

```javascript
// test/model.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOf, buildModel, deriveCounts } from "../src/model.js";

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/model.js'` (or import error).

- [ ] **Step 3: Implement `src/model.js` (this step only, not later functions)**

```javascript
export function hostOf(url) {
    try {
        return new URL(url).host || url;
    } catch {
        return url;
    }
}

export function deriveCounts(modelWindows) {
    let groups = 0;
    let tabs = 0;
    for (const w of modelWindows) {
        groups += w.groups.length;
        tabs += w.tabCount;
    }
    return { windows: modelWindows.length, groups, tabs };
}

function toTile(t) {
    return {
        id: t.id,
        windowId: t.windowId,
        title: t.title || t.url || "Untitled",
        url: t.url || "",
        host: hostOf(t.url || ""),
        favIconUrl: t.favIconUrl || "",
        active: !!t.active,
        discarded: !!t.discarded,
        groupId: t.groupId ?? -1,
    };
}

export function buildModel(windows, tabs, groups, names = {}) {
    const groupsByWindow = new Map();
    for (const g of groups) {
        if (!groupsByWindow.has(g.windowId)) {
            groupsByWindow.set(g.windowId, []);
        }
        groupsByWindow.get(g.windowId).push(g);
    }

    const tabsByWindow = new Map();
    for (const t of tabs) {
        if (!tabsByWindow.has(t.windowId)) {
            tabsByWindow.set(t.windowId, []);
        }
        tabsByWindow.get(t.windowId).push(t);
    }

    const modelWindows = windows.map((w) => {
        const wTabs = (tabsByWindow.get(w.id) || []).slice().sort((a, b) => a.index - b.index);
        const groupById = new Map((groupsByWindow.get(w.id) || []).map((g) => [g.id, g]));
        const grouped = new Map();
        const ungrouped = [];

        for (const t of wTabs) {
            const tile = toTile(t);
            if (tile.groupId !== -1 && groupById.has(tile.groupId)) {
                if (!grouped.has(tile.groupId)) {
                    grouped.set(tile.groupId, []);
                }
                grouped.get(tile.groupId).push(tile);
            } else {
                ungrouped.push(tile);
            }
        }

        const orderOf = (tabId) => wTabs.findIndex((t) => t.id === tabId);
        const groupModels = [...grouped.entries()]
            .map(([gid, tiles]) => {
                const g = groupById.get(gid);
                return {
                    id: gid,
                    title: g.title || "",
                    color: g.color || "grey",
                    collapsed: !!g.collapsed,
                    windowId: w.id,
                    tabs: tiles,
                };
            })
            .sort((a, b) => orderOf(a.tabs[0].id) - orderOf(b.tabs[0].id));

        return {
            id: w.id,
            name: names[w.id] || null,
            focused: !!w.focused,
            incognito: !!w.incognito,
            groups: groupModels,
            ungrouped,
            tabCount: wTabs.length,
        };
    });

    return { windows: modelWindows, counts: deriveCounts(modelWindows) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "feat: pure buildModel/deriveCounts/hostOf with tests"
```

---

### Task 3: Pure model — allTabsOf and tabsToUnloadAllButActive

Delivers the "unload all but active" selection logic as pure, tested functions.

**Files:**

- Modify: `src/model.js` (append two exports)
- Modify: `test/model.test.js` (append tests + import)

**Interfaces:**

- Consumes: `Model` and `WindowVM` from Task 2.
- Produces:
  - `allTabsOf(windowVM) → TabVM[]` (group tabs first in group order, then ungrouped).
  - `tabsToUnloadAllButActive(model, scope) → number[]` where `scope` is the string `"all"` or `{ windowId }`.
    Returns ids of every tab that is neither active nor already discarded, within scope.

- [ ] **Step 1: Append failing tests**

```javascript
// append to test/model.test.js
import { allTabsOf, tabsToUnloadAllButActive } from "../src/model.js";

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `allTabsOf`/`tabsToUnloadAllButActive` are not exported (import throws or assertions error).

- [ ] **Step 3: Append implementation to `src/model.js`**

```javascript
export function allTabsOf(windowVM) {
    return [...windowVM.groups.flatMap((g) => g.tabs), ...windowVM.ungrouped];
}

export function tabsToUnloadAllButActive(model, scope) {
    const windows = scope === "all"
        ? model.windows
        : model.windows.filter((w) => w.id === scope.windowId);
    const ids = [];
    for (const w of windows) {
        for (const t of allTabsOf(w)) {
            if (!t.active && !t.discarded) {
                ids.push(t.id);
            }
        }
    }
    return ids;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests (Task 2 + Task 3) green.

- [ ] **Step 5: Commit**

```bash
git add src/model.js test/model.test.js
git commit -m "feat: allTabsOf and tabsToUnloadAllButActive selection logic"
```

---

### Task 4: Read edge — data.js (fetchState + subscribe)

Delivers the thin browser-read wrapper: one call to snapshot the live browser into a `Model`, and one to subscribe to all
relevant change events. Verified manually via the console because it touches live `browser.*` APIs.

**Files:**

- Create: `src/data.js`

**Interfaces:**

- Consumes: `buildModel` from `model.js`.
- Produces:
  - `fetchState() → Promise<Model>`
  - `subscribe(onChange: () => void) → (() => void)` returning an unsubscribe function.
  - `hasTabGroups() → boolean` (true when `browser.tabGroups` exists).

- [ ] **Step 1: Write `src/data.js`**

```javascript
import { buildModel } from "./model.js";

export function hasTabGroups() {
    return typeof browser.tabGroups !== "undefined";
}

export async function fetchState() {
    const [windows, tabs] = await Promise.all([
        browser.windows.getAll({ windowTypes: ["normal"] }),
        browser.tabs.query({}),
    ]);

    const groups = hasTabGroups() ? await browser.tabGroups.query({}) : [];

    const names = {};
    await Promise.all(
        windows.map(async (w) => {
            names[w.id] = (await browser.sessions.getWindowValue(w.id, "name")) || null;
        }),
    );

    return buildModel(windows, tabs, groups, names);
}

export function subscribe(onChange) {
    const events = [
        browser.tabs.onCreated,
        browser.tabs.onRemoved,
        browser.tabs.onUpdated,
        browser.tabs.onMoved,
        browser.tabs.onActivated,
        browser.tabs.onAttached,
        browser.tabs.onDetached,
        browser.windows.onCreated,
        browser.windows.onRemoved,
        browser.windows.onFocusChanged,
    ];
    if (hasTabGroups()) {
        events.push(
            browser.tabGroups.onCreated,
            browser.tabGroups.onMoved,
            browser.tabGroups.onRemoved,
            browser.tabGroups.onUpdated,
        );
    }

    const handler = () => onChange();
    for (const event of events) {
        event.addListener(handler);
    }
    return () => {
        for (const event of events) {
            event.removeListener(handler);
        }
    };
}
```

- [ ] **Step 2: Temporarily load data.js from the dashboard to verify it reads the browser**

Edit `dashboard.html` `<body>` to load a throwaway module (remove after this task):

```html
<script type="module">
    import { fetchState, subscribe } from "./src/data.js";
    const model = await fetchState();
    console.log("initial model", model);
    subscribe(async () => console.log("changed", await fetchState()));
</script>
```

- [ ] **Step 3: Manually verify in Firefox**

1. Reload the temporary add-on in `about:debugging`, open the overview tab, open its DevTools console (F12).
2. Expected: `initial model` logs an object whose `counts` matches your real window/group/tab totals, and `windows[]`
   contains your windows with nested `groups`/`ungrouped`.
3. In another window, open or close a tab. Expected: a `changed` log fires with an updated model.

- [ ] **Step 4: Revert the throwaway script**

Restore `dashboard.html` to the Task 1 placeholder body (the `<main id="app">` version). The real bootstrap arrives in
Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/data.js dashboard.html
git commit -m "feat: data.js browser read edge (fetchState + subscribe)"
```

---

### Task 5: Pure view — render(model) → DOM

Delivers the read-only renderer: given a `Model`, return a detached DOM tree with the header counts, window panels, group
sub-sections, and tab tiles. No listeners, no `browser.*`. Interactive controls are rendered as buttons carrying
`data-*` attributes that Task 7/8 will delegate on.

**Files:**

- Create: `src/view.js`

**Interfaces:**

- Consumes: `Model`, `WindowVM`, `GroupVM`, `TabVM` from `model.js`.
- Produces: `render(model, options?) → HTMLElement` — a single detached container element (`<div class="overview">…`).
  `options.tabGroupsSupported` (boolean, default `true`) toggles a notice when `tabGroups` is unavailable.
  DOM contract that later tasks rely on (attributes are the wiring surface):
  - Root: `<div class="overview">`.
  - Header: `<header class="counts">` containing `<span class="count-windows">`, `.count-groups`, `.count-tabs`, and a
    button `<button class="btn-unload-all" data-action="unload-all-global">`.
  - Each window: `<section class="window" data-window-id="ID">` with a header holding an editable
    `<span class="window-name" data-window-id="ID" tabindex="0" role="textbox">`, a `.window-tabcount`, a
    `<button data-action="unload-all-window" data-window-id="ID">`, and a drop zone body `<div class="window-body">`.
  - Each group: `<section class="group" data-group-id="ID" data-window-id="WID" draggable="true">` with a header
    `<div class="group-header">` showing `.group-title` and a `<button data-action="close-group" data-group-id="ID">`.
  - Each tab tile: `<article class="tab" data-tab-id="ID" data-window-id="WID" draggable="true">` (adds classes
    `active` / `discarded`), containing an `<img class="tab-favicon">`, `.tab-title`, `.tab-host`, and buttons
    `data-action="focus-tab"`, `data-action="unload-tab"`, `data-action="close-tab"` (each with `data-tab-id`).
  - A trailing `<div class="new-window-dropzone" data-action="drop-new-window">` after all window panels.

- [ ] **Step 1: Write `src/view.js`**

```javascript
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text != null) {
        node.textContent = text;
    }
    return node;
}

function button(action, label, dataset = {}) {
    const b = el("button", null, label);
    b.dataset.action = action;
    for (const [k, v] of Object.entries(dataset)) {
        b.dataset[k] = String(v);
    }
    return b;
}

function renderTab(tab) {
    const article = el("article", "tab");
    article.classList.toggle("active", tab.active);
    article.classList.toggle("discarded", tab.discarded);
    article.dataset.tabId = String(tab.id);
    article.dataset.windowId = String(tab.windowId);
    article.draggable = true;

    const favicon = el("img", "tab-favicon");
    favicon.src = tab.favIconUrl || "icons/icon.svg";
    favicon.alt = "";
    favicon.addEventListener("error", () => { favicon.src = "icons/icon.svg"; });

    const meta = el("div", "tab-meta");
    meta.append(el("div", "tab-title", tab.title), el("div", "tab-host", tab.host));

    const controls = el("div", "tab-controls");
    controls.append(
        button("focus-tab", "Go", { tabId: tab.id }),
        button("unload-tab", "Unload", { tabId: tab.id }),
        button("close-tab", "✕", { tabId: tab.id }),
    );

    article.append(favicon, meta, controls);
    return article;
}

function renderGroup(group) {
    const section = el("section", `group group-${group.color}`);
    section.dataset.groupId = String(group.id);
    section.dataset.windowId = String(group.windowId);
    section.draggable = true;

    const header = el("div", "group-header");
    header.append(
        el("span", "group-title", group.title || "Group"),
        button("close-group", "Close group", { groupId: group.id }),
    );

    const body = el("div", "group-tabs");
    for (const tab of group.tabs) {
        body.append(renderTab(tab));
    }

    section.append(header, body);
    return section;
}

function renderWindow(windowVM) {
    const section = el("section", "window");
    section.dataset.windowId = String(windowVM.id);
    if (windowVM.focused) {
        section.classList.add("focused");
    }

    const header = el("div", "window-header");
    const name = el("span", "window-name", windowVM.name || `Window ${windowVM.id}`);
    name.dataset.windowId = String(windowVM.id);
    name.tabIndex = 0;
    name.setAttribute("role", "textbox");
    name.title = "Click to rename";
    header.append(
        name,
        el("span", "window-tabcount", `${windowVM.tabCount} tabs`),
        button("unload-all-window", "Unload all but active", { windowId: windowVM.id }),
    );

    const body = el("div", "window-body");
    for (const group of windowVM.groups) {
        body.append(renderGroup(group));
    }
    for (const tab of windowVM.ungrouped) {
        body.append(renderTab(tab));
    }

    section.append(header, body);
    return section;
}

export function render(model, options = {}) {
    const supported = options.tabGroupsSupported !== false;
    const root = el("div", "overview");

    const header = el("header", "counts");
    header.append(
        el("span", "count-windows", `${model.counts.windows} windows`),
        el("span", "count-sep", "·"),
        el("span", "count-groups", `${model.counts.groups} groups`),
        el("span", "count-sep", "·"),
        el("span", "count-tabs", `${model.counts.tabs} tabs`),
        button("unload-all-global", "Unload all but active (everywhere)", {}),
    );
    root.append(header);

    if (!supported) {
        root.append(el("p", "notice", "Tab groups need Firefox 139+ — showing windows and tabs only."));
    }

    const grid = el("div", "windows-grid");
    for (const windowVM of model.windows) {
        grid.append(renderWindow(windowVM));
    }
    root.append(grid);

    root.append(el("div", "new-window-dropzone", "Drop here to open in a new window"));
    root.querySelector(".new-window-dropzone").dataset.action = "drop-new-window";

    return root;
}
```

- [ ] **Step 2: Temporarily render a sample model to verify layout**

Add a throwaway module to `dashboard.html` `<body>` (removed in Task 6):

```html
<script type="module">
    import { render } from "./src/view.js";
    const sample = {
        counts: { windows: 1, groups: 1, tabs: 3 },
        windows: [{
            id: 1, name: "Research", focused: true, incognito: false, tabCount: 3,
            groups: [{ id: 100, title: "Docs", color: "blue", collapsed: false, windowId: 1, tabs: [
                { id: 10, windowId: 1, title: "MDN", url: "https://developer.mozilla.org/", host: "developer.mozilla.org",
                  favIconUrl: "", active: true, discarded: false, groupId: 100 },
            ] }],
            ungrouped: [
                { id: 11, windowId: 1, title: "Example", url: "https://example.com/", host: "example.com",
                  favIconUrl: "", active: false, discarded: true, groupId: -1 },
            ],
        }],
    };
    document.getElementById("app").replaceChildren(render(sample));
</script>
```

- [ ] **Step 3: Manually verify in Firefox**

1. Reload the temporary add-on, open the overview tab.
2. Expected: header reads "1 windows · 1 groups · 3 tabs"; one window panel titled "Research"; a "Docs" group containing
   an "MDN" tile marked active; an "Example" tile shown dimmed (discarded); and a "Drop here…" zone at the bottom.

- [ ] **Step 4: Remove the throwaway script**

Restore `dashboard.html` to the Task 1 placeholder body.

- [ ] **Step 5: Commit**

```bash
git add src/view.js dashboard.html
git commit -m "feat: view.js renders counts, windows, groups, and tab tiles"
```

---

### Task 6: Bootstrap — main.js live read-only overview + real dashboard shell

Delivers the working, live-updating **read-only** overview: on load it fetches state and renders; browser changes
re-render (debounced). Buttons and drag exist in the DOM but are not yet wired (Tasks 7–8).

**Files:**

- Create: `src/main.js`
- Modify: `dashboard.html` (load `src/main.js`)
- Modify: `dashboard.css` (real exploded-layout styles)

**Interfaces:**

- Consumes: `fetchState`, `subscribe`, `hasTabGroups` from `data.js`; `render` from `view.js`.
- Produces: `getModel() → Model|null` on the module (exported for Tasks 7–8 to read the current model), and a
  `rerender()` used internally. Exports `state` object `{ model }` so action handlers can read the latest model.

- [ ] **Step 1: Write `src/main.js`**

```javascript
import { fetchState, subscribe, hasTabGroups } from "./data.js";
import { render } from "./view.js";

export const state = { model: null };

const app = document.getElementById("app");

async function rerender() {
    state.model = await fetchState();
    const tree = render(state.model, { tabGroupsSupported: hasTabGroups() });
    tree.classList.add("just-updated");
    app.replaceChildren(tree);
    requestAnimationFrame(() => tree.classList.remove("just-updated"));
}

function debounce(fn, ms) {
    let timer = null;
    return () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(fn, ms);
    };
}

async function main() {
    await rerender();
    subscribe(debounce(rerender, 150));
}

main();
```

- [ ] **Step 2: Point `dashboard.html` at the real bootstrap**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tab & Window Overview</title>
    <link rel="stylesheet" href="dashboard.css">
</head>
<body>
    <main id="app"></main>
    <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write the real `dashboard.css`**

```css
:root {
    color-scheme: light dark;
    font-family: system-ui, -apple-system, sans-serif;
    --tile-bg: color-mix(in srgb, canvas 88%, canvastext 12%);
    --border: color-mix(in srgb, canvas 70%, canvastext 30%);
}

body {
    margin: 0;
    padding: 1rem;
    background: canvas;
    color: canvastext;
}

.counts {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.counts .btn-unload-all,
.counts button {
    margin-left: auto;
    font-weight: 500;
}

.overview.just-updated .counts {
    animation: pulse 0.4s ease-out;
}

@keyframes pulse {
    from { opacity: 0.4; }
    to { opacity: 1; }
}

.notice {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--tile-bg);
}

.windows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
    align-items: start;
}

.window {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem;
    background: color-mix(in srgb, canvas 95%, canvastext 5%);
}

.window.focused {
    border-color: #4c6ef5;
    box-shadow: 0 0 0 2px color-mix(in srgb, #4c6ef5 40%, transparent);
}

.window-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.window-name {
    font-weight: 600;
    cursor: text;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
}

.window-name:hover {
    background: var(--tile-bg);
}

.window-name[contenteditable="true"] {
    outline: 2px solid #4c6ef5;
    cursor: text;
}

.window-tabcount {
    color: color-mix(in srgb, canvastext 60%, canvas 40%);
    font-size: 0.85rem;
}

.window-body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-height: 2rem;
}

.window-body.drop-target,
.new-window-dropzone.drop-target {
    outline: 2px dashed #4c6ef5;
    outline-offset: 2px;
}

.group {
    border-left: 4px solid var(--border);
    border-radius: 6px;
    padding: 0.3rem 0.4rem;
    background: var(--tile-bg);
}

.group-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
}

.group-blue { border-left-color: #4c6ef5; }
.group-cyan { border-left-color: #15aabf; }
.group-red { border-left-color: #fa5252; }
.group-yellow { border-left-color: #fab005; }
.group-green { border-left-color: #40c057; }
.group-pink { border-left-color: #e64980; }
.group-purple { border-left-color: #7048e8; }
.group-orange { border-left-color: #fd7e14; }
.group-grey { border-left-color: #868e96; }

.group-tabs {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: canvas;
    cursor: grab;
}

.tab.active {
    border-color: #4c6ef5;
    font-weight: 600;
}

.tab.discarded {
    opacity: 0.55;
}

.tab-favicon {
    width: 16px;
    height: 16px;
    flex: none;
}

.tab-meta {
    min-width: 0;
    flex: 1;
}

.tab-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tab-host {
    font-size: 0.75rem;
    color: color-mix(in srgb, canvastext 55%, canvas 45%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tab-controls {
    display: flex;
    gap: 0.2rem;
    flex: none;
}

.tab-controls button {
    font-size: 0.75rem;
    padding: 0.1rem 0.35rem;
}

.new-window-dropzone {
    margin-top: 1rem;
    padding: 1rem;
    text-align: center;
    border: 2px dashed var(--border);
    border-radius: 10px;
    color: color-mix(in srgb, canvastext 55%, canvas 45%);
}

.toast {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: #fa5252;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 10;
}
```

- [ ] **Step 4: Manually verify the live read-only overview**

1. Reload the temporary add-on, open the overview tab.
2. Expected: real counts and one panel per open window, with your actual groups and tabs; the active tab in each window is
   highlighted; discarded tabs are dimmed.
3. In another window open a new tab, then close one. Expected: within ~150ms the overview re-renders with updated counts
   (a brief pulse on the header).
4. Buttons and dragging do nothing yet — that is expected.

- [ ] **Step 5: Commit**

```bash
git add src/main.js dashboard.html dashboard.css
git commit -m "feat: live read-only overview via main.js bootstrap"
```

---

### Task 7: Write edge — actions.js + wire clicks and rename

Delivers all non-drag mutations: focus/close/unload a tab, unload-all-but-active (window + global), close a group, and
rename a window inline. `main.js` gains one delegated click handler and rename wiring; failures show a toast.

**Files:**

- Create: `src/actions.js`
- Modify: `src/main.js` (event delegation + rename + toast)

**Interfaces:**

- Consumes: `tabsToUnloadAllButActive` from `model.js`; the `state.model` from `main.js`.
- Produces (all return `Promise` and throw on API failure):
  - `focusTab(tabId, windowId)`, `closeTab(tabId)`, `unloadTab(tabId)`
  - `closeGroup(model, groupId)`
  - `renameWindow(windowId, name)`
  - `unloadAllButActive(model, scope)` where `scope === "all"` or `{ windowId }`
- `main.js` exports unchanged (`state`, `getModel` not required — handlers read `state.model`).

- [ ] **Step 1: Write `src/actions.js`**

```javascript
import { tabsToUnloadAllButActive, allTabsOf } from "./model.js";

export async function focusTab(tabId, windowId) {
    await browser.tabs.update(tabId, { active: true });
    await browser.windows.update(windowId, { focused: true });
}

export async function closeTab(tabId) {
    await browser.tabs.remove(tabId);
}

export async function unloadTab(tabId) {
    await browser.tabs.discard(tabId);
}

export async function unloadAllButActive(model, scope) {
    const ids = tabsToUnloadAllButActive(model, scope);
    if (ids.length > 0) {
        await browser.tabs.discard(ids);
    }
}

export async function closeGroup(model, groupId) {
    const ids = [];
    for (const w of model.windows) {
        for (const g of w.groups) {
            if (g.id === groupId) {
                ids.push(...g.tabs.map((t) => t.id));
            }
        }
    }
    if (ids.length > 0) {
        await browser.tabs.remove(ids);
    }
}

export async function renameWindow(windowId, name) {
    const trimmed = name.trim();
    if (trimmed) {
        await browser.sessions.setWindowValue(windowId, "name", trimmed);
    } else {
        await browser.sessions.removeWindowValue(windowId, "name");
    }
}
```

- [ ] **Step 2: Wire delegation, rename, and toast in `src/main.js`**

Add these imports at the top and the handler code after `main()` is defined (keep the existing `rerender`/`debounce`):

```javascript
import {
    focusTab, closeTab, unloadTab, unloadAllButActive, closeGroup, renameWindow,
} from "./actions.js";

function showToast(message) {
    const existing = document.querySelector(".toast");
    if (existing) {
        existing.remove();
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function run(promise) {
    try {
        await promise;
    } catch (err) {
        console.error(err);
        showToast(`Action failed: ${err?.message ?? err}`);
    }
}

app.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger || !state.model) {
        return;
    }
    const { action, tabId, windowId, groupId } = trigger.dataset;
    const num = (v) => Number(v);
    switch (action) {
        case "focus-tab": {
            const tile = trigger.closest(".tab");
            run(focusTab(num(tabId), num(tile.dataset.windowId)));
            break;
        }
        case "close-tab":
            run(closeTab(num(tabId)));
            break;
        case "unload-tab":
            run(unloadTab(num(tabId)));
            break;
        case "close-group":
            run(closeGroup(state.model, num(groupId)));
            break;
        case "unload-all-window":
            run(unloadAllButActive(state.model, { windowId: num(windowId) }));
            break;
        case "unload-all-global":
            run(unloadAllButActive(state.model, "all"));
            break;
        default:
            break;
    }
});

app.addEventListener("dblclick", (event) => {
    const name = event.target.closest(".window-name");
    if (!name) {
        return;
    }
    startRename(name);
});

function startRename(nameEl) {
    const windowId = Number(nameEl.dataset.windowId);
    nameEl.contentEditable = "true";
    nameEl.focus();
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const commit = async () => {
        nameEl.contentEditable = "false";
        nameEl.removeEventListener("blur", commit);
        nameEl.removeEventListener("keydown", onKey);
        await run(renameWindow(windowId, nameEl.textContent));
        rerender();
    };
    const onKey = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            nameEl.blur();
        } else if (e.key === "Escape") {
            e.preventDefault();
            nameEl.removeEventListener("blur", commit);
            nameEl.contentEditable = "false";
            rerender();
        }
    };
    nameEl.addEventListener("blur", commit);
    nameEl.addEventListener("keydown", onKey);
}
```

Also change the rename affordance: in `view.js` the `.window-name` has `title="Click to rename"`; update that text to
`"Double-click to rename"` for accuracy.

- [ ] **Step 3: Manually verify each action in Firefox**

1. Reload the add-on, open the overview.
2. **Focus:** click "Go" on a non-active tab → that tab activates and its window comes forward; overview reflects the new
   active tab.
3. **Close tab:** click "✕" on a tab → it disappears from the panel and the tab count drops.
4. **Unload tab:** click "Unload" on a loaded, non-active tab → it becomes dimmed (discarded).
5. **Unload all but active (window):** click the window button → every non-active tab in that panel dims; the active tab
   stays loaded.
6. **Unload all but active (global):** click the header button → same across all windows.
7. **Close group:** click "Close group" → all its tabs close and the group section disappears.
8. **Rename:** double-click a window name, type "Work", press Enter → name persists in the panel. Then fully quit and
   reopen Firefox with session restore on, reopen the overview → the window still shows "Work".

- [ ] **Step 4: Commit**

```bash
git add src/actions.js src/main.js src/view.js
git commit -m "feat: wire tab/group/window actions and inline window rename"
```

---

### Task 8: Drag & drop — move tabs and groups between windows and to new windows

Delivers dragging a tab tile or a group section onto another window panel to move it there, and onto the bottom drop zone to
open it in a new window.

**Files:**

- Create: `src/dnd.js`
- Modify: `src/actions.js` (append move functions)
- Modify: `src/main.js` (attach dnd after each render)

**Interfaces:**

- Consumes: `state.model` from `main.js`; move actions below.
- Produces in `actions.js`:
  - `moveTabToWindow(tabId, windowId)` → `browser.tabs.move(tabId, { windowId, index: -1 })`
  - `moveTabToNewWindow(tabId)` → `browser.windows.create({ tabId })`
  - `moveGroupToWindow(groupId, windowId)` → `browser.tabGroups.move(groupId, { windowId, index: -1 })`
  - `moveGroupToNewWindow(groupId)` → create a blank window, `tabGroups.move` the group in, close the blank tab
- Produces in `dnd.js`: `attachDnd(container, { onDropTab, onDropGroup, onDropTabNewWindow, onDropGroupNewWindow })` that
  wires `dragstart`/`dragover`/`dragleave`/`drop` via delegation on `container`.

- [ ] **Step 1: Append move actions to `src/actions.js`**

```javascript
export async function moveTabToWindow(tabId, windowId) {
    await browser.tabs.move(tabId, { windowId, index: -1 });
}

export async function moveTabToNewWindow(tabId) {
    await browser.windows.create({ tabId });
}

export async function moveGroupToWindow(groupId, windowId) {
    await browser.tabGroups.move(groupId, { windowId, index: -1 });
}

export async function moveGroupToNewWindow(groupId) {
    const win = await browser.windows.create();
    const blankTabId = win.tabs[0].id;
    await browser.tabGroups.move(groupId, { windowId: win.id, index: -1 });
    await browser.tabs.remove(blankTabId);
}
```

- [ ] **Step 2: Write `src/dnd.js`**

```javascript
export function attachDnd(container, handlers) {
    container.addEventListener("dragstart", (event) => {
        const group = event.target.closest(".group");
        const tab = event.target.closest(".tab");
        // A tab inside a group must win over the group for tab drags.
        if (tab) {
            event.dataTransfer.setData("application/x-kind", "tab");
            event.dataTransfer.setData("application/x-id", tab.dataset.tabId);
            event.dataTransfer.effectAllowed = "move";
        } else if (group) {
            event.dataTransfer.setData("application/x-kind", "group");
            event.dataTransfer.setData("application/x-id", group.dataset.groupId);
            event.dataTransfer.effectAllowed = "move";
        }
    });

    const dropZone = (target) =>
        target.closest(".window-body") || target.closest(".new-window-dropzone");

    container.addEventListener("dragover", (event) => {
        const zone = dropZone(event.target);
        if (zone) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            zone.classList.add("drop-target");
        }
    });

    container.addEventListener("dragleave", (event) => {
        const zone = dropZone(event.target);
        if (zone) {
            zone.classList.remove("drop-target");
        }
    });

    container.addEventListener("drop", (event) => {
        const zone = dropZone(event.target);
        if (!zone) {
            return;
        }
        event.preventDefault();
        zone.classList.remove("drop-target");

        const kind = event.dataTransfer.getData("application/x-kind");
        const id = Number(event.dataTransfer.getData("application/x-id"));
        if (!kind || !id) {
            return;
        }

        const isNewWindow = zone.classList.contains("new-window-dropzone");
        if (isNewWindow) {
            if (kind === "tab") {
                handlers.onDropTabNewWindow(id);
            } else {
                handlers.onDropGroupNewWindow(id);
            }
            return;
        }

        const windowId = Number(zone.closest(".window").dataset.windowId);
        if (kind === "tab") {
            handlers.onDropTab(id, windowId);
        } else {
            handlers.onDropGroup(id, windowId);
        }
    });
}
```

- [ ] **Step 3: Attach dnd in `src/main.js`**

Add the import and call `attachDnd` once, targeting the persistent `app` container (delegation survives re-renders because
`app` itself is not replaced — only its children are):

```javascript
import { attachDnd } from "./dnd.js";
import {
    moveTabToWindow, moveTabToNewWindow, moveGroupToWindow, moveGroupToNewWindow,
} from "./actions.js";

attachDnd(app, {
    onDropTab: (tabId, windowId) => run(moveTabToWindow(tabId, windowId)),
    onDropGroup: (groupId, windowId) => run(moveGroupToWindow(groupId, windowId)),
    onDropTabNewWindow: (tabId) => run(moveTabToNewWindow(tabId)),
    onDropGroupNewWindow: (groupId) => run(moveGroupToNewWindow(groupId)),
});
```

Place this call after `showToast`/`run` are defined and after `main()` is invoked (order within the module is fine as long
as `run` is defined before the listeners fire, which they only do on user interaction).

- [ ] **Step 4: Manually verify drag & drop in Firefox**

Prerequisite: at least two normal windows open, one with a tab group.

1. Reload the add-on, open the overview.
2. **Tab → window:** drag a tab tile from Window A's panel onto Window B's body. Expected: the panel body highlights while
   hovering; on drop the tab moves to Window B (verify in the real window and in the re-rendered overview).
3. **Group → window:** drag a group's header onto another window's body. Expected: the whole group (title + color + tabs)
   moves to that window.
4. **Tab → new window:** drag a tab onto the bottom "Drop here…" zone. Expected: a new window opens containing that tab.
5. **Group → new window:** drag a group onto the bottom zone. Expected: a new window opens containing the intact group and
   no leftover blank tab.

- [ ] **Step 5: Commit**

```bash
git add src/dnd.js src/actions.js src/main.js
git commit -m "feat: drag & drop tabs and groups between and into new windows"
```

---

### Task 9: Robustness pass — tabGroups-absent path, favicon fallback check, and README

Delivers the graceful-degradation notice for older Firefox, confirms the error toast path, and documents install/use/dev.

**Files:**

- Modify: `README.md` (create)
- Verify only: `src/view.js`, `src/data.js`, `src/main.js` (no code change unless a check fails)

**Interfaces:**

- Consumes: everything built so far.
- Produces: `README.md`.

- [ ] **Step 1: Confirm the tabGroups-absent path already works**

Read `src/data.js` (`hasTabGroups`, `fetchState` returning `groups: []`) and `src/main.js` (passes
`{ tabGroupsSupported: hasTabGroups() }` to `render`). Confirm that when `browser.tabGroups` is undefined, `fetchState`
returns a model with empty groups and `render` shows the notice. No code change expected — this was built in Tasks 4–6.
If any wiring is missing, fix it now so the dashboard renders windows/tabs plus the notice instead of throwing.

- [ ] **Step 2: Write `README.md`**

````markdown
# Tab & Window Manager (Firefox)

A toggleable full-page overview for managing your Firefox windows, tab groups, and tabs — an "exploded" layout showing
every window side by side.

## Features

- One toggle (toolbar button or `Ctrl+Shift+E` / `Cmd+Shift+E`) opens a single overview tab; re-toggling focuses it.
- Header counts: windows · groups · tabs.
- One panel per window; tab groups shown as colored sub-sections; tabs as favicon + title + host tiles.
- Rename windows (double-click the name) — names persist across restarts via Firefox session restore.
- Per tab: go to it, close it, or unload (discard) it.
- "Unload all but active" per window and globally.
- Close a tab group.
- Drag a tab or a group onto another window to move it there, or onto the bottom zone to open it in a new window.

## Requirements

- Firefox 139 or newer (uses the `tabGroups` API). On older Firefox the overview still shows windows and tabs, with a
  notice that groups need 139+.

## Install (temporary, for development)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `manifest.json` in this folder.
3. The toolbar button appears; click it or press the shortcut.

Temporary add-ons are removed when Firefox restarts; reload from `about:debugging` after each restart.

## Keyboard shortcut

Default `Ctrl+Shift+E` (`Cmd+Shift+E` on macOS). If it collides with another binding, change it at
`about:addons` → gear icon → **Manage Extension Shortcuts**.

## Permissions

- `tabs` — read tab metadata and move/close/discard tabs.
- `tabGroups` — read and move tab groups.
- `sessions` — store per-window names that survive restarts.

No host permissions, no network access, no data leaves the browser.

## Development

- No build step; edit the files and reload the temporary add-on.
- Run unit tests for the pure model: `npm test` (uses Node's built-in test runner; no dependencies).
- Architecture and design notes: `docs/superpowers/specs/2026-07-04-tab-window-manager-design.md`.
````

- [ ] **Step 3: Manually verify the error toast path**

With the overview open, in the DevTools console run `browser.tabs.remove(999999)` is not the target — instead verify the
app's own path: click a tab's "✕", then immediately click it again on a stale tile that no longer exists is hard to force;
simpler check — temporarily edit `closeTab` to `throw new Error("boom")`, reload, click "✕", confirm a red toast reads
"Action failed: boom", then revert the edit.

- [ ] **Step 4: Verify the whole feature end-to-end once more**

Run through: toggle open/focus, counts correct, rename+persist, close/unload/unload-all, close group, drag tab and group
between windows and to new windows, live update when changing tabs in another window. All should work with no console
errors.

- [ ] **Step 5: Commit**

```bash
git add README.md src/view.js src/data.js src/main.js
git commit -m "docs: README; confirm tabGroups-absent degradation and toast path"
```

---

## Self-Review

Spec coverage against `docs/superpowers/specs/2026-07-04-tab-window-manager-design.md`:

- Toggleable full-page dashboard (button + shortcut) → Task 1.
- Header counts (windows/groups/tabs) → Tasks 2, 5, 6.
- Exploded layout: window panels, group sub-sections, ungrouped area, favicon/title/host tiles → Tasks 5, 6.
- Editable, persistent window names (`sessions` API) → Task 7.
- Per-tab focus/close/unload → Task 7.
- Per-group close (and move via drag) → Tasks 7 (close), 8 (move).
- Unload all but active (window + global) → Tasks 3, 7.
- Drag & drop between windows; drop on empty area = new window → Task 8.
- Live updates from change events → Tasks 4, 6.
- Error handling: toast + `tabGroups`-absent notice → Tasks 6, 7, 9.
- Testing: `node:test` for pure model → Tasks 2, 3.
- Permissions exactly `tabs`/`tabGroups`/`sessions`; min version 139; no build step → Task 1 (Global Constraints).

No placeholders remain: every code step includes complete code; every verification step lists exact clicks and expected
results. Type/name consistency checked: `state.model`, `render(model, options)`, `attachDnd(container, handlers)`,
`tabsToUnloadAllButActive(model, scope)`, and the `data-action` attribute names match across `view.js`, `main.js`, and
`dnd.js`.
