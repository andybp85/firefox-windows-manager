---
# firefox-windows-manager-4x67
title: Enforce house style with oxlint and oxfmt
status: completed
type: task
created_at: 2026-08-13T11:13:41Z
updated_at: 2026-08-13T11:13:41Z
parent: firefox-windows-manager-87l3
---

Replace hand-maintained house style with tool-enforced style, then release the result as 1.2.1.

- [x] Add oxlint + oxfmt as devDependencies, pinned via package-lock.json
- [x] Write .oxlintrc.json (curly multi, no-var, prefer-const, no-unused-vars, no-console)
- [x] Write .oxfmtrc.json (no semis, single quotes, 4-space, 140 cols, trailing commas)
- [x] Add lint / format / format:check npm scripts
- [x] Reformat all sources, CSS, and preview.html to the formatter output
- [x] Verify lint, format:check, and the unit suite are green
- [x] Document the new commands in the README Development section
- [x] Bump package.json + manifest.json to 1.2.1 and write the CHANGELOG entry

## Summary of Changes

Style is now configuration rather than prose. `.oxlintrc.json` and `.oxfmtrc.json` encode the
rules the 1.2.0 notes described by hand, so drift is a lint failure instead of a review comment.

The reformat is mechanical: double quotes to single, braces dropped from single-statement blocks,
long argument lists and short blocks rewrapped to 140 columns. The non-whitespace diff contains no
altered expression, condition, or call, and all 21 unit tests pass unchanged.

Released as 1.2.1 (patch): no change to the dashboard, toolbar button, permissions, or stored
session values.
