---
# firefox-windows-manager-arjq
title: Show which macOS desktop (Space) each window is on; move windows between Spaces
status: draft
type: feature
priority: low
created_at: 2026-09-18T13:19:41Z
updated_at: 2026-09-18T13:19:41Z
parent: firefox-windows-manager-87l3
---

Show in each window panel which macOS desktop (Space) the window lives on, and if possible let the user move a window to another Space from the overview.

## Open questions

- WebExtension APIs expose no Space/virtual-desktop information; `windows.get` returns only geometry and state. This needs a native messaging host (`nativeMessaging` permission plus a host manifest installed outside the extension), which changes the install story: the .xpi alone no longer suffices.
- Reading Spaces on macOS: no public API. Options are the private SkyLight/CGS calls (what yabai uses, and which SIP partially blocks on newer macOS), or heuristics via `CGWindowListCopyWindowInfo` (which lists only the current Space unless `kCGWindowListOptionAll` is used, and even then does not name the Space).
- Moving a window to a Space: also private API, or an AppleScript/Accessibility drag to a Mission Control thumbnail. Fragile; may be a stretch goal after read-only display works.
- Match Firefox windows to macOS windows by title or by `windows.get` geometry, since the extension has no OS window ID.
- Linux/Windows equivalents (X11 `_NET_WM_DESKTOP`, Windows IVirtualDesktopManager) are separate work; scope to macOS first or leave out.

## Todo

- [ ] Spike: can a native host read the Space of each Firefox window on the current macOS?
- [ ] Decide install story for the native host
- [ ] Read-only Space badge in the window panel header
- [ ] Move-to-Space action, if the spike shows it is feasible
