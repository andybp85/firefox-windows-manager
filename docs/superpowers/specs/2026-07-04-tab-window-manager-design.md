# Firefox Tab & Window Manager — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design)
**Beans:** epic `firefox-windows-manager-87l3`

## Purpose

A Firefox extension that provides a single, toggleable **full-page overview** for
managing every open window, tab group, and tab at a glance — an "exploded"
Mission-Control-style layout. From the overview the user can see counts, name
windows, close/move tabs and groups, and unload tabs.

## Users & Success Criteria

- A user with many windows/tabs opens the overview and immediately understands
  how much is open and where.
- Reorganizing is direct: drag a tab or group to another window; rename a window;
  close or unload with one click.
- The overview reflects reality live — opening/closing tabs elsewhere updates it.

## Scope

### In scope
- Toggleable full-page dashboard (toolbar button + keyboard shortcut).
- Header counts: windows, groups, tabs.
- Exploded layout: one panel per window; tab groups as tinted sub-sections;
  ungrouped tabs in a default area; tabs as favicon + title + host tiles.
- Editable, persistent window names.
- Per-tab: focus, close, unload (discard).
- Per-group: close, move.
- Window-level and global **"Unload all but active"**.
- Drag & drop tabs and groups between windows; drop on empty area = new window.
- Live updates from tab/window/group change events.

### Out of scope (YAGNI)
- **Plugin-managed save & close of groups.** Firefox has native save-and-close,
  but the `tabGroups` API can neither see native saved groups nor trigger native
  save — so a plugin version would be a separate, parallel store invisible to
  native. Deferred; the "saved sets" idea belongs to the exploratory curated-lists
  bean (`firefox-windows-manager-1vx8`), built as one deliberate cross-cutting
  store rather than duplicating a native feature. Users save groups via Firefox's
  own gesture.
- Cross-device sync, cloud storage.
- Session/workspace management.
- Bookmarks integration, history, search across tabs (could be a follow-up).
- Per-tab live screenshots/thumbnails (not reliably possible via the APIs;
  decided against — tiles use favicon + title instead).
- Reordering tabs *within* a window (move-between-windows is the goal; intra-window
  ordering is not a target for v1).

## Constraints & Platform Decisions

- **Manifest V3** WebExtension.
- **No framework, no build step.** Vanilla HTML/CSS/JS with ES modules
  (prefer-the-platform default). A small `state → view` render loop: user actions
  dispatch updates that call browser APIs; API change events refresh state and
  re-render.
- **Requires Firefox 139+** for the `tabGroups` API.
- **Permissions:** `tabs`, `tabGroups`, `sessions`. (No `storage` — window names
  live in the `sessions` per-window store; there is no other persistence in v1.)
- **Test runner:** Node's built-in `node:test` for the pure `model.js` units;
  zero runtime dependencies.
- **Tiles:** favicon + title + host (no screenshots). "Exploded" feel comes from
  spatial layout, not captures.

## Architecture

Three cooperating pieces:

### 1. Background event script (`background.js`)
- Registers the toolbar action and the keyboard command
  (`Ctrl+Shift+E` / `Cmd+Shift+E`).
- **Toggle semantics:** if a dashboard tab already exists, focus it (and its
  window); otherwise open one. Never spawns duplicates.
- Non-persistent (event-driven); holds no long-lived UI state.

### 2. Dashboard page (`dashboard.html` + modules)
- The full-tab UI. Renders the current model and wires interactions.
- Modules:
  - `main.js` — bootstraps: builds initial state, subscribes to events, renders.
  - `view.js` — pure render: `(state) → DOM`. No API calls.
  - `actions.js` — the imperative edge: calls browser APIs in response to user
    intent (close, move, discard, rename).
  - `dnd.js` — drag & drop wiring (drag sources, drop targets, drop resolution).

### 3. Domain / state module (`model.js`)
- **Pure functions** — the testable core, no DOM, no live API:
  - `buildModel(windows, tabs, groups, names)` → normalized view model
    (windows → groups → tabs, plus ungrouped; derived counts).
  - `deriveCounts(model)` → `{ windows, groups, tabs }`.
  - `tabsToUnloadAllButActive(model, scope)` → tab ids to discard (skips each
    window's active tab; `scope` = one window or all).
- Live data acquisition and event subscription live in `data.js` (thin wrapper
  over `browser.windows/tabs/tabGroups/sessions`), kept separate so `model.js`
  stays pure.

## Data Flow

```
browser.* events ─▶ data.js ─▶ buildModel() ─▶ view.render(state)
        ▲                                            │
        └──────────── actions.js (API calls) ◀── user interaction (click / drag)
```

Any tab/window/group change re-runs `buildModel` and re-renders. Actions never
mutate the DOM directly; they call APIs and let the resulting events drive the
re-render (single source of truth = the browser).

## Feature Details

### Counts
`deriveCounts(model)` in the header: *N windows · M groups · K tabs*, with a
subtle "updated" pulse when the model refreshes.

### Window panels & naming
- One panel per window, grid-laid-out (responsive).
- Window title is click-to-edit. Names persist via
  `sessions.setWindowValue(windowId, 'name', value)` / `getWindowValue`, which
  survives Firefox session restore — no fragile window-matching heuristics.
  (Names are keyed to the live window; a window not restored simply has no name.)

### Tab groups
- Rendered as titled, color-tinted sub-sections (color from `tabGroups`).
- Actions: close group, move group (drag). (Native Firefox save-and-close remains
  available to the user through Firefox's own UI; the plugin does not reimplement
  it — see Out of scope.)

### Tabs (tiles)
- Favicon, title, host; active tab highlighted; discarded tab dimmed.
- Actions: focus (activates tab + focuses its window), close, unload (`discard`).

### Unload / "all but active"
- Per-tab unload → `tabs.discard(tabId)`.
- Window-level and global "Unload all but active" → discard every tab except each
  window's active tab. (Firefox refuses to discard a window's active tab, so those
  remain loaded by design.)

### Move between windows (drag & drop)
- Drag a tab tile or a group header onto another window panel → `tabs.move` (and
  group association) into that window.
- Drop onto empty dashboard area → move into a **new window**.

## Error Handling

- API calls in `actions.js` are wrapped; failures surface a non-blocking toast and
  are logged. State is not optimistically mutated, so a failed action simply leaves
  the last-known-good model rendered (the next event refresh reconciles).
- Missing/absent `tabGroups` (older Firefox) → dashboard still renders windows/tabs
  and shows a "tab groups need Firefox 139+" notice instead of failing.

## Testing

- **Unit (pure):** `model.js` — `buildModel` normalization, `deriveCounts`,
  `tabsToUnloadAllButActive` (including active-tab exclusion and scope). Run with
  `node:test`, no browser.
- **Manual/integration:** load unpacked via `about:debugging`, drive real flows —
  toggle, rename+restart persistence, close/move/unload, live update when tabs
  change externally.

## Resolved Decisions

- **Save & close:** deferred to native Firefox; not reimplemented (see Out of
  scope). Rationale: the `tabGroups` API can neither read native saved groups nor
  trigger native save.
- **Test runner:** Node's built-in `node:test`, zero runtime deps.
