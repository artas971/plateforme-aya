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

def gemini_audio_transcribe_and_translate(media_path, mode='VOSTFR', total_duration=None, source_lang='auto'):
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        print("[Pole 3 Gemini] Pas de cle GEMINI_API_KEY detectee.")
        return None

    print(f"[Pole 3 Gemini] Lancement transcription/traduction ({mode}, source: {source_lang}) via Gemini 2.5 Flash...")

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
    if source_lang == 'ar':
        source_context = "CONTEXTE LANGUE SOURCE : L'audio source est intégralement en arabe palestinien (dialecte ammiya de Gaza).\n"
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
            "1. PRÉNOMS & VOCATIFS : Conserve 'Mon frère Steve', 'Steve', 'Soso', etc.\n"
            "2. LIEUX & TERMES : Conserve 'Le Port (Al-Mina)', 'La Ligne Jaune', 'canonnières de la marine', 'martyrs', 'cafétéria'.\n"
            "3. FIDÉLITÉ TEMPORELLE ABSOLUE : Reste fidèle à TOUT le discours sans jamais résumer, tronquer ou omettre de phrases.\n"
            "4. SYNCHRONISATION : Fournis des segments sous-titres naturels de 2 à 4 secondes bien alignés avec la parole.\n\n"
            "FORMAT DE SORTIE : Réponds UNIQUEMENT par un tableau JSON valide d'objets avec les clés 'start' (secondes, float), 'end' (secondes, float), et 'text' (français).\n"
            "Exemple : [{\"start\": 0.0, \"end\": 3.5, \"text\": \"Mon frère Steve, honnêtement...\"}]"
        )
    else: # VOAR
        prompt = (
            "Tu es un transcripteur expert d'élite du dialecte arabe palestinien de Gaza.\n"
            f"{source_context}"
            "Écoute attentivement l'enregistrement audio ci-joint et transcris fidèlement 100% de la parole en arabe parlé authentique.\n"
            "Découpe en sous-titres courts de 2 à 4 secondes.\n"
            "FORMAT DE SORTIE : Tableau JSON d'objets avec 'start' (float), 'end' (float), 'text' (arabe)."
        )

    # Vérification du cache local pour éviter les requêtes redondantes
    import re
    cache_dir = os.path.join(BASE_DIR, "cache_transcriptions")
    os.makedirs(cache_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(media_path))[0]
    raw_stem = re.sub(r"^\d+_", "", base_name)
    raw_stem_spaces = raw_stem.replace("_", " ")
    raw_stem_underscores = raw_stem.replace(" ", "_")

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
                                return cached_segments
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

    # Cascade de modèles IA Google Gemini avec bascule automatique en cas de quota épuisé (429)
    MODELS_CASCADE = [
        "gemini-2.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-3-flash-preview"
    ]

    for model_name in MODELS_CASCADE:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        try:
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                out_raw = res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
                segments = json.loads(out_raw)
                if isinstance(segments, list) and len(segments) > 0:
                    print(f"[Pôle 3 Gemini] ✅ Succès avec modèle {model_name} : {len(segments)} segments reçus !")
                    # Sauvegarde dans le cache
                    try:
                        with open(cache_file, "w", encoding="utf-8") as cf:
                            json.dump(segments, cf, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
                    return segments
        except Exception as e:
            print(f"[Pôle 3 Gemini] Modèle {model_name} indisponible ({e}). Bascule vers le modèle suivant...")
            continue

    return None

if __name__ == "__main__":
    media = r"c:\Users\artas\Desktop\aya\audio_a_traiter\soso18.ogg"
    res = gemini_audio_transcribe_and_translate(media, 'VOSTFR')
    if res:
        print("Total segments:", len(res))
        for r in res[:5]:
            print(f"[{r['start']}s -> {r['end']}s] {r['text']}")
