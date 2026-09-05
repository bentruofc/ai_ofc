"""Spectral expansion and transition scheduling utilities for AIOFC Speed HD Sampler.

Ported from ComfyUI-SPEED-SwarmNeo (MIT license, (c) 2026 A. Izzuddin Al Faruq),
which implements the algorithm from Xiao, H., Chao, B., Yariv, L., & Wetzstein, G. (2026),
"Spectral Progressive Diffusion for Efficient Image and Video Generation"
(https://github.com/howardhx/speed).
Used by aiofc_speed_hd_sampler.py via speed_hd_core.py.
"""
from __future__ import annotations

import math
from typing import List, Sequence, Tuple

import numpy as np
from scipy.fft import dctn, idctn


def power_spectrum(omega: float, A: float, beta: float) -> float:
    """Radial power-law spectrum ``P(omega) = A * |omega|**(-beta)``."""
    return A * abs(omega) ** (-beta)


def activation_time(P_omega: float, delta: float) -> float:
    """Return the activation time for one radial frequency ``omega``."""
    if delta >= 1.0:
        raise ValueError(f"delta={delta} >= 1, but we assume the error threshold is < 1.")
    return 1.0 / (1.0 + math.sqrt(delta / (P_omega * (1.0 + P_omega - delta))))


def delta_optimal_transitions(
    scales: Sequence[float],
    delta: float,
    A: float,
    beta: float,
    H: int,
    W: int,
) -> List[float]:
    """Return transition times for adjacent scales."""
    validate_scales(scales)
    omega_max = min(H, W) / 2.0
    transitions: List[float] = []
    for i in range(len(scales) - 1):
        omega_i = scales[i] * omega_max
        transitions.append(activation_time(power_spectrum(omega_i, A, beta), delta))
    return transitions


def align_timestep(t: float, r: float) -> float:
    """Return the aligned flow-matching time after spectral noise expansion."""
    return t * kappa(t, r)


def kappa(t: float, r: float) -> float:
    """Return the state-rescaling factor after spectral noise expansion."""
    return r / (1.0 + (r - 1.0) * t)


def _dct_expand_np(
    x_np: np.ndarray, target_hw: Tuple[int, int], t: float, seed: int,
) -> np.ndarray:
    """DCT spectral noise expansion."""
    H_tgt, W_tgt = target_hw
    H_src, W_src = x_np.shape[-2], x_np.shape[-1]
    if H_tgt < H_src or W_tgt < W_src:
        raise ValueError(
            f"DCT expand: cannot expand to target {target_hw} smaller than "
            f"source ({H_src}, {W_src})."
        )
    rng = np.random.default_rng(seed)
    out = np.empty(x_np.shape[:-2] + (H_tgt, W_tgt), dtype=np.float32)
    for idx in np.ndindex(*x_np.shape[:-2]):
        coeffs_src = dctn(x_np[idx], type=2, norm="ortho")
        big = t * rng.standard_normal((H_tgt, W_tgt)).astype(np.float32)
        big[:H_src, :W_src] = coeffs_src
        out[idx] = idctn(big, type=2, norm="ortho").astype(np.float32)
    return out


def _dwt_expand_np(x_np: np.ndarray, t: float, seed: int) -> np.ndarray:
    """Haar wavelet spectral noise expansion."""
    try:
        import pywt
    except ImportError as e:
        raise ImportError(
            "transform=dwt requires the PyWavelets package; install it with "
            "`pip install PyWavelets`, or use transform=dct / transform=fft."
        ) from e
    H_src, W_src = x_np.shape[-2], x_np.shape[-1]
    H_tgt, W_tgt = H_src * 2, W_src * 2
    rng = np.random.default_rng(seed)
    out = np.empty(x_np.shape[:-2] + (H_tgt, W_tgt), dtype=np.float32)
    for idx in np.ndindex(*x_np.shape[:-2]):
        LL = x_np[idx]
        LH = t * rng.standard_normal(LL.shape).astype(np.float32)
        HL = t * rng.standard_normal(LL.shape).astype(np.float32)
        HH = t * rng.standard_normal(LL.shape).astype(np.float32)
        out[idx] = pywt.waverec2(
            [LL, (LH, HL, HH)], "haar", mode="periodization"
        ).astype(np.float32)
    return out


def _fft_expand_np(
    x_np: np.ndarray, target_hw: Tuple[int, int], t: float, seed: int,
) -> np.ndarray:
    """FFT spectral noise expansion."""
    H_tgt, W_tgt = target_hw
    H_src, W_src = x_np.shape[-2], x_np.shape[-1]
    if H_tgt < H_src or W_tgt < W_src:
        raise ValueError(
            f"FFT expand: cannot expand to target {target_hw} smaller than "
            f"source ({H_src}, {W_src})."
        )
    rng = np.random.default_rng(seed)
    pad_h, pad_w = (H_tgt - H_src) // 2, (W_tgt - W_src) // 2
    out = np.empty(x_np.shape[:-2] + (H_tgt, W_tgt), dtype=np.float32)
    for idx in np.ndindex(*x_np.shape[:-2]):
        X_src = np.fft.fftshift(np.fft.fft2(x_np[idx], norm="ortho"))
        nr = rng.standard_normal((H_tgt, W_tgt)).astype(np.float32)
        ni = rng.standard_normal((H_tgt, W_tgt)).astype(np.float32)
        X_big = np.fft.fftshift(t * (nr + 1j * ni) / np.sqrt(2.0))
        X_big[pad_h:pad_h + H_src, pad_w:pad_w + W_src] = X_src
        out[idx] = np.fft.ifft2(np.fft.ifftshift(X_big), norm="ortho").real.astype(np.float32)
    return out


def validate_scales(scales: Sequence[float]) -> None:
    """Validate a strictly increasing resolution scale list ending at 1.0."""
    if len(scales) == 0:
        raise ValueError("list of resolution scales is empty; supply at least one value.")
    if any(s <= 0.0 or s > 1.0 for s in scales):
        raise ValueError(f"every scale must be in (0, 1]; got {list(scales)}")
    if abs(scales[-1] - 1.0) > 1e-6:
        raise ValueError(f"last scale must equal 1.0 (full resolution); got {scales[-1]}")
    for a, b in zip(scales[:-1], scales[1:]):
        if not (a < b):
            raise ValueError(f"scales must be strictly increasing; got {list(scales)}")
