# Tab & Window Manager (Firefox)

A toggleable full-page overview for managing your Firefox windows, tab groups, and tabs — an
"exploded" layout showing every window side by side, dressed in an Art-Deco theme keyed to
Firefox's "Kit" palette.

## Features

- One toggle (toolbar button or `Ctrl+Shift+E` / `Cmd+Shift+E`) opens a single overview tab;
  re-toggling focuses it.
- Header counts: windows · groups · tabs.
- One panel per window; tab groups shown as colored sub-sections; tabs as favicon + title + host
  tiles.
- **Rename windows** — double-click the name. Names persist across restarts via Firefox session
  restore.
- **Open a tab** — double-click its tile.
- Per tab: unload (discard) it, or close it.
- Per window: unload all but the active tab, or close the whole window.
- Unload all but active across every window, from the masthead.
- Close a tab group.
- **Reorder tabs within a window** — drag a tab tile to a new spot. Free reorder: drop it inside a
  group to join that group, or in loose space to leave it. Changes the real tab order.
- **Move a tab or group between windows** — drag it onto another window's panel, or onto the
  bottom zone to open it in a new window.
- **Reorder window panels** — drag the `⠿` grip in a window header. The order is saved per window
  (via session values) and survives restarts.

Windows have a single order; the panels flow into as many columns as fit, so a reordered window
lands at its order position — which may re-pack into a different column than where it was dropped.

## Requirements

- Firefox 139 or newer (uses the `tabGroups` API). On older Firefox the overview still shows
  windows and tabs, with a notice that groups need 139+.

## Install

### Temporary (any Firefox — for quick testing)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `manifest.json` in this folder.
3. Pin the toolbar button (Firefox hides extension buttons behind the puzzle-piece / extensions
   menu by default), then click it or press the shortcut.

Temporary add-ons are removed when Firefox restarts.

### Permanent (Firefox Developer Edition, Nightly, or ESR)

Regular release Firefox only installs **signed** extensions permanently. Developer Edition,
Nightly, and ESR let you turn signature enforcement off, so you can install an unsigned build:

1. Build the package: `npm run package` — writes `tab-window-manager.xpi` (only the runtime files,
   `manifest.json` at the archive root).
2. In `about:config`, set `xpinstall.signatures.required` to **false**.
3. Open `about:addons` → gear icon → **Install Add-on From File…** → choose
   `tab-window-manager.xpi`. It now survives restarts.

### Permanent (regular release Firefox — signed)

To keep it on ordinary Firefox you must have Mozilla sign it for self-distribution (unlisted — not
published publicly). Using Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
with an [AMO API key](https://addons.mozilla.org/developers/addon/api/key/):

```sh
npx --yes web-ext sign --channel=unlisted --api-key=<key> --api-secret=<secret>
```

Install the signed `.xpi` it returns the same way (Install Add-on From File). The add-on ID is
already set in `manifest.json`, which signing requires.

## Keyboard shortcut

Default `Ctrl+Shift+E` (`Cmd+Shift+E` on macOS). If it collides with another binding, change it
at `about:addons` → gear icon → **Manage Extension Shortcuts**.

## Permissions

- `tabs` — read tab metadata and move/close/discard tabs.
- `tabGroups` — read and move tab groups.
- `sessions` — store per-window names and order that survive restarts.

No host permissions, no `fetch`/XHR, and no data leaves the browser. (Tab tiles do load favicons
directly from each site's own URL.)

## Theming (for forks)

The whole look lives in `dashboard.css` and is driven by CSS custom properties in the `:root`
block — retheme by editing those, no JavaScript changes needed.

### Palette

Every color is a [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark)
pair: `light-dark(<light-mode value>, <dark-mode value>)`. The page follows the OS/browser theme
automatically. Change both values of a token to reskin both modes.

| Token             | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `--accent`        | Primary accent — buttons, rules, the sunburst, active bars. |
| `--accent-bright` | Brighter accent, used for the count-update pulse.           |
| `--bg`            | Page background base.                                        |
| `--panel`         | Window-panel background.                                    |
| `--tile`          | Tab-tile background.                                         |
| `--active`        | Active tab's (darkened) background, for legible title text. |
| `--ink`           | Primary text.                                               |
| `--muted`         | Secondary text (hosts, labels, tab counts).                 |
| `--rule`          | Hairline borders and dividers.                              |
| `--danger`        | Error toast background.                                      |

### Type

`--font-deco` is the display face (Futura and friends — the uppercase, letter-spaced Deco voice);
`--font-body` is the reading face. Both fall back through system fonts, so there are no web-font
downloads. Swap either to change the personality.

### The signature accents

- **Sunburst field** — the faint rays are a `repeating-conic-gradient` on `body`, anchored to a
  corner (`at 0 100%` = bottom-left) and softened by a `radial-gradient` fade to `--bg`. Move the
  anchor, or tune the `color-mix(... var(--accent) 15% ...)` alpha and the ray spacing
  (`0deg 2deg, transparent 2deg 6.5deg`) to make it bolder or fainter.
- **Group lozenge / header keystone / dropzone brackets** — small pseudo-element accents on
  `.group-title`, `.window-header`, and `.new-window-dropzone`. Delete a rule to drop that accent.
- **Group colors** — the `.group-blue { --group: … }` set maps Firefox's tab-group colors to hex.

## Development

- No build step; edit the files and reload the temporary add-on from `about:debugging`.
- `npm test` — unit tests for the pure model (`src/model.js`) via Node's built-in test runner. No
  dependencies.
- `npm run package` — build the installable `.xpi`.
- Architecture is a one-way flow: `data.js` (reads the browser) → `model.js` (pure) → `view.js`
  (renders) → `dnd.js` / `actions.js` (mutate the browser) → browser events trigger a re-render.
- Design and plan notes live under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
