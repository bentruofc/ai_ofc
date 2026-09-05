# -*- coding: utf-8 -*-
"""AIOFC License -- one key, picked up by every licensed node.

Drop this node once anywhere in the graph and type the key into it. Every
licensed node in the same graph finds it on its own; the output is still there
for anyone who prefers an explicit wire, but nothing has to be connected.

That works because a licensed node is handed the whole queued prompt (ComfyUI's
hidden PROMPT input) and reads this node's widget straight out of it. No
execution order to get wrong, no wire to forget, and it holds even when this
node sits unconnected in a corner of the canvas -- ComfyUI would never execute
it there, but the key is in the prompt all the same.
"""
import os
import time

import requests

import folder_paths

DEFAULT_API_URL = "https://aiorbust-h3-ir.fly.dev"
API_URL = os.environ.get("AIOFC_API_URL") or os.environ.get("AIORBUST_API_URL") or DEFAULT_API_URL
CLIENT_VERSION = "0.3.0"

_DEFAULT_TTL = 30 * 60
_cache = {}


def _license_file_candidates():
    paths = []
    env_file = os.environ.get("AIOFC_LICENSE_FILE") or os.environ.get("AIORBUST_LICENSE_FILE", "").strip()
    if env_file:
        paths.append(env_file)
    paths.append("/workspace/aiofc/license.key")
    paths.append("/workspace/aiorbust/license.key")
    try:
        paths.append(os.path.join(folder_paths.base_path, "user", "aiofc", "license.key"))
        paths.append(os.path.join(folder_paths.base_path, "user", "aiorbust", "license.key"))
    except Exception:
        pass
    paths.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "license.key"))
    paths.append(os.path.join(os.path.expanduser("~"), ".aiofc", "license.key"))
    paths.append(os.path.join(os.path.expanduser("~"), ".aiorbust", "license.key"))
    return paths


