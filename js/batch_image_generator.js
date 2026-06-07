// ---
// Filename: ../ComfyUI_INSTARAW/js/batch_image_generator.js
// Batch Image Generator - Real-time Progress UI
// Following RPG patterns exactly for clean, growing layout
// ---

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { renderComboCards, getComboMaxLength } from "./shared/combo-cards.js";

// Job state constants (match Python JobState enum)
const JobState = {
    PENDING: "pending",
    GENERATING: "generating",
    SUCCESS: "success",
    FAILED: "failed",
    CACHED: "cached",
    RETRYING: "retrying",
    CANCELLED: "cancelled",
};

// State styling
const STATE_CONFIG = {
    [JobState.PENDING]: { class: "pending", text: "Pending", icon: "⏳" },
    [JobState.GENERATING]: { class: "in-progress", text: "Generating...", icon: "🔄" },
    [JobState.SUCCESS]: { class: "success", text: "Complete", icon: "✓" },
    [JobState.FAILED]: { class: "error", text: "Failed", icon: "✖" },
    [JobState.CACHED]: { class: "cached", text: "Cached", icon: "📦" },
    [JobState.RETRYING]: { class: "retrying", text: "Retrying...", icon: "🔁" },
    [JobState.CANCELLED]: { class: "cancelled", text: "Cancelled", icon: "⊘" },
};

console.log("[BIG] ========== BATCH IMAGE GENERATOR JS LOADED ==========");

// Load PhotoSwipe dynamically from CDN
let photoSwipeLoadPromise = null;

