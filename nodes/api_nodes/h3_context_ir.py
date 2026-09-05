"""H3 Context-IR — remote stub.

THIS FILE SHIPS TO CUSTOMERS. Assume every line is read. Nothing here is
proprietary: it turns tensors into bytes, forwards them, and prints what comes
back. The grounding schema, the compilation rules and the MiniMax guides live
on the service and are never delivered to a pod.

Node identity is unchanged — same node_id, same widget ORDER, same outputs — so
existing workflows keep working with no edits. ComfyUI stores widget values
positionally, so `guide_folder` survives as an ignored placeholder and
`license_key` is appended last; removing or reordering a widget here silently
feeds every later value into the wrong input.
"""
from __future__ import annotations

import base64
import io
import json
import os
import wave

import numpy as np
import requests
from PIL import Image

# The licence gate lives in aiorbust_license so both gated nodes share one
# implementation. Imported defensively: this file is the customer-facing stub
# and must still load if that module is ever absent, in which case the local
# resolver below is used and the service stays the only gate -- which it is
# in every case anyway, since it re-checks the key on every request.
try:
    from ..utility_nodes.aiofc_license import check as _license_check
except Exception:
    _license_check = None

# The live service. Not a secret — it is a public HTTPS endpoint, and every
# request to it is licence-checked. Overridable so you can point a pod at a
# staging deployment without shipping a different client.
DEFAULT_API_URL = "https://aiorbust-h3-ir.fly.dev"
API_URL = os.environ.get("AIORBUST_API_URL", "").strip() or DEFAULT_API_URL
TIMEOUT = 600
CLIENT_VERSION = "0.2.0"
NODE_ID = "H3ContextIR"

# Named intents the service holds. Only the LABELS ship here; the prompt
# each one stands for lives in app/intents.py and never reaches a pod.
INTENT_CUSTOM = 'Custom (use the intent box)'
INTENT_PRESETS = [
    'Custom (use the intent box)',
    'Motion Control - corrected first frame',
    'Motion Control - identity from picture',
]

ROLE_REFERENCE = "reference"
ROLES = [ROLE_REFERENCE, "first_frame", "last_frame"]
PROVIDERS = ["Gemini", "Vertex", "Grok"]
TARGET_H3 = "MiniMax H3"
TARGET_SEEDANCE = "Seedance"
TARGETS = [TARGET_H3, TARGET_SEEDANCE]
# Mirrors _MODELS + _GROK_MODELS in the private pack's H3 node
# (aiorbust-ofm-pack/nodes/h3_context_ir.py), which is the source of truth for
# this node's model ids. The two lists are kept identical so a workflow saved
# against one pack validates against the other -- ComfyUI rejects a combo value
# that is not in the list, so a divergent list breaks saved graphs outright.
#
# One flat combo shared by every provider: `provider` is chosen separately, so
# pick a model that belongs to the provider you selected. The service forwards
# `model` verbatim and does not validate it, so an id the upstream API no
# longer serves fails at that API rather than here.
MODELS = [
    # Gemini / Vertex
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    # Grok (xAI) -- needs provider="Grok" and a grok_api_key
    "grok-4.20-0309-reasoning",
    "grok-4.20-0309-non-reasoning",
    "grok-4-1-fast-reasoning",
    "grok-4-1-fast-non-reasoning",
    "grok-2-vision-1212",
]

VIDEO_KEYFRAMES = 8
AUDIO_SR = 16000    # mono 16-bit at 16 kHz: speech-grade, small enough inline


# ---------------------------------------------------------------------------
# Tensor -> bytes. This must stay client-side; torch tensors only exist here.
# ---------------------------------------------------------------------------

# How much encoded media one request may carry, before base64. The service
# rejects anything much past 4.5 MB, and the JSON around the images needs room
# too -- the intent, the grounding, the role labels.
MEDIA_BUDGET_BYTES = 3_200_000

