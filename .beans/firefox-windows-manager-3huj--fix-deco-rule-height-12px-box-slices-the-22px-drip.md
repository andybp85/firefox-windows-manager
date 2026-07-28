---
# firefox-windows-manager-3huj
title: Fix .deco-rule height — 12px box slices the 22px drip tile
status: scrapped
type: bug
priority: low
created_at: 2026-07-26T13:56:59Z
updated_at: 2026-07-28T01:31:00Z
---

`dashboard.css` `.deco-rule` is `height: 12px` but its mask tile (`--drip-mask`) is 180×22. The teardrop is a circle centred at (60,15) with r=6, spanning y=9→21, so a 12px box cuts it mid-ball and the drip reads as a flat-bottomed lobe instead of a falling drop.

Hidden on a wide rule at 0.55 opacity where the tile repeats often enough to read as texture; unmissable on a narrow one. The panel skirt (`.window::after`) already uses 22px correctly.

The `kit-developer-edition` skill now documents 22px as a requirement (references/ornament.md), so this file is the odd one out.

## Todo
- [ ] Set `.deco-rule` height to 22px
- [ ] Check the rule still reads as quiet at 0.55 opacity; if too heavy, lower opacity or narrow the rule rather than cropping the drip
- [ ] Verify in both schemes

## Reasons for Scrapping

The fix shipped (1011da3, height 12px -> 22px) and was then removed outright in the same release: Andy dropped `.deco-rule` entirely in 1.1.0 to reclaim the vertical space, so there is no longer an element to size correctly.

The geometry finding still matters and outlived the element — it is recorded in the `kit-developer-edition` skill (`references/ornament.md`) as a constraint on the drip tile generally: the teardrop is a circle at (60,15) with r=6, hangs to y=21, and any box shorter than 22px slices the ball flat. Quieter dividers come from opacity or width, never from cropping the drip.
