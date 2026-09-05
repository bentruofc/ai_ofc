import { app } from "../../scripts/app.js";

let promptMap = {};
let byFile = {};

async function loadData() {
    try {
        const [mapResp, byFileResp] = await Promise.all([
            fetch("/prompt_selector_monthly/get_prompts"),
            fetch("/prompt_selector_monthly/get_prompts_by_file"),
        ]);
        if (mapResp.ok) promptMap = await mapResp.json();
        if (byFileResp.ok) byFile = await byFileResp.json();
    } catch (e) {
        console.warn("PromptSelector: could not load prompt data", e);
    }
}

loadData();

app.registerExtension({
    name: "aiofc.PromptSelectorMonthly",
    nodeCreated(node) {
        if (node.comfyClass !== "PromptSelectorNodeMonthly") return;

        // --- Functional logic ---
        const fileWidget = node.widgets.find(w => w.name === "prompt_file");
        const exampleWidget = node.widgets.find(w => w.name === "example_prompt");
        const textWidget = node.widgets.find(w => w.name === "prompt_text");
        if (!fileWidget || !exampleWidget || !textWidget) return;

        let currentPrompts = [];
        let currentIndex = -1;

        function updateExampleOptions(fileStem) {
            const labels = byFile[fileStem] || [];
            currentPrompts = labels;
            if (exampleWidget.options) {
                exampleWidget.options.values = labels.length > 0 ? labels : ["(no prompts)"];
            }
            showPrompt(0);
        }

        function showPrompt(index) {
            if (currentPrompts.length === 0) {
                exampleWidget.value = "(no prompts)";
                textWidget.value = "";
                currentIndex = -1;
                app.graph.setDirtyCanvas(true);
                return;
            }
            currentIndex = ((index % currentPrompts.length) + currentPrompts.length) % currentPrompts.length;
            const label = currentPrompts[currentIndex];
            const fullText = promptMap[label] || "";
            exampleWidget.value = label;
            textWidget.value = fullText;
            app.graph.setDirtyCanvas(true);
        }

        const prevNextWidget = node.addWidget("button", "\u25C0  Prev Prompt", null, () => {
            showPrompt(currentIndex - 1);
        });

        const nextWidget = node.addWidget("button", "Next Prompt  \u25B6", null, () => {
            showPrompt(currentIndex + 1);
        });

        const origFileCallback = fileWidget.callback;
        fileWidget.callback = function (value) {
            if (origFileCallback) origFileCallback.call(this, value);
            updateExampleOptions(value.replace(/\.txt$/, ""));
        };

        const origExampleCallback = exampleWidget.callback;
        exampleWidget.callback = function (value) {
            if (origExampleCallback) origExampleCallback.call(this, value);
            const idx = currentPrompts.indexOf(value);
            if (idx >= 0) {
                currentIndex = idx;
                textWidget.value = promptMap[value] || value;
                app.graph.setDirtyCanvas(true);
            }
        };

        requestAnimationFrame(() => {
            node.setSize([450, 340]);
            app.graph.setDirtyCanvas(true);
        });

        loadData().then(() => {
            const stem = (fileWidget.value || "").replace(/\.txt$/, "");
            if (stem) updateExampleOptions(stem);
        });
    },
});
