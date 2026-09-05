# -*- coding: utf-8 -*-
"""
ComfyUI node - AIOFC Image Black Check.
Stops the workflow if the input image is completely black (failed generation).
Nano Banana Pro returns a 64x64 solid-black image when generation fails.
Uses the interrupt mechanism to avoid printing a full traceback in the logs.
"""

import logging
import comfy.model_management as model_management


class ImageBlackCheckNode:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
            "optional": {
                "black_threshold": ("FLOAT", {
                    "default": 0.01,
                    "min": 0.0,
                    "max": 0.5,
                    "step": 0.001,
                    "tooltip": (
                        "Mean pixel value (0-1) below which the image is considered black. "
                        "0.01 catches solid-black and near-black images."
                    ),
                }),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "check"
    OUTPUT_NODE = False
    CATEGORY = "AIOFC/Utils"

    def check(self, image, black_threshold=0.01):
        mean_val = float(image.mean().item())
        if mean_val <= black_threshold:
            logging.warning("[AIOFC] Generation failed: black image returned. Workflow stopped.")
            model_management.interrupt_current_processing()
            model_management.throw_exception_if_processing_interrupted()
        return (image,)


NODE_CLASS_MAPPINGS = {
    "ImageBlackCheckNode": ImageBlackCheckNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ImageBlackCheckNode": "AIOFC Image Black Check",
}
