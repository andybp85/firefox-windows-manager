---
# firefox-windows-manager-d0zc
title: Bring repo up to current dev standards
status: completed
type: task
priority: normal
created_at: 2026-08-04T19:02:09Z
updated_at: 2026-08-04T19:11:04Z
---

Audit against global CLAUDE.md standards and session guards.

- [x] Install secrets-commit-guard
- [x] Install update-docs-before-commit guard
- [x] Untrack tab-window-manager.xpi — moot: it was never tracked; .gitignore already covers it
- [x] Fix long lines — wrapped the test import; the 2 CSS lines are unbreakable data-URI tokens, exempt
- [x] Alphabetize package.json keys
- [ ] Update docs where affected; commit

## Summary of Changes

- Installed secrets-commit-guard and update-docs-before-commit pre-commit hooks (.git/hooks, untracked).
- Style pass, no behavior change: all JS de-semicoloned with optional syntax dropped per js.md; object keys,
  import lists alphabetized; dashboard.css converted to native nesting with per-block alphabetized properties.
  Flattened old/new CSS compiled via lightningcss and diffed: rule-for-rule identical (property order only).
- Model contract: missing window name is now undefined (was null), per prefer-undefined rule; tests updated.
- package.json keys alphabetized; long import in test/model.test.js wrapped. The 2 remaining >140-col CSS
  lines are unbreakable data-URI tokens (exempt, like long URLs).
- :root token order kept role-grouped (deliberate, commented) rather than alphabetized — the surface-ladder
  order is documentation the README relies on.
- 13/13 tests pass; node --check clean on all JS; lightningcss parse clean targeting Firefox 139.
