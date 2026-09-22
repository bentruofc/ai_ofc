"""The single user-facing node: ``Skin Detailer (SAM3 • Texture • Refine)``.

The node has two modes:

``skin texture (stable)``
    SAM 3.1 finds the skin, a deterministic 1x skin-detail model restores
    pore-level texture inside it, and the result is composited back. No
    diffusion model, CLIP or VAE is involved, so nothing can be hallucinated
    and the run is fast and repeatable. This is the default.

``texture + diffusion (experimental)``
    Additionally runs a masked low-denoise img2img pass with the MODEL / CLIP /
    VAE the workflow supplies. This can add genuine detail, but generative
    refinement on large flat skin is prone to inventing blemishes and is
    sensitive to model/VAE pairing -- hence "experimental".
"""

from __future__ import annotations

import logging
import os
import random
import time

import numpy as np
import torch
from PIL import Image

import comfy.model_management
import comfy.samplers
import comfy.utils
import folder_paths

from .composite import composite_masked, lock_low_frequency
from .refine import refine_image
from .segment import (
    SAM3_AUTO_LABEL,
    apply_face_protection,
    sam3_model_options,
    segment_skin,
    unload_sam3,
)
from .texture import (
    AUTO_TEXTURE_LABEL,
    TEXTURE_OFF_LABEL,
    apply_texture,
    load_texture_model,
    resolve_texture_path,
    texture_model_options,
)

log = logging.getLogger("SkinDetailer")

MODE_TEXTURE = "skin texture (stable)"
MODE_DIFFUSION = "texture + diffusion (experimental)"
MODES = [MODE_TEXTURE, MODE_DIFFUSION]

#: Widgets that only matter in diffusion mode. The web extension hides these
#: when the node is in texture mode; they are declared last and contiguously so
#: hiding them collapses the node cleanly. (Hidden widgets still serialise, so
#: this creates no holes in ``widgets_values``.)
DIFFUSION_WIDGETS = [
    "seed", "steps", "cfg", "denoise", "preserve_tone",
    "skin_prompt", "sampler_name", "scheduler", "processing_mode",
]

#: Deliberately says nothing about "imperfections", "blemishes", "freckles",
#: "moles" or "hair": a low-denoise pass takes those words as instructions and
#: paints them onto clean skin.
DEFAULT_SKIN_PROMPT = (
    "photorealistic skin with natural pore-level texture, smooth even skin tone, "
    "soft subsurface scattering, clean sharp detail"
)

EXPERIMENTAL = (
    "EXPERIMENTAL (diffusion mode only). "
)

#: Coarse pipeline stages, used only to keep the node's progress bar honest.
#: The nested bars that SAM3_Detect, the texture model and the sampler create
#: report their own inner work and would otherwise leave the node sitting at
#: 100% while a later stage is still running.
_STAGES = 4


def _stage_progress(done: int) -> None:
    """Report coarse pipeline progress on the executing node."""
    comfy.utils.ProgressBar(_STAGES).update_absolute(min(done, _STAGES), _STAGES)


