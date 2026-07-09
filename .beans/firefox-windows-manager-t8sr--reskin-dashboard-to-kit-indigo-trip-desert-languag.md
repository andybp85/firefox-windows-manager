---
# firefox-windows-manager-t8sr
title: Reskin dashboard to Kit indigo trip-desert language
status: completed
type: feature
priority: normal
created_at: 2026-07-09T13:35:14Z
updated_at: 2026-07-09T13:50:23Z
---

Port the approved mockup (claude.ai artifact ee7fe6bb) into dashboard.css: dusk-desert tokens, melting drip card skirts, wobble-sun masthead, cel-flat pills; keep all behavioral selectors (dnd targets, focus, contenteditable, reduced-motion).

## Summary of Changes

- dashboard.css fully ported from Deco/aubergine to the Kit trip-desert language: light-dark() token system (dusk indigo canonical, daybreak periwinkle complement), sky gradient w/ dark-only sparkle stars, drip-mask melt skirts on window panels + masthead horizon rule (mask over fill keeps them scheme-aware), wobble-sun wordmark mark (data-URI SVG), cel pill buttons, solid-orange active tab with dark text, group colors kept as data (dot + keyline + 9% tint), mirage dashed dropzone. All behavioral selectors preserved (drop targets, drop-indicator, contenteditable rename, drag handles, discarded, toast, reduced-motion).
- test/preview.html: fixture harness rendering src/view.js with sample model for visual checks (serve repo root over http; file:// blocks module imports). Verified both schemes headless.
- icons/icon.svg redrawn as the trip wobble sun (4046e36); reskin + icon pushed to origin/main.
