---
# firefox-windows-manager-p6qp
title: Open the overview in its own popup window
status: completed
type: feature
priority: normal
created_at: 2026-09-18T13:18:47Z
updated_at: 2026-09-18T13:19:51Z
parent: firefox-windows-manager-87l3
---

The toolbar button opens the overview in a dedicated popup-type window instead of a tab in the current window. Popup windows are excluded from the panel list already (fetchState queries normal windows only), so the overview never lists itself. Because a popup has no toolbar, an unbound `_execute_action` command restores the close half of the toggle for users who assign a shortcut.

- [x] background.js: create a popup window; focus/close by window
- [x] manifest.json: `_execute_action` command, description wording
- [x] Docs: README features + shortcut section, CHANGELOG Unreleased, package.json description
- [x] Lint, format, tests

## Summary of Changes

`background.js` creates a `type: popup` window for the overview, focuses that window when it is open behind others, and removes the window when it is frontmost. `fetchState` already queries `normal` windows only, so no model change: the popup never lists itself. `manifest.json` gains an unbound `_execute_action` command so a user-assigned shortcut can still close the overview (a popup has no toolbar, so the button cannot be clicked while the overview is frontmost). README features and shortcut sections, CHANGELOG Unreleased, and both descriptions updated. Verified: 21 unit tests pass, oxlint and oxfmt clean. Not verified: the window itself in Firefox (default popup size, close-on-focused via shortcut). Manual check in about:debugging before release.
