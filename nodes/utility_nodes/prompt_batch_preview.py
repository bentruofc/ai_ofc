# ---
# ComfyUI INSTARAW - Prompt Batch Preview Node
# Debug utility to preview batch lists from Reality Prompt Generator
# ---

class INSTARAW_PromptBatchPreview:
    """
    Debug utility to preview prompt/seed batches from RPG.
    Displays all batch elements in a formatted output.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt_list_positive": ("STRING", {"forceInput": True}),
                "prompt_list_negative": ("STRING", {"forceInput": True}),
                "seed_list": ("INT", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("summary",)
    OUTPUT_NODE = True
    FUNCTION = "preview_batch"
    CATEGORY = "INSTARAW/Utils"

    INPUT_IS_LIST = True  # Accept lists

    def preview_batch(self, prompt_list_positive, prompt_list_negative, seed_list):
        """Display batch contents in console and return summary."""

        # Convert to lists if needed
        positives = list(prompt_list_positive) if isinstance(prompt_list_positive, (list, tuple)) else [prompt_list_positive]
        negatives = list(prompt_list_negative) if isinstance(prompt_list_negative, (list, tuple)) else [prompt_list_negative]
        seeds = list(seed_list) if isinstance(seed_list, (list, tuple)) else [seed_list]

        count = len(positives)

        print("\n" + "="*80)
        print(f"[PROMPT BATCH PREVIEW] Total: {count} prompts")
        print("="*80)

        # Build formatted output for UI
        ui_lines = [f"📊 BATCH PREVIEW: {count} prompts\n" + "="*60 + "\n"]

        for i in range(count):
            pos = positives[i] if i < len(positives) else "MISSING"
            neg = negatives[i] if i < len(negatives) else "MISSING"
            seed_val = seeds[i] if i < len(seeds) else "MISSING"

            # Console output
            print(f"\n[{i+1}/{count}] Seed: {seed_val}")
            print(f"  ✅ Positive: {pos[:100]}{'...' if len(str(pos)) > 100 else ''}")
            print(f"  ❌ Negative: {neg[:100]}{'...' if len(str(neg)) > 100 else ''}")

            # UI output (shorter for readability)
            ui_lines.append(f"[{i+1}] Seed: {seed_val}")
            ui_lines.append(f"✅ {str(pos)[:80]}{'...' if len(str(pos)) > 80 else ''}")
            ui_lines.append(f"❌ {str(neg)[:80]}{'...' if len(str(neg)) > 80 else ''}\n")

        print("\n" + "="*80 + "\n")

        summary = "\n".join(ui_lines)

        # Return both normal output and UI display
        return {
            "ui": {"text": [summary]},
            "result": (summary,)
        }


# Export node mappings
NODE_CLASS_MAPPINGS = {
    "INSTARAW_PromptBatchPreview": INSTARAW_PromptBatchPreview,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_PromptBatchPreview": "🔍 INSTARAW Prompt Batch Preview",
}
