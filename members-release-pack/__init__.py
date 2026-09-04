"""ComfyUI custom nodes for Nano Banana Pro and Nano Banana 2 APIs (Monthly)."""

from .Node import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

from .gemini_prompt import GeminiPromptNode

from .prompt_selector import PromptSelectorNode

from .directory_loader import DirectoryImageLoaderNode

from .api_keys import LoadAPIKeysNode

from .video_frame_extractor import VideoFrameExtractorNode

from .image_processing import MetadataRemoveNode, SaveAsPhonePhotoNode

from .lora_caption import LoraCaptionGeneratorNode


from .nodes.nano_banana_aio import NanoBananaAIO

from .nodes.imageUtils import PreviewImageWithoutMetadata

from .nodes.aiorbust_video_loader import AiorBustVideoLoader

from .nodes.instagram_faceswap import InstagramFaceSwapNode

from .nodes.aiorbust_image_batch_loader import AiorbustImageBatchLoader

from .nodes.repose_carousel import ReposeCarouselNode

from .nodes.metadata_bypass import MetadataBypassNode

from .nodes.image_enhancement import ImageEnhancementNode

from .nodes.image_black_check import ImageBlackCheckNode

from .nodes.grok_prompt import GrokPromptNode

from .nodes.aiorbust_resolution_mp import AiorbustResolutionMP

from .nodes.aiorbust_h3_frame_snap import AiorbustH3FrameSnap

from .nodes.aiorbust_audio_switch import AiorbustAudioSwitch

from .nodes.h3_context_ir import H3ContextIR

from .nodes.aiorbust_group_toggle import AiorbustGroupToggle

from .nodes.save_image_no_metadata import SaveImageNoMetadataNode

from .nodes.aiorbust_speed_hd_sampler import AiorbustSpeedHDSampler

from .nodes.aiorbust_eye_detailer import AiorbustEyeBBoxDetectorProvider, AiorbustDetailer



# Post-processing nodes (dossier avec espace + noms unicode -> importlib)

import importlib.util as _ilu, os as _os



_pack_root = _os.path.dirname(_os.path.abspath(__file__))



def _load_pp(filename, modname):

    _path = _os.path.join(_pack_root, "post processing", filename)

    _spec = _ilu.spec_from_file_location(modname, _path)

    _mod  = _ilu.module_from_spec(_spec)

    _spec.loader.exec_module(_mod)

    return _mod



try:

    _renoise_mod = _load_pp("Aiorbust_Renoïse.py", "Aiorbust_Renoise_mod")

    Aiorbust_Renoise = _renoise_mod.Aiorbust_Renoise

    print("[Aiorbust] ✅ Renoïse chargé")

except Exception as _e:

    Aiorbust_Renoise = None

    print(f"[Aiorbust] ❌ Renoïse failed: {_e}")



try:

    _camera_look_mod = _load_pp("Aiorbust_camera_look.py", "Aiorbust_Camera_Look_mod")

    Aiorbust_Camera_Look = _camera_look_mod.Aiorbust_Camera_Look

    print("[Aiorbust] ✅ Camera Look chargé")

except Exception as _e:

    Aiorbust_Camera_Look = None

    print(f"[Aiorbust] ❌ Camera Look failed: {_e}")



try:

    _apply_lut_mod = _load_pp("Aiorbust_Apply_LUT.py", "Aiorbust_Apply_LUT_mod")

    Aiorbust_Apply_LUT = _apply_lut_mod.Aiorbust_Apply_LUT

    print("[Aiorbust] ✅ Apply LUT chargé")

except Exception as _e:

    Aiorbust_Apply_LUT = None

    print(f"[Aiorbust] ❌ Apply LUT failed: {_e}")



WEB_DIRECTORY = "./js"



NODE_CLASS_MAPPINGS["NanoBananaAIO"] = NanoBananaAIO

NODE_CLASS_MAPPINGS["GeminiPromptNode"] = GeminiPromptNode

NODE_CLASS_MAPPINGS["PromptSelectorNodeMonthly"] = PromptSelectorNode

NODE_CLASS_MAPPINGS["DirectoryImageLoaderNode"] = DirectoryImageLoaderNode

NODE_CLASS_MAPPINGS["LoadAPIKeysNode"] = LoadAPIKeysNode

NODE_CLASS_MAPPINGS["VideoFrameExtractorNode"] = VideoFrameExtractorNode

NODE_CLASS_MAPPINGS["MetadataRemoveNodeMonthly"] = MetadataRemoveNode

NODE_CLASS_MAPPINGS["SaveAsPhonePhotoNodeMonthly"] = SaveAsPhonePhotoNode

NODE_CLASS_MAPPINGS["LoraCaptionGeneratorNode"] = LoraCaptionGeneratorNode

NODE_CLASS_MAPPINGS["PreviewImageWithoutMetadata"] = PreviewImageWithoutMetadata

NODE_CLASS_MAPPINGS["AiorBustVideoLoader"] = AiorBustVideoLoader

NODE_CLASS_MAPPINGS["InstagramFaceSwapNode"] = InstagramFaceSwapNode

