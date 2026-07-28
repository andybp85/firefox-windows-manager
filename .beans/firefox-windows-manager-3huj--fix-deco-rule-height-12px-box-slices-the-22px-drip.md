---
# firefox-windows-manager-3huj
title: Fix .deco-rule height — 12px box slices the 22px drip tile
status: scrapped
type: bug
priority: low
created_at: 2026-07-26T13:56:59Z
updated_at: 2026-07-28T01:29:03Z
---

`dashboard.css` `.deco-rule` is `height: 12px` but its mask tile (`--drip-mask`) is 180×22. The teardrop is a circle centred at (60,15) with r=6, spanning y=9→21, so a 12px box cuts it mid-ball and the drip reads as a flat-bottomed lobe instead of a falling drop.

Hidden on a wide rule at 0.55 opacity where the tile repeats often enough to read as texture; unmissable on a narrow one. The panel skirt (`.window::after`) already uses 22px correctly.

The `kit-developer-edition` skill now documents 22px as a requirement (references/ornament.md), so this file is the odd one out.

## Todo
- [ ] Set `.deco-rule` height to 22px
- [ ] Check the rule still reads as quiet at 0.55 opacity; if too heavy, lower opacity or narrow the rule rather than cropping the drip
- [ ] Verify in both schemes
