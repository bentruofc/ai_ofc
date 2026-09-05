# -*- coding: utf-8 -*-
"""
ComfyUI node - Aiorbust Grok Prompt Generator.
Calls the xAI Grok API directly (api.x.ai) - no OpenRouter middleman.
Get your API key at: https://console.x.ai
Same image+text message format as GeminiPromptNode._call_grok() in gemini_prompt.py,
kept consistent so both nodes talk to the API the same way.
"""

import base64
import io
import logging

import numpy as np
import requests
from PIL import Image


# Vision-capable models (support image input) first, text-only models after.
# Same list as _GROK_MODELS in gemini_prompt.py for consistency across the pack.
_GROK_MODELS = [
    "grok-4.20-0309-reasoning",
    "grok-4.20-0309-non-reasoning",
    "grok-4-1-fast-reasoning",
    "grok-4-1-fast-non-reasoning",
    "grok-2-vision-1212",
    "grok-3",
    "grok-3-fast",
    "grok-3-mini",
    "grok-3-mini-fast",
]

_XAI_URL = "https://api.x.ai/v1/chat/completions"

# Taille exacte du tenseur que l'Aiorbust Image Batch Loader renvoie quand sa
# liste est vide : torch.zeros((1, 64, 64, 3)). Ce n'est pas une image, c'est un
# bouchon — mais rien dans le type IMAGE de ComfyUI ne permet de le distinguer
# d'une vraie image en aval.
_PLACEHOLDER_SIDE = 64


def _is_placeholder_frame(frame) -> bool:
    """True si la frame est le carre noir 64x64 d'un Batch Loader vide.

    Envoyer ce bouchon a un modele vision coute des tokens image pour faire
    analyser du vide, et brouille la reponse : le modele decrit consciencieusement
    un rectangle noir. Le test porte sur la taille ET le contenu — une vraie image
    64x64 entierement noire serait aussi refusee, mais elle n'a de toute facon
    aucune valeur comme reference visuelle.
    """
    try:
        h, w = int(frame.shape[0]), int(frame.shape[1])
        if h != _PLACEHOLDER_SIDE or w != _PLACEHOLDER_SIDE:
            return False
        # Tolerance sous 1/255 : le tenseur est en float, une valeur strictement
        # nulle n'est pas garantie apres un passage par un autre node.
        return float(frame.max()) < (1.0 / 255.0)
    except Exception:
        return False


