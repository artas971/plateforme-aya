import os
import sys
import json
import base64
import subprocess
import urllib.request

if sys.stdout and sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

LAST_MODEL_USED = "gemini-2.5-flash"

def gemini_audio_transcribe_and_translate(media_path, mode='VOSTFR', total_duration=None, source_lang='auto', force_reprocess=False):
    global LAST_MODEL_USED
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        print("[Pole 3 Gemini] Pas de cle GEMINI_API_KEY detectee.")
        return None

    print(f"[Pole 3 Gemini] Lancement transcription/traduction ({mode}, source: {source_lang}, force_reprocess: {force_reprocess}) via Gemini 2.5 Flash...")

    # Extraction / conversion audio optimisée (MP3 64k mono pour upload rapide)
    temp_audio = os.path.join(os.path.dirname(media_path), f"temp_gemini_{os.getpid()}.mp3")
    try:
        subprocess.run([
            'ffmpeg', '-y', '-i', media_path,
            '-vn', '-ar', '24000', '-ac', '1', '-b:a', '64k',
            temp_audio
        ], capture_output=True, check=True)
        read_path = temp_audio
        mime_type = "audio/mp3"
    except Exception:
        read_path = media_path
        mime_type = "audio/ogg" if media_path.endswith(".ogg") else "audio/wav"

    try:
        with open(read_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")
    finally:
        if os.path.exists(temp_audio):
            try: os.remove(temp_audio)
            except Exception: pass

    # Contexte linguistique explicite selon la langue source
    source_context = ""
    lexicon_directive = ""
    if source_lang in ('ar', 'auto'):
        if source_lang == 'ar':
            source_context = "CONTEXTE LANGUE SOURCE : L'audio source est intégralement en arabe palestinien (dialecte ammiya de Gaza).\n"
        lexicon_directive = (
            "8. RÈGLES DE TRADUCTION ABSOLUES (DIALECTE DE GAZA) :\n"
            "Attention aux pièges phonétiques du dialecte palestinien. Utilise impérativement ce glossaire pour ta traduction :\n"
            "- Noms propres : 'أم علاء' se traduit 'Oum Alaa' (Jamais Malaak).\n"
            "- 'جرافة' (Jarrafa) = Bulldozer (Jamais Jet ou Avion).\n"
            "- 'راية بيضاء' (Raya beida / chrita beida) = Drapeau blanc / Tissu blanc (Jamais Matelas).\n"
            "- 'كابونة / كابونات' (Kopon) = Coupon d'aide alimentaire (Jamais Charbon).\n"
            "- 'جباليا' (Jabalia) = Jabalia (C'est une ville/camp, ne traduit pas par 'Montagne').\n"
            "- 'جباليا البلد' = Jabalia Al-Balad (Ne traduis JAMAIS par 'le pays').\n"
            "- 'نزوح' (Nuzuh) = Déplacement forcé / Fuir (Jamais Ressusciter).\n"
            "- 'نزحتی / نزحت' = Déplacée (Interdiction d'utiliser 'glissé' ou 'ressuscité').\n"
            "- 'شهيد' (Shaheed) = Martyr.\n"
            "- 'قصف' (Qasf) = Bombardement, frappe.\n"
            "- 'مأوى / مركز إيواء' = Centre d'hébergement / École.\n"
            "Contexte : L'audio parle de survie sous les bombardements. Refuse toute traduction absurde (matelas, charbon, jet) et privilégie un vocabulaire de guerre dramatique et réaliste.\n\n"
        )
    elif source_lang == 'fr':
        source_context = "CONTEXTE LANGUE SOURCE : L'audio source est intégralement en français.\n"

    if mode == 'VOSTFR':
        prompt = (
            "Tu es un traducteur et sous-titreur expert d'élite (spécialisé dans l'arabe palestinien de Gaza et le français).\n"
            f"{source_context}"
            "Écoute attentivement l'intégralité du fichier audio ci-joint.\n"
            "Ta mission : Restituer fidèlement 100% du discours en français authentique, percutant et soigné pour des sous-titres vidéo TikTok/Reels. "
            "(Si le discours est en arabe palestinien, traduis-le fidèlement en français. Si le discours est déjà en français, retranscris-le fidèlement mot à mot en français).\n\n"
            "RÈGLES D'OR STRICTES :\n"
            "1. DURÉE MAXIMALE STRICTE (RÈGLE CRITIQUE ABSOLUE) : CHAQUE SEGMENT DOIT DURER ENTRE 1.5 ET 4.0 SECONDES (MAXIMUM STRICT 5.0 SECONDES). "
            "Il est FORMELLEMENT INTERDIT de générer un segment de plus de 5 secondes. Si une phrase est longue, TU DOIS OBLIGATOIREMENT LA SCINDER TOI-MÊME en plusieurs sous-segments courts synchronisés avec les mots prononcés.\n"
            "2. TIMESTAMPS RELATIFS : Les temps 'start' et 'end' doivent être exprimés en secondes (nombres flottants) relatifs au DÉBUT de cet extrait audio (0.0s = début du fichier fourni). 'end' doit toujours être supérieur à 'start'.\n"
            "3. LANGUE CIBLE STRICTE : Tu dois IMPÉRATIVEMENT tout traduire dans la langue cible (ex: Français). Il est FORMELLEMENT INTERDIT d'utiliser l'alphabet arabe dans ta réponse finale. Tout doit être traduit.\n"
            "4. NUMÉROS DE TÉLÉPHONE : Si une personne dicte un numéro avec des pauses, regroupe intelligemment les chiffres dans un même segment logique pour préserver la lisibilité à l'écran.\n"
            "5. PRÉNOMS & VOCATIFS : Conserve 'Mon frère Steve', 'Steve', 'Soso', etc.\n"
            "6. LIEUX & TERMES : Conserve 'Le Port (Al-Mina)', 'La Ligne Jaune', 'canonnières de la marine', 'martyrs', 'cafétéria'.\n"
            "7. FIDÉLITÉ TEMPORELLE ABSOLUE : Reste fidèle à TOUT le discours sans jamais résumer, paraphraser, tronquer ou omettre de phrases.\n"
            f"{lexicon_directive}"
            "FORMAT DE SORTIE : Réponds UNIQUEMENT par un tableau JSON valide d'objets avec les clés 'start' (secondes, float), 'end' (secondes, float), et 'text' (français).\n"
            "Exemple : [{\"start\": 0.0, \"end\": 3.2, \"text\": \"Mon frère Steve, honnêtement...\"}, {\"start\": 3.2, \"end\": 5.0, \"text\": \"la situation est très difficile.\"}]"
        )
    else: # VOAR (Français ou autre vers Arabe Palestinien de Gaza)
        prompt = (
            "Tu es un traducteur et transcripteur expert d'élite, linguiste assermenté du dialecte arabe palestinien de Gaza (Ammiya de Gaza - العامية الغزاوية) et du français.\n"
            f"{source_context}"
            "Écoute attentivement l'enregistrement audio ci-joint.\n"
            "Ta mission : Restituer fidèlement 100% du discours en ARABE PALESTINIEN AUTHENTIQUE DE GAZA pour des sous-titres vidéo et transcriptions (VOAR).\n"
            "(Si le discours est en français ou autre langue, traduis-le fidèlement en arabe dialectal de Gaza. Si le discours est déjà en arabe palestinien, retranscris-le fidèlement mot à mot).\n\n"
            "DIRECTIVES LINGUISTIQUES MAJEURES (AGENT THOMAS & NADINE) :\n\n"
            "1. RÈGLE STRICTE DU DIALECTE (AMMIYA DE GAZA) :\n"
            "Si la traduction est du Français vers l'Arabe (VOAR), TU DOIS OBLIGATOIREMENT utiliser l'Arabe Palestinien dialectal (Ammiya de Gaza). "
            "N'utilise JAMAIS l'arabe classique (Fusha). Utilise le vocabulaire quotidien (ex: 'صحون' au lieu de 'أطباق', 'اللي' au lieu de 'أولئك الذين', "
            "'هلقيت / هسا' au lieu de 'الآن', 'بدي / بدنا' au lieu de 'أريد / نريد', 'عشان' au lieu de 'من أجل / لكي', 'مش' au lieu de 'ليس', 'شو' au lieu de 'ماذا', 'حكي' au lieu de 'كلام', 'كتير' au lieu de 'كثيراً').\n\n"
            "2. RÈGLE DES NUANCES & ANALYSE SÉMANTIQUE PROFONDE :\n"
            "Fais une analyse sémantique profonde des expressions idiomatiques et des doubles négations françaises (ex: 'ne... que') avant de traduire, pour préserver le sens originel exact.\n"
            "ATTENTION MAJEURE AUX TOURNURES RESTRICTIVES :\n"
            "Par exemple, la phrase 'Il n'y a pas de violence qu'avec des armes' signifie qu'il existe d'autres formes de violence en dehors des armes (la violence n'est pas uniquement armée). "
            "Traduis rigoureusement par le sens authentique en ammiya : 'العنف مش بس بالسلاح' ou 'في عنف مش بس بالسلاح'. "
            "Il est STRICTEMENT INTERDIT de faire un contre-sens en affirmant l'inverse (ex: 'العنف بس بالسلاح' est proscrit).\n\n"
            "3. VOCATIFS & TERMES FRATERNELS DE SOUTIEN :\n"
            "- 'Mon frère Steve' ➔ 'أخوي ستيف'\n"
            "- 'Ma sœur Soso' ➔ 'أختي سوسو'\n"
            "- 'Prends soin de toi' ➔ 'ديري بالك على حالك' (féminin) / 'دير بالك على حالك' (masculin)\n"
            "- 'On est avec vous / On est ensemble' ➔ 'إحنا معكم / إحنا معكم على طول'\n\n"
            "4. DURÉE MAXIMALE STRICTE (RÈGLE CRITIQUE ABSOLUE) : AUCUN SEGMENT NE DOIT DÉPASSER 5.0 SECONDES (idéalement 1.5 à 4.0 secondes). "
            "TU DOIS OBLIGATOIREMENT SCINDER toute phrase longue en plusieurs sous-segments courts synchronisés.\n"
            "5. TIMESTAMPS RELATIFS : Les temps 'start' et 'end' doivent être exprimés en secondes (nombres flottants) relatifs au DÉBUT de cet extrait audio (0.0s = début du fichier fourni), avec 'end' > 'start'.\n"
            "6. FIDÉLITÉ TEMPORELLE ABSOLUE : Reste fidèle à TOUT le discours sans jamais résumer, paraphraser, tronquer ou omettre de phrases.\n\n"
            "FORMAT DE SORTIE : Réponds UNIQUEMENT par un tableau JSON valide d'objets avec les clés 'start' (secondes, float), 'end' (secondes, float), et 'text' (arabe palestinien de Gaza).\n"
            "Exemple : [{\"start\": 0.0, \"end\": 2.8, \"text\": \"أخوي ستيف، العنف مش بس بالسلاح...\"}, {\"start\": 2.8, \"end\": 4.5, \"text\": \"في وجع تاني الناس مش شايفتو.\"}]"
        )

    # Gestion du cache local
    import re
    cache_dir = os.path.join(BASE_DIR, "cache_transcriptions")
    os.makedirs(cache_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(media_path))[0]
    raw_stem = re.sub(r"^\d+_", "", base_name)
    raw_stem_spaces = raw_stem.replace("_", " ")
    raw_stem_underscores = raw_stem.replace(" ", "_")
    cache_file = os.path.join(cache_dir, f"{base_name}_{source_lang}_{mode}.json")

    if not force_reprocess:
        candidates = [
            os.path.join(cache_dir, f"{base_name}_{source_lang}_{mode}.json"),
            os.path.join(cache_dir, f"{base_name}_{mode}.json"),
            os.path.join(cache_dir, f"{raw_stem}_{source_lang}_{mode}.json"),
            os.path.join(cache_dir, f"{raw_stem}_{mode}.json"),
            os.path.join(cache_dir, f"{raw_stem_spaces}_{source_lang}_{mode}.json"),
            os.path.join(cache_dir, f"{raw_stem_spaces}_{mode}.json"),
            os.path.join(cache_dir, f"{raw_stem_underscores}_{source_lang}_{mode}.json"),
            os.path.join(cache_dir, f"{raw_stem_underscores}_{mode}.json"),
        ]

        for cfile in candidates:
            if os.path.exists(cfile):
                try:
                    with open(cfile, "r", encoding="utf-8") as cf:
                        cached_segments = json.load(cf)
                        if isinstance(cached_segments, list) and len(cached_segments) > 0:
                            print(f"[Pôle 3 Gemini] ⚡ Cache réutilisé instantanément ({len(cached_segments)} segments déjà transcrits).")
                            LAST_MODEL_USED = "gemini-2.5-flash (Cache)"
                            return cached_segments
                except Exception:
                    pass

        # Recherche approfondie par correspondance de nom dans le dossier de cache
        if os.path.exists(cache_dir):
            for fname in os.listdir(cache_dir):
                if not fname.endswith('.json'):
                    continue
                if mode in fname:
                    f_clean = re.sub(r"^\d+_", "", fname)
                    if raw_stem in f_clean or f_clean.startswith(raw_stem) or raw_stem_underscores in f_clean:
                        try:
                            with open(os.path.join(cache_dir, fname), "r", encoding="utf-8") as cf:
                                cached_segments = json.load(cf)
                                if isinstance(cached_segments, list) and len(cached_segments) > 0:
                                    print(f"[Pôle 3 Gemini] ⚡ Cache global réutilisé ({fname} -> {len(cached_segments)} segments).")
                                    LAST_MODEL_USED = "gemini-2.5-flash (Cache)"
                                    return cached_segments
                        except Exception:
                            pass
    else:
        print(f"[Pôle 3 Gemini] 🔄 Bypass Cache activé pour '{base_name}'. Purge des anciens caches...")
        if os.path.exists(cache_dir):
            for fname in os.listdir(cache_dir):
                if fname.endswith('.json') and mode in fname:
                    f_clean = re.sub(r"^\d+_", "", fname)
                    if raw_stem in f_clean or f_clean.startswith(raw_stem) or raw_stem_underscores in f_clean:
                        try:
                            os.remove(os.path.join(cache_dir, fname))
                            print(f"[Pôle 3 Gemini] 🗑️ Ancien cache supprimé : {fname}")
                        except Exception:
                            pass

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": audio_b64
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    req_data = json.dumps(payload).encode("utf-8")

    # Cascade de modèles IA Google Gemini avec bascule automatique en cas de quota épuisé (429 / ResourceExhausted)
    PRIMARY_MODEL = os.environ.get("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash")
    FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")

    # Liste ordonnée de cascade avec élimination des doublons
    raw_cascade = [
        PRIMARY_MODEL,
        FALLBACK_MODEL,
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-3.5-flash-lite",
        "gemini-3-flash-preview",
        "gemini-2.5-pro"
    ]
    MODELS_CASCADE = []
    for m in raw_cascade:
        if m and m not in MODELS_CASCADE:
            MODELS_CASCADE.append(m)

    for idx, model_name in enumerate(MODELS_CASCADE):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        try:
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=35) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                out_raw = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
                segments = json.loads(out_raw)
                if isinstance(segments, list) and len(segments) > 0:
                    print(f"[Pôle 3 Gemini] ✅ Succès avec modèle {model_name} : {len(segments)} segments reçus !")
                    LAST_MODEL_USED = model_name
                    # Sauvegarde dans le cache
                    try:
                        with open(cache_file, "w", encoding="utf-8") as cf:
                            json.dump(segments, cf, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    return segments
        except urllib.error.HTTPError as he:
            is_quota = (he.code == 429) or any(q in str(he).lower() for q in ["quota", "resource_exhausted", "resourceexhausted"])
            if is_quota:
                print("⚠️ Quota Gemini 2.5 atteint, bascule sur le modèle de secours...", flush=True)
                next_model = MODELS_CASCADE[idx + 1] if idx + 1 < len(MODELS_CASCADE) else "modèle suivant"
                print(f"[PROGRESS] ⚠️ Quota Gemini 2.5 atteint, bascule sur le modèle de secours ({next_model})...", flush=True)
            else:
                print(f"[Pôle 3 Gemini] Erreur HTTP {he.code} sur {model_name} : {he}. Bascule vers le modèle suivant...", flush=True)
            continue
        except Exception as e:
            err_str = str(e).lower()
            is_quota = any(q in err_str for q in ["429", "quota", "resource_exhausted", "resourceexhausted"])
            if is_quota:
                print("⚠️ Quota Gemini 2.5 atteint, bascule sur le modèle de secours...", flush=True)
                next_model = MODELS_CASCADE[idx + 1] if idx + 1 < len(MODELS_CASCADE) else "modèle suivant"
                print(f"[PROGRESS] ⚠️ Quota Gemini 2.5 atteint, bascule sur le modèle de secours ({next_model})...", flush=True)
            else:
                print(f"[Pôle 3 Gemini] Modèle {model_name} indisponible ({e}). Bascule vers le modèle suivant...", flush=True)
            continue

    # Si même le modèle de secours et toute la cascade échouent (panne globale de l'API)
    print("❌ [PANNE CRITIQUE] Échec de l'ensemble des modèles IA de la cascade.", flush=True)
    raise RuntimeError("Les serveurs IA sont temporairement surchargés. Veuillez réessayer dans quelques minutes.")

if __name__ == "__main__":
    media = r"c:\Users\artas\Desktop\aya\audio_a_traiter\soso18.ogg"
    res = gemini_audio_transcribe_and_translate(media, 'VOSTFR')
    if res:
        print("Total segments:", len(res))
        for r in res[:5]:
            print(f"[{r['start']}s -> {r['end']}s] {r['text']}")
