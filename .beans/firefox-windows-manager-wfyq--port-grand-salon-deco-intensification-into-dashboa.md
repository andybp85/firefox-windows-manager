---
# firefox-windows-manager-wfyq
title: Port Grand Salon deco intensification into dashboard.css
status: completed
type: feature
priority: normal
created_at: 2026-07-05T12:22:07Z
updated_at: 2026-07-05T12:30:10Z
---

Approved V3 'Grand Salon' mockup: ornament-dense art deco pass over the dashboard, colors unchanged. Replace sunburst ground with symmetric diamond-trellis + chevron-frieze registers; corner brackets on panels; lozenge-chain rules; cartouche counts; engraved buttons/wordmark.

- [x] Rewrite dashboard.css merging V3 mockup styles
- [x] Chevron register via masked SVG so light-dark() controls its ink
- [x] Verify with headless renders, light + dark
- [x] Update README theming section (sunburst -> trellis ground)
- [x] Tests pass, commit, merge to main, push

## Summary of Changes

Ported the approved V3 'Grand Salon' mockup into dashboard.css (commit 6d7c8e2, merged to main). Sunburst ground replaced by a symmetric trellis (double-ruled 96px diamonds + fine mesh + pinstripes, scheme-tuned --lattice-* tokens) with a chevron frieze rendered as a masked inline SVG on body::before so its ink stays light-dark()-aware. Panels: corner brackets + inset ring; header rules: lozenge chains; counts: notched cartouche; buttons/wordmark: engraved double rules. README theming section updated. Verified via headless-Chrome renders of a mock dataset in both schemes (pixel-matched the approved mockup); 13/13 unit tests pass; .xpi rebuilt.
