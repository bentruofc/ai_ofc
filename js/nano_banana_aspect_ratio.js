// ---
// ComfyUI INSTARAW - Nano Banana Pro Aspect Ratio Visual Preview
// Copyright © 2025 Instara. All rights reserved.
// PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
// ---

import { app } from "../../scripts/app.js";

// Aspect ratio numerical values for preview rendering
const ASPECT_RATIO_VALUES = {
    "1:1 (Square)": { w: 1, h: 1 },
    "3:2 (Landscape)": { w: 3, h: 2 },
    "2:3 (Portrait)": { w: 2, h: 3 },
    "3:4 (Portrait)": { w: 3, h: 4 },
    "4:3 (Landscape)": { w: 4, h: 3 },
    "4:5 (Portrait)": { w: 4, h: 5 },
    "5:4 (Landscape)": { w: 5, h: 4 },
    "9:16 (Tall Portrait)": { w: 9, h: 16 },
    "16:9 (Wide Landscape)": { w: 16, h: 9 },
    "21:9 (Ultrawide)": { w: 21, h: 9 },
};

// Resolution labels with approximate dimensions
const RESOLUTION_INFO = {
    "1K": "~1024px",
    "2K": "~2048px",
    "4K": "~4096px",
};

app.registerExtension({
    name: "Comfy.INSTARAW.NanoBananaAspectRatio",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "INSTARAW_NanoBananaAspectRatio") {
            return;
        }

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            // Store reference to node
            const node = this;

            // Find the aspect_ratio widget
            const aspectWidget = this.widgets.find((w) => w.name === "aspect_ratio");
            const resolutionWidget = this.widgets.find((w) => w.name === "resolution");

            if (!aspectWidget) return;

            // Create custom preview widget
            const previewWidget = {
                name: "aspect_preview",
                type: "custom",
                value: null,
                computeSize: function () {
                    return [0, 80]; // Fixed height for preview area
                },
                draw: function (ctx, node, width, y) {
                    const selectedRatio = aspectWidget.value || "1:1 (Square)";
                    const selectedRes = resolutionWidget?.value || "1K";
                    const ratio = ASPECT_RATIO_VALUES[selectedRatio] || { w: 1, h: 1 };

                    // Calculate preview box dimensions
                    const maxWidth = width - 40;
                    const maxHeight = 60;
                    let boxWidth, boxHeight;

                    if (ratio.w / ratio.h > maxWidth / maxHeight) {
                        // Width constrained
                        boxWidth = maxWidth;
                        boxHeight = (maxWidth * ratio.h) / ratio.w;
                    } else {
                        // Height constrained
                        boxHeight = maxHeight;
                        boxWidth = (maxHeight * ratio.w) / ratio.h;
                    }

                    // Center the box
                    const boxX = (width - boxWidth) / 2;
                    const boxY = y + (80 - boxHeight) / 2;

                    // Draw background
                    ctx.fillStyle = "#1a1a2e";
                    ctx.fillRect(10, y + 5, width - 20, 70);

                    // Draw aspect ratio preview box
                    ctx.fillStyle = "#4a90d9";
                    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

                    // Draw border
                    ctx.strokeStyle = "#6ab0ff";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

                    // Draw ratio text below the preview box
                    const ratioText = selectedRatio.split(" ")[0]; // e.g., "16:9"
                    const resInfo = RESOLUTION_INFO[selectedRes] || "";
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "bold 11px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    ctx.fillText(`${ratioText}  •  ${selectedRes} (${resInfo})`, width / 2, boxY + boxHeight + 6);
                },
            };

            // Add preview widget after resolution
            this.addCustomWidget(previewWidget);

            // Update preview when aspect ratio changes
            const originalAspectCallback = aspectWidget.callback;
            aspectWidget.callback = (value) => {
                originalAspectCallback?.(value);
                node.setDirtyCanvas(true, true);
            };

            // Update preview when resolution changes
            if (resolutionWidget) {
                const originalResCallback = resolutionWidget.callback;
                resolutionWidget.callback = (value) => {
                    originalResCallback?.(value);
                    node.setDirtyCanvas(true, true);
                };
            }

            // Ensure proper sizing
            this.computeSize();
        };
    },
});
