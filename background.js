const DASHBOARD_URL = browser.runtime.getURL("dashboard.html");

// Toggle: create the overview if it's absent, bring it forward if it's open in
// the background, and close it if it's already the frontmost tab.
async function toggleOverview() {
    const [existing] = await browser.tabs.query({ url: DASHBOARD_URL });
    if (!existing) {
        await browser.tabs.create({ url: DASHBOARD_URL });
        return;
    }
    const focused = await browser.windows.getLastFocused();
    const isFrontmost = existing.active && existing.windowId === focused.id;
    if (isFrontmost) {
        await browser.tabs.remove(existing.id);
        return;
    }
    await browser.tabs.update(existing.id, { active: true });
    await browser.windows.update(existing.windowId, { focused: true });
}

browser.action.onClicked.addListener(toggleOverview);
