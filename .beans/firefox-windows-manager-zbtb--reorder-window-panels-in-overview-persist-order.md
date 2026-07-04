---
# firefox-windows-manager-zbtb
title: Reorder window panels in overview, persist order
status: completed
type: feature
priority: normal
created_at: 2026-07-04T18:59:40Z
updated_at: 2026-07-04T19:58:08Z
---

Drag window panels to reorder them in the overview. No native window order exists, so persist a per-window integer 'order' via browser.sessions.setWindowValue (mirrors window names; survives restart via session restore). Spec: docs/superpowers/specs/2026-07-04-sortable-tabs-and-windows-design.md

## Summary of Changes

Drag window panels by a grip handle (⠿) to reorder them; order persists per-window via sessions.setWindowValue(id, 'order', i) and survives restart via session restore. Pure helpers sortWindowsByOrder/reorderWindowSequence (unit-tested), reorderWindow action, resolveWindowDrop in dnd.js, data.js reads order. Commits on feat/sortable-tabs-windows.
