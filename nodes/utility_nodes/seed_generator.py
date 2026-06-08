# ---
# ComfyUI AIOFC - Seed Generator Node
# Part of the AIOFC custom nodes collection by Aiofc
#
# Copyright © 2025 Aiofc. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
Simple seed generator utility with ComfyUI's built-in control_after_generate support.
"""


class AIOFCSeedGenerator:
    """
    Simple seed pass-through with ComfyUI's built-in control_after_generate support.

    The control_after_generate dropdown is automatically handled by ComfyUI's frontend.
    This node just returns the seed value that ComfyUI provides.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "seed": ("INT", {
                    "default": 1111111,
                    "min": 0,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                }),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("seed",)
    FUNCTION = "get_seed"
    CATEGORY = "AIOFC/Utils"

    def get_seed(self, seed):
        """Simply return the seed value provided by ComfyUI."""
        return (seed,)


# =================================================================================
# EXPORT NODE MAPPINGS
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "AIOFCSeedGenerator": AIOFCSeedGenerator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFCSeedGenerator": "🎲 AIOFC Seed",
}
