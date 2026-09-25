import re, sys, os

def lint_ass_file(ass_path, expected_style="Impact", expected_margin_v=950, max_lines=2, max_cps=24.0):
    if not os.path.exists(ass_path):
        return {"valid": False, "errors": [f"Fichier ASS introuvable : {ass_path}"], "warnings": []}

    errors = []
    warnings = []
    
    with open(ass_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()

    # 1. Verification du Style Impact et MarginV == 950
    has_target_style = False
    
    for idx, l in enumerate(lines):
        if l.startswith("Style:"):
            parts = [p.strip() for p in l.replace("Style:", "").split(",")]
            if parts and parts[0] == expected_style:
                has_target_style = True
                try:
                    margin_v = int(parts[-2]) # MarginV est avant-dernier champ (avant Encoding)
                    if margin_v != expected_margin_v:
                        errors.append(f"Style '{expected_style}': MarginV = {margin_v} au lieu de {expected_margin_v} strictement attendu.")
                except Exception as e:
                    errors.append(f"Erreur parsing MarginV dans Style '{expected_style}': {e}")

    if not has_target_style:
        errors.append(f"Header ASS non conforme : Le style obligatoire '{expected_style}' est manquant dans [V4+ Styles].")

    # 2. Verification des evenements Dialogue
    def parse_ass_time(t_str):
        parts = t_str.strip().split(":")
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

    dialogues = []
    for idx, l in enumerate(lines):
        if l.startswith("Dialogue:"):
            parts = l.split(",", 9)
            if len(parts) < 10:
                errors.append(f"Ligne {idx+1}: Format Dialogue invalide.")
                continue
            
            st_str = parts[1].strip()
            et_str = parts[2].strip()
            style_used = parts[3].strip()
            text = parts[9].strip()

            # Ne tester que les sous-titres (pas le titre ni le bandeau)
            if style_used == expected_style:
                try:
                    st = parse_ass_time(st_str)
                    et = parse_ass_time(et_str)
                except Exception:
                    errors.append(f"Ligne {idx+1}: Timestamps ASS invalides ({st_str} -> {et_str}).")
                    continue

                # Regle Start < End
                if et <= st:
                    errors.append(f"Ligne {idx+1}: Timestamp inverse ou nul ({st:.2f}s >= {et:.2f}s).")

                dur = et - st

                # Regle Max 2 lignes (\N)
                num_newlines = text.count(r"\N")
                if num_newlines > 1:
                    errors.append(f"Ligne {idx+1}: Depassement de lignes ({num_newlines + 1} lignes detectees, max {max_lines}).")

                # Regle CPS
                clean_txt = re.sub(r"{[^}]+}", "", text).replace(r"\N", " ")
                cps = len(clean_txt) / dur if dur > 0 else 99
                if cps > max_cps:
                    warnings.append(f"Ligne {idx+1}: Debit de lecture rapide ({cps:.1f} car/s pour '{clean_txt[:25]}...').")

                dialogues.append({"idx": idx+1, "st": st, "et": et, "text": text})

    # 3. Verification de non-chevauchement (Zero overlap)
    for i in range(len(dialogues) - 1):
        gap = dialogues[i+1]["st"] - dialogues[i]["et"]
        if gap < -0.05: # Tolerance 50ms pour arrondi frame
            errors.append(f"Chevauchement critique ({gap:.2f}s) entre sous-titres #{i+1} ({dialogues[i]['st']}-{dialogues[i]['et']}s) et #{i+2} ({dialogues[i+1]['st']}-{dialogues[i+1]['et']}s).")

    is_valid = (len(errors) == 0)
    return {
        "valid": is_valid,
        "dialogues_count": len(dialogues),
        "errors": errors,
        "warnings": warnings
    }

if __name__ == "__main__":
    ass_target = sys.argv[1] if len(sys.argv) > 1 else r"c:\Users\artas\Desktop\aya\fichiers_reponse_a_envoyer\subtitles_relance_hd.ass"
    res = lint_ass_file(ass_target)
    print("=== RAPPORT LINTER ASS STRICT ===")
    print(f"Fichier : {os.path.basename(ass_target)}")
    print(f"Statut  : {'VALIDE' if res['valid'] else 'INVALIDE'}")
    print(f"Sous-titres audites : {res['dialogues_count']}")
    if res["errors"]:
        print("\nERREURS BLOQUANTES :")
        for e in res["errors"]:
            print(f"  [X] {e}")
    if res["warnings"]:
        print("\nAVERTISSEMENTS :")
        for w in res["warnings"][:5]:
            print(f"  [!] {w}")
    sys.exit(0 if res["valid"] else 1)
