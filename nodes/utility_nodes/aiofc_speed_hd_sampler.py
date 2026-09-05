"""AIOFC Speed HD Sampler.

Spectral Progressive Diffusion for Efficient Image and Video Generation.
Progressively expands the latent resolution during denoising, reducing computation while preserving quality.
"""
from __future__ import annotations

from typing import List

import torch

import comfy.samplers
import comfy.k_diffusion.sampling as kds

from .speed_hd_core import (
    _PRESETS,
    _parse_scales,
    _parse_sigmas,
    sample_speed_core,
)


@torch.no_grad()
def sample_speed_hd(
    model, x, sigmas, extra_args=None, callback=None, disable=None,
    *,
    transform: str = "dct",
    base_sampler: str = "euler",
    mode: str = "delta_optimal",
    scales: List[float] = None,
    delta: float = 0.01,
    spectrum_A: float = 203.615097,
    spectrum_beta: float = 1.915461,
    manual_sigmas: List[float] = None,
    seed: int = 0,
):
    """Comfy-compatible ``sample_*`` function."""
    sampler_fn = getattr(kds, f"sample_{base_sampler}", None)
    if sampler_fn is None:
        raise ValueError(f"[AIOFC Speed HD] Unknown base sampler {base_sampler!r}.")

    return sample_speed_core(
        sampler_fn, model, x, sigmas,
        extra_args=extra_args, callback=callback, disable=disable,
        transform=transform, mode=mode, scales=scales, delta=delta,
        spectrum_A=spectrum_A, spectrum_beta=spectrum_beta,
        manual_sigmas=manual_sigmas, seed=seed,
    )


def _list_samplers() -> List[str]:
    """Return supported k-diffusion sampler names."""
    excluded = {"dpm_fast", "dpm_adaptive", "lcm"}
    try:
        names = [a[len("sample_"):] for a in dir(kds) if a.startswith("sample_")]
    except Exception:
        names = ["euler", "euler_ancestral", "heun", "dpmpp_2m", "uni_pc"]
    return sorted(n for n in names if n not in excluded)


class AiofcSpeedHDSampler:
    """Spectral Progressive Diffusion sampler node — AIOFC pack integration."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "base_sampler": (_list_samplers(), {
                    "default": "euler",
                    "tooltip": "Underlying ODE solver. Any comfy k_diffusion sampler is supported.",
                }),
                "transform": (["dct", "dwt", "fft"], {
                    "default": "dct",
                    "tooltip": "Spectral basis used at each transition.",
                }),
                "mode": (["delta_optimal", "manual"], {
                    "default": "delta_optimal",
                    "tooltip": "'delta_optimal' computes transitions automatically from 'scales' and 'delta'.",
                }),
                "model_preset": (list(_PRESETS.keys()), {
                    "default": "flux",
                    "tooltip": "Power-spectrum preset for delta-optimal mode.",
                }),
                "scales": ("STRING", {
                    "default": "0.5,1.0",
                    "tooltip": "Comma-separated resolution fractions ending at 1.0. Example: 0.5,1.0 or 0.25,0.5,1.0.",
                }),
                "delta": ("FLOAT", {
                    "default": 0.01, "min": 1e-4, "max": 0.5, "step": 0.001,
                    "tooltip": "Noise-dominated tolerance. Smaller values transition later.",
                }),
                "manual_sigmas": ("STRING", {
                    "default": "0.85",
                    "tooltip": "Comma-separated sigma thresholds for manual mode.",
                }),
                "spectrum_A": ("FLOAT", {
                    "default": 203.615097, "min": 0.0, "max": 1e6, "step": 0.001,
                    "tooltip": "Power-spectrum amplitude A (used when model_preset=custom).",
                }),
                "spectrum_beta": ("FLOAT", {
                    "default": 1.915461, "min": 0.0, "max": 10.0, "step": 0.001,
                    "tooltip": "Power-spectrum decay exponent beta (used when model_preset=custom).",
                }),
                "seed": ("INT", {
                    "default": 0, "min": 0, "max": 2**31 - 1, "step": 1,
                    "tooltip": "Seed for the spectral-noise padding at each transition.",
                }),
            },
        }

    RETURN_TYPES = ("SAMPLER",)
    RETURN_NAMES = ("sampler",)
    FUNCTION     = "get_sampler"
    CATEGORY     = "AIOFC/Sampling"
    DESCRIPTION  = (
        "AIOFC Speed HD Sampler\n"
        "Spectral Progressive Diffusion — progressively expands the latent resolution "
        "during denoising for faster sampling with preserved quality.\n"
        "Connect the output to SamplerCustomAdvanced."
    )

    def get_sampler(
        self,
        base_sampler, transform, mode, model_preset, scales, delta,
        manual_sigmas, spectrum_A, spectrum_beta, seed,
    ):
        preset = _PRESETS.get(model_preset)
        if preset is not None:
            A, beta = preset["A"], preset["beta"]
        else:
            A, beta = float(spectrum_A), float(spectrum_beta)

        parsed_scales = _parse_scales(scales)
        parsed_sigmas = _parse_sigmas(manual_sigmas) if mode == "manual" else []

        sampler = comfy.samplers.KSAMPLER(
            sample_speed_hd,
            extra_options={
                "transform": transform,
                "base_sampler": base_sampler,
                "mode": mode,
                "scales": parsed_scales,
                "delta": float(delta),
                "spectrum_A": A,
                "spectrum_beta": beta,
                "manual_sigmas": parsed_sigmas,
                "seed": int(seed),
            },
        )
        return (sampler,)


NODE_CLASS_MAPPINGS = {
    "AiofcSpeedHDSampler": AiofcSpeedHDSampler,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AiofcSpeedHDSampler": "AIOFC Speed HD Sampler",
}
