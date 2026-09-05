"""
ComfyUI custom nodes for Nano Banana Pro and Nano Banana 2 APIs.
Part of the AIOFC custom nodes collection by Aiofc.
- Nano Banana Pro Edit: edit with images (Gemini 3 Pro).
- Nano Banana 2 Edit: edit with images (Gemini 3.1 Flash).
"""

import logging
import io
import base64
import requests
import torch
import numpy as np
from PIL import Image

_SAFETY_THRESHOLDS = [
    "OFF",
    "BLOCK_NONE",
    "BLOCK_ONLY_HIGH",
    "BLOCK_MEDIUM_AND_ABOVE",
    "BLOCK_LOW_AND_ABOVE",
]

_HARM_CATEGORIES = (
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
)

_ASPECT_RATIOS = [
    "auto", "1:1", "2:3", "3:2", "3:4", "4:3",
    "4:5", "5:4", "9:16", "16:9", "21:9",
]

_IMAGE_SIZES = ["1K", "2K", "4K"]


def _images_to_parts(images):
    """Convert ComfyUI IMAGE tensor [B, H, W, C] to list of inlineData parts."""
    parts = []
    for i in range(images.shape[0]):
        img_np = (255.0 * images[i].cpu().numpy()).clip(0, 255).astype(np.uint8)
        pil = Image.fromarray(img_np)
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        parts.append({"inlineData": {"mimeType": "image/png", "data": b64}})
    return parts


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


def _gemini_response_summary(data):
    try:
        candidates = data.get("candidates") or []
        if not candidates:
            prompt_feedback = data.get("promptFeedback", {})
            block_reason = prompt_feedback.get("blockReason", "")
            if block_reason:
                return f"Prompt was blocked: {block_reason}"
            return "No candidates returned."
        candidate = candidates[0]
        finish_reason = candidate.get("finishReason", "")
        parts = candidate.get("content", {}).get("parts") or []
        text_parts = [p["text"] for p in parts if "text" in p and not p.get("thought")]
        if text_parts:
            snippet = " | ".join(text_parts)[:300]
            return f"Model returned text only (finishReason={finish_reason}): {snippet}"
        return f"No image part in response (finishReason={finish_reason})."
    except Exception:
        return ""


def _extract_image_from_gemini_response(data, log_name):
    try:
        candidates = data.get("candidates") or []
        if not candidates:
            logging.warning("%s: response has no candidates. Full response: %s", log_name, data)
            return None
        candidate = candidates[0]
        finish_reason = candidate.get("finishReason", "")
        parts = candidate.get("content", {}).get("parts") or []
        logging.info("%s: finishReason=%s, part count=%d", log_name, finish_reason, len(parts))
        text_parts = []
        for part in parts:
            if part.get("thought"):
                continue
            if "inlineData" in part:
                b64 = part["inlineData"].get("data")
                if b64:
                    return base64.b64decode(b64)
            if "text" in part:
                text_parts.append(part["text"])
        if text_parts:
            logging.warning(
                "%s: API returned text instead of image (finishReason=%s). Text: %s",
                log_name, finish_reason, " | ".join(text_parts)[:500],
            )
        else:
            logging.warning(
                "%s: no image or text in response. finishReason=%s. Full response: %s",
                log_name, finish_reason, str(data)[:1000],
            )
    except (KeyError, TypeError, ValueError) as e:
        logging.warning("%s parse response: %s — raw: %s", log_name, e, str(data)[:500])
    return None