NODE_CLASS_MAPPINGS["AiorbustImageBatchLoader"] = AiorbustImageBatchLoader

NODE_CLASS_MAPPINGS["ReposeCarouselNode"] = ReposeCarouselNode

NODE_CLASS_MAPPINGS["MetadataBypassNode"] = MetadataBypassNode

NODE_CLASS_MAPPINGS["ImageEnhancementNode"] = ImageEnhancementNode

NODE_CLASS_MAPPINGS["ImageBlackCheckNode"] = ImageBlackCheckNode

NODE_CLASS_MAPPINGS["GrokPromptNode"] = GrokPromptNode

NODE_CLASS_MAPPINGS["AiorbustResolutionMP"] = AiorbustResolutionMP

NODE_CLASS_MAPPINGS["AiorbustH3FrameSnap"] = AiorbustH3FrameSnap

NODE_CLASS_MAPPINGS["AiorbustAudioSwitch"] = AiorbustAudioSwitch

NODE_CLASS_MAPPINGS["H3ContextIR"] = H3ContextIR

NODE_CLASS_MAPPINGS["AiorbustGroupToggle"] = AiorbustGroupToggle

NODE_CLASS_MAPPINGS["SaveImageNoMetadataNode"] = SaveImageNoMetadataNode

NODE_CLASS_MAPPINGS["AiorbustSpeedHDSampler"] = AiorbustSpeedHDSampler

NODE_CLASS_MAPPINGS["AiorbustEyeBBoxDetectorProvider"] = AiorbustEyeBBoxDetectorProvider

NODE_CLASS_MAPPINGS["AiorbustDetailer"] = AiorbustDetailer

if Aiorbust_Renoise:     NODE_CLASS_MAPPINGS["Aiorbust_Renoise"]     = Aiorbust_Renoise

if Aiorbust_Camera_Look: NODE_CLASS_MAPPINGS["Aiorbust_Camera_Look"] = Aiorbust_Camera_Look

if Aiorbust_Apply_LUT:   NODE_CLASS_MAPPINGS["Aiorbust_Apply_LUT"]   = Aiorbust_Apply_LUT



NODE_DISPLAY_NAME_MAPPINGS["NanoBananaAIO"] = "Aiorbust Image and Video Edit AIO"

NODE_DISPLAY_NAME_MAPPINGS["GeminiPromptNode"] = "Aiorbust Prompt Generator"

NODE_DISPLAY_NAME_MAPPINGS["PromptSelectorNodeMonthly"] = "Aiorbust Prompt Selector"

NODE_DISPLAY_NAME_MAPPINGS["DirectoryImageLoaderNode"] = "Aiorbust Directory Image Loader"

NODE_DISPLAY_NAME_MAPPINGS["LoadAPIKeysNode"] = "Aiorbust Load API Keys"

NODE_DISPLAY_NAME_MAPPINGS["VideoFrameExtractorNode"] = "Aiorbust Video Frame Extractor"

NODE_DISPLAY_NAME_MAPPINGS["MetadataRemoveNodeMonthly"] = "Aiorbust Remove Image Metadata"

NODE_DISPLAY_NAME_MAPPINGS["SaveAsPhonePhotoNodeMonthly"] = "Aiorbust Save as Phone Photo"

NODE_DISPLAY_NAME_MAPPINGS["LoraCaptionGeneratorNode"] = "Aiorbust Lora Caption Generator"

NODE_DISPLAY_NAME_MAPPINGS["PreviewImageWithoutMetadata"] = "Aiorbust Preview No Metadata"

NODE_DISPLAY_NAME_MAPPINGS["AiorBustVideoLoader"]      = "Aiorbust Video Loader"

NODE_DISPLAY_NAME_MAPPINGS["InstagramFaceSwapNode"]   = "Aiorbust Content Remaker"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustImageBatchLoader"] = "Aiorbust Image and Video Batch Loader"

NODE_DISPLAY_NAME_MAPPINGS["ReposeCarouselNode"] = "Aiorbust Re-pose for Carousel"

NODE_DISPLAY_NAME_MAPPINGS["MetadataBypassNode"] = "Aiorbust Metadata Bypass"

NODE_DISPLAY_NAME_MAPPINGS["ImageEnhancementNode"] = "Aiorbust Image Enhancement"

NODE_DISPLAY_NAME_MAPPINGS["ImageBlackCheckNode"] = "Aiorbust Image Black Check"

NODE_DISPLAY_NAME_MAPPINGS["GrokPromptNode"] = "Aiorbust Grok Prompt Generator"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustResolutionMP"] = "Aiorbust Resolution (MP)"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustH3FrameSnap"] = "Aiorbust H3 Frame Snap"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustAudioSwitch"] = "Aiorbust Audio Switch"

NODE_DISPLAY_NAME_MAPPINGS["H3ContextIR"] = "H3 Context-IR (Gemini)"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustGroupToggle"] = "Aiorbust Group Toggle"

