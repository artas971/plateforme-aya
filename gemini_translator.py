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

import time

LAST_MODEL_USED = "gemini-2.5-flash"
LAST_TELEMETRY = {
    "t_exec_s": 0.0,
    "model_used": "gemini-2.5-flash",
    "retries": 0,
    "warnings": []
}

def _parse_timestamp_val(val, default=0.0):
    if isinstance(val, (int, float)):
        return float(val)
    if not isinstance(val, str):
        return default
    s = val.strip().replace(',', '.')
    if ':' in s:
        parts = s.split(':')
        try:
            if len(parts) == 2:
                return float(parts[0]) * 60.0 + float(parts[1])
            elif len(parts) == 3:
                return float(parts[0]) * 3600.0 + float(parts[1]) * 60.0 + float(parts[2])
        except Exception:
            pass
    try:
        return float(s)
    except Exception:
        return default


def normalize_and_rescale_segments(raw_segments: list, window_dur: float = None) -> list:
    """
    Détecte et corrige automatiquement les anomalies d'échelle temporelle produites par les LLM :
    1. Parsing robuste des timestamps (chaînes 'MM:SS.xx', floats, etc.).
    2. Détection de l'erreur d'échelle '0.SS' (ex: 0.024 au lieu de 2.4s, 0.315 au lieu de 31.5s).
       Lorsque window_dur >= 8.0s et que tous les segments sont anormalement écrasés (< 2.5s),
       l'échelle est automatiquement recalibrée vers les secondes réelles.
    3. Clamping anti-débordement strict [0.0, window_dur].
    """
    if not raw_segments:
        return []

    parsed = []
    for s in raw_segments:
        txt = (s.get("text") or "").strip()
        if not txt:
            continue
        st = _parse_timestamp_val(s.get("start", 0.0))
        et = _parse_timestamp_val(s.get("end", st + 2.0))
        if et <= st:
            et = st + 1.5
        parsed.append({"start": st, "end": et, "text": txt})

    if not parsed:
        return []

    if window_dur is None or window_dur <= 0:
        return parsed

    max_end = max(s["end"] for s in parsed)
    min_start = min(s["start"] for s in parsed)
    span = max_end - min_start

    # Anomalie détectée : La fenêtre audio dure au moins 8s, il y a au moins 2 répliques,
    # mais tous les timestamps sont comprimés dans moins de 2.5s ou moins de window_dur * 0.25
    if window_dur >= 8.0 and len(parsed) >= 2 and max_end <= max(2.5, window_dur * 0.25):
        scale_100 = max_end * 100.0
        scale_60 = max_end * 60.0

        chosen_factor = None
        if 0.4 * window_dur <= scale_100 <= window_dur * 1.3:
            chosen_factor = 100.0
        elif 0.4 * window_dur <= scale_60 <= window_dur * 1.3:
            chosen_factor = 60.0
        elif max_end <= 1.05 and span > 0:
            chosen_factor = (window_dur * 0.95) / max_end

        if chosen_factor:
            print(f"[RECALIBRAGE ÉCHELLE IA] ⚠️ Correction d'échelle détectée (facteur x{chosen_factor:.1f}) : max_end {max_end:.3f}s ➔ {max_end * chosen_factor:.2f}s pour fenêtre de {window_dur:.1f}s.", flush=True)
            for s in parsed:
                s["start"] = round(s["start"] * chosen_factor, 2)
                s["end"] = round(s["end"] * chosen_factor, 2)

    return parsed


