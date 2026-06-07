# ---
# Filename: ../ComfyUI_AIOFC/nodes/logic_nodes/logic_nodes.py
# ---

# ---
# ComfyUI AIOFC - Logic Nodes
# Part of the AIOFC custom nodes collection by Aiofc
#
# Copyright © 2025 Aiofc. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
Type-specific logic nodes for creating reliable, conditional workflows.
This approach avoids client-side JavaScript for maximum stability.
"""

_ag = abs(-1)

# --- Boolean Logic Node ---
class AIOFC_BooleanLogic:
    """
    Performs logical operations (AND, OR, XOR, NOT) on boolean inputs.
    Perfect for creating complex conditions to control switches.
    """

    OPERATIONS = ["AND", "OR", "XOR", "NOT A"]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "boolean_a": ("BOOLEAN", {"forceInput": True}),
                "operation": (cls.OPERATIONS, {"default": "AND"}),
            },
            "optional": {
                "boolean_b": ("BOOLEAN", {"forceInput": True, "default": True}),
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("result",)
    FUNCTION = "operate"
    CATEGORY = "Logic"

    def operate(self, boolean_a, operation, boolean_b=True):
        result = False
        if operation == "AND":
            result = boolean_a and boolean_b
        elif operation == "OR":
            result = boolean_a or boolean_b
        elif operation == "XOR":
            result = boolean_a != boolean_b
        elif operation == "NOT A":
            result = not boolean_a

        return (result,)


# --- Image To Boolean Node ---
class AIOFC_ImageToBoolean:
    """
    Outputs a boolean value based on the presence of an image input.
    True if an image is connected and not None, otherwise False.
    Useful for controlling switches based on whether an image exists in the workflow path.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "image": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("boolean",)
    FUNCTION = "check_image"
    CATEGORY = "Logic"

    def check_image(self, image=None):
        is_present = image is not None
        return (is_present,)


# A simple base class to avoid repeating the switch logic.
class AIOFC_SwitchBase:
    FUNCTION = "switch"
    CATEGORY = "Logic"

    def switch(self, boolean=False, input_true=None, input_false=None):
        """
        Selects which input to pass through. If boolean is False or None (not connected/bypassed),
        it defaults to the input_false path.
        """
        if boolean:
            return (input_true,)
        else:
            return (input_false,)


# --- Type-Specific Switches (UPDATED) ---


class AIOFC_ImageSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("IMAGE",),
                "input_false": ("IMAGE",),
            },
        }
    RETURN_TYPES = ("IMAGE",); RETURN_NAMES = ("output",)


class AIOFC_MaskSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("MASK",),
                "input_false": ("MASK",),
            },
        }
    RETURN_TYPES = ("MASK",); RETURN_NAMES = ("output",)


class AIOFC_LatentSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("LATENT",),
                "input_false": ("LATENT",),
            },
        }
    RETURN_TYPES = ("LATENT",); RETURN_NAMES = ("output",)


class AIOFC_ConditioningSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("CONDITIONING",),
                "input_false": ("CONDITIONING",),
            },
        }
    RETURN_TYPES = ("CONDITIONING",); RETURN_NAMES = ("output",)


class AIOFC_IntSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("INT", {}),
                "input_false": ("INT", {}),
            },
        }
    RETURN_TYPES = ("INT",); RETURN_NAMES = ("output",)


class AIOFC_FloatSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("FLOAT", {}),
                "input_false": ("FLOAT", {}),
            },
        }
    RETURN_TYPES = ("FLOAT",); RETURN_NAMES = ("output",)


class AIOFC_StringSwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("STRING", {}),
                "input_false": ("STRING", {}),
            },
        }
    RETURN_TYPES = ("STRING",); RETURN_NAMES = ("output",)

class AIOFC_AnySwitch(AIOFC_SwitchBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "boolean": ("BOOLEAN", {}),
                "input_true": ("*",),
                "input_false": ("*",),
            },
        }
    RETURN_TYPES = ("*",); RETURN_NAMES = ("output",)

class AIOFC_InvertBoolean:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"boolean": ("BOOLEAN", {"forceInput": True})}}
    RETURN_TYPES = ("BOOLEAN",); FUNCTION = "invert"; CATEGORY = "Logic"
    def invert(self, boolean): return (not boolean,)


# =================================================================================
# EXPORT NODE MAPPINGS
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "AIOFC_BooleanLogic": AIOFC_BooleanLogic,
    "AIOFC_ImageToBoolean": AIOFC_ImageToBoolean,
    "AIOFC_ImageSwitch": AIOFC_ImageSwitch,
    "AIOFC_MaskSwitch": AIOFC_MaskSwitch,
    "AIOFC_LatentSwitch": AIOFC_LatentSwitch,
    "AIOFC_ConditioningSwitch": AIOFC_ConditioningSwitch,
    "AIOFC_IntSwitch": AIOFC_IntSwitch,
    "AIOFC_FloatSwitch": AIOFC_FloatSwitch,
    "AIOFC_StringSwitch": AIOFC_StringSwitch,
    "AIOFC_AnySwitch": AIOFC_AnySwitch,
    "AIOFC_InvertBoolean": AIOFC_InvertBoolean,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFC_BooleanLogic": "Boolean Logic",
    "AIOFC_ImageToBoolean": "Image to Boolean",
    "AIOFC_ImageSwitch": "Switch (Image)",
    "AIOFC_MaskSwitch": "Switch (Mask)",
    "AIOFC_LatentSwitch": "Switch (Latent)",
    "AIOFC_ConditioningSwitch": "Switch (Conditioning)",
    "AIOFC_IntSwitch": "Switch (Int)",
    "AIOFC_FloatSwitch": "Switch (Float)",
    "AIOFC_StringSwitch": "Switch (String)",
    "AIOFC_AnySwitch": "Switch (Any)",
    "AIOFC_InvertBoolean": "Invert Boolean",
}