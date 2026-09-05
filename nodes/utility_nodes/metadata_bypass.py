"""
AIOFC Metadata Bypass
Strips all metadata (EXIF, XMP, PNG chunks, ICC, C2PA) from one or more images
and returns clean IMAGE tensors.
"""

import io
import numpy as np
import torch
from PIL import Image


class MetadataBypassNode:
    """Pass-through node that strips all metadata from images and returns clean tensors."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
            },
        }

    RETURN_TYPES  = ("IMAGE",)
    RETURN_NAMES  = ("images",)
    OUTPUT_NODE   = False
    FUNCTION      = "run"
    CATEGORY      = "AIOFC/Automation"

    def run(self, images):
        cleaned = []
        for i in range(images.shape[0]):
            np_img = (images[i].cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
            pil_img = Image.fromarray(np_img, mode="RGB")

            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            buf.seek(0)
            clean = Image.open(buf).convert("RGB")

            clean_np = np.array(clean).astype(np.float32) / 255.0
            cleaned.append(torch.from_numpy(clean_np))

        batch = torch.stack(cleaned, dim=0)
        print(f"[AIOFC Metadata Bypass] Cleaned {len(cleaned)} image(s).")
        return (batch,)


NODE_CLASS_MAPPINGS = {
    "MetadataBypassNode": MetadataBypassNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MetadataBypassNode": "AIOFC Metadata Bypass",
}