const loadPhotoSwipe = () => {
    if (photoSwipeLoadPromise) return photoSwipeLoadPromise; // Already loading/loaded

    // Check if PhotoSwipe was loaded by something else (e.g., cached local files)
    if (window.PhotoSwipe) {
        console.warn("[BIG] PhotoSwipe already exists on window - might be from cached local files. Forcing CSS load...");
        // Force load CSS from CDN (local files don't include CSS)
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.css';
        document.head.appendChild(css);
        console.log("[BIG] Loaded PhotoSwipe CSS from CDN");
        photoSwipeLoadPromise = Promise.resolve();
        return photoSwipeLoadPromise;
    }

    photoSwipeLoadPromise = new Promise((resolve, reject) => {
        // Load CSS from CDN
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/photoswipe.css';
        css.onerror = () => console.error("[BIG] PhotoSwipe CDN CSS failed to load!");
        css.onload = () => console.log("[BIG] PhotoSwipe CSS loaded from CDN");
        document.head.appendChild(css);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe.umd.min.js';
        script.onload = () => {
            const lightboxScript = document.createElement('script');
            lightboxScript.src = 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.3/dist/umd/photoswipe-lightbox.umd.min.js';
            lightboxScript.onload = () => {
                console.log("[BIG] PhotoSwipe scripts loaded");
                resolve();
            };
            lightboxScript.onerror = reject;
            document.head.appendChild(lightboxScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return photoSwipeLoadPromise;
};

// Start loading PhotoSwipe on startup (don't await - it's background)
loadPhotoSwipe().then(() => {
    console.log("[BIG] PhotoSwipe ready");
}).catch(e => {
    console.error("[BIG] Failed to load PhotoSwipe:", e);
});

app.registerExtension({
    name: "Comfy.INSTARAW.BatchImageGenerator",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "INSTARAW_BatchImageGenerator") {
            console.log("[BIG] Registering custom UI for BatchImageGenerator");

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                console.log("[BIG] Node created, setting up custom UI");
                const node = this;
                let cachedHeight = 180;
                let isUpdatingHeight = false;

                // Create hidden widget to store node identifier (needed for file paths)
                // Uses a stable unique ID that persists across sessions
                if (!node._ni_widget) {
                    node._ni_widget = node.addWidget("text", "node_identifier", "", () => {}, { serialize: true });
                    node._ni_widget.hidden = true;
                }
                // Generate stable unique ID only if not already set (preserve across saves/loads)
                if (!node._ni_widget.value || node._ni_widget.value === "" || node._ni_widget.value === "undefined") {
                    // Use node.id as base - it's unique within the workflow
                    node._ni_widget.value = String(node.id);
                    console.log("[BIG] Generated node_identifier:", node._ni_widget.value);
                }

                // Create hidden widget to store generated batch data (RPG pattern)
                if (!node.widgets?.find(w => w.name === "generated_batch_data")) {
                    const genBatchWidget = node.addWidget("text", "generated_batch_data", "[]", () => {}, { serialize: true });
                    genBatchWidget.hidden = true;
                    console.log("[BIG] Created generated_batch_data widget");
                }

                // Session storage key - uses node ID only for simplicity
                // Node IDs are unique within a ComfyUI session
                const getSessionKey = () => {
                    // Use a simple key based on node ID - it's unique per node in the session
                    return `instaraw_big_${node.id}`;
                };

                // Save to session storage (survives tab switches!)
                const saveToSession = (data) => {
                    try {
                        const key = getSessionKey();
                        sessionStorage.setItem(key, data);
                        console.log(`[BIG] 💾 Saved to sessionStorage[${key}]: ${data.length} chars`);
                    } catch (e) {
                        console.warn("[BIG] Failed to save to session storage:", e);
                    }
                };

                // Restore from session storage, node.properties, or widget
                const restoreFromWidget = () => {
                    try {
                        let dataSource = null;
                        let sourceName = "";

                        // 1. Try session storage first (survives tab switches!)
                        const sessionKey = getSessionKey();
                        const sessionData = sessionStorage.getItem(sessionKey);
                        if (sessionData && sessionData !== "[]" && sessionData.length > 2) {
                            dataSource = sessionData;
                            sourceName = "sessionStorage";
                        }
                        // 2. Then try properties
                        else if (node.properties?.big_jobs_data && node.properties.big_jobs_data !== "[]") {
                            dataSource = node.properties.big_jobs_data;
                            sourceName = "properties";
                        }
                        // 3. Finally try widget
                        else {
                            const genBatchWidget = node.widgets?.find(w => w.name === "generated_batch_data");
                            if (genBatchWidget && genBatchWidget.value && genBatchWidget.value !== "[]") {
                                dataSource = genBatchWidget.value;
                                sourceName = "widget";
                            }
                        }

                        if (dataSource) {
                            const batchData = JSON.parse(dataSource);
                            if (batchData && batchData.length > 0) {
                                console.log(`[BIG] 🔄 Restoring ${batchData.length} jobs from ${sourceName}`);

                                // Reconstruct image URLs from filenames (we don't store base64 anymore)
                                // Images are saved to: {ComfyUI}/output/{subdir}/{filename}
                                // Use ComfyUI's standard /view endpoint to serve them
                                let reconstructedCount = 0;
                                batchData.forEach(job => {
                                    // Reconstruct URL if:
                                    // - Job has filename and is success/cached
                                    // - AND either no URL, or URL is base64, or URL uses old formats
                                    const needsReconstruction = job.filename &&
                                        (job.state === "success" || job.state === "cached") &&
                                        (!job.image_url ||
                                         job.image_url.startsWith("data:") ||
                                         job.image_url.startsWith("/extensions/") ||
                                         job.image_url.startsWith("/instaraw/batch_gen_image/"));

                                    if (needsReconstruction) {
                                        // Support both new 'subfolder' and legacy 'output_subdir' keys
                                        // Note: Empty string "" means root output folder (no subfolder)
                                        let subdir;
                                        if ('subfolder' in job) {
                                            subdir = job.subfolder;  // Could be "" for root folder
                                        } else if ('output_subdir' in job) {
                                            subdir = job.output_subdir;
                                        } else {
                                            subdir = "";  // Default to root output folder
                                        }
                                        // Use ComfyUI's standard /view endpoint
                                        job.image_url = `/view?filename=${encodeURIComponent(job.filename)}&subfolder=${encodeURIComponent(subdir)}&type=output`;
                                        console.log(`[BIG] 🔗 Reconstructed URL for job ${job.id}: filename="${job.filename}", subdir="${subdir}" → ${job.image_url}`);
                                        reconstructedCount++;
                                    } else if (!job.filename && (job.state === "success" || job.state === "cached")) {
                                        console.warn(`[BIG] ⚠️ Job ${job.id} is ${job.state} but has NO filename! Cannot reconstruct URL.`);
                                    }
                                });

                                if (reconstructedCount > 0) {
                                    console.log(`[BIG] 🔗 Reconstructed ${reconstructedCount} image URLs from filenames`);
                                } else {
                                    console.log(`[BIG] ℹ️ No URLs needed reconstruction. Job details:`);
                                    batchData.forEach(j => {
                                        console.log(`[BIG]   Job ${j.id}: state="${j.state}", filename="${j.filename || 'NULL'}", hasUrl=${!!j.image_url}, urlPrefix="${j.image_url?.substring(0, 50) || 'none'}"`);
                                    });
                                }

                                // Validate existing image URLs
                                let invalidUrlCount = 0;
                                batchData.forEach(job => {
                                    if (job.image_url) {
                                        const isBase64 = job.image_url.startsWith("data:");
                                        const isTempUrl = job.image_url.includes("type=temp");

                                        if (isTempUrl) {
                                            job._urlNeedsValidation = true;
                                            invalidUrlCount++;
                                        }
                                    }
                                });

                                if (invalidUrlCount > 0) {
                                    console.log(`[BIG] ⚠️ ${invalidUrlCount} jobs have temp URLs that may need validation`);
                                }

                                // For jobs in "generating"/"retrying" state, we'll check backend status
                                // Don't mark as failed yet - backend might still have results!
                                const generatingJobs = batchData.filter(j => j.state === "generating" || j.state === "retrying");
                                const pendingJobs = batchData.filter(j => j.state === "pending");

                                if (generatingJobs.length > 0) {
                                    console.log(`[BIG] 🔍 ${generatingJobs.length} jobs were generating - checking backend...`);
                                    // Schedule async backend check (don't block restore)
                                    setTimeout(() => checkBackendProgress(batchData), 100);
                                }
                                if (pendingJobs.length > 0) {
                                    console.log(`[BIG] ℹ️ ${pendingJobs.length} pending jobs ready to run`);
                                }

                                node._bigJobs = batchData;
                                console.log(`[BIG][fix1] Restored ${batchData.length} jobs, dimensions:`, batchData.map(j => `${j.id}:${j.image_width}x${j.image_height}`).join(', '));

                                // Recalculate stats (after updating interrupted jobs)
                                node._bigStats = {
                                    total: batchData.length,
                                    completed: batchData.filter(j => j.state === "success" || j.state === "cached" || j.state === "failed" || j.state === "cancelled").length,
                                    success: batchData.filter(j => j.state === "success").length,
                                    failed: batchData.filter(j => j.state === "failed").length,
                                    cached: batchData.filter(j => j.state === "cached").length,
                                };
                                node._bigIsGenerating = false; // Never restore "generating" state

                                // IMPORTANT: Re-save to session storage after restoring and modifying job states
                                // This ensures session storage has the corrected states for next tab switch
                                const correctedData = JSON.stringify(batchData);
                                saveToSession(correctedData);

                                // Also update widget and properties with corrected data
                                node.properties = node.properties || {};
                                node.properties.big_jobs_data = correctedData;
                                const widget = node.widgets?.find(w => w.name === "generated_batch_data");
                                if (widget) widget.value = correctedData;

                                return true;
                            }
                        }
                    } catch (e) {
                        console.error("[BIG] Failed to restore:", e);
                    }
                    return false;
                };

                // Check backend for real-time progress of jobs that were "generating"
                const checkBackendProgress = async (localJobs) => {
                    try {
                        const nodeId = node._ni_widget?.value || String(node.id);
                        console.log(`[BIG] 🔍 Checking backend progress for node ${nodeId}...`);

                        const response = await fetch(`/instaraw/batch_gen_progress/${nodeId}`);
                        const backendData = await response.json();

                        if (backendData && backendData.jobs && backendData.jobs.length > 0) {
                            console.log(`[BIG] ✅ Backend has ${backendData.jobs.length} jobs!`);

                            // Merge backend data with local jobs
                            let updatedCount = 0;
                            localJobs.forEach(localJob => {
                                const backendJob = backendData.jobs.find(bj => bj.id === localJob.id);
                                if (backendJob) {
                                    // Backend has data for this job - update local state
                                    if (backendJob.state === "success" || backendJob.state === "cached") {
                                        localJob.state = backendJob.state;
                                        localJob.image_url = backendJob.image_url || localJob.image_url;
                                        localJob.error = null;
                                        updatedCount++;
                                        console.log(`[BIG] ✅ Job ${localJob.id}: ${backendJob.state}`);
                                    } else if (backendJob.state === "failed") {
                                        localJob.state = "failed";
                                        localJob.error = backendJob.error || "Failed on backend";
                                        updatedCount++;
                                    } else if (backendJob.state === "generating") {
                                        // Still generating on backend! Resume polling
                                        console.log(`[BIG] 🔄 Job ${localJob.id} still generating on backend`);
                                        node._bigIsGenerating = true;
                                    }
                                }
                            });

                            if (updatedCount > 0) {
                                console.log(`[BIG] ✅ Updated ${updatedCount} jobs from backend`);
                                node._bigJobs = localJobs;
                                updateGeneratedBatchData();
                                if (node._renderUI) node._renderUI();
                            }

                            // If still generating, start polling
                            if (backendData.is_generating) {
                                console.log(`[BIG] 🔄 Backend still generating - starting polling`);
                                if (node._startPolling) node._startPolling();
                            }
                        } else {
                            // Backend has no data - mark generating jobs as interrupted
                            console.log(`[BIG] ⚠️ No backend data - marking jobs as interrupted`);
                            localJobs.forEach(job => {
                                if (job.state === "generating" || job.state === "retrying") {
                                    job.state = "failed";
                                    job.error = "Interrupted by tab switch - click Retry";
                                }
                            });
                            node._bigJobs = localJobs;
                            updateGeneratedBatchData();
                            if (node._renderUI) node._renderUI();
                        }
                    } catch (e) {
                        console.error("[BIG] Failed to check backend progress:", e);
                        // On error, mark as interrupted
                        localJobs.forEach(job => {
                            if (job.state === "generating" || job.state === "retrying") {
                                job.state = "failed";
                                job.error = "Interrupted - backend check failed";
                            }
                        });
                        node._bigJobs = localJobs;
                        if (node._renderUI) node._renderUI();
                    }
                };

                // Store functions on node so onConfigure can call them
                node._restoreFromWidget = restoreFromWidget;
                node._getSessionKey = getSessionKey;
                node._saveToSession = saveToSession;
                node._checkBackendProgress = checkBackendProgress;

                // Try initial restore (may fail if widget not loaded yet - onConfigure will retry)
                restoreFromWidget();

                // Generation state (initialized fresh, onConfigure will restore from widget)
                node._bigJobs = node._bigJobs || [];
                node._bigIsGenerating = false;
                node._bigStats = node._bigStats || { total: 0, completed: 0, success: 0, failed: 0, cached: 0 };
                node._bigStartTime = null;
                node._bigAbortController = null; // AbortController for smooth cancellation (RPG pattern)

                // Save state - no-op now since we rely solely on widget persistence
                // (localStorage caused cross-workflow state leakage issues)
                const saveState = () => {
                    // State is saved via updateGeneratedBatchData() which updates the widget
                    // The widget is serialized with the workflow file
                };

                // Get connected model/provider info (similar to AIL pattern)
                const getConnectedInputValue = (inputName) => {
                    const input = node.inputs?.find(i => i.name === inputName);
                    if (!input || !input.link) return null;

                    const link = app.graph.links[input.link];
                    if (!link) return null;

                    const originNode = app.graph.getNodeById(link.origin_id);
                    if (!originNode) return null;

                    // Get the widget value from the origin node
                    const widget = originNode.widgets?.[link.origin_slot];
                    return widget ? widget.value : null;
                };

                const getModelProviderInfo = () => {
                    const model = getConnectedInputValue("model");
                    const provider = getConnectedInputValue("provider");
                    // Check if model is Nano Banana Pro (the only supported model for now)
                    const isNanoBananaPro = model === "Nano Banana Pro" || model === "nano_banana_pro";
                    const isSupported = isNanoBananaPro;
                    return { model, provider, isNanoBananaPro, isSupported };
                };

                // Get widget value from this node
                const getWidgetValue = (widgetName, defaultVal = null) => {
                    const widget = node.widgets?.find(w => w.name === widgetName);
                    return widget?.value ?? defaultVal;
                };

                // Helper to read boolean from widget or connected input (prioritizes connection)
                const getBooleanValue = (inputName) => {
                    const widget = node.widgets?.find(w => w.name === inputName);
                    const input = node.inputs?.find(i => i.name === inputName);

                    // Prioritize connected input over widget
                    if (input && input.link) {
                        const link = app.graph?.links?.[input.link];
                        if (link) {
                            const originNode = app.graph.getNodeById(link.origin_id);
                            if (originNode) {
                                const srcWidget = originNode.widgets?.[0] || originNode.widgets?.find(w => w.name === "value");
                                if (srcWidget) return srcWidget.value === true;
                            }
                        }
                    }
                    return widget?.value === true;
                };

                // Get multi-image mode info for UI display
                const getMultiImageInfo = () => {
                    const multiImage = getBooleanValue("multi_image");
                    const provider = getConnectedInputValue("provider") || "";
                    const isActive = multiImage && provider === "wavespeed.ai";
                    const isWarning = multiImage && provider && provider !== "wavespeed.ai";
                    const isNoProvider = multiImage && !provider;

                    // Check aspect ratio compatibility for multi-image mode
                    const MULTI_SUPPORTED_RATIOS = ["3:2", "2:3", "3:4", "4:3"];
                    let aspectRatioRaw = String(getConnectedInputValue("aspect_ratio") || "1:1");
                    // Extract ratio from labels like "3:4 (Portrait)" -> "3:4"
                    const match = aspectRatioRaw.match(/(\d+:\d+)/);
                    const aspectRatio = match ? match[1] : aspectRatioRaw;
                    const aspectRatioSupported = MULTI_SUPPORTED_RATIOS.includes(aspectRatio);
                    const aspectRatioWarning = isActive && !aspectRatioSupported;

                    return { multiImage, provider, isActive, isWarning, isNoProvider, aspectRatio, aspectRatioSupported, aspectRatioWarning };
                };

                // Toggle 2X multi-image mode
                const toggleMultiImageMode = (enabled) => {
                    const multiImageWidget = node.widgets?.find(w => w.name === "multi_image");
                    if (multiImageWidget) {
                        multiImageWidget.value = enabled;
                        multiImageWidget.callback?.(enabled);
                        console.log("[BIG] 2X mode toggled:", enabled);
                    }
                };

                // Helper to find AIL node connected to an input (traversing through pass-through nodes)
                const findConnectedAIL = (inputName) => {
                    const input = node.inputs?.find(i => i.name === inputName);
                    if (!input || !input.link) return null;

                    const traverseToAIL = (nodeToCheck, depth = 0) => {
                        if (!nodeToCheck || depth > 5) return null;

                        // Check if this is an AIL node
                        if (nodeToCheck.type === "INSTARAW_AdvancedImageLoader" && nodeToCheck.properties?.batch_data) {
                            return nodeToCheck;
                        }

                        // Traverse upstream through IMAGE inputs
                        if (nodeToCheck.inputs) {
                            for (const inp of nodeToCheck.inputs) {
                                if ((inp.type === "IMAGE" || inp.name === "images") && inp.link) {
                                    const link = app.graph?.links?.[inp.link];
                                    if (link) {
                                        const upstream = app.graph.getNodeById(link.origin_id);
                                        const result = traverseToAIL(upstream, depth + 1);
                                        if (result) return result;
                                    }
                                }
                            }
                        }
                        return null;
                    };

                    const link = app.graph?.links?.[input.link];
                    if (!link) return null;
                    const sourceNode = app.graph.getNodeById(link.origin_id);
                    return traverseToAIL(sourceNode, 0);
                };

                const getGenerationPreviewInfo = () => {
                    // Get generations_per_combination from widget
                    const genWidget = node.widgets?.find(w => w.name === "generations_per_combination");
                    const generationsPerCombination = genWidget?.value || 1;

                    // Try to get prompt count from RPG connection
                    const promptInput = node.inputs?.find(i => i.name === "prompt_list_positive");
                    let promptCount = 0;
                    if (promptInput?.link) {
                        const link = app.graph.links[promptInput.link];
                        if (link) {
                            const rpgNode = app.graph.getNodeById(link.origin_id);
                            if (rpgNode) {
                                // RPG stores prompts in _rpgPromptBatch
                                const promptBatch = rpgNode._rpgPromptBatch || [];
                                promptCount = promptBatch.length;
                            }
                        }
                    }

                    // Try to get image count from AIL connection (via RPG)
                    const imagesInput = node.inputs?.find(i => i.name === "images");
                    let imageCount = 0;
                    if (imagesInput?.link) {
                        const link = app.graph.links[imagesInput.link];
                        if (link) {
                            const sourceNode = app.graph.getNodeById(link.origin_id);
                            if (sourceNode) {
                                // Could be AIL or RPG
                                if (sourceNode._linkedImageCount !== undefined) {
                                    imageCount = sourceNode._linkedImageCount; // From RPG
                                } else if (sourceNode.properties?.batch_data) {
                                    // From AIL directly
                                    try {
                                        const batchData = JSON.parse(sourceNode.properties.batch_data);
                                        imageCount = (batchData.images || batchData.latents || []).length;
                                    } catch (e) {
                                        console.warn("[BIG] Failed to parse AIL batch_data:", e);
                                    }
                                }
                            }
                        }
                    }

                    // Calculate total jobs
                    const totalJobs = promptCount > 0 ? promptCount * generationsPerCombination : 0;

                    return {
                        imageCount,
                        promptCount,
                        generationsPerCombination,
                        totalJobs,
                        hasInputs: promptCount > 0 || imageCount > 0
                    };
                };

                // ═══════════════════════════════════════════════════════════════════
                // MODE DETECTION (T2I vs I2I) - Similar to RPG
                // ═══════════════════════════════════════════════════════════════════

                const getConnectedImagesInfo = () => {
                    /**
                     * Get connected images info (uses cached node data from sync interval).
                     * Returns { mode, imageCount, imageUrls, sourceNodeId }
                     */
                    // Use cached data from node (updated by polling interval)
                    return {
                        mode: node._bigMode || "txt2img",
                        imageCount: node._bigImageCount || 0,
                        imageUrls: node._bigImageUrls || [],
                        sourceNodeId: null
                    };
                };

                // Fetch image as base64 from URL (for I2I mode)
                const fetchImageAsBase64 = async (imageUrl) => {
                    try {
                        // If already a data URL, extract the base64 part
                        if (imageUrl.startsWith("data:")) {
                            return imageUrl.split(",")[1];
                        }

                        // Fetch from ComfyUI view endpoint
                        const response = await fetch(imageUrl);
                        if (!response.ok) {
                            console.error(`[BIG] Failed to fetch image: ${response.status}`);
                            return null;
                        }

                        const blob = await response.blob();
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64 = reader.result.split(",")[1];
                                resolve(base64);
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) {
                        console.error("[BIG] Error fetching image as base64:", e);
                        return null;
                    }
                };

                // Store mode info on node for UI
                node._bigMode = "txt2img";
                node._bigImageCount = 0;
                node._bigImageCounts = []; // Breakdown per AIL source for "3×10" display
                node._bigImageUrls = [];
                // Additional image inputs (images2, images3, images4)
                node._bigImage2Urls = [];
                node._bigImage3Urls = [];
                node._bigImage4Urls = [];

                // Helper to extract image URLs from a node (recursive for pass-through nodes)
                // MUST be defined before _updateModeFromSource which uses it
                const extractImageUrlsFromNode = (sourceNode, depth = 0, inputName = "") => {
                    if (!sourceNode || depth > 5) return []; // Max depth to prevent infinite loops

                    let urls = [];
                    const nodeType = sourceNode.type;
                    const prefix = `[BIG] ${inputName}${depth > 0 ? ` (upstream ${depth})` : ''}`;

                    // Check for preview images first (works for many node types after execution)
                    if (sourceNode.imgs && sourceNode.imgs.length > 0) {
                        urls = sourceNode.imgs.map(img => img.src).filter(Boolean);
                        if (urls.length > 0) return urls;
                    }

                    // Handle specific node types
                    if (nodeType === "INSTARAW_AdvancedImageLoader") {
                        try {
                            const batchData = JSON.parse(sourceNode.properties?.batch_data || "{}");
                            const order = batchData.order || [];
                            const ailImages = batchData.images || [];
                            const ailNodeId = sourceNode.id;

                            if (ailImages.length > 0) {
                                urls = order.length > 0
                                    ? order.map(imgId => {
                                        const img = ailImages.find(i => i.id === imgId);
                                        return img?.thumbnail
                                            ? `/instaraw/view/${img.thumbnail}`
                                            : null;
                                    }).filter(Boolean)
                                    : ailImages.map(img => img?.thumbnail
                                        ? `/instaraw/view/${img.thumbnail}`
                                        : null).filter(Boolean);
                            }
                        } catch (e) {
                            console.warn(`[BIG] Error parsing AIL batch_data:`, e);
                        }
                    } else if (nodeType === "INSTARAW_RealityPromptGenerator") {
                        urls = sourceNode._linkedImageUrls || sourceNode._linkedImages?.map(i => i.url) || [];
                    } else if (sourceNode.properties?.batch_data) {
                        try {
                            const batchData = JSON.parse(sourceNode.properties.batch_data);
                            urls = (batchData.images || []).map(i => i.url || i).filter(Boolean);
                        } catch (e) {}
                    }

                    // If no URLs found, traverse upstream (for pass-through nodes like ImageListFromBatch)
                    if (urls.length === 0 && sourceNode.inputs) {
                        // Look for IMAGE type inputs and traverse upstream
                        for (const input of sourceNode.inputs) {
                            const isImageType = input.type === "IMAGE" || input.type === "image" ||
                                               input.name === "images" || input.name === "image" ||
                                               input.name?.toLowerCase().includes("image");
                            if (isImageType && input.link) {
                                const upstreamLink = app.graph?.links?.[input.link];
                                if (upstreamLink) {
                                    const upstreamNode = app.graph.getNodeById(upstreamLink.origin_id);
                                    if (upstreamNode) {
                                        urls = extractImageUrlsFromNode(upstreamNode, depth + 1, inputName);
                                        if (urls.length > 0) break;
                                    }
                                }
                            }
                        }
                    }

                    return urls;
                };

                // Helper to update mode from source node (AIL or RPG)
                node._updateModeFromSource = (sourceNode) => {
                    if (!sourceNode) return;

                    let mode = "txt2img";
                    let imageCount = 0;
                    let imageUrls = [];
                    node._bigImageCounts = []; // Reset breakdown for fresh calculation

                    // Check if source is AIL
                    if (sourceNode.type === "INSTARAW_AdvancedImageLoader") {
                        // Read enable_img2img from AIL (widget or connected input)
                        const enableImg2ImgWidget = sourceNode.widgets?.find(w => w.name === "enable_img2img");
                        let enableImg2Img = enableImg2ImgWidget?.value;

                        // Check if enable_img2img is connected
                        const enableImg2ImgInput = sourceNode.inputs?.find(i => i.name === "enable_img2img");
                        if (enableImg2ImgInput && enableImg2ImgInput.link != null) {
                            const link = app.graph?.links?.[enableImg2ImgInput.link];
                            if (link) {
                                const srcNode = app.graph.getNodeById(link.origin_id);
                                if (srcNode) {
                                    const srcWidget = srcNode.widgets?.[link.origin_slot];
                                    if (srcWidget) enableImg2Img = srcWidget.value;
                                }
                            }
                        }

                        mode = (enableImg2Img === false || enableImg2Img === "false") ? "txt2img" : "img2img";

                        // Read images from batch_data
                        try {
                            const batchData = JSON.parse(sourceNode.properties?.batch_data || "{}");
                            const order = batchData.order || [];
                            const ailImages = batchData.images || [];
                            const ailNodeId = sourceNode.id;

                            if (mode === "img2img" && ailImages.length > 0) {
                                imageUrls = order.length > 0
                                    ? order.map(imgId => {
                                        const img = ailImages.find(i => i.id === imgId);
                                        return img?.thumbnail
                                            ? `/instaraw/view/${img.thumbnail}`
                                            : null;
                                    }).filter(Boolean)
                                    : ailImages.map(img => img?.thumbnail
                                        ? `/instaraw/view/${img.thumbnail}`
                                        : null).filter(Boolean);

                                imageCount = imageUrls.length;
                            }
                        } catch (e) {
                            console.warn("[BIG] Error parsing AIL batch_data:", e);
                        }
                    }
                    // Check if source is RPG (pass-through)
                    else if (sourceNode.type === "INSTARAW_RealityPromptGenerator") {
                        mode = sourceNode._linkedAILMode || "txt2img";
                        imageUrls = sourceNode._linkedImageUrls || sourceNode._linkedImages?.map(i => i.url) || [];
                        imageCount = imageUrls.length;

                        // Get breakdown of images per AIL source
                        const img1Count = (sourceNode._linkedImages || []).length;
                        const img2Count = (sourceNode._linkedImages2 || []).length;
                        const img3Count = (sourceNode._linkedImages3 || []).length;
                        const img4Count = (sourceNode._linkedImages4 || []).length;
                        node._bigImageCounts = [img1Count, img2Count, img3Count, img4Count].filter(c => c > 0);
                    }
                    // Other nodes - check for images
                    else if (sourceNode.properties?.batch_data) {
                        try {
                            const batchData = JSON.parse(sourceNode.properties.batch_data);
                            const images = batchData.images || [];
                            if (images.length > 0) {
                                mode = "img2img";
                                imageUrls = images.map(i => i.url || i).filter(Boolean);
                                imageCount = imageUrls.length;
                            }
                        } catch (e) {}
                    }
                    // Fallback: use recursive extraction for pass-through nodes
                    else {
                        imageUrls = extractImageUrlsFromNode(sourceNode, 0, "images");
                        if (imageUrls.length > 0) {
                            mode = "img2img";
                            imageCount = imageUrls.length;
                        }
                    }

                    node._bigMode = mode;
                    node._bigImageCount = imageCount;
                    node._bigImageUrls = imageUrls;
                    // If _bigImageCounts wasn't set by RPG path, use single source count
                    if (node._bigImageCounts.length === 0 && imageCount > 0) {
                        node._bigImageCounts = [imageCount];
                    }
                };

                // Helper to get image URLs from any connected image input
                const getImageUrlsFromInput = (inputName) => {
                    const imageInput = node.inputs?.find(input => input.name === inputName);
                    if (!imageInput || !imageInput.link) return [];

                    const link = app.graph?.links?.[imageInput.link];
                    if (!link) return [];

                    const sourceNode = app.graph.getNodeById(link.origin_id);
                    if (!sourceNode) return [];

                    // Use the recursive helper to extract URLs (handles pass-through nodes)
                    return extractImageUrlsFromNode(sourceNode, 0, inputName);
                };

                // Update additional image inputs
                const updateAdditionalImages = () => {
                    node._bigImage2Urls = getImageUrlsFromInput("images2");
                    node._bigImage3Urls = getImageUrlsFromInput("images3");
                    node._bigImage4Urls = getImageUrlsFromInput("images4");
                };

                // Track last known values for change detection
                let lastKnownProvider = getConnectedInputValue("provider") || "";
                let lastKnownModel = getConnectedInputValue("model") || "";
                let lastKnownEnableImg2Img = false;
                let lastKnownMultiImage = false;

                // Flag to track if initial restore from widget is complete
                node._bigInitialized = false;

                // Periodic mode sync (every 500ms) - only when NOT generating
                node._modeSyncInterval = setInterval(() => {
                    // Skip re-renders during generation - progress polling handles that
                    if (node._bigIsGenerating) return;

                    // Skip until onConfigure has had a chance to restore state
                    // This prevents race conditions where we render before widget data is loaded
                    if (!node._bigInitialized) return;

                    // Capture current state for comparison
                    const oldMode = node._bigMode;
                    const oldCount = node._bigImageCount;
                    const oldProvider = lastKnownProvider;
                    const oldModel = lastKnownModel;
                    const oldEnableImg2Img = lastKnownEnableImg2Img;
                    const oldMultiImage = lastKnownMultiImage;

                    // Update image URLs from connected sources
                    const imagesInput = node.inputs?.find(input => input.name === "images");
                    if (imagesInput && imagesInput.link) {
                        const link = app.graph?.links?.[imagesInput.link];
                        if (link) {
                            const sourceNode = app.graph.getNodeById(link.origin_id);
                            if (sourceNode) {
                                node._updateModeFromSource(sourceNode);
                            }
                        }
                    } else {
                        node._bigImageUrls = [];
                    }
                    updateAdditionalImages();

                    // Read current values
                    const enableImg2Img = getBooleanValue("enable_img2img");
                    const multiImage = getBooleanValue("multi_image");
                    const currentProvider = getConnectedInputValue("provider") || "";
                    const currentModel = getConnectedInputValue("model") || "";

                    // Determine mode
                    const hasAnyImageLinks =
                        (node.inputs?.find(i => i.name === "images")?.link != null) ||
                        (node.inputs?.find(i => i.name === "images2")?.link != null) ||
                        (node.inputs?.find(i => i.name === "images3")?.link != null) ||
                        (node.inputs?.find(i => i.name === "images4")?.link != null);

                    node._bigMode = (enableImg2Img && hasAnyImageLinks) ? "img2img" : "txt2img";

                    const img1Count = node._bigImageUrls.length;
                    const img2Count = node._bigImage2Urls.length;
                    const img3Count = node._bigImage3Urls.length;
                    const img4Count = node._bigImage4Urls.length;
                    const totalImageCount = img1Count + img2Count + img3Count + img4Count;

                    // Update tracking variables
                    lastKnownProvider = currentProvider;
                    lastKnownModel = currentModel;
                    lastKnownEnableImg2Img = enableImg2Img;
                    lastKnownMultiImage = multiImage;
                    node._bigImageCount = totalImageCount;
                    node._bigImageCounts = [img1Count, img2Count, img3Count, img4Count].filter(c => c > 0);

                    // Only re-render if something actually changed
                    const modeChanged = oldMode !== node._bigMode;
                    const countChanged = oldCount !== totalImageCount;
                    const providerChanged = oldProvider !== currentProvider;
                    const modelChanged = oldModel !== currentModel;
                    const enableChanged = oldEnableImg2Img !== enableImg2Img;
                    const multiChanged = oldMultiImage !== multiImage;

                    if (modeChanged || countChanged || providerChanged || modelChanged || enableChanged || multiChanged) {
                        renderUI();
                    }
                }, 500);

                // Container setup (AIL/RPG pattern)
                const container = document.createElement("div");
                container.className = "instaraw-big-container";
                container.style.width = "100%";
                container.style.boxSizing = "border-box";
                container.style.overflow = "hidden";
                container.style.height = `${cachedHeight}px`;

                // === Height Management ===
                const updateCachedHeight = () => {
                    if (isUpdatingHeight) return;
                    isUpdatingHeight = true;

                    // Safety timeout to prevent stuck flag
                    const safetyTimeout = setTimeout(() => {
                        isUpdatingHeight = false;
                    }, 500);

                    container.style.overflow = "visible";
                    container.style.height = "auto";

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            clearTimeout(safetyTimeout);

                            // Use scrollHeight as it measures full content even during transitions
                            const newHeight = Math.max(container.offsetHeight, container.scrollHeight);

                            if (newHeight > 0 && Math.abs(newHeight - cachedHeight) > 2) {
                                cachedHeight = newHeight;
                                container.style.height = `${newHeight}px`;
                                const sz = node.computeSize();
                                node.size[1] = sz[1];
                                node.onResize?.(sz);
                                app.graph.setDirtyCanvas(true, false);
                            } else {
                                container.style.height = `${cachedHeight}px`;
                            }
                            container.style.overflow = "hidden";
                            isUpdatingHeight = false;
                        });
                    });
                };

                node._updateCachedHeight = updateCachedHeight;

                // Helper to attach onload/onerror handlers to all images in container
                const attachImageOnloadHandlers = () => {
                    let hasUnloadedImages = false;
                    const fallbackSvg = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';
                    const maxRetries = 3;

                    container.querySelectorAll('img').forEach(img => {
                        if (!img._hasOnloadHandler) {
                            img._hasOnloadHandler = true;
                            img._retryCount = 0;

                            img.addEventListener('load', () => updateCachedHeight());

                            // Handle broken images with simple retry
                            img.addEventListener('error', () => {
                                const jobId = img.dataset.jobId;

                                if (img._retryCount < maxRetries) {
                                    img._retryCount++;
                                    console.log(`[BIG] Image load failed for job ${jobId}, retry ${img._retryCount}/${maxRetries}`);
                                    setTimeout(() => {
                                        // Retry with cache-busting parameter
                                        const baseUrl = img.src.split('&_retry=')[0].split('&_t=')[0];
                                        img.src = `${baseUrl}&_retry=${img._retryCount}&_t=${Date.now()}`;
                                    }, 200 * img._retryCount);
                                } else {
                                    console.error(`[BIG] Image load failed after ${maxRetries} retries for job ${jobId}`);
                                    img.style.opacity = '0.3';
                                    img.src = fallbackSvg;
                                    updateCachedHeight();
                                }
                            });

                            // Check if image is not yet loaded
                            if (!img.complete) {
                                hasUnloadedImages = true;
                            } else if (img.naturalWidth === 0) {
                                // Image already failed to load - trigger error handler
                                img.dispatchEvent(new Event('error'));
                            }
                        }
                    });
                    // If there are images that haven't loaded yet, schedule extra height updates
                    if (hasUnloadedImages) {
                        [200, 500, 1000, 2000].forEach(delay => {
                            setTimeout(() => updateCachedHeight(), delay);
                        });
                    }
                };

                // Periodic height sync - keep running, only clear when node is removed
                const heightSyncInterval = setInterval(() => {
                    if (!node || !container) {
                        clearInterval(heightSyncInterval);
                        return;
                    }
                    // Always try to sync, even if offsetHeight is 0 (container might just need reflow)
                    updateCachedHeight();
                }, 2000);

                // Store interval for cleanup
                node._heightSyncInterval = heightSyncInterval;

                // Fast initial syncs for page load
                [100, 300, 500, 1000, 1500, 2000].forEach(delay => {
                    setTimeout(() => {
                        if (container) {
                            updateCachedHeight();
                        }
                    }, delay);
                });

                // Poll for progress updates using fetch (works during execution!)
                let pollInterval = null;
                let lastPollTime = 0;

                const startPolling = () => {
                    if (pollInterval) return;
                    console.log("[BIG] Starting progress polling...");

                    // Use a more aggressive polling approach that works during execution
                    const poll = async () => {
                        if (!pollInterval) return;

                        try {
                            const nodeId = node._ni_widget?.value || String(node.id);
                            if (nodeId) {
                                // Use raw fetch to bypass any ComfyUI blocking
                                const response = await fetch(`/instaraw/batch_gen_progress/${nodeId}`, {
                                    method: 'GET',
                                    headers: { 'Accept': 'application/json' },
                                });

                                if (response.ok) {
                                    const data = await response.json();
                                    if (data.jobs && data.jobs.length > 0) {
                                        const wasGenerating = node._bigIsGenerating;
                                        const hadJobs = node._bigJobs.length > 0;

                                        node._bigJobs = data.jobs;
                                        node._bigStats = data.stats || node._bigStats;
                                        node._bigIsGenerating = data.is_generating;
                                        updateGeneratedBatchData();

                                        // First time seeing jobs - do full render
                                        if (!hadJobs && data.jobs.length > 0) {
                                            node._bigStartTime = Date.now();
                                            renderUI();
                                        } else {
                                            // Update existing items
                                            updateProgressItems();
                                            updateProgressHeader();
                                        }

                                        // Generation finished
                                        if (wasGenerating && !data.is_generating) {
                                            console.log("[BIG] Generation complete detected via polling");
                                            renderUI(); // Re-render to show action buttons
                                            stopPolling();
                                            return;
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // Silently ignore poll errors during execution
                        }

                        // Schedule next poll
                        if (pollInterval) {
                            pollInterval = setTimeout(poll, 400);
                        }
                    };

                    pollInterval = setTimeout(poll, 100);
                };

                const stopPolling = () => {
                    if (pollInterval) {
                        clearTimeout(pollInterval);
                        pollInterval = null;
                        console.log("[BIG] Stopped polling");
                    }
                };

                // Store polling functions on node for use by checkBackendProgress
                node._startPolling = startPolling;
                node._stopPolling = stopPolling;

                // Listen for ComfyUI execution start - start polling immediately
                api.addEventListener("execution_start", (event) => {
                    console.log("[BIG] Execution started, beginning to poll for progress...");
                    node._bigStartTime = Date.now();
                    startPolling();
                });

                // Listen for ComfyUI execution complete/error - ensure we stop polling
                api.addEventListener("execution_complete", () => {
                    // Give a moment for final updates then stop
                    setTimeout(() => {
                        if (!node._bigIsGenerating) {
                            stopPolling();
                        }
                    }, 1000);
                });

                api.addEventListener("execution_error", () => {
                    stopPolling();
                });

                // Also listen for our custom events (they work after execution)
                api.addEventListener("instaraw-batch-gen-start", (event) => {
                    const data = event.detail;
                    if (data.node_id === node._ni_widget?.value) {
                        console.log("[BIG] Generation started event received:", data);
                        node._bigJobs = data.jobs || [];
                        node._bigStats = {
                            total: node._bigJobs.length,
                            completed: 0,
                            success: 0,
                            failed: 0,
                            cached: 0,
                        };
                        node._bigIsGenerating = true;
                        if (!node._bigStartTime) node._bigStartTime = Date.now();
                        updateGeneratedBatchData();
                        renderUI();
                    }
                });

                // Listen for job updates (works after execution finishes)
                api.addEventListener("instaraw-batch-gen-update", (event) => {
                    const data = event.detail;
                    if (data.node_id === node._ni_widget?.value) {
                        const job = node._bigJobs.find(j => j.id === data.job_id);
                        if (job) {
                            job.state = data.state;
                            job.attempts = data.attempts;
                            job.error = data.error;
                            job.generation_time = data.generation_time;
                            // Also update image data for display
                            if (data.image_url) {
                                job.image_url = data.image_url;
                            }
                            if (data.image_width) {
                                job.image_width = data.image_width;
                            }
                            if (data.image_height) {
                                job.image_height = data.image_height;
                            }
                            updateProgressItem(job);
                            updateStats();
                        }
                    }
                });

                // Listen for generation complete
                api.addEventListener("instaraw-batch-gen-complete", (event) => {
                    const data = event.detail;
                    if (data.node_id === node._ni_widget?.value) {
                        console.log("[BIG] Generation complete event:", data);
                        node._bigIsGenerating = false;
                        node._bigStats = data.stats || node._bigStats;
                        updateGeneratedBatchData();
                        stopPolling();
                        renderUI();
                    }
                });

                // Listen for save event from legacy Python path
                api.addEventListener("instaraw-batch-gen-save", (event) => {
                    const data = event.detail;
                    if (data.node_id === node._ni_widget?.value) {
                        console.log("[BIG] Received generated_batch_data from Python:", data);
                        // Update the widget with the generated batch data
                        const widget = node.widgets?.find(w => w.name === "generated_batch_data");
                        if (widget) {
                            widget.value = data.generated_batch_data;
                            console.log("[BIG] Updated generated_batch_data widget");
                        }
                        // Also update our internal jobs from the data
                        try {
                            const batchData = JSON.parse(data.generated_batch_data);
                            node._bigJobs = batchData.map(job => ({
                                id: job.id,
                                state: job.state,
                                prompt_positive: job.prompt_positive,
                                image_url: job.image_url,
                                image_width: job.image_width,
                                image_height: job.image_height,
                                generation_time: job.generation_time,
                                filename: job.filename,
                            }));
                            updateStats();
                            renderUI();
                        } catch (e) {
                            console.error("[BIG] Failed to parse generated_batch_data:", e);
                        }
                    }
                });

                // Listen for RPG prompt changes (repeat counts, etc.) to update sync badge
                window.addEventListener("INSTARAW_RPG_PROMPTS_CHANGED", (event) => {
                    // Check if this RPG is connected to us
                    const promptInput = node.inputs?.find(i => i.name === "prompt_list_positive");
                    if (!promptInput?.link) return;
                    const link = app.graph.links[promptInput.link];
                    if (!link || link.origin_id !== event.detail.nodeId) return;

                    // RPG we're connected to changed - re-render to update sync badge
                    console.log(`[BIG] RPG prompts changed, totalGenerations=${event.detail.totalGenerations}`);
                    renderUI();
                });

                // Listen for AIL updates to refresh image preview
                window.addEventListener("INSTARAW_AIL_UPDATED", (event) => {
                    // Check if this AIL is connected to us
                    const imagesInput = node.inputs?.find(i => i.name === "images");
                    if (!imagesInput?.link) return;

                    // Re-render to update sync badge and image preview
                    renderUI();
                });

                const updateStats = () => {
                    const jobs = node._bigJobs;
                    node._bigStats.completed = jobs.filter(j =>
                        [JobState.SUCCESS, JobState.FAILED, JobState.CACHED, JobState.CANCELLED].includes(j.state)
                    ).length;
                    node._bigStats.success = jobs.filter(j => j.state === JobState.SUCCESS).length;
                    node._bigStats.failed = jobs.filter(j => j.state === JobState.FAILED).length;
                    node._bigStats.cached = jobs.filter(j => j.state === JobState.CACHED).length;
                    updateProgressHeader();
                };

                const escapeHtml = (text) => {
                    if (!text) return "";
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                // Format image count as "3×10" when multiple sources with equal counts, or show total
                const formatImageCount = () => {
                    const counts = node._bigImageCounts || [];
                    const total = node._bigImageCount || 0;

                    if (counts.length <= 1) {
                        return `${total} ref image${total !== 1 ? 's' : ''}`;
                    }

                    // Check if all counts are equal
                    const allEqual = counts.every(c => c === counts[0]);
                    if (allEqual) {
                        return `${counts.length}×${counts[0]} ref images`;
                    }

                    // Different counts - show as sum
                    return `${counts.join('+')} ref images`;
                };

                const formatTime = (ms) => {
                    const seconds = Math.floor(ms / 1000);
                    if (seconds < 60) return `${seconds}s`;
                    const minutes = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${minutes}m ${secs}s`;
                };

                // Timer interval for updating elapsed time display
                let timerInterval = null;

                const startTimer = () => {
                    if (timerInterval) return;
                    timerInterval = setInterval(() => {
                        if (node._bigIsGenerating && node._bigStartTime) {
                            const header = container.querySelector(".instaraw-big-progress-header h4");
                            if (header) {
                                const elapsed = formatTime(Date.now() - node._bigStartTime);
                                header.textContent = `Generating... (${elapsed})`;
                            }
                        }
                    }, 1000);
                };

                const stopTimer = () => {
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                };

                const updateProgressHeader = () => {
                    const header = container.querySelector(".instaraw-big-progress-header h4");
                    const kpiRow = container.querySelector(".instaraw-big-kpi-row");

                    if (header) {
                        const elapsed = node._bigStartTime ? formatTime(Date.now() - node._bigStartTime) : "0s";
                        if (node._bigIsGenerating) {
                            header.textContent = `🔄 Generating Images... (${elapsed})`;
                            startTimer();
                        } else {
                            header.textContent = `✅ Generation Complete (${elapsed})`;
                            stopTimer();
                        }
                    }

                    // Update KPI values (jobs completed, success, cached, failed)
                    if (kpiRow) {
                        const s = node._bigStats;
                        const kpis = kpiRow.querySelectorAll(".instaraw-big-kpi");
                        kpis.forEach(kpi => {
                            const strong = kpi.querySelector("strong");
                            const label = kpi.querySelector("span")?.textContent?.trim();
                            if (strong && label) {
                                if (label === "JOBS") {
                                    strong.textContent = `${s.completed}/${s.total}`;
                                } else if (label === "SUCCESS") {
                                    strong.textContent = s.success;
                                } else if (label === "CACHED") {
                                    strong.textContent = s.cached;
                                } else if (label === "FAILED") {
                                    strong.textContent = s.failed;
                                }
                            }
                        });
                    }
                };

                const updateProgressItems = () => {
                    node._bigJobs.forEach(job => updateProgressItem(job));
                };

                const updateProgressItem = (job) => {
                    const itemEl = container.querySelector(`.instaraw-big-progress-item[data-job-id="${job.id}"]`);
                    if (!itemEl) return;

                    // Debug: Log if job has image URL
                    if (job.image_url && job.state === JobState.SUCCESS) {
                        console.log(`[BIG] Job #${job.id} has image:`, job.image_url, `(${job.image_width}x${job.image_height})`);
                    }

                    const stateInfo = STATE_CONFIG[job.state] || STATE_CONFIG[JobState.PENDING];

                    // Update class for border/background color
                    itemEl.className = `instaraw-big-progress-item ${stateInfo.class}`;

                    // Update status badge
                    const statusBadge = itemEl.querySelector(".instaraw-big-progress-item-status");
                    if (statusBadge) {
                        statusBadge.className = `instaraw-big-progress-item-status ${stateInfo.class}`;
                        let statusText = `${stateInfo.icon} ${stateInfo.text}`;

                        if (job.state === JobState.RETRYING && job.attempts > 1) {
                            statusText = `🔁 Retry #${job.attempts}`;
                        } else if (job.state === JobState.SUCCESS && job.generation_time) {
                            // Show retry count if there were retries
                            if (job.attempts > 1) {
                                statusText = `✓ ${job.generation_time.toFixed(1)}s (${job.attempts} tries)`;
                            } else {
                                statusText = `✓ ${job.generation_time.toFixed(1)}s`;
                            }
                        } else if (job.state === JobState.FAILED && job.attempts > 1) {
                            statusText = `✖ Failed (${job.attempts} tries)`;
                        }

                        statusBadge.textContent = statusText;
                    }

                    // Update progress bar
                    const progressFill = itemEl.querySelector(".instaraw-big-progress-item-fill");
                    if (progressFill) {
                        // Remove all classes first
                        progressFill.className = "instaraw-big-progress-item-fill";
                        progressFill.style.background = "";

                        if (job.state === JobState.SUCCESS || job.state === JobState.CACHED) {
                            progressFill.style.width = "100%";
                        } else if (job.state === JobState.GENERATING || job.state === JobState.RETRYING) {
                            progressFill.style.width = "100%";
                            progressFill.classList.add("animating");
                        } else if (job.state === JobState.FAILED) {
                            progressFill.style.width = "100%";
                            progressFill.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                        } else {
                            progressFill.style.width = "0%";
                        }
                    }

                    // Update message
                    const messageDiv = itemEl.querySelector(".instaraw-big-progress-item-message");
                    if (messageDiv) {
                        if (job.state === JobState.FAILED && job.error) {
                            messageDiv.textContent = job.error.slice(0, 100);
                            messageDiv.style.display = "block";
                            messageDiv.classList.remove("retry-message");
                            messageDiv.classList.add("error-message");
                        } else if (job.state === JobState.RETRYING && job.error) {
                            messageDiv.textContent = `⚠️ ${job.error.slice(0, 80)}`;
                            messageDiv.style.display = "block";
                            messageDiv.classList.remove("error-message");
                            messageDiv.classList.add("retry-message");
                        } else {
                            messageDiv.style.display = "none";
                            messageDiv.classList.remove("error-message", "retry-message");
                        }
                    }

                    // Show/hide retry button
                    const retryBtn = itemEl.querySelector(".instaraw-big-job-retry-btn");
                    if (retryBtn) {
                        retryBtn.style.display = job.state === JobState.FAILED ? "inline-block" : "none";
                    }

                    // Update or create thumbnail (always present now)
                    const hasImage = job.image_url && (job.state === JobState.SUCCESS || job.state === JobState.CACHED);
                    const isGenerating = job.state === JobState.GENERATING || job.state === JobState.RETRYING;
                    let thumbnailContainer = itemEl.querySelector(".instaraw-big-progress-item-thumbnail");

                    if (!thumbnailContainer) {
                        // Create thumbnail container - always present
                        const thumbDiv = document.createElement("div");
                        thumbDiv.className = "instaraw-big-progress-item-thumbnail" + (hasImage ? "" : " placeholder");

                        if (hasImage) {
                            thumbDiv.innerHTML = `<img src="${job.image_url}" alt="Generated image" class="instaraw-big-thumbnail-img" data-job-id="${job.id}" loading="lazy" style="background: rgba(0,0,0,0.3);" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';" />`;
                        } else if (isGenerating) {
                            console.log("[BIG] Creating video element for job", job.id);
                            const video = document.createElement("video");
                            video.className = "instaraw-big-thumbnail-video";
                            video.autoplay = true;
                            video.loop = true;
                            video.muted = true;
                            video.playsInline = true;
                            video.src = "extensions/ComfyUI_INSTARAW/Instara_loader.mp4";

                            // Debug events
                            video.addEventListener('loadeddata', () => console.log("[BIG] Video loaded:", video.src));
                            video.addEventListener('error', (e) => console.error("[BIG] Video error:", e, video.error));

                            thumbDiv.appendChild(video);
                            console.log("[BIG] Video element appended, src:", video.src);

                            // Ensure video plays
                            video.play().then(() => {
                                console.log("[BIG] Video playing successfully");
                            }).catch(e => {
                                console.error("[BIG] Video autoplay failed:", e);
                            });
                        } else {
                            thumbDiv.innerHTML = `<div class="instaraw-big-thumbnail-empty"></div>`;
                        }

                        // Append to the main item container
                        itemEl.appendChild(thumbDiv);

                        // Add click handler and onload for height update if image is available
                        if (hasImage) {
                            const img = thumbDiv.querySelector(".instaraw-big-thumbnail-img");
                            if (img) {
                                img.onclick = (e) => {
                                    e.stopPropagation();
                                    openPhotoSwipe(job.id);
                                };
                                img.onload = () => updateCachedHeight();
                            }
                        }

                        updateCachedHeight();
                    } else {
                        // Update existing thumbnail based on state
                        if (hasImage) {
                            // Replace with actual image
                            // console.log("[BIG] Updating thumbnail to show image for job", job.id, job.image_url);
                            const existingImg = thumbnailContainer.querySelector(".instaraw-big-thumbnail-img");

                            // Helper to add retry-on-error to img element
                            const setupImgRetry = (img) => {
                                let retryCount = 0;
                                const maxRetries = 3;
                                img.style.background = 'rgba(0,0,0,0.3)';

                                img.onerror = () => {
                                    if (retryCount < maxRetries) {
                                        retryCount++;
                                        console.log(`[BIG] Image load failed for job ${job.id}, retry ${retryCount}/${maxRetries}`);
                                        setTimeout(() => {
                                            // Retry with cache-busting parameter
                                            const baseUrl = job.image_url.split('&_retry=')[0].split('&_t=')[0];
                                            img.src = `${baseUrl}&_retry=${retryCount}&_t=${Date.now()}`;
                                        }, 200 * retryCount);
                                    } else {
                                        console.error(`[BIG] Image load failed after ${maxRetries} retries for job ${job.id}`);
                                        img.style.opacity = '0.3';
                                        img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%239ca3af%22 d=%22M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z%22/%3E%3C/svg%3E';
                                    }
                                };
                                img.onload = () => updateCachedHeight();
                                img.onclick = (e) => {
                                    e.stopPropagation();
                                    openPhotoSwipe(job.id);
                                };
                            };

                            if (!existingImg) {
                                // No image yet, replace entire content
                                // console.log("[BIG] No existing img, replacing content");
                                thumbnailContainer.className = "instaraw-big-progress-item-thumbnail";
                                thumbnailContainer.innerHTML = `<img src="${job.image_url}" alt="Generated image" class="instaraw-big-thumbnail-img" data-job-id="${job.id}" loading="lazy" />`;

                                const img = thumbnailContainer.querySelector(".instaraw-big-thumbnail-img");
                                if (img) {
                                    setupImgRetry(img);
                                }
                                updateCachedHeight();
                            } else if (existingImg.src !== job.image_url) {
                                // Image exists but URL changed
                                // console.log("[BIG] Updating existing img src");
                                existingImg.src = job.image_url;
                                thumbnailContainer.className = "instaraw-big-progress-item-thumbnail";
                                setupImgRetry(existingImg);
                            }
                        } else if (isGenerating) {
                            // Show video if not already showing
                            if (!thumbnailContainer.querySelector(".instaraw-big-thumbnail-video")) {
                                console.log("[BIG] Updating to show video for job", job.id);
                                thumbnailContainer.className = "instaraw-big-progress-item-thumbnail placeholder";
                                thumbnailContainer.innerHTML = ''; // Clear existing content
                                const video = document.createElement("video");
                                video.className = "instaraw-big-thumbnail-video";
                                video.autoplay = true;
                                video.loop = true;
                                video.muted = true;
                                video.playsInline = true;
                                video.src = "extensions/ComfyUI_INSTARAW/Instara_loader.mp4";

                                // Debug events
                                video.addEventListener('loadeddata', () => console.log("[BIG] Video loaded (update):", video.src));
                                video.addEventListener('error', (e) => console.error("[BIG] Video error (update):", e, video.error));

                                thumbnailContainer.appendChild(video);
                                console.log("[BIG] Video element appended (update), src:", video.src);

                                // Ensure video plays
                                video.play().then(() => {
                                    console.log("[BIG] Video playing successfully (update)");
                                }).catch(e => {
                                    console.error("[BIG] Video autoplay failed (update):", e);
                                });
                            }
                        } else {
                            // Show empty placeholder (no icon)
                            if (!thumbnailContainer.querySelector(".instaraw-big-thumbnail-empty")) {
                                thumbnailContainer.className = "instaraw-big-progress-item-thumbnail placeholder";
                                thumbnailContainer.innerHTML = `<div class="instaraw-big-thumbnail-empty"></div>`;
                            }
                        }
                    }

                    // Add or update view button
                    const headerEl = itemEl.querySelector(".instaraw-big-progress-item-header");
                    let viewBtn = headerEl?.querySelector(".instaraw-big-view-image-btn");

                    if (hasImage && !viewBtn && headerEl) {
                        const statusBadge = headerEl.querySelector(".instaraw-big-progress-item-status");
                        const newBtn = document.createElement("button");
                        newBtn.className = "instaraw-big-view-image-btn";
                        newBtn.dataset.jobId = job.id;
                        newBtn.title = "View image";
                        newBtn.textContent = "👁️";
                        newBtn.onclick = (e) => {
                            e.stopPropagation();
                            openPhotoSwipe(job.id);
                        };

                        if (statusBadge && statusBadge.nextSibling) {
                            headerEl.insertBefore(newBtn, statusBadge.nextSibling);
                        } else {
                            headerEl.appendChild(newBtn);
                        }
                    } else if (!hasImage && viewBtn) {
                        viewBtn.remove();
                    }
                };

                // ═══════════════════════════════════════════════════════════════════
                // HELPER FUNCTIONS FOR RPG-STYLE GENERATION
                // ═══════════════════════════════════════════════════════════════════

                // Check if RPG is connected (regardless of prompts)
                const isRPGConnected = () => {
                    try {
                        const promptSlot = node.inputs?.findIndex(i => i.name === "prompt_list_positive");
                        if (promptSlot === -1 || !node.inputs[promptSlot].link) {
                            return false;
                        }
                        const link = app.graph.links[node.inputs[promptSlot].link];
                        if (!link) return false;
                        const rpgNode = app.graph.getNodeById(link.origin_id);
                        return rpgNode && rpgNode.type === "INSTARAW_RealityPromptGenerator";
                    } catch (e) {
                        return false;
                    }
                };

                // NEW: Detect prompts from connected RPG in real-time (RPG pattern)
                const getConnectedRPGData = () => {
                    /**
                     * Find connected RPG node and read its prompt batch data.
                     * Returns array of {positive, negative, seed} objects or null.
                     * This is used for the preview state to show detected prompts.
                     */
                    try {
                        // Find prompt_list_positive input slot
                        const promptSlot = node.inputs?.findIndex(i => i.name === "prompt_list_positive");
                        if (promptSlot === -1 || !node.inputs[promptSlot].link) {
                            return null;
                        }

                        // Get linked RPG node
                        const link = app.graph.links[node.inputs[promptSlot].link];
                        if (!link) return null;

                        const rpgNode = app.graph.getNodeById(link.origin_id);
                        if (!rpgNode || rpgNode.type !== "INSTARAW_RealityPromptGenerator") {
                            return null;
                        }

                        // Read prompt_batch_data widget
                        const batchWidget = rpgNode.widgets?.find(w => w.name === "prompt_batch_data");
                        if (!batchWidget) return null;

                        const batchData = JSON.parse(batchWidget.value || "[]");
                        if (batchData.length === 0) return null;

                        // Expand by repeat_count (like RPG's execute does)
                        const expandedPrompts = [];
                        batchData.forEach(entry => {
                            const repeat = Math.max(1, entry.repeat_count || 1);
                            for (let i = 0; i < repeat; i++) {
                                expandedPrompts.push({
                                    positive: entry.positive_prompt || "",
                                    negative: entry.negative_prompt || "",
                                    seed: (entry.seed || -1) + i,
                                });
                            }
                        });

                        return expandedPrompts.length > 0 ? expandedPrompts : null;
                    } catch (e) {
                        console.error("[BIG] Error in getConnectedRPGData:", e);
                        return null;
                    }
                };

                // Real-time RPG detection (polls every 500ms)
                node._detectedPromptCount = 0;
                const rpgDetectionInterval = setInterval(() => {
                    if (!node._bigIsGenerating) {
                        const newPrompts = getConnectedRPGData();
                        const currentCount = node._detectedPromptCount || 0;
                        const newCount = newPrompts?.length || 0;

                        if (newCount !== currentCount) {
                            node._detectedPromptCount = newCount;
                            console.log(`[BIG] Detected prompt count changed: ${currentCount} → ${newCount}`);
                            renderUI(); // Re-render to show updated state
                        }
                    }
                }, 500);

                // OLD: Keep existing function for backward compatibility with Generate All
                const getConnectedPromptData = () => {
                    /**
                     * Find connected RPG node and read its prompt batch data.
                     * Returns: { prompts_positive, prompts_negative, seeds } or null
                     */
                    try {
                        // Find the input slot for prompt_list_positive
                        const promptSlot = node.inputs?.findIndex(input => input.name === "prompt_list_positive");
                        if (promptSlot === -1 || !node.inputs[promptSlot].link) {
                            console.log("[BIG] No RPG connected to prompt_list_positive");
                            return null;
                        }

                        // Get the link and source node
                        const link = app.graph.links[node.inputs[promptSlot].link];
                        if (!link) {
                            console.log("[BIG] Link not found");
                            return null;
                        }

                        const rpgNode = app.graph.getNodeById(link.origin_id);
                        if (!rpgNode || rpgNode.type !== "INSTARAW_RealityPromptGenerator") {
                            console.log("[BIG] Connected node is not RPG:", rpgNode?.type);
                            return null;
                        }

                        // Read prompt batch data from RPG
                        const batchDataWidget = rpgNode.widgets?.find(w => w.name === "prompt_batch_data");
                        if (!batchDataWidget) {
                            console.log("[BIG] RPG has no prompt_batch_data widget");
                            return null;
                        }

                        const batchData = JSON.parse(batchDataWidget.value || "[]");
                        if (batchData.length === 0) {
                            console.log("[BIG] RPG batch data is empty");
                            return null;
                        }

                        // Extract prompts with repeat counts
                        const prompts_positive = [];
                        const prompts_negative = [];
                        const seeds = [];

                        batchData.forEach(entry => {
                            const pos = entry.positive_prompt || "";
                            const neg = entry.negative_prompt || "";
                            const seed = entry.seed || -1;
                            const repeat = Math.max(1, entry.repeat_count || 1);

                            // Expand by repeat_count
                            for (let i = 0; i < repeat; i++) {
                                prompts_positive.push(pos);
                                prompts_negative.push(neg);
                                seeds.push(seed + i);  // Increment seed for each repeat
                            }
                        });

                        console.log(`[BIG] Read ${prompts_positive.length} prompts from RPG`);
                        return { prompts_positive, prompts_negative, seeds };
                    } catch (e) {
                        console.error("[BIG] Error reading RPG data:", e);
                        return null;
                    }
                };

                const getGenerationParameters = () => {
                    /**
                     * Get generation parameters from connected nodes/widgets.
                     * Returns object with api_key, provider, model, etc. or null
                     */
                    try {
                        // Helper to recursively get value from a node's input
                        const getNodeInputValue = (targetNode, targetInputName, defaultVal = null) => {
                            if (!targetNode) return defaultVal;

                            // PRIORITY 1: Check if there's a connected input (connections override widgets)
                            const input = targetNode.inputs?.find(i => i.name === targetInputName);
                            if (input && input.link != null) {
                                const link = app.graph.links[input.link];
                                if (link) {
                                    const originNode = app.graph.getNodeById(link.origin_id);
                                    if (originNode) {
                                        // For nodes that just output a value directly (like PrimitiveString)
                                        if (originNode.widgets && originNode.widgets.length > 0) {
                                            const value = originNode.widgets[0].value;
                                            console.log(`[BIG] Got '${targetInputName}' from connected node ${originNode.id} widget:`, value?.slice?.(0, 20) || value);
                                            return value;
                                        }

                                        if (originNode.properties && originNode.properties.value !== undefined) {
                                            console.log(`[BIG] Got '${targetInputName}' from connected node ${originNode.id} properties:`, originNode.properties.value?.slice?.(0, 20) || originNode.properties.value);
                                            return originNode.properties.value;
                                        }
                                    }
                                }
                            }

                            // PRIORITY 2: Fall back to widget value if no connection
                            if (targetNode.widgets) {
                                const widget = targetNode.widgets.find(w => w.name === targetInputName);
                                if (widget !== undefined && widget.value !== undefined) {
                                    console.log(`[BIG] Got '${targetInputName}' from node ${targetNode.id} widget (no connection):`, widget.value?.slice?.(0, 20) || widget.value);
                                    return widget.value;
                                }
                            }

                            return defaultVal;
                        };

                        // Helper to get value from connected input or widget (RPG pattern)
                        const getInputValue = (inputName, defaultVal = null) => {
                            try {
                                // Try to get from connected link first (connections take priority over widgets)
                                const input = node.inputs?.find(i => i.name === inputName);
                                if (!input || input.link == null) {
                                    // No connection, try own widget
                                    if (node.widgets) {
                                        const widget = node.widgets.find(w => w.name === inputName);
                                        if (widget) {
                                            console.log(`[BIG] Got ${inputName} from own widget:`, widget.value?.slice?.(0, 20) || widget.value);
                                            return widget.value;
                                        }
                                    }
                                    console.log(`[BIG] No connection for ${inputName}, using default:`, defaultVal);
                                    return defaultVal;
                                }

                                const link = app.graph.links[input.link];
                                if (!link) {
                                    console.log(`[BIG] Invalid link for ${inputName}`);
                                    return defaultVal;
                                }

                                const originNode = app.graph.getNodeById(link.origin_id);
                                if (!originNode) {
                                    console.log(`[BIG] Origin node not found for ${inputName}`);
                                    return defaultVal;
                                }

                                console.log(`[BIG] Tracing ${inputName} from origin node ${originNode.id} (${originNode.type}), output slot ${link.origin_slot}`);

                                // Special handling for Provider Selector nodes - they compute outputs based on inputs
                                if (originNode.type === "INSTARAW_API_ProviderSelector" || originNode.type === "INSTARAW_IdeogramProviderSelector") {
                                    // origin_slot tells us which output: 0=provider, 1=api_key
                                    if (link.origin_slot === 0) {
                                        // Getting 'provider' output - read from provider widget
                                        const value = getNodeInputValue(originNode, "provider", defaultVal);
                                        console.log(`[BIG] Provider selector output[0] (provider):`, value);
                                        return value;
                                    } else if (link.origin_slot === 1) {
                                        // Getting 'api_key' output - need to check which provider is selected
                                        const selectedProvider = getNodeInputValue(originNode, "provider", "");
                                        console.log(`[BIG] Provider selector selected provider:`, selectedProvider);

                                        // Read the appropriate API key based on selected provider
                                        let keyInputName;
                                        if (originNode.type === "INSTARAW_IdeogramProviderSelector") {
                                            keyInputName = selectedProvider === "Official Ideogram" ? "official_ideogram_api_key" : "fal_api_key";
                                        } else {
                                            keyInputName = selectedProvider === "wavespeed.ai" ? "wavespeed_api_key" : "fal_api_key";
                                        }

                                        const apiKey = getNodeInputValue(originNode, keyInputName, "");
                                        console.log(`[BIG] Provider selector output[1] (api_key from ${keyInputName}):`, apiKey?.slice?.(0, 20) || apiKey);
                                        return apiKey;
                                    }
                                }

                                // For other nodes, read from widgets
                                if (originNode.widgets && originNode.widgets.length > 0) {
                                    const widgetIndex = link.origin_slot || 0;
                                    if (widgetIndex < originNode.widgets.length) {
                                        const widget = originNode.widgets[widgetIndex];
                                        const value = widget.value;
                                        console.log(`[BIG] Got ${inputName} from connected node widget[${widgetIndex}] '${widget.name}':`, value?.slice?.(0, 20) || value);
                                        return value;
                                    } else {
                                        // Fallback to first widget if origin_slot is out of bounds
                                        const value = originNode.widgets[0].value;
                                        console.log(`[BIG] Got ${inputName} from connected node (first widget, slot ${widgetIndex} out of bounds):`, value?.slice?.(0, 20) || value);
                                        return value;
                                    }
                                }

                                // Fallback: try properties.value
                                if (originNode.properties && originNode.properties.value !== undefined) {
                                    console.log(`[BIG] Got ${inputName} from properties.value:`, originNode.properties.value);
                                    return originNode.properties.value;
                                }

                                console.warn(`[BIG] No value found for ${inputName} on connected node. Node type: ${originNode.type}`);
                                return defaultVal;
                            } catch (error) {
                                console.error(`[BIG] Error getting ${inputName}:`, error);
                                return defaultVal;
                            }
                        };

                        // Get raw aspect_ratio value and parse it
                        let aspectRatioRaw = String(getInputValue("aspect_ratio", "1:1") || "1:1");
                        let aspectRatio = "1:1";

                        // Extract ratio from labels like "3:4 (Portrait)" -> "3:4"
                        if (aspectRatioRaw) {
                            const match = aspectRatioRaw.match(/(\d+:\d+)/);
                            if (match) {
                                aspectRatio = match[1];
                                console.log(`[BIG] Parsed aspect_ratio "${aspectRatioRaw}" -> "${aspectRatio}"`);
                            } else {
                                aspectRatio = aspectRatioRaw;
                            }
                        }

                        const params = {
                            api_key: getInputValue("api_key"),
                            provider: getInputValue("provider"),
                            model: getInputValue("model"),
                            aspect_ratio: aspectRatio,
                            width: getInputValue("width", 1024),
                            height: getInputValue("height", 1024),
                            resolution: getInputValue("resolution", "1K"),
                            enable_safety_checker: getInputValue("enable_safety_checker", true),
                            use_negative_prompt: getInputValue("use_negative_prompt", true),
                            max_retries: getInputValue("max_retries", 3),
                            max_parallel: getInputValue("max_parallel", 5),
                            timeout: getInputValue("timeout", 600),
                            use_cache: getInputValue("use_cache", true),
                            filename_prefix: getInputValue("filename_prefix", "INSTARAW"),
                            multi_image: getInputValue("multi_image", false),
                        };

                        console.log("[BIG] Generation parameters:", {
                            ...params,
                            api_key: params.api_key ? `${params.api_key.slice(0, 10)}...` : "MISSING",
                        });

                        // Validate required parameters
                        const missing = [];
                        if (!params.api_key) missing.push("API Key");
                        if (!params.provider) missing.push("Provider");
                        if (!params.model) missing.push("Model");

                        if (missing.length > 0) {
                            const msg = `❌ Missing required parameters: ${missing.join(", ")}\n\n` +
                                       `Make sure these are connected to the BIG node:\n` +
                                       `- API Key Loader → api_key input\n` +
                                       `- Provider → provider input\n` +
                                       `- Model → model input\n\n` +
                                       `Check browser console for details.`;
                            console.error("[BIG]", msg);
                            alert(msg);
                            return null;
                        }

                        return params;
                    } catch (e) {
                        console.error("[BIG] Error getting generation parameters:", e);
                        return null;
                    }
                };

                const generateSingleJob = async (jobIndex, genParams, signal = null) => {
                    /**
                     * Generate a single image via API endpoint.
                     * Updates node._bigJobs and node._bigStats.
                     * @param {AbortSignal} signal - Optional abort signal for cancellation
                     */
                    const job = node._bigJobs[jobIndex];
                    const nodeId = node._ni_widget?.value || String(node.id);

                    // Check if already aborted before starting
                    if (signal?.aborted) {
                        console.log(`[BIG] Job ${jobIndex} skipped (cancelled)`);
                        job.state = "cancelled";
                        job.error = "Cancelled by user";
                        node._bigStats.completed++;
                        updateProgressItem(job);
                        updateProgressHeader();
                        return;
                    }

                    console.log(`[BIG] Generating job ${jobIndex}:`, job.prompt_positive.slice(0, 50));

                    // Mark as generating - use updateProgressItem instead of renderUI
                    // to avoid replacing all images (which interrupts loading)
                    job.state = "generating";
                    updateGeneratedBatchData(); // Save state immediately so tab switch preserves it
                    updateProgressItem(job);
                    updateProgressHeader();

                    const startTime = Date.now();

                    try {
                        console.log(`[BIG] Sending request for job ${jobIndex}:`, {
                            node_id: nodeId,
                            job_id: job.id,
                            provider: genParams.provider,
                            model: genParams.model,
                            api_key: genParams.api_key ? "present" : "MISSING",
                            prompt: job.prompt_positive.slice(0, 50),
                        });

                        // Build request body
                        const requestBody = {
                            node_id: nodeId,
                            job_id: job.id,
                            ...genParams,
                            prompt_positive: job.prompt_positive,
                            prompt_negative: job.prompt_negative,
                            seed: job.seed,
                        };

                        // Add input images for I2I mode (if job has them)
                        if (job.input_image_b64) {
                            requestBody.input_image = job.input_image_b64;
                            console.log(`[BIG] Job ${jobIndex} image_1 (base64 length: ${job.input_image_b64.length})`);
                        }
                        if (job.input_image2_b64) {
                            requestBody.input_image2 = job.input_image2_b64;
                            console.log(`[BIG] Job ${jobIndex} image_2 (base64 length: ${job.input_image2_b64.length})`);
                        }
                        if (job.input_image3_b64) {
                            requestBody.input_image3 = job.input_image3_b64;
                            console.log(`[BIG] Job ${jobIndex} image_3 (base64 length: ${job.input_image3_b64.length})`);
                        }
                        if (job.input_image4_b64) {
                            requestBody.input_image4 = job.input_image4_b64;
                            console.log(`[BIG] Job ${jobIndex} image_4 (base64 length: ${job.input_image4_b64.length})`);
                        }
                        if (!job.input_image_b64) {
                            console.log(`[BIG] Job ${jobIndex} has no input image (T2I mode)`);
                        }

                        // Pass signal to fetch for cancellation support
                        const response = await api.fetchApi("/instaraw/batch_gen_generate_single", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestBody),
                            signal: signal,
                        });

                        const result = await response.json();
                        console.log(`[BIG] Job ${jobIndex} response:`, result);

                        if (result.status === "success") {
                            job.state = result.cache_hit ? "cached" : "success";
                            job.image_url = result.image_url;
                            job.filename = result.filename;
                            job.generation_time = result.generation_time || (Date.now() - startTime) / 1000;
                            job.image_width = result.width || 1024;
                            job.image_height = result.height || 1024;
                            console.log(`[BIG][fix1] Job ${jobIndex} completed, result.width=${result.width}, result.height=${result.height}, stored as ${job.image_width}x${job.image_height}`);
                            job.attempts = result.attempts || 1;
                            job.subfolder = result.subfolder;

                            // Log retry info if there were retries
                            if (job.attempts > 1) {
                                console.log(`[BIG] Job ${jobIndex} succeeded after ${job.attempts} attempts`);
                            }

                            // Small delay to ensure filesystem has synced before loading image
                            await new Promise(resolve => setTimeout(resolve, 100));

                            node._bigStats.success++;
                            if (result.cache_hit) node._bigStats.cached++;
                        } else {
                            job.state = "failed";
                            job.error = result.error || "Generation failed";
                            job.attempts = result.attempts || 1;
                            node._bigStats.failed++;
                            console.error(`[BIG] Job ${jobIndex} failed after ${job.attempts} attempts:`, result.error);
                        }
                    } catch (e) {
                        // Handle abort differently - mark as cancelled, not failed
                        if (e.name === 'AbortError') {
                            console.log(`[BIG] Job ${jobIndex} cancelled`);
                            job.state = "cancelled";
                            job.error = "Cancelled by user";
                            // Don't increment failed count for cancellations
                        } else {
                            console.error(`[BIG] Job ${jobIndex} error:`, e);
                            job.state = "failed";
                            job.error = e.message || "Network error";
                            node._bigStats.failed++;
                        }
                    }

                    node._bigStats.completed++;
                    updateGeneratedBatchData();
                    updateGeneratedBatchData();
                    // Use updateProgressItem instead of renderUI to avoid
                    // replacing all images (which interrupts loading for other jobs)
                    updateProgressItem(job);
                    updateProgressHeader();
                };

                const generateJobPair = async (jobIndex1, jobIndex2, genParams, signal = null) => {
                    /**
                     * Generate 2 images in a single API call (Wavespeed.ai multi-image mode).
                     * 50% cost savings: $0.07/image instead of $0.14/image.
                     */
                    const job1 = node._bigJobs[jobIndex1];
                    const job2 = node._bigJobs[jobIndex2];
                    const nodeId = node._ni_widget?.value || String(node.id);

                    // Check if already aborted
                    if (signal?.aborted) {
                        console.log(`[BIG] Job pair ${jobIndex1}+${jobIndex2} skipped (cancelled)`);
                        job1.state = "cancelled";
                        job2.state = "cancelled";
                        job1.error = job2.error = "Cancelled by user";
                        node._bigStats.completed += 2;
                        updateProgressItem(job1);
                        updateProgressItem(job2);
                        updateProgressHeader();
                        return;
                    }

                    const pairStartTime = Date.now();
                    const promptPreview = (job1.prompt_positive || "").slice(0, 30);
                    console.log(`[BIG] 🎯 [${new Date().toISOString().slice(11,19)}] Starting pair ${jobIndex1}+${jobIndex2}: "${promptPreview}..."`);

                    // Mark both as generating
                    job1.state = "generating";
                    job2.state = "generating";
                    updateGeneratedBatchData(); // Save state immediately so tab switch preserves it
                    updateProgressItem(job1);
                    updateProgressItem(job2);
                    updateProgressHeader();

                    try {
                        // Build request - use job1's prompt for both (same subject, different variations)
                        const requestBody = {
                            node_id: nodeId,
                            job_id: job1.id,
                            second_job_id: job2.id,
                            multi_image: true,
                            ...genParams,
                            prompt_positive: job1.prompt_positive,
                            prompt_negative: job1.prompt_negative,
                            seed: job1.seed,
                        };

                        // Add input images for I2I mode
                        if (job1.input_image_b64) {
                            requestBody.input_image = job1.input_image_b64;
                        }
                        if (job1.input_image2_b64) {
                            requestBody.input_image2 = job1.input_image2_b64;
                        }
                        if (job1.input_image3_b64) {
                            requestBody.input_image3 = job1.input_image3_b64;
                        }
                        if (job1.input_image4_b64) {
                            requestBody.input_image4 = job1.input_image4_b64;
                        }

                        const response = await api.fetchApi("/instaraw/batch_gen_generate_single", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestBody),
                            signal: signal,
                        });

                        const result = await response.json();
                        const pairDuration = ((Date.now() - pairStartTime) / 1000).toFixed(1);
                        console.log(`[BIG] 🎯 [${new Date().toISOString().slice(11,19)}] Pair ${jobIndex1}+${jobIndex2} completed in ${pairDuration}s`);

                        if (result.status === "success" && result.multi_image && result.results) {
                            // Process both results
                            for (const imgResult of result.results) {
                                const job = imgResult.job_id === job1.id ? job1 : job2;
                                if (imgResult.status === "success") {
                                    // Check for cache hit
                                    job.state = imgResult.cache_hit ? "cached" : "success";
                                    job.image_url = imgResult.image_url;
                                    job.filename = imgResult.filename;
                                    job.subfolder = imgResult.subfolder || result.subfolder; // For URL reconstruction
                                    job.image_width = imgResult.width || 1024;
                                    job.image_height = imgResult.height || 1024;
                                    console.log(`[BIG][fix1] Paired job ${job.id} completed (${job.state}), imgResult.width=${imgResult.width}, imgResult.height=${imgResult.height}, stored as ${job.image_width}x${job.image_height}`);
                                    job.generation_time = result.generation_time ? result.generation_time / 2 : 0; // Split time between both
                                    node._bigStats.success++;
                                    if (imgResult.cache_hit) node._bigStats.cached++;
                                } else {
                                    job.state = "failed";
                                    job.error = imgResult.error || "Failed";
                                    node._bigStats.failed++;
                                }
                                updateProgressItem(job);
                            }
                            node._bigStats.completed += 2;
                        } else {
                            // Both failed
                            job1.state = "failed";
                            job2.state = "failed";
                            job1.error = job2.error = result.error || "Multi-image generation failed";
                            node._bigStats.failed += 2;
                            node._bigStats.completed += 2;
                            updateProgressItem(job1);
                            updateProgressItem(job2);
                        }

                    } catch (e) {
                        if (e.name === 'AbortError') {
                            job1.state = job2.state = "cancelled";
                            job1.error = job2.error = "Cancelled by user";
                        } else {
                            console.error(`[BIG] Job pair ${jobIndex1}+${jobIndex2} error:`, e);
                            job1.state = job2.state = "failed";
                            job1.error = job2.error = e.message || "Network error";
                            node._bigStats.failed += 2;
                        }
                        node._bigStats.completed += 2;
                        updateProgressItem(job1);
                        updateProgressItem(job2);
                    }

                    updateGeneratedBatchData();
                    updateGeneratedBatchData();
                    updateProgressHeader();
                };

                const updateGeneratedBatchData = () => {
                    /**
                     * Update the generated_batch_data widget, node.properties, AND session storage.
                     * - Widget: for Python backend to read
                     * - Properties: for workflow file persistence
                     * - Session storage: for reliable tab switch persistence (ComfyUI recreates nodes!)
                     */
                    const widget = node.widgets?.find(w => w.name === "generated_batch_data");
                    if (!widget) {
                        console.warn("[BIG] generated_batch_data widget not found!");
                        return;
                    }

                    // IMPORTANT: Do NOT save image_url (base64 data) to node.properties!
                    // Base64 images are huge and will exceed localStorage quota.
                    // Images are saved to disk with filenames - we can load from there.
                    const batchDataForStorage = node._bigJobs.map(job => ({
                        id: job.id,
                        prompt_positive: job.prompt_positive,
                        prompt_negative: job.prompt_negative,
                        seed: job.seed,
                        state: job.state,
                        filename: job.filename,
                        // NO image_url here - it's base64 and too large!
                        image_width: job.image_width,
                        image_height: job.image_height,
                        error: job.error,
                        generation_time: job.generation_time,
                        subfolder: job.subfolder, // Keep for file path reconstruction
                    }));
                    console.log(`[BIG] Saving ${batchDataForStorage.length} jobs (without base64 images)`);

                    const jsonData = JSON.stringify(batchDataForStorage);

                    // Update widget (for Python backend)
                    widget.value = jsonData;

                    // Update node.properties (for workflow file) - small data only!
                    node.properties = node.properties || {};
                    node.properties.big_jobs_data = jsonData;

                    // Update session storage (survives tab switches - most reliable!)
                    saveToSession(jsonData);

                    console.log(`[BIG] Updated state with ${batchDataForStorage.length} jobs (widget + properties + session)`);
                };

                // ═══════════════════════════════════════════════════════════════════
                // STATE RENDERING FUNCTIONS (RPG PATTERN)
                // ═══════════════════════════════════════════════════════════════════

                // Helper to render image preview grid showing all 4 image inputs
                const renderImagePreview = (imageUrls, mode, aspectRatio = "1:1", totalGenerations = 0) => {
                    // Get all image input URLs
                    const img1Urls = node._bigImageUrls || [];
                    const img2Urls = node._bigImage2Urls || [];
                    const img3Urls = node._bigImage3Urls || [];
                    const img4Urls = node._bigImage4Urls || [];

                    const totalImages = img1Urls.length + img2Urls.length + img3Urls.length + img4Urls.length;

                    if (mode !== "img2img" || totalImages === 0) {
                        return '';
                    }

                    // Check which inputs have images
                    const inputsWithImages = [
                        { urls: img1Urls, label: "Image 1" },
                        { urls: img2Urls, label: "Image 2" },
                        { urls: img3Urls, label: "Image 3" },
                        { urls: img4Urls, label: "Image 4" }
                    ].filter(input => input.urls.length > 0);

                    const connectedInputs = inputsWithImages.length;
                    const multiImageMode = connectedInputs > 1;

                    // Get AIL item count INCLUDING repeat counts (like RPG does)
                    const getAILTotalCount = () => {
                        const primaryAIL = findConnectedAIL("images");
                        if (!primaryAIL || !primaryAIL.properties?.batch_data) {
                            return multiImageMode ? getComboMaxLength(inputsWithImages) : totalImages;
                        }
                        try {
                            const batchData = JSON.parse(primaryAIL.properties.batch_data);
                            const images = batchData.images || [];
                            // Sum up repeat counts like RPG does
                            return images.reduce((sum, img) => sum + (img.repeat_count || 1), 0);
                        } catch (e) {
                            return multiImageMode ? getComboMaxLength(inputsWithImages) : totalImages;
                        }
                    };

                    const ailTotalCount = getAILTotalCount();

                    // Sync status - compare totalGenerations (prompt repeats) with ailTotalCount (image repeats)
                    const isSynced = totalGenerations > 0 && totalGenerations === ailTotalCount;

                    // Sync status badge HTML (informational only - sync in RPG/AIL)
                    const renderSyncBadge = () => {
                        if (totalGenerations === 0) {
                            return `<span class="instaraw-big-sync-badge instaraw-big-sync-no-prompts">No prompts</span>`;
                        }
                        if (isSynced) {
                            return `<span class="instaraw-big-sync-badge instaraw-big-sync-match">✓ ${totalGenerations} gens ↔ ${ailTotalCount} AIL</span>`;
                        }
                        return `
                            <span class="instaraw-big-sync-badge instaraw-big-sync-mismatch" title="Sync in RPG or AIL">⚠ ${totalGenerations} gens ↔ ${ailTotalCount} AIL</span>
                            <span class="instaraw-big-sync-hint">Sync in RPG</span>
                        `;
                    };

                    // Multi-image mode: Show combination cards
                    if (multiImageMode) {
                        const maxLen = getComboMaxLength(inputsWithImages);
                        const comboCardsHtml = renderComboCards(inputsWithImages, {
                            getImageUrl: (url) => url
                        });

                        return `
                            <div class="instaraw-big-image-preview">
                                <div class="instaraw-big-image-preview-header">
                                    <div class="instaraw-multi-image-indicator">
                                        <span class="instaraw-multi-image-indicator-dot"></span>
                                        <span class="instaraw-multi-image-count">${connectedInputs} AIL inputs</span>
                                        <span>connected</span>
                                    </div>
                                    <div class="instaraw-big-image-preview-header-right">
                                        ${renderSyncBadge()}
                                    </div>
                                </div>
                                <div class="instaraw-combo-grid">
                                    ${comboCardsHtml}
                                </div>
                            </div>
                        `;
                    }

                    // Single input mode: Clean square thumbnail grid
                    // Expand images by repeat count for accurate preview
                    const getExpandedImages = () => {
                        const primaryAIL = findConnectedAIL("images");
                        if (!primaryAIL || !primaryAIL.properties?.batch_data) {
                            // Fallback: just use URLs as-is
                            return img1Urls.map((url, idx) => ({ url, index: idx + 1, isRepeat: false }));
                        }
                        try {
                            const batchData = JSON.parse(primaryAIL.properties.batch_data);
                            const images = batchData.images || [];
                            const order = batchData.order || [];
                            const expanded = [];

                            order.forEach((id, idx) => {
                                const item = images.find(img => img.id === id);
                                if (!item) return;
                                const repeatCount = item.repeat_count || 1;
                                const url = img1Urls[idx] || item.url;

                                for (let r = 0; r < repeatCount; r++) {
                                    expanded.push({
                                        url,
                                        index: idx + 1,
                                        repeatIndex: r + 1,
                                        repeatTotal: repeatCount,
                                        isRepeat: r > 0
                                    });
                                }
                            });
                            return expanded.length > 0 ? expanded : img1Urls.map((url, idx) => ({ url, index: idx + 1, isRepeat: false }));
                        } catch (e) {
                            return img1Urls.map((url, idx) => ({ url, index: idx + 1, isRepeat: false }));
                        }
                    };
                    const expandedImages = getExpandedImages();

                    return `
                        <div class="instaraw-big-image-preview">
                            <div class="instaraw-big-image-preview-header">
                                <span>📸 Reference Images</span>
                                <div class="instaraw-big-image-preview-header-right">
                                    ${renderSyncBadge()}
                                </div>
                            </div>
                            <div class="instaraw-big-ref-grid">
                                ${expandedImages.map((img, idx) => {
                                    const label = img.repeatTotal > 1
                                        ? `${img.index}.${img.repeatIndex}`
                                        : `${img.index}`;
                                    return `
                                        <div class="instaraw-big-ref-thumb${img.isRepeat ? ' instaraw-big-ref-repeat-item' : ''}" title="Image ${img.index}${img.repeatTotal > 1 ? ` (${img.repeatIndex}/${img.repeatTotal})` : ''}">
                                            <img src="${img.url}" alt="Image ${img.index}" draggable="false" />
                                            <span class="instaraw-big-ref-index">${label}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                };

                const renderIdleState = () => {
                    // Get multi-image mode info even in idle state
                    const multiImageInfo = getMultiImageInfo();
                    const modelInfo = getModelProviderInfo();
                    const modelDisplay = modelInfo.model && modelInfo.provider
                        ? `${modelInfo.model} (${modelInfo.provider})`
                        : modelInfo.model || "Not connected";

                    // Check if RPG is connected (even if no prompts yet)
                    const rpgConnected = isRPGConnected();
                    const idleMessage = rpgConnected
                        ? "✅ RPG connected — Generate prompts in RPG to continue"
                        : "Connect to Reality Prompt Generator to generate images";

                    container.innerHTML = `
                        <div class="instaraw-big-idle">
                            <img src="/extensions/ComfyUI_INSTARAW/instaraw.svg" alt="INSTARAW" class="instaraw-big-idle-logo" style="width: 180px; height: auto; margin-bottom: 22px;" />
                            <div class="instaraw-big-idle-text">Batch Image Generator</div>
                            ${multiImageInfo.multiImage ? `
                            <div class="instaraw-big-idle-mode-badges">
                                ${multiImageInfo.isActive ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-badge" title="50% cost savings: $0.07/img instead of $0.14/img">⚡ 2X MODE</span>` : ''}
                                ${multiImageInfo.isWarning ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-warning" title="Multi-image only works with Wavespeed.ai">⚠️ 2X needs Wavespeed</span>` : ''}
                                ${multiImageInfo.isNoProvider ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-warning" title="Connect a provider to use multi-image mode">⚠️ 2X no provider</span>` : ''}
                            </div>
                            ` : ''}
                            <div class="instaraw-big-model-info">${escapeHtml(modelDisplay)}</div>
                            <!-- 2X Mode Toggle -->
                            <label class="instaraw-big-2x-toggle" title="Generate 2 variations per prompt at 50% cost savings ($0.07/img instead of $0.14/img). Only works with Wavespeed.ai provider.">
                                <input type="checkbox" class="instaraw-big-2x-checkbox" ${multiImageInfo.multiImage ? 'checked' : ''}>
                                <span>⚡ 2X Mode</span>
                            </label>
                            <div class="instaraw-big-idle-instructions">
                                ${idleMessage}
                            </div>
                        </div>
                    `;
                    updateCachedHeight();
                };

                const renderPreviewState = (detectedPrompts) => {
                    const promptCount = detectedPrompts.length;
                    // Calculate total generations including repeat counts (like RPG)
                    const totalGenerations = detectedPrompts.reduce((sum, p) => sum + (p.repeat_count || 1), 0);
                    const displayLimit = 10; // Show first 10 prompts in preview
                    const promptsToShow = detectedPrompts.slice(0, displayLimit);
                    const hasMore = promptCount > displayLimit;

                    // Get mode info for preview
                    const imagesInfo = getConnectedImagesInfo();
                    const mode = imagesInfo.mode;
                    const imageCount = imagesInfo.imageCount;
                    const imageUrls = imagesInfo.imageUrls || [];
                    const modeLabel = mode === "img2img" ? "IMG2IMG" : "TXT2IMG";
                    const modeClass = mode === "img2img" ? "instaraw-big-mode-img2img" : "instaraw-big-mode-txt2img";

                    // Update node state
                    node._bigMode = mode;
                    node._bigImageCount = imageCount;

                    // Get model info
                    const modelInfo = getModelProviderInfo();
                    const modelDisplay = modelInfo.model && modelInfo.provider
                        ? `${modelInfo.model} (${modelInfo.provider})`
                        : modelInfo.model || "Not connected";

                    // Get multi-image mode info
                    const multiImageInfo = getMultiImageInfo();

                    // Calculate total output images (2x if multi-image mode is active)
                    const totalOutputImages = multiImageInfo.isActive ? totalGenerations * 2 : totalGenerations;

                    container.innerHTML = `
                        <div class="instaraw-big-preview">
                            <!-- Model Warning (if not Nano Banana Pro) -->
                            ${modelInfo.model && !modelInfo.isSupported ? `
                            <div class="instaraw-big-model-warning">
                                ⚠️ <strong>Unsupported Model:</strong> "${escapeHtml(modelInfo.model)}"<br>
                                <small>This node is experimental and currently only supports <strong>Nano Banana Pro</strong>. Support for other models will be added soon.</small>
                            </div>
                            ` : ''}

                            <!-- Mode Card (RPG Style) -->
                            <div class="instaraw-big-topbar">
                                <div class="instaraw-big-mode-card">
                                    <div class="instaraw-big-mode-card-inner">
                                        <div class="instaraw-big-mode-card-left">
                                            <div class="instaraw-big-mode-indicator">
                                                <span class="instaraw-big-mode-badge ${modeClass}">${modeLabel}</span>
                                                ${multiImageInfo.isActive ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-badge" title="2 variations per prompt at $0.07/img">⚡ 2X MODE</span>` : ''}
                                                ${multiImageInfo.isWarning ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-warning" title="Multi-image only works with Wavespeed.ai">⚠️ 2X needs Wavespeed</span>` : ''}
                                                ${multiImageInfo.isNoProvider ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-warning" title="Connect a provider to use multi-image mode">⚠️ 2X no provider</span>` : ''}
                                            </div>
                                            ${mode === "img2img" ? `<div class="instaraw-big-mode-source">${formatImageCount()}</div>` : ''}
                                            <div class="instaraw-big-model-info">${escapeHtml(modelDisplay)}</div>
                                            <!-- 2X Mode Toggle -->
                                            <label class="instaraw-big-2x-toggle" title="Generate 2 variations per prompt at 50% cost savings ($0.07/img instead of $0.14/img). Only works with Wavespeed.ai provider.">
                                                <input type="checkbox" class="instaraw-big-2x-checkbox" ${multiImageInfo.multiImage ? 'checked' : ''}>
                                                <span>⚡ 2X Mode</span>
                                            </label>
                                        </div>
                                        <div class="instaraw-big-mode-card-brand">
                                            <img src="/extensions/ComfyUI_INSTARAW/instaraw.svg" alt="INSTARAW" class="instaraw-big-topbar-logo" />
                                            <span class="instaraw-big-topbar-version">BIG V2.0</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="instaraw-big-kpi-row">
                                    <div class="instaraw-big-kpi">
                                        <span>PROMPTS</span>
                                        <strong>${promptCount}</strong>
                                    </div>
                                    <div class="instaraw-big-kpi">
                                        <span>OUTPUT</span>
                                        <strong>${totalOutputImages}${multiImageInfo.isActive ? ' (2×)' : ''}</strong>
                                    </div>
                                </div>
                            </div>

                            ${multiImageInfo.isActive ? `
                            <div class="instaraw-big-multi-image-banner">
                                <span>⚡ <strong>2X Multi-Image Mode</strong> - ${promptCount} prompt${promptCount !== 1 ? 's' : ''} × 2 variations = ${totalOutputImages} images</span>
                                <span class="instaraw-big-cost-savings">50% cost savings: $0.07/img</span>
                            </div>
                            ${multiImageInfo.aspectRatioWarning ? `
                            <div class="instaraw-big-aspect-warning">
                                ⚠️ Aspect ratio "${multiImageInfo.aspectRatio}" will be mapped to closest supported (3:2, 2:3, 3:4, 4:3)
                            </div>
                            ` : ''}
                            ` : ''}

                            <!-- Reference Images Preview (for img2img) -->
                            ${renderImagePreview(imageUrls, mode, multiImageInfo.aspectRatio || "1:1", totalGenerations)}

                            <!-- Generate All at TOP -->
                            <div class="instaraw-big-preview-actions">
                                <button class="instaraw-big-btn-primary instaraw-big-generate-all-btn" ${!modelInfo.isSupported ? 'disabled title="Unsupported model - only Nano Banana Pro is supported"' : ''}>
                                    ✨ Generate All (${totalOutputImages} image${totalOutputImages !== 1 ? 's' : ''}${multiImageInfo.isActive ? ' ⚡' : ''})
                                </button>
                            </div>

                            <div class="instaraw-big-preview-header">
                                <span>📋 ${promptCount} prompt${promptCount !== 1 ? 's' : ''} ready</span>
                            </div>
                            <div class="instaraw-big-preview-list">
                                ${promptsToShow.map((p, i) => `
                                    <div class="instaraw-big-preview-item">
                                        <span class="instaraw-big-preview-prompt">#${i + 1}: ${escapeHtml(p.positive.slice(0, 50))}${p.positive.length > 50 ? '...' : ''}</span>
                                        <button class="instaraw-big-generate-single-btn" data-index="${i}" ${!modelInfo.isSupported ? 'disabled' : ''}>
                                            🎨 ${multiImageInfo.isActive ? 'Generate ⚡2×' : 'Generate'}
                                        </button>
                                    </div>
                                `).join('')}
                                ${hasMore ? `
                                    <div class="instaraw-big-preview-item-more">
                                        ...and ${promptCount - displayLimit} more
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                    setupEventHandlers();
                    attachImageOnloadHandlers();
                    updateCachedHeight();
                };

                const renderBatchPanel = () => {
                    const jobs = node._bigJobs;
                    const s = node._bigStats;
                    const elapsed = node._bigStartTime ? formatTime(Date.now() - node._bigStartTime) : "0s";
                    const modelInfo = getModelProviderInfo();
                    const modelDisplay = modelInfo.model && modelInfo.provider
                        ? `${modelInfo.model} (${modelInfo.provider})`
                        : modelInfo.model || "Unknown";

                    // Get current mode info
                    const mode = node._bigMode || "txt2img";
                    const imageCount = node._bigImageCount || 0;
                    const imageUrls = node._bigImageUrls || [];
                    const modeLabel = mode === "img2img" ? "IMG2IMG" : "TXT2IMG";
                    const modeClass = mode === "img2img" ? "instaraw-big-mode-img2img" : "instaraw-big-mode-txt2img";

                    // Check multi-image mode
                    const multiImageInfo = getMultiImageInfo();

                    // Get totalGenerations for sync status (sum of repeat counts from RPG)
                    const detectedPrompts = getConnectedRPGData() || [];
                    const totalGenerations = detectedPrompts.reduce((sum, p) => sum + (p.repeat_count || 1), 0);

                    container.innerHTML = `
                        <div class="instaraw-big-generation-progress">
                            <!-- Top Bar (RPG Style) -->
                            <div class="instaraw-big-topbar">
                                <div class="instaraw-big-mode-card">
                                    <div class="instaraw-big-mode-card-inner">
                                        <div class="instaraw-big-mode-card-left">
                                            <div class="instaraw-big-mode-indicator">
                                                <span class="instaraw-big-mode-badge ${modeClass}">${modeLabel}</span>
                                                ${multiImageInfo.isActive ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-badge" title="50% cost savings: $0.07/img instead of $0.14/img">⚡ 2X MODE</span>` : ''}
                                                ${multiImageInfo.isWarning ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-warning" title="Multi-image only works with Wavespeed.ai">⚠️ 2X needs Wavespeed</span>` : ''}
                                                ${multiImageInfo.isNoProvider ? `<span class="instaraw-big-mode-badge instaraw-big-multi-image-warning" title="Connect a provider to use multi-image mode">⚠️ 2X no provider</span>` : ''}
                                            </div>
                                            ${mode === "img2img" ? `<div class="instaraw-big-mode-source">${formatImageCount()}</div>` : ''}
                                            <div class="instaraw-big-model-info">${escapeHtml(modelDisplay)}</div>
                                            <!-- 2X Mode Toggle (when not generating) -->
                                            ${!node._bigIsGenerating ? `
                                            <label class="instaraw-big-2x-toggle" title="Generate 2 variations per prompt at 50% cost savings ($0.07/img instead of $0.14/img). Only works with Wavespeed.ai provider.">
                                                <input type="checkbox" class="instaraw-big-2x-checkbox" ${multiImageInfo.multiImage ? 'checked' : ''}>
                                                <span>⚡ 2X Mode</span>
                                            </label>
                                            ` : ''}
                                        </div>
                                        <div class="instaraw-big-mode-card-brand">
                                            <img src="/extensions/ComfyUI_INSTARAW/instaraw.svg" alt="INSTARAW" class="instaraw-big-topbar-logo" />
                                            <span class="instaraw-big-topbar-version">BIG V2.0</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="instaraw-big-kpi-row">
                                    <div class="instaraw-big-kpi">
                                        <span>JOBS</span>
                                        <strong>${s.completed}/${s.total}</strong>
                                    </div>
                                    <div class="instaraw-big-kpi success">
                                        <span>SUCCESS</span>
                                        <strong>${s.success}</strong>
                                    </div>
                                    <div class="instaraw-big-kpi cached">
                                        <span>CACHED</span>
                                        <strong>${s.cached}</strong>
                                    </div>
                                    <div class="instaraw-big-kpi failed">
                                        <span>FAILED</span>
                                        <strong>${s.failed}</strong>
                                    </div>
                                </div>
                            </div>

                            <!-- Reference Images Preview (for img2img) -->
                            ${renderImagePreview(imageUrls, mode, multiImageInfo.aspectRatio || "1:1", totalGenerations)}

                            <!-- Header with inline stop button -->
                            <div class="instaraw-big-progress-header">
                                <h4>${node._bigIsGenerating ? `Generating... (${elapsed})` : `Complete (${elapsed})`}</h4>
                                ${node._bigIsGenerating ? `<button class="instaraw-big-stop-btn">⏹ Stop</button>` : ''}
                            </div>

                            <!-- Actions at TOP (only when not generating) -->
                            ${!node._bigIsGenerating ? `
                            <div class="instaraw-big-actions">
                                <button class="instaraw-big-btn-primary instaraw-big-generate-all-btn" ${!modelInfo.isSupported ? 'disabled title="Unsupported model - only Nano Banana Pro is supported"' : ''}>
                                    ✨ Generate All
                                </button>
                                <div class="instaraw-big-actions-row">
                                    <button class="instaraw-big-btn-secondary instaraw-big-download-all-btn" ${s.success === 0 ? 'disabled' : ''}>
                                        ⬇ Download All (${s.success})
                                    </button>
                                    <button class="instaraw-big-btn-secondary instaraw-big-retry-failed-btn" ${s.failed === 0 ? 'disabled' : ''}>
                                        🔁 Retry (${s.failed})
                                    </button>
                                    <button class="instaraw-big-btn-secondary instaraw-big-clear-btn">
                                        🗑️ Clear
                                    </button>
                                </div>
                            </div>
                            ` : ''}

                            <!-- Progress Items -->
                            <div class="instaraw-big-progress-items">
                                ${renderProgressItems(jobs)}
                            </div>
                        </div>
                    `;

                    setupEventHandlers();
                    attachImageOnloadHandlers();
                    updateCachedHeight();

                    // Start timer if generating
                    if (node._bigIsGenerating) {
                        startTimer();
                    }
                };

                const renderUI = () => {
                    // Show loading state while waiting for initialization
                    // This prevents flash of idle state before data is restored
                    if (node._pendingInitRender && !node._bigInitialized) {
                        container.innerHTML = `
                            <div class="instaraw-big-container">
                                <div class="instaraw-big-idle">
                                    <img src="/extensions/ComfyUI_INSTARAW/instaraw.svg" alt="INSTARAW" class="instaraw-big-idle-logo" style="width: 180px; height: auto; margin-bottom: 22px; opacity: 0.6;" />
                                    <div class="instaraw-big-idle-text">Loading...</div>
                                </div>
                            </div>
                        `;
                        updateCachedHeight();
                        return;
                    }

                    const detectedPrompts = getConnectedRPGData();
                    const hasGenerated = node._bigJobs && node._bigJobs.length > 0;

                    // State priority: generating > batch > preview > idle
                    if (node._bigIsGenerating) {
                        renderBatchPanel(); // Shows progress during generation
                    } else if (hasGenerated) {
                        renderBatchPanel(); // Shows completed batch
                    } else if (detectedPrompts && detectedPrompts.length > 0) {
                        renderPreviewState(detectedPrompts); // Shows detected prompts
                    } else {
                        renderIdleState(); // Shows "connect to RPG" message
                    }
                };

                // Render jobs, grouping pairs together for multi-image mode
                const renderProgressItems = (jobs) => {
                    const hasPairs = jobs.some(j => j.is_pair);
                    if (!hasPairs) {
                        // Regular rendering - no pairs
                        return jobs.map((job, idx) => renderProgressItem(job, idx)).join("");
                    }

                    // Group paired jobs together
                    let html = '';
                    const rendered = new Set();
                    for (let i = 0; i < jobs.length; i++) {
                        if (rendered.has(i)) continue;
                        const job = jobs[i];

                        if (job.is_pair && job.pair_with !== undefined && job.pair_with < jobs.length) {
                            const pairedJob = jobs[job.pair_with];
                            const pairIdx = job.pair_with;
                            rendered.add(i);
                            rendered.add(pairIdx);

                            // Render both jobs in a pair container
                            const firstIdx = Math.min(i, pairIdx);
                            const secondIdx = Math.max(i, pairIdx);
                            const promptIdx = jobs[firstIdx].prompt_index ?? Math.floor(firstIdx / 2);
                            const promptPreview = (jobs[firstIdx].prompt_positive || "").slice(0, 40);
                            html += `
                                <div class="instaraw-big-pair-group">
                                    <div class="instaraw-big-pair-header">
                                        <span class="instaraw-big-pair-label">⚡ Prompt #${promptIdx + 1}: ${escapeHtml(promptPreview)}${promptPreview.length >= 40 ? '...' : ''}</span>
                                        <span class="instaraw-big-pair-savings">2 variations</span>
                                    </div>
                                    <div class="instaraw-big-pair-items">
                                        ${renderProgressItem(jobs[firstIdx], firstIdx)}
                                        ${renderProgressItem(jobs[secondIdx], secondIdx)}
                                    </div>
                                </div>
                            `;
                        } else {
                            // Single job (last odd one or non-paired)
                            rendered.add(i);
                            html += renderProgressItem(job, i);
                        }
                    }
                    return html;
                };

                const renderProgressItem = (job, idx) => {
                    const stateInfo = STATE_CONFIG[job.state] || STATE_CONFIG[JobState.PENDING];
                    const isPaired = job.is_pair === true;

                    // For paired jobs, show variation number; otherwise show prompt preview
                    let labelText;
                    if (isPaired && job.variation) {
                        labelText = `Variation ${job.variation}`;
                    } else {
                        const promptPreview = escapeHtml((job.prompt_positive || "").slice(0, 60));
                        labelText = `#${idx + 1} ${promptPreview}${job.prompt_positive?.length > 60 ? "..." : ""}`;
                    }

                    // No need for pair badge on individual items when grouped (header shows it)
                    const pairBadge = '';

                    let statusText = `${stateInfo.icon} ${stateInfo.text}`;
                    if (job.state === JobState.RETRYING && job.attempts > 1) {
                        statusText = `🔁 Retry #${job.attempts}`;
                    } else if (job.state === JobState.SUCCESS && job.generation_time) {
                        statusText = `✓ ${job.generation_time.toFixed(1)}s`;
                    } else if (job.state === JobState.CACHED && job.generation_time) {
                        statusText = `📦 Cached (${job.generation_time.toFixed(1)}s)`;
                    }

                    // Show error for failed jobs, show "retrying" message for retrying jobs
                    const showError = job.state === JobState.FAILED && job.error;
                    const showRetryMsg = job.state === JobState.RETRYING && job.error;
                    const showRetry = job.state === JobState.FAILED;
                    const hasImage = job.image_url && (job.state === JobState.SUCCESS || job.state === JobState.CACHED);
                    const isGenerating = job.state === JobState.GENERATING || job.state === JobState.RETRYING;

                    // Progress bar width and animation
                    let barWidth = "0%";
                    let barClass = "";
                    let barStyle = "";

                    if (job.state === JobState.SUCCESS || job.state === JobState.CACHED) {
                        barWidth = "100%";
                    } else if (isGenerating) {
                        barWidth = "100%";
                        barClass = "animating";
                    } else if (job.state === JobState.FAILED) {
                        barWidth = "100%";
                        barStyle = "background: linear-gradient(90deg, #ef4444, #dc2626);";
                    }

                    // Thumbnail rendering - always show placeholder, overlay video when generating
                    // Note: No inline onerror - attachImageOnloadHandlers adds smart retry with subfolder fallback
                    let thumbnailHtml = '';
                    if (hasImage) {
                        thumbnailHtml = `
                            <div class="instaraw-big-progress-item-thumbnail">
                                <img src="${job.image_url}" alt="Generated image #${idx + 1}" class="instaraw-big-thumbnail-img" data-job-id="${job.id}" loading="lazy" style="background: rgba(0,0,0,0.3);" />
                            </div>
                        `;
                    } else if (isGenerating) {
                        // Show loader video while generating
                        thumbnailHtml = `
                            <div class="instaraw-big-progress-item-thumbnail placeholder">
                                <video class="instaraw-big-thumbnail-video" autoplay loop muted playsinline src="extensions/ComfyUI_INSTARAW/Instara_loader.mp4"></video>
                            </div>
                        `;
                    } else {
                        // No image yet - show empty placeholder (no icon)
                        thumbnailHtml = `
                            <div class="instaraw-big-progress-item-thumbnail placeholder">
                                <div class="instaraw-big-thumbnail-empty"></div>
                            </div>
                        `;
                    }

                    // Message to display (error or retry info)
                    const messageText = showError ? escapeHtml(job.error?.slice(0, 100)) :
                                       showRetryMsg ? `⚠️ ${escapeHtml(job.error?.slice(0, 80))}` : "";
                    const showMessage = showError || showRetryMsg;
                    const messageClass = showError ? "error-message" : "retry-message";

                    // Full prompt for expandable section
                    const fullPrompt = escapeHtml(job.prompt_positive || "No prompt");
                    const rawPrompt = job.prompt_positive || "";
                    const seed = job.seed || "N/A";
                    const hasLongPrompt = (job.prompt_positive || "").length > 60;

                    return `
                        <div class="instaraw-big-progress-item ${stateInfo.class}" data-job-id="${job.id}">
                            <div class="instaraw-big-progress-item-content">
                                <div class="instaraw-big-progress-item-header">
                                    <span class="instaraw-big-progress-item-label">${labelText}</span>
                                    <span class="instaraw-big-progress-item-status ${stateInfo.class}">${statusText}</span>
                                    ${hasLongPrompt ? `<button class="instaraw-big-expand-prompt-btn" data-job-id="${job.id}" title="Expand prompt">📝</button>` : ''}
                                    ${hasImage ? `<button class="instaraw-big-view-image-btn" data-job-id="${job.id}" title="View image">👁️</button>` : ''}
                                    <button class="instaraw-big-job-retry-btn" data-job-id="${job.id}" style="display: ${showRetry ? 'inline-block' : 'none'};">🔁</button>
                                </div>
                                <div class="instaraw-big-progress-item-bar">
                                    <div class="instaraw-big-progress-item-fill ${barClass}" style="width: ${barWidth}; ${barStyle}"></div>
                                </div>
                                <div class="instaraw-big-progress-item-message ${messageClass}" style="display: ${showMessage ? 'block' : 'none'};">${messageText}</div>
                                <!-- Expandable prompt section -->
                                <div class="instaraw-big-prompt-expanded" data-job-id="${job.id}" style="display: none;">
                                    <div class="instaraw-big-prompt-header">
                                        <span class="instaraw-big-prompt-meta">Seed: ${seed}</span>
                                        <div class="instaraw-big-prompt-actions">
                                            <button class="instaraw-big-copy-seed-btn" data-seed="${seed}" title="Copy seed">🎲 Seed</button>
                                            <button class="instaraw-big-copy-prompt-btn" data-prompt="${escapeHtml(rawPrompt)}" title="Copy prompt">📋 Prompt</button>
                                            <button class="instaraw-big-favorite-prompt-btn" data-prompt="${escapeHtml(rawPrompt)}" data-seed="${seed}" title="Add to favorites in RPG">⭐ Favorite</button>
                                        </div>
                                    </div>
                                    <div class="instaraw-big-prompt-text">${fullPrompt}</div>
                                </div>
                            </div>
                            ${thumbnailHtml}
                        </div>
                    `;
                };

                // Track active PhotoSwipe instance to prevent duplicates
                let activePswp = null;

                // Force cleanup any orphaned PhotoSwipe elements
                const cleanupPhotoSwipe = () => {
                    const existingPswp = document.querySelectorAll('.pswp');
                    if (existingPswp.length > 0) {
                        console.warn(`[BIG] Cleaning up ${existingPswp.length} orphaned .pswp elements`);
                        existingPswp.forEach(el => el.remove());
                    }
                    activePswp = null;
                };

                const openPhotoSwipe = async (startJobId) => {
                    console.log(`[BIG] openPhotoSwipe called with jobId=${startJobId}, activePswp=${!!activePswp}`);

                    // If activePswp is stuck in 'loading' state for some reason, force cleanup
                    if (activePswp === 'loading') {
                        console.warn("[BIG] PhotoSwipe stuck in loading state, forcing cleanup");
                        cleanupPhotoSwipe();
                    }

                    // Prevent opening multiple instances - but if it's a real pswp instance, try to close it first
                    if (activePswp && activePswp !== 'loading') {
                        console.log("[BIG] PhotoSwipe already open, closing first...");
                        try {
                            activePswp.close();
                        } catch (e) {
                            console.warn("[BIG] Failed to close existing PhotoSwipe:", e);
                        }
                        cleanupPhotoSwipe();
                    }

                    // Set flag immediately to prevent race conditions
                    activePswp = 'loading';

                    // Wait for PhotoSwipe to load if not ready yet
                    if (!window.PhotoSwipe || !window.PhotoSwipeLightbox) {
                        console.log("[BIG] Waiting for PhotoSwipe to load...");
                        try {
                            await loadPhotoSwipe();
                        } catch (e) {
                            console.error("[BIG] Failed to load PhotoSwipe:", e);
                            activePswp = null;
                            return;
                        }
                    }

                    // Double-check after await
                    if (!window.PhotoSwipe) {
                        console.error("[BIG] PhotoSwipe still not available");
                        activePswp = null;
                        return;
                    }

                    // Always cleanup any existing pswp elements before creating new one
                    const existingPswp = document.querySelectorAll('.pswp');
                    if (existingPswp.length > 0) {
                        console.warn(`[BIG] Found ${existingPswp.length} existing .pswp elements, removing...`);
                        existingPswp.forEach(el => el.remove());
                    }

                    // Get all jobs with images
                    const jobsWithImages = node._bigJobs.filter(j => j.image_url);
                    if (jobsWithImages.length === 0) {
                        console.warn("[BIG] No jobs with images to show");
                        activePswp = null;
                        return;
                    }

                    // Find starting index
                    const startIndex = jobsWithImages.findIndex(j => j.id === startJobId);

                    // Create PhotoSwipe items with actual image dimensions
                    const items = jobsWithImages.map((job, idx) => ({
                        src: job.image_url,
                        width: job.image_width || 1024,
                        height: job.image_height || 1024,
                        alt: `Job #${job.id + 1}`,
                        msrc: job.image_url, // thumbnail source (same as main)
                        filename: job.filename || `big_${job.id}_${Date.now()}.png`,
                    }));

                    console.log(`[BIG] Opening PhotoSwipe with ${jobsWithImages.length} images, startIndex=${startIndex}`);

                    try {
                        // Create PhotoSwipe instance
                        const pswp = new window.PhotoSwipe({
                            dataSource: items,
                            index: startIndex >= 0 ? startIndex : 0,
                            bgOpacity: 0.9,
                            spacing: 0.1,
                            showHideAnimationType: 'none',
                            showAnimationDuration: 0,
                            hideAnimationDuration: 0,
                            zoomAnimationDuration: 0,
                            loop: true,
                            closeOnVerticalDrag: false,
                            pinchToClose: true,
                            closeTitle: 'Close (Esc)',
                            zoomTitle: 'Zoom in/out',
                            arrowPrevTitle: 'Previous (arrow left)',
                            arrowNextTitle: 'Next (arrow right)',
                            errorMsg: 'Image failed to load',
                            easing: 'linear',
                        });

                        // Add download button
                        pswp.on('uiRegister', () => {
                            pswp.ui.registerElement({
                                name: 'download-button',
                                order: 8,
                                isButton: true,
                                tagName: 'a',
                                html: {
                                    isCustomSVG: true,
                                    inner: '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
                                    outlineID: 'pswp__icn-download'
                                },
                                onInit: (el, pswp) => {
                                    el.setAttribute('download', '');
                                    el.setAttribute('target', '_blank');
                                    el.setAttribute('rel', 'noopener');
                                    el.setAttribute('title', 'Download image');

                                    pswp.on('change', () => {
                                        const currentItem = pswp.currSlide?.data;
                                        if (currentItem) {
                                            el.href = currentItem.src;
                                            el.download = currentItem.filename;
                                        }
                                    });
                                }
                            });
                        });

                        // Track this instance and clear on close
                        activePswp = pswp;

                        pswp.on('close', () => {
                            console.log("[BIG] PhotoSwipe closed");
                            activePswp = null;
                        });

                        pswp.on('destroy', () => {
                            console.log("[BIG] PhotoSwipe destroyed");
                            activePswp = null;
                        });

                        pswp.init();
                    } catch (e) {
                        console.error("[BIG] Error initializing PhotoSwipe:", e);
                        cleanupPhotoSwipe();
                    }
                };

                const setupEventHandlers = () => {
                    // === Canvas Panning & Zoom Event Forwarding ===
                    // Allow dragging/zooming canvas even when mouse is over custom UI
                    const isInteractiveElement = (element) => {
                        if (!element) return false;
                        const tagName = element.tagName?.toLowerCase();
                        if (['button', 'input', 'select', 'textarea', 'a', 'img'].includes(tagName)) return true;
                        const className = element.className || '';
                        if (typeof className === 'string' && (
                            className.includes('-btn') || className.includes('-input') ||
                            className.includes('-select') || className.includes('prompt-card') ||
                            className.includes('gallery-item') || className.includes('result-image')
                        )) return true;
                        if (element.onclick || element.onmousedown || element.draggable) return true;
                        return false;
                    };

                    const isInteractiveOrChildOfInteractive = (target) => {
                        let element = target;
                        while (element && element !== container) {
                            if (isInteractiveElement(element)) return true;
                            element = element.parentElement;
                        }
                        return false;
                    };

                    // Track drag state for manual panning
                    if (!container._bigDragState) {
                        container._bigDragState = { isDragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
                    }
                    const dragState = container._bigDragState;

                    const canvasForwardHandler = (e) => {
                        if (e._bigForwarded) return;

                        if (e.type === 'mousedown') {
                            if (isInteractiveOrChildOfInteractive(e.target)) {
                                dragState.isDragging = false;
                                return;
                            }
                            dragState.isDragging = true;
                            dragState.startX = e.clientX;
                            dragState.startY = e.clientY;
                            const canvas = app?.canvas || app?.graph?.list_of_graphcanvas?.[0];
                            if (canvas) {
                                dragState.offsetX = canvas.ds.offset[0];
                                dragState.offsetY = canvas.ds.offset[1];
                            }
                            e.preventDefault();
                            e.stopPropagation();
                        }

                        if (e.type === 'mousemove' && dragState.isDragging) {
                            const deltaX = e.clientX - dragState.startX;
                            const deltaY = e.clientY - dragState.startY;
                            // Divide by scale to match native ComfyUI drag behavior at any zoom level
                            const canvas = app?.canvas || app?.graph?.list_of_graphcanvas?.[0];
                            if (canvas) {
                                const scale = canvas.ds.scale || 1;
                                canvas.ds.offset[0] = dragState.offsetX + (deltaX / scale);
                                canvas.ds.offset[1] = dragState.offsetY + (deltaY / scale);
                                canvas.setDirty(true, true);
                            }
                            e.preventDefault();
                            e.stopPropagation();
                        }

                        if (e.type === 'mouseup' && dragState.isDragging) {
                            dragState.isDragging = false;
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    };

                    const wheelForwardHandler = (e) => {
                        if (e._bigForwarded) return;
                        if (isInteractiveOrChildOfInteractive(e.target)) return;
                        const canvas = document.querySelector('#graph-canvas') ||
                                      document.querySelector('canvas.litegraph') ||
                                      document.querySelector('.litegraph canvas');
                        if (canvas) {
                            e.preventDefault();
                            e.stopPropagation();
                            const newEvent = new WheelEvent('wheel', {
                                bubbles: true, cancelable: true, view: window,
                                clientX: e.clientX, clientY: e.clientY,
                                deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
                                ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey
                            });
                            newEvent._bigForwarded = true;
                            canvas.dispatchEvent(newEvent);
                        }
                    };

                    // Remove old listeners if exist
                    if (container._canvasForwardHandler) {
                        container.removeEventListener('mousedown', container._canvasForwardHandler, true);
                        document.removeEventListener('mousemove', container._canvasForwardHandler, true);
                        document.removeEventListener('mouseup', container._canvasForwardHandler, true);
                    }
                    if (container._wheelForwardHandler) {
                        container.removeEventListener('wheel', container._wheelForwardHandler, true);
                    }

                    container._canvasForwardHandler = canvasForwardHandler;
                    container._wheelForwardHandler = wheelForwardHandler;

                    container.addEventListener('mousedown', canvasForwardHandler, true);
                    document.addEventListener('mousemove', canvasForwardHandler, true);
                    document.addEventListener('mouseup', canvasForwardHandler, true);
                    container.addEventListener('wheel', wheelForwardHandler, true);

                    // Individual Generate buttons (preview state)
                    container.querySelectorAll(".instaraw-big-generate-single-btn").forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const promptIndex = parseInt(btn.dataset.index);

                            console.log(`[BIG] Individual generate clicked for prompt #${promptIndex}`);

                            // Get detected prompts
                            const detectedPrompts = getConnectedRPGData();
                            if (!detectedPrompts || promptIndex >= detectedPrompts.length) {
                                alert("Prompt not found!");
                                return;
                            }

                            const prompt = detectedPrompts[promptIndex];

                            // Get generation parameters
                            const genParams = getGenerationParameters();
                            if (!genParams) {
                                alert("Missing generation parameters!");
                                return;
                            }

                            // Check for multi-image mode
                            const isMultiImage = genParams.multi_image && genParams.provider === "wavespeed.ai";

                            // Check enable_img2img
                            const enableImg2Img = getBooleanValue("enable_img2img");

                            // Fetch images for this single prompt (use cached URLs, cycle based on promptIndex)
                            // Only fetch if enable_img2img is true
                            let inputImage = null, inputImage2 = null, inputImage3 = null, inputImage4 = null;

                            if (enableImg2Img) {
                                const fetchSingleImage = async (urls, idx) => {
                                    if (!urls || urls.length === 0) return null;
                                    const url = urls[idx % urls.length];
                                    return await fetchImageAsBase64(url);
                                };

                                console.log(`[BIG] Fetching images for single generate (promptIndex=${promptIndex})`);
                                inputImage = await fetchSingleImage(node._bigImageUrls, promptIndex);
                                inputImage2 = await fetchSingleImage(node._bigImage2Urls, promptIndex);
                                inputImage3 = await fetchSingleImage(node._bigImage3Urls, promptIndex);
                                inputImage4 = await fetchSingleImage(node._bigImage4Urls, promptIndex);
                            }

                            if (isMultiImage) {
                                // Multi-image mode: create 2 jobs for this prompt
                                console.log(`[BIG] 🎯 Multi-image single: generating 2 variations for prompt #${promptIndex}`);

                                node._bigJobs = [
                                    {
                                        id: 0,
                                        prompt_positive: prompt.positive,
                                        prompt_negative: prompt.negative,
                                        seed: prompt.seed,
                                        state: "pending",
                                        image_url: null,
                                        error: null,
                                        generation_time: 0,
                                        filename: null,
                                        input_image_b64: inputImage,
                                        input_image2_b64: inputImage2,
                                        input_image3_b64: inputImage3,
                                        input_image4_b64: inputImage4,
                                        is_pair: true,
                                        pair_with: 1,
                                        prompt_index: promptIndex,
                                        variation: 1,
                                    },
                                    {
                                        id: 1,
                                        prompt_positive: prompt.positive,
                                        prompt_negative: prompt.negative,
                                        seed: prompt.seed,
                                        state: "pending",
                                        image_url: null,
                                        error: null,
                                        generation_time: 0,
                                        filename: null,
                                        input_image_b64: inputImage,
                                        input_image2_b64: inputImage2,
                                        input_image3_b64: inputImage3,
                                        input_image4_b64: inputImage4,
                                        is_pair: true,
                                        pair_with: 0,
                                        prompt_index: promptIndex,
                                        variation: 2,
                                    }
                                ];

                                node._bigStats = {
                                    total: 2,
                                    completed: 0,
                                    success: 0,
                                    failed: 0,
                                    cached: 0,
                                };
                                node._bigStartTime = Date.now();
                                node._bigIsGenerating = true;

                                updateGeneratedBatchData();
                                renderUI();

                                // Generate paired images
                                await generateJobPair(0, 1, genParams);

                                // Finish up
                                node._bigIsGenerating = false;
                                updateGeneratedBatchData();
                                renderUI();

                                console.log("[BIG] ✅ Multi-image single generation complete (2 variations)!");
                            } else {
                                // Standard mode: 1 job
                                node._bigJobs = [{
                                    id: 0,
                                    prompt_positive: prompt.positive,
                                    prompt_negative: prompt.negative,
                                    seed: prompt.seed,
                                    state: "pending",
                                    image_url: null,
                                    error: null,
                                    generation_time: 0,
                                    filename: null,
                                    input_image_b64: inputImage,
                                    input_image2_b64: inputImage2,
                                    input_image3_b64: inputImage3,
                                    input_image4_b64: inputImage4,
                                }];

                                node._bigStats = {
                                    total: 1,
                                    completed: 0,
                                    success: 0,
                                    failed: 0,
                                    cached: 0,
                                };
                                node._bigStartTime = Date.now();
                                node._bigIsGenerating = true;

                                updateGeneratedBatchData();
                                renderUI();

                                // Generate single image
                                await generateSingleJob(0, genParams);

                                // Finish up
                                node._bigIsGenerating = false;
                                updateGeneratedBatchData();
                                renderUI();

                                console.log("[BIG] ✅ Single generation complete!");
                            }
                        };
                    });

                    // View image buttons and thumbnails
                    const clickableElements = container.querySelectorAll(".instaraw-big-view-image-btn, .instaraw-big-thumbnail-img");
                    clickableElements.forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const jobId = parseInt(btn.dataset.jobId);
                            openPhotoSwipe(jobId);
                        };
                    });

                    // Expand prompt buttons
                    container.querySelectorAll(".instaraw-big-expand-prompt-btn").forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const jobId = btn.dataset.jobId;
                            const expandedEl = container.querySelector(`.instaraw-big-prompt-expanded[data-job-id="${jobId}"]`);
                            if (expandedEl) {
                                const isExpanded = expandedEl.style.display !== "none";
                                expandedEl.style.display = isExpanded ? "none" : "block";
                                btn.textContent = isExpanded ? "📝" : "📝✕";
                                btn.title = isExpanded ? "Expand prompt" : "Collapse prompt";
                            }
                        };
                    });

                    // Copy seed buttons
                    container.querySelectorAll(".instaraw-big-copy-seed-btn").forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const seed = btn.dataset.seed;
                            if (!seed || seed === "N/A") return;

                            try {
                                await navigator.clipboard.writeText(seed);
                                const originalText = btn.textContent;
                                btn.textContent = "✅ Copied!";
                                setTimeout(() => {
                                    btn.textContent = originalText;
                                }, 1000);
                            } catch (error) {
                                console.error("[BIG] Failed to copy seed to clipboard:", error);
                                alert("Failed to copy to clipboard");
                            }
                        };
                    });

                    // Copy prompt buttons
                    container.querySelectorAll(".instaraw-big-copy-prompt-btn").forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const prompt = btn.dataset.prompt;
                            if (!prompt) return;

                            try {
                                await navigator.clipboard.writeText(prompt);
                                // Show success feedback
                                const originalText = btn.textContent;
                                btn.textContent = "✅ Copied!";
                                setTimeout(() => {
                                    btn.textContent = originalText;
                                }, 1000);
                            } catch (error) {
                                console.error("[BIG] Failed to copy to clipboard:", error);
                                alert("Failed to copy to clipboard");
                            }
                        };
                    });

                    // Favorite prompt buttons - communicate with RPG
                    container.querySelectorAll(".instaraw-big-favorite-prompt-btn").forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const prompt = btn.dataset.prompt;
                            const seed = btn.dataset.seed;
                            if (!prompt) return;

                            // Find connected RPG node
                            const rpgNode = findConnectedRPG();
                            if (!rpgNode) {
                                alert("No RPG node connected. Connect a Reality Prompt Generator to add favorites.");
                                return;
                            }

                            // Send favorite request to RPG
                            try {
                                // Use custom event to communicate with RPG
                                const event = new CustomEvent('instaraw-rpg-add-favorite', {
                                    detail: {
                                        prompt: prompt,
                                        seed: seed,
                                        sourceNodeId: node.id,
                                    }
                                });
                                document.dispatchEvent(event);

                                // Show success feedback
                                const originalText = btn.textContent;
                                btn.textContent = "⭐ Added!";
                                btn.disabled = true;
                                setTimeout(() => {
                                    btn.textContent = originalText;
                                    btn.disabled = false;
                                }, 1500);
                            } catch (error) {
                                console.error("[BIG] Failed to add favorite:", error);
                                alert("Failed to add favorite");
                            }
                        };
                    });

                    // Helper to find connected RPG node
                    const findConnectedRPG = () => {
                        const promptInput = node.inputs?.find(i => i.name === "prompt_list_positive");
                        if (!promptInput || !promptInput.link) return null;

                        const link = app.graph.links[promptInput.link];
                        if (!link) return null;

                        const sourceNode = app.graph.getNodeById(link.origin_id);
                        // Check for node type (INSTARAW_RealityPromptGenerator)
                        if (sourceNode?.type === "INSTARAW_RealityPromptGenerator") {
                            return sourceNode;
                        }
                        return null;
                    };

                    // Stop button - RPG-style smooth cancellation
                    const stopBtn = container.querySelector(".instaraw-big-stop-btn");
                    if (stopBtn) {
                        stopBtn.onclick = () => {
                            console.log("[BIG] 🛑 Stop button clicked - aborting generation");

                            // 1. Abort any in-flight requests immediately
                            if (node._bigAbortController) {
                                node._bigAbortController.abort();
                                console.log("[BIG] AbortController.abort() called");
                            }

                            // 2. Mark generation as stopped
                            node._bigIsGenerating = false;
                            node._bigAbortController = null;

                            // 3. Immediately mark all pending/generating jobs as cancelled
                            let cancelledCount = 0;
                            node._bigJobs.forEach(job => {
                                if (job.state === "pending" || job.state === "generating") {
                                    job.state = "cancelled";
                                    job.error = "Cancelled by user";
                                    cancelledCount++;
                                }
                            });
                            console.log(`[BIG] Marked ${cancelledCount} jobs as cancelled`);

                            // 4. Recalculate stats and update UI immediately
                            updateStats();
                            updateGeneratedBatchData();
                            updateGeneratedBatchData();
                            stopPolling();
                            renderUI();

                            console.log("[BIG] ✅ Generation stopped cleanly");
                        };
                    }

                    // 2X Mode toggle checkbox
                    const toggle2xCheckbox = container.querySelector(".instaraw-big-2x-checkbox");
                    if (toggle2xCheckbox) {
                        toggle2xCheckbox.onchange = (e) => {
                            const enabled = e.target.checked;
                            console.log(`[BIG] 2X Mode toggled: ${enabled}`);
                            toggleMultiImageMode(enabled);
                            // Re-render to update the UI badges and calculations
                            renderUI();
                        };
                    }

                    // Retry failed button - actually regenerate all failed jobs
                    const retryFailedBtn = container.querySelector(".instaraw-big-retry-failed-btn");
                    if (retryFailedBtn) {
                        retryFailedBtn.onclick = async () => {
                            // Find all failed jobs
                            const failedJobs = node._bigJobs.filter(j => j.state === JobState.FAILED);
                            if (failedJobs.length === 0) {
                                console.log("[BIG] No failed jobs to retry");
                                return;
                            }

                            console.log(`[BIG] Retrying ${failedJobs.length} failed jobs...`);

                            // Get generation parameters
                            const genParams = getGenerationParameters();
                            if (!genParams) {
                                alert("Missing generation parameters!");
                                return;
                            }

                            // Group failed jobs: pairs together, singles separate
                            const retryTasks = []; // Array of { type: 'pair'|'single', indices: [idx] or [idx1, idx2] }
                            const processedJobIds = new Set();

                            failedJobs.forEach(job => {
                                if (processedJobIds.has(job.id)) return;

                                const jobIndex = node._bigJobs.findIndex(j => j.id === job.id);
                                processedJobIds.add(job.id);

                                // Check if this job is part of a pair
                                if (job.is_pair && job.pair_with !== undefined) {
                                    const pairedJob = node._bigJobs.find(j => j.id === job.pair_with);
                                    if (pairedJob) {
                                        processedJobIds.add(pairedJob.id);
                                        const pairedJobIndex = node._bigJobs.findIndex(j => j.id === pairedJob.id);
                                        const idx1 = Math.min(jobIndex, pairedJobIndex);
                                        const idx2 = Math.max(jobIndex, pairedJobIndex);
                                        retryTasks.push({ type: 'pair', indices: [idx1, idx2] });
                                    } else {
                                        // Orphaned pair job - retry as single
                                        retryTasks.push({ type: 'single', indices: [jobIndex] });
                                    }
                                } else {
                                    retryTasks.push({ type: 'single', indices: [jobIndex] });
                                }
                            });

                            // Reset all failed jobs to pending
                            failedJobs.forEach(job => {
                                job.state = JobState.PENDING;
                                job.error = null;
                                job.attempts = 0;
                            });

                            // Also reset paired jobs that weren't failed but their partner was
                            retryTasks.forEach(task => {
                                if (task.type === 'pair') {
                                    task.indices.forEach(idx => {
                                        const job = node._bigJobs[idx];
                                        if (job) {
                                            job.state = JobState.PENDING;
                                            job.error = null;
                                            job.attempts = 0;
                                        }
                                    });
                                }
                            });

                            // Update stats
                            node._bigStats.failed = 0;
                            node._bigStats.completed -= failedJobs.length;
                            node._bigIsGenerating = true;

                            // Create AbortController for cancellation
                            node._bigAbortController = new AbortController();
                            const signal = node._bigAbortController.signal;

                            updateGeneratedBatchData();
                            renderUI();

                            // Process retry tasks with max_parallel limit
                            const maxParallel = genParams.max_parallel || 5;
                            // For pairs, each task processes 2 jobs, so halve effective parallelism
                            const hasPairs = retryTasks.some(t => t.type === 'pair');
                            const effectiveParallel = hasPairs ? Math.ceil(maxParallel / 2) : maxParallel;

                            let nextTaskIdx = 0;
                            const processNext = async () => {
                                while (nextTaskIdx < retryTasks.length && node._bigIsGenerating && !signal.aborted) {
                                    const task = retryTasks[nextTaskIdx++];
                                    try {
                                        if (task.type === 'pair') {
                                            await generateJobPair(task.indices[0], task.indices[1], genParams, signal);
                                        } else {
                                            await generateSingleJob(task.indices[0], genParams, signal);
                                        }
                                    } catch (e) {
                                        console.error(`[BIG] Retry task error:`, e);
                                    }
                                    if (nextTaskIdx < retryTasks.length && node._bigIsGenerating && !signal.aborted) {
                                        await new Promise(r => setTimeout(r, 222));
                                    }
                                }
                            };

                            // Start workers
                            const workers = [];
                            for (let i = 0; i < Math.min(effectiveParallel, retryTasks.length); i++) {
                                if (i > 0) await new Promise(r => setTimeout(r, 222));
                                if (!node._bigIsGenerating || signal.aborted) break;
                                workers.push(processNext());
                            }

                            await Promise.allSettled(workers);

                            // Finish
                            node._bigIsGenerating = false;
                            node._bigAbortController = null;
                            updateGeneratedBatchData();
                            renderUI();

                            console.log("[BIG] ✅ Retry complete!");
                        };
                    }

                    // Clear button
                    const clearBtn = container.querySelector(".instaraw-big-clear-btn");
                    if (clearBtn) {
                        clearBtn.onclick = () => {
                            node._bigJobs = [];
                            node._bigStats = { total: 0, completed: 0, success: 0, failed: 0, cached: 0 };
                            node._bigStartTime = null;
                            updateGeneratedBatchData(); // Clear both widget and properties
                            renderUI();
                        };
                    }

                    // Download All button
                    const downloadAllBtn = container.querySelector(".instaraw-big-download-all-btn");
                    if (downloadAllBtn) {
                        downloadAllBtn.onclick = async () => {
                            const jobsWithImages = node._bigJobs.filter(j =>
                                j.image_url && (j.state === JobState.SUCCESS || j.state === JobState.CACHED)
                            );

                            if (jobsWithImages.length === 0) {
                                console.log("[BIG] No images to download");
                                return;
                            }

                            console.log(`[BIG] Downloading ${jobsWithImages.length} images...`);
                            downloadAllBtn.disabled = true;
                            downloadAllBtn.textContent = "⬇ Downloading...";

                            for (let i = 0; i < jobsWithImages.length; i++) {
                                const job = jobsWithImages[i];
                                try {
                                    // Use stored filename (from disk), fallback to generated name
                                    const filename = job.filename || `big_${job.id}_${Date.now()}.png`;

                                    // Handle base64 data URLs
                                    if (job.image_url.startsWith("data:")) {
                                        const response = await fetch(job.image_url);
                                        const blob = await response.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = filename;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    } else {
                                        // Handle regular URLs
                                        const response = await fetch(job.image_url);
                                        const blob = await response.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = filename;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }

                                    // Small delay between downloads to avoid browser blocking
                                    if (i < jobsWithImages.length - 1) {
                                        await new Promise(r => setTimeout(r, 200));
                                    }
                                } catch (e) {
                                    console.error(`[BIG] Failed to download image ${job.id}:`, e);
                                }
                            }

                            console.log("[BIG] Download complete");
                            downloadAllBtn.disabled = false;
                            downloadAllBtn.textContent = `⬇ Download All (${jobsWithImages.length})`;
                        };
                    }

                    // Generate All button (RPG-style UI generation)
                    const generateAllBtn = container.querySelector(".instaraw-big-generate-all-btn");
                    if (generateAllBtn) {
                        generateAllBtn.onclick = async () => {
                            console.log("[BIG] Generate All clicked");

                            // Get node parameters - use node.id directly as primary, widget as fallback
                            const nodeId = node._ni_widget?.value || String(node.id);
                            console.log("[BIG] Node ID:", nodeId, "node.id:", node.id, "widget:", node._ni_widget?.value);
                            if (!nodeId) {
                                alert("Node ID not found! Please reload the page.");
                                return;
                            }

                            // Find connected RPG node and read prompts
                            const promptData = getConnectedPromptData();
                            if (!promptData) {
                                alert("Cannot generate: No prompts found!\n\nMake sure:\n1. RPG node is connected to BIG\n2. Prompts are generated in RPG\n3. Workflow connections are valid");
                                return;
                            }

                            const { prompts_positive, prompts_negative, seeds } = promptData;
                            const numPrompts = prompts_positive.length;

                            if (numPrompts === 0) {
                                alert("No prompts to generate! Generate prompts in RPG first.");
                                return;
                            }

                            // Get generation parameters from node inputs
                            const genParams = getGenerationParameters();
                            if (!genParams) {
                                alert("Missing generation parameters! Ensure API key, provider, and model are connected.");
                                return;
                            }

                            // Calculate total images based on multi-image mode
                            const willUseMultiImage = genParams.multi_image && genParams.provider === "wavespeed.ai";
                            const totalImages = willUseMultiImage ? numPrompts * 2 : numPrompts;
                            const costPerImage = willUseMultiImage ? "$0.07" : "$0.14";
                            const totalCost = (totalImages * (willUseMultiImage ? 0.07 : 0.14)).toFixed(2);

                            // Confirm generation with cost info
                            const confirmMsg = willUseMultiImage
                                ? `Generate ${totalImages} images (${numPrompts} prompts × 2 variations)?\n\n⚡ Multi-image mode: ${costPerImage}/image\n💰 Estimated cost: $${totalCost}`
                                : `Generate ${totalImages} images?\n\n💰 Estimated cost: $${totalCost} (${costPerImage}/image)`;

                            if (!confirm(confirmMsg)) {
                                return;
                            }

                            // Check enable_img2img
                            const enableImg2Img = getBooleanValue("enable_img2img");

                            // Detect mode and fetch images if I2I AND enable_img2img is true
                            const imagesInfo = getConnectedImagesInfo();
                            // Override mode based on enable_img2img widget
                            const effectiveMode = enableImg2Img ? imagesInfo.mode : "txt2img";
                            node._bigMode = effectiveMode;
                            node._bigImageCount = enableImg2Img ? imagesInfo.imageCount : 0;
                            console.log(`[BIG] ========== GENERATION START ==========`);
                            console.log(`[BIG] enable_img2img: ${enableImg2Img}, Mode: ${effectiveMode}`);
                            console.log(`[BIG] Image count: ${node._bigImageCount}`);

                            // Helper to fetch all images from URL array to base64
                            const fetchAllImagesAsBase64 = async (urls, label) => {
                                const result = [];
                                if (!urls || urls.length === 0) return result;
                                console.log(`[BIG] Fetching ${urls.length} ${label} images...`);
                                for (let i = 0; i < urls.length; i++) {
                                    const url = urls[i];
                                    const b64 = await fetchImageAsBase64(url);
                                    if (b64) {
                                        result.push(b64);
                                    } else {
                                        console.error(`[BIG] ✗ Failed to fetch ${label}[${i}]`);
                                    }
                                }
                                return result;
                            };

                            // Only fetch images if enable_img2img is true
                            let imageBase64Array = [];
                            let image2Base64Array = [];
                            let image3Base64Array = [];
                            let image4Base64Array = [];

                            if (enableImg2Img) {
                                // Fetch images as base64 for I2I mode (images/image_1)
                                if (effectiveMode === "img2img" && imagesInfo.imageUrls.length > 0) {
                                    console.log(`[BIG] I2I mode - fetching primary images...`);
                                    imageBase64Array = await fetchAllImagesAsBase64(imagesInfo.imageUrls, "image_1");
                                    console.log(`[BIG] Fetched ${imageBase64Array.length}/${imagesInfo.imageUrls.length} primary images`);
                                }

                                // Fetch additional image inputs (images2, images3, images4)
                                image2Base64Array = await fetchAllImagesAsBase64(node._bigImage2Urls, "image_2");
                                image3Base64Array = await fetchAllImagesAsBase64(node._bigImage3Urls, "image_3");
                                image4Base64Array = await fetchAllImagesAsBase64(node._bigImage4Urls, "image_4");

                                console.log(`[BIG] Additional images - image_2: ${image2Base64Array.length}, image_3: ${image3Base64Array.length}, image_4: ${image4Base64Array.length}`);
                            } else {
                                console.log(`[BIG] T2I mode - enable_img2img is OFF, skipping image fetch`);
                            }

                            // Check for multi-image mode BEFORE creating jobs
                            // Multi-image mode: each prompt generates 2 images (variations)
                            const isMultiImage = genParams.multi_image && genParams.provider === "wavespeed.ai";

                            // Initialize jobs - in multi-image mode, create 2 jobs per prompt
                            if (isMultiImage) {
                                console.log(`[BIG] 🎯 MULTI-IMAGE MODE: Creating 2 jobs per prompt (${prompts_positive.length} prompts → ${prompts_positive.length * 2} images)`);
                                node._bigJobs = [];
                                let jobId = 0;

                                for (let promptIdx = 0; promptIdx < prompts_positive.length; promptIdx++) {
                                    const prompt = prompts_positive[promptIdx];
                                    const negPrompt = prompts_negative[promptIdx] || "";
                                    const seed = seeds[promptIdx] || -1;

                                    // Get input images for I2I mode (cycle through if fewer images than prompts)
                                    const getImageAtIdx = (arr, idx) => arr.length > 0 ? arr[idx % arr.length] : null;
                                    const inputImage = getImageAtIdx(imageBase64Array, promptIdx);
                                    const inputImage2 = getImageAtIdx(image2Base64Array, promptIdx);
                                    const inputImage3 = getImageAtIdx(image3Base64Array, promptIdx);
                                    const inputImage4 = getImageAtIdx(image4Base64Array, promptIdx);

                                    // Create 2 jobs for this prompt (will be generated in one API call)
                                    const job1Id = jobId++;
                                    const job2Id = jobId++;

                                    const job1 = {
                                        id: job1Id,
                                        prompt_positive: prompt,
                                        prompt_negative: negPrompt,
                                        seed: seed,
                                        state: "pending",
                                        image_url: null,
                                        error: null,
                                        generation_time: 0,
                                        filename: null,
                                        input_image_b64: inputImage,
                                        input_image2_b64: inputImage2,
                                        input_image3_b64: inputImage3,
                                        input_image4_b64: inputImage4,
                                        is_pair: true,
                                        pair_with: job2Id,
                                        prompt_index: promptIdx,
                                        variation: 1,
                                    };

                                    const job2 = {
                                        id: job2Id,
                                        prompt_positive: prompt,
                                        prompt_negative: negPrompt,
                                        seed: seed,
                                        state: "pending",
                                        image_url: null,
                                        error: null,
                                        generation_time: 0,
                                        filename: null,
                                        input_image_b64: inputImage,
                                        input_image2_b64: inputImage2,
                                        input_image3_b64: inputImage3,
                                        input_image4_b64: inputImage4,
                                        is_pair: true,
                                        pair_with: job1Id,
                                        prompt_index: promptIdx,
                                        variation: 2,
                                    };

                                    node._bigJobs.push(job1, job2);
                                }

                                console.log(`[BIG] Created ${node._bigJobs.length} jobs (${prompts_positive.length} prompts × 2 variations)`);
                            } else {
                                // Standard mode: 1 job per prompt
                                console.log(`[BIG] Creating ${prompts_positive.length} jobs...`);
                                node._bigJobs = prompts_positive.map((prompt, idx) => {
                                    // Helper to get image at index with cycling
                                    const getImageAtIdx = (arr, i) => arr.length > 0 ? arr[i % arr.length] : null;

                                    const job = {
                                        id: idx,
                                        prompt_positive: prompt,
                                        prompt_negative: prompts_negative[idx] || "",
                                        seed: seeds[idx] || -1,
                                        state: "pending",
                                        image_url: null,
                                        error: null,
                                        generation_time: 0,
                                        filename: null,
                                        input_image_b64: getImageAtIdx(imageBase64Array, idx),
                                        input_image2_b64: getImageAtIdx(image2Base64Array, idx),
                                        input_image3_b64: getImageAtIdx(image3Base64Array, idx),
                                        input_image4_b64: getImageAtIdx(image4Base64Array, idx),
                                    };

                                    return job;
                                });
                                console.log(`[BIG] ${node._bigJobs.length} jobs created`);
                            }

                            const totalJobs = node._bigJobs.length;
                            node._bigStats = {
                                total: totalJobs,
                                completed: 0,
                                success: 0,
                                failed: 0,
                                cached: 0,
                            };
                            node._bigStartTime = Date.now();
                            node._bigIsGenerating = true;

                            // Create AbortController for smooth cancellation (RPG pattern)
                            node._bigAbortController = new AbortController();
                            const signal = node._bigAbortController.signal;

                            // Save immediately so state survives tab switches during generation!
                            updateGeneratedBatchData();
                            renderUI();

                            // PARALLEL GENERATION with max_parallel limit
                            // Uses a semaphore pattern to limit concurrent API calls
                            const maxParallel = genParams.max_parallel || 5;
                            console.log(`[BIG] Starting generation of ${totalJobs} images (max ${maxParallel} concurrent)...`);

                            let nextJobIndex = 0;
                            let activeCount = 0;
                            const results = [];

                            // Worker function that processes jobs from the queue
                            const processNextJob = async () => {
                                while (nextJobIndex < totalJobs && node._bigIsGenerating && !signal.aborted) {
                                    // Multi-image mode: process 2 jobs at once (same prompt, 2 variations)
                                    if (isMultiImage && nextJobIndex + 1 < totalJobs) {
                                        const jobIndex1 = nextJobIndex++;
                                        const jobIndex2 = nextJobIndex++;
                                        activeCount += 2;

                                        console.log(`[BIG] 🎯 Starting paired jobs ${jobIndex1 + 1} & ${jobIndex2 + 1}/${totalJobs} (${activeCount} active)`);

                                        try {
                                            await generateJobPair(jobIndex1, jobIndex2, genParams, signal);
                                        } catch (e) {
                                            console.error(`[BIG] Paired jobs ${jobIndex1}+${jobIndex2} error:`, e);
                                        }

                                        activeCount -= 2;
                                        results.push(jobIndex1, jobIndex2);
                                    } else {
                                        // Single job mode (or last odd job in multi-image)
                                        const jobIndex = nextJobIndex++;
                                        activeCount++;

                                        console.log(`[BIG] Starting job ${jobIndex + 1}/${totalJobs} (${activeCount} active, max ${maxParallel})`);

                                        try {
                                            await generateSingleJob(jobIndex, genParams, signal);
                                        } catch (e) {
                                            console.error(`[BIG] Job ${jobIndex} error:`, e);
                                        }

                                        activeCount--;
                                        results.push(jobIndex);
                                    }

                                    // Small stagger between starting new jobs (222ms)
                                    if (nextJobIndex < totalJobs && node._bigIsGenerating && !signal.aborted) {
                                        await new Promise(resolve => setTimeout(resolve, 222));
                                    }
                                }
                            };

                            // Start up to max_parallel workers (halve for multi-image since each processes 2)
                            const effectiveParallel = isMultiImage ? Math.ceil(maxParallel / 2) : maxParallel;
                            const numPairs = isMultiImage ? Math.ceil(totalJobs / 2) : totalJobs;
                            const numWorkers = Math.min(effectiveParallel, numPairs);

                            console.log(`[BIG] 🚀 Parallel config: ${numWorkers} workers for ${numPairs} ${isMultiImage ? 'pairs' : 'jobs'} (max_parallel=${maxParallel})`);

                            const workers = [];
                            for (let i = 0; i < numWorkers; i++) {
                                // Stagger the initial workers by 222ms each
                                if (i > 0) {
                                    await new Promise(resolve => setTimeout(resolve, 222));
                                }
                                if (!node._bigIsGenerating || signal.aborted) break;
                                console.log(`[BIG] 🚀 Starting worker ${i + 1}/${numWorkers}`);
                                workers.push(processNextJob());
                            }

                            // Wait for all workers to complete
                            await Promise.allSettled(workers);

                            // Finish up
                            node._bigIsGenerating = false;
                            node._bigAbortController = null; // Clean up controller
                            updateGeneratedBatchData();
                            renderUI();

                            console.log(`[BIG] ✅ Generation complete! ${results.length}/${totalJobs} jobs processed`);
                        };
                    }

                    // Individual retry buttons (RPG-style: actually regenerate the image)
                    container.querySelectorAll(".instaraw-big-job-retry-btn").forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const jobId = parseInt(btn.dataset.jobId);
                            const jobIndex = node._bigJobs.findIndex(j => j.id === jobId);

                            if (jobIndex === -1) {
                                console.error("[BIG] Job not found:", jobId);
                                return;
                            }

                            const job = node._bigJobs[jobIndex];

                            // Check if this job is part of a pair (2X mode)
                            if (job.is_pair && job.pair_with !== undefined) {
                                const pairedJobIndex = node._bigJobs.findIndex(j => j.id === job.pair_with);
                                const pairedJob = pairedJobIndex !== -1 ? node._bigJobs[pairedJobIndex] : null;

                                if (pairedJob) {
                                    // Confirm retry for both jobs in the pair
                                    if (!confirm(`Retry generating both variations?\n(2X mode generates 2 images together)`)) {
                                        return;
                                    }

                                    // Get generation parameters
                                    const genParams = getGenerationParameters();
                                    if (!genParams) {
                                        alert("Missing generation parameters!");
                                        return;
                                    }

                                    // Reset both jobs
                                    job.state = "pending";
                                    job.error = null;
                                    pairedJob.state = "pending";
                                    pairedJob.error = null;
                                    renderUI();

                                    // Regenerate the pair together
                                    const idx1 = Math.min(jobIndex, pairedJobIndex);
                                    const idx2 = Math.max(jobIndex, pairedJobIndex);
                                    console.log(`[BIG] Retrying paired jobs ${idx1} & ${idx2}`);
                                    await generateJobPair(idx1, idx2, genParams);
                                    return;
                                }
                            }

                            // Single job retry (non-paired or orphaned)
                            if (!confirm(`Retry generating this image?`)) {
                                return;
                            }

                            // Get generation parameters
                            const genParams = getGenerationParameters();
                            if (!genParams) {
                                alert("Missing generation parameters!");
                                return;
                            }

                            // Reset job state
                            job.state = "pending";
                            job.error = null;
                            renderUI();

                            // Regenerate
                            console.log(`[BIG] Retrying job ${jobIndex}`);
                            await generateSingleJob(jobIndex, genParams);
                        };
                    });
                };

                // Add the widget to the node
                console.log("[BIG] Adding DOM widget to node");
                const widget = node.addDOMWidget("batch_gen_ui", "customtext", container, {
                    serialize: false,
                    hideOnZoom: false,
                });

                console.log("[BIG] Widget added:", widget);

                widget.computeSize = () => {
                    return [node.size[0], cachedHeight + 20];
                };

                // Store renderUI reference on node for hooks to use
                node._renderUI = renderUI;

                // Set up widget change callbacks to re-render UI reactively
                const multiImageWidget = node.widgets?.find(w => w.name === "multi_image");
                if (multiImageWidget) {
                    const originalCallback = multiImageWidget.callback;
                    multiImageWidget.callback = function(value) {
                        originalCallback?.call(this, value);
                        console.log("[BIG] multi_image changed:", value);
                        renderUI();
                    };
                }

                // DEFERRED INITIALIZATION - Prevent UI flash on workflow load
                // We delay the first render to allow onConfigure to run first (if loading from workflow)
                // This prevents the flash where idle state shows briefly before restored state
                node._pendingInitRender = true;

                // Show loading state immediately (prevents blank node)
                renderUI();

                // Actual content render after short delay - gives onConfigure a chance to run first
                setTimeout(() => {
                    // If onConfigure already ran, it set _bigInitialized and rendered
                    // So we only render here if we're a NEW node (not loading from workflow)
                    if (!node._bigInitialized) {
                        console.log("[BIG] Initial render (new node, no workflow data)");

                        // Check for image connections
                        const imagesInput = node.inputs?.find(input => input.name === "images");
                        if (imagesInput && imagesInput.link) {
                            const link = app.graph?.links?.[imagesInput.link];
                            if (link) {
                                const sourceNode = app.graph.getNodeById(link.origin_id);
                                if (sourceNode) {
                                    node._updateModeFromSource(sourceNode);
                                }
                            }
                        }
                        updateAdditionalImages();

                        node._bigInitialized = true;
                        renderUI();
                    }
                    node._pendingInitRender = false;
                }, 250); // Slightly longer than onConfigure's 200ms delay

                // Fallback for slow workflow loads
                setTimeout(() => {
                    if (!node._bigInitialized) {
                        console.log("[BIG] Fallback initialization (very slow load)");
                        node._bigInitialized = true;
                        renderUI();
                    }
                }, 600);

                console.log("[BIG] Node setup complete (render deferred)");
                return;
            };

            // === onConnectionsChange Hook (for reactive mode detection) ===
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function(side, slot, connect, link_info, output) {
                const result = onConnectionsChange?.apply(this, arguments);

                // Detect input connection changes (link_info can be null on workflow load)
                if (side === 1 && link_info) { // INPUT side
                    const imagesInputIndex = this.inputs?.findIndex(input => input.name === "images");
                    const providerInputIndex = this.inputs?.findIndex(input => input.name === "provider");

                    if (slot === imagesInputIndex) {
                        if (connect) {
                            // Connected - traverse to find source node and mode
                            const link = this.graph?.links?.[link_info.id];
                            if (link) {
                                const sourceNode = this.graph.getNodeById(link.origin_id);
                                if (sourceNode) {
                                    this._updateModeFromSource(sourceNode);
                                }
                            }
                        } else {
                            // Disconnected - clear mode
                            this._bigMode = "txt2img";
                            this._bigImageCount = 0;
                            this._bigImageUrls = [];
                        }
                    }
                }

                // Re-render when connections change
                if (this._renderUI) {
                    setTimeout(() => {
                        console.log(`[BIG] Re-rendering after connection change. Mode: ${this._bigMode}`);
                        this._renderUI();
                    }, 100);
                }
                return result;
            };

            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function(size) {
                onResize?.apply(this, arguments);
                if (this._updateCachedHeight) {
                    clearTimeout(this._resizeTimeout);
                    this._resizeTimeout = setTimeout(() => this._updateCachedHeight(), 50);
                }
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(data) {
                onConfigure?.apply(this, arguments);

                // DEBUG: Log what's happening during tab switch/workflow load
                const widgetValue = this.widgets?.find(w => w.name === "generated_batch_data")?.value;
                const propValue = this.properties?.big_jobs_data;
                // Try to get session key (need to access getSessionKey via closure)
                const sessionKey = this._getSessionKey ? this._getSessionKey() : `instaraw_big_session_default_${this.id}`;
                const sessionValue = sessionStorage.getItem(sessionKey);
                console.log("[BIG] onConfigure called:", {
                    hasData: !!data,
                    sessionValueLength: sessionValue?.length || 0,
                    widgetValueLength: widgetValue?.length || 0,
                    propValueLength: propValue?.length || 0,
                    currentJobsLength: this._bigJobs?.length || 0
                });

                // IMPORTANT: Restore state from session storage / properties / widget
                // Session storage survives tab switches (ComfyUI recreates nodes on tab switch!)
                setTimeout(() => {
                    console.log("[BIG] onConfigure: Restoring state...");

                    // Use unified restore function (checks: sessionStorage → properties → widget)
                    if (this._restoreFromWidget) {
                        this._restoreFromWidget();
                    }

                    // Mark as initialized so mode sync interval can start running
                    this._bigInitialized = true;
                    if (this._renderUI) this._renderUI();
                }, 200);
            };

            // === onRemoved Hook (Cleanup) ===
            const onRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                if (this._modeSyncInterval) {
                    clearInterval(this._modeSyncInterval);
                    this._modeSyncInterval = null;
                }
                if (this._heightSyncInterval) {
                    clearInterval(this._heightSyncInterval);
                    this._heightSyncInterval = null;
                }
                console.log(`[BIG] Cleaned up node ${this.id}`);
                onRemoved?.apply(this, arguments);
            };
        }
    },

    setup() {
        console.log("[BIG] Extension setup() called - loading CSS");
        // Add CSS (following RPG's progress-item styling exactly)
        const style = document.createElement("style");
        style.textContent = `
            /* === Container (RPG Style) === */
            .instaraw-big-container {
                background: #0d0f12;
                padding: 16px;
                border-radius: 4px;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                color: #f9fafb;
            }

            /* === Idle State === */
            .instaraw-big-idle {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
            }

            .instaraw-big-idle-icon {
                font-size: 48px;
                margin-bottom: 12px;
            }

            .instaraw-big-idle-text {
                font-size: 16px;
                font-weight: 600;
                color: #f9fafb;
                margin-bottom: 8px;
            }

            .instaraw-big-idle-hint {
                font-size: 12px;
                color: rgba(249, 250, 251, 0.5);
                max-width: 280px;
            }

            .instaraw-big-idle-mode-badges {
                display: flex;
                gap: 8px;
                margin: 8px 0;
                flex-wrap: wrap;
                justify-content: center;
            }

            .instaraw-big-idle-instructions {
                font-size: 12px;
                color: rgba(249, 250, 251, 0.5);
                max-width: 280px;
                margin-top: 8px;
            }

            .instaraw-big-preview-box {
                margin-top: 20px;
                padding: 12px 20px;
                background: rgba(99, 102, 241, 0.1);
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-radius: 6px;
                display: flex;
                align-items: center;
                gap: 10px;
                max-width: 400px;
            }

            .instaraw-big-preview-icon {
                font-size: 24px;
                line-height: 1;
            }

            .instaraw-big-preview-text {
                font-size: 14px;
                color: #f9fafb;
                line-height: 1.4;
            }

            .instaraw-big-preview-text strong {
                font-weight: 700;
                color: #818cf8;
            }

            /* === Preview State (prompts detected) === */
            .instaraw-big-preview {
                /* No extra background/border - container already styled */
            }

            .instaraw-big-preview-header {
                margin-top: 12px;
                margin-bottom: 12px;
                font-size: 13px;
                font-weight: 600;
                color: #e5e7eb;
            }

            .instaraw-big-preview-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 12px;
                max-height: 400px;
                overflow-y: auto;
            }

            .instaraw-big-preview-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }

            .instaraw-big-preview-item-more {
                padding: 8px 12px;
                text-align: center;
                font-size: 11px;
                color: #9ca3af;
                font-style: italic;
            }

            .instaraw-big-preview-prompt {
                flex: 1;
                font-size: 11px;
                color: #d1d5db;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .instaraw-big-generate-single-btn {
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid rgba(99, 102, 241, 0.4);
                background: rgba(99, 102, 241, 0.2);
                color: #818cf8;
                white-space: nowrap;
            }

            .instaraw-big-generate-single-btn:hover {
                background: rgba(99, 102, 241, 0.3);
                border-color: #818cf8;
            }

            .instaraw-big-preview-actions {
                margin-top: 12px;
            }

            /* === Buttons - Clean, Minimal, Instant === */
            .instaraw-big-btn-primary {
                width: 100%;
                background: #6366f1;
                color: #ffffff;
                border: none;
                padding: 12px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
            }

            .instaraw-big-btn-primary:hover {
                background: #4f46e5;
            }

            .instaraw-big-btn-primary:disabled {
                background: #374151;
                cursor: not-allowed;
                color: rgba(255, 255, 255, 0.4);
            }

            .instaraw-big-btn-secondary {
                flex: 1;
                background: rgba(255, 255, 255, 0.05);
                color: #9ca3af;
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                font-size: 11px;
            }

            .instaraw-big-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #e5e7eb;
            }

            .instaraw-big-btn-secondary:disabled {
                background: rgba(255, 255, 255, 0.02);
                cursor: not-allowed;
                color: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.04);
            }

            /* === Actions === */
            .instaraw-big-actions {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 12px;
            }

            .instaraw-big-actions-row {
                display: flex;
                gap: 6px;
            }

            /* === Generation Progress Section (RPG pattern) === */
            .instaraw-big-generation-progress {
                /* No extra padding - container already styled */
            }

            /* === Top Bar (RPG Style) === */
            .instaraw-big-topbar {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 12px;
            }

            .instaraw-big-mode-card-inner {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
            }

            .instaraw-big-mode-card-left {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .instaraw-big-mode-card-brand {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                flex-shrink: 0;
            }

            .instaraw-big-topbar-logo {
                width: 120px;
                height: auto;
                opacity: 0.85;
            }

            .instaraw-big-topbar-version {
                font-family: monospace;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.5);
                white-space: nowrap;
                margin-top: 2px;
            }

            .instaraw-big-mode-card {
                flex: 1 1 200px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(255, 255, 255, 0.03);
                border-radius: 4px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .instaraw-big-mode-indicator {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .instaraw-big-mode-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 14px;
                font-size: 12px;
                font-weight: 700;
                border-radius: 4px;
            }

            .instaraw-big-mode-txt2img {
                background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
                border: 2px solid #a78bfa;
                color: #ffffff;
            }

            .instaraw-big-mode-img2img {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border: 2px solid #60a5fa;
                color: #ffffff;
            }

            /* Multi-image mode badge (50% cost savings) */
            .instaraw-big-multi-image-badge {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border: 2px solid #34d399;
                color: #ffffff;
                font-size: 10px;
                padding: 4px 8px;
            }

            /* Warning badge when multi-image is enabled but provider is not Wavespeed */
            .instaraw-big-multi-image-warning {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                border: 2px solid #fbbf24;
                color: #ffffff;
                font-size: 9px;
                padding: 4px 8px;
            }

            /* Multi-image info banner */
            .instaraw-big-multi-image-banner {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 14px;
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%);
                border: 1px solid rgba(52, 211, 153, 0.4);
                border-radius: 6px;
                margin-bottom: 12px;
                font-size: 12px;
                color: #34d399;
            }

            .instaraw-big-multi-image-banner strong {
                color: #10b981;
            }

            .instaraw-big-cost-savings {
                font-weight: 600;
                color: #4ade80;
                background: rgba(74, 222, 128, 0.1);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
            }

            .instaraw-big-aspect-warning {
                background: rgba(245, 158, 11, 0.1);
                border: 1px solid rgba(245, 158, 11, 0.3);
                border-radius: 6px;
                padding: 8px 12px;
                margin-bottom: 12px;
                font-size: 11px;
                color: #fbbf24;
            }

            /* Model Warning (unsupported model) */
            .instaraw-big-model-warning {
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.4);
                border-radius: 6px;
                padding: 12px 14px;
                margin-bottom: 12px;
                font-size: 12px;
                color: #fca5a5;
                line-height: 1.5;
            }

            .instaraw-big-model-warning strong {
                color: #f87171;
            }

            .instaraw-big-model-warning small {
                color: rgba(252, 165, 165, 0.8);
            }

            /* 2X Mode Toggle */
            .instaraw-big-2x-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                color: #34d399;
                padding-top: 6px;
                user-select: none;
            }

            .instaraw-big-2x-toggle:hover {
                color: #4ade80;
            }

            .instaraw-big-2x-checkbox {
                width: 16px;
                height: 16px;
                accent-color: #10b981;
                cursor: pointer;
            }

            .instaraw-big-mode-source {
                font-size: 11px;
                color: rgba(249, 250, 251, 0.6);
                margin-top: 9px;
            }

            /* === Reference Images Preview (RPG Style) === */
            .instaraw-big-image-preview {
                background: rgba(99, 102, 241, 0.08);
                border: 1px solid rgba(99, 102, 241, 0.2);
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 12px;
            }

            .instaraw-big-image-preview-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 12px;
                font-weight: 500;
                color: #e5e7eb;
            }

            .instaraw-big-image-preview-header-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .instaraw-big-sync-ails-btn {
                background: rgba(99, 102, 241, 0.2);
                border: 1px solid rgba(99, 102, 241, 0.4);
                color: #818cf8;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 10px;
                cursor: pointer;
            }

            .instaraw-big-sync-ails-btn:hover {
                background: rgba(99, 102, 241, 0.3);
                border-color: #818cf8;
            }

            .instaraw-big-sync-ails-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .instaraw-big-image-preview-count {
                font-size: 11px;
                color: #818cf8;
                font-weight: 500;
            }

            /* Sync Badge & Button Styles */
            .instaraw-big-sync-badge {
                font-size: 10px;
                font-weight: 500;
                padding: 2px 6px;
                border-radius: 4px;
                white-space: nowrap;
            }

            .instaraw-big-sync-match {
                background: rgba(34, 197, 94, 0.15);
                color: #22c55e;
                border: 1px solid rgba(34, 197, 94, 0.3);
            }

            .instaraw-big-sync-mismatch {
                background: rgba(245, 158, 11, 0.15);
                color: #f59e0b;
                border: 1px solid rgba(245, 158, 11, 0.3);
            }

            .instaraw-big-sync-no-prompts {
                background: rgba(107, 114, 128, 0.15);
                color: #9ca3af;
                border: 1px solid rgba(107, 114, 128, 0.3);
            }

            .instaraw-big-sync-hint {
                font-size: 9px;
                color: #9ca3af;
                margin-left: 6px;
                font-style: italic;
            }

            /* Clean Reference Image Grid (Single AIL Input) */
            .instaraw-big-ref-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 8px 0;
            }

            .instaraw-big-ref-thumb {
                position: relative;
                width: 48px;
                height: 48px;
                border-radius: 4px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .instaraw-big-ref-thumb img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .instaraw-big-ref-index {
                position: absolute;
                bottom: 2px;
                right: 2px;
                font-size: 9px;
                font-weight: 600;
                color: white;
                background: rgba(0, 0, 0, 0.6);
                padding: 1px 4px;
                border-radius: 4px;
                line-height: 1;
            }

            .instaraw-big-ref-repeat-item {
                opacity: 0.7;
                border-style: dashed;
            }

            .instaraw-big-image-preview-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                gap: 8px;
                max-height: 180px;
                overflow-y: auto;
            }

            .instaraw-big-image-preview-item {
                position: relative;
                aspect-ratio: 1;
                border-radius: 4px;
                overflow: hidden;
                border: 2px solid #4b5563;
            }

            .instaraw-big-image-preview-item:hover {
                border-color: #6366f1;
            }

            .instaraw-big-image-preview-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .instaraw-big-image-preview-label {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0, 0, 0, 0.75);
                padding: 2px 4px;
                font-size: 10px;
                color: white;
                text-align: center;
                font-weight: 500;
            }

            .instaraw-big-image-preview-more {
                display: flex;
                align-items: center;
                justify-content: center;
                aspect-ratio: 1;
                border-radius: 4px;
                background: rgba(99, 102, 241, 0.2);
                border: 2px dashed #6366f1;
                color: #818cf8;
                font-size: 12px;
                font-weight: 600;
            }

            /* Optimal aspect ratio grid for all images */
            .instaraw-big-aspect-grid-container {
                background: #1a1a2e;
                border-radius: 8px;
                padding: 8px;
                border: 1px solid #374151;
            }

            .instaraw-big-aspect-grid {
                border-radius: 4px;
                overflow: hidden;
            }

            .instaraw-big-aspect-grid-item {
                aspect-ratio: 1;
                overflow: hidden;
                background: #0d0d1a;
            }

            .instaraw-big-aspect-grid-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .instaraw-big-aspect-grid-item:hover {
                opacity: 0.85;
            }

            .instaraw-big-aspect-label {
                background: #4f46e5;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                margin-left: 6px;
            }

            .instaraw-big-image-input-section {
                margin-bottom: 10px;
            }

            .instaraw-big-image-input-section:last-child {
                margin-bottom: 0;
            }

            .instaraw-big-image-input-label {
                font-size: 11px;
                color: #9ca3af;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .instaraw-big-image-input-count {
                color: #6b7280;
                font-size: 10px;
            }

            .instaraw-big-model-info {
                font-size: 11px;
                color: #9ca3af;
                font-weight: 500;
            }

            /* === KPI Row (RPG Style) === */
            .instaraw-big-kpi-row {
                display: flex;
                flex: 1 1 240px;
                gap: 8px;
                justify-content: flex-end;
                flex-wrap: wrap;
            }

            .instaraw-big-kpi {
                flex: 1 1 60px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(255, 255, 255, 0.02);
                border-radius: 4px;
                padding: 8px 10px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 2px;
                min-width: 60px;
            }

            .instaraw-big-kpi span {
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: rgba(249, 250, 251, 0.5);
                font-weight: 500;
            }

            .instaraw-big-kpi strong {
                font-size: 18px;
                font-weight: 700;
                color: #a78bfa;
                font-variant-numeric: tabular-nums;
            }

            .instaraw-big-kpi.success strong { color: #4ade80; }
            .instaraw-big-kpi.cached strong { color: #c084fc; }
            .instaraw-big-kpi.failed strong { color: #f87171; }

            .instaraw-big-progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .instaraw-big-progress-header h4 {
                margin: 0;
                font-size: 13px;
                font-weight: 600;
                color: #9ca3af;
            }

            /* === Stop Button (Minimal, Inline) === */
            .instaraw-big-stop-btn {
                background: rgba(239, 68, 68, 0.1);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.2);
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                font-size: 11px;
            }

            .instaraw-big-stop-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.4);
            }

            .instaraw-big-stat {
                font-size: 12px;
                font-weight: 600;
                color: #9ca3af;
            }

            .instaraw-big-stat.success { color: #4ade80; }
            .instaraw-big-stat.cached { color: #c084fc; }
            .instaraw-big-stat.failed { color: #f87171; }

            /* === Progress Items (no scroll - grows with content) === */
            .instaraw-big-progress-items {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .instaraw-big-progress-item {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                padding: 10px 12px;
                display: flex;
                gap: 12px;
                align-items: flex-start;
            }

            .instaraw-big-progress-item-content {
                flex: 1;
                min-width: 0;
            }

            .instaraw-big-progress-item.success {
                border-color: rgba(34, 197, 94, 0.4);
                background: rgba(34, 197, 94, 0.08);
            }

            .instaraw-big-progress-item.error {
                border-color: rgba(239, 68, 68, 0.4);
                background: rgba(239, 68, 68, 0.08);
            }

            .instaraw-big-progress-item.in-progress {
                border-color: rgba(99, 102, 241, 0.5);
                background: rgba(99, 102, 241, 0.1);
            }

            .instaraw-big-progress-item.retrying {
                border-color: rgba(251, 191, 36, 0.5);
                background: rgba(251, 191, 36, 0.1);
            }

            .instaraw-big-progress-item.cached {
                border-color: rgba(168, 85, 247, 0.4);
                background: rgba(168, 85, 247, 0.08);
            }

            .instaraw-big-progress-item.cancelled {
                border-color: rgba(156, 163, 175, 0.3);
                background: rgba(156, 163, 175, 0.05);
                opacity: 0.6;
            }

            .instaraw-big-progress-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                gap: 8px;
            }

            .instaraw-big-progress-item-label {
                font-size: 11px;
                font-weight: 500;
                color: #d1d5db;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            /* Pair badge for multi-image mode */
            .instaraw-big-pair-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 1px 5px;
                font-size: 9px;
                font-weight: 700;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border: 1px solid #34d399;
                border-radius: 3px;
                color: #fff;
                flex-shrink: 0;
            }

            /* Pair group container for multi-image mode */
            .instaraw-big-pair-group {
                background: rgba(16, 185, 129, 0.05);
                border: 1px solid rgba(52, 211, 153, 0.2);
                border-radius: 8px;
                padding: 8px;
                margin-bottom: 8px;
            }

            .instaraw-big-pair-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px 8px 8px;
                border-bottom: 1px solid rgba(52, 211, 153, 0.15);
                margin-bottom: 8px;
            }

            .instaraw-big-pair-label {
                font-size: 11px;
                font-weight: 600;
                color: #34d399;
            }

            .instaraw-big-pair-savings {
                font-size: 9px;
                color: #4ade80;
                background: rgba(74, 222, 128, 0.1);
                padding: 2px 6px;
                border-radius: 3px;
            }

            .instaraw-big-pair-items {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .instaraw-big-pair-items .instaraw-big-progress-item {
                margin-bottom: 0;
            }

            .instaraw-big-progress-item-status {
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 4px;
                font-weight: 600;
                white-space: nowrap;
            }

            .instaraw-big-progress-item-status.pending {
                background: rgba(156, 163, 175, 0.15);
                color: #6b7280;
            }

            .instaraw-big-progress-item-status.in-progress {
                background: rgba(99, 102, 241, 0.2);
                color: #818cf8;
            }

            .instaraw-big-progress-item-status.success {
                background: rgba(34, 197, 94, 0.3);
                color: #22c55e;
            }

            .instaraw-big-progress-item-status.error {
                background: rgba(239, 68, 68, 0.3);
                color: #ef4444;
            }

            .instaraw-big-progress-item-status.retrying {
                background: rgba(251, 191, 36, 0.2);
                color: #fbbf24;
            }

            .instaraw-big-progress-item-status.cached {
                background: rgba(168, 85, 247, 0.2);
                color: #a78bfa;
            }

            .instaraw-big-progress-item-status.cancelled {
                background: rgba(156, 163, 175, 0.15);
                color: #9ca3af;
            }

            .instaraw-big-progress-item-bar {
                width: 100%;
                height: 4px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 4px;
                overflow: hidden;
                margin-top: 10px;
                position: relative;
            }

            .instaraw-big-progress-item-fill {
                height: 100%;
                background: #6366f1;
                position: relative;
                overflow: hidden;
                border-radius: 4px;
            }

            .instaraw-big-progress-item-fill.animating {
                background: linear-gradient(90deg, #6366f1, #818cf8, #6366f1);
                background-size: 200% 100%;
                animation: instaraw-big-progress-shimmer 1.5s linear infinite;
            }

            @keyframes instaraw-big-progress-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .instaraw-big-progress-item-message {
                font-size: 10px;
                color: #f87171;
                margin-top: 4px;
                padding: 4px 6px;
                background: rgba(239, 68, 68, 0.1);
                border-radius: 3px;
            }

            .instaraw-big-progress-item-message.retry-message {
                color: #fbbf24;
                background: rgba(251, 191, 36, 0.15);
                border-left: 2px solid #fbbf24;
            }

            .instaraw-big-progress-item-message.error-message {
                color: #f87171;
                background: rgba(239, 68, 68, 0.15);
                border-left: 2px solid #ef4444;
            }

            .instaraw-big-progress-item-thumbnail {
                flex-shrink: 0;
                border-radius: 4px;
                overflow: hidden;
                border: 2px solid rgba(255, 255, 255, 0.1);
                background: rgba(0, 0, 0, 0.3);
                width: 64px;
                height: 64px;
                display: flex;
                align-items: center;
                justify-content: center;
                image-rendering: -webkit-optimize-contrast;
                image-rendering: crisp-edges;
            }

            .instaraw-big-progress-item-thumbnail:not(.placeholder) {
                cursor: pointer;
            }

            .instaraw-big-progress-item-thumbnail:not(.placeholder):hover {
                border-color: #6366f1;
            }

            .instaraw-big-progress-item-thumbnail.placeholder {
                cursor: default;
                background: rgba(0, 0, 0, 0.5);
            }

            .instaraw-big-thumbnail-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .instaraw-big-thumbnail-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .instaraw-big-thumbnail-empty {
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.2);
            }

            .instaraw-big-view-image-btn {
                display: none; /* Hidden - click thumbnail instead */
            }

            .instaraw-big-job-retry-btn {
                background: rgba(251, 191, 36, 0.2);
                border: 1px solid rgba(251, 191, 36, 0.4);
                color: #fbbf24;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            }

            .instaraw-big-job-retry-btn:hover {
                background: rgba(251, 191, 36, 0.3);
            }

            .instaraw-big-job-retry-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            /* Expand prompt button */
            .instaraw-big-expand-prompt-btn {
                background: rgba(139, 92, 246, 0.2);
                border: 1px solid rgba(139, 92, 246, 0.4);
                color: #a78bfa;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
                margin-right: 4px;
            }
            .instaraw-big-expand-prompt-btn:hover {
                background: rgba(139, 92, 246, 0.3);
            }

            /* Expanded prompt section */
            .instaraw-big-prompt-expanded {
                margin-top: 8px;
                padding: 10px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .instaraw-big-prompt-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                flex-wrap: wrap;
                gap: 6px;
            }
            .instaraw-big-prompt-meta {
                font-size: 11px;
                color: #a0a0a0;
            }
            .instaraw-big-prompt-actions {
                display: flex;
                gap: 6px;
            }
            .instaraw-big-copy-seed-btn,
            .instaraw-big-copy-prompt-btn,
            .instaraw-big-favorite-prompt-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e0e0e0;
                padding: 3px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.15s ease;
            }
            .instaraw-big-copy-seed-btn:hover {
                background: rgba(168, 85, 247, 0.3);
                border-color: rgba(168, 85, 247, 0.5);
                color: #c4b5fd;
            }
            .instaraw-big-copy-prompt-btn:hover {
                background: rgba(59, 130, 246, 0.3);
                border-color: rgba(59, 130, 246, 0.5);
                color: #93c5fd;
            }
            .instaraw-big-favorite-prompt-btn:hover {
                background: rgba(251, 191, 36, 0.3);
                border-color: rgba(251, 191, 36, 0.5);
                color: #fcd34d;
            }
            .instaraw-big-copy-seed-btn:disabled,
            .instaraw-big-copy-prompt-btn:disabled,
            .instaraw-big-favorite-prompt-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .instaraw-big-prompt-text {
                font-size: 12px;
                color: #e0e0e0;
                line-height: 1.5;
                white-space: pre-wrap;
                word-break: break-word;
            }

            /* Old button styles removed - using new btn-primary, btn-secondary, btn-danger classes */

            .instaraw-big-retry-failed-btn:hover:not(:disabled) {
                background: rgba(251, 191, 36, 0.15);
                border-color: rgba(251, 191, 36, 0.4);
            }

            /* PhotoSwipe instant animations override */
            .pswp--open,
            .pswp--closing,
            .pswp__bg,
            .pswp__container,
            .pswp__img,
            .pswp__zoom-wrap {
                transition: none !important;
                animation: none !important;
            }

            /* PhotoSwipe caption styles */
            .pswp-caption-content {
                text-align: left;
                padding: 10px;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 8px;
                max-width: 400px;
            }
            .pswp-caption-header {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #a0a0a0;
            }
            .pswp-caption-prompt {
                font-size: 13px;
                line-height: 1.5;
                color: #e0e0e0;
                white-space: pre-wrap;
                word-break: break-word;
                max-height: 150px;
                overflow-y: auto;
            }
            .pswp-caption-actions {
                display: flex;
                gap: 8px;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            .pswp-copy-btn,
            .pswp-favorite-btn {
                padding: 6px 12px;
                font-size: 12px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.1);
                color: #e0e0e0;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .pswp-copy-btn:hover {
                background: rgba(59, 130, 246, 0.3);
                border-color: rgba(59, 130, 246, 0.5);
                color: #93c5fd;
            }
            .pswp-favorite-btn:hover {
                background: rgba(251, 191, 36, 0.3);
                border-color: rgba(251, 191, 36, 0.5);
                color: #fcd34d;
            }
            /* Dynamic caption plugin overrides */
            .pswp__dynamic-caption {
                color: #e0e0e0;
            }
            .pswp__dynamic-caption--aside {
                max-width: 400px;
            }
        `;
        document.head.appendChild(style);
    },
});
