# ---
# ComfyUI INSTARAW - Mask to Crop
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
Converts a mask to crop coordinates with relative padding.
Useful for face swap workflows where you want to crop to head area.
Supports forced aspect ratio for pixel-perfect stitching.
"""

import torch
import numpy as np
import json


# Supported aspect ratios (width:height)
ASPECT_RATIOS = {
    "None (free)": None,
    "896x1200 (Nano Banana 1K)": (896, 1200),  # Exact Nano Banana Pro 1K output
    "3:4 (Portrait)": (3, 4),
    "4:3 (Landscape)": (4, 3),
    "2:3 (Portrait)": (2, 3),
    "3:2 (Landscape)": (3, 2),
    "9:16 (Tall)": (9, 16),
    "16:9 (Wide)": (16, 9),
    "1:1 (Square)": (1, 1),
    "4:5 (Portrait)": (4, 5),
    "5:4 (Landscape)": (5, 4),
}


class INSTARAW_MaskToCrop:
    """
    Converts a mask's bounding box to crop coordinates with relative padding.
    Outputs crop data compatible with Interactive Crop node.
    Supports forced aspect ratio for pixel-perfect API output stitching.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
                "padding_percent": (
                    "FLOAT",
                    {
                        "default": 20.0,
                        "min": 0.0,
                        "max": 100.0,
                        "step": 1.0,
                        "tooltip": "Padding around mask as percentage of mask size",
                    },
                ),
                "force_aspect_ratio": (
                    list(ASPECT_RATIOS.keys()),
                    {
                        "default": "3:4 (Portrait)",
                        "tooltip": "Force crop to specific aspect ratio for pixel-perfect stitching with API output",
                    },
                ),
            },
            "optional": {
                "min_size_percent": (
                    "FLOAT",
                    {
                        "default": 10.0,
                        "min": 1.0,
                        "max": 100.0,
                        "step": 1.0,
                        "tooltip": "Minimum crop size as percentage of image dimensions",
                    },
                ),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK", "STRING", "INT", "INT", "INT", "INT")
    RETURN_NAMES = ("image", "mask", "crop_json", "x", "y", "width", "height")
    FUNCTION = "mask_to_crop"
    CATEGORY = "INSTARAW/Utility"
    DESCRIPTION = "Converts mask bounding box to crop coordinates with relative padding and optional forced aspect ratio."

    def mask_to_crop(self, image, mask, padding_percent, force_aspect_ratio="3:4 (Portrait)", min_size_percent=10.0):
        """
        Calculate crop coordinates from mask with relative padding.
        """
        # Get image dimensions
        img_height = image.shape[1]
        img_width = image.shape[2]

        # Convert mask to numpy for processing
        if mask.dim() == 3:
            mask_np = mask[0].cpu().numpy()
        else:
            mask_np = mask.cpu().numpy()

        # Find mask bounding box
        rows = np.any(mask_np > 0.5, axis=1)
        cols = np.any(mask_np > 0.5, axis=0)

        if not rows.any() or not cols.any():
            # No mask found, return full image
            print("⚠️ No mask content found, returning full image bounds")
            crop_data = {
                "x": 0,
                "y": 0,
                "width": img_width,
                "height": img_height,
            }
            return (image, mask, json.dumps(crop_data), 0, 0, img_width, img_height)

        # Get bounding box
        y_min, y_max = np.where(rows)[0][[0, -1]]
        x_min, x_max = np.where(cols)[0][[0, -1]]

        print(f"🔍 Mask bbox: x_min={x_min}, x_max={x_max}, y_min={y_min}, y_max={y_max}")

        mask_width = x_max - x_min
        mask_height = y_max - y_min

        # Calculate padding based on mask size (relative padding)
        padding_x = int(mask_width * (padding_percent / 100.0))
        padding_y = int(mask_height * (padding_percent / 100.0))

        # Apply padding
        x = max(0, x_min - padding_x)
        y = max(0, y_min - padding_y)
        x_end = min(img_width, x_max + padding_x)
        y_end = min(img_height, y_max + padding_y)

        width = x_end - x
        height = y_end - y

        # Ensure minimum size
        min_width = int(img_width * (min_size_percent / 100.0))
        min_height = int(img_height * (min_size_percent / 100.0))

        if width < min_width:
            extra = min_width - width
            x = max(0, x - extra // 2)
            width = min(min_width, img_width - x)

        if height < min_height:
            extra = min_height - height
            y = max(0, y - extra // 2)
            height = min(min_height, img_height - y)

        # Force aspect ratio if specified
        target_aspect = ASPECT_RATIOS.get(force_aspect_ratio)
        if target_aspect is not None:
            target_w, target_h = target_aspect
            target_ratio = target_w / target_h  # e.g., 3:4 = 0.75
            current_ratio = width / height

            # Calculate center of current crop
            center_x = x + width / 2
            center_y = y + height / 2

            if current_ratio > target_ratio:
                # Current is too wide, need to increase height
                new_height = width / target_ratio
                new_width = width
            else:
                # Current is too tall, need to increase width
                new_width = height * target_ratio
                new_height = height

            # Recalculate x, y from center
            new_x = center_x - new_width / 2
            new_y = center_y - new_height / 2

            # Clamp to image bounds and adjust
            if new_x < 0:
                new_x = 0
            if new_y < 0:
                new_y = 0
            if new_x + new_width > img_width:
                new_x = img_width - new_width
                if new_x < 0:
                    new_x = 0
                    new_width = img_width
                    new_height = new_width / target_ratio
            if new_y + new_height > img_height:
                new_y = img_height - new_height
                if new_y < 0:
                    new_y = 0
                    new_height = img_height
                    new_width = new_height * target_ratio

            # Final clamp
            new_x = max(0, min(new_x, img_width - 1))
            new_y = max(0, min(new_y, img_height - 1))
            new_width = min(new_width, img_width - new_x)
            new_height = min(new_height, img_height - new_y)

            x, y, width, height = int(new_x), int(new_y), int(new_width), int(new_height)

            print(f"📐 Forced aspect ratio {target_w}:{target_h} -> {width}x{height}")

        # Create crop JSON (compatible with Interactive Crop)
        crop_data = {
            "x": int(x),
            "y": int(y),
            "width": int(width),
            "height": int(height),
        }

        print(f"📐 Mask to Crop: {width}x{height} at ({x}, {y}) with {padding_percent}% padding (image: {img_width}x{img_height})")

        return (
            image,
            mask,
            json.dumps(crop_data),
            int(x),
            int(y),
            int(width),
            int(height),
        )


class INSTARAW_ApplyCrop:
    """
    Applies crop coordinates to an image.
    Simple crop without interactive UI.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "x": ("INT", {"default": 0, "min": 0}),
                "y": ("INT", {"default": 0, "min": 0}),
                "width": ("INT", {"default": 512, "min": 1}),
                "height": ("INT", {"default": 512, "min": 1}),
            },
            "optional": {
                "mask": ("MASK",),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK", "STRING")
    RETURN_NAMES = ("cropped_image", "cropped_mask", "crop_json")
    FUNCTION = "apply_crop"
    CATEGORY = "INSTARAW/Utility"
    DESCRIPTION = "Applies crop coordinates to image and optional mask."

    def apply_crop(self, image, x, y, width, height, mask=None):
        """Apply crop to image and mask."""
        img_height = image.shape[1]
        img_width = image.shape[2]

        # Clamp values to image bounds
        x = max(0, min(x, img_width - 1))
        y = max(0, min(y, img_height - 1))
        width = max(1, min(width, img_width - x))
        height = max(1, min(height, img_height - y))

        # Crop image
        cropped_image = image[:, y : y + height, x : x + width, :]

        # Crop mask if provided
        if mask is not None:
            if mask.dim() == 3:
                cropped_mask = mask[:, y : y + height, x : x + width]
            else:
                cropped_mask = mask[y : y + height, x : x + width].unsqueeze(0)
        else:
            # Create empty mask
            cropped_mask = torch.zeros(1, height, width)

        crop_json = json.dumps({"x": x, "y": y, "width": width, "height": height})

        print(f"✂️ Applied crop: {width}x{height} at ({x}, {y})")

        return (cropped_image, cropped_mask, crop_json)


NODE_CLASS_MAPPINGS = {
    "INSTARAW_MaskToCrop": INSTARAW_MaskToCrop,
    "INSTARAW_ApplyCrop": INSTARAW_ApplyCrop,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_MaskToCrop": "📐 INSTARAW Mask to Crop",
    "INSTARAW_ApplyCrop": "✂️ INSTARAW Apply Crop",
}
