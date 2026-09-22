"""Deterministic 1x skin-texture restoration.

``1x-ITF-SkinDiffDetail-Lite-v1`` is an ESRGAN-family *1x* model (not a LoRA):
it adds plausible pore-level high frequency detail and removes subtle blur at
unchanged resolution. It is loaded and run exactly the way ComfyUI runs upscale
models -- spandrel ``ModelLoader`` plus ``comfy.utils.tiled_scale`` with the
halve-the-tile OOM retry from ``ImageUpscaleWithModel``.

Running it before the diffusion pass is deliberate: the low-denoise refinement
then harmonises the freshly added detail instead of competing with it.
"""

from __future__ import annotations

import logging
from typing import Any

import torch

import comfy.model_management
import comfy.utils

from .composite import align_box, blend_scaled, crop_image, paste_image
from .downloads import ModelDownloadError, ensure_model, find_in_folder
from .segment import mask_bboxes

log = logging.getLogger("SkinDetailer")

TEXTURE_FOLDER = "upscale_models"

#: Default: 1xSkinContrast-High-SuperUltraCompact (Brigadeiro, CC0-1.0).
#: A 43k-parameter SRVGGNetCompact that adjusts skin contrast and tone. Measured
#: on a 400x400 chest crop, 98-99% of its output change survives a /32 average
#: pool -- it is a *tone* operator, not a detail one. That is why the
#: ``preserve_tone`` low-frequency lock is scoped to the diffusion pass only:
#: applying it here would cancel almost the entire effect of this model.
DEFAULT_TEXTURE_FILENAME = "1xSkinContrast-High-SuperUltraCompact.pth"
AUTO_TEXTURE_LABEL = "auto (1xSkinContrast-High-SuperUltraCompact)"
TEXTURE_OFF_LABEL = "off"
#: OpenModelDB lists only a MediaFire link, which is an HTML landing page and
#: cannot be fetched programmatically; this is a direct-download mirror of the
#: same file (181 KB).
TEXTURE_URLS = [
    "https://huggingface.co/notkenski/upscalers/resolve/main/1xSkinContrast-High-SuperUltraCompact.pth",
]
TEXTURE_MANUAL_HINT = (
    "Model page: https://openmodeldb.info/models/1x-SkinContrast-High-SuperUltraCompact\n"
    "Original download (MediaFire - browser only, cannot be fetched automatically):\n"
    "  https://www.mediafire.com/file/py46fnq12hhs5sz/1xSkinContrast-High-SuperUltraCompact.pth/file"
)

#: Context added around each skin region before running the texture model, so
#: tile seams and edge artefacts stay outside the blended area.
REGION_PAD = 24

_TEXTURE_CACHE: dict[str, Any] = {}


def texture_model_options() -> list[str]:
    """Combo options for the ``texture_model`` widget."""
    try:
        import folder_paths

        installed = list(folder_paths.get_filename_list(TEXTURE_FOLDER))
    except Exception:  # pragma: no cover - folder may not exist yet
        installed = []
    return [AUTO_TEXTURE_LABEL] + installed + [TEXTURE_OFF_LABEL]


def resolve_texture_path(selection: str) -> str | None:
    """Map a widget selection to a local file path (``None`` means disabled)."""
    if not selection or selection == TEXTURE_OFF_LABEL:
        return None
    # Prefix match, not equality: workflows saved against an older build carry a
    # different "auto (...)" label and should keep working rather than erroring.
    if selection.startswith("auto"):
        existing = find_in_folder(TEXTURE_FOLDER, DEFAULT_TEXTURE_FILENAME)
        if existing is not None:
            return existing
        return ensure_model(
            TEXTURE_FOLDER,
            DEFAULT_TEXTURE_FILENAME,
            TEXTURE_URLS,
            "1xSkinContrast-High-SuperUltraCompact",
            TEXTURE_MANUAL_HINT,
        )

    path = find_in_folder(TEXTURE_FOLDER, selection)
    if path is None:
        raise ModelDownloadError(
            f"[Skin Detailer] texture model '{selection}' was not found in "
            f"models/{TEXTURE_FOLDER}/.\n"
            "Pick another entry, or select "
            f"'{AUTO_TEXTURE_LABEL}' to download the default automatically."
        )
    return path


