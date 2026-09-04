"""Aiorbust License -- one key, picked up by every licensed node.

Drop this node once anywhere in the graph and type the key into it. Every
licensed node in the same graph finds it on its own; the output is still there
for anyone who prefers an explicit wire, but nothing has to be connected.

That works because a licensed node is handed the whole queued prompt (ComfyUI's
hidden PROMPT input) and reads this node's widget straight out of it. No
execution order to get wrong, no wire to forget, and it holds even when this
node sits unconnected in a corner of the canvas -- ComfyUI would never execute
it there, but the key is in the prompt all the same.

It also checks the key before anything else runs. Without it a bad key is
discovered by whichever licensed node happens to execute first, which on a
video graph can be twenty minutes in. Here it is a red node at the top, with
the reason on it, before a single provider call has been paid for.

The key itself is resolved the same way every licensed node resolves it, and in
the same order, so adding this node never changes which key is used:

    AIORBUST_LICENSE_KEY in the environment
    a file named by AIORBUST_LICENSE_FILE
    /workspace/aiorbust/license.key
    ComfyUI/user/aiorbust/license.key
    license.key beside this pack
    ~/.aiorbust/license.key
    the node's own license_key widget -- last, deliberately
    this node's license_key widget, read out of the prompt -- last of all

The widget is last because ComfyUI saves widget values into the workflow JSON.
A key typed there travels with every copy of that graph the user shares, and
people share graphs constantly. The environment variable and the files do not
travel, which is why they win.
"""
import os
import time

import requests

import folder_paths

DEFAULT_API_URL = "https://aiorbust-h3-ir.fly.dev"
API_URL = os.environ.get("AIORBUST_API_URL", "").strip() or DEFAULT_API_URL
CLIENT_VERSION = "0.3.0"

# Verification is cached so a graph with eight licensed nodes in it does not
# make eight round trips per queue. The service tells us how long its answer is
# good for; this is only the fallback when it does not say.
_DEFAULT_TTL = 30 * 60
_cache = {}


def _license_file_candidates():
    paths = []
    env_file = os.environ.get("AIORBUST_LICENSE_FILE", "").strip()
    if env_file:
        paths.append(env_file)
    paths.append("/workspace/aiorbust/license.key")
    try:
        paths.append(os.path.join(folder_paths.base_path, "user", "aiorbust", "license.key"))
    except Exception:
        pass
    paths.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "license.key"))
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


# Node ids whose license_key widget counts as the graph-wide key. A tuple
# rather than a bare string so the private pack's own licence node, which
# registers under a different id, can be added without touching the callers.
LICENSE_NODE_CLASS_TYPES = ("AiorbustLicense",)


def key_from_prompt(prompt):
    """The key typed into the Aiorbust License node of the queued graph.

    `prompt` is ComfyUI's hidden PROMPT input: {node_id: {"class_type": ...,
    "inputs": {...}}} for every node in the graph, whether or not it will be
    executed. Reading it here is what lets an unwired licence node still supply
    the key -- an unwired node is never executed, so nothing it could set at
    run time would ever be set.

    Only a literal counts. An input that is wired shows up as [node_id, slot],
    which is a link and not a key.
    """
    if not isinstance(prompt, dict):
        return ""
    # Sorted so two licence nodes in one graph resolve the same way on every
    # queue, rather than following dict order.
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
    """First hit wins. Files are re-read every call, so dropping a key in
    works on the next queue with no ComfyUI restart.

    The licence node's widget is consulted last, after the calling node's own,
    so wiring or typing a key directly into a node still overrides the shared
    one -- useful when a single graph runs two different licences.
    """
    key = os.environ.get("AIORBUST_LICENSE_KEY", "").strip()
    if key:
        return key, "AIORBUST_LICENSE_KEY"
    for path in _license_file_candidates():
        key = _read_key_file(path)
        if key:
            return key, path
    key = (widget_value or "").strip()
    if key:
        return key, "license_key widget"
    key = key_from_prompt(prompt)
    if key:
        return key, "the Aiorbust License node in this graph"
    return "", "license_key widget"


def _pod_fingerprint():
    for var in ("RUNPOD_POD_ID", "VAST_CONTAINERLABEL", "HOSTNAME"):
        v = os.environ.get(var)
        if v:
            return v
    return "unknown"


