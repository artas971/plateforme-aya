"""
Moteur Acoustique Google Cloud Chirp 2 (Agent Levantin) - Plateforme Aya
Ticket Phase 3B : Intégration du modèle de fondation Chirp 2 (Speech-to-Text V2)
Spécialisé dans la transcription haute précision des dialectes arabes (ar-PS / Levantin / Gaza)
avec horodatage mot à mot et cascade de secours triple-palier (Chirp 2 -> Faster-Whisper -> Gemini).
"""

import os
import sys
import json
import subprocess
import tempfile
from pathlib import Path

# Chemins de recherche des identifiants Google Cloud
ROOT_DIR = Path(__file__).resolve().parent

def safe_print(*args, **kwargs):
    """Garantit l'affichage console sans erreur d'encodage cp1252 / charmap sous Windows."""
    try:
        print(*args, **kwargs)
    except Exception:
        try:
            encoding = getattr(sys.stdout, 'encoding', 'utf-8') or 'utf-8'
            clean_args = [
                str(a).encode(encoding, errors='replace').decode(encoding)
                for a in args
            ]
            print(*clean_args, **kwargs)
        except Exception:
            pass

def resolve_gcp_credentials():
    """Résout le chemin du fichier credentials.json du compte de service Google Cloud."""
    candidates = [
        ROOT_DIR / "credentials.json",
        ROOT_DIR / "google_service_account.json"
    ]
    if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
        candidates.insert(0, Path(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]))
    if "GOOGLE_SERVICE_ACCOUNT_FILE" in os.environ:
        candidates.insert(0, ROOT_DIR / os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"])

    for p in candidates:
        if p.exists():
            return str(p.resolve())
    return None


def extract_audio_for_chirp(media_path: str, max_duration: float = None) -> str:
    """
    Extrait un flux audio optimisé 16 kHz Mono FLAC (format idéal et sans perte pour Chirp 2).
    Renvoie le chemin du fichier temporaire .flac.
    """
    fd, temp_flac = tempfile.mkstemp(suffix=".flac", prefix="aya_chirp_")
    os.close(fd)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(media_path),
        "-vn",
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "flac"
    ]
    if max_duration and max_duration > 0:
        cmd.extend(["-t", str(max_duration)])

    cmd.append(temp_flac)

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not os.path.exists(temp_flac) or os.path.getsize(temp_flac) == 0:
        if os.path.exists(temp_flac):
            try: os.unlink(temp_flac)
            except Exception: pass
        raise RuntimeError(f"Échec extraction audio FFmpeg pour Chirp 2: {res.stderr[-300:]}")

    return temp_flac


def group_chirp_words_into_subtitles(words_list: list, max_chars: int = 40, max_dur: float = 3.8, min_dur: float = 1.5) -> list:
    """
    Regroupe les mots horodatés issus de Chirp 2 en blocs de sous-titres naturels et fluides :
    - Durée cible : 1.8s à 3.8s
    - Longueur max : ~40 caractères par ligne
    - Scission si silence > 0.6s entre deux mots consécutifs.
    """
    if not words_list:
        return []

    segments = []
    current_words = []
    block_start = words_list[0]["start"]
    block_end = words_list[0]["end"]

    for w in words_list:
        word_text = w["word"].strip()
        if not word_text:
            continue

        w_start = w["start"]
        w_end = w["end"]

        if not current_words:
            current_words.append(word_text)
            block_start = w_start
            block_end = w_end
            continue

        prospective_text = " ".join(current_words + [word_text])
        prospective_dur = w_end - block_start
        gap = w_start - block_end

        # Conditions de scission de bloc
        should_split = False
        if gap > 0.6:  # Respiration ou silence franc
            should_split = True
        elif prospective_dur >= max_dur:  # Durée max atteinte
            should_split = True
        elif len(prospective_text) > max_chars and prospective_dur >= min_dur:  # Longueur max atteinte
            should_split = True

        if should_split:
            segments.append({
                "start": round(block_start, 2),
                "end": round(block_end, 2),
                "text": " ".join(current_words)
            })
            current_words = [word_text]
            block_start = w_start
            block_end = w_end
        else:
            current_words.append(word_text)
            block_end = max(block_end, w_end)

    if current_words:
        segments.append({
            "start": round(block_start, 2),
            "end": round(block_end, 2),
            "text": " ".join(current_words)
        })

    return segments