def _read_key_file(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    return line
    except Exception:
        pass
    return ""


LICENSE_NODE_CLASS_TYPES = ("AiofcLicense",)


def key_from_prompt(prompt):
    """The key typed into the AIOFC License node of the queued graph."""
    if not isinstance(prompt, dict):
        return ""
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


def resolve_key(widget_value="", prompt=None):
    """First hit wins."""
    key = os.environ.get("AIOFC_LICENSE_KEY") or os.environ.get("AIORBUST_LICENSE_KEY", "").strip()
    if key:
        return key, "AIOFC_LICENSE_KEY"
    for path in _license_file_candidates():
        key = _read_key_file(path)
        if key:
            return key, path
    key = (widget_value or "").strip()
    if key:
        return key, "license_key widget"
    key = key_from_prompt(prompt)
    if key:
        return key, "the AIOFC License node in this graph"
    return "", "license_key widget"


def _pod_fingerprint():
    for var in ("RUNPOD_POD_ID", "VAST_CONTAINERLABEL", "HOSTNAME"):
        v = os.environ.get(var)
        if v:
            return v
    return "unknown"


def check(entitlement="", widget_value="", label="AIOFC", prompt=None):
    """Gate one node on a valid licence. Returns the key; raises if not licensed."""
    key, source = resolve_key(widget_value, prompt)
    if not key:
        raise RuntimeError(
            "[%s] No AIOFC licence key found.\n"
            "-> Set AIOFC_LICENSE_KEY in the pod environment, drop the key "
            "in /workspace/aiofc/license.key, or add an AIOFC License "
            "node to the graph and type the key into it." % label)

    shown = key[:8] + "..." if len(key) > 8 else key
    hit = _cache.get(key)
    if hit and time.time() < hit["expires"]:
        if entitlement and not _grants(hit.get("entitlements"), entitlement):
            raise RuntimeError(_denied(label, entitlement, hit, source))
        return key

    try:
        resp = requests.post(
            "%s/v1/verify" % API_URL.rstrip("/"),
            json={"license_key": key, "client_version": CLIENT_VERSION,
                  "entitlement": entitlement or ""},
            timeout=30,
            headers={"X-Pod-Fingerprint": _pod_fingerprint()},
        )
    except requests.exceptions.RequestException as e:
        if hit:
            print("[%s] Licence service unreachable (%s) - continuing on the "
                  "last good answer for %s." % (label, e, shown))
            return key
        raise RuntimeError(
            "[%s] Could not reach the license service at %s (%s).\n"
            "-> Check the pod has outbound internet." % (label, API_URL, e))

    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail") or resp.text[:300]
        except Exception:
            detail = resp.text[:300]
        raise RuntimeError("[%s] %s\n-> Key read from: %s"
                           % (label, detail, source))

    data = resp.json()
    ttl = int(data.get("ttl_seconds") or _DEFAULT_TTL)
    ents = data.get("entitlements") or []
    _cache[key] = {"expires": time.time() + ttl,
                   "plan": data.get("plan", "?"),
                   "entitlements": ents}
    if entitlement and not _grants(ents, entitlement):
        raise RuntimeError(_denied(label, entitlement, _cache[key], source))
    print("[%s] Licence %s OK - plan %s" % (label, shown, data.get("plan", "?")))
    return key


def _grants(entitlements, wanted):
    ents = entitlements or []
    return "*" in ents or wanted in ents


def _denied(label, entitlement, hit, source):
    return ("[%s] This licence does not include %r.\n"
            "-> Plan %s grants: %s\n"
            "-> Key read from: %s"
            % (label, entitlement, hit.get("plan", "?"),
               ", ".join(hit.get("entitlements") or []) or "nothing", source))


class AiofcLicense:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "license_key": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "Leave empty if AIOFC_LICENSE_KEY is set",
                    "tooltip": "A key typed here is used by every licensed node "
                               "in this graph, whether or not the output below "
                               "is wired to anything.\n\n"
                               "Checked LAST, after AIOFC_LICENSE_KEY, the "
                               "key files and a node's own license_key widget.",
                }),
                "verify": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Check the key with the license service before "
                               "the graph runs, so a bad key stops here rather "
                               "than part-way through a render. Turn off only "
                               "if the pod has no outbound internet.",
                }),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("license_key",)
    FUNCTION = "load"
    CATEGORY = "AIOFC"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def load(self, license_key="", verify=True):
        key, source = resolve_key(license_key)
        if not key:
            raise RuntimeError(
                "[AIOFC License] No licence key found.\n"
                "-> Set AIOFC_LICENSE_KEY in the pod environment, drop the "
                "key in /workspace/aiofc/license.key, or fill the "
                "license_key widget on this node."
            )

        shown = key[:8] + "..." if len(key) > 8 else key
        if not verify:
            print("[AIOFC License] %s from %s (not verified)" % (shown, source))
            return (key,)

        hit = _cache.get(key)
        if hit and time.time() < hit["expires"]:
            print("[AIOFC License] %s OK - plan %s (cached)" % (shown, hit["plan"]))
            return (key,)

        try:
            resp = requests.post(
                "%s/v1/verify" % API_URL.rstrip("/"),
                json={"license_key": key, "client_version": CLIENT_VERSION},
                timeout=30,
                headers={"X-Pod-Fingerprint": _pod_fingerprint()},
            )
        except requests.exceptions.RequestException as e:
            if hit:
                print("[AIOFC License] Service unreachable (%s) - continuing "
                      "on the last good answer for %s." % (e, shown))
                return (key,)
            raise RuntimeError(
                "[AIOFC License] Could not reach the license service at %s "
                "(%s).\n-> Check the pod has outbound internet, or set "
                "verify=false to skip this check." % (API_URL, e))

        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail") or resp.text[:300]
            except Exception:
                detail = resp.text[:300]
            raise RuntimeError("[AIOFC License] %s\n-> Key read from: %s"
                               % (detail, source))

        data = resp.json()
        ttl = int(data.get("ttl_seconds") or _DEFAULT_TTL)
        ent = data.get("entitlements") or []
        _cache[key] = {"expires": time.time() + ttl,
                       "plan": data.get("plan", "?"),
                       "entitlements": ent}
        print("[AIOFC License] %s OK - plan %s, grants %s (from %s)"
              % (shown, data.get("plan", "?"),
                 "everything" if "*" in ent else ", ".join(ent) or "nothing",
                 source))
        if data.get("note"):
            print("[AIOFC License] %s" % data["note"])
        return (key,)


NODE_CLASS_MAPPINGS = {
    "AiofcLicense": AiofcLicense,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AiofcLicense": "AIOFC License",
}
