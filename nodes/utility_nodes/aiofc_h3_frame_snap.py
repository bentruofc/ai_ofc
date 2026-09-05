# -*- coding: utf-8 -*-
"""
ComfyUI node - AIOFC H3 Frame Snap.

Snaps a frame count down to a length MiniMax H3 can actually generate, so the
target video and the reference video land on the same number of frames.
"""

import math

_VIDEO_OFFSET = 5
_VIDEO_STEP = 17

_AV_OFFSET = 39
_AV_STEP = 51

_MAX_FRAMES = 3600
_FPS = 24.0

MODE_AV = "Video + Audio (17k+5 and 40Hz)"
MODE_VIDEO = "Video only (17k+5)"
_MODES = [MODE_AV, MODE_VIDEO]

ROUND_NEAREST = "nearest (may exceed source)"
ROUND_DOWN = "down (never exceed source)"
_ROUNDINGS = [ROUND_NEAREST, ROUND_DOWN]


def reference_floor(frames: int) -> int:
    """Length H3 truncates a reference video to: the 17k+5 run at or below `frames`."""
    n = int(frames)
    if n < _VIDEO_OFFSET:
        return 0
    return n - ((n - _VIDEO_OFFSET) % _VIDEO_STEP)


def _snap_down(frames: int, offset: int, step: int) -> int:
    """Largest value of the form offset + step*j that is <= frames."""
    if frames < offset:
        return 0
    return offset + ((frames - offset) // step) * step


def _snap_nearest(frames: int, offset: int, step: int) -> int:
    """Closest value of the form offset + step*j, above or below `frames`."""
    if frames <= offset:
        return offset
    j = int(round((frames - offset) / float(step)))
    value = offset + max(0, j) * step
    return min(value, _MAX_FRAMES)


def snap_h3_frames(frames: int, audio_aligned: bool = True,
                   allow_overshoot: bool = True) -> tuple:
    """Return (snapped_frames, note)."""
    n = max(0, int(frames))
    if n > _MAX_FRAMES:
        n = _MAX_FRAMES

    if n < _VIDEO_OFFSET:
        raise RuntimeError(
            f"[AIOFC H3 Frame Snap] {frames} frame(s) is below H3's minimum of "
            f"{_VIDEO_OFFSET}.\n-> Feed a longer video."
        )

    snap = _snap_nearest if allow_overshoot else _snap_down

    if audio_aligned:
        snapped = snap(n, _AV_OFFSET, _AV_STEP)
        if snapped >= _AV_OFFSET:
            return snapped, ""
        fallback = snap(n, _VIDEO_OFFSET, _VIDEO_STEP)
        return fallback, (
            f"under {_AV_OFFSET} frames no length satisfies both grids -> "
            f"video grid only, audio boundary is approximate"
        )

    return snap(n, _VIDEO_OFFSET, _VIDEO_STEP), ""


class AiofcH3FrameSnap:
    """Snap a frame count down to a valid MiniMax H3 run length."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frame_count": ("INT", {
                    "default": 198, "min": 1, "max": _MAX_FRAMES, "step": 1,
                    "tooltip": "Plug the frame count coming out of your video loader.",
                }),
                "alignment": (_MODES, {
                    "default": MODE_AV,
                    "tooltip": "Video + Audio: only lengths that sit on H3's 17k+5 video grid "
                               "AND land exactly on its 40 Hz audio clock (39, 90, 141, 192, 243...). "
                               "Use this whenever the clip has speech.\n"
                               "Video only: the full 17k+5 grid (5, 22, 39, ... 192, 209...).",
                }),
                "rounding": (_ROUNDINGS, {
                    "default": ROUND_NEAREST,
                    "tooltip": "nearest: pick the closest valid run, above or below.\n"
                               "down: never exceed the source.",
                }),
            },
        }

    RETURN_TYPES = ("INT", "FLOAT")
    RETURN_NAMES = ("frames", "seconds")
    FUNCTION = "snap"
    CATEGORY = "AIOFC/Utils"
    DESCRIPTION = (
        "Snap a frame count to a length MiniMax H3 can generate without realigning it. "
        "Prevents the tail H3 invents when it rounds the target up and the reference down."
    )

    def snap(self, frame_count, alignment, rounding=ROUND_NEAREST):
        requested = int(frame_count)
        snapped, note = snap_h3_frames(
            requested,
            audio_aligned=(alignment == MODE_AV),
            allow_overshoot=(rounding == ROUND_NEAREST),
        )

        delta = snapped - requested
        floor = reference_floor(requested)
        gap = snapped - floor
        msg = (
            f"🎬 [AIOFC H3 Frame Snap] {requested} -> {snapped} frames "
            f"({snapped / _FPS:.3f}s @ {_FPS:.0f}fps) | {delta:+d} frame(s) vs source "
            f"| {alignment} | {rounding}"
        )
        if gap > 0:
            msg += (
                f"\n⚠️  [AIOFC H3 Frame Snap] H3 truncates the {requested}-frame source "
                f"to a {floor}-frame reference, so the last {gap} frame(s) "
                f"({gap / _FPS:.3f}s) generate with no reference to follow — expect the "
                f"picture to drift there, and trim them.\n"
                f"   Zero-gap alternatives: {floor} frames ({floor / _FPS:.3f}s) on the "
                f"video grid"
            )
            av_safe = _snap_down(floor, _AV_OFFSET, _AV_STEP)
            if av_safe >= _AV_OFFSET:
                msg += f", {av_safe} frames ({av_safe / _FPS:.3f}s) audio-aligned"
            msg += "."
        elif delta == 0:
            msg += "\n   Already on the grid — nothing to trim."
        if note:
            msg += f"\n⚠️  [AIOFC H3 Frame Snap] {note}"

        if delta < 0 and -delta > _VIDEO_STEP:
            alt, _ = snap_h3_frames(
                requested, audio_aligned=(alignment == MODE_AV), allow_overshoot=True
            )
            if alt != snapped:
                msg += (
                    f"\n⚠️  [AIOFC H3 Frame Snap] dropping {-delta} frames "
                    f"({-delta / _FPS:.3f}s). 'nearest' would give {alt} frames "
                    f"({alt / _FPS:.3f}s)."
                )
        print(msg)

        return (snapped, snapped / _FPS)


# Backward compatibility alias
AiorbustH3FrameSnap = AiofcH3FrameSnap

NODE_CLASS_MAPPINGS = {
    "AiofcH3FrameSnap": AiofcH3FrameSnap,
    "AiorbustH3FrameSnap": AiorbustH3FrameSnap,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AiofcH3FrameSnap": "AIOFC H3 Frame Snap",
    "AiorbustH3FrameSnap": "AIOFC H3 Frame Snap (Legacy)",
}
