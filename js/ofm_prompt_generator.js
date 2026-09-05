import { app } from "../../scripts/app.js";

let modePrompts = {};

async function loadPrompts() {
    try {
        const resp = await fetch("/ofm_prompt_generator/get_prompts");
        if (resp.ok) {
            modePrompts = await resp.json();
        }
    } catch (e) {
        console.warn("OFM Prompt Generator: could not load prompts", e);
    }
}

loadPrompts();

app.registerExtension({
    name: "aiofc.OFMPromptGenerator",
    nodeCreated(node) {
        if (node.comfyClass !== "GeminiPromptNode") return;

        // --- Mode switching logic ---
        const modeWidget = node.widgets.find(w => w.name === "mode");
        const customPromptWidget = node.widgets.find(w => w.name === "custom_prompt");
        if (!modeWidget || !customPromptWidget) return;

        function applyMode(mode) {
            const promptText = modePrompts[mode];
            if (promptText != null) {
                customPromptWidget.value = promptText;
            } else {
                customPromptWidget.value = "";
            }
            app.graph.setDirtyCanvas(true);
        }

        const origCallback = modeWidget.callback;
        modeWidget.callback = function (value) {
            if (origCallback) origCallback.call(this, value);
            applyMode(value);
        };

        loadPrompts().then(() => {
            applyMode(modeWidget.value);
        });

        // --- Provider switching: swap the model list, enable/disable fields ---
        const GEMINI_MODELS = [
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.1-pro-preview",
            "gemini-2.5-pro",
            "gemini-2.5-flash",
        ];
        const GROK_MODELS = [
            "grok-4.20-0309-reasoning",
            "grok-4.20-0309-non-reasoning",
            "grok-4-1-fast-reasoning",
            "grok-4-1-fast-non-reasoning",
            "grok-2-vision-1212",
            "grok-3",
            "grok-3-fast",
            "grok-3-mini",
            "grok-3-mini-fast",
        ];
        const NO_SAMPLING = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

        const providerWidget = node.widgets.find(w => w.name === "provider");
        const geminiApiKeyWidget = node.widgets.find(w => w.name === "gemini_api_key");
        const grokApiKeyWidget = node.widgets.find(w => w.name === "grok_api_key");
        const modelWidget = node.widgets.find(w => w.name === "model");
        const thinkingWidget = node.widgets.find(w => w.name === "thinking_level");
        const temperatureWidget = node.widgets.find(w => w.name === "temperature");
        const safetyWidget = node.widgets.find(w => w.name === "safety_threshold");

        function applyModel(model) {
            const isGrok = String(model || "").startsWith("grok");
            const deprecated = NO_SAMPLING.includes(model);

            if (temperatureWidget) {
                temperatureWidget.disabled = deprecated;
                if (temperatureWidget.options) {
                    temperatureWidget.options.tooltip = deprecated
                        ? `⚠️ ${model} ignores temperature — Google deprecated it. Use system_prompt and thinking_level instead.`
                        : "";
                }
            }
            if (thinkingWidget) thinkingWidget.disabled = isGrok;

            app.graph.setDirtyCanvas(true);
        }

        function applyProvider(provider) {
            const isGemini = provider === "Gemini";
            const isGrok = provider === "Grok";

            if (geminiApiKeyWidget) geminiApiKeyWidget.disabled = !isGemini;
            if (grokApiKeyWidget) grokApiKeyWidget.disabled = !isGrok;
            if (safetyWidget) safetyWidget.disabled = !isGemini;

            if (modelWidget) {
                const list = isGrok ? GROK_MODELS : GEMINI_MODELS;
                if (modelWidget.options?.values) modelWidget.options.values = [...list];
                if (!list.includes(modelWidget.value)) {
                    modelWidget.value = list[0];
                    if (modelWidget.callback) modelWidget.callback(list[0]);
                }
                applyModel(modelWidget.value);
            }

            app.graph.setDirtyCanvas(true);
        }

        if (modelWidget) {
            const origModelCb = modelWidget.callback;
            modelWidget.callback = function (value) {
                if (origModelCb) origModelCb.call(this, value);
                applyModel(value);
            };
        }

        if (providerWidget) {
            const origProviderCallback = providerWidget.callback;
            providerWidget.callback = function (value) {
                if (origProviderCallback) origProviderCallback.call(this, value);
                applyProvider(value);
            };
            applyProvider(providerWidget.value);
        }

        const outputWidget = node.addWidget("customtext", "output_text", "", () => {}, {
            multiline: true,
            serialize: false,
        });
        outputWidget.inputEl?.setAttribute("readonly", "true");

        const origOnExecuted = node.onExecuted;
        node.onExecuted = function (output) {
            if (origOnExecuted) origOnExecuted.call(this, output);
            if (output?.text?.[0] != null) {
                outputWidget.value = output.text[0];
                app.graph.setDirtyCanvas(true);
            }
        };
    },
});
