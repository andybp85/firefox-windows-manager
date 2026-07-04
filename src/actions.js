import { tabsToUnloadAllButActive } from "./model.js";

export async function focusTab(tabId, windowId) {
    await browser.tabs.update(tabId, { active: true });
    await browser.windows.update(windowId, { focused: true });
}

export async function closeTab(tabId) {
    await browser.tabs.remove(tabId);
}

export async function unloadTab(tabId) {
    await browser.tabs.discard(tabId);
}

export async function unloadAllButActive(model, scope) {
    const ids = tabsToUnloadAllButActive(model, scope);
    if (ids.length > 0) {
        await browser.tabs.discard(ids);
    }
}

export async function closeGroup(model, groupId) {
    const ids = [];
    for (const w of model.windows) {
        for (const g of w.groups) {
            if (g.id === groupId) {
                ids.push(...g.tabs.map((t) => t.id));
            }
        }
    }
    if (ids.length > 0) {
        await browser.tabs.remove(ids);
    }
}

export async function renameWindow(windowId, name) {
    const trimmed = name.trim();
    if (trimmed) {
        await browser.sessions.setWindowValue(windowId, "name", trimmed);
    } else {
        await browser.sessions.removeWindowValue(windowId, "name");
    }
}