def check(entitlement="", widget_value="", label="Aiorbust", prompt=None):
    """Gate one node on a valid licence. Returns the key; raises if not licensed.

    One line at the top of a node's execute method:

        from .aiorbust_license import check
        check("nano_banana_aio", license_key, label="NB AIO", prompt=prompt)

    Pass `prompt` through from a hidden PROMPT input and the node picks up
    the key from an Aiorbust License node anywhere in the graph, connected
    or not. Omit it and only the environment, the key files and this node's
    own widget are consulted, which is the old behaviour.

    Deliberately a small gate, not a strong one. The node's code is still here
    and someone determined can delete this call -- what it stops is a workflow
    plus pack changing hands and simply working, which is the thing actually
    being resold. It costs one HTTP round trip on the first run and nothing
    afterwards, because the answer is cached for as long as the service says.

    Failure behaviour matches the licence node's, and for the same reason: an
    outage here must not kill a render someone has already paid for. A key that
    verified recently rides on its cached answer; one that never verified has
    nothing to fall back on and stops.
    """
    key, source = resolve_key(widget_value, prompt)
    if not key:
        raise RuntimeError(
            "[%s] No Aiorbust licence key found.\n"
            "-> Set AIORBUST_LICENSE_KEY in the pod environment, drop the key "
            "in /workspace/aiorbust/license.key, or add an Aiorbust License "
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
            # "" not None: the service types this field as str, so a null is a
            # 422 rather than "just tell me the key is good".
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
            "[%s] Could not reach the Aiorbust service at %s (%s).\n"
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
    """`*` grants everything, which is how the founding keys are written."""
    ents = entitlements or []
    return "*" in ents or wanted in ents


def _denied(label, entitlement, hit, source):
    return ("[%s] This licence does not include %r.\n"
            "-> Plan %s grants: %s\n"
            "-> Key read from: %s"
            % (label, entitlement, hit.get("plan", "?"),
               ", ".join(hit.get("entitlements") or []) or "nothing", source))


class AiorbustLicense:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "license_key": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "Leave empty if AIORBUST_LICENSE_KEY is set",
                    "tooltip": "A key typed here is used by every licensed node "
                               "in this graph, whether or not the output below "
                               "is wired to anything.\n\n"
                               "Checked LAST, after AIORBUST_LICENSE_KEY, the "
                               "key files and a node's own license_key widget. "
                               "Prefer the env var or a key file: a value typed "
                               "here is saved into the workflow JSON and travels "
                               "with any copy of it.",
                }),
                "verify": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Check the key with the Aiorbust service before "
                               "the graph runs, so a bad key stops here rather "
                               "than part-way through a render. Turn off only "
                               "if the pod has no outbound internet.",
                }),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("license_key",)
    FUNCTION = "load"
    CATEGORY = "Aiorbust"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Always re-run: a key revoked between queues must be caught, and the
        # TTL cache below is what stops that costing a round trip every time.
        return float("nan")

    def load(self, license_key="", verify=True):
        key, source = resolve_key(license_key)
        if not key:
            raise RuntimeError(
                "[Aiorbust License] No licence key found.\n"
                "-> Set AIORBUST_LICENSE_KEY in the pod environment, drop the "
                "key in /workspace/aiorbust/license.key, or fill the "
                "license_key widget on this node."
            )

        shown = key[:8] + "..." if len(key) > 8 else key
        if not verify:
            print("[Aiorbust License] %s from %s (not verified)" % (shown, source))
            return (key,)

        hit = _cache.get(key)
        if hit and time.time() < hit["expires"]:
            print("[Aiorbust License] %s OK - plan %s (cached)" % (shown, hit["plan"]))
            return (key,)

        try:
            resp = requests.post(
                "%s/v1/verify" % API_URL.rstrip("/"),
                json={"license_key": key, "client_version": CLIENT_VERSION},
                timeout=30,
                headers={"X-Pod-Fingerprint": _pod_fingerprint()},
            )
        except requests.exceptions.RequestException as e:
            # An outage on our side must not stop a render that is already paid
            # for. A key that verified recently keeps working on its cached
            # answer; one that never verified here has nothing to fall back on.
            if hit:
                print("[Aiorbust License] Service unreachable (%s) - continuing "
                      "on the last good answer for %s." % (e, shown))
                return (key,)
            raise RuntimeError(
                "[Aiorbust License] Could not reach the Aiorbust service at %s "
                "(%s).\n-> Check the pod has outbound internet, or set "
                "verify=false to skip this check." % (API_URL, e))

        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail") or resp.text[:300]
            except Exception:
                detail = resp.text[:300]
            raise RuntimeError("[Aiorbust License] %s\n-> Key read from: %s"
                               % (detail, source))

        data = resp.json()
        ttl = int(data.get("ttl_seconds") or _DEFAULT_TTL)
        ent = data.get("entitlements") or []
        # Entitlements go in the cache too. check() reads the same dict, and a
        # hit written here without them would look like a licence that grants
        # nothing -- so this node running first would deny every gated node.
        _cache[key] = {"expires": time.time() + ttl,
                       "plan": data.get("plan", "?"),
                       "entitlements": ent}
        print("[Aiorbust License] %s OK - plan %s, grants %s (from %s)"
              % (shown, data.get("plan", "?"),
                 "everything" if "*" in ent else ", ".join(ent) or "nothing",
                 source))
        if data.get("note"):
            print("[Aiorbust License] %s" % data["note"])
        return (key,)


NODE_CLASS_MAPPINGS = {"AiorbustLicense": AiorbustLicense}
NODE_DISPLAY_NAME_MAPPINGS = {"AiorbustLicense": "Aiorbust License"}