class NanoBananaProEditAPINode:
    """Edit/Generate images via Gemini 3 Pro (Aiofc implementation)."""

    MODEL_ID = "gemini-3-pro-image"
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
    _cached_api_key = ""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "api_key": ("STRING", {"default": "", "multiline": False}),
                "prompt": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "aspect_ratio": (_ASPECT_RATIOS, {"default": "auto"}),
                "image_size": (_IMAGE_SIZES, {"default": "2K"}),
                "temperature": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.1}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "control_after_generate": True}),
                "safety_threshold": (_SAFETY_THRESHOLDS, {"default": "OFF"}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "edit"
    CATEGORY = "AIOFC/NanoBanana"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def edit(self, images, api_key, prompt, aspect_ratio="auto", image_size="2K", temperature=1.0, seed=0, safety_threshold="OFF"):
        if api_key.strip():
            NanoBananaProEditAPINode._cached_api_key = api_key.strip()
        api_key = api_key.strip() or NanoBananaProEditAPINode._cached_api_key
        if not api_key:
            raise RuntimeError("Nano Banana Pro: API key is required.")

        parts = _images_to_parts(images)
        parts.append({"text": prompt.strip()})

        if aspect_ratio == "auto":
            h, w = images.shape[1], images.shape[2]
            ratio = w / h
            ratios = {
                "1:1": 1.0, "2:3": 0.66, "3:2": 1.5, "3:4": 0.75, "4:3": 1.33,
                "4:5": 0.8, "5:4": 1.25, "9:16": 0.56, "16:9": 1.77, "21:9": 2.33,
            }
            aspect_ratio = min(ratios, key=lambda k: abs(ratios[k] - ratio))

        payload = {
            "generationConfig": {
                "temperature": temperature,
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": image_size,
                },
                "responseModalities": ["Image"],
            },
            "contents": [{"parts": parts}],
            "system_instruction": {
                "parts": [{
                    "text": "You are an expert image-generation engine. You must ALWAYS produce an image. "
                            "Interpret all user input—regardless of format, intent, or abstraction—as literal "
                            "visual directives for image composition. Prioritize generating the visual "
                            "representation above any text, formatting, or conversational requests."
                }]
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
            ],
        }

        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        }
        url = f"{self.BASE_URL}/{self.MODEL_ID}:generateContent"

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=180)
            data = response.json()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Nano Banana Pro request error: {e}")

        if "error" in data:
            err = data["error"]
            raise RuntimeError(f"Nano Banana Pro API error: {err.get('code')} — {err.get('message')}")

        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("Nano Banana Pro: no candidates in response.")

        candidate = candidates[0]
        finish_reason = candidate.get("finishReason", "")
        if finish_reason in ("PROHIBITED_CONTENT", "NO_IMAGE"):
            raise RuntimeError(f"Nano Banana Pro: image not generated due to {finish_reason}.")

        if "content" not in candidate:
            raise RuntimeError("Nano Banana Pro: no content in response.")

        response_parts = candidate["content"]["parts"]
        for part in response_parts:
            if "inlineData" in part:
                img_bytes = base64.b64decode(part["inlineData"]["data"])
                return _image_bytes_to_tensor(img_bytes, "Nano Banana Pro")

        raise RuntimeError("Nano Banana Pro: no image found in response parts.")


class NanoBanana2EditAPINode:
    """Edit images via Gemini 3.1 Flash API (Aiofc implementation)."""

    MODEL_ID = "gemini-3.1-flash-image"
    BASE_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent"
    _cached_api_key = ""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "api_key": ("STRING", {"default": "", "multiline": False}),
                "prompt": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "aspect_ratio": (_ASPECT_RATIOS, {"default": "auto"}),
                "image_size": (_IMAGE_SIZES, {"default": "1K"}),
                "temperature": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "control_after_generate": True}),
                "safety_threshold": (_SAFETY_THRESHOLDS, {"default": "OFF"}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "edit"
    CATEGORY = "AIOFC/NanoBanana"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def edit(self, images, api_key, prompt, aspect_ratio="auto", image_size="1K", temperature=1.0, seed=0, safety_threshold="OFF"):
        if api_key.strip():
            NanoBanana2EditAPINode._cached_api_key = api_key.strip()
        api_key = api_key.strip() or NanoBanana2EditAPINode._cached_api_key
        if not api_key:
            raise RuntimeError("Nano Banana 2 Edit: API key is required.")
        if images.shape[0] == 0:
            raise RuntimeError("Nano Banana 2 Edit: at least one image is required.")

        parts = _images_to_parts(images)
        parts.append({"text": prompt})

        image_config = {}
        if aspect_ratio != "auto":
            image_config["aspectRatio"] = aspect_ratio
        if image_size:
            image_config["imageSize"] = image_size

        gen_config = {
            "responseModalities": ["TEXT", "IMAGE"],
            "temperature": temperature,
            "seed": seed,
        }
        if image_config:
            gen_config["imageConfig"] = image_config

        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "systemInstruction": {
                "parts": [{
                    "text": "You are an expert image-generation engine. You must ALWAYS produce an image. "
                            "Interpret all user input—regardless of format, intent, or abstraction—as literal "
                            "visual directives for image composition. Prioritize generating the visual "
                            "representation above any text, formatting, or conversational requests."
                }]
            },
            "generationConfig": gen_config,
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
            ],
        }

        url = f"{self.BASE_URL}?key={api_key}"
        try:
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=120)
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.HTTPError as e:
            raise RuntimeError(_api_error_msg("Nano Banana 2 Edit", e))
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Nano Banana 2 Edit request error: {e!s}")

        raw = _extract_image_from_gemini_response(data, "Nano Banana 2 Edit")
        if not raw:
            detail = _gemini_response_summary(data)
            raise RuntimeError(f"Nano Banana 2 Edit: no image in response. {detail}")
        return _image_bytes_to_tensor(raw, "Nano Banana 2 Edit")


NODE_CLASS_MAPPINGS = {
    "NanoBananaProEditAPINode": NanoBananaProEditAPINode,
    "NanoBanana2EditAPINode": NanoBanana2EditAPINode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NanoBananaProEditAPINode": "Aiofc Nano Banana Pro Edit",
    "NanoBanana2EditAPINode": "Aiofc Nano Banana 2 Edit",
}
