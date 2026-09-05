"""
ComfyUI custom nodes for ByteDance Seedream 4.5 Edit APIs (WaveSpeed & fal.ai).
Part of the AIOFC custom nodes collection by Aiofc.
"""

import logging
import io
import base64
import random as _random
import time as _time
import requests
import torch
import numpy as np
from PIL import Image

_SEEDREAM_SIZES = [
    "auto — match input (2K)",
    "1920*1920 — square (1:1)",
    "2560*1920 — landscape_4_3 (4:3)",
    "1920*2560 — portrait_4_3 (3:4)",
    "1536*1920 — portrait_4_5 (4:5)",
    "1920*1536 — landscape_5_4 (5:4)",
    "2560*1440 — landscape_16_9 (16:9)",
    "1440*2560 — portrait_16_9 (9:16)",
]

_FAL_SEEDREAM_SIZES = [
    "auto — match input (2K)",
    "1920*1920 — square (1:1)",
    "2560*1920 — landscape (4:3)",
    "1920*2560 — portrait (3:4)",
    "1536*1920 — portrait (4:5)",
    "1920*1536 — landscape (5:4)",
    "2560*1440 — landscape (16:9)",
    "1440*2560 — portrait (9:16)",
]

_FAL_SIZE_MAP = {
    "1920*1920": "square_hd",
    "2560*1920": "landscape_4_3",
    "1920*2560": "portrait_4_3",
    "1536*1920": {"width": 1536, "height": 1920},
    "1920*1536": {"width": 1920, "height": 1536},
    "2560*1440": "landscape_16_9",
    "1440*2560": "portrait_16_9",
}


def _image_bytes_to_tensor(raw, log_name):
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        logging.error("%s: failed to decode image: %s", log_name, e)
        raise RuntimeError(f"Failed to decode image from API: {e}") from e
    arr = np.array(image).astype(np.float32) / 255.0
    tensor = torch.from_numpy(arr)[None, ...]
    return (tensor,)


def _api_error_msg(service, e):
    msg = f"{service} API HTTP error: {e.response.status_code}"
    try:
        body = e.response.json()
        if "error" in body:
            msg += f" — {body.get('error', body)}"
        elif "message" in body:
            msg += f" — {body.get('message', body)}"
    except Exception:
        text = e.response.text
        if text:
            msg += f" — {text[:200]}"
    return msg


