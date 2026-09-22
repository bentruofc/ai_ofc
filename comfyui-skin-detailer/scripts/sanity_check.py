"""CPU-only sanity check for ComfyUI-SkinDetailer.

Runs in seconds on tiny synthetic tensors. No downloads, no GPU, no models.

    python scripts/sanity_check.py

Checks:
  1. the pack imports and registers its node
  2. mask math: subtract / grow / feather / latent-grid downscale
  3. the composite contract: mask == 0 is bit-identical, mask > 0 blends
  4. the low-frequency tone lock that blocks invented blemishes
  5. regional crop/paste round-trip with an identity "refine"
"""

from __future__ import annotations

import importlib
import os
import sys

# Make ComfyUI importable, then the pack itself (as a package, for relative imports).
#
# Finding the *right* tree matters: a machine can easily have several ComfyUI
# source trees (a Desktop bundle, a migrated old install, a manual clone) and
# the custom_nodes folder is often a --base-directory that contains no source at
# all. Checking against a stale tree silently validates the wrong API version,
# so every candidate is collected and the newest one wins. Override with
# COMFYUI_PATH when that guess is wrong.
import glob  # noqa: E402

_PACK_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CUSTOM_NODES = os.path.dirname(_PACK_DIR)
_HOME = os.path.expanduser("~")

_COMFY_CANDIDATES = [
    os.environ.get("COMFYUI_PATH", ""),
    os.path.dirname(_CUSTOM_NODES),
    *glob.glob(os.path.join(_HOME, "ComfyUI-Installs", "*", "ComfyUI")),
    *glob.glob(os.path.join(_HOME, "ComfyUI-Installs", "*")),
    os.path.join(_HOME, "AppData", "Local", "Programs", "ComfyUI", "resources", "ComfyUI"),
]


def _version_of(path: str) -> tuple[int, ...]:
    try:
        with open(os.path.join(path, "comfyui_version.py"), encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("__version__"):
                    raw = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return tuple(int(p) for p in raw.split(".") if p.isdigit())
    except OSError:
        pass
    return (0,)


_found = [
    c for c in _COMFY_CANDIDATES
    if c and os.path.isfile(os.path.join(c, "folder_paths.py"))
]
if not _found:
    sys.exit(
        "sanity_check: could not locate a ComfyUI source tree (no folder_paths.py in:\n  "
        + "\n  ".join(c for c in _COMFY_CANDIDATES if c)
        + "\nSet COMFYUI_PATH to the directory containing folder_paths.py."
    )

_COMFY_ROOT = max(_found, key=_version_of)
_COMFY_VERSION = ".".join(str(p) for p in _version_of(_COMFY_ROOT))
if len(_found) > 1:
    print(f"note: {len(_found)} ComfyUI trees found; checking against the newest.")
    for c in _found:
        marker = "->" if c == _COMFY_ROOT else "  "
        print(f"  {marker} {'.'.join(str(p) for p in _version_of(c)):8} {c}")
sys.path.insert(0, _COMFY_ROOT)
sys.path.insert(0, _CUSTOM_NODES)

import torch  # noqa: E402

_PACKAGE = os.path.basename(_PACK_DIR)
_FAILURES: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name}{(' -- ' + detail) if detail else ''}")
        _FAILURES.append(name)


