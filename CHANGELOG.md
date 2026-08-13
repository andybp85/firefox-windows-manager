# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This is an end-user browser extension with no programmatic API — it is `private` and not published
to a registry. Its public surface is therefore the dashboard UI and the extension's behavior
(toolbar button, permissions, storage shape). Versions are read against that surface: user-visible
interface changes are minor, corrections are patch.

## [Unreleased]

## [1.2.1] - 2026-08-13

Tooling and formatting only — no change to the dashboard, the toolbar button, permissions, or the
stored session values. Installing this over 1.2.0 changes nothing a user can see.

### Added

- `oxlint` and `oxfmt` as dev dependencies, with the `lint`, `format`, and `format:check` npm
  scripts. House style is now enforced by a tool rather than by hand: `.oxlintrc.json` sets the
  rules (`curly: multi`, `no-var`, `prefer-const`, `no-unused-vars`, console limited to `warn` and
  `error`) and `.oxfmtrc.json` sets the layout (no semicolons, single quotes, 4-space indent,
  140-column lines, trailing commas). `package-lock.json` is now committed, so the two tool
  versions are pinned for everyone.

### Changed

- Reformatted every source file to the formatter's output. This is mechanical: double quotes became
  single, single-statement blocks lost their braces, and long argument lists and short blocks were
  rewrapped to the 140-column limit. `dashboard.css` and `test/preview.html` were reflowed the same
  way. The full unit suite passes unchanged, and the non-whitespace diff contains no altered
  expression, condition, or call.
- The 1.2.0 notes described this same style by hand; the rules that were prose then are
  configuration now, so a future drift is a lint failure instead of a review comment.

## [1.2.0] - 2026-08-05

### Changed

- Conformed the codebase to current house style, with no behavior change: JS drops optional syntax
  (semicolons, single-param arrow parens, single-statement braces), object keys and import lists are
  alphabetized, and `dashboard.css` uses native nesting with properties alphabetized per block
  (flattened output verified rule-for-rule identical to the previous stylesheet). One internal
  contract moved: a window with no stored name is now `undefined` rather than `null` in the model.
- Installed the shared pre-commit guards (secrets scan, docs-freshness check) into `.git/hooks`.
- Window panels now live in real columns and stay where you drop them. Each window stores a column
  and a position (`sessions` values `col` and `order`); dropping any window pins the whole visible
  layout. Narrow viewports fold higher columns into the last visible one. Previously the CSS
  multi-column layout could re-pack a dropped panel into a different column.

## [1.1.0] - 2026-07-27

### Removed

- The masthead divider (`.deco-rule`) and its call site in `src/view.js`. It spent roughly 22px of
  vertical space plus a 0.85rem margin above the window grid without carrying information; the
  masthead's own `margin-bottom` already separates it from the panels below.

### Fixed

- The masthead divider was `height: 12px` against a 180×22 drip mask tile. The teardrop is a circle
  centred at (60,15) with `r=6`, so it hangs to y=21 — a 12px box sliced the ball and the drip read
  as a flat-bottomed lobe rather than a falling drop. Corrected to 22px immediately before the
  element was removed outright.

### Changed

- Rewrote the README's theming section, which still described the retired Art Deco look — trellis
  ground, chevron frieze, lozenge chains, cartouche, corner brackets. It documented four custom
  properties that no longer exist (`--accent-bright`, `--active`, `--rule`, `--font-deco`) while
  omitting six that do (`--sun`, `--on-hot`, `--bg-deep`, `--raised`, `--cloud`, `--drip-mask`), and
  credited accents to four selectors absent from the stylesheet. It now describes the actual Kit
  Developer Edition desert, and records which color pairs are safe to put text on — `--accent` and
  `--sun` do not clear AA on the light ground, and `--cloud` never does.

## [1.0.0] - 2026-07-04

Initial release: toggleable full-page overview of Firefox windows, tab groups, and tabs, with
drag-and-drop reordering across windows.

[Unreleased]: https://github.com/andybp85/firefox-windows-manager/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/andybp85/firefox-windows-manager/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/andybp85/firefox-windows-manager/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/andybp85/firefox-windows-manager/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/andybp85/firefox-windows-manager/releases/tag/v1.0.0
