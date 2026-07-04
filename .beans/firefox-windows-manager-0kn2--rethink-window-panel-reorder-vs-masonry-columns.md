---
# firefox-windows-manager-0kn2
title: Rethink window-panel reorder vs. masonry columns
status: draft
type: feature
priority: deferred
created_at: 2026-07-04T20:33:02Z
updated_at: 2026-07-04T20:33:02Z
---

Exploratory. Today windows have a single linear order (persisted via sessions 'order') and the CSS multi-column masonry auto-reflows that order into columns. Dropping a window onto another sets its order neighbor, but the panel lands at its order position — which may render in a different column than where it was released (layout balances by height). Explore alternatives: (a) fixed left-to-right columns as real drop buckets (per-window column index + order), or (b) a single-column vertical list where drop position always matches exactly. Both change the masonry feel. Decide desired UX before implementing. Related: reorder-window-panels (zbtb).