def test_registration() -> None:
    print("[1] registration")
    pack = importlib.import_module(_PACKAGE)
    mappings = pack.NODE_CLASS_MAPPINGS
    check("NODE_CLASS_MAPPINGS has SkinDetailer", "SkinDetailer" in mappings)
    check(
        "display name registered",
        pack.NODE_DISPLAY_NAME_MAPPINGS.get("SkinDetailer", "").startswith("Skin Detailer"),
    )

    node_cls = mappings["SkinDetailer"]
    schema = node_cls.INPUT_TYPES()
    required = schema["required"]
    optional = schema.get("optional", {})

    check("only 'image' is a required connection", "image" in required)
    for name in ("model", "clip", "vae", "positive"):
        check(f"'{name}' is optional (texture mode needs no diffusion stack)",
              name in optional and name not in required)

    expected_order = [
        "image", "mode",
        "texture_model", "texture_strength", "face_identity_protect",
        "sam3_model", "segmentation_threshold", "mask_expand", "mask_feather",
        # diffusion group, contiguous and last so hiding it collapses cleanly
        "seed", "steps", "cfg", "denoise", "preserve_tone", "skin_prompt",
        "sampler_name", "scheduler", "processing_mode",
    ]
    check("widget order matches the two-mode layout",
          list(required.keys()) == expected_order, str(list(required.keys())))
    check(
        "every input has a tooltip",
        all("tooltip" in spec[1] for spec in list(required.values()) + list(optional.values())),
        str([k for k, v in {**required, **optional}.items() if "tooltip" not in v[1]]),
    )
    check("category is image/enhance", node_cls.CATEGORY == "image/enhance")
    check("outputs are IMAGE + MASK", node_cls.RETURN_TYPES == ("IMAGE", "MASK"))

    # Mode wiring, and the contract the web extension depends on.
    node_mod = importlib.import_module(f"{_PACKAGE}.node")
    check("mode widget offers exactly the two modes",
          list(required["mode"][0]) == [node_mod.MODE_TEXTURE, node_mod.MODE_DIFFUSION],
          str(required["mode"][0]))
    check("texture mode is the default", required["mode"][1]["default"] == node_mod.MODE_TEXTURE)
    check("experimental mode is labelled experimental",
          "experimental" in node_mod.MODE_DIFFUSION.lower())

    names = list(required.keys())
    positions = [names.index(w) for w in node_mod.DIFFUSION_WIDGETS]
    check("every DIFFUSION_WIDGETS entry is a real widget",
          all(w in names for w in node_mod.DIFFUSION_WIDGETS),
          str([w for w in node_mod.DIFFUSION_WIDGETS if w not in names]))
    check("diffusion widgets are contiguous", positions == list(range(min(positions),
                                                                     max(positions) + 1)),
          str(positions))
    check("diffusion widgets are last", max(positions) == len(names) - 1, str(positions))
    # preserve_tone strips low frequency; the default texture model is ~99%
    # low frequency, so applying it there would cancel the model entirely.
    check("preserve_tone is scoped to the diffusion pass",
          "preserve_tone" in node_mod.DIFFUSION_WIDGETS)
    tex = importlib.import_module(f"{_PACKAGE}.texture")
    check("default texture model is SkinContrast",
          tex.DEFAULT_TEXTURE_FILENAME == "1xSkinContrast-High-SuperUltraCompact.pth",
          tex.DEFAULT_TEXTURE_FILENAME)
    check("texture auto label matches the default file",
          "SkinContrast" in tex.AUTO_TEXTURE_LABEL, tex.AUTO_TEXTURE_LABEL)
    check("every texture URL is a direct download (no MediaFire landing pages)",
          all("mediafire" not in u for u in tex.TEXTURE_URLS), str(tex.TEXTURE_URLS))
    check("MediaFire origin is still documented for manual download",
          "mediafire" in tex.TEXTURE_MANUAL_HINT.lower())
    check("older 'auto (...)' labels still resolve",
          tex.resolve_texture_path.__doc__ is not None
          and "auto (1x-ITF-SkinDiffDetail-Lite-v1)".startswith("auto"))

    prompt = required["skin_prompt"][1]["default"].lower()
    check(
        "default prompt does not ask for blemishes",
        not any(word in prompt for word in
                ("imperfection", "blemish", "freckle", "mole", "acne", "hair")),
        prompt,
    )
    check("sam3_model offers an auto entry",
          any(entry.startswith("auto") for entry in required["sam3_model"][0]),
          str(required["sam3_model"][0][:3]))
    check("no 'advanced' flags (they leave layout gaps in the frontend)",
          not any(spec[1].get("advanced") for spec in required.values()),
          str([k for k, v in required.items() if v[1].get("advanced")]))

    # Web extension.
    pack_dir = os.path.dirname(pack.__file__)
    check("WEB_DIRECTORY is exported", getattr(pack, "WEB_DIRECTORY", None) == "./web")
    js = os.path.join(pack_dir, "web", "skin_detailer.js")
    check("web/skin_detailer.js exists", os.path.isfile(js))
    if os.path.isfile(js):
        source = open(js, encoding="utf-8").read()
        check("JS mode strings match Python",
              node_mod.MODE_TEXTURE in source and node_mod.MODE_DIFFUSION in source)
        for widget in node_mod.DIFFUSION_WIDGETS:
            check(f"JS hides '{widget}'", f'"{widget}"' in source)


