# ---
# ComfyUI INSTARAW - Generative API Nodes
# Part of the INSTARAW custom nodes collection by Instara
#
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

import requests
import base64
import io
import time
from PIL import Image
import numpy as np
import torch
import hashlib
import os
import json

# =================================================================================
# PAYLOAD BUILDER FUNCTIONS (WITH COMPRESSION AWARENESS)
# =================================================================================


def build_seedream_fal_payload(api_base, **kwargs):
    payload = {
        "prompt": kwargs.get("prompt"),
        "image_size": {"width": kwargs.get("width"), "height": kwargs.get("height")},
        "enable_safety_checker": kwargs.get("enable_safety_checker"),
    }
    if (seed := kwargs.get("seed", -1)) >= 0:
        payload["seed"] = seed
    
    # --- CORRECTED LOGIC WITH COMPRESSION ---
    images_b64 = [
        api_base.image_to_base64(img, max_size_mb=7) # Set a safe per-image limit
        for img in [kwargs.get(f"image_{i}") for i in range(1, 5)]
        if img is not None
    ]
    if images_b64:
        payload["image_urls"] = images_b64
        
    return payload


def build_seedream_wavespeed_payload(api_base, **kwargs):
    width = kwargs.get('width', 1024)
    height = kwargs.get('height', 1024)

    # SeeDream v4.5 requires minimum 3,686,400 pixels for output size
    MIN_PIXELS_SEEDREAM_V45 = 3686400
    current_pixels = width * height

    if current_pixels < MIN_PIXELS_SEEDREAM_V45:
        # Scale up output size proportionally to meet minimum
        scale_factor = (MIN_PIXELS_SEEDREAM_V45 / current_pixels) ** 0.5
        width = int(width * scale_factor) + 1
        height = int(height * scale_factor) + 1
        print(f"⬆️ Scaling output size from {kwargs.get('width')}x{kwargs.get('height')} to {width}x{height} to meet API minimum ({MIN_PIXELS_SEEDREAM_V45:,} px)")

    payload = {
        "prompt": kwargs.get("prompt"),
        "size": f"{width}*{height}",
    }

    # --- CORRECTED LOGIC WITH COMPRESSION ---
    images_b64 = [
        api_base.image_to_base64(img, include_prefix=False, max_size_mb=7)
        for img in [kwargs.get(f"image_{i}") for i in range(1, 5)]
        if img is not None
    ]
    if images_b64:
        payload["images"] = images_b64

    return payload


def build_nanobanana_fal_payload(api_base, **kwargs):
    payload = {"prompt": kwargs.get("prompt")}
    
    # --- CORRECTED LOGIC WITH COMPRESSION ---
    images_b64 = [
        api_base.image_to_base64(img, max_size_mb=7)
        for img in [kwargs.get(f"image_{i}") for i in range(1, 5)]
        if img is not None
    ]
    if images_b64:
        payload["image_urls"] = images_b64
    elif "aspect_ratio" in kwargs:
        payload["aspect_ratio"] = kwargs.get("aspect_ratio")
        
    return payload


def build_nanobanana_wavespeed_payload(api_base, **kwargs):
    payload = {"prompt": kwargs.get("prompt")}

    # Multi-image mode: generate 2 images per call for 50% cost savings
    num_images = kwargs.get("num_images", 1)
    if num_images > 1:
        payload["num_images"] = num_images

    # --- CORRECTED LOGIC WITH COMPRESSION ---
    images_b64 = [
        api_base.image_to_base64(img, include_prefix=False, max_size_mb=7)
        for img in [kwargs.get(f"image_{i}") for i in range(1, 5)]
        if img is not None
    ]
    if images_b64:
        payload["images"] = images_b64
    elif "aspect_ratio" in kwargs:
        payload["aspect_ratio"] = kwargs.get("aspect_ratio")

    return payload


def build_nanobanana_pro_fal_payload(api_base, **kwargs):
    """fal.ai payload for Nano Banana Pro (Gemini 3.0 Pro Image)"""
    payload = {
        "prompt": kwargs.get("prompt"),
        "num_images": 1,
        "output_format": "png",
    }

    # Check for input images (edit mode)
    images_b64 = [
        api_base.image_to_base64(img, max_size_mb=7)
        for img in [kwargs.get(f"image_{i}") for i in range(1, 5)]
        if img is not None
    ]

    if images_b64:
        # Edit mode - use provided aspect_ratio, default to "auto" if not specified
        payload["image_urls"] = images_b64
        payload["aspect_ratio"] = kwargs.get("aspect_ratio", "auto")
        if kwargs.get("resolution"):
            payload["resolution"] = kwargs.get("resolution")
    else:
        # T2I mode
        if kwargs.get("aspect_ratio"):
            payload["aspect_ratio"] = kwargs.get("aspect_ratio")
        if kwargs.get("resolution"):
            payload["resolution"] = kwargs.get("resolution")

    return payload