class SeedreamEditAPINode:
    """Edit images via ByteDance Seedream 4.5 Edit on WaveSpeed API (Aiofc)."""

    BASE_URL = "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit"
    _cached_api_key = ""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "wavespeed_apikey": ("STRING", {"default": "", "multiline": False}),
                "prompt": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "size": (_SEEDREAM_SIZES, {"default": "auto — match input (2K)"}),
                "num_images": ("INT", {"default": 1, "min": 1, "max": 4, "step": 1}),
                "use_custom_size": ("BOOLEAN", {"default": False}),
                "custom_width": ("INT", {"default": 2048, "min": 512, "max": 8192, "step": 64}),
                "custom_height": ("INT", {"default": 2048, "min": 512, "max": 8192, "step": 64}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "edit"
    CATEGORY = "AIOFC/Seedream"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def edit(self, images, wavespeed_apikey, prompt, size="auto — match input (2K)", num_images=1, use_custom_size=False, custom_width=2048, custom_height=2048):
        if wavespeed_apikey.strip():
            SeedreamEditAPINode._cached_api_key = wavespeed_apikey.strip()
        api_key = wavespeed_apikey.strip() or SeedreamEditAPINode._cached_api_key
        if not api_key:
            raise RuntimeError("Seedream 4.5 Edit: WaveSpeed API key is required.")
        if not prompt.strip():
            raise RuntimeError("Seedream 4.5 Edit: prompt is required.")
        if images.shape[0] == 0:
            raise RuntimeError("Seedream 4.5 Edit: at least one image is required.")

        if use_custom_size:
            api_size = f"{custom_width}*{custom_height}"
        elif size.startswith("auto"):
            h, w = images.shape[1], images.shape[2]
            min_pixels = 3686400
            scale = max(1.0, (min_pixels / (w * h)) ** 0.5)
            new_w = int(round(w * scale / 64) * 64)
            new_h = int(round(h * scale / 64) * 64)
            new_w = max(512, min(8192, new_w))
            new_h = max(512, min(8192, new_h))
            api_size = f"{new_w}*{new_h}"
            logging.info("Seedream auto size: input %dx%d -> output %s", w, h, api_size)
        else:
            api_size = size.split(" ")[0]

        image_uris = []
        count = min(images.shape[0], 10)
        for i in range(count):
            img_np = (255.0 * images[i].cpu().numpy()).clip(0, 255).astype(np.uint8)
            pil = Image.fromarray(img_np)
            buf = io.BytesIO()
            pil.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            image_uris.append(f"data:image/png;base64,{b64}")

        payload = {
            "images": image_uris,
            "prompt": prompt,
            "size": api_size,
            "num_images": num_images,
            "enable_sync_mode": True,
            "enable_base64_output": True,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(self.BASE_URL, json=payload, headers=headers, timeout=180)
            response.raise_for_status()
            result = response.json()
        except requests.exceptions.HTTPError as e:
            raise RuntimeError(_api_error_msg("Seedream 4.5 Edit", e))
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Seedream 4.5 Edit request error: {e!s}")

        data = result.get("data", {})

        if data.get("status") not in ("completed",):
            poll_url = data.get("urls", {}).get("get", "")
            if not poll_url:
                raise RuntimeError("Seedream 4.5 Edit: no poll URL and task not completed.")
            for _ in range(90):
                _time.sleep(2)
                try:
                    poll_resp = requests.get(poll_url, headers=headers, timeout=30)
                    poll_resp.raise_for_status()
                    data = poll_resp.json().get("data", {})
                except requests.exceptions.RequestException as e:
                    logging.warning("Seedream 4.5 Edit poll error: %s", e)
                    continue
                if data.get("status") == "completed":
                    break
                if data.get("status") == "failed":
                    raise RuntimeError(f"Seedream 4.5 Edit failed: {data.get('error', 'unknown error')}")
            else:
                raise RuntimeError("Seedream 4.5 Edit timed out after 3 minutes.")

        outputs = data.get("outputs", [])
        if not outputs:
            raise RuntimeError("Seedream 4.5 Edit: no images in API response.")

        tensors = []
        for idx, output in enumerate(outputs):
            if output.startswith("data:"):
                b64_data = output.split(",", 1)[-1]
                raw = base64.b64decode(b64_data)
            elif output.startswith("http"):
                try:
                    img_resp = requests.get(output, timeout=60)
                    img_resp.raise_for_status()
                    raw = img_resp.content
                except requests.exceptions.RequestException as e:
                    raise RuntimeError(f"Seedream 4.5 Edit: failed to download image {idx}: {e!s}")
            else:
                raw = base64.b64decode(output)
            tensor_tuple = _image_bytes_to_tensor(raw, "Seedream 4.5 Edit")
            tensors.append(tensor_tuple[0])

        if not tensors:
            raise RuntimeError("Seedream 4.5 Edit: no valid images decoded.")

        batched = torch.cat(tensors, dim=0)
        return (batched,)


class SeedreamEditFalAPINode:
    """Edit images via ByteDance Seedream 4.5 Edit on fal.ai (Aiofc)."""

    BASE_URL = "https://fal.run/fal-ai/bytedance/seedream/v4.5/edit"
    _cached_api_key = ""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "fal_apikey": ("STRING", {"default": "", "multiline": False}),
                "prompt": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "size": (_FAL_SEEDREAM_SIZES, {"default": "auto — match input (2K)"}),
                "num_images": ("INT", {"default": 1, "min": 1, "max": 4, "step": 1}),
                "use_custom_size": ("BOOLEAN", {"default": False}),
                "custom_width": ("INT", {"default": 2048, "min": 512, "max": 8192, "step": 64}),
                "custom_height": ("INT", {"default": 2048, "min": 512, "max": 8192, "step": 64}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "edit"
    CATEGORY = "AIOFC/Seedream"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def edit(self, images, fal_apikey, prompt, size="auto — match input (2K)", num_images=1, use_custom_size=False, custom_width=2048, custom_height=2048):
        if fal_apikey.strip():
            SeedreamEditFalAPINode._cached_api_key = fal_apikey.strip()
        api_key = fal_apikey.strip() or SeedreamEditFalAPINode._cached_api_key
        if not api_key:
            raise RuntimeError("Seedream 4.5 Edit (fal.ai): fal.ai API key is required.")
        if not prompt.strip():
            raise RuntimeError("Seedream 4.5 Edit (fal.ai): prompt is required.")
        if images.shape[0] == 0:
            raise RuntimeError("Seedream 4.5 Edit (fal.ai): at least one image is required.")

        if use_custom_size:
            fal_size = {"width": custom_width, "height": custom_height}
        elif size.startswith("auto"):
            h, w = images.shape[1], images.shape[2]
            target_pixels = 1920 * 1920
            current_pixels = w * h
            scale = (target_pixels / current_pixels) ** 0.5
            new_w = int(round(w * scale / 64) * 64)
            new_h = int(round(h * scale / 64) * 64)
            new_w = max(512, min(4096, new_w))
            new_h = max(512, min(4096, new_h))
            fal_size = {"width": new_w, "height": new_h}
            logging.info("Seedream (fal.ai) auto size: input %dx%d -> output %dx%d", w, h, new_w, new_h)
        else:
            dimension_str = size.split(" ")[0]
            fal_size = _FAL_SIZE_MAP.get(dimension_str, "square_hd")

        image_urls = []
        count = min(images.shape[0], 10)
        for i in range(count):
            img_np = (255.0 * images[i].cpu().numpy()).clip(0, 255).astype(np.uint8)
            pil = Image.fromarray(img_np)
            buf = io.BytesIO()
            pil.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            image_urls.append(f"data:image/png;base64,{b64}")

        payload = {
            "prompt": prompt,
            "image_urls": image_urls,
            "image_size": fal_size,
            "num_images": num_images,
            "seed": _random.randint(0, 2147483647),
            "enable_safety_checker": False,
        }
        headers = {
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(self.BASE_URL, json=payload, headers=headers, timeout=180)
            response.raise_for_status()
            result = response.json()
        except requests.exceptions.HTTPError as e:
            raise RuntimeError(_api_error_msg("Seedream 4.5 Edit (fal.ai)", e))
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Seedream 4.5 Edit (fal.ai) request error: {e!s}")

        fal_images = result.get("images", [])
        if not fal_images:
            raise RuntimeError("Seedream 4.5 Edit (fal.ai): no images in API response.")

        tensors = []
        for idx, fal_img in enumerate(fal_images):
            img_url = fal_img.get("url", "")
            if not img_url:
                logging.warning("Seedream 4.5 Edit (fal.ai): no URL for image %d, skipping.", idx)
                continue
            try:
                img_resp = requests.get(img_url, timeout=60)
                img_resp.raise_for_status()
                raw = img_resp.content
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f"Seedream 4.5 Edit (fal.ai): failed to download image {idx}: {e!s}")
            tensor_tuple = _image_bytes_to_tensor(raw, "Seedream 4.5 Edit (fal.ai)")
            tensors.append(tensor_tuple[0])

        if not tensors:
            raise RuntimeError("Seedream 4.5 Edit (fal.ai): no valid images downloaded.")

        batched = torch.cat(tensors, dim=0)
        return (batched,)


NODE_CLASS_MAPPINGS = {
    "SeedreamEditAPINode": SeedreamEditAPINode,
    "SeedreamEditFalAPINode": SeedreamEditFalAPINode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SeedreamEditAPINode": "Aiofc Seedream 4.5 Edit (Wavespeed)",
    "SeedreamEditFalAPINode": "Aiofc Seedream 4.5 Edit (fal.ai)",
}
