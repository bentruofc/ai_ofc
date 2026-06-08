# Filename: ComfyUI_AIOFC/nodes/utility_nodes/__init__.py
# ---

"""
AIOFC Utility Nodes
Helper nodes for workflow convenience
"""

# Keep all the working imports
from .seed_generator import (
    NODE_CLASS_MAPPINGS as SEED_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SEED_DISPLAY_MAPPINGS,
)
from .grow_mask_with_blur import (
    NODE_CLASS_MAPPINGS as MASK_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as MASK_DISPLAY_MAPPINGS,
)
from .feather_mask import (
    NODE_CLASS_MAPPINGS as FEATHER_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as FEATHER_DISPLAY_MAPPINGS,
)
from .image_resolution_clamp import (
    NODE_CLASS_MAPPINGS as RESOLUTION_GUARD_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as RESOLUTION_GUARD_DISPLAY_MAPPINGS,
)
from .api_provider_selector import (
    NODE_CLASS_MAPPINGS as PROVIDER_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as PROVIDER_DISPLAY_MAPPINGS,
)
from .realistic_noise import (
    NODE_CLASS_MAPPINGS as NOISE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as NOISE_DISPLAY_MAPPINGS,
)
from .realistic_jpeg import (
    NODE_CLASS_MAPPINGS as JPEG_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as JPEG_DISPLAY_MAPPINGS,
)
from .workflow_logic_nodes import (
    NODE_CLASS_MAPPINGS as WORKFLOW_LOGIC_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as WORKFLOW_LOGIC_DISPLAY_MAPPINGS,
)
from .list_utility_nodes import (
    AIOFC_BatchFromImageList,
    AIOFC_ImageListFromBatch,
    AIOFC_PickFromList,
    AIOFC_StringListFromStrings,
)
from .string_utility_nodes import (
    AIOFC_SplitByCommas,
    AIOFC_StringToFloat,
    AIOFC_StringToInt,
    AIOFC_AnyListToString,
    AIOFC_StringCombine,
)
from .mask_utility_nodes import AIOFC_MaskedSection, AIOFC_MaskCombine
from .branding_node import (
    NODE_CLASS_MAPPINGS as BRANDING_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as BRANDING_DISPLAY_MAPPINGS,
)
from .image_resize_advanced import (
    NODE_CLASS_MAPPINGS as RESIZE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as RESIZE_DISPLAY_MAPPINGS,
)
from .api_model_selector import (
    NODE_CLASS_MAPPINGS as MODEL_SELECTOR_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as MODEL_SELECTOR_DISPLAY_MAPPINGS,
)
from .json_utils import (
    NODE_CLASS_MAPPINGS as JSON_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as JSON_DISPLAY_MAPPINGS,
)
from .lut_selector import AIOFC_LUT_Selector
from .spectral_engine_node import (
    NODE_CLASS_MAPPINGS as SPECTRAL_ENGINE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SPECTRAL_ENGINE_DISPLAY_MAPPINGS,
)
from .color_science_node import (
    NODE_CLASS_MAPPINGS as COLOR_SCIENCE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as COLOR_SCIENCE_DISPLAY_MAPPINGS,
)
from .auto_white_balance_node import AIOFC_AutoWhiteBalance
from .neural_grain_node import (
    NODE_CLASS_MAPPINGS as NEURAL_GRAIN_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as NEURAL_GRAIN_DISPLAY_MAPPINGS,
)
from .lens_simulation_node import (
    NODE_CLASS_MAPPINGS as LENS_EFFECTS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as LENS_EFFECTS_DISPLAY_MAPPINGS,
)
# ADD THIS NEW IMPORT
from .compression_node import (
    NODE_CLASS_MAPPINGS as COMPRESSION_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as COMPRESSION_DISPLAY_MAPPINGS,
)
from .authenticity_profile_selector import AIOFC_AuthenticityProfile_Selector
from .fft_match import AIOFC_FFT_Match
from .texture_normalize import AIOFC_GLCM_Normalize, AIOFC_LBP_Normalize
from .metadata_inspector import AIOFC_Metadata_Inspector
from .texture_engine import NODE_CLASS_MAPPINGS as TEXTURE_ENGINE_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as TEXTURE_ENGINE_DISPLAY_MAPPINGS
from .spectral_normalizer_node import AIOFC_Spectral_Normalizer
from .pixel_perturb import AIOFC_Pixel_Perturb
from .blend_colors import AIOFC_BlendColors
from .camera_simulator import AIOFC_Camera_Simulator
from .load_image_from_path import NODE_CLASS_MAPPINGS as LOADER_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as LOADER_DISPLAY_MAPPINGS
from .line_splitter import AIOFC_LineSplitter
from .image_prompt_iterator import AIOFC_ImagePromptIterator
from .debug_prompt_overlay import AIOFC_DebugPromptOverlay
from .prompt_batch_preview import (
    NODE_CLASS_MAPPINGS as PREVIEW_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as PREVIEW_DISPLAY_MAPPINGS,
)
from .mask_to_crop import (
    NODE_CLASS_MAPPINGS as MASK_TO_CROP_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as MASK_TO_CROP_DISPLAY_MAPPINGS,
)


