export function attachDnd(container, handlers) {
    container.addEventListener("dragstart", (event) => {
        const group = event.target.closest(".group");
        const tab = event.target.closest(".tab");
        // A tab inside a group must win over the group for tab drags.
        if (tab) {
            event.dataTransfer.setData("application/x-kind", "tab");
            event.dataTransfer.setData("application/x-id", tab.dataset.tabId);
            event.dataTransfer.effectAllowed = "move";
        } else if (group) {
            event.dataTransfer.setData("application/x-kind", "group");
            event.dataTransfer.setData("application/x-id", group.dataset.groupId);
            event.dataTransfer.effectAllowed = "move";
        }
    });

    const dropZone = (target) =>
        target.closest(".window-body") || target.closest(".new-window-dropzone");

    container.addEventListener("dragover", (event) => {
        const zone = dropZone(event.target);
        if (zone) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            zone.classList.add("drop-target");
        }
    });

    container.addEventListener("dragleave", (event) => {
        const zone = dropZone(event.target);
        if (zone) {
            zone.classList.remove("drop-target");
        }
    });

    container.addEventListener("drop", (event) => {
        const zone = dropZone(event.target);
        if (!zone) {
            return;
        }
        event.preventDefault();
        zone.classList.remove("drop-target");

        const kind = event.dataTransfer.getData("application/x-kind");
        const rawId = event.dataTransfer.getData("application/x-id");
        const id = Number(rawId);
        if (!kind || rawId === "" || Number.isNaN(id)) {
            return;
        }

        const isNewWindow = zone.classList.contains("new-window-dropzone");
        if (isNewWindow) {
            if (kind === "tab") {
                handlers.onDropTabNewWindow(id);
            } else {
                handlers.onDropGroupNewWindow(id);
            }
            return;
        }

        const windowId = Number(zone.closest(".window").dataset.windowId);
        if (kind === "tab") {
            handlers.onDropTab(id, windowId);
        } else {
            handlers.onDropGroup(id, windowId);
        }
    });
}
