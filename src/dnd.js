import { insertIndexAmong } from "./model.js";

// Drag "kind" is carried in the MIME type: during dragover only the set of
// types is readable, not their values, so the kind must live in the type.
const MIME = {
    group: "application/x-fwm-group",
    tab: "application/x-fwm-tab",
};

function kindOf(dataTransfer) {
    if (dataTransfer.types.includes(MIME.tab)) return "tab";
    if (dataTransfer.types.includes(MIME.group)) return "group";
    return null;
}

// The group-tabs box (drop = join that group) or the loose window-body area
// (drop = ungroup). Null when the pointer is over neither.
function dropContainer(target) {
    const groupTabs = target.closest(".group-tabs");
    if (groupTabs) {
        return { el: groupTabs, groupId: Number(groupTabs.closest(".group").dataset.groupId) };
    }
    const body = target.closest(".window-body");
    if (body) return { el: body, groupId: null };
    return null;
}

function tilesOf(el) {
    return [...el.querySelectorAll(":scope > .tab")];
}

// Resolve a tab drop to { windowId, groupId, beforeId, orderedIds }. beforeId
// is the window-wide tab id to insert before, or null for the window's end.
function resolveTabDrop(container, clientY) {
    const win = container.el.closest(".window");
    const allTiles = [...win.querySelectorAll(".tab")];
    const orderedIds = allTiles.map((t) => Number(t.dataset.tabId));

    const tiles = tilesOf(container.el);
    const k = insertIndexAmong(clientY, tiles.map((t) => t.getBoundingClientRect()));

    let beforeId = null;
    if (k < tiles.length) {
        beforeId = Number(tiles[k].dataset.tabId);
    } else if (tiles.length > 0) {
        const next = allTiles[allTiles.indexOf(tiles[tiles.length - 1]) + 1];
        beforeId = next ? Number(next.dataset.tabId) : null;
    }

    return { windowId: Number(win.dataset.windowId), groupId: container.groupId, beforeId, orderedIds };
}

export function attachDnd(container, handlers) {
    let indicator = null;

    const clearIndicator = () => {
        indicator?.remove();
        indicator = null;
    };
    const clearHighlights = () => {
        for (const el of container.querySelectorAll(".drop-target")) {
            el.classList.remove("drop-target");
        }
    };
    const placeIndicator = (el, clientY) => {
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.className = "drop-indicator";
        }
        const tiles = tilesOf(el);
        const k = insertIndexAmong(clientY, tiles.map((t) => t.getBoundingClientRect()));
        if (k < tiles.length) el.insertBefore(indicator, tiles[k]);
        else el.appendChild(indicator);
    };

    const dropZone = (target) =>
        target.closest(".window-body") || target.closest(".new-window-dropzone");

    container.addEventListener("dragstart", (event) => {
        const tab = event.target.closest(".tab");
        if (tab) {
            event.dataTransfer.setData(MIME.tab, tab.dataset.tabId);
            event.dataTransfer.effectAllowed = "move";
            return;
        }
        const group = event.target.closest(".group");
        if (group) {
            event.dataTransfer.setData(MIME.group, group.dataset.groupId);
            event.dataTransfer.effectAllowed = "move";
        }
    });

    container.addEventListener("dragover", (event) => {
        const kind = kindOf(event.dataTransfer);
        if (!kind) return;
        const zone = dropZone(event.target);
        if (!zone) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        zone.classList.add("drop-target");
        if (kind === "tab") {
            const c = dropContainer(event.target);
            if (c) placeIndicator(c.el, event.clientY);
        }
    });

    container.addEventListener("dragleave", (event) => {
        const zone = dropZone(event.target);
        if (zone) zone.classList.remove("drop-target");
    });

    container.addEventListener("dragend", () => {
        clearIndicator();
        clearHighlights();
    });

    container.addEventListener("drop", (event) => {
        const kind = kindOf(event.dataTransfer);
        clearIndicator();
        const zone = dropZone(event.target);
        clearHighlights();
        if (!kind || !zone) return;
        event.preventDefault();

        const rawId = event.dataTransfer.getData(kind === "tab" ? MIME.tab : MIME.group);
        const id = Number(rawId);
        if (rawId === "" || Number.isNaN(id)) return;

        if (zone.classList.contains("new-window-dropzone")) {
            if (kind === "tab") handlers.onDropTabNewWindow(id);
            else handlers.onDropGroupNewWindow(id);
            return;
        }

        const windowId = Number(zone.closest(".window").dataset.windowId);
        if (kind === "group") {
            handlers.onDropGroup(id, windowId);
            return;
        }

        // kind === "tab": reorder within the same window, else cross-window append.
        const draggedTile = document.querySelector(`.tab[data-tab-id="${id}"]`);
        const fromWindowId = draggedTile ? Number(draggedTile.dataset.windowId) : NaN;
        const c = dropContainer(event.target);
        if (c && fromWindowId === windowId) {
            const drop = resolveTabDrop(c, event.clientY);
            const fromGroup = draggedTile.closest(".group");
            handlers.onReorderTab({
                orderedIds: drop.orderedIds,
                tabId: id,
                fromGroupId: fromGroup ? Number(fromGroup.dataset.groupId) : null,
                toGroupId: drop.groupId,
                beforeId: drop.beforeId,
            });
        } else {
            handlers.onDropTab(id, windowId);
        }
    });
}
