export function hostOf(url) {
    try {
        return new URL(url).host || url
    } catch {
        return url
    }
}

export function deriveCounts(modelWindows) {
    let groups = 0
    let tabs = 0
    for (const w of modelWindows) {
        groups += w.groups.length
        tabs += w.tabCount
    }
    return { groups, tabs, windows: modelWindows.length }
}

function toTile(t) {
    return {
        active: !!t.active,
        discarded: !!t.discarded,
        favIconUrl: t.favIconUrl || "",
        groupId: t.groupId ?? -1,
        host: hostOf(t.url || ""),
        id: t.id,
        title: t.title || t.url || "Untitled",
        url: t.url || "",
        windowId: t.windowId,
    }
}

export function buildModel(windows, tabs, groups, names = {}, orders = {}) {
    const groupsByWindow = new Map()
    for (const g of groups) {
        if (!groupsByWindow.has(g.windowId)) groupsByWindow.set(g.windowId, [])
        groupsByWindow.get(g.windowId).push(g)
    }

    const tabsByWindow = new Map()
    for (const t of tabs) {
        if (!tabsByWindow.has(t.windowId)) tabsByWindow.set(t.windowId, [])
        tabsByWindow.get(t.windowId).push(t)
    }

    const modelWindows = windows.map(w => {
        const wTabs = (tabsByWindow.get(w.id) || []).slice().sort((a, b) => a.index - b.index)
        const groupById = new Map((groupsByWindow.get(w.id) || []).map(g => [g.id, g]))
        const grouped = new Map()
        const ungrouped = []

        for (const t of wTabs) {
            const tile = toTile(t)
            if (tile.groupId !== -1 && groupById.has(tile.groupId)) {
                if (!grouped.has(tile.groupId)) grouped.set(tile.groupId, [])
                grouped.get(tile.groupId).push(tile)
            } else {
                ungrouped.push(tile)
            }
        }

        const orderOf = tabId => wTabs.findIndex(t => t.id === tabId)
        const groupModels = [...grouped.entries()]
            .map(([gid, tiles]) => {
                const g = groupById.get(gid)
                return {
                    collapsed: !!g.collapsed,
                    color: g.color || "grey",
                    id: gid,
                    tabs: tiles,
                    title: g.title || "",
                    windowId: w.id,
                }
            })
            .sort((a, b) => orderOf(a.tabs[0].id) - orderOf(b.tabs[0].id))

        return {
            focused: !!w.focused,
            groups: groupModels,
            id: w.id,
            incognito: !!w.incognito,
            name: names[w.id] || undefined,
            tabCount: wTabs.length,
            ungrouped,
        }
    })

    const ordered = sortWindowsByOrder(modelWindows, orders)
    return { counts: deriveCounts(ordered), windows: ordered }
}

export function allTabsOf(windowVM) {
    return [...windowVM.groups.flatMap(g => g.tabs), ...windowVM.ungrouped]
}

export function tabsToUnloadAllButActive(model, scope) {
    const windows = scope === "all"
        ? model.windows
        : model.windows.filter(w => w.id === scope.windowId)
    const ids = []
    for (const w of windows) {
        for (const t of allTabsOf(w)) {
            if (!t.active && !t.discarded) ids.push(t.id)
        }
    }
    return ids
}

export function insertIndexAmong(pointerY, rects) {
    return rects.filter(r => (r.top + r.bottom) / 2 < pointerY).length
}

export function absoluteTabIndex(orderedIds, movedId, beforeId) {
    const rest = orderedIds.filter(id => id !== movedId)
    if (beforeId == null) return rest.length
    const i = rest.indexOf(beforeId)
    return i === -1 ? rest.length : i
}

export function sortWindowsByOrder(modelWindows, orders) {
    return modelWindows
        .map(w => ({ order: typeof orders[w.id] === "number" ? orders[w.id] : Infinity, w }))
        .sort((a, b) => a.order - b.order || a.w.id - b.w.id)
        .map(keyed => keyed.w)
}

// Height estimate in tab-tile units: a panel costs its header (~3 tiles) plus
// one unit per tab. Pure stand-in for DOM measurement, good enough to pick the
// shortest column for windows the user has not placed yet.
const WINDOW_HEIGHT_COST = 3

export function assignColumns(modelWindows, visibleCount) {
    const columns = Array.from({ length: visibleCount }, () => [])
    const heightOf = column => column.reduce((h, w) => h + WINDOW_HEIGHT_COST + w.tabCount, 0)

    const assigned = modelWindows
        .filter(w => typeof w.col === "number")
        .sort((a, b) => a.col - b.col || (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)
    for (const w of assigned) columns[Math.min(w.col, visibleCount - 1)].push(w)

    for (const w of modelWindows.filter(w => typeof w.col !== "number")) {
        const shortest = columns.reduce((best, c) => heightOf(c) < heightOf(best) ? c : best, columns[0])
        shortest.push(w)
    }
    return columns
}

export function moveWindowAmongColumns(columnIds, movedId, targetIndex, beforeId) {
    const next = columnIds.map(ids => ids.filter(id => id !== movedId))
    const target = next[targetIndex]
    const i = beforeId == null ? -1 : target.indexOf(beforeId)
    target.splice(i === -1 ? target.length : i, 0, movedId)
    return next
}

export function reorderWindowSequence(orderedIds, movedId, beforeId) {
    const rest = orderedIds.filter(id => id !== movedId)
    if (beforeId == null || !rest.includes(beforeId)) return [...rest, movedId]
    const i = rest.indexOf(beforeId)
    return [...rest.slice(0, i), movedId, ...rest.slice(i)]
}
