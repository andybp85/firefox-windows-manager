import { fetchState, subscribe, hasTabGroups } from "./data.js";
import { render } from "./view.js";

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

main();
