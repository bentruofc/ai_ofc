# ---
# ComfyUI INSTARAW - Nano Banana Pro Multi Node
# WaveSpeed.ai exclusive - generates 2 images per call at half the cost
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

import requests
import io
import time
import os
import hashlib
import numpy as np
import torch
from PIL import Image


class INSTARAW_NanoBananaProMulti:
    """
    Nano Banana Pro Multi - WaveSpeed exclusive endpoint.
    Generates 2 images per call at half the cost ($0.07/image vs $0.14/image).
    Limited aspect ratios: 3:2, 2:3, 3:4, 4:3 only.
    Text-to-image only (no edit mode).
    """

    # Limited aspect ratios for multi endpoint
    MULTI_ASPECT_RATIOS = [
        "3:2",
        "2:3",
        "3:4",
        "4:3",
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "WaveSpeed.ai API key (Bearer token)",
                    },
                ),
                "prompt": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "A beautiful landscape photograph",
                        "tooltip": "Text prompt for image generation",
                    },
                ),
                "aspect_ratio": (
                    cls.MULTI_ASPECT_RATIOS,
                    {
                        "default": "3:2",
                        "tooltip": "Aspect ratio (limited options for multi endpoint)",
                    },
                ),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("images",)
    FUNCTION = "generate"
    CATEGORY = "INSTARAW/API"
    DESCRIPTION = (
        "Nano Banana Pro Multi - Generates 2 images per call at $0.07/image. "
        "WaveSpeed.ai exclusive. Limited aspect ratios."
    )

    def _submit_wavespeed(self, api_key, payload):
        """Submit async request to WaveSpeed.ai and poll for result."""
        base_url = "https://api.wavespeed.ai/api/v3"
        endpoint = "google/nano-banana-pro/text-to-image-multi"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        print(f"🚀 Nano Banana Pro Multi: Submitting request to WaveSpeed.ai...")
        print(f"   Endpoint: {base_url}/{endpoint}")

        # Submit task
        response = requests.post(
            f"{base_url}/{endpoint}",
            json=payload,
            headers=headers,
            timeout=30,
        )

        if not response.ok:
            raise Exception(
                f"WaveSpeed API task submission failed: {response.status_code} - {response.text}"
            )

        result = response.json()
        request_id = result["data"]["id"]
        print(f"✅ Task submitted. Request ID: {request_id}. Polling for result...")

        # Poll for result
        poll_url = f"{base_url}/predictions/{request_id}/result"
        start_time = time.time()
        timeout = 300  # 5 minutes

        while time.time() - start_time < timeout:
            poll_response = requests.get(poll_url, headers=headers, timeout=30)

            if not poll_response.ok:
                raise Exception(
                    f"WaveSpeed API polling failed: {poll_response.status_code} - {poll_response.text}"
                )

            data = poll_response.json()["data"]
            status = data.get("status")

            if status == "completed":
                print("✅ Task completed!")
                return data["outputs"]  # Returns list of image URLs

            if status == "failed":
                error_msg = data.get("error", "Unknown error")
                raise Exception(f"WaveSpeed API task failed: {error_msg}")

            print(f"⌛ Task status: {status}. Waiting...")
            time.sleep(2)

        raise Exception("WaveSpeed API task timed out after 5 minutes.")

    def generate(self, api_key, prompt, aspect_ratio):
        """Generate 2 images using Nano Banana Pro Multi endpoint."""

        # Build cache key
        hasher = hashlib.sha256()
        hasher.update(prompt.encode("utf-8"))
        hasher.update(aspect_ratio.encode("utf-8"))
        hasher.update(b"nano_banana_pro_multi")

        cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache")
        os.makedirs(cache_dir, exist_ok=True)
        cache_hash = hasher.hexdigest()

        # Check cache for both images
        cache_files = [
            os.path.join(cache_dir, f"{cache_hash}_multi_{i}.png") for i in range(2)
        ]

        if all(os.path.exists(f) for f in cache_files):
            print(f"✅ Nano Banana Pro Multi: Cache hit! Loading from cache...")
            tensors = []
            for cache_file in cache_files:
                img = Image.open(cache_file).convert("RGB")
                img_np = np.array(img).astype(np.float32) / 255.0
                tensors.append(torch.from_numpy(img_np))
            return (torch.stack(tensors),)

        print("💨 Nano Banana Pro Multi: Cache miss. Proceeding with API call...")

        # Build payload
        payload = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "num_images": 2,
            "output_format": "jpeg",
        }

        # Submit request
        image_urls = self._submit_wavespeed(api_key, payload)

        if not image_urls or len(image_urls) < 2:
            raise Exception(
                f"Nano Banana Pro Multi: Expected 2 images, got {len(image_urls) if image_urls else 0}"
            )

        # Download and process images
        print(f"⬇️ Nano Banana Pro Multi: Downloading {len(image_urls)} images...")
        tensors = []

        for i, image_url in enumerate(image_urls[:2]):  # Take first 2 images
            image_response = requests.get(image_url, timeout=60)
            image_response.raise_for_status()

            image_pil = Image.open(io.BytesIO(image_response.content)).convert("RGB")

            # Save to cache
            cache_file = cache_files[i]
            print(f"💾 Saving image {i + 1} to cache: {cache_file}")
            image_pil.save(cache_file, "PNG")

            # Convert to tensor
            image_np = np.array(image_pil).astype(np.float32) / 255.0
            tensors.append(torch.from_numpy(image_np))

        # Stack into batch tensor
        result_tensor = torch.stack(tensors)

        print(
            f"✅ Nano Banana Pro Multi: Complete! Generated {len(tensors)} images, shape: {result_tensor.shape}"
        )

        return (result_tensor,)


# =================================================================================
# NODE REGISTRATION
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "INSTARAW_NanoBananaProMulti": INSTARAW_NanoBananaProMulti,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_NanoBananaProMulti": "🍌 INSTARAW Nano Banana Pro Multi (2x)",
}
