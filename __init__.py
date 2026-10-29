"""
ComfyUI AIOFC (ai_ofc)
Custom post-processing nodes for realistic camera look simulation and sensor noise.
Used in Krea2 and related workflows.
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

__version__ = "0.1.2"
__author__ = "Aiofc"
__description__ = "AIOFC - Camera Look and Renoise Custom Nodes for ComfyUI"