def build_nanobanana_pro_wavespeed_payload(api_base, **kwargs):
    """WaveSpeed payload for Nano Banana Pro (Gemini 3.0 Pro Image)"""
    payload = {
        "prompt": kwargs.get("prompt"),
        "output_format": "jpeg",
    }

    # Multi-image mode: generate 2 images per call for 50% cost savings
    num_images = kwargs.get("num_images", 1)
    if num_images > 1:
        payload["num_images"] = num_images

    # Check for input images (edit mode)
    images_b64 = [
        api_base.image_to_base64(img, include_prefix=False, max_size_mb=7)
        for img in [kwargs.get(f"image_{i}") for i in range(1, 5)]
        if img is not None
    ]

    if images_b64:
        # Edit mode
        payload["images"] = images_b64
        if kwargs.get("aspect_ratio"):
            payload["aspect_ratio"] = kwargs.get("aspect_ratio")
        if kwargs.get("resolution"):
            # WaveSpeed uses lowercase resolution
            payload["resolution"] = kwargs.get("resolution", "1k").lower()
    else:
        # T2I mode
        if kwargs.get("aspect_ratio"):
            payload["aspect_ratio"] = kwargs.get("aspect_ratio")
        if kwargs.get("resolution"):
            # WaveSpeed uses lowercase resolution
            payload["resolution"] = kwargs.get("resolution", "1k").lower()

    return payload


# =================================================================================
# MODEL CONFIGURATION
# =================================================================================

MODEL_CONFIG = {
    "SeeDream v4.5": {
        "providers": {
            "fal.ai": {
                "t2i_endpoint": "fal-ai/bytedance/seedream/v4.5/text-to-image",
                "i2i_endpoint": "fal-ai/bytedance/seedream/v4.5/edit",
                "build_payload": build_seedream_fal_payload,
            },
            "wavespeed.ai": {
                "t2i_endpoint": "bytedance/seedream-v4.5",
                "i2i_endpoint": "bytedance/seedream-v4.5/edit",
                "build_payload": build_seedream_wavespeed_payload,
            },
        }
    },
    "SeeDream v4": {
        "providers": {
            "fal.ai": {
                "t2i_endpoint": "fal-ai/bytedance/seedream/v4/text-to-image",
                "i2i_endpoint": "fal-ai/bytedance/seedream/v4/edit",
                "build_payload": build_seedream_fal_payload,
            },
            "wavespeed.ai": {
                "t2i_endpoint": "bytedance/seedream-v4",
                "i2i_endpoint": "bytedance/seedream-v4/edit",
                "build_payload": build_seedream_wavespeed_payload,
            },
        }
    },
    "Nano Banana": {
        "providers": {
            "fal.ai": {
                "t2i_endpoint": "fal-ai/nano-banana",
                "i2i_endpoint": "fal-ai/nano-banana/edit",
                "build_payload": build_nanobanana_fal_payload,
            },
            "wavespeed.ai": {
                "t2i_endpoint": "google/nano-banana/text-to-image",
                "i2i_endpoint": "google/nano-banana/edit",
                "build_payload": build_nanobanana_wavespeed_payload,
            },
        }
    },
    "Nano Banana Pro": {
        "providers": {
            "fal.ai": {
                "t2i_endpoint": "fal-ai/nano-banana-pro",
                "i2i_endpoint": "fal-ai/nano-banana-pro/edit",
                "build_payload": build_nanobanana_pro_fal_payload,
            },
            "wavespeed.ai": {
                "t2i_endpoint": "google/nano-banana-pro/text-to-image",
                "i2i_endpoint": "google/nano-banana-pro/edit",
                "build_payload": build_nanobanana_pro_wavespeed_payload,
            },
        }
    },
}

# =================================================================================
# BASE CLASS (WITH AUTO-COMPRESSION)
# =================================================================================


