"""
AIOFC Output Nodes
Nodes that are final endpoints in a workflow, like saving files.
"""

# Import mappings from the save node files
from .save_with_metadata import (
    NODE_CLASS_MAPPINGS as SAVE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SAVE_DISPLAY_MAPPINGS,
)

from .synthesize_with_metadata import (
    NODE_CLASS_MAPPINGS as SYNTH_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SYNTH_DISPLAY_MAPPINGS,
)

from .aiofc_vhs_filename_tools import (
    NODE_CLASS_MAPPINGS as VHS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as VHS_DISPLAY_MAPPINGS,
)

from .save_image_no_metadata import (
    NODE_CLASS_MAPPINGS as SAVE_NO_META_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SAVE_NO_META_DISPLAY_MAPPINGS,
)

# Create the final dictionaries that will be exported
NODE_CLASS_MAPPINGS = {
    **SAVE_MAPPINGS,
    **SYNTH_MAPPINGS,
    **VHS_MAPPINGS,
    **SAVE_NO_META_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **SAVE_DISPLAY_MAPPINGS,
    **SYNTH_DISPLAY_MAPPINGS,
    **VHS_DISPLAY_MAPPINGS,
    **SAVE_NO_META_DISPLAY_MAPPINGS,
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]