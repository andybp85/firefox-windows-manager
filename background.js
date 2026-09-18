const DASHBOARD_URL = browser.runtime.getURL('dashboard.html')

// Toggle: open the overview in its own popup window if it's absent, bring that
// window forward if it's open behind others, and close it if it's frontmost.
// A popup window is not a `normal` window, so the overview never lists itself.
async function toggleOverview() {
    const [existing] = await browser.tabs.query({ url: DASHBOARD_URL })
    if (!existing) {
        await browser.windows.create({ type: 'popup', url: DASHBOARD_URL })
        return
    }
    const focused = await browser.windows.getLastFocused()
    if (existing.windowId === focused.id) {
        await browser.windows.remove(existing.windowId)
        return
    }
    await browser.windows.update(existing.windowId, { focused: true })
}

browser.action.onClicked.addListener(toggleOverview)
