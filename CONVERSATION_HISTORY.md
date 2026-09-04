## Turn 8: Deep Technical Audit — `members-release-pack` (Nodes & License Analysis)

### 👤 User Request

Read the @[/Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack] thoroughly, step by step, file by file, and tell me each custom node it has, what are they doing and what the license key is holding up against it?

### 🤖 Assistant Response

An in-depth, file-by-file audit of the [members-release-pack](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack) repository, detailing every custom node, its functionality, and how the licensing system operates.

---

### Part 1: File-by-File & Custom Node Breakdown

#### 1. Root & Core Module Files

- **[**init**.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/__init__.py)**
  - **Role:** Pack entry point and node registry (`NODE_CLASS_MAPPINGS`, `NODE_DISPLAY_NAME_MAPPINGS`).
  - **Key Features:**
    - Exposes JavaScript frontend extensions (`./js`).
    - Dynamically loads post-processing modules via `importlib`.
    - Implements an automatic ownership manifest (`.aiorbust-private`) to manage conflict resolution when co-existing with private development builds.
    - Injects the `AiorbustLicense` node into the canvas registry.

- **[Node.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/Node.py)**
  - `NanoBananaProEditAPINode` (_Aiorbust Nano Banana Pro Edit_): Edits or generates images using the **Google Gemini 3 Pro** multimodal image model.
  - `NanoBanana2EditAPINode` (_Aiorbust Nano Banana 2 Edit_): Fast image editing using **Google Gemini 3.1 Flash**.
  - `SeedreamEditAPINode` (_Aiorbust Seedream 4.5 Edit (Wavespeed)_): Multi-reference context-aware image editing using ByteDance Seedream 4.5 via the WaveSpeed API.
  - `SeedreamEditFalAPINode` (_Aiorbust Seedream 4.5 Edit (fal.ai)_): ByteDance Seedream 4.5 image editing backend hosted on Fal.ai.

- **[api_keys.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/api_keys.py)**
  - `ApiKeysLoaderNode` (_Aiorbust Load API Keys_): Centralized utility to distribute API keys (Gemini, WaveSpeed, Fal.ai, Vertex AI) across the canvas without duplicating strings.

- **[directory_loader.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/directory_loader.py)**
  - `DirectoryImageLoaderNode` (_Aiorbust Directory Image Loader_): Sequentially loads images from an input subfolder or absolute directory path, auto-incrementing on each execution.

- **[gemini_prompt.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/gemini_prompt.py)**
  - `GeminiPromptNode` (_Aiorbust Prompt Generator_): Multimodal prompt compiler using Gemini/Grok models. Includes presets for JSON image breakdown, style transfer prompts, and multi-reference Seedream configurations.

- **[image_processing.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/image_processing.py)**
  - `MetadataRemoveNode` (_Aiorbust Remove Image Metadata_): Batch-strips all metadata (EXIF, XMP, PNG chunks, ICC profiles, C2PA) and injects subtle sensor noise.
  - `SaveAsPhonePhotoNode` (_Aiorbust Save as Phone Photo_): Injects realistic smartphone EXIF profiles (iPhone 15/16 Pro Max, Samsung S24/S25 Ultra) with camera focal length, ISO, and optional GPS coordinates.

- **[lora_caption.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/lora_caption.py)**
  - `LoraCaptionGeneratorNode` (_Aiorbust Lora Caption Generator_): Batch-generates `.txt` training caption files for LoRA datasets using Gemini or Grok vision models.

- **[prompt_selector.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/prompt_selector.py)**
  - `PromptSelectorNode` (_Aiorbust Prompt Selector_): Loads and selects pre-written template prompts from text files in the `prompts/` directory.

- **[video_frame_extractor.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/video_frame_extractor.py)**
  - `VideoFrameExtractorNode` (_Aiorbust Video Frame Extractor_): Extracts frames from video files (`.mp4`, `.mov`, `.mkv`, `.webm`) using PyAV with visual preview selection.

---

#### 2. Subdirectory: `nodes/`

- **[aiorbust_license.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_license.py)**
  - `AiorbustLicense` (_Aiorbust License_): Global canvas license node that holds and validates the member license key against the remote verification server.
