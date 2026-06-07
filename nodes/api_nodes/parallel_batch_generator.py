# ---
# ComfyUI INSTARAW - Parallel Batch Generator Node
# Runs N API requests in parallel, accepts prompt lists from RPG
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
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

from .generative_api_nodes import MODEL_CONFIG, INSTARAW_GenerativeAPIBase


class INSTARAW_ParallelBatchGenerator(INSTARAW_GenerativeAPIBase):
    """
    Parallel batch image generation node.
    Runs multiple API requests concurrently using ThreadPoolExecutor.
    Accepts prompt lists from RPG and returns all images as batch tensor.
    """

    INPUT_IS_LIST = True  # Accept lists from RPG

    # Multi endpoint aspect ratios (limited)
    MULTI_ASPECT_RATIOS = ["3:2", "2:3", "3:4", "4:3"]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "API key from provider",
                    },
                ),
                "provider": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "API provider (fal.ai or wavespeed.ai)",
                    },
                ),
                "model": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Model name from Model Selector",
                    },
                ),
                "prompts": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Prompt list from RPG (prompt_list_positive)",
                    },
                ),
                "max_parallel": (
                    "INT",
                    {
                        "default": 10,
                        "min": 1,
                        "max": 50,
                        "tooltip": "Maximum concurrent API requests",
                    },
                ),
                "aspect_ratio": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Aspect ratio from Nano Banana Aspect Ratio node",
                    },
                ),
            },
            "optional": {
                "seeds": (
                    "INT",
                    {
                        "forceInput": True,
                        "tooltip": "Seed list from RPG (seed_list)",
                    },
                ),
                "width": (
                    "INT",
                    {
                        "forceInput": True,
                        "tooltip": "Image width from Aspect Ratio node (for Seedream)",
                    },
                ),
                "height": (
                    "INT",
                    {
                        "forceInput": True,
                        "tooltip": "Image height from Aspect Ratio node (for Seedream)",
                    },
                ),
                "resolution": (
                    "STRING",
                    {
                        "forceInput": True,
                        "tooltip": "Resolution tier (1K, 2K, 4K) for Nano Banana Pro",
                    },
                ),
                "images": (
                    "IMAGE",
                    {
                        "forceInput": True,
                        "tooltip": "Reference images from AIL for I2I/edit mode (batch tensor)",
                    },
                ),
                "use_multi_endpoint": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "tooltip": "Use Multi endpoint (Nano Banana Pro on WaveSpeed only). Returns 2 images per request at half cost.",
                    },
                ),
                "enable_safety_checker": (
                    "BOOLEAN",
                    {
                        "default": True,
                        "tooltip": "Enable safety checker (for Seedream)",
                    },
                ),
            },
        }

    RETURN_TYPES = ("IMAGE", "INT")
    RETURN_NAMES = ("images", "count")
    OUTPUT_IS_LIST = (False, False)  # Returns single batch tensor and count
    FUNCTION = "generate_batch"
    CATEGORY = "INSTARAW/API"
    DESCRIPTION = (
        "Parallel batch image generator. Accepts prompt lists from RPG and runs "
        "multiple API requests concurrently. Supports all models and Multi endpoint."
    )

    def __init__(self):
        super().__init__()
        self._progress_lock = threading.Lock()
        self._completed_count = 0
        self._total_count = 0

    def _get_cache_dir(self):
        """Get or create cache directory."""
        cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache")
        os.makedirs(cache_dir, exist_ok=True)
        return cache_dir

    def _compute_cache_key(self, prompt, seed, model, provider, aspect_ratio, resolution, is_multi=False):
        """Compute cache key for a single generation."""
        hasher = hashlib.sha256()
        hasher.update(prompt.encode("utf-8"))
        hasher.update(str(seed).encode("utf-8"))
        hasher.update(model.encode("utf-8"))
        hasher.update(provider.encode("utf-8"))
        hasher.update(aspect_ratio.encode("utf-8"))
        if resolution:
            hasher.update(resolution.encode("utf-8"))
        if is_multi:
            hasher.update(b"_multi")
        return hasher.hexdigest()

    def _check_cache(self, cache_key, is_multi=False):
        """Check if image(s) exist in cache."""
        cache_dir = self._get_cache_dir()
        if is_multi:
            cache_files = [
                os.path.join(cache_dir, f"{cache_key}_batch_multi_{i}.png")
                for i in range(2)
            ]
            if all(os.path.exists(f) for f in cache_files):
                return cache_files
            return None
        else:
            cache_file = os.path.join(cache_dir, f"{cache_key}_batch.png")
            if os.path.exists(cache_file):
                return [cache_file]
            return None

    def _load_from_cache(self, cache_files):
        """Load image tensor(s) from cache files."""
        tensors = []
        for cache_file in cache_files:
            img = Image.open(cache_file).convert("RGB")
            img_np = np.array(img).astype(np.float32) / 255.0
            tensors.append(torch.from_numpy(img_np))
        return tensors

    def _save_to_cache(self, cache_key, images, is_multi=False):
        """Save image tensor(s) to cache."""
        cache_dir = self._get_cache_dir()
        cache_files = []
        for i, img_tensor in enumerate(images):
            if is_multi:
                cache_file = os.path.join(cache_dir, f"{cache_key}_batch_multi_{i}.png")
            else:
                cache_file = os.path.join(cache_dir, f"{cache_key}_batch.png")

            # Convert tensor to PIL and save
            img_np = img_tensor.cpu().numpy()
            if img_np.max() <= 1.0:
                img_np = (img_np * 255).astype(np.uint8)
            else:
                img_np = img_np.astype(np.uint8)
            img_pil = Image.fromarray(img_np)
            img_pil.save(cache_file, "PNG")
            cache_files.append(cache_file)
        return cache_files

    def _submit_wavespeed_multi(self, api_key, payload):
        """Submit request to WaveSpeed Multi endpoint (returns 2 images)."""
        base_url = "https://api.wavespeed.ai/api/v3"
        endpoint = "google/nano-banana-pro/text-to-image-multi"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Submit task
        response = requests.post(
            f"{base_url}/{endpoint}",
            json=payload,
            headers=headers,
            timeout=30,
        )

        if not response.ok:
            raise Exception(
                f"WaveSpeed Multi API submission failed: {response.status_code} - {response.text}"
            )

        result = response.json()
        request_id = result["data"]["id"]

        # Poll for result
        poll_url = f"{base_url}/predictions/{request_id}/result"
        start_time = time.time()
        timeout = 300  # 5 minutes

        while time.time() - start_time < timeout:
            poll_response = requests.get(poll_url, headers=headers, timeout=30)

            if not poll_response.ok:
                raise Exception(
                    f"WaveSpeed Multi polling failed: {poll_response.status_code} - {poll_response.text}"
                )

            data = poll_response.json()["data"]
            status = data.get("status")

            if status == "completed":
                return data["outputs"]  # Returns list of image URLs

            if status == "failed":
                error_msg = data.get("error", "Unknown error")
                raise Exception(f"WaveSpeed Multi task failed: {error_msg}")

            time.sleep(2)

        raise Exception("WaveSpeed Multi task timed out after 5 minutes.")

    def _submit_fal_with_retry(self, endpoint, payload, api_key, max_retries=2, timeout=300):
        """Submit to fal.ai with retry logic and longer timeout."""
        url = f"https://fal.run/{endpoint}"
        headers = {
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json",
        }

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                if attempt > 0:
                    print(f"   🔄 Retry {attempt}/{max_retries}...", flush=True)

                print(f"   📡 Submitting to fal.ai: {endpoint} (timeout={timeout}s)", flush=True)
                response = requests.post(url, json=payload, headers=headers, timeout=timeout)
                print(f"   📦 Response received: {response.status_code}", flush=True)

                if not response.ok:
                    if response.status_code == 422:
                        # Don't retry validation errors
                        raise Exception(f"API Error (422): Request rejected - {response.text[:200]}")
                    raise Exception(f"API request failed: {response.status_code} - {response.text[:200]}")

                result = response.json()
                if "images" in result and len(result["images"]) > 0:
                    return result["images"][0]["url"]
                raise Exception(f"API response did not contain an image URL")

            except requests.exceptions.Timeout as e:
                last_error = f"Timeout after {timeout}s"
                print(f"   ⏱️ Request timed out after {timeout}s", flush=True)
                if attempt < max_retries:
                    continue
            except requests.exceptions.RequestException as e:
                last_error = str(e)
                print(f"   ❌ Request error: {last_error[:100]}", flush=True)
                if attempt < max_retries:
                    time.sleep(2)  # Brief pause before retry
                    continue
            except Exception as e:
                print(f"   ❌ Non-retryable error: {str(e)[:100]}", flush=True)
                # Non-retryable errors
                raise

        raise Exception(last_error or "Request failed after retries")

    def _generate_single(self, idx, prompt, seed, api_key, provider, model, aspect_ratio,
                         resolution, width, height, enable_safety_checker, input_image=None):
        """Generate a single image. Returns (idx, [tensor], error)."""
        try:
            print(f"   🎯 Starting request #{idx + 1}: {prompt[:50]}...", flush=True)

            # Build kwargs for payload
            kwargs = {
                "api_key": api_key,
                "provider": provider,
                "model": model,
                "prompt": prompt,
                "seed": seed,
                "aspect_ratio": aspect_ratio,
                "width": width,
                "height": height,
                "enable_safety_checker": enable_safety_checker,
            }
            if resolution:
                kwargs["resolution"] = resolution
            if input_image is not None:
                kwargs["image_1"] = input_image
                print(f"   🖼️ Request #{idx + 1} includes reference image, shape: {input_image.shape}", flush=True)

            # Check cache first
            cache_key = self._compute_cache_key(prompt, seed, model, provider, aspect_ratio, resolution)
            cached = self._check_cache(cache_key)
            if cached:
                tensors = self._load_from_cache(cached)
                return (idx, tensors, None)

            # Get model config
            model_conf = MODEL_CONFIG.get(model)
            if not model_conf:
                raise ValueError(f"Invalid model: {model}")
            provider_conf = model_conf["providers"].get(provider)
            if not provider_conf:
                raise ValueError(f"Provider '{provider}' not supported for model '{model}'")

            # Determine endpoint
            is_i2i = input_image is not None
            endpoint = provider_conf["i2i_endpoint"] if is_i2i else provider_conf["t2i_endpoint"]
            build_payload_func = provider_conf["build_payload"]

            # Build payload
            self.set_api_key(api_key)
            payload = build_payload_func(self, **kwargs)

            # Submit request with provider-specific handling
            if provider == "fal.ai":
                # Use our own method with longer timeout and retries
                image_url = self._submit_fal_with_retry(endpoint, payload, api_key)
            else:
                # Use base class method for wavespeed (already has polling)
                image_url = self.submit_request(provider, endpoint, payload)

            # Download image with longer timeout for large images
            image_response = requests.get(image_url, timeout=120)
            image_response.raise_for_status()
            image_pil = Image.open(io.BytesIO(image_response.content)).convert("RGB")

            # Convert to tensor
            image_np = np.array(image_pil).astype(np.float32) / 255.0
            tensor = torch.from_numpy(image_np)

            # Save to cache
            self._save_to_cache(cache_key, [tensor])

            return (idx, [tensor], None)

        except Exception as e:
            return (idx, None, str(e))

    def _generate_single_multi(self, idx, prompt, api_key, aspect_ratio):
        """Generate using Multi endpoint (2 images per request). Returns (idx, [tensor1, tensor2], error)."""
        try:
            # Check cache first
            cache_key = self._compute_cache_key(
                prompt, -1, "Nano Banana Pro", "wavespeed.ai", aspect_ratio, None, is_multi=True
            )
            cached = self._check_cache(cache_key, is_multi=True)
            if cached:
                tensors = self._load_from_cache(cached)
                return (idx, tensors, None)

            # Build payload for multi endpoint
            payload = {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "num_images": 2,
                "output_format": "jpeg",
            }

            # Submit request
            image_urls = self._submit_wavespeed_multi(api_key, payload)

            if not image_urls or len(image_urls) < 2:
                raise Exception(f"Multi endpoint returned {len(image_urls) if image_urls else 0} images, expected 2")

            # Download and convert images
            tensors = []
            for image_url in image_urls[:2]:
                image_response = requests.get(image_url, timeout=60)
                image_response.raise_for_status()
                image_pil = Image.open(io.BytesIO(image_response.content)).convert("RGB")
                image_np = np.array(image_pil).astype(np.float32) / 255.0
                tensors.append(torch.from_numpy(image_np))

            # Save to cache
            self._save_to_cache(cache_key, tensors, is_multi=True)

            return (idx, tensors, None)

        except Exception as e:
            return (idx, None, str(e))

    def _report_progress(self, completed, total, is_multi=False):
        """Report progress to console."""
        mode = "Multi (2x)" if is_multi else "Standard"
        pct = 100 * completed // total if total > 0 else 0
        print(f"🚀 [{mode}] Progress: {completed}/{total} requests ({pct}%)", flush=True)

    def generate_batch(
        self,
        api_key,
        provider,
        model,
        prompts,
        max_parallel,
        aspect_ratio,
        seeds=None,
        width=None,
        height=None,
        resolution=None,
        images=None,
        use_multi_endpoint=None,
        enable_safety_checker=None,
    ):
        """
        Generate images in parallel batches.

        Args:
            api_key: API key (list from INPUT_IS_LIST)
            provider: Provider name (list)
            model: Model name (list)
            prompts: List of prompts from RPG
            max_parallel: Max concurrent requests (list)
            aspect_ratio: Aspect ratio (list)
            seeds: List of seeds from RPG (optional)
            width: Image width (list, optional)
            height: Image height (list, optional)
            resolution: Resolution tier (list, optional)
            images: Input images for I2I mode (batch tensor, optional)
            use_multi_endpoint: Use Multi endpoint (list, optional)
            enable_safety_checker: Enable safety checker (list, optional)

        Returns:
            Tuple of (batch_tensor, count)
        """
        # Extract single values from lists (INPUT_IS_LIST wraps everything)
        api_key_val = api_key[0] if isinstance(api_key, list) else api_key
        provider_val = provider[0] if isinstance(provider, list) else provider
        model_val = model[0] if isinstance(model, list) else model
        max_parallel_val = max_parallel[0] if isinstance(max_parallel, list) else max_parallel
        aspect_ratio_val = aspect_ratio[0] if isinstance(aspect_ratio, list) else aspect_ratio

        # Optional values
        width_val = width[0] if isinstance(width, list) and width else 1024
        height_val = height[0] if isinstance(height, list) and height else 1024
        resolution_val = resolution[0] if isinstance(resolution, list) and resolution else None
        use_multi_val = use_multi_endpoint[0] if isinstance(use_multi_endpoint, list) and use_multi_endpoint else False
        enable_safety_val = enable_safety_checker[0] if isinstance(enable_safety_checker, list) and enable_safety_checker else True

        # prompts should already be a list from RPG
        prompt_list = prompts if isinstance(prompts, list) else [prompts]

        # Handle seeds list
        if seeds is None or (isinstance(seeds, list) and len(seeds) == 0):
            seed_list = [-1] * len(prompt_list)
        elif isinstance(seeds, list):
            seed_list = seeds
            # Pad with -1 if seeds list is shorter
            while len(seed_list) < len(prompt_list):
                seed_list.append(-1)
        else:
            seed_list = [seeds] * len(prompt_list)

        # Handle input images for I2I mode
        # With INPUT_IS_LIST=True, images can come as:
        # 1. A list of individual tensors (from PromptFilter with OUTPUT_IS_LIST=True)
        # 2. A list containing a single batch tensor (from other nodes)
        # 3. A single batch tensor
        input_images = None
        has_reference_images = False

        if images is not None:
            print(f"   🖼️ Received images input: type={type(images)}, len={len(images) if isinstance(images, list) else 'N/A'}", flush=True)

            if isinstance(images, list) and len(images) > 0:
                # Check if it's a list of individual tensors or a list with one batch tensor
                first_item = images[0]
                if first_item is not None:
                    if isinstance(first_item, torch.Tensor):
                        # Check dimensions to determine format
                        if first_item.dim() == 3:
                            # List of individual [H, W, C] tensors - stack them
                            print(f"   🖼️ Detected list of {len(images)} individual image tensors", flush=True)
                            valid_tensors = [img for img in images if img is not None and isinstance(img, torch.Tensor)]
                            if valid_tensors:
                                # Add batch dimension to each and stack
                                stacked = []
                                for img in valid_tensors:
                                    if img.dim() == 3:
                                        stacked.append(img.unsqueeze(0))
                                    else:
                                        stacked.append(img)
                                input_images = torch.cat(stacked, dim=0)
                                print(f"   🖼️ Stacked into batch: shape={input_images.shape}", flush=True)
                        elif first_item.dim() == 4:
                            # First item is already a batch tensor [B, H, W, C]
                            if len(images) == 1:
                                input_images = first_item
                                print(f"   🖼️ Single batch tensor: shape={input_images.shape}", flush=True)
                            else:
                                # Multiple batch tensors - concatenate them
                                valid_tensors = [img for img in images if img is not None and isinstance(img, torch.Tensor)]
                                input_images = torch.cat(valid_tensors, dim=0)
                                print(f"   🖼️ Concatenated batches: shape={input_images.shape}", flush=True)
            elif isinstance(images, torch.Tensor):
                input_images = images
                print(f"   🖼️ Direct tensor: shape={input_images.shape}", flush=True)

            # Validate we have usable images
            if input_images is not None and isinstance(input_images, torch.Tensor) and len(input_images) > 0:
                has_reference_images = True
                num_images = len(input_images)
                print(f"   🖼️ I2I MODE: Using {num_images} reference images (edit endpoint)", flush=True)

                if num_images < len(prompt_list):
                    print(f"   ⚠️ Only {num_images} images for {len(prompt_list)} prompts - will cycle through available images", flush=True)
                elif num_images > len(prompt_list):
                    print(f"   ⚠️ {num_images} images but only {len(prompt_list)} prompts - extra images will be ignored", flush=True)

        if not has_reference_images:
            input_images = None
            print(f"   📝 T2I MODE: No reference images provided", flush=True)

        total_prompts = len(prompt_list)
        print(f"🎨 Parallel Batch Generator: {total_prompts} prompts, max {max_parallel_val} parallel", flush=True)
        print(f"   Model: {model_val} | Provider: {provider_val} | Aspect: {aspect_ratio_val}", flush=True)

        # Check if we should use Multi endpoint
        # Multi endpoint is T2I ONLY - cannot use with reference images!
        is_multi_mode = False
        if use_multi_val:
            if has_reference_images:
                print(f"   ⚠️ Multi endpoint requested but reference images provided - using standard I2I endpoint instead", flush=True)
            elif model_val != "Nano Banana Pro":
                print(f"   ⚠️ Multi endpoint only available for Nano Banana Pro", flush=True)
            elif provider_val != "wavespeed.ai":
                print(f"   ⚠️ Multi endpoint only available on wavespeed.ai", flush=True)
            elif aspect_ratio_val not in self.MULTI_ASPECT_RATIOS:
                print(f"   ⚠️ Multi endpoint doesn't support aspect ratio {aspect_ratio_val} (only: {self.MULTI_ASPECT_RATIOS})", flush=True)
            else:
                is_multi_mode = True

        if is_multi_mode:
            print(f"   🍌 Using Multi endpoint (2 images per request)", flush=True)
            return self._generate_batch_multi(
                api_key_val, prompt_list, max_parallel_val, aspect_ratio_val
            )
        else:
            return self._generate_batch_standard(
                api_key_val, provider_val, model_val, prompt_list, seed_list,
                max_parallel_val, aspect_ratio_val, resolution_val, width_val,
                height_val, enable_safety_val, input_images
            )

    def _generate_batch_standard(
        self, api_key, provider, model, prompts, seeds, max_parallel,
        aspect_ratio, resolution, width, height, enable_safety, input_images
    ):
        """Generate images using standard endpoints (1 image per request)."""
        total = len(prompts)
        results = [None] * total
        errors = []
        completed = 0

        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {}
            num_ref_images = len(input_images) if input_images is not None else 0

            for i in range(total):
                # Get input image for this index - cycle through if fewer images than prompts
                input_img = None
                if input_images is not None and num_ref_images > 0:
                    img_idx = i % num_ref_images  # Cycle through available images
                    input_img = input_images[img_idx:img_idx+1]  # Keep batch dimension [1, H, W, C]

                future = executor.submit(
                    self._generate_single,
                    i, prompts[i], seeds[i], api_key, provider, model,
                    aspect_ratio, resolution, width, height, enable_safety, input_img
                )
                futures[future] = i

            mode_str = f"I2I with {num_ref_images} ref images" if num_ref_images > 0 else "T2I"
            print(f"   📋 Submitted {total} requests ({mode_str}), waiting for completion...", flush=True)

            for future in as_completed(futures):
                idx, tensors, error = future.result()
                completed += 1

                if error:
                    errors.append((idx, prompts[idx], error))
                    print(f"❌ Request {idx + 1}/{total} failed: {error}", flush=True)
                else:
                    results[idx] = tensors[0]  # Single image
                    self._report_progress(completed, total, is_multi=False)

        # Report failures
        if errors:
            print(f"⚠️ {len(errors)} of {total} generations failed:", flush=True)
            for idx, prompt, err in errors[:5]:  # Show first 5
                print(f"   - #{idx + 1}: {err[:100]}...", flush=True)

        # Filter out None results
        successful = [r for r in results if r is not None]
        if not successful:
            raise Exception("All generations failed. Check API key and parameters.")

        # Ensure all images have the same size (use first image's size as reference)
        # This handles cases where API returns slightly different sizes
        if len(successful) > 1:
            ref_shape = successful[0].shape  # (H, W, C)
            resized = []
            for i, tensor in enumerate(successful):
                if tensor.shape != ref_shape:
                    print(f"   ⚠️ Image {i + 1} has different size {tensor.shape}, resizing to {ref_shape}", flush=True)
                    # Resize using PIL for quality
                    img_np = tensor.cpu().numpy()
                    if img_np.max() <= 1.0:
                        img_np = (img_np * 255).astype(np.uint8)
                    img_pil = Image.fromarray(img_np)
                    img_pil = img_pil.resize((ref_shape[1], ref_shape[0]), Image.LANCZOS)
                    img_np = np.array(img_pil).astype(np.float32) / 255.0
                    resized.append(torch.from_numpy(img_np))
                else:
                    resized.append(tensor)
            successful = resized

        batch_tensor = torch.stack(successful)
        print(f"✅ Parallel Batch Generator complete! Generated {len(successful)} images, shape: {batch_tensor.shape}", flush=True)

        return (batch_tensor, len(successful))

    def _generate_batch_multi(self, api_key, prompts, max_parallel, aspect_ratio):
        """Generate images using Multi endpoint (2 images per request)."""
        total = len(prompts)
        results = []
        errors = []
        completed = 0

        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {}
            for i in range(total):
                future = executor.submit(
                    self._generate_single_multi,
                    i, prompts[i], api_key, aspect_ratio
                )
                futures[future] = i

            for future in as_completed(futures):
                idx, tensors, error = future.result()
                completed += 1

                if error:
                    errors.append((idx, prompts[idx], error))
                    print(f"❌ Multi request {idx + 1}/{total} failed: {error}")
                else:
                    # Multi returns 2 images per request
                    results.append((idx, tensors))
                    self._report_progress(completed, total, is_multi=True)

        # Report failures
        if errors:
            print(f"⚠️ {len(errors)} of {total} multi-generations failed:")
            for idx, prompt, err in errors[:5]:
                print(f"   - #{idx + 1}: {err[:100]}...")

        # Sort by original index and flatten
        results.sort(key=lambda x: x[0])
        all_tensors = []
        for idx, tensors in results:
            all_tensors.extend(tensors)

        if not all_tensors:
            raise Exception("All multi-generations failed. Check API key and parameters.")

        # Ensure all images have the same size (use first image's size as reference)
        if len(all_tensors) > 1:
            ref_shape = all_tensors[0].shape  # (H, W, C)
            resized = []
            for i, tensor in enumerate(all_tensors):
                if tensor.shape != ref_shape:
                    print(f"   ⚠️ Image {i + 1} has different size {tensor.shape}, resizing to {ref_shape}", flush=True)
                    img_np = tensor.cpu().numpy()
                    if img_np.max() <= 1.0:
                        img_np = (img_np * 255).astype(np.uint8)
                    img_pil = Image.fromarray(img_np)
                    img_pil = img_pil.resize((ref_shape[1], ref_shape[0]), Image.LANCZOS)
                    img_np = np.array(img_pil).astype(np.float32) / 255.0
                    resized.append(torch.from_numpy(img_np))
                else:
                    resized.append(tensor)
            all_tensors = resized

        batch_tensor = torch.stack(all_tensors)
        expected_count = total * 2
        actual_count = len(all_tensors)
        print(f"✅ Multi Batch Generator complete! Generated {actual_count} images (expected {expected_count}), shape: {batch_tensor.shape}", flush=True)

        return (batch_tensor, actual_count)


# =================================================================================
# NODE REGISTRATION
# =================================================================================

NODE_CLASS_MAPPINGS = {
    "INSTARAW_ParallelBatchGenerator": INSTARAW_ParallelBatchGenerator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "INSTARAW_ParallelBatchGenerator": "🚀 INSTARAW Parallel Batch Generator",
}