class GrokPromptNode:

    _cached_api_key = ""

    # Nombre d'appels API depuis le demarrage de ComfyUI.
    #
    # Ajoute pour une raison precise : cette fonction ne fait qu'UN POST par
    # execution, donc si la facture xAI montre N requetes pour ce qui semble
    # etre un seul run, c'est que ComfyUI a appele generate() N fois. Le
    # compteur rend ca visible dans la console au lieu de le laisser deviner
    # depuis les logs de facturation, des heures plus tard.
    #
    # Volontairement PAS de IS_CHANGED ici, contrairement a GeminiPromptNode qui
    # renvoie float("nan") : NaN != NaN, donc ce node-la se re-execute a CHAQUE
    # queue meme a entrees identiques. Sur une API facturee au token, c'est un
    # gouffre. Sans IS_CHANGED, ComfyUI hache les entrees et reutilise le cache
    # tant que rien ne change — ce qui est le comportement voulu ici.
    _api_call_count = 0

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "tooltip": "The prompt/instruction to send to the model.",
                }),
                "model": (_GROK_MODELS, {
                    "default": "grok-4.20-0309-reasoning",
                    "tooltip": "xAI Grok model. Vision-capable models are listed first - use one of those if you connect an image.",
                }),
            },
            "optional": {
                "image": ("IMAGE", {
                    "tooltip": "Optional image (e.g. from the Aiorbust Image Batch Loader for batch runs). Sent alongside the prompt to vision-capable models.",
                }),
                "api_key": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "tooltip": "xAI API key (console.x.ai). Cached after first use.",
                }),
                "temperature": ("FLOAT", {
                    "default": 0.7,
                    "min": 0.0,
                    "max": 2.0,
                    "step": 0.05,
                    "tooltip": "Creativity of the response (0 = deterministic, 2 = very creative).",
                }),
                "max_tokens": ("INT", {
                    "default": 1024,
                    "min": 64,
                    "max": 8192,
                    "step": 64,
                    "tooltip": "Maximum number of tokens in the response.",
                }),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("output_prompt",)
    FUNCTION = "generate"
    OUTPUT_NODE = False
    CATEGORY = "AIOFC/Prompt"
    DESCRIPTION = (
        "Send a text prompt (and optionally an image) to Grok and get a generated prompt back.\n"
        "Plug an Aiofc Image Batch Loader into 'image' + Queue All to run one request per image in the batch."
    )

    def generate(
        self,
        prompt,
        model="grok-4.20-0309-reasoning",
        image=None,
        api_key="",
        temperature=0.7,
        max_tokens=1024,
    ):
        # Cache key across executions
        key = api_key.strip()
        if key:
            GrokPromptNode._cached_api_key = key
        else:
            key = GrokPromptNode._cached_api_key

        if not key:
            raise RuntimeError(
                "[Aiorbust Grok] API key is required. Get yours at https://console.x.ai"
            )

        if not prompt.strip():
            raise RuntimeError("[Aiorbust Grok] Prompt cannot be empty.")

        # Build the user message content — a list of image_url parts (one per
        # image in the batch) followed by the text part, same shape as
        # GeminiPromptNode._call_grok() in gemini_prompt.py.
        user_content = []
        _sent, _skipped = 0, 0
        if image is not None:
            for i in range(image.shape[0]):
                frame = image[i]
                if _is_placeholder_frame(frame):
                    _skipped += 1
                    continue
                img_np = (255.0 * frame.cpu().numpy()).clip(0, 255).astype(np.uint8)
                pil = Image.fromarray(img_np)
                buf = io.BytesIO()
                pil.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                })
                _sent += 1

        if _skipped:
            print(
                f"⚠️  [Aiorbust Grok] {_skipped} image(s) placeholder ignoree(s) "
                f"(64x64 noire — Batch Loader vide). Vision non facturee pour rien."
            )
        if _skipped and _sent == 0:
            print(
                "ℹ️  [Aiorbust Grok] Aucune image reelle → requete texte seule. "
                "Un modele vision n'est pas necessaire ici."
            )

        user_content.append({"type": "text", "text": prompt.strip()})

        messages = [{"role": "user", "content": user_content}]

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
        }
        headers = {
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        }

        GrokPromptNode._api_call_count += 1
        # _sent, pas image.shape[0] : c'est le nombre d'images REELLEMENT dans le
        # payload. Compter le tenseur d'entree afficherait "images=1" alors qu'un
        # placeholder vient d'etre ecarte — exactement le genre de log qui fait
        # chercher une facture vision inexistante.
        print(
            f"🛰️  [Aiorbust Grok] API CALL #{GrokPromptNode._api_call_count} "
            f"(depuis le demarrage de ComfyUI) — model={model} | images envoyees={_sent} | "
            f"temp={temperature:.2f} | max_tokens={max_tokens}"
        )
        logging.info(
            "[Aiorbust Grok] Calling %s (model=%s, images=%d, temp=%.2f, max_tokens=%d)",
            _XAI_URL, model, _sent, temperature, max_tokens,
        )

        try:
            resp = requests.post(_XAI_URL, json=payload, headers=headers, timeout=180)
            # resp.history contient les reponses intermediaires suivies par
            # requests. Non vide = la requete a ete rejouee apres une
            # redirection, et le corps a donc ete envoye plus d'une fois — ce qui
            # se verrait comme plusieurs requetes cote fournisseur pour un seul
            # appel du node. C'est la seule facon depuis ici de distinguer
            # "le node a appele 2 fois" de "un appel a produit 2 requetes HTTP".
            if resp.history:
                _hops = " → ".join(f"{r.status_code} {r.url}" for r in resp.history)
                print(
                    f"⚠️  [Aiorbust Grok] {len(resp.history)} redirection(s) suivie(s) : {_hops}\n"
                    f"   Le corps de la requete a ete renvoye a chaque saut."
                )
            resp.raise_for_status()
            data = resp.json()

            # Ce que le fournisseur dit avoir consomme, a comparer directement
            # avec son dashboard. Un ecart entre ces chiffres et la facture
            # signifie que le surplus vient d'ailleurs que de ce node.
            _u = data.get("usage") or {}
            if _u:
                print(
                    f"📊 [AIOFC Grok] usage rapporte par xAI — "
                    f"prompt={_u.get('prompt_tokens', '?')} | "
                    f"completion={_u.get('completion_tokens', '?')} | "
                    f"total={_u.get('total_tokens', '?')}"
                )
        except requests.exceptions.HTTPError as e:
            msg = "[AIOFC Grok] API error " + str(e.response.status_code)
            try:
                body = e.response.json()
                if "error" in body:
                    msg += " - " + str(body["error"])
            except Exception:
                msg += " - " + e.response.text[:300]
            raise RuntimeError(msg)
        except requests.exceptions.RequestException as e:
            raise RuntimeError("[AIOFC Grok] Request error: " + str(e))

        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("[AIOFC Grok] Empty response - no choices returned.")

        text = choices[0].get("message", {}).get("content", "").strip()
        if not text:
            raise RuntimeError("[AIOFC Grok] Empty content returned by API.")

        logging.info("[AIOFC Grok] Done - %d chars returned.", len(text))
        return (text,)


NODE_CLASS_MAPPINGS = {
    "GrokPromptNode": GrokPromptNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GrokPromptNode": "Aiofc Grok Prompt Generator",
}