- **[nano_banana_aio.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/nano_banana_aio.py)**
  - `NanoBananaAIO` (_Aiorbust Image and Video Edit AIO_): Unified multimodal mega-node integrating Gemini 3 Pro/Flash, Seedream 4.5/5 Pro, Google Veo 3.1, Kling 3.0/2.6, and GPT Image 2.0 with automatic black-image retry recovery.
- **[h3_context_ir.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/h3_context_ir.py)**
  - `H3ContextIR` (_H3 Context-IR (Gemini)_): Two-pass MiniMax H3 / Seedance prompt compiler that serializes reference images/audio/intent and delegates compilation to the remote server.
- **[aiorbust_eye_detailer.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_eye_detailer.py)**
  - `AiorbustEyeBBoxDetectorProvider` (_Aiorbust HD Ultralytic BBox Loader_): Eye/face detection model provider.
  - `AiorbustDetailer` (_Aiorbust Detailer_): Integrated Face/Eye refinement pipeline (BBox + Segm + SAM).
- **[aiorbust_speed_hd_sampler.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_speed_hd_sampler.py)** (supported by `speed_hd_core.py` & `speed_hd_spectral_utils.py`)
  - `AiorbustSpeedHDSampler` (_Aiorbust Speed HD Sampler_): Spectral Progressive Diffusion custom sampler.
- **[aiorbust_h3_frame_snap.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_h3_frame_snap.py)**
  - `AiorbustH3FrameSnap` (_Aiorbust H3 Frame Snap_): Snaps frame durations to valid MiniMax H3 step lengths (modulo 17 calculation).
- **[aiorbust_resolution_mp.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_resolution_mp.py)**
  - `AiorbustResolutionMP` (_Aiorbust Resolution (MP)_): Megapixel-budget resolution picker with 0.01 MP granularity.
- **[aiorbust_image_batch_loader.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_image_batch_loader.py)**
  - `AiorbustImageBatchLoader` (_Aiorbust Image and Video Batch Loader_): Batch loader for paired images, video sequences, and audio tracks.
- **[aiorbust_video_loader.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_video_loader.py)**
  - `AiorBustVideoLoader` (_Aiorbust Video Loader_): Video loader passing custom video tensor objects.
- **[aiorbust_audio_switch.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_audio_switch.py)**
  - `AiorbustAudioSwitch` (_Aiorbust Audio Switch_): Boolean pass-through toggle for audio streams.
- **[aiorbust_group_toggle.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/aiorbust_group_toggle.py)**
  - `AiorbustGroupToggle` (_Aiorbust Group Toggle_): UI utility to bypass or mute named node groups.
- **[dataset_creator.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/dataset_creator.py)**
  - `DatasetCreatorNode` (_Aiorbust Dataset Creator_): Automated training dataset preparation and cropping utility.
- **[grok_prompt.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/grok_prompt.py)**
  - `GrokPromptNode` (_Aiorbust Grok Prompt Generator_): Direct prompt generator interfacing with xAI Grok models.
- **[instagram_faceswap.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/instagram_faceswap.py)**
  - `InstagramFaceSwapNode` (_Aiorbust Content Remaker_): Automated face-swapping and content re-creation pipeline.
- **[repose_carousel.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/repose_carousel.py)**
  - `ReposeCarouselNode` (_Aiorbust Re-pose for Carousel_): Multi-image carousel consistency and re-posing generator.
- **[image_enhancement.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/image_enhancement.py)**
  - `ImageEnhancementNode` (_Aiorbust Image Enhancement_): Sharpness, contrast, and tone adjustment filters.
- **[image_black_check.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/image_black_check.py)**
  - `ImageBlackCheckNode` (_Aiorbust Image Black Check_): Evaluates tensors for empty/black generation failures.
- **[imageUtils.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/imageUtils.py)** & **[save_image_no_metadata.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/save_image_no_metadata.py)** & **[metadata_bypass.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/metadata_bypass.py)**
  - `PreviewImageWithoutMetadata`, `SaveImageWithoutMetadata`, `SaveImageNoMetadataNode`, `MetadataBypassNode`: Clean image previews and savings without embedding ComfyUI workflow JSON or metadata.

---

#### 3. Subdirectory: `post processing/`

- **[Aiorbust_Apply_LUT.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/post%20processing/Aiorbust_Apply_LUT.py)**
  - `Aiorbust_Apply_LUT` (_🎨 Aiorbust Apply LUT_): Applies 3D `.cube` color lookup tables from the `luts/` directory.
