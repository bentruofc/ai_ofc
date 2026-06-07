# ---
# ComfyUI INSTARAW - Nano Banana Pro Aspect Ratio Node
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
Nano Banana Pro Aspect Ratio Node
Provides aspect ratio and resolution selection for Nano Banana Pro API.
Includes visual preview via JavaScript widget.
"""


class INSTARAW_NanoBananaAspectRatio:
    """
    Aspect ratio and resolution selector for Nano Banana Pro.
    Supports all standard aspect ratios and 1K/2K/4K resolution tiers.
    """

    # Aspect ratio mapping - display name to API value
    ASPECT_RATIOS = {
        "1:1 (Square)": "1:1",
        "3:2 (Landscape)": "3:2",
        "2:3 (Portrait)": "2:3",
        "3:4 (Portrait)": "3:4",
        "4:3 (Landscape)": "4:3",
        "4:5 (Portrait)": "4:5",
        "5:4 (Landscape)": "5:4",
        "9:16 (Tall Portrait)": "9:16",
        "16:9 (Wide Landscape)": "16:9",
        "21:9 (Ultrawide)": "21:9",
    }

    # Resolution tiers with base sizes (shortest side in pixels)
    RESOLUTIONS = ["1K", "2K", "4K"]
    RESOLUTION_BASE = {
        "1K": 1024,
        "2K": 2048,
        "4K": 4096,
    }

    # Aspect ratio to dimensions mapping (width, height) for calculating pixels
    ASPECT_DIMENSIONS = {
        "1:1": (1, 1),
        "3:2": (3, 2),
        "2:3": (2, 3),
        "3:4": (3, 4),
        "4:3": (4, 3),
        "4:5": (4, 5),
        "5:4": (5, 4),
        "9:16": (9, 16),
        "16:9": (16, 9),
        "21:9": (21, 9),
    }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "aspect_ratio": (
                    list(cls.ASPECT_RATIOS.keys()),
                    {
                        "default": "1:1 (Square)",
                        "tooltip": "Select the aspect ratio for image generation",
                    },
                ),
                "resolution": (
                    cls.RESOLUTIONS,
                    {
                        "default": "1K",
                        "tooltip": "Resolution tier: 1K (~1024px), 2K (~2048px), 4K (~4096px)",
                    },
                ),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "INT", "INT", "STRING")
    RETURN_NAMES = ("aspect_ratio", "resolution", "width", "height", "aspect_label")
    FUNCTION = "get_settings"
    CATEGORY = "INSTARAW/Input"
    DESCRIPTION = "Nano Banana Pro aspect ratio and resolution selector with visual preview."

    def get_settings(self, aspect_ratio, resolution):
        """
        Returns aspect ratio, resolution, width, height, and label for the selected settings.

        Args:
            aspect_ratio: Selected aspect ratio display name
            resolution: Selected resolution tier

        Returns:
            Tuple of (aspect_ratio_value, resolution, width, height, aspect_label)
        """
        # Get the API value for the aspect ratio
        aspect_value = self.ASPECT_RATIOS.get(aspect_ratio, "1:1")

        # Get base size for resolution tier
        base_size = self.RESOLUTION_BASE.get(resolution, 1024)

        # Get aspect dimensions
        aspect_w, aspect_h = self.ASPECT_DIMENSIONS.get(aspect_value, (1, 1))

        # Calculate actual width and height
        # The shorter side gets the base size, longer side is proportionally larger
        if aspect_w >= aspect_h:
            # Landscape or square - height is the shorter side
            height = base_size
            width = int(base_size * aspect_w / aspect_h)
        else:
            # Portrait - width is the shorter side
            width = base_size
            height = int(base_size * aspect_h / aspect_w)

        # Round to nearest 64 for compatibility
        width = (width // 64) * 64
        height = (height // 64) * 64

        # Return the settings
        return (aspect_value, resolution, width, height, aspect_ratio)


# Node registration
NODE_CLASS_MAPPINGS = {
    "INSTARAW_NanoBananaAspectRatio": INSTARAW_NanoBananaAspectRatio,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_NanoBananaAspectRatio": "📐 Nano Banana Pro Aspect Ratio",
}
