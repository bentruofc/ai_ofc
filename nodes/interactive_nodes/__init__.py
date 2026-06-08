"""
AIOFC Interactive Nodes
Nodes that pause the workflow for user input.
"""

from .image_filter import (
    AIOFC_ImageFilter,
    AIOFC_MaskImageFilter,
    AIOFC_TextImageFilter,
)
from .interactive_crop import AIOFC_Interactive_Crop
from .prompt_filter import AIOFC_PromptFilter
from .batch_image_generator import AIOFC_BatchImageGenerator

NODE_CLASS_MAPPINGS = {
    "AIOFC_ImageFilter": AIOFC_ImageFilter,
    "AIOFC_TextImageFilter": AIOFC_TextImageFilter,
    "AIOFC_MaskImageFilter": AIOFC_MaskImageFilter,
    "AIOFC_Interactive_Crop": AIOFC_Interactive_Crop,
    "AIOFC_PromptFilter": AIOFC_PromptFilter,
    "AIOFC_BatchImageGenerator": AIOFC_BatchImageGenerator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFC_ImageFilter": "🎭 AIOFC Image Filter",
    "AIOFC_TextImageFilter": "📝 AIOFC Text/Image Filter",
    "AIOFC_MaskImageFilter": "✂️ AIOFC Mask Filter",
    "AIOFC_Interactive_Crop": "🖼️ AIOFC Interactive Crop",
    "AIOFC_PromptFilter": "🎯 AIOFC Prompt Filter",
    "AIOFC_BatchImageGenerator": "🎨 AIOFC Batch Image Generator",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]