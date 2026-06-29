# ---
# ComfyUI AIOFC - VHS Filename Tools Nodes
# Part of the AIOFC custom nodes collection by Aiofc
#
# Copyright © 2025 Aiofc. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
ComfyUI custom nodes for deriving an output filename from a VHS_LoadVideo node.
"""

import os
import re
from pathlib import Path

try:
    import folder_paths
except Exception:
    folder_paths = None


_INVALID_FILENAME_CHARS = r'<>:"/\\|?*'


def _strip_comfy_annotation(value: str) -> str:
    """Remove optional Comfy path annotation like 'file.mp4 [input]'."""
    return re.sub(r"\s*\[(input|output|temp)\]\s*$", "", value.strip(), flags=re.IGNORECASE)


def _sanitize_filename_stem(stem: str, fallback: str = "video_output") -> str:
    stem = stem.strip()
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", stem)
    stem = re.sub(r"\s+", " ", stem).strip(" .")
    return stem or fallback


def _get_prompt_node(prompt, node_id):
    """Comfy prompt keys are usually strings, but support int fallback too."""
    candidates = [str(node_id)]
    try:
        candidates.append(int(node_id))
    except Exception:
        pass
    for key in candidates:
        if isinstance(prompt, dict) and key in prompt:
            return prompt[key]
    return None


def _get_video_value_from_prompt(prompt, source_node_id):
    node = _get_prompt_node(prompt, source_node_id)
    if not node:
        raise ValueError(f"Could not find source node id {source_node_id!r} in the ComfyUI prompt.")

    inputs = node.get("inputs", {}) if isinstance(node, dict) else {}
    video = inputs.get("video")

    if video is None:
        raise ValueError(f"Source node {source_node_id!r} has no 'video' input in the prompt.")

    # If the video input is connected from another node, Comfy may represent it as [node_id, output_index].
    # VHS_LoadVideo normally has a direct widget value here, so a connection cannot be resolved safely.
    if isinstance(video, (list, tuple)):
        raise ValueError(
            f"Source node {source_node_id!r} video input appears to be connected ({video!r}); "
            "this node expects the VHS_LoadVideo video widget to contain a filename/path."
        )

    return str(video)


def _stem_from_video_value(video_value: str) -> str:
    cleaned = _strip_comfy_annotation(video_value).replace("\\", "/")
    name = os.path.basename(cleaned)
    stem = os.path.splitext(name)[0]
    return _sanitize_filename_stem(stem)


def _safe_output_dir(output_dir: str) -> str:
    output_dir = (output_dir or "").strip().strip("/\\")
    if output_dir in ("", "."):
        output_dir = "prompts"
    return output_dir


def _build_output_path(output_dir: str, filename_stem: str, extension: str, overwrite: bool) -> str:
    extension = (extension or "txt").strip().lstrip(".") or "txt"
    filename_stem = _sanitize_filename_stem(filename_stem)

    if folder_paths is not None:
        base_dir = folder_paths.get_output_directory()
    else:
        base_dir = os.getcwd()

    rel_dir = _safe_output_dir(output_dir)
    full_dir = os.path.abspath(os.path.join(base_dir, rel_dir))
    base_abs = os.path.abspath(base_dir)

    # Prevent accidental writes outside ComfyUI/output through '../'.
    if os.path.commonpath([base_abs, full_dir]) != base_abs:
        raise ValueError(f"Unsafe output_dir: {output_dir!r}")

    os.makedirs(full_dir, exist_ok=True)

    path = os.path.join(full_dir, f"{filename_stem}.{extension}")
    if overwrite or not os.path.exists(path):
        return path

    counter = 1
    while True:
        candidate = os.path.join(full_dir, f"{filename_stem}_{counter:05d}.{extension}")
        if not os.path.exists(candidate):
            return candidate
        counter += 1


class AIOFC_VHSFilenameStemFromPrompt:
    """Return the file stem from a VHS_LoadVideo node's video widget."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "source_node_id": ("STRING", {"default": "99", "multiline": False}),
            },
            "hidden": {
                "prompt": "PROMPT",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("filename_stem",)
    FUNCTION = "get_stem"
    CATEGORY = "AIOFC/Video"

    def get_stem(self, source_node_id, prompt=None):
        video_value = _get_video_value_from_prompt(prompt or {}, source_node_id)
        return (_stem_from_video_value(video_value),)


class AIOFC_SaveTextFromVHSFilename:
    """Save text using the stem of a VHS_LoadVideo input file."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
                "source_node_id": ("STRING", {"default": "99", "multiline": False}),
                "output_dir": ("STRING", {"default": "prompts", "multiline": False}),
                "extension": ("STRING", {"default": "txt", "multiline": False}),
                "overwrite": ("BOOLEAN", {"default": True}),
            },
            "hidden": {
                "prompt": "PROMPT",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("saved_path",)
    FUNCTION = "save_text"
    CATEGORY = "AIOFC/Video"
    OUTPUT_NODE = True

    def save_text(self, text, source_node_id, output_dir="prompts", extension="txt", overwrite=True, prompt=None):
        video_value = _get_video_value_from_prompt(prompt or {}, source_node_id)
        filename_stem = _stem_from_video_value(video_value)
        output_path = _build_output_path(output_dir, filename_stem, extension, overwrite)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("" if text is None else str(text))

        return (output_path,)


NODE_CLASS_MAPPINGS = {
    "AIOFC_VHSFilenameStemFromPrompt": AIOFC_VHSFilenameStemFromPrompt,
    "AIOFC_SaveTextFromVHSFilename": AIOFC_SaveTextFromVHSFilename,
    "VHSFilenameStemFromPrompt": AIOFC_VHSFilenameStemFromPrompt,
    "SaveTextFromVHSFilename": AIOFC_SaveTextFromVHSFilename,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFC_VHSFilenameStemFromPrompt": "AIOFC VHS Filename Stem From Node",
    "AIOFC_SaveTextFromVHSFilename": "AIOFC Save Text From VHS Filename",
    "VHSFilenameStemFromPrompt": "VHS Filename Stem From Node",
    "SaveTextFromVHSFilename": "Save Text From VHS Filename",
}