def gemini_audio_transcribe_and_translate(media_path, mode='VOSTFR', total_duration=None, source_lang='auto', force_reprocess=False, user_context=''):
    global LAST_MODEL_USED, LAST_TELEMETRY
    t_jade_start = time.time()
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
            "- 'المنادي' (Al-Munadi) = Ne traduis JAMAIS littéralement par 'Le crieur'. Traduis par 'La voix s'est élevée' ou 'Le chant résonne'.\n"
            "Contexte : L'audio parle de survie sous les bombardements. Refuse toute traduction absurde (matelas, charbon, jet) et privilégie un vocabulaire de guerre dramatique et réaliste.\n\n"
        )
    elif source_lang == 'fr':
        source_context = "CONTEXTE LANGUE SOURCE : L'audio source est intégralement en français.\n"

    # Directive Contexte Utilisateur (Context Grounding pour l'Agent Jade)
    user_context_directive = ""
    if user_context and user_context.strip():
        user_context_directive = (
            "DIRECTIVE CONTEXTE UTILISATEUR (CONTEXT GROUNDING) :\n"
            f"Un contexte éditorial est fourni UNIQUEMENT pour t'aider à orthographier fidèlement les noms propres, les lieux et le vocabulaire spécifique : [CONTEXTE UTILISATEUR : {user_context.strip()}].\n"
            "ATTENTION STRICTE ET FORMELLE : TU NE DOIS EN AUCUN CAS INVENTER, TRADUIRE OU RÉPÉTER CE TEXTE DE CONTEXTE S'IL N'EST PAS RÉELLEMENT PRONONCÉ PAR LES VOIX DANS L'AUDIO !\n"
            "Si l'extrait audio est silencieux, ne contient que de la musique ou du bruit de fond sans parole humaine, TU DOIS OBLIGATOIREMENT RÉPONDRE PAR UN TABLEAU JSON VIDE : [].\n\n"
        )

    if mode == 'VOSTFR':
        prompt = (
            "Tu es un traducteur et sous-titreur expert d'élite (spécialisé dans l'arabe palestinien de Gaza et le français).\n"
            f"{source_context}"
            f"{user_context_directive}"
            "Écoute attentivement l'intégralité du fichier audio ci-joint.\n"
            "Ta mission : Restituer fidèlement 100% du discours en français authentique, percutant et soigné pour des sous-titres vidéo TikTok/Reels. "
            "(Si le discours est en arabe palestinien, traduis-le fidèlement en français. Si le discours est déjà en français, retranscris-le fidèlement mot à mot en français).\n\n"
            "RÈGLES D'OR STRICTES :\n"
            "1. DURÉE MAXIMALE STRICTE (RÈGLE CRITIQUE ABSOLUE) : CHAQUE SEGMENT DOIT DURER ENTRE 1.5 ET 4.0 SECONDES (MAXIMUM STRICT 5.0 SECONDES). "
            "Il est FORMELLEMENT INTERDIT de générer un segment de plus de 5 secondes. Si une phrase est longue, TU DOIS OBLIGATOIREMENT LA SCINDER TOI-MÊME en plusieurs sous-segments courts synchronisés avec les mots prononcés.\n"
            "2. TIMESTAMPS EN SECONDES RÉELLES (RÈGLE D'ÉCHELLE ABSOLUE) : Les temps 'start' et 'end' doivent être exprimés en SECONDES RÉELLES ENTIÈRES OU DÉCIMALES relatives au début de cet extrait audio (ex: 3.2, 14.8, 28.5). "
            "IL EST STRICTEMENT INTERDIT d'écrire des fractions de minutes ou des valeurs divisées comme 0.05, 0.15, 0.25 ou 0.30 pour désigner 5s, 15s, 25s ou 30s ! "
            "(5 secondes s'écrit 5.0 et JAMAIS 0.05 ; 15 secondes s'écrit 15.0 et JAMAIS 0.15 ; 28 secondes s'écrit 28.0 et JAMAIS 0.28). 'end' doit toujours être supérieur à 'start'.\n"
            "3. LANGUE CIBLE STRICTE : Tu dois IMPÉRATIVEMENT tout traduire dans la langue cible (ex: Français). Il est FORMELLEMENT INTERDIT d'utiliser l'alphabet arabe dans ta réponse finale. Tout doit être traduit.\n"
            "4. RÈGLE DE FLUIDITÉ ET DÉDUPLICATION (DIRECTIVE MAJEURE JADE) : Si l'audio original contient des bégaiements, des tics de langage, ou des répétitions inutiles (ex: 'Quatre étages, quatre étages, quatre étages'), LISSE la traduction en français. Ne traduis l'idée qu'une seule fois ou adapte-la pour que cela sonne naturel et tragique (ex: 'Quatre étages se sont effondrés'). Ton but est la clarté et la dignité du sous-titre.\n"
            "5. NUMÉROS DE TÉLÉPHONE : Si une personne dicte un numéro avec des pauses, regroupe intelligemment les chiffres dans un même segment logique pour préserver la lisibilité à l'écran.\n"
            "6. PRÉNOMS & VOCATIFS : Conserve 'Mon frère Steve', 'Steve', 'Soso', etc.\n"
            "7. LIEUX & TERMES : Conserve 'Le Port (Al-Mina)', 'La Ligne Jaune', 'canonnières de la marine', 'martyrs', 'cafétéria'.\n"
            "8. FIDÉLITÉ TEMPORELLE ABSOLUE : Reste fidèle à TOUT le discours sans jamais résumer, paraphraser, tronquer ou omettre de phrases.\n"
            "9. ANALYSE DE CONTEXTE (DIRECTIVE NADINE & THOMAS) : Analyse attentivement la scène : qui parle, ce qui se passe, le contexte émotionnel et le message principal pour guider la justesse du sous-titrage.\n"
            "10. CONTEXTE CULTUREL, SLOGANS & POÉSIE (DIRECTIVE ÉDITORIALE NADINE) : "
            "Si le texte contient des slogans de manifestation, de la poésie, ou des expressions idiomatiques (ex: 'Al-Munadi' / 'المنادي'), NE FAIS PAS de traduction littérale. "
            "Adapte le texte pour qu'il sonne de manière naturelle, poignante et héroïque en français (ex: utilise 'La voix s'est élevée' ou 'Le chant résonne' plutôt que 'Le crieur a annoncé'). "
            "Préserve toujours la dignité, la force et la charge émotionnelle des paroles.\n"
            f"{lexicon_directive}"
            "FORMAT DE SORTIE : Réponds UNIQUEMENT par un tableau JSON valide d'objets avec les clés 'start' (secondes réelles float, ex: 14.5), 'end' (secondes réelles float, ex: 18.2), et 'text' (français).\n"
            "Exemple : [{\"start\": 0.0, \"end\": 3.2, \"text\": \"Mon frère Steve, honnêtement...\"}, {\"start\": 3.2, \"end\": 7.0, \"text\": \"la situation est très difficile.\"}]"
        )
    else: # VOAR (Français ou autre vers Arabe Palestinien de Gaza)
        prompt = (
            "Tu es un traducteur et transcripteur expert d'élite, linguiste assermenté du dialecte arabe palestinien de Gaza (Ammiya de Gaza - العامية الغزاوية) et du français.\n"
            f"{source_context}"
            f"{user_context_directive}"
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
            "5. TIMESTAMPS EN SECONDES RÉELLES (RÈGLE D'ÉCHELLE ABSOLUE) : Les temps 'start' et 'end' doivent être exprimés en SECONDES RÉELLES ENTIÈRES OU DÉCIMALES relatives au DÉBUT de cet extrait audio (ex: 2.8, 12.4, 27.0). "
            "INTERDICTION FORMELLE d'écrire des valeurs comme 0.12 ou 0.27 pour désigner 12s ou 27s ! 'end' > 'start'.\n"
            "6. FIDÉLITÉ TEMPORELLE ABSOLUE : Reste fidèle à TOUT le discours sans jamais résumer, paraphraser, tronquer ou omettre de phrases.\n"
            "7. ANALYSE DE CONTEXTE (DIRECTIVE NADINE & THOMAS) : Analyse la scène (qui parle, ce qui se passe, le contexte et le message principal) pour garantir l'adéquation parfaite des sous-titres avec la réalité vécue.\n\n"
            "FORMAT DE SORTIE : Réponds UNIQUEMENT par un tableau JSON valide d'objets avec les clés 'start' (secondes réelles float, ex: 12.5), 'end' (secondes réelles float, ex: 16.0), et 'text' (arabe palestinien de Gaza).\n"
            "Exemple : [{\"start\": 0.0, \"end\": 2.8, \"text\": \"أخوي ستيف، العنف مش بس بالسلاح...\"}, {\"start\": 2.8, \"end\": 6.5, \"text\": \"في وجع تاني الناس مش شايفتو.\"}]"
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
                            return normalize_and_rescale_segments(cached_segments, total_duration)
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
                                    return normalize_and_rescale_segments(cached_segments, total_duration)
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
                    segments = normalize_and_rescale_segments(segments, total_duration)
                    print(f"[Pôle 3 Gemini] ✅ Succès avec modèle {model_name} : {len(segments)} segments reçus !")
                    LAST_MODEL_USED = model_name
                    LAST_TELEMETRY["t_exec_s"] = round(time.time() - t_jade_start, 2)
                    LAST_TELEMETRY["model_used"] = model_name
                    LAST_TELEMETRY["retries"] = idx
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


def gemini_batch_translate_units(units: list, mode: str = 'VOSTFR', user_context: str = '') -> list:
    """
    Traduit un ensemble d'unités acoustiques pré-alignées (ex: Faster-Whisper ou Chirp 2)
    en conservant avec une précision mathématique absolue les timestamps originaux.
    Découpage par micro-lots de 25 segments maximum pour garantir une complétude à 100%
    sur les vidéos longues sans jamais saturer la fenêtre de génération de tokens.
    """
    global LAST_MODEL_USED, LAST_TELEMETRY
    t_jade_start = time.time()
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key or not units:
        return []

    target_desc = "français percutant, fluide et soigné (VOSTFR)" if mode == 'VOSTFR' else "arabe palestinien dialectal de Gaza (Ammiya de Gaza - VOAR)"
    context_directive = f"\nContexte éditorial : {user_context.strip()}\n" if user_context and user_context.strip() else ""

    PRIMARY_MODEL = os.environ.get("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash")
    FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")
    MODELS_CASCADE = [
        PRIMARY_MODEL,
        FALLBACK_MODEL,
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-3.5-flash-lite",
        "gemini-3-flash-preview",
        "gemini-2.5-pro"
    ]

    BATCH_SIZE = 25
    all_translated_segments = []

    for b_start in range(0, len(units), BATCH_SIZE):
        sub_units = units[b_start:b_start + BATCH_SIZE]
        lines_ar = [u.get("text", "").strip() for u in sub_units]
        numbered_prompt = "\n".join([f"{i+1}. {txt}" for i, txt in enumerate(lines_ar)])

        prompt = (
            f"Tu es un traducteur et sous-titreur expert d'élite spécialisé dans le dialecte palestinien et le français (Agent Jade).\n"
            f"{context_directive}"
            f"Consigne : Traduis fidèlement chacune des phrases numérotées ci-dessous vers un {target_desc} pour des sous-titres vidéo professionnels.\n"
            f"RÈGLE DE FLUIDITÉ ET DÉDUPLICATION (DIRECTIVE MAJEURE JADE) : Si l'audio original contient des bégaiements, des tics de langage, ou des répétitions inutiles (ex: 'Quatre étages, quatre étages, quatre étages'), LISSE la traduction en français. Ne traduis l'idée qu'une seule fois ou adapte-la pour que cela sonne naturel et tragique (ex: 'Quatre étages se sont effondrés'). Ton but est la clarté et la dignité du sous-titre.\n"
            f"Respecte STRICTEMENT la numérotation de 1 à {len(lines_ar)} sous la forme 'N. Traduction'.\n\n"
            f"{numbered_prompt}\n\n"
            f"Réponds UNIQUEMENT par la liste numérotée :"
        )

        req_payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2}
        }
        req_data = json.dumps(req_payload).encode("utf-8")

        sub_batch_translated = None

        for model_name in MODELS_CASCADE:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                    lines = raw_text.strip().splitlines()
                    translated_map = {}
                    for line in lines:
                        m = re.match(r"^(\d+)[\.\)]\s*(.*)", line.strip())
                        if m:
                            idx = int(m.group(1)) - 1
                            translated_map[idx] = m.group(2).strip()

                    sub_batch_translated = []
                    for i, u in enumerate(sub_units):
                        tr_text = translated_map.get(i, u.get("text", "")).strip()
                        sub_batch_translated.append({
                            "start": round(float(u["start"]), 2),
                            "end": round(float(u["end"]), 2),
                            "text": tr_text
                        })
                    LAST_MODEL_USED = f"Whisper + {model_name}"
                    break
            except Exception:
                continue

        if sub_batch_translated is not None:
            all_translated_segments.extend(sub_batch_translated)
        else:
            # Repli de sécurité pour ce sous-lot en cas d'indisponibilité totale
            for u in sub_units:
                all_translated_segments.append({
                    "start": round(float(u["start"]), 2),
                    "end": round(float(u["end"]), 2),
                    "text": u.get("text", "").strip()
                })

    LAST_TELEMETRY["t_exec_s"] = round(time.time() - t_jade_start, 2)
    LAST_TELEMETRY["model_used"] = LAST_MODEL_USED
    return all_translated_segments


if __name__ == "__main__":
    media = r"c:\Users\artas\Desktop\aya\audio_a_traiter\soso18.ogg"
    res = gemini_audio_transcribe_and_translate(media, 'VOSTFR')
    if res:
        print("Total segments:", len(res))
        for r in res[:5]:
            print(f"[{r['start']}s -> {r['end']}s] {r['text']}")
