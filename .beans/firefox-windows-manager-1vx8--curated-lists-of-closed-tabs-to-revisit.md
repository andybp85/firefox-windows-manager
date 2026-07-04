---
# firefox-windows-manager-1vx8
title: Curated lists of closed tabs to revisit
status: draft
type: feature
priority: deferred
created_at: 2026-07-04T12:44:13Z
updated_at: 2026-07-04T13:29:03Z
parent: firefox-windows-manager-87l3
---

Exploratory: let the user save closed tabs into named, curated lists (a reading-list / 'come back to this' shelf) that persist and can be reopened selectively. Distinct from save-and-close-group (which is group-scoped). Needs design: relationship to saved groups, storage model, UI surface, dedup.

## Note (2026-07-04)
This bean now also owns the 'saved sets of tabs/groups surfaced inside the overview' idea. Plugin-managed save-and-close was dropped from v1 because the tabGroups API can't see or trigger Firefox's native saved groups; rather than duplicate native with a parallel invisible store, any plugin-side saving should be designed here as one deliberate cross-cutting store (curated lists + saved sets).
