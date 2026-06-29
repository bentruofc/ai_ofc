# ---
# ComfyUI AIOFC - VHS Filename Tools Nodes
# Part of the AIOFC custom nodes collection by Aiofc
#
# Copyright © 2025 Aiofc. All rights reserved.
# PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED
# ---

"""
ComfyUI custom nodes for saving Qwen/VLM text using the input video's filename.
"""

from __future__ import annotations

import os
import re
from collections import deque
from typing import Any, Dict, Iterable, Optional, Tuple

try:
    import folder_paths
except Exception:  # Allows light import/testing outside ComfyUI.
    folder_paths = None


_INVALID_FILENAME_CHARS = r'<>:"/\\|?*'
_VIDEO_EXTENSIONS = {".webm", ".mp4", ".mkv", ".gif", ".mov", ".avi", ".m4v"}


def _strip_comfy_annotation(value: str) -> str:
    """Remove optional Comfy annotation such as 'file.mp4 [input]'."""
    return re.sub(r"\s*\[(input|output|temp)\]\s*$", "", value.strip(), flags=re.IGNORECASE)


def _sanitize_filename_stem(stem: str, fallback: str = "video_output") -> str:
    stem = str(stem or "").strip()
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", stem)
    stem = re.sub(r"\s+", " ", stem).strip(" .")
    return stem or fallback


def _stem_from_filename_value(filename_value: Any) -> str:
    """Turn a filename/path/value into a safe file stem."""
    if filename_value is None:
        raise ValueError("input_filename is empty.")

    # Some nodes pass tuples/lists; use the first useful scalar string if possible.
    if isinstance(filename_value, (list, tuple)):
        scalar_items = [x for x in filename_value if isinstance(x, (str, int, float))]
        if scalar_items:
            filename_value = scalar_items[0]
        else:
            raise ValueError(f"input_filename must be a filename string, got: {type(filename_value).__name__}")

    # video_info dictionaries from VHS do not normally include the filename, but support common keys just in case.
    if isinstance(filename_value, dict):
        for key in ("filename", "file_name", "video", "video_path", "path", "source_path"):
            if key in filename_value and filename_value[key]:
                filename_value = filename_value[key]
                break
        else:
            raise ValueError(
                "input_filename received a dictionary, but it does not contain a filename/path key. "
                "Connect a STRING filename/stem, or leave input_filename unconnected for auto VHS lookup."
            )

    cleaned = _strip_comfy_annotation(str(filename_value)).replace("\\", "/").strip()
    if not cleaned:
        raise ValueError("input_filename is empty.")

    name = os.path.basename(cleaned)
    stem, ext = os.path.splitext(name)
    # If the user already provides a clean stem, keep it.
    return _sanitize_filename_stem(stem if ext else name)


def _safe_output_dir(output_dir: str) -> str:
    output_dir = (output_dir or "").strip().strip("/\\")
    return output_dir if output_dir not in ("", ".") else "prompts"


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


