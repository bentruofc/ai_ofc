# ---
# ComfyUI INSTARAW - Interactive Batch Image Generator
# Production-ready parallel image generation with retry logic and interactive selection
# Copyright © 2025 Instara. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
INSTARAW Interactive Batch Image Generator

A premium interactive node for parallel image generation featuring:
- Real-time parallel generation with configurable concurrency
- Smart auto-retry with exponential backoff (bypasses moderation filters)
- Interactive selection UI with job status display
- Full RPG integration (positive/negative prompts, seeds)
- I2I mode with reference image cycling
- Comprehensive progress logging
- Image caching for completed generations
- Real-time UI progress updates via WebSocket
"""

import os
import io
import time
import hashlib
import json
import threading
import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from enum import Enum

import requests
import numpy as np
import torch
from PIL import Image

from nodes import PreviewImage
from comfy.model_management import InterruptProcessingException
from server import PromptServer
from aiohttp import web

from .image_filter_messaging import send_and_wait, Response, TimeoutResponse
from ..api_nodes.generative_api_nodes import MODEL_CONFIG, INSTARAW_GenerativeAPIBase


# ═══════════════════════════════════════════════════════════════════════════════
# ULID GENERATOR FOR UNIQUE FILENAMES
# ═══════════════════════════════════════════════════════════════════════════════

# Crockford's Base32 alphabet (excludes I, L, O, U to avoid confusion)
_ULID_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

def generate_ulid() -> str:
    """
    Generate a ULID (Universally Unique Lexicographically Sortable Identifier).

    Format: 26 characters
    - First 10 chars: timestamp (milliseconds since epoch)
    - Last 16 chars: randomness

    ULIDs are:
    - Guaranteed unique
    - Lexicographically sortable (sorts by creation time)
    - URL-safe and filename-safe

    Example: 01HGX5J8K2P3Q4R5T6V7W8X9YZ
    """
    import random

    # Timestamp component (48 bits = 10 chars)
    timestamp_ms = int(time.time() * 1000)
    timestamp_part = ""
    for _ in range(10):
        timestamp_part = _ULID_CHARS[timestamp_ms & 31] + timestamp_part
        timestamp_ms >>= 5

    # Randomness component (80 bits = 16 chars)
    random_part = "".join(random.choice(_ULID_CHARS) for _ in range(16))

    return timestamp_part + random_part


class JobState(Enum):
    """Generation job states."""
    PENDING = "pending"
    GENERATING = "generating"
    SUCCESS = "success"
    FAILED = "failed"
    CACHED = "cached"
    RETRYING = "retrying"


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL PROGRESS TRACKING FOR REAL-TIME UI UPDATES
# ═══════════════════════════════════════════════════════════════════════════════

class ProgressTracker:
    """
    Global singleton for tracking generation progress across all nodes.
    Enables real-time UI updates via polling or WebSocket events.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._progress_data = {}
        return cls._instance

    def start_generation(self, node_id: int, jobs: List['GenerationJob']):
        """Initialize progress tracking for a generation session."""
        self._progress_data[node_id] = {
            "jobs": [self._job_to_dict(j) for j in jobs],
            "stats": {
                "total": len(jobs),
                "completed": 0,
                "success": 0,
                "failed": 0,
                "cached": 0,
            },
            "is_generating": True,
            "should_stop": False,  # Flag to stop generation
            "start_time": time.time(),
        }
        self._emit_event("instaraw-batch-gen-start", {
            "node_id": node_id,
            "jobs": self._progress_data[node_id]["jobs"],
        })

    def update_job(self, node_id: int, job: 'GenerationJob'):
        """Update a single job's status."""
        if node_id not in self._progress_data:
            return

        data = self._progress_data[node_id]
        for i, j in enumerate(data["jobs"]):
            if j["id"] == job.id:
                data["jobs"][i] = self._job_to_dict(job)
                break

        # Update stats
        jobs = data["jobs"]
        data["stats"]["completed"] = sum(1 for j in jobs if j["state"] in ["success", "failed", "cached"])
        data["stats"]["success"] = sum(1 for j in jobs if j["state"] == "success")
        data["stats"]["failed"] = sum(1 for j in jobs if j["state"] == "failed")
        data["stats"]["cached"] = sum(1 for j in jobs if j["state"] == "cached")

        self._emit_event("instaraw-batch-gen-update", {
            "node_id": node_id,
            "job_id": job.id,
            "state": job.state.value,
            "attempts": job.attempts,
            "error": job.error,
            "generation_time": job.generation_time,
            "image_url": job.result_image_url,
            "image_width": job.result_image_width,
            "image_height": job.result_image_height,
        })

    def complete_generation(self, node_id: int):
        """Mark generation as complete."""
        if node_id in self._progress_data:
            self._progress_data[node_id]["is_generating"] = False
            self._emit_event("instaraw-batch-gen-complete", {
                "node_id": node_id,
                "stats": self._progress_data[node_id]["stats"],
            })

    def get_progress(self, node_id: int) -> Optional[Dict]:
        """Get current progress for a node."""
        return self._progress_data.get(node_id)

    def clear_progress(self, node_id: int):
        """Clear progress data for a node."""
        if node_id in self._progress_data:
            del self._progress_data[node_id]

    def stop_generation(self, node_id: int):
        """Request generation to stop."""
        print(f"[ProgressTracker] stop_generation called for node {node_id}", flush=True)
        if node_id in self._progress_data:
            self._progress_data[node_id]["should_stop"] = True
            self._progress_data[node_id]["is_generating"] = False
            print(f"[ProgressTracker] Set should_stop=True for node {node_id}", flush=True)
        else:
            print(f"[ProgressTracker] WARNING: Node {node_id} not in progress_data!", flush=True)

    def should_stop(self, node_id: int) -> bool:
        """Check if generation should stop."""
        if node_id in self._progress_data:
            return self._progress_data[node_id].get("should_stop", False)
        return False

    def _job_to_dict(self, job: 'GenerationJob') -> Dict:
        """Convert job to serializable dict."""
        return {
            "id": job.id,
            "prompt_positive": job.prompt_positive[:100] + "..." if len(job.prompt_positive) > 100 else job.prompt_positive,
            "state": job.state.value,
            "attempts": job.attempts,
            "error": job.error[:100] if job.error else None,
            "generation_time": job.generation_time,
            "cache_hit": job.cache_hit,
            "image_url": job.result_image_url,
            "image_width": job.result_image_width,
            "image_height": job.result_image_height,
            "filename": job.result_filename,
        }

    def _emit_event(self, event_type: str, data: Dict):
        """Emit event to frontend via PromptServer."""
        try:
            PromptServer.instance.send_sync(event_type, data)
        except Exception as e:
            print(f"[BIG] Failed to emit event {event_type}: {e}", flush=True)


# Global progress tracker instance
progress_tracker = ProgressTracker()


# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS FOR REAL-TIME PROGRESS
# ═══════════════════════════════════════════════════════════════════════════════

@PromptServer.instance.routes.get('/instaraw/batch_gen_progress/{node_id}')
async def get_batch_gen_progress(request):
    """Get current generation progress for a node."""
    try:
        node_id = int(request.match_info['node_id'])
        progress = progress_tracker.get_progress(node_id)
        if progress:
            return web.json_response(progress)
        return web.json_response({"jobs": [], "stats": {}, "is_generating": False})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post('/instaraw/batch_gen_retry_failed')
