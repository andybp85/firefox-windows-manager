import { fetchState, subscribe, hasTabGroups } from "./data.js";
import { render } from "./view.js";
import { attachDnd } from "./dnd.js";
import {
    focusTab, closeTab, unloadTab, unloadAllButActive, closeGroup, closeWindow, renameWindow,
    moveTabToWindow, moveTabToNewWindow, moveGroupToWindow, moveGroupToNewWindow, reorderTab, reorderWindow,
} from "./actions.js";

export const state = { model: null };

const app = document.getElementById("app");

async function rerender() {
    state.model = await fetchState();
    const tree = render(state.model, { tabGroupsSupported: hasTabGroups() });
    tree.classList.add("just-updated");
    app.replaceChildren(tree);
    requestAnimationFrame(() => tree.classList.remove("just-updated"));
}

function debounce(fn, ms) {
    let timer = null;
    return () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(fn, ms);
    };
}

async function main() {
    await rerender();
    subscribe(debounce(rerender, 150));
}

main().catch((err) => {
    console.error(err);
    showToast(`Failed to load overview: ${err?.message ?? err}`);
});

function showToast(message) {
    const existing = document.querySelector(".toast");
    if (existing) {
        existing.remove();
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function run(promise) {
    try {
        await promise;
    } catch (err) {
        console.error(err);
        showToast(`Action failed: ${err?.message ?? err}`);
    }
}

app.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger || !state.model) {
        return;
    }
    const { action, tabId, windowId, groupId } = trigger.dataset;
    const num = (v) => Number(v);
    switch (action) {
        case "close-tab":
            run(closeTab(num(tabId)));
            break;
        case "unload-tab":
            run(unloadTab(num(tabId)));
            break;
        case "close-group":
            run(closeGroup(state.model, num(groupId)));
            break;
        case "unload-all-window":
            run(unloadAllButActive(state.model, { windowId: num(windowId) }));
            break;
        case "close-window":
            run(closeWindow(num(windowId)));
            break;
        case "unload-all-global":
            run(unloadAllButActive(state.model, "all"));
            break;
        default:
            break;
    }
});

app.addEventListener("dblclick", (event) => {
    const name = event.target.closest(".window-name");
    if (name) {
        startRename(name);
        return;
    }
    // Double-click the tile to focus the tab; ignore dblclicks on its buttons.
    const tile = event.target.closest(".tab");
    if (tile && !event.target.closest("button")) {
        run(focusTab(Number(tile.dataset.tabId), Number(tile.dataset.windowId)));
    }
});

function startRename(nameEl) {
    const windowId = Number(nameEl.dataset.windowId);
    nameEl.contentEditable = "true";
    nameEl.focus();
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const commit = async () => {
        nameEl.contentEditable = "false";
        nameEl.removeEventListener("blur", commit);
        nameEl.removeEventListener("keydown", onKey);
        await run(renameWindow(windowId, nameEl.textContent));
        rerender();
    };
    const onKey = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            nameEl.blur();
        } else if (e.key === "Escape") {
            e.preventDefault();
            nameEl.removeEventListener("blur", commit);
            nameEl.removeEventListener("keydown", onKey);
            nameEl.contentEditable = "false";
            rerender();
        }
    };
    nameEl.addEventListener("blur", commit);
    nameEl.addEventListener("keydown", onKey);
}

attachDnd(app, {
    onDropTab: (tabId, windowId) => run(moveTabToWindow(tabId, windowId)),
    onDropGroup: (groupId, windowId) => run(moveGroupToWindow(groupId, windowId)),
    onDropTabNewWindow: (tabId) => run(moveTabToNewWindow(tabId)),
    onDropGroupNewWindow: (groupId) => run(moveGroupToNewWindow(groupId)),
    // Reorders re-render explicitly after committing: a window reorder only
    // writes a session value (no tabs/windows event fires, like rename), and a
    // within-group tab move can be coalesced, so the event-driven rerender is
    // not guaranteed. An extra rerender is idempotent when an event does fire.
    onReorderTab: async (args) => {
        await run(reorderTab(args));
        rerender();
    },
    onReorderWindow: async ({ orderedIds, windowId, beforeWindowId }) => {
        await run(reorderWindow(orderedIds, windowId, beforeWindowId));
        rerender();
    },
});
