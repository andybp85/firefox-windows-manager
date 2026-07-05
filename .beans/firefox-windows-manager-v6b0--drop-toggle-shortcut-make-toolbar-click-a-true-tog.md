---
# firefox-windows-manager-v6b0
title: Drop toggle shortcut; make toolbar click a true toggle
status: completed
type: task
priority: normal
created_at: 2026-07-05T13:10:27Z
updated_at: 2026-07-05T13:11:36Z
---

Cmd+Shift+Space collides with macOS search. Remove the commands entry + onCommand listener entirely. Also fix toggleOverview(): clicking the toolbar icon when the overview is already the frontmost tab should close it, not just re-focus it.

## Summary of Changes

- **Dropped the shortcut:** removed the `commands` block from manifest.json and the `browser.commands.onCommand` listener from background.js. Cmd+Shift+Space collided with macOS search; no default shortcut for now.
- **True toggle:** toggleOverview() now closes the overview when it's the frontmost tab (active in the focused window), brings it forward when it's open in the background, and creates it otherwise — instead of only ever focusing it.
- Updated README.md (features line + Keyboard shortcut section).
- Tests 13/13 pass; rebuilt tab-window-manager.xpi. Toggle behavior needs manual verification in Firefox (background.js isn't unit-tested).
