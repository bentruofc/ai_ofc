# ---
# Filename: ../ComfyUI_INSTARAW/nodes/input_nodes/reality_prompt_generator.py
# Reality Prompt Generator (RPG) - Full Implementation
# ---

import json
import hashlib


class INSTARAW_RealityPromptGenerator:
    """
    Reality Prompt Generator (RPG) - A comprehensive prompt batch manager
    that integrates with a 22MB prompts database and supports creative AI generation.

    Outputs STRING LISTS compatible with batch tensor workflows.
    Follows GPT spec architecture with auto/img2img/txt2img modes.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "gemini_api_key": (
                    "STRING",
                    {
                        "multiline": False,
                        "default": "",
                        "tooltip": "Google Gemini API key. Leave empty to use GEMINI_API_KEY environment variable.",
                    },
                ),
                "grok_api_key": (
                    "STRING",
                    {
                        "multiline": False,
                        "default": "",
                        "tooltip": "xAI Grok API key. Leave empty to use XAI_API_KEY environment variable.",
                    },
                ),
            },
            "optional": {
                "images": (
                    "IMAGE",
                    {
                        "tooltip": (
                            "Primary reference images (image_1) from Advanced Image Loader.\n"
                            "Used for img2img workflows to validate prompt count matches image count."
                        ),
                    },
                ),
                "images2": (
                    "IMAGE",
                    {
                        "tooltip": (
                            "Secondary reference images (image_2) - e.g., clothing, accessories.\n"
                            "Connect additional AIL for multi-image prompting."
                        ),
                    },
                ),
                "images3": (
                    "IMAGE",
                    {
                        "tooltip": (
                            "Tertiary reference images (image_3) - e.g., background, environment.\n"
                            "Connect additional AIL for multi-image prompting."
                        ),
                    },
                ),
                "images4": (
                    "IMAGE",
                    {
                        "tooltip": (
                            "Quaternary reference images (image_4) - e.g., style, pose reference.\n"
                            "Connect additional AIL for multi-image prompting."
                        ),
                    },
                ),
                "character_image": (
                    "IMAGE",
                    {
                        "tooltip": (
                            "Optional: Single character reference image for Creative/Character modes.\n"
                            "Will be sent to Gemini/Grok for visual character consistency."
                        ),
                    },
                ),
                "aspect_label": (
                    "STRING",
                    {
                        "default": "1:1",
                        "tooltip": "Aspect ratio label (e.g., '16:9'). Connect from INSTARAW Aspect Ratio Selector.",
                    },
                ),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
                "prompt_batch_data": (
                    "STRING",
                    {
                        "default": "[]",
                    },
                ),
                "resolved_mode": (
                    "STRING",
                    {
                        "default": "txt2img",
                    },
                ),
                "sdxl_mode": (
                    "BOOLEAN",
                    {
                        "default": False,
                    },
                ),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "INT", "INT", "STRING")
    RETURN_NAMES = (
        "prompt_list_positive",
        "prompt_list_negative",
        "seed_list",
        "generation_count",
        "resolved_mode",
    )

    INPUT_IS_LIST = False
    OUTPUT_IS_LIST = [True, True, True, False, False]
    # prompt_list_positive => list
    # prompt_list_negative => list
    # seed_list => list
    # generation_count, resolved_mode => scalars

    FUNCTION = "execute"
    CATEGORY = "INSTARAW/Prompts"

    def execute(
        self,
        gemini_api_key,
        grok_api_key,
        images=None,
        images2=None,
        images3=None,
        images4=None,
        character_image=None,
        aspect_label="1:1",
        node_id=None,
        prompt_batch_data="[]",
        resolved_mode="txt2img",
        sdxl_mode=False,
        user_instructions="",
    ):
        """
        Execute the RPG node - parse the prompt batch, expand prompts, return STRING LISTS.

        This method is deterministic and has no side effects. All creative generation
        happens in the frontend via backend API calls.

        Args:
            images: Optional IMAGE batch from AIL for img2img mode
            character_image: Optional single IMAGE for character reference
        """
        # 1) Parse prompt batch
        try:
            prompt_batch = json.loads(prompt_batch_data or "[]")
        except Exception as e:
            print(f"[RPG] Error parsing prompt_batch_data: {e}")
            prompt_batch = []

        # 2) Get image count from actual connected images
        image_count = 0
        if images is not None:
            import torch
            if isinstance(images, torch.Tensor):
                image_count = images.shape[0]  # Batch dimension

        # 3) Compute effective prompt list (positive + negative + seeds) with repeat_count
        positives = []
        negatives = []
        seeds = []

        for idx, entry in enumerate(prompt_batch):
            # SDXL mode determines which field to use for positive prompt
            # - SDXL mode ON: Use tags if available, fallback to positive_prompt
            # - SDXL mode OFF: Use positive_prompt only (ignore tags)
            tags = entry.get("tags", [])
            positive_prompt = entry.get("positive_prompt") or ""

            if sdxl_mode and tags and isinstance(tags, list) and len(tags) > 0:
                # SDXL mode enabled - use tags
                pos = ", ".join(tags).strip()
            else:
                # Normal mode - use positive_prompt field
                pos = positive_prompt.strip()

            neg = (entry.get("negative_prompt") or "").strip()
            rc = max(1, int(entry.get("repeat_count", 1)))

            # Get seed from this prompt entry
            entry_seed = int(entry.get("seed", 1111111))

            # When repeat_count > 1, always increment by +1 for each repeat
            # (seed_control is for AFTER execution, handled in frontend)
            for repeat_idx in range(rc):
                positives.append(pos)
                negatives.append(neg if neg else "")
                seeds.append(entry_seed + repeat_idx)

        # 4) Determine effective mode (auto-detect based on images)
        if image_count > 0:
            resolved = "img2img"
        else:
            resolved = "txt2img"

        # 5) Compute generation_count
        generation_count = len(positives)

        # 6) Log validation info
        if image_count > 0 and generation_count > 0:
            if image_count == generation_count:
                print(f"[RPG] ✅ {generation_count} prompts ↔ {image_count} images (perfect match)")
            else:
                print(f"[RPG] ⚠️ {generation_count} prompts vs {image_count} images (mismatch)")

        # 7) If prompt_batch is empty, return valid empty lists (no exception)
        if generation_count == 0:
            print("[RPG] Warning: Prompt batch is empty. Returning empty prompt lists.")
            return ([""], [""], [0], 0, resolved)

        # 8) Return STRING LISTS and SEED LIST
        return (positives, negatives, seeds, generation_count, resolved)

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        """
        Let ComfyUI use default change detection based on inputs.
        We compute a deterministic hash from prompt_batch_data for caching.
        """
        prompt_batch_data = kwargs.get("prompt_batch_data", "[]")
        global_negative = kwargs.get("global_negative", "")
        expected_image_count = kwargs.get("expected_image_count", -1)

        # Create a hash of all inputs that affect output
        hasher = hashlib.sha256()
        hasher.update(prompt_batch_data.encode("utf-8"))
        hasher.update(global_negative.encode("utf-8"))
        hasher.update(str(expected_image_count).encode("utf-8"))

        return hasher.hexdigest()


# Export node mappings
NODE_CLASS_MAPPINGS = {
    "INSTARAW_RealityPromptGenerator": INSTARAW_RealityPromptGenerator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_RealityPromptGenerator": "🎲 INSTARAW Reality Prompt Generator",
}
