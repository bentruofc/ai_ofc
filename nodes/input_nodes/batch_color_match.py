# ---
# ComfyUI AIOFC - Batch Color Match Nodes
# Part of the AIOFC custom nodes collection by Aiofc
#
# Copyright © 2025 Aiofc. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
ComfyUI custom node: Batch Color Match to Reference
This node is designed for modular video/shot-block workflows where each generated
shot is decoded as an IMAGE batch. It matches every frame in a batch to the
global RGB mean/std of a reference image to reduce cumulative color-grade drift
between blocks.
"""

import torch


class AIOFC_BatchColorMatch:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "reference": ("IMAGE",),
                "strength": ("FLOAT", {
                    "default": 0.70,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.01,
                    "round": 0.001,
                }),
                "match_contrast": ("FLOAT", {
                    "default": 0.85,
                    "min": 0.0,
                    "max": 1.5,
                    "step": 0.01,
                    "round": 0.001,
                }),
                "eps": ("FLOAT", {
                    "default": 0.000001,
                    "min": 0.000001,
                    "max": 0.01,
                    "step": 0.000001,
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("images",)
    FUNCTION = "match"
    CATEGORY = "AIOFC/Color"

    def match(self, images, reference, strength=0.70, match_contrast=0.85, eps=0.000001):
        """
        images:    BHWC float tensor, usually 0..1
        reference: BHWC float tensor, first frame is used as the color reference

        The transform is per-frame:
            adjusted = (frame - frame_mean) * (ref_std / frame_std) + ref_mean

        Then blend:
            out = original * (1 - strength) + adjusted * strength

        match_contrast lets you blend the reference contrast target with the
        current frame contrast. Values below 1 preserve more of each frame's
        original contrast while still matching the grade.
        """
        if not torch.is_tensor(images) or not torch.is_tensor(reference):
            return (images,)

        original = images
        img = images.float()
        ref = reference[:1].float()

        # Use RGB only; if alpha exists, leave it untouched.
        rgb = img[..., :3]
        ref_rgb = ref[..., :3]

        ref_mean = ref_rgb.mean(dim=(0, 1, 2), keepdim=True)
        ref_std = ref_rgb.std(dim=(0, 1, 2), keepdim=True).clamp_min(eps)

        frame_mean = rgb.mean(dim=(1, 2), keepdim=True)
        frame_std = rgb.std(dim=(1, 2), keepdim=True).clamp_min(eps)

        # Blend target contrast so the correction does not flatten or over-punch.
        target_std = frame_std * (1.0 - match_contrast) + ref_std * match_contrast
        adjusted_rgb = (rgb - frame_mean) * (target_std / frame_std) + ref_mean

        out_rgb = rgb * (1.0 - strength) + adjusted_rgb * strength
        out_rgb = out_rgb.clamp(0.0, 1.0)

        if img.shape[-1] > 3:
            out = torch.cat([out_rgb, img[..., 3:]], dim=-1)
        else:
            out = out_rgb

        return (out.to(dtype=original.dtype, device=original.device),)


NODE_CLASS_MAPPINGS = {
    "AIOFC_BatchColorMatch": AIOFC_BatchColorMatch,
    "VBVRColorMatchBatch": AIOFC_BatchColorMatch,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFC_BatchColorMatch": "🎨 AIOFC Batch Color Match to Reference",
    "VBVRColorMatchBatch": "Batch Color Match to Reference",
}
