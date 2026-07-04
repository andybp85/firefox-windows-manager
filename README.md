# Tab & Window Manager (Firefox)

A toggleable full-page overview for managing your Firefox windows, tab groups, and tabs — an
"exploded" layout showing every window side by side.

## Features

- One toggle (toolbar button or `Ctrl+Shift+E` / `Cmd+Shift+E`) opens a single overview tab;
  re-toggling focuses it.
- Header counts: windows · groups · tabs.
- One panel per window; tab groups shown as colored sub-sections; tabs as favicon + title + host
  tiles.
- Rename windows (double-click the name) — names persist across restarts via Firefox session
  restore.
- Per tab: go to it, close it, or unload (discard) it.
- "Unload all but active" per window and globally.
- Close a tab group.
- Drag a tab or a group onto another window to move it there, or onto the bottom zone to open it
  in a new window.

## Requirements

- Firefox 139 or newer (uses the `tabGroups` API). On older Firefox the overview still shows
  windows and tabs, with a notice that groups need 139+.

## Install (temporary, for development)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `manifest.json` in this folder.
3. The toolbar button appears; click it or press the shortcut.

Temporary add-ons are removed when Firefox restarts; reload from `about:debugging` after each
restart.

## Keyboard shortcut

Default `Ctrl+Shift+E` (`Cmd+Shift+E` on macOS). If it collides with another binding, change it
at `about:addons` → gear icon → **Manage Extension Shortcuts**.

## Permissions

- `tabs` — read tab metadata and move/close/discard tabs.
- `tabGroups` — read and move tab groups.
- `sessions` — store per-window names that survive restarts.

No host permissions, no `fetch`/XHR, and no data leaves the browser. (Tab tiles do load favicons directly from each site's own URL.)

## Development

- No build step; edit the files and reload the temporary add-on.
- Run unit tests for the pure model: `npm test` (uses Node's built-in test runner; no
  dependencies).
- Architecture and design notes:
  `docs/superpowers/specs/2026-07-04-tab-window-manager-design.md`.
