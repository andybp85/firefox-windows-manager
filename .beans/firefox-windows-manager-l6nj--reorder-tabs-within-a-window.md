---
# firefox-windows-manager-l6nj
title: Reorder tabs within a window
status: completed
type: feature
priority: deferred
created_at: 2026-07-04T12:44:13Z
updated_at: 2026-07-04T19:58:08Z
parent: firefox-windows-manager-87l3
---

Future iteration: drag to reorder tabs inside a single window's panel. v1 only supports moving tabs between windows.

## Summary of Changes

Free drag-to-reorder tabs within a window. Drop position sets group membership: dropping inside a group joins it, dropping in loose space leaves it. Implemented via pure helpers insertIndexAmong/absoluteTabIndex (model.js, unit-tested), reorderTab action (tabs.group/ungroup + tabs.move), and MIME-typed drop resolution in dnd.js. Cross-window moves keep append behavior. Commits 8f4a8cd..8f8f9b1 on feat/sortable-tabs-windows.