NODE_DISPLAY_NAME_MAPPINGS["SaveImageNoMetadataNode"] = "Aiorbust Save Image No Metadata"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustSpeedHDSampler"] = "Aiorbust Speed HD Sampler"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustEyeBBoxDetectorProvider"] = "Aiorbust HD Ultralytic BBox Loader"

NODE_DISPLAY_NAME_MAPPINGS["AiorbustDetailer"] = "Aiorbust Detailer"

NODE_DISPLAY_NAME_MAPPINGS["Aiorbust_Renoise"]     = "Aiorbust Renoise"

NODE_DISPLAY_NAME_MAPPINGS["Aiorbust_Camera_Look"] = "📷 Aiorbust Camera Look"

NODE_DISPLAY_NAME_MAPPINGS["Aiorbust_Apply_LUT"]   = "🎨 Aiorbust Apply LUT"



# ---------------------------------------------------------------------------

# Ownership manifest, for public-aiorbust-pack to stand down against.

#

# Both packs register the same node ids -- 19 of them at the time of writing --

# because the public pack is a subset of this one. ComfyUI keeps a single global

# registry, so on a machine carrying both, whichever imports last wins. That is

# alphabetical, which means `public-aiorbust-pack` beats `aiorbust-ofm-pack` and

# the customer-facing build silently shadows the real node. For H3 Context-IR

# that swaps a full local implementation for a licensed remote stub, on the

# machine where the full one is the whole point.

#

# So this writes what it owns and the public pack skips those ids. Written on

# every import rather than committed, so it cannot drift from what is actually

# registered above -- a stale hand-maintained list would reintroduce exactly the

# bug it exists to prevent.

def _write_ownership_manifest():

    import json

    import os



    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),

                        ".aiorbust-private")

    payload = {

        "pack": "aiorbust-ofm-pack",

        "node_ids": sorted(NODE_CLASS_MAPPINGS),

    }

    try:

        with open(path, "w", encoding="utf-8") as fh:

            json.dump(payload, fh, indent=2)

    except OSError as exc:

        # A read-only checkout is not a reason to fail startup; the public pack

        # falls back to presence-detection when the manifest is unreadable.

        print(f"[aiorbust-ofm-pack] Could not write {path}: {exc}")







__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]


# ---------------------------------------------------------------------------
# Added by build_members_pack.py -- do not edit here, edit the builder.
# ---------------------------------------------------------------------------

# The licence node. Members drop it anywhere on the canvas and the two gated
# nodes find the key without a wire.
from .nodes.aiorbust_license import AiorbustLicense  # noqa: E402

NODE_CLASS_MAPPINGS["AiorbustLicense"] = AiorbustLicense
NODE_DISPLAY_NAME_MAPPINGS["AiorbustLicense"] = "Aiorbust License"


# Stand down against the private pack.
#
# This pack shares every node id with aiorbust-ofm-pack. ComfyUI keeps one
# global registry and imports custom_nodes alphabetically, so on a machine
# carrying both, this build would import later and shadow the developer's full
# local nodes -- including replacing the real H3 Context-IR with its licensed
# stub, on the machine where the real one is the whole point.
#
# The private pack writes .aiorbust-private naming what it owns; those ids are
# dropped here. AIORBUST_IGNORE_PRIVATE=1 forces this build to register anyway,
# which is how you test the licensed path on a development machine.
def _private_pack_node_ids():
    import json
    import os

    if os.environ.get("AIORBUST_IGNORE_PRIVATE", "").strip():
        return None, "AIORBUST_IGNORE_PRIVATE"

    custom_nodes = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    try:
        siblings = sorted(os.listdir(custom_nodes))
    except OSError:
        return None, None

    here = os.path.basename(os.path.dirname(os.path.abspath(__file__)))
    for name in siblings:
        if name == here:
            continue
        marker = os.path.join(custom_nodes, name, ".aiorbust-private")
        if not os.path.isfile(marker):
            continue
        try:
            with open(marker, "r", encoding="utf-8") as fh:
                ids = json.load(fh).get("node_ids") or []
            # An empty list means the private pack imported but registered
            # nothing -- a broken install, not a claim of ownership.
            if ids:
                return set(ids), name
        except (OSError, ValueError) as exc:
            print(f"[members-release-pack] Ignoring unreadable {marker}: {exc}")
    return None, None


_owned, _owner = _private_pack_node_ids()
if _owner == "AIORBUST_IGNORE_PRIVATE":
    print("[members-release-pack] AIORBUST_IGNORE_PRIVATE set - registering "
          "everything, including ids the private pack may also claim.")
elif _owned:
    _dropped = sorted(set(NODE_CLASS_MAPPINGS) & _owned)
    for _node_id in _dropped:
        NODE_CLASS_MAPPINGS.pop(_node_id, None)
        NODE_DISPLAY_NAME_MAPPINGS.pop(_node_id, None)
    if _dropped:
        print(f"[members-release-pack] {_owner} is installed and owns "
              f"{len(_dropped)} of these nodes - leaving them to it.")
        print("[members-release-pack] Set AIORBUST_IGNORE_PRIVATE=1 to register "
              "them here instead.")
