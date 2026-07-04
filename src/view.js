function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text != null) {
        node.textContent = text;
    }
    return node;
}

function button(action, label, dataset = {}) {
    const b = el("button", null, label);
    b.dataset.action = action;
    for (const [k, v] of Object.entries(dataset)) {
        b.dataset[k] = String(v);
    }
    return b;
}

// Icon-only button: the glyph carries meaning visually, `label` carries it to
// assistive tech and as a tooltip.
function iconButton(action, glyph, label, dataset = {}) {
    const b = button(action, glyph, dataset);
    b.classList.add("icon-btn");
    b.setAttribute("aria-label", label);
    b.title = label;
    return b;
}

function renderTab(tab) {
    const article = el("article", "tab");
    article.classList.toggle("active", tab.active);
    article.classList.toggle("discarded", tab.discarded);
    article.dataset.tabId = String(tab.id);
    article.dataset.windowId = String(tab.windowId);
    article.draggable = true;
    article.title = "Double-click to open";

    const favicon = el("img", "tab-favicon");
    favicon.src = tab.favIconUrl || "icons/icon.svg";
    favicon.alt = "";
    favicon.addEventListener("error", () => { favicon.src = "icons/icon.svg"; });

    const meta = el("div", "tab-meta");
    meta.append(el("div", "tab-title", tab.title), el("div", "tab-host", tab.host));

    const controls = el("div", "tab-controls");
    controls.append(
        iconButton("unload-tab", "⏏", "Unload", { tabId: tab.id }),
        button("close-tab", "✕", { tabId: tab.id }),
    );

    article.append(favicon, meta, controls);
    return article;
}

function renderGroup(group) {
    const section = el("section", `group group-${group.color}`);
    section.dataset.groupId = String(group.id);
    section.dataset.windowId = String(group.windowId);
    section.draggable = true;

    const header = el("div", "group-header");
    header.append(
        el("span", "group-title", group.title || "Group"),
        button("close-group", "Close group", { groupId: group.id }),
    );

    const body = el("div", "group-tabs");
    for (const tab of group.tabs) {
        body.append(renderTab(tab));
    }

    section.append(header, body);
    return section;
}

function renderWindow(windowVM) {
    const section = el("section", "window");
    section.dataset.windowId = String(windowVM.id);
    if (windowVM.focused) {
        section.classList.add("focused");
    }

    const header = el("div", "window-header");
    const name = el("span", "window-name", windowVM.name || `Window ${windowVM.id}`);
    name.dataset.windowId = String(windowVM.id);
    name.tabIndex = 0;
    name.setAttribute("role", "textbox");
    name.title = "Double-click to rename";
    const actions = el("div", "window-actions");
    actions.append(
        iconButton("unload-all-window", "⏏", "Unload all but active", { windowId: windowVM.id }),
        iconButton("close-window", "✕", "Close window", { windowId: windowVM.id }),
    );
    header.append(
        name,
        el("span", "window-tabcount", `${windowVM.tabCount} tabs`),
        actions,
    );

    const body = el("div", "window-body");
    for (const group of windowVM.groups) {
        body.append(renderGroup(group));
    }
    for (const tab of windowVM.ungrouped) {
        body.append(renderTab(tab));
    }

    section.append(header, body);
    return section;
}

export function render(model, options = {}) {
    const supported = options.tabGroupsSupported !== false;
    const root = el("div", "overview");

    const masthead = el("header", "masthead");
    const bar = el("div", "masthead-bar");
    bar.append(el("h1", "wordmark", "Tab & Window Overview"));

    const counts = el("div", "counts");
    counts.append(
        el("span", "count count-windows", `${model.counts.windows}`),
        el("span", "count-label", "Windows"),
        el("span", "count count-groups", `${model.counts.groups}`),
        el("span", "count-label", "Groups"),
        el("span", "count count-tabs", `${model.counts.tabs}`),
        el("span", "count-label", "Tabs"),
        iconButton("unload-all-global", "⏏", "Unload all but active, every window", {}),
    );
    bar.append(counts);
    masthead.append(bar, el("div", "deco-rule"));
    root.append(masthead);

    if (!supported) {
        root.append(el("p", "notice", "Tab groups need Firefox 139+ — showing windows and tabs only."));
    }

    const grid = el("div", "windows-grid");
    for (const windowVM of model.windows) {
        grid.append(renderWindow(windowVM));
    }
    root.append(grid);

    root.append(el("div", "new-window-dropzone", "Drop here to open in a new window"));

    return root;
}