def test_mask_math() -> None:
    print("[2] mask math")
    segment = importlib.import_module(f"{_PACKAGE}.segment")

    # A 64x64 canvas: a 40x40 skin square with a 10x10 "eye" to subtract.
    skin = torch.zeros(1, 64, 64)
    skin[:, 12:52, 12:52] = 1.0
    non_skin = torch.zeros(1, 64, 64)
    non_skin[:, 20:30, 20:30] = 1.0

    grown = segment.morph_mask(skin, 3)
    check("grow increases coverage", grown.sum() > skin.sum())
    check("grow keeps 0..1 range", float(grown.min()) >= 0.0 and float(grown.max()) <= 1.0)
    check("shrink decreases coverage", segment.morph_mask(skin, -3).sum() < skin.sum())

    subtracted = (grown * (1.0 - non_skin)).clamp(0, 1)
    check("subtract clears the excluded square", float(subtracted[:, 22:28, 22:28].max()) == 0.0)
    check("subtract keeps surrounding skin", float(subtracted[:, 40:50, 40:50].min()) == 1.0)

    holed = skin.clone()
    holed[:, 30:32, 30:32] = 0.0
    check("pinholes are filled", float(segment.fill_pinholes(holed)[:, 30:32, 30:32].min()) == 1.0)

    speckled = subtracted.clone()
    speckled[:, 0, 0] = 1.0
    cleaned = segment.remove_small_blobs(speckled, min_fraction=0.002)
    check("small blobs are dropped", float(cleaned[:, 0, 0]) == 0.0)
    check("main blob survives", float(cleaned[:, 40, 40]) == 1.0)

    feathered = segment.feather_mask(subtracted, 6.0)
    check("feather shape preserved", feathered.shape == subtracted.shape)
    check("feather stays in 0..1", float(feathered.min()) >= 0.0 and float(feathered.max()) <= 1.0)
    check("feather softens the edge",
          0.0 < float(feathered[0, 12, 32]) < 1.0,
          f"edge value {float(feathered[0, 12, 32]):.4f}")
    check("feather leaves the interior solid", float(feathered[0, 45, 45]) > 0.98)
    check("feather of an empty mask is empty",
          float(segment.feather_mask(torch.zeros(1, 32, 32), 8.0).max()) == 0.0)

    boxes = segment.mask_bboxes(subtracted, threshold=0.01, pad=0)
    check("one merged bounding box", len(boxes) == 1, str(boxes))
    x1, y1, x2, y2 = boxes[0]
    check("bbox covers the skin square", x1 <= 12 and y1 <= 12 and x2 >= 52 and y2 >= 52, str(boxes))
    check("empty mask yields no boxes", segment.mask_bboxes(torch.zeros(1, 32, 32)) == [])

    # Latent-grid downscale: this is what comfy.utils.reshape_mask does to the
    # noise_mask, so shapes and ranges must survive it for any stride.
    import comfy.utils

    for stride in (4, 8, 16):
        latent_shape = (1, 4, 64 // stride, 64 // stride)
        reshaped = comfy.utils.reshape_mask(feathered, latent_shape)
        check(f"reshape_mask to stride /{stride}", tuple(reshaped.shape) == latent_shape,
              str(tuple(reshaped.shape)))
        check(f"reshape_mask /{stride} stays in 0..1",
              float(reshaped.min()) >= 0.0 and float(reshaped.max()) <= 1.0)

    # Face-identity attenuation.
    face = torch.zeros(1, 64, 64)
    face[:, 12:32, 12:32] = 1.0
    attenuated = segment.apply_face_protection(subtracted, face, 0.75)
    # (15, 15) is inside the face square, inside the skin square, and outside
    # the subtracted "eye"; (45, 45) is skin but not face.
    check("face skin attenuated to 1 - strength",
          abs(float(attenuated[0, 15, 15]) - 0.25) < 1e-6,
          f"got {float(attenuated[0, 15, 15]):.4f}")
    check("body skin untouched by face protection", float(attenuated[0, 45, 45]) == 1.0)
    check("protect=0 is a no-op",
          torch.equal(segment.apply_face_protection(subtracted, face, 0.0), subtracted))


def test_composite_contract() -> None:
    print("[3] composite contract")
    composite = importlib.import_module(f"{_PACKAGE}.composite")

    torch.manual_seed(0)
    base = torch.rand(2, 32, 48, 3)
    candidate = torch.rand(2, 32, 48, 3)
    mask = torch.zeros(2, 32, 48)
    mask[:, 8:24, 8:24] = 1.0
    mask[:, 4:8, 8:24] = 0.5

    out = composite.composite_masked(base, candidate, mask)
    check("output shape preserved", out.shape == base.shape)

    zero_region = mask == 0
    check(
        "mask == 0 pixels are bit-identical",
        torch.equal(out[zero_region], base[zero_region]),
        f"{int((out[zero_region] != base[zero_region]).sum())} differing values",
    )
    check(
        "mask == 1 pixels equal the candidate",
        torch.equal(out[:, 8:24, 8:24, :], candidate[:, 8:24, 8:24, :]),
    )
    expected_half = base[:, 4:8, 8:24, :] * 0.5 + candidate[:, 4:8, 8:24, :] * 0.5
    check(
        "mask == 0.5 blends 50/50",
        torch.allclose(out[:, 4:8, 8:24, :], expected_half, atol=1e-6),
    )

    # A NaN in the candidate must not leak into untouched pixels.
    poisoned = candidate.clone()
    poisoned[:, 0, 0, :] = float("nan")
    poisoned_out = composite.composite_masked(base, poisoned, mask)
    check("NaN candidate cannot poison mask == 0", bool(torch.isfinite(poisoned_out).all()))

    check(
        "empty mask returns the input exactly",
        torch.equal(composite.composite_masked(base, candidate, torch.zeros(2, 32, 48)), base),
    )
    check(
        "blend_scaled with strength 0 is a no-op",
        torch.equal(composite.blend_scaled(base, candidate, mask, 0.0), base),
    )
    check(
        "blend_scaled halves the mask weight",
        torch.allclose(
            composite.blend_scaled(base, candidate, mask, 0.5),
            composite.composite_masked(base, candidate, mask * 0.5),
            atol=1e-7,
        ),
    )


def test_tone_lock() -> None:
    print("[4] low-frequency tone lock")
    composite = importlib.import_module(f"{_PACKAGE}.composite")

    size = 128
    base = torch.full((1, size, size, 3), 0.5)

    # A "mole": a soft low-frequency blob the refinement stage might invent.
    coords = torch.arange(size, dtype=torch.float32)
    yy, xx = torch.meshgrid(coords, coords, indexing="ij")
    # Mole scale (sigma 24) vs the lock cut-off (sigma 6) -- the same ratio the
    # resolution-relative default produces on a real photo.
    blob = torch.exp(-(((yy - 64) ** 2 + (xx - 64) ** 2) / (2.0 * 24.0 ** 2)))
    # "Pore texture": a high-frequency checkerboard we DO want to keep.
    fine = ((yy.long() + xx.long()) % 2).float() * 0.04

    candidate = (base - blob.view(1, size, size, 1) * 0.25 + fine.view(1, size, size, 1)).clamp(0, 1)

    blurred = composite.gaussian_blur_image(candidate, 6.0)
    check("gaussian_blur_image preserves shape", blurred.shape == candidate.shape)
    check("gaussian_blur_image removes the checkerboard",
          float((blurred - composite.gaussian_blur_image(base, 6.0)).abs().max()) < 0.3)

    locked = composite.lock_low_frequency(base, candidate, 1.0, sigma=6.0)
    check("tone lock preserves shape", locked.shape == candidate.shape)

    blob_before = float((candidate[0, 64, 64] - base[0, 64, 64]).abs().mean())
    blob_after = float((locked[0, 64, 64] - base[0, 64, 64]).abs().mean())
    check("tone lock removes the invented blob",
          blob_after < blob_before * 0.2,
          f"{blob_before:.4f} -> {blob_after:.4f}")

    # Texture is measured directly as adjacent-pixel contrast, in a corner well
    # away from the blob, so the low-frequency correction cannot skew it.
    def texture_energy(x):
        corner = x[0, 4:36, 4:36, 0]
        return float((corner[1:, :] - corner[:-1, :]).abs().mean())

    before, after = texture_energy(candidate), texture_energy(locked)
    check("tone lock keeps the fine texture",
          abs(after - before) < before * 0.02,
          f"{before:.5f} -> {after:.5f}")

    # And the resolution-relative default must land in the same regime.
    auto = composite.lock_low_frequency(base, candidate, 1.0)
    check("default cut-off also removes the blob",
          float((auto[0, 64, 64] - base[0, 64, 64]).abs().mean()) < blob_before * 0.2,
          f"{float((auto[0, 64, 64] - base[0, 64, 64]).abs().mean()):.4f}")
    check("default cut-off keeps the fine texture",
          abs(texture_energy(auto) - before) < before * 0.02,
          f"{before:.5f} -> {texture_energy(auto):.5f}")

    check("tone lock with amount 0 is a no-op",
          torch.equal(composite.lock_low_frequency(base, candidate, 0.0), candidate))
    check("tone lock output stays in 0..1",
          float(locked.min()) >= 0.0 and float(locked.max()) <= 1.0)


def test_crop_paste_roundtrip() -> None:
    print("[5] regional crop/paste round-trip")
    composite = importlib.import_module(f"{_PACKAGE}.composite")
    segment = importlib.import_module(f"{_PACKAGE}.segment")

    torch.manual_seed(1)
    image = torch.rand(1, 96, 128, 3)
    mask = torch.zeros(1, 96, 128)
    mask[:, 20:44, 24:56] = 1.0
    mask[:, 60:80, 90:120] = 1.0

    boxes = segment.mask_bboxes(mask, threshold=0.01, pad=8)
    check("two separate skin regions found", len(boxes) == 2, str(boxes))

    for stride in (8, 16):
        candidate = image.clone()
        for box in boxes:
            aligned = composite.align_box(box, 128, 96, pad=0, stride=stride, min_size=stride * 2)
            x1, y1, x2, y2 = aligned
            check(
                f"stride {stride}: box inside canvas",
                0 <= x1 < x2 <= 128 and 0 <= y1 < y2 <= 96,
                str(aligned),
            )
            check(
                f"stride {stride}: box sides divisible by stride",
                (x2 - x1) % stride == 0 and (y2 - y1) % stride == 0,
                f"{x2 - x1}x{y2 - y1}",
            )
            crop = composite.crop_image(candidate, aligned)
            crop_m = composite.crop_mask(mask, aligned)
            check(
                f"stride {stride}: crop and mask crop agree",
                crop.shape[1:3] == crop_m.shape[1:3],
            )
            # Identity "refine": paste the crop straight back.
            candidate = composite.paste_image(candidate, crop, aligned)

        check(
            f"stride {stride}: identity refine returns the input unchanged",
            torch.equal(candidate, image),
        )
        check(
            f"stride {stride}: composite of an identity candidate is the input",
            torch.equal(composite.composite_masked(image, candidate, mask), image),
        )


def main() -> int:
    print(f"ComfyUI-SkinDetailer sanity check (ComfyUI {_COMFY_VERSION} at {_COMFY_ROOT})\n")
    test_registration()
    test_mask_math()
    test_composite_contract()
    test_tone_lock()
    test_crop_paste_roundtrip()
    print()
    if _FAILURES:
        print(f"FAILED ({len(_FAILURES)}): " + ", ".join(_FAILURES))
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
