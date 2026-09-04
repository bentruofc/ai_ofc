"""
Aiorbust — Generate captions only (standalone, interactive)
============================================================
Use case : tu as deja un dataset d'images generees (par exemple celia_01.png ...
celia_45.png) mais tu n'as pas les .txt de captions correspondants (parce que
le node Dataset Creator ne supportait pas encore les captions, ou que tu as
genere avant la mise a jour).

Ce script scanne le dossier que tu lui donnes, repere les images qui suivent
le pattern {trigger_word}_{NN}.{png,jpg,jpeg}, et cree pour chacune un fichier
.txt avec la caption correspondante depuis Resources/CAPTIONS.txt, en
remplacant le placeholder TRIGGER par le trigger_word.

Usage : double-clic ou
    python generate_captions_only.py
Le script demande interactivement le dossier, le trigger word et l'option
overwrite.

Ne touche PAS aux images existantes. Cree uniquement les .txt manquants.
"""

import os
import sys
import re


# ─────────────────────────────────────────────────────────────────────────────
def find_captions_file() -> str:
    """Trouve Resources/CAPTIONS.txt a cote de ce script."""
    here = os.path.dirname(os.path.abspath(__file__))
    for fname in ("CAPTIONS - NORMAL.txt", "captions - normal.txt", "CAPTIONS.txt", "captions.txt"):
        path = os.path.join(here, fname)
        if os.path.isfile(path):
            return path
    raise FileNotFoundError(
        f"CAPTIONS - NORMAL.txt introuvable dans {here}"
    )


def parse_captions(path: str) -> dict:
    """Parse CAPTIONS.txt en dict {image_number: caption_text}."""
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()

    blocks = re.split(r"^\s*Image\s+(\d+)\s*$", text, flags=re.MULTILINE)
    data = {}
    for i in range(1, len(blocks) - 1, 2):
        try:
            num = int(blocks[i])
        except (ValueError, TypeError):
            continue
        cap = blocks[i + 1].strip()
        if cap:
            data[num] = cap
    return data


def ask(prompt: str, default: str = "") -> str:
    """Petit wrapper input() avec valeur par defaut (Enter pour la garder)."""
    if default:
        full = f"{prompt} [{default}] : "
    else:
        full = f"{prompt} : "
    val = input(full).strip()
    if not val and default:
        return default
    # Vire les guillemets si l'utilisateur a copie-colle un chemin avec ""
    if len(val) >= 2 and val[0] in ('"', "'") and val[-1] == val[0]:
        val = val[1:-1]
    return val


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    """Pose une question oui/non. Default = False."""
    suffix = "[o/N]" if not default else "[O/n]"
    val = input(f"{prompt} {suffix} : ").strip().lower()
    if not val:
        return default
    return val in ("o", "oui", "y", "yes")


# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print(" Aiorbust — Generation des captions uniquement (mode interactif)")
    print("=" * 70)
    print()

    # ── Demande dossier ──
    while True:
        folder = ask("Chemin du dossier dataset (contenant tes images)")
        if not folder:
            print("   ⚠️  Le chemin ne peut pas etre vide.")
            continue
        folder = os.path.abspath(folder)
        if not os.path.isdir(folder):
            print(f"   ❌ Dossier introuvable : {folder}")
            print("   Reessaie ou Ctrl+C pour annuler.\n")
            continue
        break

    # ── Demande trigger word ──
    while True:
        trigger = ask("Trigger word (ex: celia)")
        if not trigger:
            print("   ⚠️  Le trigger word ne peut pas etre vide.")
            continue
        # Verif simple : pas de caracteres bizarres dans un nom de fichier
        if re.search(r'[\\/:*?"<>|]', trigger):
            print(f"   ⚠️  Caracteres interdits dans le trigger word : \\ / : * ? \" < > |")
            continue
        break

    # ── Demande overwrite ──
    overwrite = ask_yes_no(
        "Ecraser les .txt deja existants si presents ?",
        default=False,
    )

    print()
    print(f"📁 Dossier   : {folder}")
    print(f"🏷️  Trigger   : {trigger}")
    print(f"🔁 Overwrite : {'OUI' if overwrite else 'non'}")
    print()

    # ── Parse CAPTIONS.txt ──
    try:
        captions_path = find_captions_file()
    except FileNotFoundError as e:
        print(f"❌ {e}")
        input("\nAppuie sur Entree pour fermer...")
        sys.exit(1)

    captions = parse_captions(captions_path)
    print(f"📚 {len(captions)} caption(s) parsees depuis {captions_path}")

    if not captions:
        print("❌ Aucune caption parsee — verifier le format de CAPTIONS.txt")
        input("\nAppuie sur Entree pour fermer...")
        sys.exit(1)

    # ── Scan le dossier ──
    img_pattern = re.compile(
        rf"^{re.escape(trigger)}_(\d+)\.(png|jpg|jpeg|PNG|JPG|JPEG)$"
    )

    created  = 0
    skipped  = 0
    no_match = 0
    missing  = 0
    files = sorted(os.listdir(folder))

    print(f"\n🔍 Scan de {folder}...")
    for fname in files:
        m = img_pattern.match(fname)
        if not m:
            continue
        num_str = m.group(1)
        try:
            num_int = int(num_str)
        except ValueError:
            no_match += 1
            continue

        cap = captions.get(num_int)
        if not cap:
            print(f"   ⚠️  {fname} → pas de caption pour image {num_int}")
            missing += 1
            continue

        txt_path = os.path.join(folder, f"{trigger}_{num_str}.txt")
        if os.path.exists(txt_path) and not overwrite:
            skipped += 1
            continue

        cap_filled = cap.replace("TRIGGER", trigger)
        try:
            with open(txt_path, "w", encoding="utf-8") as fh:
                fh.write(cap_filled)
            print(f"   ✅ {os.path.basename(txt_path)}")
            created += 1
        except Exception as e:
            print(f"   ❌ {fname} → write failed: {e}")

    # ── Resume ──
    print()
    print(f"📊 Recap :")
    print(f"   ✅ {created} caption(s) creee(s)")
    print(f"   ⏭️  {skipped} caption(s) deja presente(s) (overwrite=non)")
    print(f"   ⚠️  {missing} image(s) sans caption correspondante dans CAPTIONS.txt")
    print(f"   🚫 {no_match} fichier(s) ignore(s) (pas du pattern attendu)")
    print()
    input("Appuie sur Entree pour fermer...")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Annule par l'utilisateur.")
        sys.exit(0)
