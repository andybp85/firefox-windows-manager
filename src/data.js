import { buildModel } from "./model.js";

export function hasTabGroups() {
    return typeof browser.tabGroups !== "undefined";
}

export async function fetchState() {
    const [windows, tabs] = await Promise.all([
        browser.windows.getAll({ windowTypes: ["normal"] }),
        browser.tabs.query({}),
    ]);

    const groups = hasTabGroups() ? await browser.tabGroups.query({}) : [];

    const names = {};
    await Promise.all(
        windows.map(async (w) => {
            names[w.id] = (await browser.sessions.getWindowValue(w.id, "name")) || null;
        }),
    );

    return buildModel(windows, tabs, groups, names);
}

export function subscribe(onChange) {
    const events = [
        browser.tabs.onCreated,
        browser.tabs.onRemoved,
        browser.tabs.onUpdated,
        browser.tabs.onMoved,
        browser.tabs.onActivated,
        browser.tabs.onAttached,
        browser.tabs.onDetached,
        browser.windows.onCreated,
        browser.windows.onRemoved,
        browser.windows.onFocusChanged,
    ];
    if (hasTabGroups()) {
        events.push(
            browser.tabGroups.onCreated,
            browser.tabGroups.onMoved,
            browser.tabGroups.onRemoved,
            browser.tabGroups.onUpdated,
        );
    }

    const handler = () => onChange();
    for (const event of events) {
        event.addListener(handler);
    }
    return () => {
        for (const event of events) {
            event.removeListener(handler);
        }
    };
}
