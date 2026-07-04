const DASHBOARD_URL = browser.runtime.getURL("dashboard.html");

async function toggleOverview() {
    const existing = await browser.tabs.query({ url: DASHBOARD_URL });
    if (existing.length > 0) {
        const tab = existing[0];
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        return;
    }
    await browser.tabs.create({ url: DASHBOARD_URL });
}

browser.action.onClicked.addListener(toggleOverview);
browser.commands.onCommand.addListener((command) => {
    if (command === "toggle-overview") {
        toggleOverview();
    }
});