def transcribe_media_with_chirp2(media_path: str, source_lang: str = "ar", user_context: str = "") -> tuple:
    """
    Transcrit un média avec le modèle de fondation Google Cloud Chirp 2 (Speech-to-Text V2).
    
    Retourne : (segments, "google_cloud_chirp_2") en cas de succès,
               (None, error_reason) en cas d'échec pour déclencher le fallback cascade.
    """
    cred_file = resolve_gcp_credentials()
    if not cred_file:
        return None, "MISSING_CREDENTIALS"

    location = os.getenv("GCP_STT_LOCATION", "us-central1").strip()
    model_name = os.getenv("GCP_STT_MODEL", "chirp_2").strip()

    # Détermination des codes dialectaux
    # Chirp 2 supporte ar-PS (Palestine), ar-IL, ar-JO (Jordanie/Levant), ar-EG, etc.
    if source_lang and source_lang.lower() not in ["auto", "ar"]:
        lang_codes = [source_lang]
    else:
        lang_codes = ["ar-PS", "ar-IL", "ar-JO", "ar-EG"]

    temp_flac = None
    try:
        from google.cloud import speech_v2
        from google.oauth2 import service_account

        with open(cred_file, "r", encoding="utf-8") as cf:
            info = json.load(cf)
        project_id = info.get("project_id", "aya-platform2026")

        creds = service_account.Credentials.from_service_account_file(cred_file)
        client = speech_v2.SpeechClient(
            credentials=creds,
            client_options={"api_endpoint": f"{location}-speech.googleapis.com"}
        )

        # 1. Extraction audio 16kHz mono FLAC
        temp_flac = extract_audio_for_chirp(media_path)
        with open(temp_flac, "rb") as af:
            audio_content = af.read()

        file_size_mb = len(audio_content) / (1024 * 1024)
        if file_size_mb > 10.0:
            safe_print(f"[CHIRP 2 LEVANTIN] ℹ️ Fichier audio volumineux ({file_size_mb:.2f} Mo > 10 Mo pour STT inline). Bascule sur moteur local.", flush=True)
            return None, "AUDIO_TOO_LARGE_FOR_INLINE"

        # 2. Configuration Speech-to-Text V2
        features = speech_v2.RecognitionFeatures(
            enable_word_time_offsets=True,
            enable_automatic_punctuation=True
        )

        config = speech_v2.RecognitionConfig(
            auto_decoding_config=speech_v2.AutoDetectDecodingConfig(),
            model=model_name,
            language_codes=lang_codes,
            features=features
        )

        recognizer_path = f"projects/{project_id}/locations/{location}/recognizers/_"
        request = speech_v2.RecognizeRequest(
            recognizer=recognizer_path,
            config=config,
            content=audio_content
        )

        safe_print(f"[CHIRP 2 LEVANTIN] 🎙️ Envoi au modèle de fondation Chirp 2 (Projet: {project_id}, Région: {location}, Dialecte: {lang_codes[0]})...", flush=True)
        response = client.recognize(request=request)

        # 3. Traitement des résultats mot-à-mot
        all_words = []
        for result in response.results:
            if not result.alternatives:
                continue
            alt = result.alternatives[0]
            for w in alt.words:
                w_start = w.start_offset.total_seconds() if hasattr(w, "start_offset") and w.start_offset else 0.0
                w_end = w.end_offset.total_seconds() if hasattr(w, "end_offset") and w.end_offset else w_start + 0.3
                all_words.append({
                    "word": w.word,
                    "start": float(w_start),
                    "end": float(w_end)
                })

        if not all_words:
            # Fallback sur transcript brut si les offsets mot-à-mot ne sont pas peuplés
            full_transcripts = []
            for result in response.results:
                if result.alternatives:
                    full_transcripts.append(result.alternatives[0].transcript)
            raw_text = " ".join(full_transcripts).strip()
            if raw_text:
                safe_print(f"[CHIRP 2 LEVANTIN] ✅ Transcript brut reçu ({len(raw_text)} car.) sans offsets fins.", flush=True)
                return [{"start": 0.0, "end": 5.0, "text": raw_text}], f"google_cloud_{model_name}"
            return None, "EMPTY_RESPONSE"

        # 4. Découpage en blocs de sous-titres
        subtitles = group_chirp_words_into_subtitles(all_words)
        safe_print(f"[CHIRP 2 LEVANTIN] ✅ Succès : {len(subtitles)} répliques structurées à partir de {len(all_words)} mots horodatés.", flush=True)
        return subtitles, f"google_cloud_{model_name}"

    except Exception as err:
        err_msg = str(err)
        if "SERVICE_DISABLED" in err_msg or "has not been used" in err_msg or "PermissionDenied" in err_msg:
            safe_print("[CHIRP 2 INFO] 💡 L'API Cloud Speech-to-Text V2 n'est pas encore activée sur le projet GCP.", flush=True)
            safe_print("[CHIRP 2 INFO] 🔗 Activation directe : https://console.developers.google.com/apis/api/speech.googleapis.com/overview?project=aya-platform2026", flush=True)
        else:
            safe_print(f"[CHIRP 2 WARNING] Exception STT v2 : {err_msg[:150]}", flush=True)

        return None, f"CHIRP_ERROR: {type(err).__name__}"

    finally:
        if temp_flac and os.path.exists(temp_flac):
            try: os.unlink(temp_flac)
            except Exception: pass