class INSTARAW_GenerativeAPIBase:
    def __init__(self):
        self.api_key = None

    def set_api_key(self, api_key):
        self.api_key = api_key

    def _log_and_update_hash(self, hasher, key, value):
        if value is None:
            return
        byte_value = b""
        if isinstance(value, str):
            byte_value = value.encode("utf-8")
        elif isinstance(value, (int, float, bool)):
            byte_value = str(value).encode("utf-8")
        elif isinstance(value, torch.Tensor):
            byte_value = value.cpu().numpy().tobytes()
        else:
            return
        hasher.update(byte_value)

    def image_to_base64(self, image_tensor, include_prefix=True, max_size_mb=7, min_pixels=None):
        if image_tensor is None:
            return None

        image_np = image_tensor.cpu().numpy()
        # Handle both [B, H, W, C] and [H, W, C] tensor formats
        if image_np.ndim == 4:
            image_np = image_np[0]  # Remove batch dimension
        if image_np.max() <= 1.0:
            image_np = (image_np * 255).astype(np.uint8)

        # Ensure image is in RGB format for JPEG saving
        image_pil = Image.fromarray(image_np).convert("RGB")

        # Upscale if image is too small (e.g., SeeDream v4.5 requires min 3,686,400 pixels)
        if min_pixels is not None:
            current_pixels = image_pil.width * image_pil.height
            if current_pixels < min_pixels:
                # Calculate scale factor to reach minimum pixels
                scale_factor = (min_pixels / current_pixels) ** 0.5
                new_width = int(image_pil.width * scale_factor) + 1  # +1 to ensure we exceed minimum
                new_height = int(image_pil.height * scale_factor) + 1
                print(f"⬆️ Upscaling image from {image_pil.width}x{image_pil.height} ({current_pixels:,} px) to {new_width}x{new_height} ({new_width * new_height:,} px) to meet API minimum ({min_pixels:,} px)")
                image_pil = image_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Define quality levels to try for compression
        quality_levels = [95, 90, 85, 80, 75]
        max_bytes = max_size_mb * 1024 * 1024

        buffer = io.BytesIO()
        for quality in quality_levels:
            buffer.seek(0)
            buffer.truncate(0)
            image_pil.save(buffer, format="JPEG", quality=quality)

            # Check if the compressed size is within the limit
            if buffer.tell() <= max_bytes:
                print(f"✅ Image compressed to JPEG (quality={quality}) to fit API limits. Size: {buffer.tell() / 1024:.2f} KB")
                base64_str = base64.b64encode(buffer.getvalue()).decode()
                mime_type = "image/jpeg"
                return f"data:{mime_type};base64,{base64_str}" if include_prefix else base64_str

        # If even the lowest quality is too large, raise an error
        final_size_kb = buffer.tell() / 1024
        raise Exception(f"Image is too large to send to the API. Even after compressing to lowest quality JPEG, size is {final_size_kb:.2f} KB (limit is {max_size_mb * 1024:.2f} KB). Please use a smaller input image.")

    def _submit_fal(self, endpoint, payload):
        url = f"https://fal.run/{endpoint}"
        headers = {
            "Authorization": f"Key {self.api_key}",
            "Content-Type": "application/json",
        }
        print(f"🚀 Submitting SYNC request to fal.ai: {url}")
        response = requests.post(url, json=payload, headers=headers, timeout=180)
        if not response.ok:
            if response.status_code == 422:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("detail", [{}])[0].get(
                        "msg", "Unknown validation error."
                    )
                    if "Gemini" in error_msg:
                        raise Exception(
                            f"API Error (422): The prompt was rejected by the provider's safety filter (fal.ai/Gemini). Try rephrasing sensitive terms or switch to a different provider."
                        )
                    else:
                        raise Exception(
                            f"API Error (422): Unprocessable Entity. Details: {error_msg}"
                        )
                except (json.JSONDecodeError, IndexError):
                    raise Exception(
                        f"API request failed with 422 (Unprocessable Entity), but the error response was not valid JSON."
                    )
            else:
                raise Exception(
                    f"API request failed: {response.status_code} - {response.text}"
                )
        result = response.json()
        print("📦 fal.ai sync response received.")
        if "images" in result and len(result["images"]) > 0:
            return result["images"][0]["url"]
        raise Exception(
            f"API response did not contain an image URL. Full response: {result}"
        )

    def _submit_wavespeed(self, e, p, return_all_outputs=False):
        """
        Submit request to Wavespeed.ai API.

        Args:
            e: Endpoint
            p: Payload
            return_all_outputs: If True, return list of all output URLs (for multi-image mode)
        """
        base, headers = "https://api.wavespeed.ai/api/v3", {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        num_images = p.get("num_images", 1)
        print(f"🚀 Submitting ASYNC task to wavespeed.ai: {base}/{e} (num_images={num_images})")
        r = requests.post(f"{base}/{e}", json=p, headers=headers, timeout=30)
        if not r.ok:
            # Extract error details for better UX
            error_text = r.text[:200]
            if "content" in error_text.lower() or "policy" in error_text.lower() or "422" in str(r.status_code):
                raise Exception(f"Content policy violation: {error_text}")
            raise Exception(f"API task submission failed: {r.status_code} - {error_text}")
        req_id = r.json()["data"]["id"]
        print(f"✅ Task submitted (ID: {req_id[:8]}...). Polling for result...")
        poll_url, start_time, timeout = (
            f"{base}/predictions/{req_id}/result",
            time.time(),
            300,
        )
        poll_count = 0
        while time.time() - start_time < timeout:
            pr = requests.get(poll_url, headers=headers, timeout=30)
            if not pr.ok:
                raise Exception(f"API polling failed: {pr.status_code} - {pr.text}")
            d = pr.json()["data"]
            status = d.get("status")
            if status == "completed":
                elapsed = time.time() - start_time
                outputs = d.get("outputs", [])
                print(f"✅ Task completed in {elapsed:.1f}s ({len(outputs)} image(s))")
                if return_all_outputs:
                    return outputs  # Return all image URLs for multi-image mode
                return outputs[0] if outputs else None
            if status == "failed":
                error_msg = d.get('error', 'Unknown error')
                # Check for content policy in error
                if any(x in str(error_msg).lower() for x in ['content', 'policy', 'safety', 'moderation']):
                    raise Exception(f"Content policy violation: {error_msg}")
                raise Exception(f"API task failed: {error_msg}")
            # Only log every 10 seconds (5 polls) to reduce spam
            poll_count += 1
            if poll_count % 5 == 1:
                elapsed = time.time() - start_time
                print(f"   ⏳ Waiting for result... ({elapsed:.0f}s elapsed, status: {status})")
            time.sleep(2)
        raise Exception("API task timed out after 5 minutes.")

    def submit_request(self, provider, endpoint, payload):
        if not self.api_key:
            raise ValueError(f"API key for {provider} not set.")
        if provider == "fal.ai":
            return self._submit_fal(endpoint, payload)
        if provider == "wavespeed.ai":
            return self._submit_wavespeed(endpoint, payload)
        raise ValueError(f"Unknown provider: {provider}")

    def execute_generation(self, is_i2i, cache_filename, **kwargs):
        provider, model = kwargs.get("provider"), kwargs.get("model")
        if not model:
            raise ValueError("Model not provided.")
        if not provider:
            raise ValueError("Provider not provided.")
        model_conf = MODEL_CONFIG.get(model)
        if not model_conf:
            raise ValueError(f"Invalid model selected: {model}")
        provider_conf = model_conf["providers"].get(provider)
        if not provider_conf:
            raise ValueError(
                f"Provider '{provider}' is not supported for model '{model}'"
            )
        endpoint = (
            provider_conf["i2i_endpoint"] if is_i2i else provider_conf["t2i_endpoint"]
        )
        build_payload_func = provider_conf["build_payload"]
        self.set_api_key(kwargs.get("api_key"))
        payload = build_payload_func(self, **kwargs)
        image_url = self.submit_request(provider, endpoint, payload)
        image_response = requests.get(image_url)
        image_response.raise_for_status()
        image_pil = Image.open(io.BytesIO(image_response.content)).convert("RGB")
        print(f"💾 Saving generated image to cache: {cache_filename}")
        image_pil.save(cache_filename, "PNG")
        image_np = np.array(image_pil).astype(np.float32) / 255.0
        return (torch.from_numpy(image_np).unsqueeze(0),)


# =================================================================================
# NODE IMPLEMENTATIONS
# =================================================================================


class INSTARAW_APITextToImage(INSTARAW_GenerativeAPIBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"forceInput": True}),
                "provider": ("STRING", {"forceInput": True}),
                "model": ("STRING", {"forceInput": True}),
                "prompt": (
                    "STRING",
                    {"multiline": True, "default": "A beautiful landscape"},
                ),
                "width": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "height": (
                    "INT",
                    {"default": 1024, "min": 64, "max": 4096, "step": 64},
                ),
                "aspect_ratio": (
                    [
                        "1:1",
                        "4:3",
                        "3:2",
                        "2:3",
                        "5:4",
                        "4:5",
                        "3:4",
                        "16:9",
                        "9:16",
                        "21:9",
                    ],
                    {"default": "1:1"},
                ),
                "enable_safety_checker": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "aspect_ratio_override": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Override aspect ratio from external node (e.g., Nano Banana Aspect Ratio)",
                    },
                ),
                "resolution": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Resolution tier (1K, 2K, 4K) for Nano Banana Pro",
                    },
                ),
            },
        }

    RETURN_TYPES, FUNCTION, CATEGORY = ("IMAGE",), "generate", "INSTARAW/API"

    def generate(self, **kwargs):
        # Handle aspect_ratio_override - if provided, use it instead of dropdown
        if kwargs.get("aspect_ratio_override"):
            kwargs["aspect_ratio"] = kwargs["aspect_ratio_override"]

        cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache")
        os.makedirs(cache_dir, exist_ok=True)
        hasher = hashlib.sha256()
        for key in sorted(kwargs.keys()):
            self._log_and_update_hash(hasher, key, kwargs[key])
        cache_filepath = os.path.join(cache_dir, f"{hasher.hexdigest()}_api_t2i.png")
        if os.path.exists(cache_filepath):
            print(f"✅ API T2I Cache Hit! Loading image from {cache_filepath}")
            return (
                torch.from_numpy(
                    np.array(Image.open(cache_filepath)).astype(np.float32) / 255.0
                ).unsqueeze(0),
            )
        print("💨 API T2I Cache Miss. Proceeding with API call...")
        return self.execute_generation(
            is_i2i=False, cache_filename=cache_filepath, **kwargs
        )