# Tried in order until the whole set fits, best first.
#
# Lossless leads, so a graph with a couple of pictures gives up nothing at all.
# It is listed knowing it rarely wins past two or three assets -- PNG is around
# 270 KB for a 768x1344 photograph, so seventeen of them are 6 MB and over
# budget -- but when it does fit there is no reason to send anything else.
#
# q95 is the workhorse: about a quarter of a percent mean pixel difference from
# the original, at a quarter of the size. Below that the entries trade real
# detail for room, and are only reached by sets that would otherwise be
# refused outright.
#
# Worth remembering what the pixels are for. Pass A grounds the scene -- who is
# where, facing which way, lit how, wearing what -- and Gemini downsamples to
# media_resolution before it looks at any of it. Fine detail stops informing
# that answer long before it stops being visible to a person.
MEDIA_PROFILES = [
    (None, "PNG",  None),   # lossless; wins on small sets
    (1536, "JPEG", 95),
    (1536, "JPEG", 88),
    (1152, "JPEG", 85),
    (896,  "JPEG", 82),
    (768,  "JPEG", 80),
    (640,  "JPEG", 75),
    (512,  "JPEG", 70),
]


def _encode_image(frame, max_edge=None, fmt="PNG", quality=None) -> str:
    """One frame, base64. `max_edge=None` keeps the source resolution.

    Alpha is dropped: none of the slots carry any, and it would only cost size.
    """
    arr = (255.0 * frame.cpu().numpy()).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(arr)
    if img.mode != "RGB":
        img = img.convert("RGB")
    if max_edge and max(img.size) > max_edge:
        img.thumbnail((max_edge, max_edge), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt == "PNG":
        img.save(buf, format="PNG", optimize=True)
    else:
        img.save(buf, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _tensor_to_png_b64(frame) -> str:
    """Kept for callers that want one frame at the default profile."""
    return _encode_image(frame)


def _fit_media(frames, budget=MEDIA_BUDGET_BYTES):
    """([base64, ...], note). Steps down until the whole set fits the budget.

    Measured on the real set rather than assumed per image, because how well a
    frame compresses varies enormously -- a flat studio background and a busy
    outdoor scene differ several-fold at identical settings.
    """
    if not frames:
        return [], ""
    for i, (edge, fmt, q) in enumerate(MEDIA_PROFILES):
        encoded = [_encode_image(f, edge, fmt, q) for f in frames]
        total = sum(len(e) for e in encoded) * 3 // 4
        if total <= budget or i == len(MEDIA_PROFILES) - 1:
            if i == 0:
                return encoded, ""          # lossless, nothing to report
            how = ("%dpx q%d" % (edge, q)) if edge else ("q%d" % q)
            return encoded, ("%d assets exceed the request budget as PNG; sent "
                             "as %s (%.1f MB)." % (len(frames), how, total / 1e6))
    return [], ""


def _audio_to_wav_b64(audio) -> str:
    """ComfyUI AUDIO -> mono 16-bit PCM WAV at 16 kHz, base64.

    Mono 16-bit is what actually populates the soundscape with dated events
    rather than a generic sentence: the model needs a waveform it can
    transcribe, not a high-fidelity stereo mix. 16 kHz keeps 15 s near 480 KB.
    """
    import torch

    wav = audio["waveform"]
    sr = int(audio["sample_rate"])
    if wav.ndim == 3:
        wav = wav[0]
    if wav.ndim == 2:
        wav = wav.mean(dim=0)
    wav = wav.detach().cpu().float()

    if sr != AUDIO_SR:
        n_out = max(1, int(round(wav.shape[0] * AUDIO_SR / float(sr))))
        wav = torch.nn.functional.interpolate(
            wav.view(1, 1, -1), size=n_out, mode="linear", align_corners=False
        ).view(-1)

    peak = float(wav.abs().max()) if wav.numel() else 0.0
    if peak > 1.0:
        wav = wav / peak
    pcm = (wav.clamp(-1.0, 1.0) * 32767.0).to(torch.int16).numpy()

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(AUDIO_SR)
        wf.writeframes(pcm.tobytes())
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _keyframe_indices(frames, count: int = VIDEO_KEYFRAMES) -> list:
    """Which frames to send, evenly spread across the clip including both ends.

    Separate from encoding them so the selection can happen before anything is
    sized -- the keyframes share their budget with the still images.
    """
    total = int(frames.shape[0])
    if total == 0:
        return []
    count = min(count, total)
    if count <= 1:
        return [0]
    return [int(round(i * (total - 1) / (count - 1))) for i in range(count)]


def _sample_keyframes(frames, fps: float, count: int = VIDEO_KEYFRAMES) -> list:
    """Kept for anything calling this directly; encodes at the default profile."""
    return [{"t": i / float(fps or 24.0), "data": _encode_image(frames[i])}
            for i in _keyframe_indices(frames, count)]


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

def _vertex_credential(folder: str) -> dict:
    """Mint a short-lived OAuth token locally and forward only that.

    The service-account JSON never leaves this machine. A token is good for
    about an hour, so a leak costs an hour of access rather than a permanent
    key — which is why this is worth the extra dependency over just POSTing
    the file contents.
    """
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import service_account

    folder = (folder or "").strip()
    if not folder or not os.path.isdir(folder):
        raise RuntimeError(
            "[H3 Context-IR] vertex_json_folder not found: %r\n"
            "-> Put your Vertex service-account JSON in that folder, or switch "
            "`provider` to Gemini and paste a key into gemini_api_key." % folder
        )
    files = sorted(os.path.join(folder, f) for f in os.listdir(folder)
                   if f.lower().endswith(".json"))
    if not files:
        raise RuntimeError("[H3 Context-IR] No .json in %s" % folder)

    with open(files[0], "r", encoding="utf-8") as fh:
        project_id = json.load(fh).get("project_id", "")
    creds = service_account.Credentials.from_service_account_file(
        files[0], scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(GoogleRequest())
    return {"kind": "vertex_token", "access_token": creds.token,
            "project_id": project_id}


def _license_file_candidates():
    """Where a key file may live, most specific first.

    Several entries because this node runs in two very different places: a
    RunPod pod with a /workspace volume, and a Windows portable install where
    that path does not exist. Rather than make the customer configure which,
    look in all the plausible spots — it is a handful of stat() calls.
    """
    paths = []

    explicit = os.environ.get("AIORBUST_LICENSE_FILE", "").strip()
    if explicit:
        paths.append(explicit)

    # Pod: the network volume, which start.sh seeds and which survives restarts.
    paths.append("/workspace/aiorbust/license.key")

    # ComfyUI's own user directory. The idiomatic place for per-install config,
    # and it survives updating or reinstalling this node pack.
    try:
        import folder_paths
        user_dir = folder_paths.get_user_directory()
        paths.append(os.path.join(user_dir, "aiorbust", "license.key"))
    except Exception:
        pass

    # Next to the node pack — the first place someone looks locally.
    pack_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths.append(os.path.join(pack_dir, "license.key"))

    # Home directory, for a key shared across several ComfyUI installs.
    paths.append(os.path.join(os.path.expanduser("~"), ".aiorbust", "license.key"))

    return paths


def _read_key_file(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Tolerate "AIORBUST_LICENSE_KEY=..." from someone pasting an
                # env-var line into the file.
                return line.split("=")[-1].strip()
    except OSError:
        pass
    return ""


# Node ids whose license_key widget counts as the graph-wide key.
LICENSE_NODE_CLASS_TYPES = ("AiorbustLicense",)


def _key_from_prompt(prompt) -> str:
    """The key typed into an Aiorbust License node of the queued graph.

    `prompt` is ComfyUI's hidden PROMPT input -- every node in the graph,
    executed or not. Reading it here is what lets a licence node supply the key
    while sitting unconnected: an unconnected node is never executed, so
    anything it might pass along at run time never arrives.

    Only a literal counts; a wired input shows up as [node_id, slot].
    """
    if not isinstance(prompt, dict):
        return ""
    # Sorted so two licence nodes in one graph resolve the same way every queue.
    for node_id in sorted(prompt, key=lambda k: (len(str(k)), str(k))):
        node = prompt.get(node_id)
        if not isinstance(node, dict):
            continue
        if node.get("class_type") not in LICENSE_NODE_CLASS_TYPES:
            continue
        value = (node.get("inputs") or {}).get("license_key")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _license_key(widget_value: str, prompt=None) -> str:
    """First hit wins: environment, then a key file, then the widget, then an
    Aiorbust License node anywhere in the graph.

    Order is about leak risk, not convenience. A widget value is saved INTO the
    workflow JSON, so a customer who types their key there and then shares the
    graph — which people do constantly — ships a working licence with it. The
    env var and the files never travel.

    Files are read on every call rather than cached, so dropping a key in works
    on the next queue with no ComfyUI restart.

    The licence node comes after this node's own widget, so a key typed or
    wired directly here still wins -- which is how one graph can run two
    different licences.
    """
    key = os.environ.get("AIORBUST_LICENSE_KEY", "").strip()
    if key:
        return key

    for path in _license_file_candidates():
        key = _read_key_file(path)
        if key:
            return key

    key = (widget_value or "").strip()
    if key:
        return key

    return _key_from_prompt(prompt)


def _pod_fingerprint() -> str:
    for var in ("RUNPOD_POD_ID", "VAST_CONTAINERLABEL", "HOSTNAME"):
        v = os.environ.get(var)
        if v:
            return v
    return "unknown"


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------

class H3ContextIR:
    """Two-pass H3 prompt compiler. Runs on the Aiorbust service."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "intent": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Keep this SHORT, and write only what must CHANGE. "
                               "The media are read for everything else.",
                }),
                "duration_seconds": ("FLOAT", {
                    "default": 8.0, "min": 2.0, "max": 15.0, "step": 0.1}),
                "aspect_ratio": ("STRING", {
                    "default": "adaptive", "multiline": False,
                    "tooltip": "adaptive, 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 3:2, "
                               "2:3, 5:4, 4:5. Connect Aiorbust Resolution (MP)'s "
                               "aspect_ratio output to keep it in sync."}),
                # Index 3, matching the private pack. Inserted BEFORE provider,
                # so every widget after it shifts by one — a workflow saved with
                # the older node will load its values one slot early until it is
                # re-saved. That is upstream's ordering, not a choice here.
                "target_model": (TARGETS, {
                    "default": TARGET_H3,
                    "tooltip": "Which grammar pass B compiles for. Seedance uses "
                               "ByteDance's six-slot grammar and does NOT load the "
                               "MiniMax guides — they demand an exhaustive "
                               "description, which Seedance treats as a failure."}),
                "provider": (PROVIDERS, {"default": "Gemini"}),
                "model": (MODELS, {"default": "gemini-3.6-flash"}),
                # DEPRECATED, and kept only to hold its position. ComfyUI stores
                # widget values POSITIONALLY in the workflow JSON, so removing a
                # widget silently shifts every value after it onto the wrong
                # input — a saved graph then feeds this slot's old path into
                # max_tokens and errors with "invalid literal for int()".
                # The guides live on the service now and this value is ignored.
                # Do not delete it; a replacement must go on the END.
                "guide_folder": ("STRING", {
                    "default": "", "multiline": False,
                    "tooltip": "No longer used — the guides live on the Aiorbust "
                               "service. Kept so existing workflows keep loading."}),
                "max_tokens": ("INT", {
                    "default": 8192, "min": 512, "max": 65536, "step": 512}),
            },
            "optional": {
                # Six discrete slots plus a batch, matching the node this
                # replaces. Roles exist only on the first two: first_frame /
                # last_frame are positional ideas that stop being meaningful
                # once you are on your fifth reference.
                "image_1": ("IMAGE",),
                "image_1_role": (ROLES, {"default": ROLE_REFERENCE}),
                "image_2": ("IMAGE",),
                "image_2_role": (ROLES, {"default": ROLE_REFERENCE}),
                "image_3": ("IMAGE",),
                "image_4": ("IMAGE",),
                "image_5": ("IMAGE",),
                "image_6": ("IMAGE",),
                "images_batch": ("IMAGE",),
                "video": ("IMAGE",),
                "video_fps": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0}),
                "media_resolution": (
                    ["default", "low", "medium", "high"], {"default": "low"}),
                "video_keyframes": ("INT", {
                    "default": VIDEO_KEYFRAMES, "min": 1, "max": 32}),
                "video_audio": ("AUDIO",),
                "ref_audio_1": ("AUDIO",),
                "ref_audio_2": ("AUDIO",),
                "gemini_api_key": ("STRING", {"default": "", "multiline": False}),
                "grok_api_key": ("STRING", {"default": "", "multiline": False}),
                "vertex_json_folder": ("STRING", {"default": "", "multiline": False}),
                "grounding_override": ("STRING", {"default": "", "multiline": True}),
                # LAST, deliberately. Anything added here must go after every
                # widget the original node had, or saved workflows shift.
                "license_key": ("STRING", {
                    "default": "", "multiline": False,
                    "tooltip": "LAST RESORT. A key typed here is saved into the "
                               "workflow JSON and travels with every copy you share. "
                               "Prefer AIORBUST_LICENSE_KEY in the pod environment, or "
                               "put the key in /workspace/aiorbust/license.key.\n\n"
                               "Leave it empty and an Aiorbust License node anywhere "
                               "in the graph supplies the key, wired in here or not."}),
                # Appended after license_key, not slotted in beside `intent`
                # where it belongs visually. ComfyUI stores widget values by
                # position, so inserting it there would shift every later value
                # in every saved workflow onto the wrong input. Ugly beats wrong.
                "intent_preset": (INTENT_PRESETS, {
                    "default": INTENT_CUSTOM,
                    "tooltip": "A named intent held by the Aiorbust service. "
                               "Anything but Custom REPLACES the intent box, so "
                               "the prompt itself never has to live in the "
                               "workflow file. Custom uses what you typed."}),
            },
            # The whole queued graph, injected by ComfyUI. Read only to find an
            # Aiorbust License node's key, which is what lets that node supply
            # one while sitting unconnected. Named aiorbust_graph rather than
            # prompt because hidden inputs arrive in the same kwargs as the
            # widgets, and a collision there silently replaces a widget value.
            "hidden": {"aiorbust_graph": "PROMPT"},
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("h3_prompt", "grounding_json")
    FUNCTION = "run"
    CATEGORY = "AIOFC/MiniMax H3"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        """Always re-run.

        Without this ComfyUI replays the previous output whenever the inputs
        are unchanged, so re-queueing the same graph returns the same prompt
        and never reaches the service at all. That is the wrong default here:
        the whole point of queueing again is usually to get a different take.

        Re-running is cheaper than it looks. The service caches pass A on the
        media itself, so the vision call -- the expensive half -- is served
        from cache and only pass B runs again. A fresh prompt for the cost of
        the compile, not the grounding.
        """
        return float("nan")

    def run(self, intent, duration_seconds, aspect_ratio, target_model, provider, model,
            max_tokens, image_1=None, image_1_role=ROLE_REFERENCE,
            image_2=None, image_2_role=ROLE_REFERENCE,
            image_3=None, image_4=None, image_5=None, image_6=None,
            images_batch=None, video=None, video_fps=24.0, video_keyframes=VIDEO_KEYFRAMES,
            media_resolution="low", video_audio=None,
            ref_audio_1=None, ref_audio_2=None,
            gemini_api_key="", grok_api_key="", vertex_json_folder="",
            license_key="", grounding_override="", guide_folder="",
            intent_preset=INTENT_CUSTOM, aiorbust_graph=None):

        # Gate BEFORE the payload is built. Without this an unlicensed run
        # encodes and uploads several MB of base64 media only to be turned
        # away by the service, and the user reads whatever the server put in
        # `detail` rather than a message naming the places a key can live.
        #
        # The entitlement matches the service exactly: app/nodes/h3_context_ir.py
        # registers this node with entitlement="h3_context_ir", and
        # /v1/nodes/H3ContextIR validates against that same string. Checking it
        # here only moves the same refusal earlier -- a key without the
        # entitlement was always going to be turned away, now it happens before
        # the upload and says which plan grants what.
        if _license_check is not None:
            key = _license_check("h3_context_ir", license_key,
                                 label="H3 Context-IR", prompt=aiorbust_graph)
        else:
            key = _license_key(license_key, aiorbust_graph)

        if provider == "Vertex":
            credential = _vertex_credential(vertex_json_folder)
        else:
            token = (grok_api_key if provider == "Grok" else gemini_api_key).strip()
            if not token:
                raise RuntimeError(
                    "[H3 Context-IR] %s needs an API key in the %s_api_key widget."
                    % (provider, provider.lower()))
            credential = {"kind": "api_key", "value": token}

        # Connection order decides labelling: the first supplied slot becomes
        # <Picture 1>. Skipping image_3 never leaves a gap in the numbering.
        # Collect first, encode once. The budget covers the whole request, so
        # the pictures and the video keyframes cannot be sized independently:
        # eight keyframes at full detail push six modest images over on their
        # own. Frames are gathered here, sized together below, and handed back
        # to the structures that name them.
        specs, frames = [], []
        for slot, tensor, role in (("image_1", image_1, image_1_role),
                                   ("image_2", image_2, image_2_role),
                                   ("image_3", image_3, ROLE_REFERENCE),
                                   ("image_4", image_4, ROLE_REFERENCE),
                                   ("image_5", image_5, ROLE_REFERENCE),
                                   ("image_6", image_6, ROLE_REFERENCE)):
            if tensor is None:
                continue
            specs.append({"slot": slot, "role": role})
            frames.append(tensor[0])

        # A batch arrives as one IMAGE tensor of N frames; each becomes its own
        # labelled picture, after the discrete slots.
        if images_batch is not None:
            for i in range(int(images_batch.shape[0])):
                specs.append({"slot": "images_batch_%d" % (i + 1),
                              "role": ROLE_REFERENCE})
                frames.append(images_batch[i])

        video_times = []
        if video is not None:
            for idx in _keyframe_indices(video, int(video_keyframes)):
                video_times.append(idx / float(video_fps or 24.0))
                frames.append(video[idx])

        encoded, fit_note = _fit_media(frames)
        if fit_note:
            print("\u26a0\ufe0f  [H3 Context-IR] %s" % fit_note)

        images = [dict(spec, data=data)
                  for spec, data in zip(specs, encoded[:len(specs)])]
        video_frames = [{"t": t, "data": d}
                        for t, d in zip(video_times, encoded[len(specs):])]

        audio = []
        for slot, clip in (("video_audio", video_audio),
                           ("ref_audio_1", ref_audio_1),
                           ("ref_audio_2", ref_audio_2)):
            if clip is not None:
                audio.append({"slot": slot, "data": _audio_to_wav_b64(clip),
                              "enabled": True})

        payload = {
            "provider": provider,
            "credential": credential,
            "model": model,
            "max_tokens": int(max_tokens),
            "media_resolution": media_resolution,
            "intent": intent,
            "intent_preset": intent_preset,
            "aspect_ratio": aspect_ratio,
            "target_model": target_model,
            "duration_seconds": float(duration_seconds),
            "fps": float(video_fps),
            "images": images,
            "video": ({"slot": "video", "fps": float(video_fps),
                       "frames": video_frames}
                      if video is not None else None),
            "audio": audio,
            "grounding_override": grounding_override,
        }

        n_img = len(images) + (len(payload["video"]["frames"]) if payload["video"] else 0)
        print("🔍 [H3 Context-IR] %s | %s/%s | %d image(s), %d audio | media_resolution=%s"
              % (target_model, provider, model, n_img, len(audio), media_resolution))

        # Generic envelope: the service routes on node id, so every licensed
        # node speaks the same outer shape and only `payload` differs.
        envelope = {
            "license_key": key,
            "client_version": CLIENT_VERSION,
            "payload": payload,
        }

        try:
            resp = requests.post(
                "%s/v1/nodes/%s" % (API_URL.rstrip("/"), NODE_ID),
                json=envelope, timeout=TIMEOUT,
                headers={"X-Pod-Fingerprint": _pod_fingerprint()},
            )
        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                "[H3 Context-IR] Could not reach the Aiorbust service at %s (%s).\n"
                "-> Check the pod has outbound internet, then check status." % (API_URL, e))

        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail") or resp.text[:400]
            except Exception:
                detail = resp.text[:400]
            raise RuntimeError(detail)

        data = resp.json()
        for notice in data.get("notices", []):
            print("⚠️  [H3 Context-IR] %s" % notice)

        outputs = data.get("outputs", {})
        usage = data.get("usage", {})
        if usage.get("grounding_cached"):
            print("♻️  [H3 Context-IR] Grounding served from cache — no vision call.")
        print("✅ [H3 Context-IR] Done — prompt %d chars, grounding %d chars"
              % (usage.get("prompt_chars", 0), usage.get("grounding_chars", 0)))

        return (outputs["h3_prompt"], outputs["grounding_json"])


NODE_CLASS_MAPPINGS = {"H3ContextIR": H3ContextIR}
NODE_DISPLAY_NAME_MAPPINGS = {"H3ContextIR": "Aiofc H3 Context-IR (Gemini)"}
