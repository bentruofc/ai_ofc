# ---
# ComfyUI INSTARAW - Restore Crop to Original Node
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

import json
import torch


class INSTARAW_RestoreCropToOriginal:
    """
    Restores a processed cropped image back into the original full image.
    Used in NSFW fix workflows where you crop to a safe area, process it
    (e.g., faceswap), then fuse it back into the original.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "original_image": ("IMAGE", {"tooltip": "The original full-size image"}),
                "cropped_image": ("IMAGE", {"tooltip": "The processed cropped image to restore"}),
                "crop_data_json": ("STRING", {"forceInput": True, "tooltip": "JSON with x, y, width, height from the crop node"}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("restored_image",)
    FUNCTION = "restore_crop"
    CATEGORY = "INSTARAW/NSFW"

    def restore_crop(self, original_image, cropped_image, crop_data_json):
        # Parse crop data
        try:
            crop_data = json.loads(crop_data_json)
        except (json.JSONDecodeError, TypeError) as e:
            raise ValueError(f"Invalid crop_data_json: {e}")

        x = int(crop_data.get("x", 0))
        y = int(crop_data.get("y", 0))
        width = int(crop_data.get("width", 0))
        height = int(crop_data.get("height", 0))

        # Validate crop data
        if width <= 0 or height <= 0:
            print("⚠️ INSTARAW Restore Crop: Invalid crop dimensions. Returning original image.")
            return (original_image,)

        # Get dimensions
        batch_size, orig_h, orig_w, channels = original_image.shape
        _, crop_h, crop_w, _ = cropped_image.shape

        # Check if cropped image matches expected dimensions
        if crop_w != width or crop_h != height:
            print(f"⚠️ INSTARAW Restore Crop: Cropped image size ({crop_w}x{crop_h}) doesn't match crop data ({width}x{height}). Resizing...")
            # Resize cropped image to match expected dimensions
            # Permute to BCHW for interpolate, then back to BHWC
            cropped_permuted = cropped_image.permute(0, 3, 1, 2)
            resized = torch.nn.functional.interpolate(
                cropped_permuted,
                size=(height, width),
                mode="bilinear",
                align_corners=False
            )
            cropped_image = resized.permute(0, 2, 3, 1)

        # Clone the original image to avoid modifying it
        restored = original_image.clone()

        # Ensure we don't go out of bounds
        end_x = min(x + width, orig_w)
        end_y = min(y + height, orig_h)
        actual_width = end_x - x
        actual_height = end_y - y

        # Paste the cropped image back into the original
        restored[:, y:end_y, x:end_x, :] = cropped_image[:, :actual_height, :actual_width, :]

        print(f"✅ INSTARAW Restore Crop: Restored crop region ({x}, {y}, {width}x{height}) to original image.")

        return (restored,)


# =================================================================================
# NODE REGISTRATION
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "INSTARAW_RestoreCropToOriginal": INSTARAW_RestoreCropToOriginal,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_RestoreCropToOriginal": "📥 INSTARAW Restore Crop to Original",
}
