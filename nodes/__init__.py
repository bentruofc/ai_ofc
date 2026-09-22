# ---
# Filename: ../ComfyUI_AIOFC/nodes/__init__.py
# ---

"""
ComfyUI AIOFC Nodes
A collection of custom nodes by Aiofc
"""

from .api_nodes import (
    NODE_CLASS_MAPPINGS as API_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as API_NODE_DISPLAY_MAPPINGS,
)
from .utility_nodes import (
    NODE_CLASS_MAPPINGS as UTILITY_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as UTILITY_NODE_DISPLAY_MAPPINGS,
)
from .logic_nodes import (
    NODE_CLASS_MAPPINGS as LOGIC_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as LOGIC_NODE_DISPLAY_MAPPINGS,
)
from .interactive_nodes import (
    NODE_CLASS_MAPPINGS as INTERACTIVE_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as INTERACTIVE_NODE_DISPLAY_MAPPINGS,
)
from .nsfw_nodes import (
    NODE_CLASS_MAPPINGS as NSFW_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as NSFW_NODE_DISPLAY_MAPPINGS,
)
# This now correctly points to the new folder
from .output_nodes import (
    NODE_CLASS_MAPPINGS as OUTPUT_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as OUTPUT_NODE_DISPLAY_MAPPINGS,
)
from .input_nodes import (
    NODE_CLASS_MAPPINGS as INPUT_NODE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as INPUT_NODE_DISPLAY_MAPPINGS,
)

import importlib.util
import os
import sys

_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

# ChromaGrade
CHROMAGRADE_NODE_MAPPINGS = {}
CHROMAGRADE_NODE_DISPLAY_MAPPINGS = {}
try:
    cg_path = os.path.join(_ROOT_DIR, "ComfyUI-ChromaGrade")
    if os.path.isdir(cg_path):
        cg_init = os.path.join(cg_path, "__init__.py")
        cg_spec = importlib.util.spec_from_file_location("ComfyUI_ChromaGrade", cg_init)
        if cg_spec and cg_spec.loader:
            cg_mod = importlib.util.module_from_spec(cg_spec)
            sys.modules["ComfyUI_ChromaGrade"] = cg_mod
            cg_spec.loader.exec_module(cg_mod)
            CHROMAGRADE_NODE_MAPPINGS = getattr(cg_mod, "NODE_CLASS_MAPPINGS", {})
            CHROMAGRADE_NODE_DISPLAY_MAPPINGS = getattr(cg_mod, "NODE_DISPLAY_NAME_MAPPINGS", {})
except Exception as e:
    print(f"[AIOFC] Warning: Could not load ChromaGrade custom nodes: {e}")

# Skin Detailer
SKIN_DETAILER_NODE_MAPPINGS = {}
SKIN_DETAILER_NODE_DISPLAY_MAPPINGS = {}
try:
    sd_path = os.path.join(_ROOT_DIR, "comfyui-skin-detailer")
    if os.path.isdir(sd_path):
        sd_init = os.path.join(sd_path, "__init__.py")
        sd_spec = importlib.util.spec_from_file_location("comfyui_skin_detailer", sd_init)
        if sd_spec and sd_spec.loader:
            sd_mod = importlib.util.module_from_spec(sd_spec)
            sys.modules["comfyui_skin_detailer"] = sd_mod
            sd_spec.loader.exec_module(sd_mod)
            SKIN_DETAILER_NODE_MAPPINGS = getattr(sd_mod, "NODE_CLASS_MAPPINGS", {})
            SKIN_DETAILER_NODE_DISPLAY_NAME_MAPPINGS = getattr(sd_mod, "NODE_DISPLAY_NAME_MAPPINGS", {})
            SKIN_DETAILER_NODE_DISPLAY_MAPPINGS = SKIN_DETAILER_NODE_DISPLAY_NAME_MAPPINGS
except Exception as e:
    print(f"[AIOFC] Warning: Could not load Skin Detailer custom nodes: {e}")


# Combine all node mappings from different categories
NODE_CLASS_MAPPINGS = {
    **API_NODE_MAPPINGS,
    **UTILITY_NODE_MAPPINGS,
    **LOGIC_NODE_MAPPINGS,
    **INTERACTIVE_NODE_MAPPINGS,
    **NSFW_NODE_MAPPINGS,
    **OUTPUT_NODE_MAPPINGS,
    **INPUT_NODE_MAPPINGS,
    **CHROMAGRADE_NODE_MAPPINGS,
    **SKIN_DETAILER_NODE_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **API_NODE_DISPLAY_MAPPINGS,
    **UTILITY_NODE_DISPLAY_MAPPINGS,
    **LOGIC_NODE_DISPLAY_MAPPINGS,
    **INTERACTIVE_NODE_DISPLAY_MAPPINGS,
    **NSFW_NODE_DISPLAY_MAPPINGS,
    **OUTPUT_NODE_DISPLAY_MAPPINGS,
    **INPUT_NODE_DISPLAY_MAPPINGS,
    **CHROMAGRADE_NODE_DISPLAY_MAPPINGS,
    **SKIN_DETAILER_NODE_DISPLAY_MAPPINGS,
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]