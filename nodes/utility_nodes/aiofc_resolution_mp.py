# -*- coding: utf-8 -*-
"""
ComfyUI node - AIOFC Resolution (MP).

Picks a width/height from a megapixel budget and an aspect ratio, snapped to a
multiple the model actually accepts.
"""

import math

_ASPECT_PRESETS = {
    "from image (input)": None,
    "1:1":   (1, 1),
    "4:3":   (4, 3),
    "3:4":   (3, 4),
    "3:2":   (3, 2),
    "2:3":   (2, 3),
    "16:9":  (16, 9),
    "9:16":  (9, 16),
    "21:9":  (21, 9),
    "5:4":   (5, 4),
    "4:5":   (4, 5),
}


def _nearest_ratio_label(ar: float) -> str:
    """Closest named ratio to `ar`, compared in log space."""
    best = None
    for label, wh in _ASPECT_PRESETS.items():
        if wh is None:
            continue
        cand = wh[0] / wh[1]
        err = abs(math.log(cand / ar))
        if best is None or err < best[0]:
            best = (err, label, cand)
    return best[1]


def _snap_to_budget(megapixels: float, ar: float, multiple: int,
                    min_side: int = 64, max_side: int = 8192) -> tuple:
    """Best (width, height) on the `multiple` grid for a MP budget and ratio."""
    target_px = max(1.0, megapixels * 1_000_000.0)
    ideal_h = math.sqrt(target_px / ar)

    def snap(v):
        return max(multiple, int(round(v / multiple)) * multiple)

    best = None
    base_h = snap(ideal_h)
    for kh in range(-3, 4):
        h = base_h + kh * multiple
        if h < min_side or h > max_side:
            continue
        base_w = snap(h * ar)
        for kw in range(-3, 4):
            w = base_w + kw * multiple
            if w < min_side or w > max_side:
                continue
            px = w * h
            mp_err = abs(px - target_px) / target_px
            ar_err = abs((w / h) - ar) / ar
            score = mp_err + 0.25 * ar_err
            if best is None or score < best[0]:
                best = (score, w, h)

    if best is None:
        h = max(min_side, min(max_side, snap(ideal_h)))
        w = max(min_side, min(max_side, snap(h * ar)))
        return w, h
    return best[1], best[2]


class AiofcResolutionMP:
    """Megapixel-budget resolution picker with 0.01 MP granularity."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "megapixels": ("FLOAT", {
                    "default": 0.98, "min": 0.05, "max": 8.0, "step": 0.01, "round": 0.01,
                    "tooltip": "Pixel budget in megapixels, to two decimals.\n"
                               "MiniMax H3 reference: 1344x768 = 1.03 MP.",
                }),
                "aspect_ratio": (list(_ASPECT_PRESETS.keys()), {
                    "default": "16:9",
                    "tooltip": "Target ratio. 'from image (input)' takes it from connected image.",
                }),
                "multiple_of": ("INT", {
                    "default": 32, "min": 1, "max": 128, "step": 1,
                    "tooltip": "Both sides are snapped to a multiple of this (32 for MiniMax H3).",
                }),
            },
            "optional": {
                "image": ("IMAGE", {
                    "tooltip": "Optional image input to derive aspect ratio from.",
                }),
            },
        }

    RETURN_TYPES = ("INT", "INT", "STRING")
    RETURN_NAMES = ("width", "height", "aspect_ratio")
    FUNCTION = "compute"
    CATEGORY = "AIOFC/Utils"
    DESCRIPTION = (
        "Convert a megapixel budget + aspect ratio into a width/height snapped to a "
        "valid multiple."
    )

    def compute(self, megapixels, aspect_ratio, multiple_of, image=None):
        preset = _ASPECT_PRESETS.get(aspect_ratio)

        if preset is None:
            if image is None:
                raise RuntimeError(
                    "[AIOFC Resolution] 'from image (input)' is selected but no image is connected."
                )
            src_h, src_w = int(image.shape[1]), int(image.shape[2])
            if src_h <= 0 or src_w <= 0:
                raise RuntimeError(f"[AIOFC Resolution] Invalid image dimensions: {src_w}x{src_h}")
            ar = src_w / src_h
            ar_label = f"{src_w}x{src_h}"
            ratio_out = _nearest_ratio_label(ar)
        else:
            ar = preset[0] / preset[1]
            ar_label = aspect_ratio
            ratio_out = aspect_ratio

        width, height = _snap_to_budget(float(megapixels), ar, int(multiple_of))

        actual_mp = (width * height) / 1_000_000.0
        drift = (actual_mp - megapixels) / megapixels * 100.0
        print(
            f"📐 [AIOFC Resolution] {ar_label} -> {width}x{height} | "
            f"{actual_mp:.3f} MP ({drift:+.1f}% vs {megapixels:.2f} requested) | "
            f"ratio {width / height:.4f} (target {ar:.4f}) | /{multiple_of} | "
            f"aspect_ratio out: {ratio_out}"
        )

        return (width, height, ratio_out)


# Backward compatibility alias
AiorbustResolutionMP = AiofcResolutionMP

NODE_CLASS_MAPPINGS = {
    "AiofcResolutionMP": AiofcResolutionMP,
    "AiorbustResolutionMP": AiorbustResolutionMP,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AiofcResolutionMP": "AIOFC Resolution (MP)",
    "AiorbustResolutionMP": "AIOFC Resolution (MP) (Legacy)",
}
