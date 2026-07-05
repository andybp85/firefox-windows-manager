---
# firefox-windows-manager-bwfc
title: Fix toggle shortcut + Deco menu-bar icon
status: completed
type: task
priority: normal
created_at: 2026-07-05T12:58:20Z
updated_at: 2026-07-05T13:00:00Z
---

Ctrl/Cmd+Shift+E toggle shortcut doesn't fire (binding conflict / not registered). Rebind to Cmd/Ctrl+Shift+Space to force re-registration and dodge clashes. Replace the generic 4-square toolbar icon with a Grand Salon Deco 'chevron stack' emblem (orange-on-aubergine) matching the theme.

## Summary of Changes

- **Shortcut:** rebound the `toggle-overview` command from `Ctrl/Cmd+Shift+E` to `Ctrl/Cmd+Shift+Space` in manifest.json. The old default clashed with Firefox's Network Monitor on Win/Linux; the mac combo failing pointed at a cross-extension clash or unregistered binding. The new combo is uncontested and the manifest change forces Firefox to re-register on reinstall. background.js was already correct (top-level onCommand listener sharing toggleOverview() with the icon click).
- **Icon:** replaced the generic 4-square icon.svg with a Grand Salon 'chevron stack' emblem — orange (#f47725/#e8631c) double-chevron frieze on an aubergine (#3e1267) rounded tile — echoing the dashboard's chevron register. Self-contained tile keeps it legible on both light and dark toolbars at 16px. Verified via headless render at 16/19/48px.
- **Docs:** updated README.md (features line + Keyboard shortcut section).
- Tests: 13/13 pass. Rebuilt tab-window-manager.xpi (user must reinstall to pick up the new shortcut binding).