class INSTARAW_APIImageToImage(INSTARAW_GenerativeAPIBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"forceInput": True}),
                "provider": ("STRING", {"forceInput": True}),
                "model": ("STRING", {"forceInput": True}),
                "prompt": (
                    "STRING",
                    {"multiline": True, "default": "Transform image 1"},
                ),
                "enable_safety_checker": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "width": ("INT", {"default": 1024, "min": 64, "max": 4096, "step": 64}),
                "height": (
                    "INT",
                    {"default": 1024, "min": 64, "max": 4096, "step": 64},
                ),
                "image_1": ("IMAGE",),
                "image_2": ("IMAGE",),
                "image_3": ("IMAGE",),
                "image_4": ("IMAGE",),
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "aspect_ratio": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Aspect ratio from external node (e.g., Nano Banana Aspect Ratio)",
                    },
                ),
                "resolution": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Resolution tier (1K, 2K, 4K) for Nano Banana Pro",
                    },
                ),
            },
        }

    RETURN_TYPES, FUNCTION, CATEGORY = ("IMAGE",), "generate", "INSTARAW/API"

    def generate(
        self,
        api_key,
        provider,
        model,
        prompt,
        enable_safety_checker,
        width=1024,
        height=1024,
        image_1=None,
        image_2=None,
        image_3=None,
        image_4=None,
        seed=-1,
        aspect_ratio=None,
        resolution=None,
    ):
        # --- ADDED: Validate that at least one image is provided ---
        if all(img is None for img in [image_1, image_2, image_3, image_4]):
            raise ValueError("INSTARAW API I2I node requires at least one image input to be provided.")

        all_args = {
            "api_key": api_key,
            "provider": provider,
            "model": model,
            "image_1": image_1,
            "prompt": prompt,
            "enable_safety_checker": enable_safety_checker,
            "width": width,
            "height": height,
            "image_2": image_2,
            "image_3": image_3,
            "image_4": image_4,
            "seed": seed,
        }

        # Add optional aspect_ratio and resolution if provided
        if aspect_ratio:
            all_args["aspect_ratio"] = aspect_ratio
        if resolution:
            all_args["resolution"] = resolution
        cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache")
        os.makedirs(cache_dir, exist_ok=True)
        hasher = hashlib.sha256()
        hasher.update(b"01KEQ86BQNDGB0F9GVKEP6501V")
        for key in sorted(all_args.keys()):
            self._log_and_update_hash(hasher, key, all_args[key])
        cache_filepath = os.path.join(cache_dir, f"{hasher.hexdigest()}_api_i2i.png")
        if os.path.exists(cache_filepath):
            print(f"✅ API I2I Cache Hit! Loading image from {cache_filepath}")
            return (
                torch.from_numpy(
                    np.array(Image.open(cache_filepath)).astype(np.float32) / 255.0
                ).unsqueeze(0),
            )
        print("💨 API I2I Cache Miss. Proceeding with API call...")
        return self.execute_generation(
            is_i2i=True, cache_filename=cache_filepath, **all_args
        )


# =================================================================================
# EXPORT NODE MAPPINGS
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "INSTARAW_APITextToImage": INSTARAW_APITextToImage,
    "INSTARAW_APIImageToImage": INSTARAW_APIImageToImage,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_APITextToImage": "🎨 INSTARAW API T2I",
    "INSTARAW_APIImageToImage": "🎨 INSTARAW API I2I",
}