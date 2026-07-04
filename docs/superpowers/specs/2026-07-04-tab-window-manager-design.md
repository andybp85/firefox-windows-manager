# Firefox Tab & Window Manager — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design)
**Beans:** epic `firefox-windows-manager-87l3`

## Purpose

A Firefox extension that provides a single, toggleable **full-page overview** for
managing every open window, tab group, and tab at a glance — an "exploded"
Mission-Control-style layout. From the overview the user can see counts, name
windows, close/move tabs and groups, unload tabs, and save-and-close groups for
later restore.

## Users & Success Criteria

- A user with many windows/tabs opens the overview and immediately understands
  how much is open and where.
- Reorganizing is direct: drag a tab or group to another window; rename a window;
  close or unload with one click.
- Saved groups survive being closed and can be reopened later.
- The overview reflects reality live — opening/closing tabs elsewhere updates it.

## Scope

### In scope
- Toggleable full-page dashboard (toolbar button + keyboard shortcut).
- Header counts: windows, groups, tabs.
- Exploded layout: one panel per window; tab groups as tinted sub-sections;
  ungrouped tabs in a default area; tabs as favicon + title + host tiles.
- Editable, persistent window names.
- Per-tab: focus, close, unload (discard).
- Per-group: close, move, **save & close** (persist then close).
- Window-level and global **"Unload all but active"**.
- Drag & drop tabs and groups between windows; drop on empty area = new window.
- Saved-groups area with restore.
- Live updates from tab/window/group change events.

### Out of scope (YAGNI)
- Cross-device sync, cloud storage.
- Session/workspace management beyond saved groups.
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
- **Permissions:** `tabs`, `tabGroups`, `sessions`, `storage`.
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
    intent (close, move, discard, rename, save-group, restore).
  - `dnd.js` — drag & drop wiring (drag sources, drop targets, drop resolution).

### 3. Domain / state module (`model.js`)
- **Pure functions** — the testable core, no DOM, no live API:
  - `buildModel(windows, tabs, groups, names, savedGroups)` → normalized view
    model (windows → groups → tabs, plus ungrouped; derived counts).
  - `deriveCounts(model)` → `{ windows, groups, tabs }`.
  - `tabsToUnloadAllButActive(model, scope)` → tab ids to discard (skips each
    window's active tab; `scope` = one window or all).
  - `groupSnapshot(group, tabs)` → serializable saved-group record
    (`{ id, name, color, tabs: [{url, title}], savedAt }`).
- Live data acquisition and event subscription live in `data.js` (thin wrapper
  over `browser.windows/tabs/tabGroups/sessions/storage`), kept separate so
  `model.js` stays pure.

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
- Actions: close group, move group (drag), **save & close**.

### Tabs (tiles)
- Favicon, title, host; active tab highlighted; discarded tab dimmed.
- Actions: focus (activates tab + focuses its window), close, unload (`discard`).

### Unload / "all but active"
- Per-tab unload → `tabs.discard(tabId)`.
- Window-level and global "Unload all but active" → discard every tab except each
  window's active tab. (Firefox refuses to discard a window's active tab, so those
  remain loaded by design.)

### Save & close group
- Snapshot the group (`name`, `color`, ordered `tabs[{url,title}]`, `savedAt`) into
  `storage.local` under a `savedGroups` list, then close the group's tabs.
- Saved groups appear in a **Saved** area of the dashboard.

### Restore saved group
- Reopen a saved group's tabs (into its window or a new window) and re-create the
  group with its name/color, then remove it from `savedGroups` (or keep — see Open
  Questions).

### Move between windows (drag & drop)
- Drag a tab tile or a group header onto another window panel → `tabs.move` (and
  group association) into that window.
- Drop onto empty dashboard area → move into a **new window**.

## Error Handling

- API calls in `actions.js` are wrapped; failures surface a non-blocking toast and
  are logged. State is not optimistically mutated, so a failed action simply leaves
  the last-known-good model rendered (the next event refresh reconciles).
- Restore validates saved URLs are still openable; privileged/blank entries are
  skipped with a note.
- Missing/absent `tabGroups` (older Firefox) → dashboard still renders windows/tabs
  and shows a "tab groups need Firefox 139+" notice instead of failing.

## Testing

- **Unit (pure):** `model.js` — `buildModel` normalization, `deriveCounts`,
  `tabsToUnloadAllButActive` (including active-tab exclusion and scope),
  `groupSnapshot` serialization. Runnable in a plain JS test runner, no browser.
- **Manual/integration:** load unpacked via `about:debugging`, drive real flows —
  toggle, rename+restart persistence, close/move/unload, save & close, restore,
  live update when tabs change externally.

## Open Questions (resolve during planning)

1. Restore behavior: remove the saved group after restore, or keep it as a
   reusable template? (Leaning: remove on restore; add explicit "keep" later.)
2. Test runner choice (Node's built-in `node:test` vs. none) — decide in the plan;
   keep zero runtime deps regardless.
