export function hostOf(url) {
    try {
        return new URL(url).host || url;
    } catch {
        return url;
    }
}

export function deriveCounts(modelWindows) {
    let groups = 0;
    let tabs = 0;
    for (const w of modelWindows) {
        groups += w.groups.length;
        tabs += w.tabCount;
    }
    return { windows: modelWindows.length, groups, tabs };
}

function toTile(t) {
    return {
        id: t.id,
        windowId: t.windowId,
        title: t.title || t.url || "Untitled",
        url: t.url || "",
        host: hostOf(t.url || ""),
        favIconUrl: t.favIconUrl || "",
        active: !!t.active,
        discarded: !!t.discarded,
        groupId: t.groupId ?? -1,
    };
}

export function buildModel(windows, tabs, groups, names = {}) {
    const groupsByWindow = new Map();
    for (const g of groups) {
        if (!groupsByWindow.has(g.windowId)) {
            groupsByWindow.set(g.windowId, []);
        }
        groupsByWindow.get(g.windowId).push(g);
    }

    const tabsByWindow = new Map();
    for (const t of tabs) {
        if (!tabsByWindow.has(t.windowId)) {
            tabsByWindow.set(t.windowId, []);
        }
        tabsByWindow.get(t.windowId).push(t);
    }

    const modelWindows = windows.map((w) => {
        const wTabs = (tabsByWindow.get(w.id) || []).slice().sort((a, b) => a.index - b.index);
        const groupById = new Map((groupsByWindow.get(w.id) || []).map((g) => [g.id, g]));
        const grouped = new Map();
        const ungrouped = [];

        for (const t of wTabs) {
            const tile = toTile(t);
            if (tile.groupId !== -1 && groupById.has(tile.groupId)) {
                if (!grouped.has(tile.groupId)) {
                    grouped.set(tile.groupId, []);
                }
                grouped.get(tile.groupId).push(tile);
            } else {
                ungrouped.push(tile);
            }
        }

        const orderOf = (tabId) => wTabs.findIndex((t) => t.id === tabId);
        const groupModels = [...grouped.entries()]
            .map(([gid, tiles]) => {
                const g = groupById.get(gid);
                return {
                    id: gid,
                    title: g.title || "",
                    color: g.color || "grey",
                    collapsed: !!g.collapsed,
                    windowId: w.id,
                    tabs: tiles,
                };
            })
            .sort((a, b) => orderOf(a.tabs[0].id) - orderOf(b.tabs[0].id));

        return {
            id: w.id,
            name: names[w.id] || null,
            focused: !!w.focused,
            incognito: !!w.incognito,
            groups: groupModels,
            ungrouped,
            tabCount: wTabs.length,
        };
    });

    return { windows: modelWindows, counts: deriveCounts(modelWindows) };
}