async def retry_failed_jobs(request):
    """Endpoint to retry all failed jobs for a node."""
    try:
        data = await request.json()
        node_id = data.get("node_id")
        # This would need to trigger a re-execution - for now just acknowledge
        return web.json_response({"status": "acknowledged", "message": "Retry not yet implemented"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post('/instaraw/batch_gen_retry_job')
async def retry_single_job(request):
    """Endpoint to retry a single failed job."""
    try:
        data = await request.json()
        node_id = data.get("node_id")
        job_id = data.get("job_id")
        # This would need to trigger a re-execution - for now just acknowledge
        return web.json_response({"status": "acknowledged", "message": "Retry not yet implemented"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post('/instaraw/batch_gen_stop')
async def stop_generation(request):
    """Endpoint to stop ongoing generation."""
    try:
        data = await request.json()
        node_id = data.get("node_id")

        tracker = ProgressTracker()
        tracker.stop_generation(node_id)

        return web.json_response({"status": "stopped", "node_id": node_id})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get('/instaraw/batch_gen_image/{subdir}/{filename}')
async def serve_batch_gen_image(request):
    """
    Serve images from ComfyUI's output folder (backwards compatibility endpoint).
    URL format: /instaraw/batch_gen_image/{subdir}/{filename}
    Example: /instaraw/batch_gen_image/batch_gen/image_0_123456.png
    Note: Prefer using /view?filename=...&subfolder=...&type=output instead.
    """
    try:
        import folder_paths
        subdir = request.match_info.get('subdir', 'batch_gen')
        filename = request.match_info.get('filename', '')

        # Security: prevent directory traversal
        if '..' in subdir or '..' in filename or '/' in filename or '\\' in filename:
            return web.Response(status=403, text="Invalid path")

        # Build path to ComfyUI's output folder
        comfy_output = folder_paths.get_output_directory()
        filepath = os.path.join(comfy_output, subdir, filename)

        if not os.path.exists(filepath):
            print(f"[BIG] Image not found: {filepath}", flush=True)
            return web.Response(status=404, text="Image not found")

        # Determine content type
        ext = os.path.splitext(filename)[1].lower()
        content_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        }
        content_type = content_types.get(ext, 'application/octet-stream')

        # Read and return file
        with open(filepath, 'rb') as f:
            data = f.read()

        return web.Response(body=data, content_type=content_type)
    except Exception as e:
        print(f"[BIG] Error serving image: {e}", flush=True)
        return web.Response(status=500, text=str(e))


def _generate_multi_image(
    engine,
    api_key: str,
    provider: str,
    model: str,
    prompt_positive: str,
    prompt_negative: str,
    aspect_ratio: str,
    resolution: str,
    width: int,
    height: int,
    use_negative_prompt: bool,
    input_image,  # Optional tensor for I2I (image_1)
    input_image2,  # Optional tensor (image_2 - clothes etc)
    input_image3,  # Optional tensor (image_3 - background etc)
    input_image4,  # Optional tensor (image_4 - pose etc)
    filename_prefix: str,
    job_ids: list,
    use_cache: bool = True,
    cache_keys: list = None,
    node_id: str = None,
) -> dict:
    """
    Generate 2 images in a single API call (Wavespeed.ai multi-image mode).
    Returns dict with both image results for 50% cost savings.
    """
    from ..api_nodes.generative_api_nodes import MODEL_CONFIG
    import base64 as b64

    start_time = time.time()

    # Multi-image endpoint only supports these aspect ratios
    MULTI_SUPPORTED_RATIOS = ["3:2", "2:3", "3:4", "4:3"]

    # Map unsupported ratios to closest supported one
    RATIO_MAPPING = {
        "1:1": "3:4",      # Square -> Portrait (closest)
        "16:9": "3:2",     # Wide landscape -> Landscape
        "9:16": "2:3",     # Tall portrait -> Portrait
        "4:5": "3:4",      # Portrait -> Portrait
        "5:4": "4:3",      # Landscape -> Landscape
        "21:9": "3:2",     # Ultra-wide -> Landscape
    }

    # Validate and map aspect ratio
    original_aspect = aspect_ratio
    if aspect_ratio not in MULTI_SUPPORTED_RATIOS:
        aspect_ratio = RATIO_MAPPING.get(aspect_ratio, "3:2")  # Default to 3:2 if unknown
        print(f"[BIG] ⚠️ Multi-image: Aspect ratio '{original_aspect}' not supported, using '{aspect_ratio}' instead", flush=True)

    # Build prompt
    if use_negative_prompt and prompt_negative.strip():
        if model in ["Nano Banana Pro", "Nano Banana"]:
            full_prompt = f"{prompt_positive}\n\nAvoid: {prompt_negative}"
        else:
            full_prompt = prompt_positive
    else:
        full_prompt = prompt_positive

    # Get model config
    model_conf = MODEL_CONFIG.get(model)
    if not model_conf:
        raise Exception(f"Invalid model: {model}")

    provider_conf = model_conf["providers"].get(provider)
    if not provider_conf:
        raise Exception(f"Provider '{provider}' not supported for {model}")

    # Determine endpoint - use -multi suffix for multi-image mode
    # Check if ANY image input is provided (not just image_1)
    is_i2i = any(img is not None for img in [input_image, input_image2, input_image3, input_image4])
    base_endpoint = provider_conf["i2i_endpoint"] if is_i2i else provider_conf["t2i_endpoint"]
    # Wavespeed.ai multi-image endpoints require -multi suffix
    endpoint = f"{base_endpoint}-multi"
    build_payload_func = provider_conf["build_payload"]

    # Build kwargs for payload
    kwargs = {
        "prompt": full_prompt,
        "aspect_ratio": aspect_ratio,
        "width": width,
        "height": height,
        "resolution": resolution,
        "num_images": 2,  # Request 2 images
    }
    if input_image is not None:
        kwargs["image_1"] = input_image
    if input_image2 is not None:
        kwargs["image_2"] = input_image2
    if input_image3 is not None:
        kwargs["image_3"] = input_image3
    if input_image4 is not None:
        kwargs["image_4"] = input_image4

    engine.set_api_key(api_key)
    payload = build_payload_func(engine, **kwargs)

    print(f"[BIG] 🎯 Multi-image: Requesting 2 images from {provider}/{endpoint}", flush=True)

    # Call API with return_all_outputs=True to get both images
    image_urls = engine._submit_wavespeed(endpoint, payload, return_all_outputs=True)

    if not image_urls or len(image_urls) < 2:
        raise Exception(f"Expected 2 images but got {len(image_urls) if image_urls else 0}")

    generation_time = time.time() - start_time
    print(f"[BIG] 🎯 Multi-image: Got {len(image_urls)} images in {generation_time:.1f}s", flush=True)

    # Process both images
    results = []
    for i, (image_url, job_id) in enumerate(zip(image_urls[:2], job_ids)):
        try:
            # Download image
            response = requests.get(image_url, timeout=120)
            response.raise_for_status()
            img_pil = Image.open(io.BytesIO(response.content)).convert("RGB")
            img_width, img_height = img_pil.size

            # Convert to tensor
            img_np = np.array(img_pil).astype(np.float32) / 255.0
            tensor = torch.from_numpy(img_np)

            # Save to cache for future use
            if use_cache and cache_keys and i < len(cache_keys):
                engine._save_to_cache(cache_keys[i], tensor)
                print(f"[BIG] 💾 Multi-image: Saved image {i+1} to cache", flush=True)

            # Save to output folder
            output_filename, subfolder = engine._save_to_output(tensor, job_id, prompt_positive, filename_prefix, node_id)

            # Create base64 preview
            buffer = io.BytesIO()
            img_pil.save(buffer, format="JPEG", quality=85)
            b64_data = b64.b64encode(buffer.getvalue()).decode('utf-8')
            preview_url = f"data:image/jpeg;base64,{b64_data}"

            results.append({
                "job_id": job_id,
                "status": "success",
                "state": "success",
                "image_url": preview_url,
                "width": img_width,
                "height": img_height,
                "filename": output_filename,
                "subfolder": subfolder,
            })
            print(f"[BIG] 🎯 Multi-image: Processed image {i+1} for job #{job_id}", flush=True)

        except Exception as e:
            print(f"[BIG] ⚠️ Multi-image: Failed to process image {i+1}: {e}", flush=True)
            results.append({
                "job_id": job_id,
                "status": "failed",
                "state": "failed",
                "error": str(e),
            })

    return {
        "status": "success",
        "multi_image": True,
        "generation_time": generation_time,
        "results": results,
        "attempts": 1,
    }


@PromptServer.instance.routes.post('/instaraw/batch_gen_generate_single')
async def generate_single_image(request):
    """
    Endpoint for UI-triggered single image generation (RPG-style).
    Generates image via API, saves to persistent output folder, returns metadata.
    """
    from PIL import Image
    import io
    import base64

    try:
        data = await request.json()

        # Extract parameters
        node_id = data.get("node_id")
        job_id = data.get("job_id")
        api_key = data.get("api_key")
        provider = data.get("provider")
        model = data.get("model")
        prompt_positive = data.get("prompt_positive", "")
        prompt_negative = data.get("prompt_negative", "")
        seed = data.get("seed", -1)
        aspect_ratio = data.get("aspect_ratio", "1:1")
        width = data.get("width", 1024)
        height = data.get("height", 1024)
        resolution = data.get("resolution")
        enable_safety = data.get("enable_safety_checker", True)
        use_negative = data.get("use_negative_prompt", True)
        max_retries = data.get("max_retries", 3)
        timeout = data.get("timeout", 600)
        use_cache = data.get("use_cache", True)
        input_image_b64 = data.get("input_image")  # Base64 encoded if I2I (image_1)
        input_image2_b64 = data.get("input_image2")  # Base64 encoded (image_2 - clothes etc)
        input_image3_b64 = data.get("input_image3")  # Base64 encoded (image_3 - background etc)
        input_image4_b64 = data.get("input_image4")  # Base64 encoded (image_4 - pose etc)
        filename_prefix = str(data.get("filename_prefix", "INSTARAW"))  # Output filename prefix with optional subdir
        multi_image = data.get("multi_image", False)  # Multi-image mode (Wavespeed.ai only)
        second_job_id = data.get("second_job_id")  # ID for second image in multi-image mode

        # Validate multi-image mode
        if multi_image and provider != "wavespeed.ai":
            print(f"[BIG] ⚠️ Multi-image mode only works with wavespeed.ai, ignoring for {provider}", flush=True)
            multi_image = False

        # Create engine instance
        engine = BatchGeneratorEngine()
        engine.api_key = api_key

        # Create job
        job = GenerationJob(
            id=job_id,
            prompt_positive=prompt_positive,
            prompt_negative=prompt_negative,
            seed=seed,
        )

        # Helper to decode base64 image to tensor
        def decode_b64_image(b64_data, label="image"):
            if not b64_data:
                return None
            print(f"[BIG] I2I mode: Decoding {label} (base64 length: {len(b64_data)})", flush=True)
            img_bytes = base64.b64decode(b64_data)
            pil_img = Image.open(io.BytesIO(img_bytes))
            if pil_img.mode == "RGBA":
                pil_img = pil_img.convert("RGB")
            elif pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            img_array = np.array(pil_img).astype(np.float32) / 255.0
            tensor = torch.from_numpy(img_array)
            print(f"[BIG] {label} tensor shape: {tensor.shape}", flush=True)
            return tensor

        # Handle input images if provided (I2I mode)
        job.input_image = decode_b64_image(input_image_b64, "image_1")
        job.input_image2 = decode_b64_image(input_image2_b64, "image_2")
        job.input_image3 = decode_b64_image(input_image3_b64, "image_3")
        job.input_image4 = decode_b64_image(input_image4_b64, "image_4")

        # ===== MULTI-IMAGE MODE (Wavespeed.ai only, 2 images per call) =====
        if multi_image and second_job_id is not None:
            print(f"[BIG] 🎯 MULTI-IMAGE MODE: Generating 2 images for jobs #{job_id} and #{second_job_id}", flush=True)

            # Check cache for both images before API call
            input_images = [job.input_image, job.input_image2, job.input_image3, job.input_image4]
            cache_key_0 = engine.compute_multi_cache_key(
                prompt_positive, prompt_negative, seed, model, provider,
                aspect_ratio, resolution or "", input_images, slot=0
            )
            cache_key_1 = engine.compute_multi_cache_key(
                prompt_positive, prompt_negative, seed, model, provider,
                aspect_ratio, resolution or "", input_images, slot=1
            )

            cached_0 = engine._check_cache(cache_key_0) if use_cache else None
            cached_1 = engine._check_cache(cache_key_1) if use_cache else None

            # If both images are cached, return them without API call
            if cached_0 is not None and cached_1 is not None:
                print(f"[BIG] 📦 MULTI-IMAGE CACHE HIT: Both images found in cache!", flush=True)
                results = []
                for i, (cached_tensor, j_id, c_key) in enumerate([(cached_0, job_id, cache_key_0), (cached_1, second_job_id, cache_key_1)]):
                    # Create base64 preview
                    b64_url = engine._tensor_to_base64(cached_tensor)
                    img_height = cached_tensor.shape[0] if cached_tensor.ndim == 3 else cached_tensor.shape[1]
                    img_width = cached_tensor.shape[1] if cached_tensor.ndim == 3 else cached_tensor.shape[2]

                    # Save to output folder
                    output_filename, subfolder = engine._save_to_output(cached_tensor, j_id, prompt_positive, filename_prefix, node_id)

                    results.append({
                        "job_id": j_id,
                        "status": "success",
                        "state": "cached",
                        "image_url": b64_url,
                        "width": img_width,
                        "height": img_height,
                        "filename": output_filename,
                        "subfolder": subfolder,
                        "cache_hit": True,
                    })
                    print(f"[BIG] 📦 Cached image {i+1} for job #{j_id}", flush=True)

                return web.json_response({
                    "status": "success",
                    "multi_image": True,
                    "results": results,
                })

            try:
                result = await asyncio.to_thread(
                    _generate_multi_image,
                    engine=engine,
                    api_key=api_key,
                    provider=provider,
                    model=model,
                    prompt_positive=prompt_positive,
                    prompt_negative=prompt_negative,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    width=width,
                    height=height,
                    use_negative_prompt=use_negative,
                    input_image=job.input_image,
                    input_image2=job.input_image2,
                    input_image3=job.input_image3,
                    input_image4=job.input_image4,
                    filename_prefix=filename_prefix,
                    job_ids=[job_id, second_job_id],
                    use_cache=use_cache,
                    cache_keys=[cache_key_0, cache_key_1],
                    node_id=node_id,
                )
                return web.json_response(result)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return web.json_response({
                    "status": "failed",
                    "job_id": job_id,
                    "second_job_id": second_job_id,
                    "error": str(e),
                    "multi_image": True,
                })

        # ===== SINGLE IMAGE MODE (standard) =====
        # Generate image using existing logic
        # IMPORTANT: Use asyncio.to_thread() to run blocking I/O in thread pool
        # This enables true parallel generation - without it, requests.post() blocks the event loop
        print(f"[BIG] 🚀 Job #{job_id} starting API call (parallel execution enabled)", flush=True)
        result_job = await asyncio.to_thread(
            engine.generate_job,
            job=job,
            api_key=api_key,
            provider=provider,
            model=model,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            width=width,
            height=height,
            enable_safety_checker=enable_safety,
            use_negative_prompt=use_negative,
            max_retries=max_retries,
            timeout=timeout,
            use_cache=use_cache,
        )

        print(f"[BIG] Generation completed. State: {result_job.state}", flush=True)
        print(f"[BIG] result_image_url: {result_job.result_image_url}", flush=True)
        print(f"[BIG] result_image_width: {result_job.result_image_width}, height: {result_job.result_image_height}", flush=True)
        print(f"[BIG] result_tensor is None: {result_job.result_tensor is None}", flush=True)

        if result_job.state == JobState.SUCCESS or result_job.state == JobState.CACHED:
            # Use the base64 URL for preview (most reliable)
            image_url = result_job.result_image_url
            width = result_job.result_image_width or 0
            height = result_job.result_image_height or 0

            # IMPORTANT: Save to output folder for permanent storage
            output_filename = None
            subfolder = None
            if result_job.result_tensor is not None:
                output_filename, subfolder = engine._save_to_output(
                    result_job.result_tensor,
                    job_id,
                    prompt_positive,
                    filename_prefix,
                    node_id
                )
                if output_filename:
                    print(f"[BIG] ✅ Image permanently saved: {subfolder}/{output_filename}" if subfolder else f"[BIG] ✅ Image permanently saved: {output_filename}", flush=True)
            else:
                print(f"[BIG] ⚠️ No tensor available for output save", flush=True)

            return web.json_response({
                "status": "success",
                "job_id": job_id,
                "state": result_job.state.value,
                "image_url": image_url,
                "width": width,
                "height": height,
                "generation_time": result_job.generation_time,
                "cache_hit": result_job.cache_hit,
                "filename": output_filename,
                "subfolder": subfolder,
                "attempts": result_job.attempts,  # How many retries it took
            })
        else:
            # Failed
            return web.json_response({
                "status": "failed",
                "job_id": job_id,
                "state": result_job.state.value,
                "error": result_job.error or "Generation failed",
                "attempts": result_job.attempts,  # How many retries were attempted
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)


@dataclass
class GenerationJob:
    """Represents a single image generation job."""
    id: int
    prompt_positive: str
    prompt_negative: str
    seed: int
    state: JobState = JobState.PENDING
    input_image: Optional[torch.Tensor] = None  # image_1
    input_image2: Optional[torch.Tensor] = None  # image_2 (e.g. clothes)
    input_image3: Optional[torch.Tensor] = None  # image_3 (e.g. background)
    input_image4: Optional[torch.Tensor] = None  # image_4 (e.g. pose)
    result_tensor: Optional[torch.Tensor] = None
    result_image_url: Optional[str] = None  # File URL or base64 data URL for preview
    result_image_b64: Optional[str] = None  # Base64 data URL (more reliable)
    result_image_width: int = 0  # Width of generated image
    result_image_height: int = 0  # Height of generated image
    result_filename: Optional[str] = None  # Filename for persistent storage
    error: Optional[str] = None
    attempts: int = 0
    generation_time: float = 0.0
    cache_hit: bool = False


HIDDEN = {
    "prompt": "PROMPT",
    "extra_pnginfo": "EXTRA_PNGINFO",
    "uid": "UNIQUE_ID",
    # node_identifier comes from JS widget (stable ID for file paths)
    # NOT using "NID" since that changes per execution
    "node_identifier": ("STRING", {"default": ""}),
    "generated_batch_data": ("STRING", {"default": "[]"}),
}


class BatchGeneratorEngine(INSTARAW_GenerativeAPIBase):
    """
    High-performance generation engine with retry logic and caching.
    """

    def __init__(self):
        super().__init__()
        self._cache_dir = None

    @property
    def cache_dir(self):
        if self._cache_dir is None:
            self._cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "batch_gen")
            os.makedirs(self._cache_dir, exist_ok=True)
        return self._cache_dir

    def _compute_cache_key(self, job: GenerationJob, model: str, provider: str,
                          aspect_ratio: str, resolution: str, has_input_images: bool) -> str:
        """Compute unique cache key for a generation job."""
        hasher = hashlib.sha256()
        hasher.update(job.prompt_positive.encode("utf-8"))
        hasher.update(job.prompt_negative.encode("utf-8"))
        hasher.update(str(job.seed).encode("utf-8"))
        hasher.update(model.encode("utf-8"))
        hasher.update(provider.encode("utf-8"))
        hasher.update(aspect_ratio.encode("utf-8"))
        if resolution:
            hasher.update(resolution.encode("utf-8"))
        # Include all input images in cache key
        if has_input_images:
            for i, img in enumerate([job.input_image, job.input_image2, job.input_image3, job.input_image4]):
                if img is not None:
                    hasher.update(f"image_{i+1}:".encode("utf-8"))
                    hasher.update(img.cpu().numpy().tobytes())
        return hasher.hexdigest()

    def compute_multi_cache_key(self, prompt_positive: str, prompt_negative: str, seed: int,
                                model: str, provider: str, aspect_ratio: str, resolution: str,
                                input_images: list, slot: int) -> str:
        """Compute cache key for multi-image generation (includes slot 0 or 1)."""
        hasher = hashlib.sha256()
        hasher.update(prompt_positive.encode("utf-8"))
        hasher.update(prompt_negative.encode("utf-8"))
        hasher.update(str(seed).encode("utf-8"))
        hasher.update(model.encode("utf-8"))
        hasher.update(provider.encode("utf-8"))
        hasher.update(aspect_ratio.encode("utf-8"))
        hasher.update(f"multi_slot:{slot}".encode("utf-8"))  # Include slot number
        if resolution:
            hasher.update(resolution.encode("utf-8"))
        # Include all input images in cache key
        for i, img in enumerate(input_images):
            if img is not None:
                hasher.update(f"image_{i+1}:".encode("utf-8"))
                hasher.update(img.cpu().numpy().tobytes())
        return hasher.hexdigest()

    def _check_cache(self, cache_key: str) -> Optional[torch.Tensor]:
        """Check if generation result exists in cache."""
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.png")
        if os.path.exists(cache_file):
            try:
                img = Image.open(cache_file).convert("RGB")
                img_np = np.array(img).astype(np.float32) / 255.0
                return torch.from_numpy(img_np)
            except Exception:
                pass
        return None

    def _save_to_cache(self, cache_key: str, tensor: torch.Tensor):
        """Save generation result to cache."""
        try:
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.png")
            img_np = tensor.cpu().numpy()
            if img_np.max() <= 1.0:
                img_np = (img_np * 255).astype(np.uint8)
            img_pil = Image.fromarray(img_np)
            img_pil.save(cache_file, "PNG")
        except Exception as e:
            print(f"   ⚠️ Cache save failed: {e}", flush=True)

    def _save_temp_preview(self, tensor: torch.Tensor, job_id: int) -> Optional[str]:
        """Save image to ComfyUI temp folder for preview in custom UI."""
        try:
            from folder_paths import get_temp_directory

            temp_dir = os.path.join(get_temp_directory(), "batch_gen")
            os.makedirs(temp_dir, exist_ok=True)

            # Generate unique filename with timestamp
            timestamp = int(time.time() * 1000)
            filename = f"job_{job_id}_{timestamp}.png"
            filepath = os.path.join(temp_dir, filename)

            # Convert tensor to numpy array
            img_np = tensor.cpu().numpy()

            # Handle different tensor shapes
            if img_np.ndim == 4:
                img_np = img_np[0]

            # Ensure correct value range
            if img_np.max() <= 1.0:
                img_np = (img_np * 255)

            # Ensure uint8 dtype for PIL
            img_np = img_np.astype(np.uint8)

            # Create PIL image
            img_pil = Image.fromarray(img_np)

            # Save image to disk
            img_pil.save(filepath, "PNG", compress_level=4)

            # Verify file exists
            if not os.path.exists(filepath):
                print(f"   ❌ File not found after save: {filepath}", flush=True)
                return None

            print(f"   ✓ Saved temp preview: {filename}", flush=True)
            return filepath
        except Exception as e:
            print(f"   ⚠️ Temp preview save failed: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return None

    def _tensor_to_base64(self, tensor: torch.Tensor) -> Optional[str]:
        """Convert tensor to base64 data URL for reliable preview."""
        try:
            img_np = tensor.cpu().numpy()

            # Handle different tensor shapes
            if img_np.ndim == 4:
                img_np = img_np[0]

            # Ensure correct value range
            if img_np.max() <= 1.0:
                img_np = (img_np * 255)

            img_np = img_np.astype(np.uint8)
            img_pil = Image.fromarray(img_np)

            # Convert to base64 JPEG (smaller than PNG, faster)
            buffer = io.BytesIO()
            img_pil.save(buffer, format="JPEG", quality=85)
            b64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

            return f"data:image/jpeg;base64,{b64_data}"
        except Exception as e:
            print(f"   ⚠️ Base64 conversion failed: {e}", flush=True)
            return None

    def _save_to_output(self, tensor: torch.Tensor, job_id: int, prompt: str, filename_prefix: str = "INSTARAW", node_id: str = None) -> tuple[Optional[str], Optional[str]]:
        """
        Save image to ComfyUI's main output folder for permanent storage.
        Returns tuple of (filename, subfolder) if successful, (None, None) otherwise.

        Args:
            tensor: Image tensor to save
            job_id: Job ID (kept for API compatibility)
            prompt: Prompt text (kept for API compatibility)
            filename_prefix: Prefix with optional subdirectory (e.g., "INSTARAW" or "my_folder/my_prefix")
            node_id: Node ID (kept for API compatibility)

        Filename format: {prefix}_{ULID}.png
        Examples:
            - filename_prefix="INSTARAW" → output/INSTARAW_01HGX5J8K2P3.png
            - filename_prefix="my_folder/my_prefix" → output/my_folder/my_prefix_01HGX5J8K2P3.png
            - filename_prefix="just_prefix" → output/just_prefix_01HGX5J8K2P3.png
        """
        try:
            # Use ComfyUI's main output directory (works with /view endpoint)
            import folder_paths
            comfy_output = folder_paths.get_output_directory()

            # Parse prefix to extract subdirectory and filename prefix
            # e.g., "my_folder/my_prefix" → subdir="my_folder", prefix="my_prefix"
            # e.g., "just_prefix" → subdir="", prefix="just_prefix"
            if "/" in filename_prefix:
                subdir, prefix = filename_prefix.rsplit("/", 1)
                output_dir = os.path.join(comfy_output, subdir)
            else:
                subdir = ""
                prefix = filename_prefix
                output_dir = comfy_output

            os.makedirs(output_dir, exist_ok=True)

            # Generate filename using ULID (unique, sortable, no conflicts)
            ulid = generate_ulid()
            filename = f"{prefix}_{ulid}.png"
            filepath = os.path.join(output_dir, filename)

            # Convert tensor to image
            img_np = tensor.cpu().numpy()
            if img_np.ndim == 4:
                img_np = img_np[0]
            if img_np.max() <= 1.0:
                img_np = (img_np * 255)
            img_np = img_np.astype(np.uint8)

            img_pil = Image.fromarray(img_np)
            img_pil.save(filepath, "PNG")

            print(f"   💾 Saved to output: {subdir}/{filename}" if subdir else f"   💾 Saved to output: {filename}", flush=True)
            return filename, subdir
        except Exception as e:
            print(f"   ⚠️ Output save failed: {e}", flush=True)
            import traceback
            traceback.print_exc()
            return None, None

    def generate_job(
        self,
        job: GenerationJob,
        api_key: str,
        provider: str,
        model: str,
        aspect_ratio: str,
        resolution: Optional[str],
        width: int,
        height: int,
        enable_safety_checker: bool,
        use_negative_prompt: bool,
        max_retries: int,
        timeout: int,
        use_cache: bool,
        on_retry_callback: Optional[callable] = None,
        progress_tracker: Optional['ProgressTracker'] = None,
        node_identifier: Optional[int] = None,
        filename_prefix: str = "INSTARAW",
    ) -> GenerationJob:
        """
        Execute a generation job with retry logic.

        Returns the updated job with result or error.
        """
        start_time = time.time()
        job.state = JobState.GENERATING

        # Check cache first - consider all input images
        has_input = any(img is not None for img in [job.input_image, job.input_image2, job.input_image3, job.input_image4])
        cache_key = self._compute_cache_key(job, model, provider, aspect_ratio, resolution or "", has_input)

        if use_cache:
            cached = self._check_cache(cache_key)
            if cached is not None:
                job.state = JobState.CACHED
                job.result_tensor = cached
                job.cache_hit = True
                job.generation_time = time.time() - start_time

                # Create base64 preview for cached images
                try:
                    print(f"   📦 CACHED! Tensor shape: {cached.shape}, dtype: {cached.dtype}", flush=True)
                    # Get dimensions from tensor
                    if cached.ndim == 4:  # [batch, height, width, channels]
                        job.result_image_height = cached.shape[1]
                        job.result_image_width = cached.shape[2]
                    elif cached.ndim == 3:  # [height, width, channels]
                        job.result_image_height = cached.shape[0]
                        job.result_image_width = cached.shape[1]

                    # Use base64 for reliable preview
                    b64_url = self._tensor_to_base64(cached)
                    if b64_url:
                        job.result_image_url = b64_url
                        job.result_image_b64 = b64_url
                        print(f"   📸 Cached preview (base64): {job.result_image_width}x{job.result_image_height}", flush=True)
                    else:
                        print(f"   ❌ Base64 conversion failed for cached image!", flush=True)
                except Exception as e:
                    print(f"   ⚠️ Failed to create cached preview: {e}", flush=True)
                    import traceback
                    traceback.print_exc()

                return job

        # Build generation kwargs
        # Combine positive and negative prompts if enabled
        if use_negative_prompt and job.prompt_negative.strip():
            # Some models support negative prompts in the prompt itself
            # For Nano Banana Pro, we append as "Avoid: ..." since it doesn't have native negative prompt
            full_prompt = job.prompt_positive
            if model in ["Nano Banana Pro", "Nano Banana"]:
                # Gemini-based models - append negative as guidance
                full_prompt = f"{job.prompt_positive}\n\nAvoid: {job.prompt_negative}"
            else:
                # For other models, we might have native support - check later
                full_prompt = job.prompt_positive
        else:
            full_prompt = job.prompt_positive

        kwargs = {
            "api_key": api_key,
            "provider": provider,
            "model": model,
            "prompt": full_prompt,
            "seed": job.seed,
            "aspect_ratio": aspect_ratio,
            "width": width,
            "height": height,
            "enable_safety_checker": enable_safety_checker,
        }
        if resolution:
            kwargs["resolution"] = resolution
        if job.input_image is not None:
            kwargs["image_1"] = job.input_image
        if job.input_image2 is not None:
            kwargs["image_2"] = job.input_image2
        if job.input_image3 is not None:
            kwargs["image_3"] = job.input_image3
        if job.input_image4 is not None:
            kwargs["image_4"] = job.input_image4

        # Get model config
        model_conf = MODEL_CONFIG.get(model)
        if not model_conf:
            job.state = JobState.FAILED
            job.error = f"Invalid model: {model}"
            return job

        provider_conf = model_conf["providers"].get(provider)
        if not provider_conf:
            job.state = JobState.FAILED
            job.error = f"Provider '{provider}' not supported for {model}"
            return job

        # Determine endpoint - check if ANY image input is provided
        is_i2i = any(img is not None for img in [job.input_image, job.input_image2, job.input_image3, job.input_image4])
        endpoint = provider_conf["i2i_endpoint"] if is_i2i else provider_conf["t2i_endpoint"]
        build_payload_func = provider_conf["build_payload"]

        # Count how many images are provided
        image_count = sum(1 for img in [job.input_image, job.input_image2, job.input_image3, job.input_image4] if img is not None)
        print(f"   📌 Job #{job.id}: Mode={'I2I (Edit)' if is_i2i else 'T2I'}, Images={image_count}, Endpoint={endpoint}", flush=True)
        if job.input_image is not None:
            print(f"   📌 Job #{job.id}: image_1 shape={job.input_image.shape}", flush=True)
        if job.input_image2 is not None:
            print(f"   📌 Job #{job.id}: image_2 shape={job.input_image2.shape}", flush=True)
        if job.input_image3 is not None:
            print(f"   📌 Job #{job.id}: image_3 shape={job.input_image3.shape}", flush=True)
        if job.input_image4 is not None:
            print(f"   📌 Job #{job.id}: image_4 shape={job.input_image4.shape}", flush=True)

        self.set_api_key(api_key)
        payload = build_payload_func(self, **kwargs)

        # Log payload keys to verify image is included (don't log actual data for security)
        print(f"   📌 Job #{job.id}: Payload keys={list(payload.keys())}", flush=True)
        if "image_urls" in payload:
            print(f"   📌 Job #{job.id}: image_urls count={len(payload['image_urls'])}, first type={type(payload['image_urls'][0]) if payload['image_urls'] else 'N/A'}", flush=True)
        elif "images" in payload:
            print(f"   📌 Job #{job.id}: images count={len(payload['images'])}, first type={type(payload['images'][0]) if payload['images'] else 'N/A'}", flush=True)

        # Retry loop with exponential backoff
        last_error = None
        for attempt in range(max_retries):
            # Check if we should stop before each retry attempt
            if progress_tracker and node_identifier is not None:
                if progress_tracker.should_stop(node_identifier):
                    job.state = JobState.FAILED
                    job.error = "Stopped by user"
                    print(f"   ⏹️  Job #{job.id} STOPPED in retry loop (attempt {attempt})", flush=True)
                    return job

            job.attempts = attempt + 1
            print(f"   🔄 Job #{job.id} attempt {attempt + 1}/{max_retries}", flush=True)

            try:
                # Check before making API request
                if progress_tracker and node_identifier is not None:
                    if progress_tracker.should_stop(node_identifier):
                        job.state = JobState.FAILED
                        job.error = "Stopped by user"
                        print(f"   ⏹️  Job #{job.id} STOPPED before API call (attempt {attempt + 1})", flush=True)
                        return job

                print(f"   🌐 Job #{job.id} making API call to {provider}...", flush=True)
                if provider == "fal.ai":
                    image_url = self._submit_fal_sync(endpoint, payload, timeout)
                else:
                    image_url = self._submit_wavespeed(endpoint, payload)

                # Download image
                image_response = requests.get(image_url, timeout=120)
                image_response.raise_for_status()
                image_pil = Image.open(io.BytesIO(image_response.content)).convert("RGB")

                # Store dimensions
                job.result_image_width, job.result_image_height = image_pil.size

                image_np = np.array(image_pil).astype(np.float32) / 255.0
                tensor = torch.from_numpy(image_np)

                # Success!
                job.state = JobState.SUCCESS
                job.result_tensor = tensor
                job.generation_time = time.time() - start_time

                # Save to cache
                if use_cache:
                    self._save_to_cache(cache_key, tensor)

                # Save to persistent output folder (for generated_batch_data compatibility)
                filename, subfolder = self._save_to_output(tensor, job.id, job.prompt_positive, filename_prefix, node_identifier)
                if filename:
                    job.result_filename = filename
                    job.result_subfolder = subfolder

                # Create base64 preview URL (most reliable - no file system timing issues)
                b64_url = self._tensor_to_base64(tensor)
                if b64_url:
                    job.result_image_url = b64_url
                    job.result_image_b64 = b64_url
                    print(f"   📸 Created base64 preview for job {job.id} ({len(b64_url)} chars)", flush=True)
                else:
                    # Fallback to file-based preview
                    temp_image_path = self._save_temp_preview(tensor, job.id)
                    if temp_image_path:
                        job.result_image_url = f"/view?filename={os.path.basename(temp_image_path)}&subfolder=batch_gen&type=temp"
                        print(f"   📸 Preview URL (file): {job.result_image_url}", flush=True)
                    else:
                        print(f"   ⚠️ Failed to generate preview for job {job.id}", flush=True)

                return job

            except Exception as e:
                last_error = str(e)

                # Check if it's a retryable error
                is_moderation = any(x in last_error.lower() for x in [
                    "422", "content", "policy", "flagged", "safety", "moderation"
                ])
                is_timeout = "timeout" in last_error.lower()
                is_rate_limit = "429" in last_error or "rate" in last_error.lower()

                # Log the error prominently
                error_type = "🚫 CONTENT POLICY" if is_moderation else "⏱️ TIMEOUT" if is_timeout else "🔄 RATE LIMIT" if is_rate_limit else "❌ ERROR"
                print(f"   {error_type} Job #{job.id} attempt {attempt + 1}/{max_retries}: {last_error[:100]}", flush=True)

                if attempt < max_retries - 1:
                    # Mark as retrying and notify UI
                    job.state = JobState.RETRYING
                    # Include error type in message for UI
                    error_msg = "Content policy violation" if is_moderation else "Rate limited" if is_rate_limit else "Timeout" if is_timeout else last_error[:50]
                    job.error = f"Retry {attempt + 1}: {error_msg}"
                    if on_retry_callback:
                        on_retry_callback(job)

                    if is_moderation:
                        # Quick retry for moderation - sometimes just resubmitting works
                        wait_time = 0.5 + (attempt * 0.5)
                        print(f"   ⏳ Job #{job.id} waiting {wait_time:.1f}s before retry (moderation bypass)...", flush=True)
                    elif is_rate_limit:
                        # Longer wait for rate limits
                        wait_time = 5 + (attempt * 5)
                        print(f"   ⏳ Job #{job.id} waiting {wait_time}s before retry (rate limit)...", flush=True)
                    elif is_timeout:
                        # Medium wait for timeouts
                        wait_time = 2 + (attempt * 2)
                        print(f"   ⏳ Job #{job.id} waiting {wait_time}s before retry (timeout)...", flush=True)
                    else:
                        # Standard exponential backoff
                        wait_time = 2 ** attempt
                        print(f"   ⏳ Job #{job.id} waiting {wait_time}s before retry...", flush=True)

                    time.sleep(wait_time)

                    # Reset state back to generating for next attempt
                    job.state = JobState.GENERATING

        # All retries exhausted
        job.state = JobState.FAILED
        job.error = last_error
        job.generation_time = time.time() - start_time
        return job

    def _submit_fal_sync(self, endpoint: str, payload: dict, timeout: int) -> str:
        """Submit synchronous request to fal.ai."""
        url = f"https://fal.run/{endpoint}"
        headers = {
            "Authorization": f"Key {self.api_key}",
            "Content-Type": "application/json",
        }
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)

        if not response.ok:
            error_text = response.text[:300]
            raise Exception(f"fal.ai error ({response.status_code}): {error_text}")

        result = response.json()
        if "images" in result and len(result["images"]) > 0:
            return result["images"][0]["url"]
        raise Exception("No image URL in fal.ai response")


class INSTARAW_BatchImageGenerator(PreviewImage):
    """
    🎨 Interactive Batch Image Generator

    Premium parallel image generation with:
    • Real-time progress tracking
    • Smart auto-retry (bypasses moderation filters)
    • Interactive selection UI
    • Full RPG integration
    • Reference image support (I2I)
    """

    RETURN_TYPES = ("IMAGE", "STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("images", "prompt_list_positive", "indexes", "count", "failed_count")
    OUTPUT_IS_LIST = (True, True, False, False, False)
    INPUT_IS_LIST = True
    FUNCTION = "generate"
    CATEGORY = "INSTARAW/Interactive"
    OUTPUT_NODE = False
    DESCRIPTION = "Parallel batch image generator with auto-retry and interactive selection"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {"forceInput": True}),
                "provider": ("STRING", {"forceInput": True}),
                "model": ("STRING", {"forceInput": True}),
                "prompt_list_positive": ("STRING", {"forceInput": True,
                    "tooltip": "Positive prompts from RPG"}),
                "aspect_ratio": ("STRING", {"forceInput": True}),
                "max_parallel": ("INT", {"default": 5, "min": 1, "max": 100,
                    "tooltip": "Maximum concurrent API requests"}),
                "max_retries": ("INT", {"default": 3, "min": 1, "max": 10,
                    "tooltip": "Retry attempts per job (helps bypass moderation)"}),
                "timeout": ("INT", {"default": 600, "min": 60, "max": 3600,
                    "tooltip": "Selection UI timeout in seconds"}),
            },
            "optional": {
                "prompt_list_negative": ("STRING", {"forceInput": True,
                    "tooltip": "Negative prompts from RPG"}),
                "seed_list": ("INT", {"forceInput": True,
                    "tooltip": "Seeds from RPG"}),
                "width": ("INT", {"forceInput": True}),
                "height": ("INT", {"forceInput": True}),
                "resolution": ("STRING", {"forceInput": True,
                    "tooltip": "Resolution tier (1K, 2K, 4K) for Nano Banana Pro"}),
                "images": ("IMAGE", {"forceInput": True,
                    "tooltip": "Reference images for I2I mode (image_1)"}),
                "images2": ("IMAGE", {"forceInput": True,
                    "tooltip": "Additional reference images (image_2) - e.g. clothes, accessories"}),
                "images3": ("IMAGE", {"forceInput": True,
                    "tooltip": "Additional reference images (image_3) - e.g. background, style"}),
                "images4": ("IMAGE", {"forceInput": True,
                    "tooltip": "Additional reference images (image_4) - e.g. pose, composition"}),
                "enable_img2img": ("BOOLEAN", {"default": False,
                    "tooltip": "Enable image-to-image mode. When True, images connected to image inputs will be used as references."}),
                "use_negative_prompt": ("BOOLEAN", {"default": True,
                    "tooltip": "Include negative prompts in generation"}),
                "auto_retry": ("BOOLEAN", {"default": True,
                    "tooltip": "Automatically retry failed generations"}),
                "use_cache": ("BOOLEAN", {"default": True,
                    "tooltip": "Cache successful generations"}),
                "enable_safety_checker": ("BOOLEAN", {"default": True}),
                "multi_image": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "⚡ Wavespeed.ai ONLY: Generate 2 images per API call for 50% cost savings ($0.07/img instead of $0.14/img). Same subject, slightly different variations."
                }),
                "bypass_filter": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Skip the image selection popup and automatically output all generated images. Useful for automated workflows."
                }),
                "filename_prefix": ("STRING", {
                    "default": "INSTARAW",
                    "tooltip": "Output filename prefix. Can include subdirectories (e.g., 'my_folder/my_prefix'). Files saved as: output/{prefix}_{ULID}.png"
                }),
            },
            "hidden": HIDDEN,
        }

    @classmethod
    def IS_CHANGED(cls, *args, **kwargs):
        return float("NaN")

    def __init__(self):
        super().__init__()
        self.engine = BatchGeneratorEngine()

    def _extract_val(self, val, default=None):
        """Extract single value from INPUT_IS_LIST wrapped input."""
        if val is None:
            return default
        if isinstance(val, list):
            return val[0] if len(val) > 0 else default
        return val

    def _extract_list(self, val, default_len: int = 0) -> list:
        """Extract list from INPUT_IS_LIST input."""
        if val is None:
            return []
        if isinstance(val, list):
            return val
        return [val]

    def _load_generated_images(self, generated_batch: list, node_identifier: str):
        """
        Load pre-generated images from persistent storage (RPG pattern).

        Args:
            generated_batch: List of job metadata with filenames
            node_identifier: Node ID (unused, kept for API compatibility)

        Returns:
            Tuple of (images, prompts, indexes, count, failed_count)
        """
        from PIL import Image
        import folder_paths

        # Use ComfyUI's main output directory
        comfy_output = folder_paths.get_output_directory()

        loaded_images = []
        loaded_prompts = []
        loaded_indexes = []
        failed_count = 0

        for idx, job_data in enumerate(generated_batch):
            state = job_data.get("state", "pending")
            filename = job_data.get("filename")
            prompt = job_data.get("prompt_positive", "")
            # Use subfolder from job data (matches how files were saved)
            # Support both new 'subfolder' and legacy 'output_subdir' keys
            # Note: Empty string "" means root output folder (no subfolder)
            if "subfolder" in job_data:
                subfolder = job_data["subfolder"]  # Could be "" for root folder
            elif "output_subdir" in job_data:
                subfolder = job_data["output_subdir"]
            else:
                subfolder = ""  # Default to root output folder

            if state in ["success", "cached"] and filename:
                # Build path using ComfyUI's output directory
                output_folder = os.path.join(comfy_output, subfolder) if subfolder else comfy_output
                filepath = os.path.join(output_folder, filename)

                if os.path.exists(filepath):
                    try:
                        pil_img = Image.open(filepath)
                        # Convert to tensor [H, W, C] normalized to [0, 1]
                        img_array = np.array(pil_img).astype(np.float32) / 255.0
                        img_tensor = torch.from_numpy(img_array)
                        loaded_images.append(img_tensor)
                        loaded_prompts.append(prompt)
                        loaded_indexes.append(idx)
                        print(f"[BIG]   ✓ Loaded job {idx}: {filename}")
                    except Exception as e:
                        print(f"[BIG]   ✖ Failed to load job {idx}: {e}")
                        failed_count += 1
                else:
                    print(f"[BIG]   ✖ Job {idx} file not found: {filepath}")
                    failed_count += 1
            else:
                # Job failed or pending
                if state == "failed":
                    failed_count += 1
                print(f"[BIG]   ⊗ Job {idx} not ready (state: {state})")

        if len(loaded_images) == 0:
            # Return empty placeholder
            print("[BIG] ⚠️ No images could be loaded!")
            empty_img = torch.zeros((1, 512, 512, 3))
            return ([empty_img], [""], 0, 0, failed_count)

        # Stack images into batch tensor [B, H, W, C]
        batch_tensor = torch.stack(loaded_images, dim=0)
        print(f"[BIG] ✅ Loaded {len(loaded_images)} images, shape: {batch_tensor.shape}")

        # Return in OUTPUT_IS_LIST format: (True, True, False, False, False)
        return (
            [img.unsqueeze(0) for img in loaded_images],  # List of individual images
            loaded_prompts,  # List of prompts
            len(loaded_images),  # Total count
            failed_count,  # Failed count
        )

    def generate(self, **kwargs):
        """
        Main generation function.

        NEW BEHAVIOR (RPG-style):
        1. Check if images are already generated and stored in generated_batch_data
        2. If yes, load and return them (no generation)
        3. If no, fall back to old behavior (generate during execution)
        """

        # ═══════════════════════════════════════════════════════════════════
        # CHECK FOR PRE-GENERATED IMAGES (RPG PATTERN)
        # ═══════════════════════════════════════════════════════════════════

        generated_batch_data = self._extract_val(kwargs.get('generated_batch_data'), "[]")
        node_identifier = self._extract_val(kwargs.get('node_identifier'))

        try:
            generated_batch = json.loads(generated_batch_data) if generated_batch_data else []
        except json.JSONDecodeError:
            print("[BIG] Invalid generated_batch_data JSON, treating as empty")
            generated_batch = []

        # If we have pre-generated images, load and return them
        if generated_batch and len(generated_batch) > 0:
            print(f"[BIG] ✅ Found {len(generated_batch)} pre-generated images, loading from storage...")
            return self._load_generated_images(generated_batch, node_identifier)

        # No pre-generated images - show helpful error
        print("")
        print("═" * 70)
        print("❌ NO IMAGES TO OUTPUT")
        print("═" * 70)
        print("")
        print("   Please use the 'Generate All' button in the custom UI first!")
        print("")
        print("   How to use this node:")
        print("   1. Connect prompts from Reality Prompt Generator")
        print("   2. Click '✨ Generate All' in the BIG node's custom UI")
        print("   3. Wait for generation to complete")
        print("   4. Run the ComfyUI workflow to output the generated images")
        print("")
        print("═" * 70)
        print("")
        raise ValueError(
            "No pre-generated images found. "
            "Please click 'Generate All' in the BIG node's custom UI first, "
            "then run the workflow to output the generated images."
        )

        # ═══════════════════════════════════════════════════════════════════════
        # LEGACY GENERATION CODE - PRESERVED FOR FUTURE NATIVE RUN SUPPORT
        # ═══════════════════════════════════════════════════════════════════════
        # This code below is currently unreachable (blocked by raise above).
        # It's preserved as a foundation for future work to add native generation
        # support when running the workflow directly (without using Generate All).
        # TODO: In the future, remove the raise above and enable this path to
        #       support native ComfyUI queue execution with 2X mode, caching, etc.
        # ═══════════════════════════════════════════════════════════════════════

        aspect_ratio = self._extract_val(kwargs.get('aspect_ratio'), "1:1")
        max_parallel = self._extract_val(kwargs.get('max_parallel'), 5)
        max_retries = self._extract_val(kwargs.get('max_retries'), 3)
        timeout_val = self._extract_val(kwargs.get('timeout'), 600)

        width = self._extract_val(kwargs.get('width'), 1024)
        height = self._extract_val(kwargs.get('height'), 1024)
        resolution = self._extract_val(kwargs.get('resolution'))

        use_negative = self._extract_val(kwargs.get('use_negative_prompt'), True)
        auto_retry = self._extract_val(kwargs.get('auto_retry'), True)
        use_cache = self._extract_val(kwargs.get('use_cache'), True)
        enable_safety = self._extract_val(kwargs.get('enable_safety_checker'), True)
        multi_image = self._extract_val(kwargs.get('multi_image'), False)
        enable_img2img = self._extract_val(kwargs.get('enable_img2img'), False)
        bypass_filter = self._extract_val(kwargs.get('bypass_filter'), False)
        filename_prefix = self._extract_val(kwargs.get('filename_prefix'), "INSTARAW")

        uid = self._extract_val(kwargs.get('uid'))
        node_identifier = self._extract_val(kwargs.get('node_identifier'))

        # Warn about 2X mode in legacy path (for now, native run doesn't support 2X)
        if multi_image and provider == "wavespeed.ai":
            print("[BIG] ⚠️ 2X Multi-Image mode is enabled.", flush=True)
            print("[BIG] 💡 TIP: For 2X mode (2 images per API call), use the custom UI's 'Generate All' button.", flush=True)
            print("[BIG] 📌 Native run currently generates 1 image per prompt.", flush=True)

        # Get prompt lists
        prompts_positive = self._extract_list(kwargs.get('prompt_list_positive'))
        prompts_negative = self._extract_list(kwargs.get('prompt_list_negative'))
        seeds = self._extract_list(kwargs.get('seed_list'))

        if len(prompts_positive) == 0:
            raise ValueError("No prompts provided!")

        num_jobs = len(prompts_positive)

        # Pad lists to match prompt count
        while len(prompts_negative) < num_jobs:
            prompts_negative.append("")
        while len(seeds) < num_jobs:
            seeds.append(-1)

        # Handle reference images
        # With INPUT_IS_LIST=True, images can come as:
        # 1. A list of individual tensors (from PromptFilter with OUTPUT_IS_LIST=True)
        # 2. A list containing a single batch tensor (from other nodes)
        # 3. A single batch tensor
        images_input = kwargs.get('images')
        input_images = None

        print(f"[IMAGE_DEBUG] images_input type: {type(images_input)}", flush=True)
        if isinstance(images_input, list):
            print(f"[IMAGE_DEBUG] images_input is list with {len(images_input)} items", flush=True)
            if len(images_input) > 0:
                print(f"[IMAGE_DEBUG] First item type: {type(images_input[0])}, shape: {images_input[0].shape if hasattr(images_input[0], 'shape') else 'N/A'}", flush=True)
        elif hasattr(images_input, 'shape'):
            print(f"[IMAGE_DEBUG] images_input is tensor with shape: {images_input.shape}", flush=True)

        if images_input is not None:
            if isinstance(images_input, list) and len(images_input) > 0:
                first_item = images_input[0]
                if first_item is not None and isinstance(first_item, torch.Tensor):
                    if first_item.dim() == 3:
                        # List of individual [H, W, C] tensors - stack them
                        valid_tensors = [img for img in images_input if img is not None and isinstance(img, torch.Tensor)]
                        if valid_tensors:
                            stacked = []
                            for img in valid_tensors:
                                if img.dim() == 3:
                                    stacked.append(img.unsqueeze(0))
                                else:
                                    stacked.append(img)
                            input_images = torch.cat(stacked, dim=0)
                    elif first_item.dim() == 4:
                        # First item is already a batch tensor [B, H, W, C]
                        if len(images_input) == 1:
                            input_images = first_item
                        else:
                            valid_tensors = [img for img in images_input if img is not None and isinstance(img, torch.Tensor)]
                            input_images = torch.cat(valid_tensors, dim=0)
            elif isinstance(images_input, torch.Tensor):
                input_images = images_input

        num_ref_images = len(input_images) if input_images is not None else 0
        # Only use img2img mode if enable_img2img is True AND we have reference images
        is_i2i = enable_img2img and num_ref_images > 0

        # If img2img is disabled, clear the input images to ensure txt2img mode
        if not enable_img2img:
            input_images = None
            num_ref_images = 0

        print(f"[IMAGE_DEBUG] Final input_images shape: {input_images.shape if input_images is not None else 'None'}", flush=True)
        print(f"[IMAGE_DEBUG] enable_img2img: {enable_img2img}, num_ref_images: {num_ref_images}, is_i2i: {is_i2i}", flush=True)
        print(f"[IMAGE_DEBUG] Total prompts: {num_jobs}", flush=True)

        # ═══════════════════════════════════════════════════════════════════
        # CREATE JOBS
        # ═══════════════════════════════════════════════════════════════════

        jobs: List[GenerationJob] = []
        for i in range(num_jobs):
            seed = seeds[i] if i < len(seeds) else -1

            input_img = None
            img_idx = None
            if input_images is not None and num_ref_images > 0:
                img_idx = i % num_ref_images
                input_img = input_images[img_idx:img_idx+1]

            jobs.append(GenerationJob(
                id=i,
                prompt_positive=prompts_positive[i],
                prompt_negative=prompts_negative[i] if i < len(prompts_negative) else "",
                seed=seed,
                input_image=input_img,
            ))

            # Debug logging for image cycling
            if input_img is not None:
                print(f"[IMAGE_DEBUG] Job #{i}: Prompt {i}/{num_jobs-1} → Image {img_idx}/{num_ref_images-1} | Shape: {input_img.shape}", flush=True)

        # ═══════════════════════════════════════════════════════════════════
        # LOGGING HEADER
        # ═══════════════════════════════════════════════════════════════════

        total_jobs = len(jobs)
        print("\n" + "═" * 80, flush=True)
        print("🎨 INSTARAW BATCH IMAGE GENERATOR", flush=True)
        print("═" * 80, flush=True)
        print(f"   Jobs: {total_jobs}", flush=True)
        print(f"   Parallel: {max_parallel} | Retries: {max_retries}", flush=True)
        print(f"   Model: {model} | Provider: {provider}", flush=True)
        print(f"   Aspect: {aspect_ratio} | Resolution: {resolution or 'default'}", flush=True)
        print(f"   Mode: {'I2I (Edit)' if is_i2i else 'T2I (Generate)'} | Ref Images: {num_ref_images}", flush=True)
        print(f"   Negative Prompts: {'Enabled' if use_negative else 'Disabled'}", flush=True)
        print(f"   Auto-Retry: {'Enabled' if auto_retry else 'Disabled'} | Cache: {'Enabled' if use_cache else 'Disabled'}", flush=True)
        print(f"   2X Mode: {'⚠️ Enabled (use custom UI for 2X)' if multi_image else 'Disabled'}", flush=True)
        print(f"   Bypass Filter: {'✅ Yes (auto-output all)' if bypass_filter else 'No (show popup)'}", flush=True)
        print("─" * 80, flush=True)

        # ═══════════════════════════════════════════════════════════════════
        # PARALLEL EXECUTION WITH REAL-TIME PROGRESS
        # ═══════════════════════════════════════════════════════════════════

        completed = 0
        lock = threading.Lock()

        # Start progress tracking for real-time UI updates
        progress_tracker.start_generation(node_identifier, jobs)

        def process_job(job: GenerationJob) -> GenerationJob:
            nonlocal completed

            # Mark job as generating and update UI
            job.state = JobState.GENERATING
            progress_tracker.update_job(node_identifier, job)

            # Callback for retry state updates
            def on_retry(j):
                # Check if we should stop before updating UI
                if progress_tracker.should_stop(node_identifier):
                    print(f"   ⏹️  Stopping job #{j.id} (on_retry callback)", flush=True)
                    j.state = JobState.FAILED
                    j.error = "Stopped by user"
                    return
                progress_tracker.update_job(node_identifier, j)

            result = self.engine.generate_job(
                job=job,
                api_key=api_key,
                provider=provider,
                model=model,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                width=width,
                height=height,
                enable_safety_checker=enable_safety,
                use_negative_prompt=use_negative,
                max_retries=max_retries if auto_retry else 1,
                timeout=300,  # Per-request timeout
                use_cache=use_cache,
                on_retry_callback=on_retry,
                progress_tracker=progress_tracker,
                node_identifier=node_identifier,
                filename_prefix=filename_prefix,
            )

            with lock:
                completed += 1

                if result.state == JobState.CACHED:
                    status = "📦 CACHED"
                elif result.state == JobState.SUCCESS:
                    status = f"✅ SUCCESS (attempts: {result.attempts}, {result.generation_time:.1f}s)"
                else:
                    status = f"❌ FAILED: {result.error[:60]}..."

                pct = 100 * completed // num_jobs
                print(f"   [{completed:3d}/{num_jobs}] ({pct:3d}%) Job #{result.id + 1}: {status}", flush=True)

                # Update progress tracker for real-time UI
                progress_tracker.update_job(node_identifier, result)

            return result

        start_time = time.time()

        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {executor.submit(process_job, job): job for job in jobs}
            completed_jobs = []
            for future in as_completed(futures):
                # Check if we should stop
                if progress_tracker.should_stop(node_identifier):
                    print("⏹️  STOPPING GENERATION in executor loop (user requested)", flush=True)
                    # Cancel remaining futures
                    cancelled_count = 0
                    for f in futures:
                        if not f.done():
                            f.cancel()
                            cancelled_count += 1
                    print(f"   ⏹️  Cancelled {cancelled_count} pending futures", flush=True)
                    # Collect completed jobs only
                    break
                completed_jobs.append(future.result())

        # If stopped, raise exception to halt ComfyUI workflow
        if progress_tracker.should_stop(node_identifier):
            progress_tracker.complete_generation(node_identifier)
            print("⏹️  Halting ComfyUI workflow execution", flush=True)
            raise InterruptProcessingException()

        # Mark generation as complete
        progress_tracker.complete_generation(node_identifier)

        total_time = time.time() - start_time

        # ═══════════════════════════════════════════════════════════════════
        # RESULTS SUMMARY
        # ═══════════════════════════════════════════════════════════════════

        successful = [j for j in completed_jobs if j.state in [JobState.SUCCESS, JobState.CACHED]]
        failed = [j for j in completed_jobs if j.state == JobState.FAILED]
        cached = [j for j in completed_jobs if j.state == JobState.CACHED]

        print("─" * 80, flush=True)
        print(f"📊 GENERATION COMPLETE in {total_time:.1f}s", flush=True)
        print(f"   ✅ Successful: {len(successful)} ({len(cached)} from cache)", flush=True)
        print(f"   ❌ Failed: {len(failed)}", flush=True)

        if failed:
            print("   Failed jobs:", flush=True)
            for j in failed[:5]:
                print(f"      #{j.id + 1}: {j.error[:70]}...", flush=True)
            if len(failed) > 5:
                print(f"      ... and {len(failed) - 5} more", flush=True)

        print("═" * 80 + "\n", flush=True)

        if len(successful) == 0:
            raise Exception(f"All {num_jobs} generations failed! Check API key, model settings, and prompts.")

        # ═══════════════════════════════════════════════════════════════════
        # NORMALIZE IMAGE SIZES
        # ═══════════════════════════════════════════════════════════════════

        # Sort by original job ID
        successful.sort(key=lambda j: j.id)

        # Get all result tensors and normalize sizes
        result_tensors = [j.result_tensor for j in successful]

        if len(result_tensors) > 1:
            ref_shape = result_tensors[0].shape
            normalized = []
            for i, tensor in enumerate(result_tensors):
                if tensor.shape != ref_shape:
                    img_np = tensor.cpu().numpy()
                    if img_np.max() <= 1.0:
                        img_np = (img_np * 255).astype(np.uint8)
                    img_pil = Image.fromarray(img_np)
                    img_pil = img_pil.resize((ref_shape[1], ref_shape[0]), Image.LANCZOS)
                    img_np = np.array(img_pil).astype(np.float32) / 255.0
                    normalized.append(torch.from_numpy(img_np))
                else:
                    normalized.append(tensor)
            result_tensors = normalized

        # ═══════════════════════════════════════════════════════════════════
        # INTERACTIVE SELECTION UI
        # ═══════════════════════════════════════════════════════════════════

        # Stack for preview
        preview_tensors = []
        for t in result_tensors:
            if t.dim() == 3:
                preview_tensors.append(t.unsqueeze(0))
            else:
                preview_tensors.append(t)
        preview_batch = torch.cat(preview_tensors, dim=0)

        # Save preview images
        save_kwargs = {}
        if "prompt" in kwargs:
            p = kwargs.get("prompt")
            save_kwargs["prompt"] = p[0] if isinstance(p, list) else p
        if "extra_pnginfo" in kwargs:
            e = kwargs.get("extra_pnginfo")
            save_kwargs["extra_pnginfo"] = e[0] if isinstance(e, list) else e

        urls = self.save_images(images=preview_batch, **save_kwargs)['ui']['images']

        # Build tip with job info
        tip_lines = [
            f"✅ Generated {len(successful)} images ({len(cached)} cached, {len(failed)} failed)",
            f"⏱️ Total time: {total_time:.1f}s",
            "",
            "Select images to output, then click Send.",
        ]
        tip = "\n".join(tip_lines)

        # Check if filter should be bypassed
        if bypass_filter:
            print(f"[BIG] 🚀 Bypass filter enabled - outputting all {len(successful)} images", flush=True)
            selected_indices = list(range(len(successful)))
        else:
            # Send to popup
            payload = {
                "uid": uid,
                "urls": urls,
                "allsame": False,
                "extras": ["", "", ""],
                "tip": tip,
                "video_frames": 1,
            }

            response = send_and_wait(payload, timeout_val, uid, node_identifier)

            # Handle response
            if isinstance(response, TimeoutResponse):
                selected_indices = list(range(len(successful)))
                print(f"   ⏱️ Timeout - outputting all {len(successful)} images", flush=True)
            else:
                selected_indices = [int(x) for x in response.selection] if response.selection else []

            if len(selected_indices) == 0:
                raise InterruptProcessingException()

        # ═══════════════════════════════════════════════════════════════════
        # BUILD OUTPUT
        # ═══════════════════════════════════════════════════════════════════

        final_images = []
        final_prompts = []
        final_job_ids = []

        for idx in selected_indices:
            if idx < len(successful):
                job = successful[idx]
                tensor = result_tensors[idx]

                # Ensure batch dimension
                if tensor.dim() == 3:
                    tensor = tensor.unsqueeze(0)

                final_images.append(tensor)
                final_prompts.append(job.prompt_positive)
                final_job_ids.append(job.id)

        indexes_str = ",".join(str(x) for x in final_job_ids)
        count = len(final_images)

        # ═══════════════════════════════════════════════════════════════════
        # UPDATE GENERATED_BATCH_DATA FOR PERSISTENCE
        # ═══════════════════════════════════════════════════════════════════
        # Store job metadata so subsequent runs can load from disk
        batch_data = []
        for job in completed_jobs:
            batch_data.append({
                "id": job.id,
                "state": job.state.value,
                "filename": job.result_filename,
                "prompt_positive": job.prompt_positive,
                "image_url": job.result_image_url,
                "image_width": job.result_image_width,
                "image_height": job.result_image_height,
                "generation_time": job.generation_time,
            })

        # Emit event to update the JS widget with generated_batch_data
        try:
            PromptServer.instance.send_sync("instaraw-batch-gen-save", {
                "node_id": node_identifier,
                "generated_batch_data": json.dumps(batch_data),
            })
            print(f"[BIG] 💾 Saved {len(batch_data)} jobs to generated_batch_data", flush=True)
        except Exception as e:
            print(f"[BIG] ⚠️ Failed to save generated_batch_data: {e}", flush=True)

        print(f"🎉 Output: {count} images selected (indices: {indexes_str})", flush=True)

        return (final_images, final_prompts, indexes_str, count, len(failed))


# ═══════════════════════════════════════════════════════════════════════════════
# NODE REGISTRATION
# ═══════════════════════════════════════════════════════════════════════════════

NODE_CLASS_MAPPINGS = {
    "INSTARAW_BatchImageGenerator": INSTARAW_BatchImageGenerator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_BatchImageGenerator": "🎨 INSTARAW Batch Image Generator",
}
