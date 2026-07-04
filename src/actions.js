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

export async function closeWindow(windowId) {
    await browser.windows.remove(windowId);
}

export async function renameWindow(windowId, name) {
    const trimmed = name.trim();
    if (trimmed) {
        await browser.sessions.setWindowValue(windowId, "name", trimmed);
    } else {
        await browser.sessions.removeWindowValue(windowId, "name");
    }
}

export async function moveTabToWindow(tabId, windowId) {
    await browser.tabs.move(tabId, { windowId, index: -1 });
}

export async function moveTabToNewWindow(tabId) {
    await browser.windows.create({ tabId });
}

export async function moveGroupToWindow(groupId, windowId) {
    await browser.tabGroups.move(groupId, { windowId, index: -1 });
}

export async function moveGroupToNewWindow(groupId) {
    const win = await browser.windows.create();
    const blankTabId = win.tabs[0].id;
    await browser.tabGroups.move(groupId, { windowId: win.id, index: -1 });
    await browser.tabs.remove(blankTabId);
}