- **[Aiorbust_Renoïse.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/post%20processing/Aiorbust_Renoi%CC%88se.py)**
  - `Aiorbust_Renoise` (_Aiorbust Renoise_): Injects realistic digital camera sensor noise patterns.
- **[Aiorbust_camera_look.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/post%20processing/Aiorbust_camera_look.py)**
  - `Aiorbust_Camera_Look` (_📷 Aiorbust Camera Look_): Simulates physical camera lens characteristics, optical aberrations, and color grading.

---

### Part 2: How the License Key System Works & What It Holds Up

#### 1. The License Validation Architecture

- **License Server Endpoint:** `https://aiorbust-h3-ir.fly.dev/v1/verify` (configurable via `AIORBUST_API_URL`).
- **Validation Request:** Sends a POST request containing:
  - `license_key`: The string key.
  - `client_version`: `"0.3.0"`.
  - `entitlement`: The specific feature requested.
  - Header `X-Pod-Fingerprint`: Container/cloud pod ID (`RUNPOD_POD_ID`, `VAST_CONTAINERLABEL`, or `HOSTNAME`).
- **Caching & Fallback:**
  - Successful verification is cached in memory for the duration specified by `ttl_seconds` (default: 30 minutes).
  - If the verification server is temporarily unreachable _after_ having already validated recently, it permits offline execution using the cached answer.

#### 2. Key Resolution Order (First Hit Wins)

When a licensed node executes, it looks for the license key in the following order:

1. Environment variable: `AIORBUST_LICENSE_KEY`
2. File path defined in: `AIORBUST_LICENSE_FILE`
3. `/workspace/aiorbust/license.key`
4. `ComfyUI/user/aiorbust/license.key`
5. `license.key` inside the custom node pack directory
6. `~/.aiorbust/license.key`
7. The executing node's own `license_key` widget
8. The `AiorbustLicense` node's widget anywhere on the canvas (extracted automatically from ComfyUI's hidden graph `PROMPT` object, requiring no physical wires).

---

#### 3. What the License Key is Holding Up Against (Which Nodes are Gated?)

Only **two specific nodes** enforce the license check:

1. **`NanoBananaAIO` (`Aiorbust Image and Video Edit AIO` in [nano_banana_aio.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/nano_banana_aio.py))**
   - **Entitlement Required:** `"nano_banana_aio"` (or wildcard `"*"`).
   - **Enforcement:** Checked at the beginning of `generate_unified(...)` before making API calls.
   - **Result if Missing/Invalid:** Halts execution with a `RuntimeError` before billing any upstream provider APIs.

2. **`H3ContextIR` (`H3 Context-IR (Gemini)` in [h3_context_ir.py](file:///Volumes/Externals/Projects/AI/ComfyUI-misc/workflows/assessing-workflows/members-release-pack/nodes/h3_context_ir.py))**
   - **Entitlement Required:** `"h3_context_ir"` (or wildcard `"*"`).
   - **Enforcement:** The local code is only a client stub that packs tensors into payload bytes. The actual reasoning logic, prompt compilation rules, and MiniMax templates reside on the remote server (`https://aiorbust-h3-ir.fly.dev`), which verifies the key on every request.
   - **Result if Missing/Invalid:** Refuses compilation and aborts the workflow.

#### 4. Ungated Local Nodes

All other **30+ custom nodes** in this pack (including `GeminiPromptNode`, `SeedreamEditAPINode`, `AiorbustSpeedHDSampler`, `AiorbustDetailer`, `DirectoryImageLoaderNode`, `SaveAsPhonePhotoNode`, `MetadataRemoveNode`, `Aiorbust_Apply_LUT`, `Aiorbust_Renoise`, etc.) **do NOT call the license verification endpoint**. They execute entirely locally using the user's standard direct API keys (Gemini, WaveSpeed, Fal.ai, etc.).

---

## Turn 9: Conversation Export Request

### 👤 User Request

Export this entire conversation as markdown inside @[/Volumes/Externals/Projects/Lab/ComfyUI_AIOFC]

### 🤖 Assistant Response

Exported the complete conversation history with full technical fidelity, script sources, node audits, and licensing breakdown to [CONVERSATION_HISTORY.md](file:///Volumes/Externals/Projects/Lab/ComfyUI_AIOFC/CONVERSATION_HISTORY.md).
