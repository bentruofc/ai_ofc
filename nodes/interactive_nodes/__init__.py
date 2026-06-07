"""
INSTARAW Interactive Nodes
Nodes that pause the workflow for user input.
"""

from .image_filter import (
    INSTARAW_ImageFilter,
    INSTARAW_MaskImageFilter,
    INSTARAW_TextImageFilter,
)
from .interactive_crop import INSTARAW_Interactive_Crop
from .prompt_filter import INSTARAW_PromptFilter
from .batch_image_generator import INSTARAW_BatchImageGenerator

NODE_CLASS_MAPPINGS = {
    "INSTARAW_ImageFilter": INSTARAW_ImageFilter,
    "INSTARAW_TextImageFilter": INSTARAW_TextImageFilter,
    "INSTARAW_MaskImageFilter": INSTARAW_MaskImageFilter,
    "INSTARAW_Interactive_Crop": INSTARAW_Interactive_Crop,
    "INSTARAW_PromptFilter": INSTARAW_PromptFilter,
    "INSTARAW_BatchImageGenerator": INSTARAW_BatchImageGenerator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_ImageFilter": "🎭 INSTARAW Image Filter",
    "INSTARAW_TextImageFilter": "📝 INSTARAW Text/Image Filter",
    "INSTARAW_MaskImageFilter": "✂️ INSTARAW Mask Filter",
    "INSTARAW_Interactive_Crop": "🖼️ INSTARAW Interactive Crop",
    "INSTARAW_PromptFilter": "🎯 INSTARAW Prompt Filter",
    "INSTARAW_BatchImageGenerator": "🎨 INSTARAW Batch Image Generator",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]