def load_texture_model(path: str) -> Any:
    """Load (and cache) a spandrel image model by path."""
    cached = _TEXTURE_CACHE.get(path)
    if cached is not None:
        return cached

    try:
        from spandrel import ImageModelDescriptor, ModelLoader
    except ImportError as exc:  # pragma: no cover - spandrel ships with ComfyUI
        raise ModelDownloadError(
            "[Skin Detailer] spandrel is not installed, so the texture model "
            "cannot be loaded. Set texture_model to 'off', or repair the "
            "ComfyUI installation."
        ) from exc

    state_dict = comfy.utils.load_torch_file(path, safe_load=True)
    if "module.layers.0.residual_group.blocks.0.norm1.weight" in state_dict:
        state_dict = comfy.utils.state_dict_prefix_replace(state_dict, {"module.": ""})
    model = ModelLoader().load_from_state_dict(state_dict).eval()
    if not isinstance(model, ImageModelDescriptor):
        raise ModelDownloadError(
            f"[Skin Detailer] '{path}' is not a single-image model and cannot be "
            "used as a texture model."
        )
    log.info("[Skin Detailer] texture model loaded (scale %sx): %s", model.scale, path)
    _TEXTURE_CACHE[path] = model
    return model


def purge_texture_cache() -> None:
    """Drop cached texture models."""
    _TEXTURE_CACHE.clear()
    comfy.model_management.soft_empty_cache()


def _run_model(model: Any, image: torch.Tensor) -> torch.Tensor:
    """Tiled inference with the OOM retry loop from ``ImageUpscaleWithModel``."""
    device = comfy.model_management.get_torch_device()

    memory_required = comfy.model_management.module_size(model.model)
    memory_required += (512 * 512 * 3) * image.element_size() * max(model.scale, 1.0) * 384.0
    memory_required += image.nelement() * image.element_size()
    comfy.model_management.free_memory(memory_required, device)

    model.to(device)
    in_img = image.movedim(-1, -3).to(device)
    output_device = comfy.model_management.intermediate_device()

    tile = 512
    overlap = 32
    try:
        while True:
            try:
                steps = in_img.shape[0] * comfy.utils.get_tiled_scale_steps(
                    in_img.shape[3], in_img.shape[2], tile_x=tile, tile_y=tile, overlap=overlap
                )
                pbar = comfy.utils.ProgressBar(steps)
                result = comfy.utils.tiled_scale(
                    in_img,
                    lambda a: model(a.float()),
                    tile_x=tile,
                    tile_y=tile,
                    overlap=overlap,
                    upscale_amount=model.scale,
                    pbar=pbar,
                    output_device=output_device,
                )
                break
            except Exception as exc:
                comfy.model_management.raise_non_oom(exc)
                tile //= 2
                if tile < 128:
                    raise
    finally:
        model.to("cpu")

    result = torch.clamp(result.movedim(-3, -1), min=0.0, max=1.0).to(torch.float32)
    if result.shape[1] != image.shape[1] or result.shape[2] != image.shape[2]:
        # Defensive: the default model is 1x, but a user-picked model may not be.
        result = comfy.utils.common_upscale(
            result.movedim(-1, 1), image.shape[2], image.shape[1], "bicubic", crop="disabled"
        ).movedim(1, -1)
    return result


def apply_texture(
    image: torch.Tensor,
    mask: torch.Tensor,
    model: Any,
    strength: float,
) -> torch.Tensor:
    """Add skin texture to a single image, blended through ``mask * strength``.

    Only the bounding regions of the mask are pushed through the model, so a
    small patch of skin on a large canvas stays cheap.

    Args:
        image: ``[1, H, W, C]`` float image in 0..1.
        mask: ``[1, H, W]`` effective skin mask in 0..1.
        model: a loaded spandrel ``ImageModelDescriptor``.
        strength: 0..1 blend strength for the texture layer.

    Returns:
        ``[1, H, W, C]`` float32 image; pixels where ``mask == 0`` are unchanged.
    """
    if strength <= 0.0:
        return image.to(torch.float32)

    height, width = image.shape[1], image.shape[2]
    boxes = mask_bboxes(mask, threshold=0.01, pad=REGION_PAD)
    if not boxes:
        return image.to(torch.float32)

    total_area = sum((b[2] - b[0]) * (b[3] - b[1]) for b in boxes)
    if total_area >= 0.85 * height * width:
        boxes = [(0, 0, width, height)]

    out = image.to(torch.float32)
    for box in boxes:
        comfy.model_management.throw_exception_if_processing_interrupted()
        box = align_box(box, width, height, pad=0, stride=1)
        patch = crop_image(out, box)
        textured = _run_model(model, patch)
        out = paste_image(out, textured, box)

    # The mask, not the crop rectangle, decides what actually changes.
    return blend_scaled(image, out, mask, strength)
