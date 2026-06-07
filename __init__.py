"""
ComfyUI AIOFC
A general-purpose custom nodes package by Aiofc

AIOFC is a collection of powerful custom nodes for ComfyUI that brings together
hard-to-install dependencies and integrations in one convenient package.

Features:
- API Integrations: SeeDream, Ideogram, and more
- Easy Installation: Pre-packaged dependencies
- Modular Design: Easy to extend and customize
- AIOFC Brand: Where we push the boundaries

Created by Aiofc
"""

import os
import nodes

# This line is critical for loading the JavaScript and CSS files.
# It tells ComfyUI where to find the web assets for this extension.
if "ComfyUI_AIOFC" not in nodes.EXTENSION_WEB_DIRS:
    nodes.EXTENSION_WEB_DIRS["ComfyUI_AIOFC"] = os.path.join(os.path.dirname(os.path.realpath(__file__)), "js")

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

# Import creative API to register endpoints (after nodes are loaded)
try:
    from .nodes.api_nodes import creative_api
except Exception as e:
    print(f"Warning: Could not load creative_api: {e}")
    print("Creative/Character generation features will not be available.")

# Required exports for ComfyUI
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

# Package metadata
__version__ = "1.2.0" # Version bumped to reflect the major addition
__author__ = "Aiofc"
__description__ = "General purpose custom nodes for ComfyUI"