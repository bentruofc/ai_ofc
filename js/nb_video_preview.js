/**
 * nb_video_preview.js
 * Injects HTML5 <video> player in nodes that return MP4 videos.
 */
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const VIDEO_PREVIEW_NODES = [
    "PreviewImageWithoutMetadata",
    "SaveImageWithoutMetadata",
];

const IDLE_HEIGHT = 1;

/** Redirect wheel events to LiteGraph canvas (zoom graph). */
function forwardWheelToCanvas(el) {
    el.addEventListener("wheel", (e) => {
        const canvas = app.canvas?.canvas;
        if (!canvas) return;
        e.preventDefault();
        e.stopPropagation();
        canvas.dispatchEvent(new WheelEvent("wheel", {
            bubbles: true, cancelable: true, view: window,
            deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
            clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
            ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey,
        }));
    }, { passive: false });
}

function findAncestor(el, selector) {
    let cur = el?.parentElement;
    while (cur) {
        if (cur.matches?.(selector)) return cur;
        cur = cur.parentElement;
    }
    return null;
}

app.registerExtension({
    name: "aiofc.VideoPreview",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (!VIDEO_PREVIEW_NODES.includes(nodeData.name)) return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);
            const node = this;

            node._aiofcIdleH    = IDLE_HEIGHT;
            node._aiofcCurrentH = IDLE_HEIGHT;

            const container = document.createElement("div");
            container.style.cssText = `
                box-sizing: border-box;
                width: 100%;
                background: transparent;
                border-radius: 0;
                overflow: hidden;
                position: relative;
                display: block;
            `;
            container.style.height = node._aiofcCurrentH + "px";
            forwardWheelToCanvas(container);

            const video = document.createElement("video");
            video.controls    = true;
            video.loop        = true;
            video.autoplay    = true;
            video.muted       = true;
            video.playsInline = true;
            video.preload     = "auto";
            video.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: none;
                background: #000;
                border-radius: 4px;
            `;
            container.appendChild(video);

            node._aiofcVideoEl        = video;
            node._aiofcVideoContainer = container;
            node._aiofcVideoAspect    = 16 / 9;

            const domWidget = node.addDOMWidget(
                "aiofc_video_preview",
                "aiofc_video",
                container,
                { serialize: false, hideOnZoom: false }
            );
            node._aiofcVideoWidget = domWidget;

            if (domWidget) {
                domWidget.computeSize = function (width) {
                    return [width, node._aiofcCurrentH];
                };
            }

            const pinWrapper = () => {
                if (node._aiofcWrapperObs) return;
                const wrapper = findAncestor(container, ".dom-widget")
                             || container.parentElement;
                if (!wrapper) return;
                node._aiofcWrapperEl = wrapper;
                node._aiofcApplyWrapperHeight();

                node._aiofcWrapperObs = new MutationObserver(() => {
                    if (node._aiofcObsRaf) return;
                    node._aiofcObsRaf = requestAnimationFrame(() => {
                        node._aiofcObsRaf = null;
                        node._aiofcApplyWrapperHeight();
                    });
                });
                node._aiofcWrapperObs.observe(wrapper, {
                    attributes: true,
                    attributeFilter: ["style"],
                });
            };

            node._aiofcPinTimers = [];
            node._aiofcPinTimers.push(setTimeout(pinWrapper, 0));
            node._aiofcPinTimers.push(setTimeout(pinWrapper, 200));

            video.addEventListener("loadedmetadata", () => {
                if (!video.videoWidth || !video.videoHeight) return;
                node._aiofcVideoAspect = video.videoWidth / video.videoHeight;
                node._aiofcResizeToVideo();
            });
            video.addEventListener("error", () => {
                console.warn("[Aiofc Video Preview] Video load error:",
                             video.src, "code:", video.error?.code);
            });

            const origOnResize = node.onResize;
            node.onResize = function (size) {
                if (origOnResize) origOnResize.apply(this, arguments);
                if (!node._aiofcVideoHasSource) return;
                if (node._aiofcResizeRaf) return;
                node._aiofcResizeRaf = requestAnimationFrame(() => {
                    node._aiofcResizeRaf = null;
                    const aspect = node._aiofcVideoAspect || (16 / 9);
                    const w = Math.max(80, node.size?.[0] || 360);
                    node._aiofcCurrentH = Math.max(40,
                        Math.round(w / Math.max(0.1, aspect)));
                    node._aiofcApplyWrapperHeight();
                });
            };

            const origOnRemoved = node.onRemoved;
            node.onRemoved = function () {
                try {
                    if (node._aiofcWrapperObs) {
                        node._aiofcWrapperObs.disconnect();
                        node._aiofcWrapperObs = null;
                    }
                } catch (_) {}
                try {
                    if (Array.isArray(node._aiofcPinTimers)) {
                        for (const t of node._aiofcPinTimers) clearTimeout(t);
                        node._aiofcPinTimers = null;
                    }
                    if (node._aiofcResizeRaf) {
                        cancelAnimationFrame(node._aiofcResizeRaf);
                        node._aiofcResizeRaf = null;
                    }
                    if (node._aiofcObsRaf) {
                        cancelAnimationFrame(node._aiofcObsRaf);
                        node._aiofcObsRaf = null;
                    }
                    if (node._aiofcResizeReapply) {
                        clearTimeout(node._aiofcResizeReapply);
                        node._aiofcResizeReapply = null;
                    }
                } catch (_) {}
                try {
                    const v = node._aiofcVideoEl;
                    if (v) {
                        v.pause();
                        v.removeAttribute("src");
                        v.load();
                        v.onloadedmetadata = null;
                        v.onerror = null;
                    }
                } catch (_) {}
                node._aiofcVideoEl        = null;
                node._aiofcVideoContainer = null;
                node._aiofcWrapperEl      = null;
                node._aiofcVideoWidget    = null;
                node._aiofcVideoHasSource = false;
                if (origOnRemoved) origOnRemoved.apply(this, arguments);
            };
        };

        nodeType.prototype._aiofcApplyWrapperHeight = function () {
            const node = this;
            const h = node._aiofcCurrentH || node._aiofcIdleH || IDLE_HEIGHT;
            const wrapper = node._aiofcWrapperEl;
            const pxH = h + "px";
            if (wrapper) {
                if (wrapper.style.height !== pxH) {
                    wrapper.style.setProperty("height", pxH, "important");
                }
                if (wrapper.style.minHeight !== pxH) {
                    wrapper.style.setProperty("min-height", pxH, "important");
                }
            }
            if (node._aiofcVideoContainer
                && node._aiofcVideoContainer.style.height !== pxH) {
                node._aiofcVideoContainer.style.height = pxH;
            }
        };

        nodeType.prototype._aiofcResizeToVideo = function () {
            const node = this;
            if (node._aiofcResizing) return;
            node._aiofcResizing = true;
            try {
                const aspect = node._aiofcVideoAspect || (16 / 9);
                const w = Math.max(360, node.size?.[0] || 360);
                const h = Math.max(
                    200,
                    Math.min(4000, Math.round(w / Math.max(0.1, aspect)))
                );
                node._aiofcCurrentH = h;

                node._aiofcApplyWrapperHeight();

                const total = node.computeSize();
                const newW = Math.max(node.size?.[0] || 0, total[0]);
                const newH = Math.max(node.size?.[1] || 0, total[1]);
                if (typeof node.setSize === "function") {
                    node.setSize([newW, newH]);
                } else {
                    node.size[0] = newW;
                    node.size[1] = newH;
                }
                app.graph?.change?.();
                app.graph?.setDirtyCanvas?.(true, true);

                if (node._aiofcResizeReapply) {
                    clearTimeout(node._aiofcResizeReapply);
                }
                node._aiofcResizeReapply = setTimeout(() => {
                    node._aiofcResizeReapply = null;
                    node._aiofcApplyWrapperHeight();
                }, 100);
            } finally {
                node._aiofcResizing = false;
            }
        };

        const origOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (output) {
            if (origOnExecuted) origOnExecuted.call(this, output);

            const node = this;
            const gifs = output?.gifs ?? [];
            const videoGif = gifs.find(
                (g) => g.format?.startsWith("video/") ||
                       (g.filename && /\.(mp4|webm|mov|m4v)$/i.test(g.filename))
            );

            if (!videoGif) {
                node._aiofcHideVideo();
                return;
            }

            node.imgs = null;
            node.imageIndex = 0;

            const url = api.apiURL(
                `/view?filename=${encodeURIComponent(videoGif.filename)}` +
                `&type=${encodeURIComponent(videoGif.type ?? "temp")}` +
                `&subfolder=${encodeURIComponent(videoGif.subfolder ?? "")}` +
                `&t=${Date.now()}`
            );
            node._aiofcShowVideo(url);
        };

        nodeType.prototype._aiofcShowVideo = function (url) {
            const node = this;
            if (!node._aiofcVideoEl) return;
            node._aiofcVideoHasSource = true;
            node._aiofcVideoEl.style.display = "block";
            node._aiofcVideoEl.src = url;
            node._aiofcVideoEl.load();
            node._aiofcVideoEl.play().catch(() => {});
        };

        nodeType.prototype._aiofcHideVideo = function () {
            const node = this;
            if (!node._aiofcVideoEl) return;
            try { node._aiofcVideoEl.pause(); } catch (_) {}
            node._aiofcVideoEl.removeAttribute("src");
            node._aiofcVideoEl.load();
            node._aiofcVideoEl.style.display = "none";
            node._aiofcVideoHasSource = false;
            node._aiofcCurrentH = node._aiofcIdleH;
            node._aiofcApplyWrapperHeight();
            app.graph?.setDirtyCanvas?.(true, true);
        };
    },
});