class SkinDetailer:
    """Find every exposed skin pixel, enhance only those, leave the rest alone."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE", {"tooltip": "The image to enhance. Batches are supported."}),

                "mode": (MODES, {
                    "default": MODE_TEXTURE,
                    "tooltip": (
                        "skin texture (stable): SAM 3.1 finds the skin and a deterministic "
                        "1x detail model restores pore texture inside it. No diffusion "
                        "model, CLIP or VAE needed - nothing can be invented.\n\n"
                        "texture + diffusion (experimental): additionally runs a masked "
                        "low-denoise pass with your MODEL/CLIP/VAE. Can add real detail, but "
                        "may invent blemishes and is sensitive to model/VAE pairing."
                    ),
                }),

                "texture_model": (texture_model_options(), {
                    "default": AUTO_TEXTURE_LABEL,
                    "tooltip": "The 1x skin model. 'auto' downloads "
                               "1xSkinContrast-High-SuperUltraCompact (CC0, 181 KB) into "
                               "models/upscale_models on first use - it deepens skin "
                               "contrast and tone.\n\n"
                               "1x-ITF-SkinDiffDetail-Lite-v1 is the alternative if you want "
                               "sharpening/detail instead of contrast. 'off' disables this "
                               "stage (only useful in diffusion mode).",
                }),
                "texture_strength": ("FLOAT", {
                    "default": 1.00, "min": 0.0, "max": 1.0, "step": 0.05, "round": 0.01,
                    "tooltip": "Blend strength of the skin model inside the mask. These "
                               "models are subtle by design, so full strength is the "
                               "sensible default; lower it if the effect is too strong.",
                }),
                "face_identity_protect": ("FLOAT", {
                    "default": 0.50, "min": 0.0, "max": 1.0, "step": 0.05, "round": 0.01,
                    "tooltip": "How much gentler both stages are on face skin. "
                               "0 = face skin treated like any other skin; 1 = face skin "
                               "left untouched. Matters most in diffusion mode, where it is "
                               "the main defence against identity drift.",
                }),

                "sam3_model": (sam3_model_options(), {
                    "default": SAM3_AUTO_LABEL,
                    "tooltip": "Which SAM 3 checkpoint from models/checkpoints does the "
                               "segmentation. 'auto' uses sam3.1_multiplex_fp16.safetensors "
                               "and downloads it on first use. Loading is cached, so only "
                               "the first run of a session is slow.",
                }),
                "segmentation_threshold": ("FLOAT", {
                    "default": 0.45, "min": 0.05, "max": 0.95, "step": 0.01, "round": 0.01,
                    "tooltip": "SAM 3.1 detection confidence. Lower finds more skin but "
                               "risks false positives; the subtract pass always runs 0.05 "
                               "higher so it cannot eat true skin.",
                }),
                "mask_expand": ("INT", {
                    "default": 4, "min": -64, "max": 64, "step": 1,
                    "tooltip": "Pixels to grow the skin mask by before the non-skin features "
                               "(eyes, lips, hair, clothing...) are subtracted.",
                }),
                "mask_feather": ("FLOAT", {
                    "default": 12.0, "min": 0.0, "max": 128.0, "step": 0.5,
                    "tooltip": "Gaussian feather radius in pixels for the final mask edge. "
                               "Larger values hide the transition better.",
                }),

                # --- diffusion-only group; keep contiguous and last ---
                "seed": ("INT", {
                    "default": 0, "min": 0, "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": EXPERIMENTAL + "Noise seed for the refinement pass.",
                }),
                "steps": ("INT", {
                    "default": 8, "min": 1, "max": 200,
                    "tooltip": EXPERIMENTAL + "Sampling steps. 8 matches Krea 2 Turbo's "
                               "native count; raise it for non-distilled models.",
                }),
                "cfg": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 30.0, "step": 0.1, "round": 0.01,
                    "tooltip": EXPERIMENTAL + "Keep 1.0 for distilled/Turbo models; use "
                               "~3.5 for non-distilled models such as Krea 2 Raw.",
                }),
                "denoise": ("FLOAT", {
                    "default": 0.22, "min": 0.05, "max": 0.60, "step": 0.01, "round": 0.01,
                    "tooltip": EXPERIMENTAL + "How much the diffusion pass may change skin. "
                               "0.15-0.25 is the safe range; above ~0.35 the model starts "
                               "inventing skin features, and identity drift rises past ~0.45.",
                }),
                "preserve_tone": ("FLOAT", {
                    "default": 0.85, "min": 0.0, "max": 1.0, "step": 0.05, "round": 0.01,
                    "tooltip": EXPERIMENTAL + "Locks the original skin's colour and shading, "
                               "importing only fine texture from the diffusion pass. Moles, "
                               "acne and blotches are low-frequency, so a high value makes "
                               "them impossible to invent while pore detail still comes "
                               "through. This is the main safety net - keep it high.\n\n"
                               "Deliberately does NOT apply to the texture model: that model "
                               "is a tone operator, and locking tone would cancel it.",
                }),
                "skin_prompt": ("STRING", {
                    "default": DEFAULT_SKIN_PROMPT, "multiline": True, "dynamicPrompts": True,
                    "tooltip": EXPERIMENTAL + "What the refinement pushes skin towards. "
                               "Never ask for 'imperfections', 'blemishes' or 'hair' - a "
                               "low-denoise pass treats those as instructions. Ignored when "
                               "a 'positive' conditioning is connected.",
                }),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS, {
                    "default": "euler",
                    "tooltip": EXPERIMENTAL + "Sampling algorithm.",
                }),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS, {
                    "default": "simple",
                    "tooltip": EXPERIMENTAL + "Sigma schedule.",
                }),
                "processing_mode": (["auto", "full_canvas", "regional_crops"], {
                    "default": "auto",
                    "tooltip": EXPERIMENTAL + "'regional_crops' refines each skin region "
                               "separately; 'full_canvas' does one masked pass; 'auto' picks "
                               "per image.",
                }),
            },
            "optional": {
                "model": ("MODEL", {
                    "tooltip": "Only needed in diffusion mode. Any diffusion MODEL - the node "
                               "only performs img2img, so FLUX, SDXL, Qwen-Image and Krea 2 "
                               "all work.",
                }),
                "clip": ("CLIP", {
                    "tooltip": "Only needed in diffusion mode, and only when 'positive' is "
                               "not connected. Must match the MODEL.",
                }),
                "vae": ("VAE", {
                    "tooltip": "Only needed in diffusion mode. Must match the MODEL - a "
                               "near-miss VAE decodes coherently while quietly destroying "
                               "fine skin detail.",
                }),
                "positive": ("CONDITIONING", {
                    "tooltip": "Optional. Overrides the internal skin prompt with your own "
                               "conditioning. When connected, CLIP is not required.",
                }),
            },
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "skin_mask")
    OUTPUT_TOOLTIPS = (
        "The enhanced image. Every pixel outside the skin mask is bit-identical to the input.",
        "The final effective skin mask, after subtraction, feathering and face-identity "
        "attenuation.",
    )
    FUNCTION = "enhance"
    CATEGORY = "image/enhance"
    DESCRIPTION = (
        "Automatically finds all exposed human skin with SAM 3.1 and restores pore-level "
        "texture with a dedicated 1x detail model. Eyes, brows, lips, teeth, hair, nails, "
        "clothing, glasses and jewelry are excluded, face identity is protected, and every "
        "non-skin pixel is returned unchanged. An optional experimental mode adds a masked "
        "low-denoise diffusion pass using your own MODEL/CLIP/VAE."
    )
    SEARCH_ALIASES = ["skin", "skin detail", "skin texture", "detailer", "retouch", "pores"]

    def __init__(self) -> None:
        self.output_dir = folder_paths.get_temp_directory()
        self.prefix_append = "_skindetailer_" + "".join(
            random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5)
        )

    # ------------------------------------------------------------------ #

    @staticmethod
    def _check_diffusion_inputs(model, clip, vae, positive) -> None:
        """Fail early, and in plain language, when diffusion mode is under-wired."""
        missing = []
        if model is None:
            missing.append("MODEL")
        if vae is None:
            missing.append("VAE")
        if clip is None and positive is None:
            missing.append("CLIP (or a 'positive' conditioning)")
        if missing:
            raise ValueError(
                "[Skin Detailer] mode is '" + MODE_DIFFUSION + "' but these inputs are not "
                "connected: " + ", ".join(missing) + ".\n\n"
                "Either connect them, or switch mode to '" + MODE_TEXTURE + "', which needs "
                "only an image."
            )

    def enhance(
        self,
        image: torch.Tensor,
        mode: str,
        texture_model: str,
        texture_strength: float,
        face_identity_protect: float,
        sam3_model: str,
        segmentation_threshold: float,
        mask_expand: int,
        mask_feather: float,
        seed: int,
        steps: int,
        cfg: float,
        denoise: float,
        preserve_tone: float,
        skin_prompt: str,
        sampler_name: str,
        scheduler: str,
        processing_mode: str,
        model=None,
        clip=None,
        vae=None,
        positive=None,
    ):
        use_diffusion = mode == MODE_DIFFUSION
        if use_diffusion:
            self._check_diffusion_inputs(model, clip, vae, positive)

        image = image.to(torch.float32)
        if image.shape[-1] > 3:
            # SAM3, the texture model and every VAE work on RGB; an alpha channel
            # would break the shape contract of the final composite.
            log.info("[Skin Detailer] dropping %d extra channel(s) from the input image.",
                     image.shape[-1] - 3)
            image = image[..., :3].contiguous()
        batch, height, width = image.shape[0], image.shape[1], image.shape[2]

        # --- stage 1: segmentation (3 SAM 3.1 passes for the whole batch) ---
        _stage_progress(0)
        started = time.perf_counter()
        segmentation = segment_skin(
            image,
            threshold=segmentation_threshold,
            mask_expand=int(mask_expand),
            mask_feather=float(mask_feather),
            sam3_model=sam3_model,
        )
        effective = apply_face_protection(
            segmentation.skin, segmentation.face, float(face_identity_protect)
        )
        log.info(
            "[Skin Detailer] mode=%s; segmentation done in %.1fs; skin covers %.1f%% "
            "of the canvas.",
            "texture+diffusion" if use_diffusion else "texture",
            time.perf_counter() - started,
            float(effective.mean()) * 100.0,
        )
        unload_sam3()
        _stage_progress(1)

        if float(effective.max()) <= 1e-4:
            log.info(
                "[Skin Detailer] no exposed skin found (threshold %.2f); "
                "returning the input image unchanged.",
                segmentation_threshold,
            )
            empty = torch.zeros((batch, height, width), dtype=torch.float32)
            return self._finish(image, image, empty)

        # --- stage 2: the 1x texture model ---
        loaded_texture = None
        if texture_model != TEXTURE_OFF_LABEL and texture_strength > 0.0:
            path = resolve_texture_path(texture_model)
            if path is not None:
                loaded_texture = load_texture_model(path)
        if loaded_texture is None and not use_diffusion:
            raise ValueError(
                "[Skin Detailer] texture mode has nothing to do: texture_model is 'off' or "
                "texture_strength is 0. Enable the texture model, or switch to '"
                + MODE_DIFFUSION + "'."
            )

        results = []
        for index in range(batch):
            comfy.model_management.throw_exception_if_processing_interrupted()
            source = image[index : index + 1]
            mask = effective[index : index + 1]

            if float(mask.max()) <= 1e-4:
                log.info("[Skin Detailer] image %d has no skin; passing it through.", index)
                results.append(source)
                continue

            candidate = source
            if loaded_texture is not None:
                candidate = apply_texture(
                    candidate, mask, loaded_texture, float(texture_strength)
                )
                # No tone lock here on purpose: the default texture model is a
                # contrast/tone operator (~99% of its change is low frequency),
                # so locking tone would cancel almost all of it.
                comfy.model_management.soft_empty_cache()
            _stage_progress(2)

            if use_diffusion:
                candidate = refine_image(
                    candidate,
                    mask,
                    model,
                    clip,
                    vae,
                    skin_prompt=skin_prompt,
                    positive=positive,
                    seed=int(seed) + index * 7919,
                    steps=int(steps),
                    cfg=float(cfg),
                    sampler_name=sampler_name,
                    scheduler=scheduler,
                    denoise=float(denoise),
                    processing_mode=processing_mode,
                )
                comfy.model_management.soft_empty_cache()
                # Diffusion is the stage that can invent structure; the tone
                # lock is what makes new moles and blotches impossible.
                candidate = lock_low_frequency(source, candidate, float(preserve_tone))
            _stage_progress(3)

            # --- final stage: the hard guarantee ---
            results.append(composite_masked(source, candidate, mask))
            _stage_progress(4)

        output = torch.cat(results, dim=0)
        log.info("[Skin Detailer] finished in %.1fs.", time.perf_counter() - started)
        return self._finish(image, output, effective)

    # ------------------------------------------------------------------ #

    def _finish(self, source: torch.Tensor, output: torch.Tensor, mask: torch.Tensor):
        """Attach the mask-overlay thumbnail and return the node outputs."""
        ui_images = []
        try:
            ui_images = self._save_overlay(source, mask)
        except Exception as exc:  # pragma: no cover - a preview must never fail a run
            log.debug("[Skin Detailer] mask overlay preview skipped: %s", exc)
        return {"ui": {"images": ui_images}, "result": (output, mask)}

    def _save_overlay(self, image: torch.Tensor, mask: torch.Tensor) -> list[dict]:
        """Write a "what was selected" thumbnail: the input tinted by the mask."""
        overlay = image.to(torch.float32).clone()
        weights = mask.to(torch.float32).clamp(0.0, 1.0).unsqueeze(-1)
        if weights.shape[0] != overlay.shape[0]:
            weights = weights[:1].expand(overlay.shape[0], -1, -1, -1)
        tint = torch.tensor([0.15, 0.95, 0.85], dtype=torch.float32).view(1, 1, 1, 3)
        rgb = overlay[..., :3]
        overlay = rgb * (1.0 - 0.45 * weights) + tint * (0.45 * weights)

        longest = max(overlay.shape[1], overlay.shape[2])
        if longest > 640:
            scale = 640.0 / longest
            overlay = comfy.utils.common_upscale(
                overlay.movedim(-1, 1),
                max(1, int(overlay.shape[2] * scale)),
                max(1, int(overlay.shape[1] * scale)),
                "area",
                crop="disabled",
            ).movedim(1, -1)

        full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
            "SkinDetailer" + self.prefix_append,
            self.output_dir,
            overlay.shape[2],
            overlay.shape[1],
        )
        results = []
        for batch_number, frame in enumerate(overlay):
            array = np.clip(255.0 * frame.cpu().numpy(), 0, 255).astype(np.uint8)
            pil = Image.fromarray(array)
            name = f"{filename.replace('%batch_num%', str(batch_number))}_{counter:05}_.png"
            pil.save(os.path.join(full_output_folder, name), compress_level=4)
            results.append({"filename": name, "subfolder": subfolder, "type": "temp"})
            counter += 1
        return results


NODE_CLASS_MAPPINGS = {"SkinDetailer": SkinDetailer}
NODE_DISPLAY_NAME_MAPPINGS = {"SkinDetailer": "Skin Detailer (SAM3 • Texture • Refine)"}

__all__ = [
    "SkinDetailer",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "MODES",
    "MODE_TEXTURE",
    "MODE_DIFFUSION",
    "DIFFUSION_WIDGETS",
]