def _get_prompt_node(prompt: Dict[str, Any], node_id: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(prompt, dict):
        return None
    for key in (str(node_id), node_id):
        if key in prompt and isinstance(prompt[key], dict):
            return prompt[key]
    try:
        int_key = int(node_id)
        if int_key in prompt and isinstance(prompt[int_key], dict):
            return prompt[int_key]
    except Exception:
        pass
    return None


def _node_inputs(node: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(node, dict):
        return {}
    inputs = node.get("inputs", {})
    return inputs if isinstance(inputs, dict) else {}


def _class_type(node: Optional[Dict[str, Any]]) -> str:
    if not isinstance(node, dict):
        return ""
    return str(node.get("class_type") or node.get("type") or "")


def _connected_node_ids(value: Any) -> Iterable[str]:
    """Extract upstream node IDs from Comfy API prompt link values like [node_id, output_index]."""
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        # Normal connection: ["98", 0]
        first, second = value[0], value[1]
        if isinstance(first, (str, int)) and isinstance(second, int):
            yield str(first)
            return
        # Some dynamic/list formats may contain nested connections.
        for item in value:
            yield from _connected_node_ids(item)


def _looks_like_vhs_load_video(node: Dict[str, Any]) -> bool:
    ctype = _class_type(node)
    inputs = _node_inputs(node)

    # Common VideoHelperSuite class names include VHS_LoadVideo and variants.
    if "VHS" in ctype and "LoadVideo" in ctype:
        return "video" in inputs

    # Extra safety for renamed/custom VHS loader nodes.
    vhs_like_inputs = {"video", "force_rate", "frame_load_cap"}
    if vhs_like_inputs.issubset(set(inputs.keys())):
        return True

    return False


def _video_value_from_vhs_node(node: Dict[str, Any]) -> Optional[str]:
    video_value = _node_inputs(node).get("video")
    if video_value is None:
        return None
    # If the video widget itself is connected from another node, the actual runtime value is not in the prompt here.
    if list(_connected_node_ids(video_value)):
        return None
    return str(video_value)


def _find_upstream_vhs_video(prompt: Dict[str, Any], start_node_id: Any) -> Tuple[str, str]:
    """
    Walk upstream from this save node to find the VHS_LoadVideo node that feeds it.
    This handles chains like: VHS_LoadVideo -> QwenVL -> PreviewAny -> SaveText.
    """
    if not isinstance(prompt, dict):
        raise ValueError("ComfyUI did not provide a PROMPT object to this node.")

    visited = set()
    queue = deque([str(start_node_id)])

    while queue:
        node_id = queue.popleft()
        if node_id in visited:
            continue
        visited.add(node_id)

        node = _get_prompt_node(prompt, node_id)
        if not node:
            continue

        if _looks_like_vhs_load_video(node):
            video_value = _video_value_from_vhs_node(node)
            if video_value:
                return video_value, node_id

        for value in _node_inputs(node).values():
            for upstream_id in _connected_node_ids(value):
                if upstream_id not in visited:
                    queue.append(upstream_id)

    # Fallback: if the workflow has exactly one VHS loader, use it.
    candidates = []
    for node_id, node in prompt.items():
        if isinstance(node, dict) and _looks_like_vhs_load_video(node):
            video_value = _video_value_from_vhs_node(node)
            if video_value:
                candidates.append((str(node_id), video_value))

    if len(candidates) == 1:
        node_id, video_value = candidates[0]
        return video_value, node_id

    if len(candidates) > 1:
        candidate_ids = ", ".join(node_id for node_id, _ in candidates)
        raise ValueError(
            "Found multiple VHS_LoadVideo nodes and could not determine which one feeds this save node. "
            f"Candidate node IDs: {candidate_ids}. Connect a STRING filename to input_filename instead."
        )

    raise ValueError(
        "Could not find an upstream VHS_LoadVideo node. "
        "Connect a STRING filename/stem to input_filename, or place this node downstream of Qwen/Preview text that is fed by VHS_LoadVideo."
    )


def _get_video_value_from_prompt_by_id(prompt: Dict[str, Any], source_node_id: Any) -> str:
    node = _get_prompt_node(prompt, source_node_id)
    if not node:
        raise ValueError(f"Could not find source node id {source_node_id!r} in the ComfyUI prompt.")
    video_value = _video_value_from_vhs_node(node)
    if not video_value:
        raise ValueError(f"Source node {source_node_id!r} has no direct 'video' filename value in the prompt.")
    return video_value


class AIOFC_VHSFilenameStemFromPrompt:
    """Return the file stem from a VHS_LoadVideo node's video widget by node ID."""

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

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("filename_stem", "filename_with_ext")
    FUNCTION = "get_filename"
    CATEGORY = "AIOFC/Video"

    def get_filename(self, source_node_id, prompt=None):
        video_value = _get_video_value_from_prompt_by_id(prompt or {}, source_node_id)
        return (_stem_from_filename_value(video_value), os.path.basename(_strip_comfy_annotation(str(video_value))))


class AIOFC_SaveTextFromInputFilename:
    """
    Save text using a filename supplied by optional STRING input, or auto-detected from upstream VHS_LoadVideo.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
                "output_dir": ("STRING", {"default": "prompts", "multiline": False}),
                "extension": ("STRING", {"default": "txt", "multiline": False}),
                "overwrite": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                # This is a real left-side socket. Connect a STRING filename/stem here if you have one.
                # You cannot connect VHS_LoadVideo's video widget directly because it is an input widget, not an output.
                "input_filename": ("STRING", {"forceInput": True}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("saved_path",)
    FUNCTION = "save_text"
    CATEGORY = "AIOFC/Video"
    OUTPUT_NODE = True

    def save_text(
        self,
        text,
        output_dir="prompts",
        extension="txt",
        overwrite=True,
        input_filename=None,
        prompt=None,
        unique_id=None,
    ):
        if input_filename not in (None, ""):
            filename_stem = _stem_from_filename_value(input_filename)
        else:
            video_value, _found_node_id = _find_upstream_vhs_video(prompt or {}, unique_id)
            filename_stem = _stem_from_filename_value(video_value)

        output_path = _build_output_path(output_dir, filename_stem, extension, overwrite)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("" if text is None else str(text))
        return (output_path,)


class AIOFC_SaveTextFromVHSFilename:
    """
    Backward-compatible old node: save text by explicitly entering a VHS_LoadVideo source_node_id.
    """

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
        video_value = _get_video_value_from_prompt_by_id(prompt or {}, source_node_id)
        filename_stem = _stem_from_filename_value(video_value)
        output_path = _build_output_path(output_dir, filename_stem, extension, overwrite)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("" if text is None else str(text))

        return (output_path,)


NODE_CLASS_MAPPINGS = {
    "AIOFC_VHSFilenameStemFromPrompt": AIOFC_VHSFilenameStemFromPrompt,
    "AIOFC_SaveTextFromInputFilename": AIOFC_SaveTextFromInputFilename,
    "AIOFC_SaveTextFromVHSFilename": AIOFC_SaveTextFromVHSFilename,
    "VHSFilenameStemFromPrompt": AIOFC_VHSFilenameStemFromPrompt,
    "SaveTextFromInputFilename": AIOFC_SaveTextFromInputFilename,
    "SaveTextFromVHSFilename": AIOFC_SaveTextFromVHSFilename,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFC_VHSFilenameStemFromPrompt": "AIOFC VHS Filename Stem From Node",
    "AIOFC_SaveTextFromInputFilename": "AIOFC Save Text From Input Filename",
    "AIOFC_SaveTextFromVHSFilename": "AIOFC Save Text From VHS Filename (by node ID)",
    "VHSFilenameStemFromPrompt": "VHS Filename Stem From Node",
    "SaveTextFromInputFilename": "Save Text From Input Filename",
    "SaveTextFromVHSFilename": "Save Text From VHS Filename (by node ID)",
}
