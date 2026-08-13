# Tab & Window Manager (Firefox)

A toggleable full-page overview for managing your Firefox windows, tab groups, and tabs — an
"exploded" layout showing every window side by side, dressed in the Kit Developer Edition look: a
dusk desert in Firefox Developer Edition indigo, keyed to the "Kit" browser theme.

## Features

- The toolbar button toggles a single overview tab: click to open, click again to close it (or to
  bring it forward if it's open in the background).
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
- **Reorder window panels** — drag the `⠿` grip in a window header onto any column, at any height.
  Panels are sticky: each window remembers its column and position (via session values) and stays
  put across re-renders and restarts.

Column count still follows the viewport width. When the window is too narrow to show a panel's
assigned column, that column folds into the last visible one; widen the window and it unfolds. New
browser windows appear in whichever column is currently shortest until you place them.

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

None by default — the earlier combos collided with browser and OS shortcuts, so the command was
dropped for now. Toggle the overview with the toolbar button. (A shortcut can be reintroduced later
by adding a `commands` entry to `manifest.json`.)

## Permissions

- `tabs` — read tab metadata and move/close/discard tabs.
- `tabGroups` — read and move tab groups.
- `sessions` — store per-window names and order that survive restarts.

No host permissions, no `fetch`/XHR, and no data leaves the browser. (Tab tiles do load favicons
directly from each site's own URL.)

## Theming (for forks)

The whole look lives in `dashboard.css` and is driven by CSS custom properties in the `:root`
block — retheme by editing those, no JavaScript changes needed.

The design is the **Kit Developer Edition** look: a night desert seen on a strong dose of insanity
pepper (Simpsons S8E9), painted in the dark interior indigos of the Firefox Developer Edition logo
with one rationed orange accent. Dark is the canonical scheme; light is a daybreak complement, not
an inversion. The same tokens drive the [kit-developer-edition](https://github.com/andybp85/kit-theme)
browser theme and wallpaper, so the dashboard, the browser chrome, and the new-tab page read as one
piece rather than three products.

### Palette

Every surface and ink color is a [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark)
pair: `light-dark(<light-mode value>, <dark-mode value>)`. The page follows the OS/browser theme
automatically. Change both values of a token to reskin both modes.

| Token        | Role                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `--accent`   | The rationed hot accent — focused-window keyline, count-update pulse. |
| `--sun`      | Focus outlines, notice borders, the wordmark sun's core.              |
| `--on-hot`   | Text on an accent- or sun-filled surface. Fixed, not a pair.          |
| `--bg`       | Page ground — the night sky and desert floor.                         |
| `--bg-deep`  | Floor of the sky gradient.                                            |
| `--panel`    | Window mesas.                                                         |
| `--tile`     | Tab tiles and the counts plaque.                                      |
| `--raised`   | Buttons and drag chrome.                                              |
| `--ink`      | Primary text.                                                         |
| `--muted`    | Secondary text (hosts, labels, tab counts).                           |
| `--cloud`    | Dropzone dashes and hairlines. Never text — see below.                |
| `--danger`   | Error toast background.                                               |

Surfaces form a ladder — `--bg` → `--bg-deep` → `--tile` → `--panel` → `--raised`, each a step
lighter in dark mode. Depth comes from stepping up that ladder, never from a shadow or a gradient.

**Not every pair is legible.** In the light scheme `--accent` sits at 2.6:1 and `--sun` at 1.9:1
against the page, so both are fill and keyline colors there and never text — hot-colored text
should be an accent-filled surface with `--on-hot` on it instead. `--cloud` fails AA everywhere by
design; it is for hairlines and dashed borders, where the shape does the communicating. If you
reskin, re-check the pairs rather than assuming the new values inherit the old ratios.

### Type

`--font-display` is the display face — chunky and rounded, carrying the cartoon voice. It leads the
wordmark, buttons, headings, numerals, and the uppercase small-caps labels. `--font-body` is the
reading face, so paragraphs stay comfortable. Both fall back through system fonts, so there are no
web-font downloads. Swap either to change the personality.

### The signature accents

- **Dusk sky** — the page background is a vertical `--bg` → `--bg-deep` band with a handful of
  sparkle stars along the top edge. The stars are dark-scheme only: their color is `transparent` in
  light rather than being switched off by a separate rule. `background-attachment: fixed` holds the
  horizon still while content scrolls past it, which is what makes it read as a landscape.
- **The trip scene** — in dark mode the wallpaper itself (`dashboard-bg.svg`, generated by `trip.py`
  in the kit-developer-edition repo) sits behind the panels: scenery mirrored, sun and pyramid
  dropped so it stays quiet under UI. A `url()` cannot react to `light-dark()`, so it lives in a
  `prefers-color-scheme` query; daybreak keeps the plain gradient, since the scene is a night piece.
- **Melting mesas** — each window panel is a flat slab whose bottom edge drips off. `.window::after`
  is a strip filled with the panel color and masked by `--drip-mask`, a repeating 180×22 tile.
  Masking a plain fill instead of using a colored SVG is what keeps the drip scheme-aware. Keep the
  strip at 22px: the teardrop is a circle at (60,15) with r=6, so it hangs to y=21 and a shorter box
  slices the ball flat.
- **Wobble-ring sun** — the wordmark badge on `.wordmark::before`: concentric off-round rings
  stepping from deep indigo out to a hot core, with eight uneven rays. Its colors are fixed rather
  than tokenized, because the stack has to read on both the night ground and the daybreak ground.
- **Group colors** — the `.group-blue { --group: … }` set maps Firefox's tab-group colors to hex,
  and `.group-title::before` draws the swatch.

Ornament here comes from silhouette — drip edges, a wobble-ring sun — never from added color. If a
surface needs interest, give it an edge before reaching for a fifth hue. Delete any one rule above
to drop that accent; nothing else depends on it.

## Development

- No build step; edit the files and reload the temporary add-on from `about:debugging`. The shipped
  extension has no runtime dependencies — the `devDependencies` are the linter and formatter only,
  and nothing from `node_modules/` enters the `.xpi`.
- `npm install` — needed once before linting or formatting. Tests and packaging run without it.
- `npm test` — unit tests for the pure model (`src/model.js`) via Node's built-in test runner.
- `npm run lint` — [oxlint](https://oxc.rs/docs/guide/usage/linter.html) over the extension sources,
  configured in `.oxlintrc.json`.
- `npm run format` — rewrite the sources with [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html);
  `npm run format:check` verifies without writing, for CI. Style lives in `.oxfmtrc.json`: no
  semicolons, single quotes, 4-space indent, 140-column lines, trailing commas.
- `npm run package` — build the installable `.xpi`.
- HTML validity is checked at commit time by [vnu](https://github.com/validator/validator), the engine
  behind the [W3C validator](https://validator.w3.org/nu/) — `brew install vnu` if you intend to commit
  markup. It reads only files that open with a doctype, so partials are left alone, and `.vnu-filter`
  holds the suppressions with the reason each is earned. oxfmt makes the markup consistent; this is what
  makes it legal.
- Architecture is a one-way flow: `data.js` (reads the browser) → `model.js` (pure) → `view.js`
  (renders) → `dnd.js` / `actions.js` (mutate the browser) → browser events trigger a re-render.
- Design and plan notes live under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
