"""
AIOFC Utility Nodes: Camera Look and Renoise
"""

from .aiofc_camera_look import Aiofc_Camera_Look
from .aiofc_renoise import Aiofc_Renoise

NODE_CLASS_MAPPINGS = {
    "Aiofc_Camera_Look": Aiofc_Camera_Look,
    "Aiofc_Renoise": Aiofc_Renoise,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Aiofc_Camera_Look": "📷 AIOFC Camera Look",
    "Aiofc_Renoise": "🎞️ AIOFC Renoise",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