# --- CLEANED UP MAPPINGS ---
NODE_CLASS_MAPPINGS = {
    **SEED_MAPPINGS,
    **MASK_MAPPINGS,
    **FEATHER_MAPPINGS,
    **RESOLUTION_GUARD_MAPPINGS,
    **PROVIDER_MAPPINGS,
    **NOISE_MAPPINGS,
    **JPEG_MAPPINGS,
    **WORKFLOW_LOGIC_MAPPINGS,
    "AIOFC_BatchFromImageList": AIOFC_BatchFromImageList,
    "AIOFC_ImageListFromBatch": AIOFC_ImageListFromBatch,
    "AIOFC_PickFromList": AIOFC_PickFromList,
    "AIOFC_StringListFromStrings": AIOFC_StringListFromStrings,
    "AIOFC_SplitByCommas": AIOFC_SplitByCommas,
    "AIOFC_StringToFloat": AIOFC_StringToFloat,
    "AIOFC_StringToInt": AIOFC_StringToInt,
    "AIOFC_AnyListToString": AIOFC_AnyListToString,
    "AIOFC_MaskedSection": AIOFC_MaskedSection,
    "AIOFC_MaskCombine": AIOFC_MaskCombine,
    "AIOFC_StringCombine": AIOFC_StringCombine,
    **BRANDING_MAPPINGS,
    **RESIZE_MAPPINGS,
    **MODEL_SELECTOR_MAPPINGS,
    **JSON_MAPPINGS,
    "AIOFC_LUT_Selector": AIOFC_LUT_Selector,
    **SPECTRAL_ENGINE_MAPPINGS,
    **COLOR_SCIENCE_MAPPINGS,
    "AIOFC_AutoWhiteBalance": AIOFC_AutoWhiteBalance,
    **NEURAL_GRAIN_MAPPINGS,
    **LENS_EFFECTS_MAPPINGS,
    **COMPRESSION_MAPPINGS,
    "AIOFC_AuthenticityProfile_Selector": AIOFC_AuthenticityProfile_Selector,
    "AIOFC_FFT_Match": AIOFC_FFT_Match,
    "AIOFC_GLCM_Normalize": AIOFC_GLCM_Normalize,
    "AIOFC_LBP_Normalize": AIOFC_LBP_Normalize,
    "AIOFC_Metadata_Inspector": AIOFC_Metadata_Inspector,
    **TEXTURE_ENGINE_MAPPINGS,
    "AIOFC_Spectral_Normalizer": AIOFC_Spectral_Normalizer,
    "AIOFC_Pixel_Perturb": AIOFC_Pixel_Perturb,
    "AIOFC_BlendColors": AIOFC_BlendColors,
    "AIOFC_Camera_Simulator": AIOFC_Camera_Simulator,
    **LOADER_MAPPINGS,
    "AIOFC_LineSplitter": AIOFC_LineSplitter,
    "AIOFC_ImagePromptIterator": AIOFC_ImagePromptIterator,
    "AIOFC_DebugPromptOverlay": AIOFC_DebugPromptOverlay,
    **PREVIEW_MAPPINGS,
    **MASK_TO_CROP_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **SEED_DISPLAY_MAPPINGS,
    **MASK_DISPLAY_MAPPINGS,
    **FEATHER_DISPLAY_MAPPINGS,
    **RESOLUTION_GUARD_DISPLAY_MAPPINGS,
    **PROVIDER_DISPLAY_MAPPINGS,
    **NOISE_DISPLAY_MAPPINGS,
    **JPEG_DISPLAY_MAPPINGS,
    **WORKFLOW_LOGIC_DISPLAY_MAPPINGS,
    "AIOFC_BatchFromImageList": "🗃️ AIOFC Batch From Image List",
    "AIOFC_ImageListFromBatch": "📑 AIOFC Image List From Batch",
    "AIOFC_PickFromList": "👉 AIOFC Pick From List",
    "AIOFC_StringListFromStrings": "📑 AIOFC String List",
    "AIOFC_SplitByCommas": "🔪 AIOFC Split String",
    "AIOFC_StringToFloat": "→FLOAT AIOFC String To Float",
    "AIOFC_StringToInt": "→INT AIOFC String To Int",
    "AIOFC_AnyListToString": "→STRING AIOFC List To String",
    "AIOFC_MaskedSection": "🖼️ AIOFC Masked Section",
    "AIOFC_MaskCombine": "➕ AIOFC Mask Combine",
    "AIOFC_StringCombine": "✍️ AIOFC String Combine (Safe)",
    **BRANDING_DISPLAY_MAPPINGS,
    **RESIZE_DISPLAY_MAPPINGS,
    **MODEL_SELECTOR_DISPLAY_MAPPINGS,
    **JSON_DISPLAY_MAPPINGS,
    "AIOFC_LUT_Selector": "🎨 AIOFC LUT Selector",
    **SPECTRAL_ENGINE_DISPLAY_MAPPINGS,
    **COLOR_SCIENCE_DISPLAY_MAPPINGS,
    "AIOFC_AutoWhiteBalance": "🎨 AIOFC Auto White Balance",
    **NEURAL_GRAIN_DISPLAY_MAPPINGS,
    **LENS_EFFECTS_DISPLAY_MAPPINGS,
    **COMPRESSION_DISPLAY_MAPPINGS,
    "AIOFC_AuthenticityProfile_Selector": "👑 AIOFC Authenticity Profile",
    "AIOFC_FFT_Match": "🛡️ AIOFC FFT Match",
    "AIOFC_GLCM_Normalize": "🛡️ AIOFC GLCM Normalize",
    "AIOFC_LBP_Normalize": "🛡️ AIOFC LBP Normalize",
    "AIOFC_Metadata_Inspector": "📊 AIOFC Metadata Inspector",
    **TEXTURE_ENGINE_DISPLAY_MAPPINGS,
    "AIOFC_Spectral_Normalizer": "🛡️ AIOFC Spectral Normalizer",
    "AIOFC_Pixel_Perturb": "🛡️ AIOFC Pixel Perturb",
    "AIOFC_BlendColors": "🛡️ AIOFC Blend Colors",
    "AIOFC_Camera_Simulator": "🛡️ AIOFC Camera Simulator",
    **LOADER_DISPLAY_MAPPINGS,
    "AIOFC_LineSplitter": "✂️ AIOFC Line Splitter",
    "AIOFC_ImagePromptIterator": "🧪 AIOFC Image Prompt Iterator",
    "AIOFC_DebugPromptOverlay": "🐛 AIOFC Debug Prompt Overlay",
    **PREVIEW_DISPLAY_MAPPINGS,
    **MASK_TO_CROP_DISPLAY_MAPPINGS,
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]