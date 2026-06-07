# ---
# ComfyUI INSTARAW - FLUX Fill API Node (fal.ai)
# Inpainting with FLUX.1 [dev] Fill model
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

import requests
import base64
import io
import time
import os
import hashlib
import numpy as np
import torch
from PIL import Image


class INSTARAW_FluxFill:
    """
    FLUX.1 [dev] Fill inpainting node using fal.ai API.
    Takes an image and mask, fills the masked area with generated content.
    Perfect for NSFW fix workflows where you need to add clothing to masked regions.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"forceInput": True, "tooltip": "fal.ai API key"}),
                "image": ("IMAGE", {"tooltip": "Input image to inpaint"}),
                "mask": ("MASK", {"tooltip": "Mask indicating area to fill (white = fill area)"}),
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": "wearing casual clothing, natural fabric, well-fitted",
                    "tooltip": "What to generate in the masked area"
                }),
            },
            "optional": {
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647, "tooltip": "-1 for random seed"}),
                "num_inference_steps": ("INT", {"default": 28, "min": 1, "max": 50, "tooltip": "Number of denoising steps"}),
                "guidance_scale": ("FLOAT", {"default": 30.0, "min": 1.0, "max": 50.0, "step": 0.5, "tooltip": "How closely to follow the prompt"}),
                "paste_back": ("BOOLEAN", {"default": True, "tooltip": "Paste original image onto non-inpainted areas"}),
                "resize_to_original": ("BOOLEAN", {"default": True, "tooltip": "Resize output back to original dimensions"}),
                "enable_safety_checker": ("BOOLEAN", {"default": False, "tooltip": "Enable fal.ai safety filter"}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("filled_image",)
    FUNCTION = "fill"
    CATEGORY = "INSTARAW/API"

    def image_to_base64(self, image_tensor, max_size_mb=7):
        """Convert image tensor to base64 data URI with compression."""
        if image_tensor is None:
            return None

        image_np = image_tensor.cpu().numpy()
        # Handle both [B, H, W, C] and [H, W, C] tensor formats
        if image_np.ndim == 4:
            image_np = image_np[0]  # Remove batch dimension
        if image_np.max() <= 1.0:
            image_np = (image_np * 255).astype(np.uint8)

        image_pil = Image.fromarray(image_np).convert("RGB")

        quality_levels = [95, 90, 85, 80, 75]
        max_bytes = max_size_mb * 1024 * 1024

        buffer = io.BytesIO()
        for quality in quality_levels:
            buffer.seek(0)
            buffer.truncate(0)
            image_pil.save(buffer, format="JPEG", quality=quality)

            if buffer.tell() <= max_bytes:
                base64_str = base64.b64encode(buffer.getvalue()).decode()
                return f"data:image/jpeg;base64,{base64_str}"

        raise Exception(f"Image too large even after compression to quality {quality_levels[-1]}")

    def mask_to_base64(self, mask_tensor, max_size_mb=7):
        """Convert mask tensor to base64 data URI (grayscale)."""
        if mask_tensor is None:
            return None

        # Handle different mask dimensions
        mask_np = mask_tensor.cpu().numpy()
        if mask_np.ndim == 4:
            mask_np = mask_np[0, 0]  # BCHW -> HW
        elif mask_np.ndim == 3:
            mask_np = mask_np[0]  # BHW -> HW

        if mask_np.max() <= 1.0:
            mask_np = (mask_np * 255).astype(np.uint8)
        else:
            mask_np = mask_np.astype(np.uint8)

        mask_pil = Image.fromarray(mask_np, mode="L")

        quality_levels = [95, 90, 85, 80, 75]
        max_bytes = max_size_mb * 1024 * 1024

        buffer = io.BytesIO()
        for quality in quality_levels:
            buffer.seek(0)
            buffer.truncate(0)
            mask_pil.save(buffer, format="JPEG", quality=quality)

            if buffer.tell() <= max_bytes:
                base64_str = base64.b64encode(buffer.getvalue()).decode()
                return f"data:image/jpeg;base64,{base64_str}"

        raise Exception(f"Mask too large even after compression")

    def submit_to_fal(self, api_key, payload):
        """Submit request to fal.ai FLUX Fill endpoint."""
        url = "https://fal.run/fal-ai/flux-lora-fill"
        headers = {
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        }

        print(f"🚀 FLUX Fill: Submitting request to fal.ai...")
        response = requests.post(url, json=payload, headers=headers, timeout=300)

        if not response.ok:
            error_text = response.text
            try:
                error_data = response.json()
                if "detail" in error_data:
                    error_text = str(error_data["detail"])
            except:
                pass
            raise Exception(f"fal.ai API error ({response.status_code}): {error_text}")

        result = response.json()
        print("📦 FLUX Fill: Response received from fal.ai")

        if "images" in result and len(result["images"]) > 0:
            return result["images"][0]["url"]

        raise Exception(f"FLUX Fill: No image in response. Full response: {result}")

    def fill(
        self,
        api_key,
        image,
        mask,
        prompt,
        seed=-1,
        num_inference_steps=28,
        guidance_scale=30.0,
        paste_back=True,
        resize_to_original=True,
        enable_safety_checker=False,
    ):
        # Get original dimensions for cache key
        _, orig_h, orig_w, _ = image.shape

        # Build cache key
        hasher = hashlib.sha256()
        hasher.update(image.cpu().numpy().tobytes())
        hasher.update(mask.cpu().numpy().tobytes())
        hasher.update(prompt.encode("utf-8"))
        hasher.update(str(seed).encode("utf-8"))
        hasher.update(str(num_inference_steps).encode("utf-8"))
        hasher.update(str(guidance_scale).encode("utf-8"))
        hasher.update(str(paste_back).encode("utf-8"))
        hasher.update(str(resize_to_original).encode("utf-8"))

        cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache")
        os.makedirs(cache_dir, exist_ok=True)
        cache_filepath = os.path.join(cache_dir, f"{hasher.hexdigest()}_flux_fill.png")

        # Check cache
        if os.path.exists(cache_filepath):
            print(f"✅ FLUX Fill: Cache hit! Loading from {cache_filepath}")
            cached_image = Image.open(cache_filepath).convert("RGB")
            cached_np = np.array(cached_image).astype(np.float32) / 255.0
            return (torch.from_numpy(cached_np).unsqueeze(0),)

        print("💨 FLUX Fill: Cache miss. Proceeding with API call...")

        # Convert image and mask to base64
        image_b64 = self.image_to_base64(image)
        mask_b64 = self.mask_to_base64(mask)

        # Build payload
        payload = {
            "prompt": prompt,
            "image_url": image_b64,
            "mask_url": mask_b64,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "paste_back": paste_back,
            "resize_to_original": resize_to_original,
            "enable_safety_checker": enable_safety_checker,
            "output_format": "jpeg",
            "num_images": 1,
        }

        # Add seed if specified
        if seed >= 0:
            payload["seed"] = seed

        # Submit request
        image_url = self.submit_to_fal(api_key, payload)

        # Download result
        print(f"⬇️ FLUX Fill: Downloading result...")
        image_response = requests.get(image_url, timeout=60)
        image_response.raise_for_status()

        result_pil = Image.open(io.BytesIO(image_response.content)).convert("RGB")

        # Save to cache
        print(f"💾 FLUX Fill: Saving to cache: {cache_filepath}")
        result_pil.save(cache_filepath, "PNG")

        # Convert to tensor
        result_np = np.array(result_pil).astype(np.float32) / 255.0
        result_tensor = torch.from_numpy(result_np).unsqueeze(0)

        print(f"✅ FLUX Fill: Complete! Output size: {result_pil.size}")

        return (result_tensor,)


# =================================================================================
# NODE REGISTRATION
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "INSTARAW_FluxFill": INSTARAW_FluxFill,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_FluxFill": "🎨 INSTARAW FLUX Fill (Inpaint)",
}
