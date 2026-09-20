#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'orchestration de traduction & sous-titrage universel - Plateforme Aya
PROTOCOLE SCAN 5S & ZÉRO GAP AVEC DÉTECTION DES SILENCES (FFmpeg silencedetect)
Inférence IA Cloud (Gemini 2.5 Flash / OpenAI) - Zéro charge CPU locale.
Paramètres dynamiques : Couleur Primaire (Hexa -> BGR) et Position Verticale (MarginV).
"""

import os
import sys
import json
import subprocess
import shutil
import re
import time
import unicodedata
import urllib.request
import argparse
import base64
import threading
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont

# Forçage strict de l'encodage UTF-8 (éradication définitive du Mojibake)
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

OUTPUT_DIR = BASE_DIR / "fichiers_reponse_a_envoyer"
DEFAULT_BG = BASE_DIR / "modern_dark_bg.jpg"
BACKGROUNDS_DIR = BASE_DIR / "public" / "assets" / "backgrounds"
BACKGROUND_MAP = {
    "bg_palestine": BACKGROUNDS_DIR / "bg_palestine.jpg",
    "bg_dark": BACKGROUNDS_DIR / "bg_dark.jpg",
    "bg_turquoise": BACKGROUNDS_DIR / "bg_turquoise.jpg",
    "bg_temoignage": BACKGROUNDS_DIR / "bg_temoignage.jpg"
}
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Télémétrie et Rapport d'Audit Alexandre (Agent Alexandre)
ALEXANDRE_TELEMETRY = {}

def record_alexandre_agent(agent_name: str, task_key: str, t_start: float, status: str = "OK", details: str = "", extra: dict = None):
    duration = round(time.time() - t_start, 2)
    entry = {
        "agent": agent_name,
        "task": task_key,
        "t_exec_s": duration,
        "status": status,
        "details": details
    }
    if extra:
        entry.update(extra)
    ALEXANDRE_TELEMETRY[task_key] = entry
    return entry


def hex_to_ass_bgr(hex_color: str) -> str:
    """Convertit une couleur Web Hexadécimale (#RRGGBB) en format ASS BGR (&H00BBGGRR)."""
    if not hex_color:
        return "&H0000FFFF"  # Jaune par défaut
    clean = hex_color.replace("#", "").strip()
    if len(clean) == 6:
        r = clean[0:2]
        g = clean[2:4]
        b = clean[4:6]
        return f"&H00{b}{g}{r}".upper()
    elif len(clean) == 3:
        r = clean[0] * 2
        g = clean[1] * 2
        b = clean[2] * 2
        return f"&H00{b}{g}{r}".upper()
    return "&H0000FFFF"


def detect_audio_silences(media_path: str, noise_threshold: str = "-30dB", min_duration: float = 0.30) -> list:
    """
    Exécute FFmpeg silencedetect pour obtenir la carte mathématique des silences réels (> min_duration).
    Retourne une liste de tuples [(start_sec, end_sec), ...].
    """
    cmd = [
        'ffmpeg', '-v', 'info',
        '-i', media_path,
        '-af', f"silencedetect=noise={noise_threshold}:d={min_duration}",
        '-f', 'null', '-'
    ]
    silences = []
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        lines = res.stderr.splitlines()

        current_start = None
        for line in lines:
            if "silence_start:" in line:
                m = re.search(r"silence_start:\s*([0-9.]+)", line)
                if m:
                    current_start = float(m.group(1))
            elif "silence_end:" in line:
                m_end = re.search(r"silence_end:\s*([0-9.]+)", line)
                if m_end and current_start is not None:
                    end_val = float(m_end.group(1))
                    silences.append((current_start, end_val))
                    current_start = None

        if current_start is not None:
            silences.append((current_start, current_start + 1.0))

    except Exception as e:
        print(f"[SILENCEDETECT WARNING] Erreur détection silence: {e}", file=sys.stderr)

    print(f"[SILENCEDETECT] {len(silences)} intervalle(s) de silence (> {min_duration}s) cartographié(s).")
    return silences


def has_silence_between(start_t: float, end_t: float, silences: list) -> bool:
    """Vérifie si un silence avéré (> 0.3s) chevauche l'intervalle temporel donné."""
    if end_t <= start_t:
        return False
    for s_start, s_end in silences:
        # Chevauchement si max(start_t, s_start) < min(end_t, s_end)
        overlap_start = max(start_t, s_start)
        overlap_end = min(end_t, s_end)
        if overlap_end - overlap_start >= 0.25:
            return True
    return False


def probe_media(media_path: str) -> dict:
    """Analyse les flux et la durée du média via ffprobe."""
    cmd = [
        'ffprobe', '-v', 'error',
        '-show_entries', 'stream=codec_type,codec_name,width,height,disposition:format=duration',
        '-of', 'json', media_path
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
    except Exception as e:
        print(f"[PROBE ERROR] Erreur ffprobe: {e}", file=sys.stderr)
        raise ValueError("Erreur : Média invalide, vide ou corrompu. Analyse ffprobe impossible.")

    streams = data.get("streams", [])
    if not streams or len(streams) == 0:
        raise ValueError("Erreur : Média invalide, vide ou corrompu. Analyse ffprobe impossible.")

    duration = 0.0
    if "format" in data and "duration" in data["format"]:
        try:
            duration = float(data["format"]["duration"])
        except Exception:
            duration = 0.0

    if duration <= 0.0:
        raise ValueError("Erreur : Média invalide, vide ou corrompu. Analyse ffprobe impossible.")

    is_video = False
    has_audio = False
    width = 1080
    height = 1920

    for stream in data.get("streams", []):
        ctype = stream.get("codec_type")
        if ctype == "audio":
            has_audio = True
        elif ctype == "video":
            cname = stream.get("codec_name", "").lower()
            disposition = stream.get("disposition", {})
            # Ignorer les pochettes d'album / images fixes attachées dans les audios
            if disposition and disposition.get("attached_pic") == 1:
                continue
            if cname in ["mjpeg", "png", "bmp", "gif"]:
                continue

            # Flux vidéo authentique détecté
            is_video = True
            w_val = stream.get("width")
            h_val = stream.get("height")
            width = int(w_val) if w_val else 1080
            height = int(h_val) if h_val else 1920

    # Sécurité supplémentaire basée sur l'extension si ffprobe a retourné des flux ambigus
    ext = Path(media_path).suffix.lower()
    if not is_video and ext in [".mp4", ".mov", ".mkv", ".avi", ".webm"]:
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                is_video = True
                w_val = stream.get("width")
                h_val = stream.get("height")
                width = int(w_val) if w_val else 1080
                height = int(h_val) if h_val else 1920
                break

    print(f"[PROBE MEDIA] Fichier : {Path(media_path).name} | Détection : {'VIDÉO' if is_video else 'AUDIO PUR'} ({width}x{height}) | Audio : {has_audio} | Durée : {duration:.2f}s", flush=True)

    return {
        "is_video": is_video,
        "has_audio": has_audio,
        "duration": duration,
        "width": width,
        "height": height
    }


def format_ass_time(seconds: float) -> str:
    """Convertit les secondes en format horodaté ASS (H:MM:SS.CC)."""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hrs}:{mins:02d}:{secs:05.2f}"


def format_subtitle_blocks(text: str, max_words_per_line: int = 7) -> str:
    """Équilibre les sous-titres en 1 ou 2 lignes de 7-8 mots max."""
    words = [w for w in text.split() if w]
    if not words:
        return ""
    if len(words) <= max_words_per_line:
        return " ".join(words)

    mid = len(words) // 2
    best_split = mid
    for offset in [0, -1, 1, -2, 2]:
        idx = mid + offset
        if 1 <= idx < len(words):
            prev_word = words[idx - 1]
            if prev_word.endswith((',', ';', ':', '.', '!', '?')):
                best_split = idx
                break

    line1 = " ".join(words[:best_split])
    line2 = " ".join(words[best_split:])
    return f"{line1}\\N{line2}"


def split_long_segment(segment: dict, max_duration: float = 4.5) -> list:
    """
    Couche de sécurité 1 : Smart Text Splitter.
    Scinde un segment dépassant max_duration (4.5s) en blocs équilibrés.
    Divise la durée en deux (ex: 6s devient deux blocs de 3s).
    Divise le texte proprement en comptant les mots, en coupant sur une virgule ou au milieu exact.
    Fonctionne de manière récursive si un bloc résultant dépasse encore max_duration.
    """
    start = float(segment.get("start", 0.0))
    end = float(segment.get("end", start + 2.0))
    dur = round(end - start, 2)
    text = segment.get("text", "").strip()

    if dur <= max_duration or not text:
        return [segment]

    words = [w for w in text.split() if w]
    if len(words) <= 1:
        # Mot unique ou bruit étiré : scission temporelle simple
        mid_time = round(start + (dur / 2.0), 2)
        return [
            {"start": round(start, 2), "end": mid_time, "text": text},
            {"start": mid_time, "end": round(end, 2), "text": ""}
        ]

    # Recherche du point de coupure textuel propre (virgule ou milieu exact)
    mid_idx = len(words) // 2
    best_split = mid_idx

    found_punct = False
    for offset in [0, -1, 1, -2, 2, -3, 3]:
        idx = mid_idx + offset
        if 1 <= idx < len(words):
            prev_word = words[idx - 1]
            if prev_word.endswith((',', ';', ':', '.', '!', '?')):
                best_split = idx
                found_punct = True
                break

    if not found_punct:
        best_split = max(1, mid_idx)

    part1_text = " ".join(words[:best_split]).strip()
    part2_text = " ".join(words[best_split:]).strip()

    # RÈGLE DU POIDS DES CARACTÈRES (Split Proportionnel) :
    # La durée allouée à chaque bloc est proportionnelle au nombre de caractères de ce bloc.
    len1 = len(part1_text)
    len2 = len(part2_text)
    total_chars = len1 + len2

    if total_chars > 0:
        ratio1 = len1 / total_chars
        split_time = round(start + (dur * ratio1), 2)
    else:
        split_time = round(start + (dur / 2.0), 2)

    # Sécurité temporelle : garantir au moins 0.4s par bloc pour la lisibilité
    min_split = start + 0.4
    max_split = end - 0.4
    if min_split < max_split:
        split_time = max(min_split, min(split_time, max_split))
    else:
        split_time = round(start + (dur / 2.0), 2)

    seg1 = {"start": round(start, 2), "end": split_time, "text": part1_text}
    seg2 = {"start": split_time, "end": round(end, 2), "text": part2_text}

    # Récursion si un sous-bloc dépasse toujours max_duration
    sub_results = []
    for s in [seg1, seg2]:
        if (s["end"] - s["start"]) > max_duration and len(s["text"].split()) > 1:
            sub_results.extend(split_long_segment(s, max_duration=max_duration))
        else:
            sub_results.append(s)

    return sub_results


def sanitize_translation(text: str) -> str:
    """
    Couche de sécurité 2 : Post-Processing Lexical Anti-Hallucinations.
    Search & Replace impitoyable sur les hallucinations et contresens phonétiques connus :
    - 'glissé' -> 'déplacée'
    - 'Jabalia le pays' ou 'Jabalia, le pays' -> 'Jabalia Al-Balad'
    - 'Maïs' (début de phrase) -> ''
    - 'ressuscité' -> 'survécu'
    """
    if not text:
        return ""

    cleaned = text

    # 1. Élimination de 'Maïs' en début de phrase (hallucination de bruit de fond)
    cleaned = re.sub(r'^\s*Ma[ïi]s\s*[,.:;-]?\s*', '', cleaned, flags=re.IGNORECASE)

    # 2. Remplacement de 'Jabalia le pays' ou 'Jabalia, le pays' par 'Jabalia Al-Balad'
    cleaned = re.sub(r'\bJabali[y]?a\s*(?:,\s*)?le\s+pays\b', 'Jabalia Al-Balad', cleaned, flags=re.IGNORECASE)

    # 3. Remplacement de 'glissé' / 'glissée' par 'déplacée'
    cleaned = re.sub(r'\bGliss[ée]e?s?\b', 'Déplacée', cleaned)
    cleaned = re.sub(r'\bgliss[ée]e?s?\b', 'déplacée', cleaned)

    # 4. Remplacement de 'ressuscité' / 'ressuscitée' par 'survécu'
    cleaned = re.sub(r'\bRessuscit[ée]e?s?\b', 'Survécu', cleaned)
    cleaned = re.sub(r'\bressuscit[ée]e?s?\b', 'survécu', cleaned)

    # 5. Remplacement des traductions littérales de slogans (ex: 'Le crieur a annoncé' -> 'La voix s'est élevée')
    cleaned = re.sub(r'\b[Ll]e crieur a annonc[ée]\b', "La voix s'est élevée", cleaned)
    cleaned = re.sub(r'\b[Ll]e crieur\b', "La voix", cleaned)

    # Nettoyage des espaces résiduels
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def uncluster_stacked_segments(segments: list, total_duration: float) -> list:
    """
    Filet de sécurité ultime : Détecte et déplie tout groupe de sous-titres 'empilés'
    (timestamps quasi-identiques créant un embouteillage illisible et un trou ultérieur).
    Redistribue les segments empilés proportionnellement au nombre de caractères.
    """
    if not segments or len(segments) < 2:
        return segments

    # Tri initial préalable
    segments.sort(key=lambda x: x["start"])

    i = 0
    while i < len(segments):
        # Chercher le début d'un empilement : segments consécutifs avec un écart de début <= 0.15s
        j = i
        while j + 1 < len(segments) and (segments[j + 1]["start"] - segments[j]["start"] <= 0.15):
            j += 1

        # Empilement anormal détecté de 2 ou plusieurs segments
        if j > i:
            cluster = segments[i:j + 1]
            cluster_start = cluster[0]["start"]
            # Borne de fin : début du segment suivant ou durée totale
            next_bound = segments[j + 1]["start"] if j + 1 < len(segments) else total_duration
            available_dur = max(0.0, next_bound - cluster_start)

            # Si l'espace disponible après l'empilement est significatif (> 2.0s pour 2+ segments)
            if available_dur >= len(cluster) * 1.2:
                target_span = min(available_dur - 0.2, len(cluster) * 3.5)
                total_chars = sum(max(1, len(s.get("text", ""))) for s in cluster)
                cur_t = cluster_start
                for s in cluster:
                    char_weight = max(1, len(s.get("text", ""))) / total_chars
                    s_dur = max(1.2, min(4.5, round(target_span * char_weight, 2)))
                    s["start"] = round(cur_t, 2)
                    s["end"] = round(cur_t + s_dur, 2)
                    cur_t += s_dur

                print(f"[POST-TRAITEMENT DÉPLIAGE] 📐 {len(cluster)} sous-titres empilés à {cluster_start:.2f}s ont été redéployés sur {target_span:.2f}s.", flush=True)

            i = j + 1
        else:
            i += 1

    return segments


def find_smart_cut_point(w_start: float, total_duration: float, silences: list, min_chunk: float = 20.0, max_chunk: float = 35.0, default_chunk: float = 30.0) -> float:
    """
    Découpage adaptatif (Smart Chunking) :
    Recherche le dernier vrai silence situé entre (w_start + 20s) et (w_start + 35s).
    Si trouvé, définit la fin de la fenêtre au milieu de ce silence pour ne jamais couper un mot.
    Sinon, bascule sur un découpage standard à default_chunk (30s).
    Anti-Micro-Chunk : Si le restant de la vidéo est <= max_chunk + 10s (ex: 45s), on absorbe tout
    pour éviter de créer un micro-morceau orphelin (1 à 5s) qui hallucinerait en fin de vidéo.
    """
    remaining = total_duration - w_start
    if remaining <= max_chunk:
        return round(total_duration, 2)

    # RÈGLE ANTI-ORPHELIN : Si le restant total dépasse modérément max_chunk (jusqu'à max_chunk + 12s = 47s),
    # on absorbe la totalité pour éviter de découper un micro-résidu (1s à 6s) qui hallucinerait en fin de vidéo.
    if remaining <= max_chunk + 12.0:
        return round(total_duration, 2)

    search_start = w_start + min_chunk
    search_end = w_start + max_chunk

    candidate_silences = []
    for s_start, s_end in silences:
        if search_start <= s_start <= search_end or search_start <= s_end <= search_end:
            candidate_silences.append((s_start, s_end))
        elif s_start < search_start and s_end > search_end:
            candidate_silences.append((s_start, s_end))

    if candidate_silences:
        # Trouver en priorité un silence qui ne laisse pas un résidu orphelin (< 8.0s)
        for last_s in reversed(candidate_silences):
            cut_point = (last_s[0] + last_s[1]) / 2.0
            cut_point = max(search_start, min(cut_point, search_end))
            if (total_duration - cut_point) >= 8.0:
                return round(cut_point, 2)
        # Si tous les silences laissaient un résidu < 8s, absorber si raisonnable
        if remaining <= 48.0:
            return round(total_duration, 2)

    # Fallback si aucun silence détecté
    fallback_cut = w_start + default_chunk
    if total_duration - fallback_cut < 8.0:
        return round(total_duration, 2)
    return round(min(total_duration, fallback_cut), 2)


def transcribe_window(chunk_path: str, mode: str, window_offset: float, window_dur: float, source_lang: str = 'auto', force_reprocess: bool = False, user_context: str = "") -> list:
    """
    Appelle l'IA pour transcrire/traduire une fenêtre délimitée sur les silences.
    Applique un CLAMPING STRICT (min/max) et un RECALIBRAGE D'ÉCHELLE AUTO (Anti-0.SS).
    Transmet le user_context pour le Context Grounding de l'Agent Jade.
    """
    from gemini_translator import gemini_audio_transcribe_and_translate, normalize_and_rescale_segments, _parse_timestamp_val
    raw_segments = gemini_audio_transcribe_and_translate(chunk_path, mode=mode, total_duration=window_dur, source_lang=source_lang, force_reprocess=force_reprocess, user_context=user_context)
    
    # Fallback local Faster-Whisper sur le chunk si Gemini n'a pas répondu
    if not raw_segments or len(raw_segments) == 0:
        try:
            from faster_whisper import WhisperModel
            w_model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=2)
            w_lang = "ar" if source_lang in ['ar', 'auto'] else (source_lang if source_lang != 'auto' else None)
            w_segs, _ = w_model.transcribe(chunk_path, language=w_lang, word_timestamps=False)
            w_list = list(w_segs)
            if w_list:
                units = [{"start": round(ws.start, 2), "end": round(ws.end, 2), "text": ws.text.strip()} for ws in w_list if ws.text.strip()]
                from gemini_translator import gemini_batch_translate_units
                raw_segments = gemini_batch_translate_units(units, mode=mode, user_context=user_context)
        except Exception:
            pass

    if not raw_segments or len(raw_segments) == 0:
        return []

    # Recalibrage d'échelle préventif (Anti-Compression 0.SS / décimales minutes)
    normalized_segments = normalize_and_rescale_segments(raw_segments, window_dur)

    window_segments = []
    for seg in normalized_segments:
        raw_start = _parse_timestamp_val(seg.get("start", 0.0))
        raw_end = _parse_timestamp_val(seg.get("end", raw_start + 2.0))
        txt = seg.get("text", "").strip()
        if not txt:
            continue

        # Rejeter les segments fantômes dont le début dépasse la durée de l'extrait
        if raw_start >= window_dur - 0.2:
            continue

        # CLAMPING STRICT (ANTI-DÉRIVE) :
        # 1. Aucun timestamp relatif ne doit dépasser la durée de la fenêtre en cours (window_dur)
        # 2. Aucun timestamp relatif ne doit être négatif
        s_rel = max(0.0, min(raw_start, max(0.0, window_dur - 0.3)))
        e_rel = max(s_rel + 0.3, min(raw_end, window_dur))

        seg_adjusted = {
            "start": round(window_offset + s_rel, 2),
            "end": round(window_offset + e_rel, 2),
            "text": txt
        }
        window_segments.append(seg_adjusted)

    return window_segments


# Alias de compatibilité descendante
transcribe_window_30s = transcribe_window


def verify_timeline_coverage(segments: list, total_duration: float, tolerance: float = 0.90, silences: list = None) -> bool:
    """
    Garde-Fou Temporel Assermenté (Agent Alexandre - Ticket Troncature) :
    Vérifie que les sous-titres couvrent l'intégralité de la chronologie du média.
    Détecte et bloque les troncatures prématurées (ex: arrêt à 2m20 sur une vidéo de 5min12).
    Tolérance : 90% par défaut (ou fin de parole détectée avant silence terminal).
    """
    if not segments:
        return False
    if total_duration <= 5.0:
        return len(segments) > 0

    max_end = max(float(s.get("end", 0.0)) for s in segments)

    # Prise en compte du silence terminal : si la vidéo comporte une outro silencieuse ou musicale
    effective_target = total_duration
    if silences:
        for s_start, s_end in silences:
            if s_end >= total_duration - 1.5:
                effective_target = max(5.0, s_start)
                break

    coverage_ratio = max_end / max(1.0, effective_target)
    is_valid = (coverage_ratio >= tolerance) or (max_end >= total_duration * tolerance)

    if not is_valid:
        print(f"[TIMELINE AUDIT] ⚠️ TRONCATURE DÉTECTÉE ! Dernier segment : {max_end:.2f}s, Cible : {effective_target:.2f}s (Couverture : {coverage_ratio*100:.1f}% < {tolerance*100:.0f}%).", flush=True)
    else:
        print(f"[TIMELINE AUDIT] ✅ Couverture temporelle validée : {max_end:.2f}s / {total_duration:.2f}s ({min(100.0, coverage_ratio*100):.1f}%).", flush=True)

    return is_valid


def process_audio_scan_5s(media_path: str, target_lang: str, total_duration: float, silences: list, source_lang: str = 'auto', force_reprocess: bool = False, user_context: str = "") -> tuple:
    """
    Protocole Scan 5s Anti-Résumé & Smart Chunking sur Silences :
    Découpe dynamique sur les silences réels (20s à 35s),
    clamping strict anti-dérive et raccord Zéro Gap conditionné aux silences.
    Option Bypass Cache (force_reprocess) pour réanalyse complète et assainissement du cache.
    Intègre le Context Grounding (user_context) pour l'Agent Jade.
    """
    mode = 'VOAR' if target_lang.lower() == 'ar' else 'VOSTFR'
    print(f"[PROGRESS] 40% - Analyse IA de l'audio ({total_duration:.1f}s) en mode {mode} (source: {source_lang})...", flush=True)

    cache_dir = BASE_DIR / "cache_transcriptions"
    base_name = Path(media_path).stem[:50]
    raw_stem = re.sub(r"^\d+_", "", base_name)
    found_cache = False
    all_segments = []

    # Si un contexte utilisateur est injecté spécifiquement, on force la réanalyse pour appliquer ce contexte
    if user_context and user_context.strip():
        force_reprocess = True

    if force_reprocess:
        print(f"[PROGRESS] 40% - 🔄 Bypass Cache activé : réanalyse complète forcée pour '{base_name}'...", flush=True)
        # Purge préventive des anciens fichiers de cache pour ce média afin d'assainir le dossier
        if cache_dir.exists():
            for fname in os.listdir(cache_dir):
                if fname.endswith(".json") and mode in fname:
                    f_clean = re.sub(r"^\d+_", "", fname)
                    if raw_stem in f_clean or f_clean.startswith(raw_stem):
                        try:
                            (cache_dir / fname).unlink()
                            print(f"[CACHE BUSTER] 🗑️ Ancien cache purgé : {fname}", flush=True)
                        except Exception:
                            pass
    else:
        # 1. Vérification du cache si le bypass n'est pas activé
        if cache_dir.exists():
            for fname in os.listdir(cache_dir):
                if fname.endswith(".json") and mode in fname:
                    f_clean = re.sub(r"^\d+_", "", fname)
                    if raw_stem in f_clean or f_clean.startswith(raw_stem):
                        try:
                            with open(cache_dir / fname, "r", encoding="utf-8") as cf:
                                cached_segs = json.load(cf)
                                if isinstance(cached_segs, list) and len(cached_segs) > 0:
                                    if verify_timeline_coverage(cached_segs, total_duration, tolerance=0.90, silences=silences):
                                        print(f"[PROTOCOLE SMART CHUNK] ⚡ Cache global valide détecté ({fname}) : {len(cached_segs)} segments déjà transcrits.", flush=True)
                                        for s in cached_segs:
                                            s_start = max(0.0, min(float(s.get("start", 0)), total_duration))
                                            s_end = max(s_start + 0.2, min(float(s.get("end", s_start + 2.0)), total_duration))
                                            txt = s.get("text", "").strip()
                                            if txt:
                                                all_segments.append({
                                                    "start": round(s_start, 2),
                                                    "end": round(s_end, 2),
                                                    "text": txt
                                                })
                                        found_cache = True
                                        print("[PROGRESS] 70% - Segments réutilisés instantanément depuis le cache local.", flush=True)
                                        break
                                    else:
                                        print(f"[CACHE AUDIT] ⚠️ Cache tronqué/incomplet détecté ({fname}) : invalidation et réanalyse complète.", flush=True)
                                        try: (cache_dir / fname).unlink()
                                        except Exception: pass
                        except Exception:
                            pass

    if not found_cache:
        # CASCADE ACOUSTIQUE TRIPLE-PALIER & SMART CHUNKING (TICKETS 3B, 3C & AUDIT TRONCATURE)
        stt_success = False
        enable_chirp = os.getenv("ENABLE_CHIRP_STT", "true").lower() in ("true", "1", "yes")
        ff_prof = get_ffmpeg_performance_profile()

        def _try_whisper(cpu_threads_limit=None):
            t0_w = time.time()
            try:
                from faster_whisper import WhisperModel
                th_arg = cpu_threads_limit if cpu_threads_limit and cpu_threads_limit > 0 else 4
                print(f"[ACOUSTIC SYNC] 🎙️ Analyse acoustique via Faster-Whisper (cpu_threads={th_arg})...", flush=True)
                w_model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=th_arg)
                w_lang = "ar" if source_lang in ['ar', 'auto'] else (source_lang if source_lang != 'auto' else None)
                w_segments, w_info = w_model.transcribe(media_path, language=w_lang, word_timestamps=False)
                raw_w_segs = list(w_segments)
                record_alexandre_agent("Thomas", "thomas_whisper_transcribe", t0_w, status="OK", details=f"{len(raw_w_segs)} segments vocaux (threads: {th_arg}, lang: {w_info.language if w_info else 'ar'})")
                if raw_w_segs and len(raw_w_segs) > 0:
                    print(f"[ACOUSTIC SYNC] ✅ {len(raw_w_segs)} segments vocaux détectés (langue: {w_info.language}).", flush=True)
                    merged_units = []
                    curr_u = None
                    for ws in raw_w_segs:
                        w_txt = ws.text.strip()
                        if not w_txt:
                            continue
                        if curr_u is None:
                            curr_u = {"start": round(ws.start, 2), "end": round(ws.end, 2), "text": w_txt}
                        else:
                            c_dur = curr_u["end"] - curr_u["start"]
                            gap = ws.start - curr_u["end"]
                            if c_dur < 2.5 and gap < 0.6 and (ws.end - curr_u["start"]) <= 4.2:
                                curr_u["end"] = round(ws.end, 2)
                                curr_u["text"] += " " + w_txt
                            else:
                                merged_units.append(curr_u)
                                curr_u = {"start": round(ws.start, 2), "end": round(ws.end, 2), "text": w_txt}
                    if curr_u:
                        merged_units.append(curr_u)

                    t0_j = time.time()
                    from gemini_translator import gemini_batch_translate_units, LAST_MODEL_USED
                    translated = gemini_batch_translate_units(merged_units, mode=mode, user_context=user_context)
                    record_alexandre_agent("Jade", "jade_gemini_translation", t0_j, status="OK", details=f"{len(translated or [])} segments traduits ({LAST_MODEL_USED})")
                    if translated and len(translated) > 0:
                        return translated
            except Exception as we:
                record_alexandre_agent("Thomas", "thomas_whisper_transcribe", t0_w, status="FALLBACK", details=f"Échec Whisper ({we})")
                print(f"[ACOUSTIC SYNC WARNING] Moteur acoustique Whisper indisponible ({we}).", file=sys.stderr)
            return None

        def _try_gemini_audio_direct():
            t0_g = time.time()
            try:
                from gemini_translator import gemini_audio_transcribe_and_translate, LAST_MODEL_USED
                raw_segs = gemini_audio_transcribe_and_translate(media_path, mode=mode, total_duration=total_duration, source_lang=source_lang, force_reprocess=force_reprocess, user_context=user_context)
                if not raw_segs:
                    openai_key = os.environ.get("OPENAI_API_KEY")
                    if openai_key:
                        from run_studio_v3_full_pipeline import transcribe_via_openai_api
                        raw_segs = transcribe_via_openai_api(media_path, openai_key, mode=mode)
                out_segs = []
                for s in (raw_segs or []):
                    s_start = max(0.0, min(float(s.get("start", 0)), total_duration))
                    s_end = max(s_start + 0.2, min(float(s.get("end", s_start + 2.0)), total_duration))
                    txt = s.get("text", "").strip()
                    if txt:
                        out_segs.append({
                            "start": round(s_start, 2),
                            "end": round(s_end, 2),
                            "text": txt
                        })
                if out_segs:
                    record_alexandre_agent("Jade", "jade_gemini_translation", t0_g, status="OK", details=f"Transcription directe Gemini ({LAST_MODEL_USED})")
                    return out_segs
                else:
                    record_alexandre_agent("Jade", "jade_gemini_translation", t0_g, status="FALLBACK", details="Gemini Audio Direct sans segments")
            except Exception as ge:
                record_alexandre_agent("Jade", "jade_gemini_translation", t0_g, status="FALLBACK", details=f"Exception Gemini Audio ({ge})")
            return None

        # RÈGLE ARCHITECTURALE ABSOLUE (Alexandre / Audit Troncature) :
        # - Vidéo longue (> 60.0s) : Smart Chunking adaptatif obligatoire (20s-35s sur silences).
        #   Éradique définitivement les troncatures de génération JSON pour toute vidéo jusqu'à 10+ minutes.
        # - Vidéo courte (<= 60.0s) : Tentative Single-Shot rapide (Chirp 2 -> Whisper / Gemini Audio Direct).
        #   Si la tentative courte échoue ou ne couvre pas 90% du chronométrage, bascule automatique sur Smart Chunking.
        use_smart_chunking = (total_duration > 60.0)

        if not use_smart_chunking:
            print(f"[DUAL-ENV ROUTING] ⏱️ Vidéo courte ({total_duration:.1f}s <= 60s) : tentative Single-Shot directe...", flush=True)

            # =========================================================================
            # PALIER 1 : Google Cloud Chirp 2 (Agent Levantin)
            # =========================================================================
            if enable_chirp:
                t0_chirp = time.time()
                try:
                    from chirp_client import transcribe_media_with_chirp2
                    chirp_segs, chirp_model = transcribe_media_with_chirp2(media_path, source_lang=source_lang, user_context=user_context)
                    if chirp_segs and len(chirp_segs) > 0:
                        record_alexandre_agent("Thomas", "thomas_chirp2_transcribe", t0_chirp, status="OK", details=f"{len(chirp_segs)} répliques ({chirp_model})")
                        t0_jade = time.time()
                        from gemini_translator import gemini_batch_translate_units, LAST_MODEL_USED
                        translated_segs = gemini_batch_translate_units(chirp_segs, mode=mode, user_context=user_context)
                        record_alexandre_agent("Jade", "jade_gemini_translation", t0_jade, status="OK", details=f"{len(translated_segs or [])} segments traduits ({LAST_MODEL_USED})")
                        if translated_segs and verify_timeline_coverage(translated_segs, total_duration, tolerance=0.90, silences=silences):
                            all_segments = translated_segs
                            stt_success = True
                            ai_model_used = f"{chirp_model} + {LAST_MODEL_USED}"
                            print(f"[CHIRP 2 SUCCÈS] 🎯 Transcription Levantine & Traduction réussies ({len(all_segments)} sous-titres).", flush=True)
                    else:
                        record_alexandre_agent("Thomas", "thomas_chirp2_transcribe", t0_chirp, status="FALLBACK", details=f"Chirp ({chirp_model}) -> Bascule Whisper")
                except Exception as ce:
                    record_alexandre_agent("Thomas", "thomas_chirp2_transcribe", t0_chirp, status="FALLBACK", details=f"Exception Chirp ({ce}) -> Bascule Moteur Acoustique")

            # =========================================================================
            # DUAL-ENVIRONMENT ROUTING (TICKET 3C : LOCAL HIGH-PERF VS CLOUD VPS SAFE)
            # =========================================================================
            if not stt_success:
                if ff_prof["is_cloud"]:
                    # MODE CLOUD VPS : Priorité absolue aux API Cloud (Gemini Audio Direct 0% CPU)
                    print(f"[DUAL-ENV ROUTING] ☁️ Profil CLOUD VPS ({ff_prof['label']}) : Priorité Gemini Audio Direct (0% CPU VPS)...", flush=True)
                    g_segs = _try_gemini_audio_direct()
                    if g_segs and verify_timeline_coverage(g_segs, total_duration, tolerance=0.90, silences=silences):
                        all_segments = g_segs
                        stt_success = True
                        from gemini_translator import LAST_MODEL_USED
                        ai_model_used = f"gemini_audio_direct + {LAST_MODEL_USED}"
                        print(f"[DUAL-ENV ROUTING] 🎯 Gemini Audio Direct réussi ({len(all_segments)} sous-titres, 0% CPU VPS).", flush=True)
                    else:
                        th_limit = int(ff_prof["threads"]) if (ff_prof["threads"].isdigit() and int(ff_prof["threads"]) > 0) else 2
                        print(f"[DUAL-ENV ROUTING] ⚠️ Secours Whisper bridé à {th_limit} threads...", flush=True)
                        w_segs = _try_whisper(cpu_threads_limit=th_limit)
                        if w_segs and verify_timeline_coverage(w_segs, total_duration, tolerance=0.90, silences=silences):
                            all_segments = w_segs
                            stt_success = True
                            from gemini_translator import LAST_MODEL_USED
                            ai_model_used = f"whisper_safe_{th_limit}th + {LAST_MODEL_USED}"
                else:
                    # MODE LOCAL HIGH-PERF : Whisper int8 en local -> Gemini Audio Direct en secours
                    print(f"[DUAL-ENV ROUTING] 💻 Profil LOCAL ({ff_prof['label']}) : Analyse Faster-Whisper locale...", flush=True)
                    w_segs = _try_whisper(cpu_threads_limit=4)
                    if w_segs and verify_timeline_coverage(w_segs, total_duration, tolerance=0.90, silences=silences):
                        all_segments = w_segs
                        stt_success = True
                        from gemini_translator import LAST_MODEL_USED
                        ai_model_used = f"whisper_local + {LAST_MODEL_USED}"
                        print(f"[ACOUSTIC SYNC] 🎯 Traduction synchronisée réussie ({len(all_segments)} sous-titres calés à la voix).", flush=True)
                    else:
                        print("[DUAL-ENV ROUTING] ⚠️ Secours Gemini Audio Direct...", flush=True)
                        g_segs = _try_gemini_audio_direct()
                        if g_segs and verify_timeline_coverage(g_segs, total_duration, tolerance=0.90, silences=silences):
                            all_segments = g_segs
                            stt_success = True
                            from gemini_translator import LAST_MODEL_USED
                            ai_model_used = f"gemini_audio_direct + {LAST_MODEL_USED}"

            if not stt_success:
                print("[DUAL-ENV ROUTING] ⚠️ Le mode Single-Shot a échoué ou a produit un résultat tronqué. Bascule de sécurité vers Smart Chunking...", flush=True)
                use_smart_chunking = True

        # =========================================================================
        # PROTOCOLE SMART CHUNKING ADAPTATIF SUR SILENCES RÉELS (20s à 35s)
        # =========================================================================
        if use_smart_chunking and not stt_success:
            print(f"[SMART CHUNKING] 🛡️ Activation du Smart Chunking adaptatif ({total_duration:.1f}s, fenêtres 20s-35s)...", flush=True)
            temp_dir = BASE_DIR / "temp_chunks"
            temp_dir.mkdir(parents=True, exist_ok=True)

            windows_plan = []
            cursor = 0.0
            while cursor < total_duration:
                next_cut = find_smart_cut_point(cursor, total_duration, silences, min_chunk=20.0, max_chunk=35.0, default_chunk=30.0)
                if next_cut <= cursor:
                    next_cut = min(total_duration, cursor + 30.0)
                # Sécurité anti-micro-chunk terminal orphelin (< 8.0s)
                if (total_duration - next_cut) < 8.0:
                    next_cut = total_duration
                windows_plan.append((cursor, next_cut))
                cursor = next_cut

            total_windows = len(windows_plan)
            print(f"[SMART CHUNKING] {total_windows} fenêtre(s) adaptative(s) planifiée(s) pour couvrir 100% de la durée.", flush=True)

            all_chunk_segs = []
            for w_idx, (w_start, w_end) in enumerate(windows_plan):
                w_dur = round(w_end - w_start, 2)
                current_pct = int(40 + (w_idx / total_windows) * 30)
                print(f"[PROGRESS] {current_pct}% - Analyse IA : Fenêtre {w_idx + 1}/{total_windows} [{w_start:.2f}s -> {w_end:.2f}s] ({w_dur:.2f}s)...", flush=True)

                chunk_file = temp_dir / f"chunk_{os.getpid()}_{w_idx}.mp3"
                cmd_cut = [
                    'ffmpeg', '-y',
                    '-ss', str(w_start), '-to', str(w_end),
                    '-i', media_path,
                    '-vn', '-ar', '24000', '-ac', '1', '-b:a', '64k',
                    str(chunk_file.resolve())
                ]
                subprocess.run(cmd_cut, capture_output=True, check=True)

                try:
                    w_segs = transcribe_window(str(chunk_file.resolve()), mode, w_start, w_dur, source_lang=source_lang, force_reprocess=force_reprocess, user_context=user_context)
                    if w_segs:
                        all_chunk_segs.extend(w_segs)
                finally:
                    if chunk_file.exists():
                        try: chunk_file.unlink()
                        except Exception: pass

            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)

            if all_chunk_segs:
                all_segments = all_chunk_segs
                stt_success = True
                from gemini_translator import LAST_MODEL_USED
                ai_model_used = f"smart_chunking_adaptive + {LAST_MODEL_USED}"
                print(f"[PROGRESS] 70% - Toutes les fenêtres ont été transcrites avec succès ({len(all_segments)} sous-titres).", flush=True)
                verify_timeline_coverage(all_segments, total_duration, tolerance=0.88, silences=silences)

    if not all_segments:
        raise RuntimeError("Les serveurs IA sont temporairement surchargés. Veuillez réessayer dans quelques minutes.")

    # Filet de sécurité anti-empilement : déploiement de tout cluster de répliques anormalement comprimées
    all_segments = uncluster_stacked_segments(all_segments, total_duration)

    # Tri chronologique absolu
    all_segments.sort(key=lambda x: x["start"])

    # RÈGLE ZÉRO GAP LIMITÉ (RESPIRATION) AVEC DÉTECTION DES SILENCES RÉELS & ANTI-CHEVAUCHEMENT
    print("[POST-TRAITEMENT] Application de la règle Zéro Gap limitée (respiration > 1.2s)...", flush=True)
    for i in range(len(all_segments) - 1):
        cur_end = all_segments[i]["end"]
        nxt_start = all_segments[i + 1]["start"]
        gap = nxt_start - cur_end

        if gap > 0:
            # RÈGLE DU ZÉRO-GAP LIMITÉ (RESPIRATION) :
            # Si gap <= 1.2s et pas de vrai silence détecté, on raccorde (étire).
            # MAIS si gap > 1.2s, on n'étire SURTOUT PAS le sous-titre précédent : on laisse l'écran vide pour que l'image respire.
            if gap <= 1.2:
                is_silent = has_silence_between(cur_end, nxt_start, silences)
                if not is_silent:
                    all_segments[i]["end"] = nxt_start
        elif gap < 0:
            # Chevauchement anormal : réajuster la fin du segment précédent
            all_segments[i]["end"] = max(all_segments[i]["start"] + 0.3, nxt_start)

    # 1. FILTRE D'OUTRO SILENCE : Élimination des sous-titres fantômes en zone de silence de fin
    tail_silence_start = None
    for s_start, s_end in silences:
        if s_end >= total_duration - 1.0:
            tail_silence_start = s_start
            break

    if tail_silence_start is not None and all_segments:
        # Éliminer tout segment phantom dont le début commence dans ou après le silence terminal
        valid_segs = [s for s in all_segments if s["start"] < tail_silence_start + 0.3]
        if valid_segs:
            all_segments = valid_segs
            all_segments[-1]["end"] = min(all_segments[-1]["end"], tail_silence_start)

    # Clamping strict final contre toute dérive au-delà de la durée totale
    for seg in all_segments:
        seg["start"] = max(0.0, min(seg["start"], total_duration))
        seg["end"] = max(seg["start"] + 0.2, min(seg["end"], total_duration))

    # RÈGLE DU PLAFONNEMENT DE FIN STRICT (ANTI-ÉTALEMENT SUR BRUIT DE FOND & RESPECT FIN DE PAROLE) :
    # Si le dernier segment est court, il ne doit pas s'étaler artificiellement dans le silence ou le bruit.
    if all_segments:
        last_seg = all_segments[-1]
        char_len = len(last_seg.get("text", ""))
        max_last_dur = max(1.8, min(3.8, char_len * 0.08 + 1.2))
        if last_seg["end"] - last_seg["start"] > max_last_dur:
            last_seg["end"] = round(last_seg["start"] + max_last_dur, 2)
        last_seg["end"] = min(total_duration, last_seg["end"])

    # Vérification d'intégrité finale : aucune fin avant début
    for seg in all_segments:
        if seg["end"] <= seg["start"]:
            seg["end"] = min(total_duration, seg["start"] + 1.0)

    # COUCHE DE SÉCURITÉ 1 : Smart Text Splitter (max 4.5s)
    print("[POST-TRAITEMENT] Contrôle de durée maximale (<= 4.5s) et scission intelligente...", flush=True)
    splitted_segments = []
    for seg in all_segments:
        splitted_segments.extend(split_long_segment(seg, max_duration=4.5))
    all_segments = splitted_segments

    # COUCHE DE SÉCURITÉ 2 : Post-Processing Lexical Anti-Hallucinations
    print("[POST-TRAITEMENT] Application du filtre lexical (Search & Replace anti-hallucinations)...", flush=True)
    sanitized_segments = []
    for seg in all_segments:
        seg["text"] = sanitize_translation(seg["text"])
        if seg["text"].strip():
            sanitized_segments.append(seg)
    all_segments = sanitized_segments

    # Filet de sécurité final anti-silence outro
    if all_segments and tail_silence_start is not None:
        all_segments = [s for s in all_segments if s["start"] < tail_silence_start + 0.3]
        if all_segments:
            all_segments[-1]["end"] = min(all_segments[-1]["end"], tail_silence_start)

    if found_cache:
        ai_model_used = "gemini-2.5-flash (Cache)"
    else:
        import gemini_translator
        ai_model_used = getattr(gemini_translator, 'LAST_MODEL_USED', 'gemini-2.5-flash')
        # Sauvegarde du nouveau résultat assaini dans le cache
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_save_file = cache_dir / f"{base_name}_{source_lang}_{mode}.json"
            with open(cache_save_file, "w", encoding="utf-8") as cf:
                json.dump(all_segments, cf, ensure_ascii=False, indent=2)
            print(f"[CACHE BUSTER] 💾 Cache assaini et mis à jour : {cache_save_file.name}", flush=True)
        except Exception as ce:
            print(f"[CACHE WARNING] Échec sauvegarde cache: {ce}", file=sys.stderr)

    print(f"[PROTOCOLE SMART CHUNK SUCCÈS] {len(all_segments)} sous-titres générés via [{ai_model_used}].", flush=True)
    return all_segments, ai_model_used


def build_ass_file(
    segments: list,
    output_ass_path: Path,
    is_video: bool,
    width: int,
    height: int,
    total_duration: float,
    sub_color_hex: str,
    sub_margin_v: int
):
    """Génère le fichier .ASS avec la couleur et la position reçues dynamiquement."""
    ass_primary_color = hex_to_ass_bgr(sub_color_hex)
    print(f"[ASS ENGINE] Couleur convertie: {sub_color_hex} -> {ass_primary_color} | MarginV: {sub_margin_v}")

    # Détermination dynamique de l'alignement et de la marge verticale selon le choix utilisateur
    # sub_margin_v: 150 (Haut), 500 (Milieu), 950 (Bas)
    if sub_margin_v <= 250:
        alignment = 8  # En haut au centre
        margin_v = 100 if (not is_video or height >= width) else 60
    elif sub_margin_v <= 700:
        alignment = 5  # Au milieu exact
        margin_v = 0
    else:
        alignment = 2  # En bas au centre
        margin_v = 140 if (not is_video or height >= width) else 80

    # Adaptation PlayRes et taille de police proportionnelle
    if is_video:
        play_res_x = width
        play_res_y = height
        # Échelle de police proportionnelle à la hauteur (72px pour une base 1920)
        font_size = max(24, int(height * (72 / 1920)))
        margin_lr = max(15, int(width * 0.025))
        if sub_margin_v <= 250:
            alignment = 8
            margin_v = max(20, int(height * 0.05))
        elif sub_margin_v <= 700:
            alignment = 5
            margin_v = 0
        else:
            alignment = 2
            margin_v = max(30, int(height * 0.075))
    else:
        # Audio pur : standard 1080x1920 vertical
        play_res_x = 1080
        play_res_y = 1920
        font_size = 72
        margin_lr = 20
        if sub_margin_v <= 250:
            alignment = 8
            margin_v = 100
        elif sub_margin_v <= 700:
            alignment = 5
            margin_v = 0
        else:
            alignment = 2
            margin_v = 140

    ass_events = []
    for seg in segments:
        start_sec = float(seg["start"])
        end_sec = float(seg["end"])
        t_start = format_ass_time(start_sec)
        t_end = format_ass_time(end_sec)
        clean_text = sanitize_translation(seg["text"].strip())
        text_clean = format_subtitle_blocks(clean_text)
        if text_clean:
            ass_events.append(f"Dialogue: 0,{t_start},{t_end},SubtitleStyle,,0,0,0,,{text_clean}")

    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SubtitleStyle,Impact,{font_size},{ass_primary_color},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,{alignment},{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ass_events)

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    print(f"[ASS SUCCÈS] Fichier généré : {output_ass_path.name}")


def get_ffmpeg_performance_profile() -> dict:
    """
    Ticket 3C : Détermine les paramètres d'encodage optimaux selon l'environnement (Local vs Cloud VPS) :
    - Mode Production / Cloud VPS ('cloud_vps_safe') :
      threads = 2 (ou FFMPEG_MAX_THREADS), preset = 'ultrafast', crf = '24' (mode bridé protecteur anti-crash VPS)
    - Mode Local High-Perf ('local_high_perf') :
      threads = 0 (auto/illimité), preset = 'veryfast', crf = '22'
    """
    python_env = os.getenv("PYTHON_ENV", os.getenv("NODE_ENV", "local")).lower().strip()
    exec_profile = os.getenv("AYA_EXEC_PROFILE", "").lower().strip()
    is_cloud = (python_env == "production") or (exec_profile == "cloud_vps_safe")

    threads = os.getenv("FFMPEG_MAX_THREADS")
    if not threads or threads.strip() == "":
        threads = "2" if is_cloud else "0"

    preset = os.getenv("FFMPEG_PRESET")
    if not preset or preset.strip() == "":
        preset = "ultrafast" if is_cloud else "veryfast"

    crf = os.getenv("FFMPEG_CRF")
    if not crf or crf.strip() == "":
        crf = "24" if is_cloud else "22"

    label = "CLOUD_VPS_SAFE (2-Threads Ultrafast)" if is_cloud else "LOCAL_HIGH_PERF (Illimité Veryfast)"
    return {
        "is_cloud": is_cloud,
        "threads": str(threads),
        "preset": str(preset),
        "crf": str(crf),
        "label": label,
        "env": python_env
    }


def render_video_ffmpeg(media_path: str, ass_path: Path, output_mp4_path: Path, is_video: bool, duration: float, bg_theme: str = 'bg_palestine', has_audio: bool = True):
    """
    Incruste les sous-titres via FFmpeg :
    - SI VIDÉO : Conserve la vidéo originale intacte (aucun fond, aucun recadrage, dimensions d'origine préservées).
    - SI AUDIO PUR : Applique la logique Issue #7 (Fond 9:16 avec thème choisi).
    - DUAL-ENVIRONMENT (Ticket 3C) : Adapte automatiquement le profil d'encodage (-threads, -preset, -crf).
    """
    ff_prof = get_ffmpeg_performance_profile()
    print(f"[FFMPEG CONFIG] ⚙️ Profil d'encodage actif : {ff_prof['label']} (threads: {ff_prof['threads']}, preset: {ff_prof['preset']}, crf: {ff_prof['crf']})", flush=True)

    temp_burn_ass = ass_path.parent / f"_temp_burn_{os.getpid()}.ass"
    shutil.copy2(ass_path, temp_burn_ass)
    escaped_ass = str(temp_burn_ass.resolve()).replace("\\", "/").replace(":", "\\:")

    try:
        if is_video:
            print(f"[FFMPEG] Incrustation sur flux vidéo original ({output_mp4_path.name}) - Thème de fond ({bg_theme}) ignoré, vidéo originale conservée intacte.", flush=True)
            # Sécurisation de la parité des dimensions pour l'encodeur libx264 (évite l'erreur width not divisible by 2)
            vf_filter = f"pad=ceil(iw/2)*2:ceil(ih/2)*2,subtitles='{escaped_ass}'"
            cmd = [
                'ffmpeg', '-y',
                '-threads', ff_prof['threads'],
                '-i', media_path,
                '-vf', vf_filter,
                '-c:v', 'libx264',
                '-preset', ff_prof['preset'],
                '-crf', ff_prof['crf'],
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart'
            ]
            if has_audio:
                cmd.extend(['-c:a', 'aac', '-b:a', '192k'])
            else:
                cmd.extend(['-an'])
            cmd.append(str(output_mp4_path.resolve()))
        else:
            bg_target = BACKGROUND_MAP.get(bg_theme)
            if not bg_target or not bg_target.exists():
                bg_target = BACKGROUND_MAP.get("bg_palestine")
            if not bg_target or not bg_target.exists():
                bg_target = BASE_DIR / "temoignage_gaza_bg.jpg"
            if not bg_target.exists():
                bg_target = DEFAULT_BG

            print(f"[FFMPEG] Audio pur détecté : Génération vidéo 9:16 avec fond : {bg_target.name} (thème: {bg_theme})...", flush=True)
            bg_image = str(bg_target.resolve())
            cmd = [
                'ffmpeg', '-y',
                '-threads', ff_prof['threads'],
                '-loop', '1', '-i', bg_image,
                '-i', media_path,
                '-vf', f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles='{escaped_ass}'",
                '-c:v', 'libx264',
                '-preset', ff_prof['preset'],
                '-tune', 'stillimage',
                '-c:a', 'aac', '-b:a', '192k',
                '-pix_fmt', 'yuv420p',
                '-t', str(duration),
                '-shortest',
                str(output_mp4_path.resolve())
            ]

        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Erreur d'encodage FFmpeg: {res.stderr[-500:]}")

        print(f"[FFMPEG SUCCÈS] Vidéo produite : {output_mp4_path.name} ({output_mp4_path.stat().st_size} octets)")
    finally:
        if temp_burn_ass.exists():
            try:
                temp_burn_ass.unlink()
            except Exception:
                pass


def sanitize_filename_stem(raw_text: str, max_length: int = 50) -> str:
    """
    Assainit un nom de fichier pour éliminer définitivement tout risque de Mojibake :
    1. Supprime les préfixes techniques temporels d'upload (ex: 1789738496806_...)
    2. Dé-diacritise (supprime tous les accents : 'rôle' -> 'role', 'mère' -> 'mere')
    3. Retire les caractères spéciaux : ne conserve STRICTEMENT que l'alphanumérique, espaces et tirets
    4. Tronque proprement à 50 caractères maximum sans couper au milieu d'un mot.
    """
    if not raw_text:
        return "media"

    # 1. Suppression des préfixes techniques d'upload
    text = re.sub(r"^\d{10,}[_-]?", "", raw_text)
    text = re.sub(r"^\d+_", "", text)
    text = re.sub(r"\s*\((?:VOSTFR|VOAR|VOST[A-Z]+|VO[A-Z]+)\)$", "", text, flags=re.IGNORECASE)

    # Détection et correction préventive d'un Mojibake UTF-8 préexistant (ex: 'rÃ´le' -> 'rôle')
    try:
        if "Ã" in text or "Â" in text or "â" in text:
            re_encoded = text.encode('latin-1').decode('utf-8')
            text = re_encoded
    except Exception:
        pass

    # 2. Suppression des accents via décomposition NFKD
    text = unicodedata.normalize('NFKD', text)
    text = "".join(c for c in text if not unicodedata.combining(c))

    # 3. Retirer les caractères spéciaux (ne garder que l'alphanumérique ASCII, espaces et tirets)
    text = re.sub(r'[^a-zA-Z0-9\s\-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    if not text:
        return "media"

    # 4. Tronquage à 50 caractères max sans couper au milieu d'un mot
    if len(text) > max_length:
        truncated = text[:max_length]
        last_space = truncated.rfind(' ')
        if last_space > 15:
            text = truncated[:last_space].strip()
        else:
            text = truncated.strip()

    return text if text else "media"


def generate_clean_output_filenames(media_input: str, source_lang: str, target_lang: str, output_dir: Path = OUTPUT_DIR, title_override: str = None) -> tuple:
    """
    Génère une nomenclature propre, lisible et standardisée sans Mojibake :
    - Vidéo : {clean_base} ({TAG}).mp4
    - Sous-titre : {clean_base} ({TAG}).ass
    Exemple : "Amine la mere d Ihsane (VOSTFR).mp4"
    """
    if title_override:
        clean_base = sanitize_filename_stem(title_override, max_length=50)
    else:
        raw_stem = Path(media_input).stem
        clean_base = sanitize_filename_stem(raw_stem, max_length=50)

    # Suffixe de traduction explicite
    suffix_map = {
        "fr": "VOSTFR",
        "ar": "VOAR",
        "en": "VOSTEN",
        "es": "VOSTES"
    }
    tgt = (target_lang or "fr").lower()
    tag = suffix_map.get(tgt, f"VOST{tgt.upper()}")
    base_title = f"{clean_base} ({tag})"

    # Sécurité anti-doublon : ajout de (1), (2)... si le fichier existe déjà
    candidate = base_title
    counter = 1
    while (output_dir / f"{candidate}.mp4").exists() or (output_dir / f"{candidate}.ass").exists():
        candidate = f"{base_title} ({counter})"
        counter += 1

    return f"{candidate}.mp4", f"{candidate}.ass"


FONT_IMPACT = 'C:/Windows/Fonts/impact.ttf' if os.path.exists('C:/Windows/Fonts/impact.ttf') else 'arial.ttf'
FONT_SEGOE = 'C:/Windows/Fonts/segoeui.ttf' if os.path.exists('C:/Windows/Fonts/segoeui.ttf') else 'arial.ttf'


def _wrap_cover_text(text: str, max_chars_per_line: int = 18) -> list:
    """Découpe un texte en lignes équilibrées sans couper les mots."""
    words = text.strip().split()
    lines = []
    current_line = []
    current_len = 0

    for w in words:
        if current_len + len(w) + (1 if current_line else 0) <= max_chars_per_line:
            current_line.append(w)
            current_len += len(w) + (1 if len(current_line) > 1 else 0)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [w]
            current_len = len(w)

    if current_line:
        lines.append(" ".join(current_line))

    return lines if lines else [text]


def is_raw_or_technical_filename(title: str) -> bool:
    """
    Détecte si un titre est un nom de fichier brut, un timestamp, une date ou un libellé technique.
    Exemples rejetés :
    - 'video 2026-09-19 14-48-23.mp4'
    - '1789774090257_...'
    - 'tg_1789820148396'
    - 'audio_2026-09-17_00-57-44.ogg'
    - 'WhatsApp Audio 2026-08-27 at 12.55.32'
    - 'video.mp4', 'recording_1', etc.
    """
    if not title or not title.strip():
        return True
    t = title.strip().lower()

    # Présence d'extensions multimédias
    if re.search(r'\.(?:mp4|mov|avi|mkv|webm|mp3|wav|ogg|m4a|aac|opus|flac)$', t):
        return True

    # Mots-clés techniques de capture / système
    if re.search(r'\b(?:video|audio|enregistrement|recording|media|upload|file|fichier|screen|whatsapp|telegram|tg)\b', t):
        return True

    # Présence de motifs de dates (ex: 2026-09-19, 2026_09_19, 19-09-2026, 14-48-23)
    if re.search(r'\b\d{4}[-_/]\d{1,2}[-_/]\d{1,2}\b', t) or re.search(r'\b\d{1,2}[-_/]\d{1,2}[-_/]\d{4}\b', t):
        return True
    if re.search(r'\b\d{2}[-_:]\d{2}[-_:]\d{2}\b', t):
        return True

    # Chiffres / timestamps bruts >= 6 chiffres consécutifs
    if re.search(r'\d{6,}', t):
        return True

    return False


def generate_lionel_cover(title_text: str, output_cover_path: Path, target_lang: str = 'fr') -> str:
    """
    Génère la Couverture 9:16 officielle par l'Agent Lionel :
    - Format 1080x1920 (9:16 vertical)
    - Design abstrait géométrique (Zéro branding promotionnel, zéro encart épisode)
    - Palette stricte : Noir (#070B12), Blanc (#FFFFFF), Vert (#007A3D), Rouge (#CE1126)
    - Titre Sémantique principal et séparateur tricolore parfaitement centrés au milieu du rectangle néon
    """
    width, height = 1080, 1920
    img = Image.new('RGB', (width, height), color=(7, 11, 18))
    draw = ImageDraw.Draw(img)

    # 1. Rubans géométriques abstraits aux couleurs de la Palestine
    # Coin supérieur droit : Rouge, Blanc, Vert
    draw.polygon([(650, 0), (1080, 0), (1080, 430), (820, 0)], fill=(206, 17, 38))
    draw.polygon([(820, 0), (1080, 430), (1080, 490), (880, 0)], fill=(255, 255, 255))
    draw.polygon([(880, 0), (1080, 490), (1080, 720), (1010, 0)], fill=(0, 122, 61))

    # Coin inférieur gauche : Vert, Blanc, Rouge
    draw.polygon([(0, 1500), (280, 1920), (0, 1920)], fill=(0, 122, 61))
    draw.polygon([(0, 1440), (40, 1440), (340, 1920), (280, 1920), (0, 1500)], fill=(255, 255, 255))
    draw.polygon([(0, 1240), (210, 1240), (520, 1920), (340, 1920), (0, 1440)], fill=(206, 17, 38))

    # 2. Cadre néon blanc avec coins d'accentuation
    padding = 48
    draw.rectangle([(padding, padding), (width - padding, height - padding)], outline=(255, 255, 255), width=2)
    c_len = 40
    draw.line([(padding, padding), (padding + c_len, padding)], fill=(206, 17, 38), width=6)
    draw.line([(padding, padding), (padding, padding + c_len)], fill=(206, 17, 38), width=6)
    draw.line([(width - padding - c_len, height - padding), (width - padding, height - padding)], fill=(0, 122, 61), width=6)
    draw.line([(width - padding, height - padding - c_len), (width - padding, height - padding)], fill=(0, 122, 61), width=6)

    # 3. Titre Sémantique Centré en Police Impact (Haute Visibilité & Ombre Portée)
    clean_title = title_text.replace('\\N', ' ').replace('\n', ' ')
    clean_title = re.sub(r'\s*\((?:VOSTFR|VOAR|VOST[A-Z]+|VO[A-Z]+)\)$', '', clean_title, flags=re.IGNORECASE)
    clean_title = clean_title.upper().strip()

    title_lines = _wrap_cover_text(clean_title, max_chars_per_line=18)
    if len(title_lines) > 4:
        title_lines = title_lines[:4]
        title_lines[-1] += '...'

    font_size = 86 if len(title_lines) <= 2 else (74 if len(title_lines) <= 3 else 62)
    try:
        font_title = ImageFont.truetype(FONT_IMPACT, font_size)
    except Exception:
        font_title = ImageFont.load_default()

    line_spacing = int(font_size * 1.25)
    sep_offset = int(font_size * 0.75) + 30
    total_block_span = ((len(title_lines) - 1) * line_spacing) + sep_offset

    # Position de départ calculée pour centrer idéalement l'ensemble au milieu du cadre (y = 960)
    start_y = (height // 2) - (total_block_span // 2)

    for i, line in enumerate(title_lines):
        y = start_y + (i * line_spacing)
        # Ombre portée 4px noire
        for ox in (-4, 4):
            for oy in (-4, 4):
                draw.text((width // 2 + ox, y + oy), line, font=font_title, fill=(0, 0, 0), anchor='mm')
        # Texte pur blanc
        draw.text((width // 2, y), line, font=font_title, fill=(255, 255, 255), anchor='mm')

    # 4. Séparateur bicolore (Rouge / Blanc / Vert) centré sous le titre
    sep_y = start_y + total_block_span
    draw.line([(width // 2 - 180, sep_y), (width // 2, sep_y)], fill=(206, 17, 38), width=5)
    draw.line([(width // 2, sep_y), (width // 2 + 180, sep_y)], fill=(0, 122, 61), width=5)
    draw.polygon([
        (width // 2, sep_y - 8),
        (width // 2 + 8, sep_y),
        (width // 2, sep_y + 8),
        (width // 2 - 8, sep_y)
    ], fill=(255, 255, 255))

    output_cover_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_cover_path), quality=95)
    print(f"[AGENT LIONEL] Couverture 9:16 produite : {output_cover_path.name}", flush=True)
    return str(output_cover_path)


def generate_steve_description(title_text: str, segments: list, output_desc_path: Path, target_lang: str = 'fr') -> str:
    """
    Génère la Description TikTok via LLM par l'Agent Steve :
    - Fichier .txt prêt pour TikTok
    - Hook percutant en 1ère ligne
    - Exactement 2 lignes de contexte
    - CTA incisif
    - Hashtags mixtes stratégiques
    """
    clean_title = title_text.replace('\\N', ' ').replace('\n', ' ').strip()
    tag = "VOAR" if target_lang.lower() == 'ar' else "VOSTFR"

    sample_texts = [s.get("text", "") for s in (segments[:8] if segments else [])]
    context_sample = " ".join(sample_texts)[:400]

    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    desc_content = ""

    if gemini_key:
        try:
            prompt = f"""Tu es l'Agent Steve, chef de projet et stratège de rétention TikTok de la Plateforme Aya.
Rédige la description TikTok officielle (.txt) pour cette vidéo :

Titre de la vidéo : {clean_title}
Extrait du témoignage ({tag}) :
"{context_sample}"

STRUCTURE OBLIGATOIRE DU FICHIER .TXT :
Ligne 1 : Un HOOK percutant avec un émoji captivant (ex: 🔥 [Accroche]).
Ligne 2 : [Ligne vide]
Ligne 3-4 : CONTEXTE EN EXACTEMENT 2 LIGNES sincères, fortes et humaines résumant le sujet.
Ligne 5 : [Ligne vide]
Ligne 6 : Un CALL TO ACTION (CTA) incisif invitant au partage et à l'abonnement pour amplifier la voix.
Ligne 7 : [Ligne vide]
Ligne 8 : Une sélection de hashtags mixtes pertinents (ex: #Gaza #Palestine #Témoignage #{tag} #TikTok #UrgenceGaza).

Ne renvoie QUE le texte brut final, sans balises de code markdown (pas de ```txt), sans introduction ni conclusion."""

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1500}
            }

            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                raw_text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                if raw_text:
                    desc_content = raw_text.strip()
        except Exception as e:
            print(f"[AGENT STEVE WARNING] Erreur appel Gemini LLM : {e}, bascule sur modèle heuristique.", file=sys.stderr)

    if not desc_content:
        # Fallback de haute performance rédigé selon les consignes Steve
        desc_content = f"""🔥 {clean_title}

📌 Témoignage exclusif en direct du terrain : un message authentique empreint d'une résilience poignante.
Une réalité brute partagée sans filtre pour que personne ne puisse détourner le regard.

👉 Partagez massivement cette vidéo et abonnez-vous pour faire entendre ces voix indispensables.

#Gaza #Palestine #Témoignage #UrgenceGaza #PourToi"""

    output_desc_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_desc_path, 'w', encoding='utf-8') as f:
        f.write(desc_content.strip() + '\n')

    print(f"[AGENT STEVE] Description TikTok produite : {output_desc_path.name}", flush=True)
    return str(output_desc_path)


def generate_semantic_title(segments: list, target_lang: str = 'fr', user_context: str = "") -> str:
    """
    Génération ÉCLAIR du Titre Sémantique (Nadine - Étape Synchrone).
    Prompt cognitif anti-paresse avec Context Grounding, texte brut (pas de JSON), timeout rapide (10s), cible 15 à 35 caractères.
    """
    clean_fallback = "Témoignage de Palestine" if target_lang.lower() != 'ar' else "شهادة حية من فلسطين"
    if not segments:
        return clean_fallback

    raw_testimony_text = " ".join([s.get("text", "").strip() for s in segments if s.get("text", "").strip()]).strip()
    if not raw_testimony_text:
        return clean_fallback

    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    lang_instruction = "en français" if target_lang.lower() != 'ar' else "en arabe"

    context_directive = ""
    if user_context and user_context.strip():
        context_directive = f"\nIntègre les informations factuelles suivantes pour enrichir ton analyse :\n[CONTEXTE UTILISATEUR : {user_context.strip()}]\n"

    semantic_title = ""
    greeting_pattern = r'^(?:bonjour|salut|merci|comment\s+vas[-\s]?tu|coucou|bienvenue|bonsoir|all[oô]|salam|ahlan|marhaban|lou[ée]\s+soit\s+dieu|au\s+nom\s+de\s+dieu|alhamdulillah|bismillah)\b'

    if gemini_key:
        prompt = f"""Tu es Nadine, directrice éditoriale pour la Plateforme Aya.
Analyse attentivement le témoignage suivant pour en dégager l'essence.
Rédige un titre ultra-court, percutant et humain ({lang_instruction}) pour la couverture de la vidéo.
{context_directive}
CONSIGNES STRICTES ANTI-PARESSE & COGNITIVES :
- IGNORE TOTALEMENT LES SALUTATIONS ET FORMULES DE POLITESSE DU DÉBUT (bonjour, merci, etc.). CONCENTRE-TOI SUR LE DRAME OU L'ACTION.
- Longueur STRICTE : ENTRE 15 ET 35 CARACTÈRES. Évite absolument les phrases à rallonge.
- INTERDICTION ABSOLUE de simplement copier ou résumer la première phrase (ex: invocations ou formules de politesse). Tu dois extraire le SUJET CENTRAL ou l'ACTION de la vidéo.
- Règle n°3 : INTERDICTION de renvoyer uniquement un chiffre ou un seul mot. Le titre doit décrire une situation ou une action complète (Ex: "Le seul survivant de la famille" et NON "100").
- Règle n°4 : Ne rajoute jamais la mention "(VOSTFR)" ou "(VOAR)" dans le texte généré.
- EXEMPLES DE LA DIRECTION :
  * Mauvais titre : '100', 'Maison', 'Bonjour comment vas-tu', 'Loué soit Dieu' ou 'Au nom de Dieu'.
  * Bon titre : 'Face à l'Interrogatoire', 'Le seul survivant de la famille' ou 'Pas un pouce de notre terre'.
- Renvoie UNIQUEMENT le texte brut du titre. AUCUN guillemet, AUCUN JSON, AUCUN préambule, AUCUN point final.
- Interdiction absolue d'inclure des timestamps ou des noms de fichiers techniques.

TÉMOIGNAGE :
\"\"\"
{raw_testimony_text[:2000]}
\"\"\"
TITRE :"""
        PRIMARY_MODEL = os.environ.get("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash")
        FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")
        title_cascade = [
            PRIMARY_MODEL,
            FALLBACK_MODEL,
            "gemini-2.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-flash-latest",
            "gemini-3.5-flash-lite"
        ]
        seen_m = set()
        clean_title_cascade = [m for m in title_cascade if m and not (m in seen_m or seen_m.add(m))]

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 80
            }
        }
        req_data = json.dumps(payload).encode('utf-8')

        for m_name in clean_title_cascade:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_name}:generateContent?key={gemini_key}"
            try:
                req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    raw_text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    if raw_text:
                        cleaned = raw_text.strip().replace('\n', ' ').strip('"\':«» ')
                        cleaned = re.sub(r'^(?:titre\s*:\s*|\*\*|\*|#+)', '', cleaned, flags=re.IGNORECASE).strip('"\':«»* ')
                        cleaned = re.sub(r'\s*\((?:VOSTFR|VOAR)\)', '', cleaned, flags=re.IGNORECASE).strip()
                        words = cleaned.split()
                        is_isolated_digit_or_single_word = bool(
                            len(words) <= 1 or cleaned.isdigit() or re.match(r'^\d+$', cleaned)
                        )
                        is_greeting = bool(re.search(greeting_pattern, cleaned, re.IGNORECASE))
                        if cleaned and not is_raw_or_technical_filename(cleaned) and not is_isolated_digit_or_single_word and not is_greeting:
                            semantic_title = cleaned
                            break
            except Exception as e:
                continue

    # Fallback si absent, invalide/technique ou salutation
    if not semantic_title or is_raw_or_technical_filename(semantic_title) or re.search(greeting_pattern, semantic_title, re.IGNORECASE):
        # Si un contexte utilisateur est fourni, essayer d'en déduire un titre contextuel
        if user_context and len(user_context.strip()) > 5:
            clean_ctx = re.sub(r'[#\*\n]', ' ', user_context).strip()
            first_words = clean_ctx.split()[:4]
            semantic_title = " ".join(first_words)
        else:
            semantic_title = clean_fallback

    # Nettoyage final strict (Règle n°4)
    semantic_title = re.sub(r'\s*\((?:VOSTFR|VOAR)\)', '', semantic_title, flags=re.IGNORECASE).strip()

    # Tronquage propre entre 15 et 35 caractères maximum
    if len(semantic_title) > 35:
        truncated = semantic_title[:33]
        if ' ' in truncated:
            semantic_title = truncated.rsplit(' ', 1)[0]
        else:
            semantic_title = truncated

    return semantic_title.strip()


def _extract_dynamic_hashtags(segments: list, user_context: str = "") -> list:
    """
    Extrait dynamiquement EXACTEMENT 5 hashtags neutres, ciblés et précis basés sur le contenu réel.
    ZÉRO hallucination géographique (#Gaza interdit sauf si mentionné dans le texte ou le user_context).
    """
    tags = []

    # 1. Extraction depuis user_context si l'utilisateur a spécifié des hashtags (#Liban, #Syrie, etc.)
    if user_context:
        ctx_tags = re.findall(r'#(\w+)', user_context)
        for t in ctx_tags:
            tag = f"#{t.capitalize()}"
            if tag not in tags:
                tags.append(tag)

    # 2. Mots-clés géographiques ou thématiques réels mentionnés dans le texte ou user_context
    full_text = " ".join([s.get("text", "") for s in (segments or [])]) + " " + (user_context or "")
    full_text_lower = full_text.lower()

    geo_lexicon = [
        ("gaza", "#Gaza"),
        ("palestine", "#Palestine"),
        ("al-quds", "#Jerusalem"),
        ("jérusalem", "#Jerusalem"),
        ("liban", "#Liban"),
        ("beyrouth", "#Beyrouth"),
        ("syrie", "#Syrie"),
        ("damas", "#Damas"),
        ("yémen", "#Yemen"),
        ("soudan", "#Soudan"),
        ("khartoum", "#Khartoum"),
        ("irak", "#Irak"),
        ("bagdad", "#Bagdad"),
        ("rafah", "#Rafah"),
        ("khan younès", "#KhanYounes"),
        ("jenine", "#Jenine"),
        ("jennin", "#Jenine"),
        ("naplouse", "#Naplouse"),
        ("cisjordanie", "#Cisjordanie"),
        ("ramallah", "#Ramallah"),
    ]
    for key, tag in geo_lexicon:
        if key in full_text_lower and tag not in tags:
            tags.append(tag)
            if len(tags) >= 3:
                break

    # 3. Termes universels dignes pour le journalisme et l'archivage
    universal_pool = ["#Témoignage", "#Mémoire", "#Vérité", "#Direct", "#Archive", "#Histoire", "#PourToi"]
    for ut in universal_pool:
        if ut not in tags:
            tags.append(ut)
        if len(tags) >= 5:
            break

    return tags[:5]


def _generate_dynamic_heuristic_description(segments: list, semantic_title: str = "", user_context: str = "", target_lang: str = 'fr') -> str:
    """
    Générateur Heuristique Dynamique de Secours (Agent Nadine).
    ZÉRO template statique, ZÉRO hallucination géographique.
    Structure 5 paragraphes narratifs détaillés basés sur les extraits réels du .ass et le user_context.
    """
    quotes = []
    if segments:
        valid_segs = [s for s in segments if len(s.get("text", "").strip()) >= 15]
        if valid_segs:
            n = len(valid_segs)
            indices = [0, n // 2, n - 1] if n >= 3 else list(range(n))
            for idx in indices:
                q_text = valid_segs[idx].get("text", "").strip()
                if q_text and q_text not in quotes:
                    quotes.append(q_text)

    quotes_formatted = "\n".join([f"« {q} »" for q in quotes]) if quotes else "« Paroles et faits recueillis sur le vif lors de cet enregistrement. »"
    title_hook = semantic_title.strip() if semantic_title else "Témoignage exclusif du terrain"

    p1 = f"🔥 TÉMOIGNAGE EXCLUSIF : {title_hook.upper()}\nChaque mot prononcé dans cet enregistrement résonne comme une archive vivante de notre époque. À travers cette prise de parole authentique, c'est la réalité sans fard du terrain qui s'exprime, portant la voix de ceux qui vivent et témoignent avec courage au quotidien."

    if user_context and user_context.strip():
        p2 = f"📌 CONTEXTE DU RÉCIT :\nCe document s'inscrit dans un cadre précis : {user_context.strip()}. Les faits et réflexions partagés ici éclairent la situation vécue et permettent de saisir avec justesse la portée des événements rapportés."
    else:
        p2 = f"📌 DÉROULEMENT DU TÉMOIGNAGE :\nL'enregistrement restitue chronologiquement les épreuves, les réflexions et les faits partagés avec sincérité. Au fil des minutes, le récit expose avec dignité la réalité humaine et les défis rencontrés sur le terrain."

    p3 = f"💬 PAROLES FORTES EXTRAITES DU MÉDIA :\n{quotes_formatted}"

    p4 = f"🧠 ANALYSE HUMAINE ET PORTÉE UNIVERSELLE :\nAu-delà du constat immédiat, cette archive vivante rappelle l'importance fondamentale de documenter chaque expérience humaine. Elle constitue un repère essentiel pour la mémoire collective, rappelant que derrière chaque témoignage se trouvent des destins réels qui méritent d'être entendus, respectés et préservés pour l'Histoire."

    p5 = f"👉 TRANSMETTEZ CETTE VOIX :\nNe laissez pas ce récit se perdre dans l'indifférence. Partagez, commentez avec respect et enregistrez cette publication pour préserver et diffuser cette mémoire. Chaque relais compte pour faire entendre la vérité."

    hashtags = _extract_dynamic_hashtags(segments, user_context=user_context)
    hashtags_str = " ".join(hashtags)

    return f"{p1}\n\n{p2}\n\n{p3}\n\n{p4}\n\n{p5}\n\n🏷️ {hashtags_str}".strip()


def generate_tiktok_description(segments: list, semantic_title: str = "", target_lang: str = 'fr', user_context: str = "") -> str:
    """
    Génération Asynchrone de la Smart Description SEO TikTok (Nadine - En tâche de fond pendant FFmpeg).
    Rédige un texte narratif détaillé (~3500 caractères, 5 paragraphes structurés) + 5 hashtags contextuels.
    Cascade de 8 modèles avec retry sur erreur 429 et repli dynamique heuristique anti-hallucination.
    """
    raw_testimony_text = " ".join([s.get("text", "").strip() for s in segments if s.get("text", "").strip()]).strip() if segments else ""
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    lang_instruction = "en français soigné, percutant et humain" if target_lang.lower() != 'ar' else "en arabe soigné, percutant et humain"

    context_directive = ""
    if user_context and user_context.strip():
        context_directive = f"\nIntègre les informations factuelles suivantes pour enrichir ton analyse :\n[CONTEXTE UTILISATEUR : {user_context.strip()}]\n"

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
    seen = set()
    CASCADE = [m for m in MODELS_CASCADE if m and not (m in seen or seen.add(m))]

    context_summary = ""
    if gemini_key and raw_testimony_text:
        title_context = f"Titre sémantique retenu pour la vidéo : \"{semantic_title}\"\n" if semantic_title else ""
        prompt = f"""Tu es Nadine, linguiste, directrice éditoriale et experte en narration et SEO TikTok pour la Plateforme Aya.

MISSION STRICTE & OBLIGATOIRE :
Rédige la Smart Description SEO TikTok ({lang_instruction}) pour ce témoignage vidéo.
{title_context}{context_directive}
CONSIGNES STRICTES ANTI-PARESSE :
- Le texte DOIT être très long et immersif (minimum 400 mots / ~3500 caractères).
- Tu dois OBLIGATOIREMENT structurer ta réponse en 5 longs paragraphes narratifs détaillés et aérés :
  1. 🔥 LE HOOK VIRAL : Une accroche viscérale de 2 à 3 lignes qui capte l'attention et stoppe net le scroll.
  2. 📌 CONTEXTE DÉTAILLÉ DE LA SCÈNE : Raconte la scène avec précision (qui parle, lieu, épreuves du quotidien, déroulement chronologique fidèle aux propos rapportés).
  3. 💬 CITATIONS DIRECTES EXTRAITES DU MÉDIA : Mets en valeur 2 à 4 citations marquantes mot à mot prononcées par la personne entre guillemets.
  4. 🧠 ANALYSE HUMAINE ET PORTÉE UNIVERSELLE : Développe la leçon de résilience, la dignité et pourquoi ce témoignage est vital pour l'Histoire et l'humanité.
  5. 👉 APPEL À L'ACTION ENGAGÉ : Incite la communauté à commenter, partager et enregistrer pour briser le mur du silence.
- À la toute fin du texte, tu DOIS obligatoirement inclure EXACTEMENT 5 hashtags ultra-ciblés, déduits EXCLUSIVEMENT du sujet réel du témoignage et du contexte (ex: #Témoignage #Vérité #Direct #Mémoire #PourToi, ou adaptés au lieu et thème réels). INTERDICTION ABSOLUE d'inventer un lieu géographique non mentionné dans le texte.

RÈGLE FORMELLE DE SORTIE :
Renvoie UNIQUEMENT le texte de la publication rédigée. Pas de JSON, pas de balises markdown ```, pas de préambule.

TRANSCRIPTION COMPLÈTE DU TÉMOIGNAGE :
\"\"\"
{raw_testimony_text[:5500]}
\"\"\"
"""
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2000
            }
        }
        req_data = json.dumps(payload).encode('utf-8')

        for model_name in CASCADE:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=35) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    raw_text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    if raw_text and len(raw_text.strip()) > 150:
                        clean = raw_text.strip()
                        clean = re.sub(r'^```(?:markdown)?\s*', '', clean)
                        clean = re.sub(r'\s*```$', '', clean)
                        context_summary = clean.strip()
                        print(f"[IA NADINE ASYNC] ✅ Smart Description générée avec succès via {model_name} ({len(context_summary)} car.)", flush=True)
                        break
            except urllib.error.HTTPError as he:
                is_quota = (he.code == 429) or any(q in str(he).lower() for q in ["quota", "resource_exhausted", "resourceexhausted"])
                if is_quota:
                    print(f"[IA NADINE ASYNC] ⚠️ Quota 429 atteint sur {model_name}. Pause 2s et bascule sur le modèle suivant...", flush=True)
                    time.sleep(2.0)
                else:
                    print(f"[IA NADINE ASYNC] Erreur HTTP {he.code} sur {model_name}. Bascule modèle suivant...", flush=True)
                continue
            except Exception as e:
                err_s = str(e).lower()
                if any(q in err_s for q in ["429", "quota", "resource_exhausted"]):
                    print(f"[IA NADINE ASYNC] ⚠️ Quota/Rate-limit sur {model_name}. Pause 2s et repli cascade...", flush=True)
                    time.sleep(2.0)
                else:
                    print(f"[IA NADINE ASYNC] Modèle {model_name} indisponible ({e}). Bascule modèle suivant...", flush=True)
                continue

    # Fallback dynamique heuristique si absent ou trop court (ZÉRO template statique Gaza)
    if not context_summary or len(context_summary) < 200:
        print("[IA NADINE ASYNC] 🛡️ Activation du Fallback Heuristique Dynamique (extraction réelle du .ass)...", flush=True)
        context_summary = _generate_dynamic_heuristic_description(
            segments, semantic_title=semantic_title, user_context=user_context, target_lang=target_lang
        )

    # Filet de sécurité hashtags dynamiques si absents
    if '#' not in context_summary:
        dyn_tags = _extract_dynamic_hashtags(segments, user_context=user_context)
        context_summary += f"\n\n🏷️ {' '.join(dyn_tags)}"

    return context_summary.strip()


def generate_semantic_title_and_context(segments: list, media_path: str = None, target_lang: str = 'fr', user_context: str = "") -> tuple:
    """Rétrocompatibilité : appelle successivement generate_semantic_title et generate_tiktok_description."""
    title = generate_semantic_title(segments, target_lang=target_lang, user_context=user_context)
    desc = generate_tiktok_description(segments, semantic_title=title, target_lang=target_lang, user_context=user_context)
    return title, desc


def generate_context_summary(segments: list, media_path: str = None, target_lang: str = 'fr', user_context: str = "") -> str:
    """Rétrocompatibilité : renvoie la description contextuelle."""
    return generate_tiktok_description(segments, semantic_title="", target_lang=target_lang, user_context=user_context)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Argument fichier média manquant."}))
        sys.exit(1)

    raw_input = sys.argv[1]
    # Prise en charge des chemins longs sous Windows (anti-erreur MAX_PATH)
    if os.name == 'nt' and not raw_input.startswith('\\\\?\\') and len(os.path.abspath(raw_input)) >= 240:
        media_input = '\\\\?\\' + os.path.abspath(raw_input)
    else:
        media_input = os.path.abspath(raw_input)

    target_lang = sys.argv[2] if len(sys.argv) > 2 else 'fr'
    sub_color_hex = sys.argv[3] if len(sys.argv) > 3 else '#FFFF00'
    try:
        sub_margin_v = int(sys.argv[4]) if len(sys.argv) > 4 else 950
    except ValueError:
        sub_margin_v = 950
    source_lang = sys.argv[5] if len(sys.argv) > 5 else 'auto'
    force_reprocess = (sys.argv[6].lower() in ('true', '1', 'yes')) if len(sys.argv) > 6 else False
    generate_tiktok_pack = (sys.argv[7].lower() in ('true', '1', 'yes')) if len(sys.argv) > 7 else False
    bg_theme = sys.argv[8] if len(sys.argv) > 8 else 'bg_palestine'
    express_mode = (sys.argv[9].lower() in ('true', '1', 'yes')) if len(sys.argv) > 9 else False

    if not os.path.exists(media_input):
        print(json.dumps({"success": False, "error": f"Fichier introuvable : {media_input}"}))
        sys.exit(1)

    t_global_py_start = time.time()
    try:
        ff_prof = get_ffmpeg_performance_profile()
        record_alexandre_agent("Environment", "execution_profile", time.time(), status="OK", details=ff_prof["label"])
        print(f"[AYA ENVIRONMENT] 🌐 Mode: {ff_prof['env'].upper()} | Profil: {ff_prof['label']} (FFmpeg: threads {ff_prof['threads']}, preset {ff_prof['preset']}, crf {ff_prof['crf']})", flush=True)

        mode_label = "⚡ Mode Express (Texte Uniquement)" if express_mode else "🎬 Vidéo Complète"
        print(f"[PROGRESS] 5% - Initialisation du pipeline de traduction ({mode_label})...", flush=True)

        # 1. Analyse média & Silences réels (Thomas)
        print("[PROGRESS] 12% - Analyse acoustique et cartographie des silences FFmpeg...", flush=True)
        t0_probe = time.time()
        media_info = probe_media(media_input)
        is_video = media_info["is_video"]
        has_audio = media_info.get("has_audio", True)
        duration = media_info["duration"]
        width = media_info["width"]
        height = media_info["height"]

        silences = detect_audio_silences(media_input, noise_threshold="-30dB", min_duration=0.30)
        record_alexandre_agent("Thomas", "thomas_probe_silences", t0_probe, details=f"Durée: {duration:.1f}s, {len(silences)} silences détectés")
        print(f"[PROGRESS] 25% - Structure média validée ({duration:.1f}s, {'vidéo' if is_video else 'audio'}, {len(silences)} silences détectés).", flush=True)

        # Extraction du contexte utilisateur optionnel (CLI --context ou --context_b64)
        user_context = ""
        if '--context_b64' in sys.argv:
            try:
                c_idx = sys.argv.index('--context_b64')
                if c_idx + 1 < len(sys.argv):
                    user_context = base64.b64decode(sys.argv[c_idx + 1]).decode('utf-8').strip()
            except Exception:
                pass
        elif '--context' in sys.argv:
            try:
                c_idx = sys.argv.index('--context')
                if c_idx + 1 < len(sys.argv):
                    user_context = sys.argv[c_idx + 1].strip()
            except Exception:
                pass

        if user_context:
            print(f"[CONTEXT GROUNDING] 🧭 Contexte utilisateur injecté ({len(user_context)} car.) : {user_context[:80]}...", flush=True)

        # 2. Transcription & Traduction par Protocole Scan 5s
        segments, ai_model_used = process_audio_scan_5s(media_input, target_lang, duration, silences, source_lang=source_lang, force_reprocess=force_reprocess, user_context=user_context)

        # 3. Extraction du titre personnalisé éventuel (CLI / Base64)
        custom_title = None
        if '--title_b64' in sys.argv:
            try:
                idx = sys.argv.index('--title_b64')
                if idx + 1 < len(sys.argv):
                    custom_title = base64.b64decode(sys.argv[idx + 1]).decode('utf-8').strip()
            except Exception:
                pass

        is_technical_title = False
        if custom_title:
            is_technical_title = bool(re.search(r'^(?:tg|media|audio|video|upload|file|recording)?[-_\s]*\d{7,}', custom_title, re.IGNORECASE))

        # 4. SÉQUENÇAGE CRITIQUE : Génération ÉCLAIR du Titre Sémantique (Nadine - Synchrone, timeout 10s)
        print("[PROGRESS] 60% - ⚡ Nadine génère le Titre Sémantique Éclair (Max 40 car, synchrone)...", flush=True)
        t0_nadine_titre = time.time()
        semantic_title = generate_semantic_title(segments, target_lang=target_lang, user_context=user_context)

        # PRIORITÉ ABSOLUE AU TITRE SÉMANTIQUE IA SUR LES ARGUMENTS CLI / NOMS DE FICHIERS BRUTS
        clean_fallback = "Témoignage de Palestine" if target_lang.lower() != 'ar' else "شهادة حية من فلسطين"

        greeting_pattern = r'^(?:bonjour|salut|merci|comment\s+vas[-\s]?tu|coucou|bienvenue|bonsoir|all[oô]|salam|ahlan|marhaban|lou[ée]\s+soit\s+dieu|au\s+nom\s+de\s+dieu|alhamdulillah|bismillah)\b'
        if not semantic_title or is_raw_or_technical_filename(semantic_title) or re.search(greeting_pattern, semantic_title, re.IGNORECASE):
            if custom_title and not is_raw_or_technical_filename(custom_title) and not re.search(greeting_pattern, custom_title, re.IGNORECASE) and len(custom_title) > 3:
                semantic_title = custom_title[:40]
            else:
                semantic_title = clean_fallback

        record_alexandre_agent("Nadine", "nadine_titre_semantique", t0_nadine_titre, details=f"'{semantic_title}' ({len(semantic_title)} car.)")
        print(f"[TITRE SÉMANTIQUE IA] ✨ '{semantic_title}' ({len(semantic_title)} car.) [Priorité Absolue IA]", flush=True)

        # Assainissement pour nomenclature des fichiers (.mp4, .ass, .jpg, .txt, .md) basé STRICTEMENT sur le titre sémantique IA
        clean_title_stem = sanitize_filename_stem(semantic_title, max_length=50)
        print(f"[NOMENCLATURE] 🏷️ Stem assaini : '{clean_title_stem}'", flush=True)

        # Production Immédiate de la Couverture 9:16 (Lionel) dès l'obtention du titre sémantique
        cover_filename = None
        cover_path = None
        desc_filename = None
        desc_path = None

        if generate_tiktok_pack:
            cover_filename = f"{clean_title_stem} (Couverture 9-16).jpg"
            cover_path = OUTPUT_DIR / cover_filename
            print("[PROGRESS] 65% - 🎨 Lionel produit immédiatement la Couverture 9:16 avec le Titre Sémantique...", flush=True)
            t0_lionel = time.time()
            try:
                generate_lionel_cover(semantic_title, cover_path, target_lang=target_lang)
                record_alexandre_agent("Lionel", "lionel_couverture_9_16", t0_lionel, details=f"Couverture: {cover_filename}")
                print(f"[COUVERTURE PRÊTE] 🖼️ {cover_filename}", flush=True)
            except Exception as cv_err:
                record_alexandre_agent("Lionel", "lionel_couverture_9_16", t0_lionel, status="WARNING", details=str(cv_err))
                print(f"[LIONEL COUVERTURE WARNING] Erreur : {cv_err}", file=sys.stderr)

            desc_filename = f"{clean_title_stem} (Description TikTok).txt"
            desc_path = OUTPUT_DIR / desc_filename

        # Lancement Asynchrone de la Smart Description TikTok en tâche de fond (Thread parallèle pendant FFmpeg)
        async_desc_result = {"text": ""}

        def _async_desc_worker():
            try:
                print("[ASYNC THREAD] 📝 Nadine rédige la Smart Description TikTok en arrière-plan...", flush=True)
                t0_desc = time.time()
                d_text = generate_tiktok_description(segments, semantic_title=semantic_title, target_lang=target_lang, user_context=user_context)
                record_alexandre_agent("Nadine", "nadine_description_tiktok_async", t0_desc, details=f"{len(d_text)} car.")
                async_desc_result["text"] = d_text
                if desc_path:
                    with open(desc_path, 'w', encoding='utf-8') as df:
                        df.write(d_text.strip() + '\n')
                    print(f"[ASYNC THREAD SUCCÈS] 📝 Description écrite dans {desc_path.name}", flush=True)
            except Exception as e_desc:
                record_alexandre_agent("Nadine", "nadine_description_tiktok_async", time.time(), status="WARNING", details=str(e_desc))
                print(f"[ASYNC THREAD WARNING] Erreur description : {e_desc}", file=sys.stderr)

        desc_thread = threading.Thread(target=_async_desc_worker, daemon=True)
        desc_thread.start()

        # ⚡ COURT-CIRCUIT MODE EXPRESS (MODULE 2 : TEXTE MARKDOWN EN < 5S)
        if express_mode:
            print("[PROGRESS] 85% - Formatage Markdown structuré du texte traduit (Mode Express)...", flush=True)
            full_text = " ".join([s.get("text", "").strip() for s in segments if s.get("text", "").strip()])

            # Nom du fichier Markdown téléchargeable
            md_filename = f"{clean_title_stem} (Traduction Texte).md"
            md_path = OUTPUT_DIR / md_filename

            md_lines = [
                f"# 📄 {semantic_title}",
                "",
                f"> **Source :** {'Arabe (Gaza)' if source_lang == 'ar' else ('Français' if source_lang == 'fr' else 'Détection Auto')} | **Cible :** {'Arabe VOAR' if target_lang == 'ar' else 'Français VOSTFR'} | **Modèle :** {ai_model_used}",
                "",
                "---",
                "",
                "### 📝 Traduction Complète",
                "",
                f"{full_text}",
                "",
                "---",
                "",
                "### ⏱️ Découpage Horodaté des Répliques",
                ""
            ]

            for s in segments:
                st = format_ass_time(float(s.get("start", 0.0)))
                et = format_ass_time(float(s.get("end", 0.0)))
                txt = s.get("text", "").strip()
                md_lines.append(f"- **[{st} ➔ {et}]** : {txt}")

            md_lines.append("")
            md_lines.append("---")
            md_lines.append("*Généré instantanément par le Module 2 de la Plateforme Aya (Protocole V3 - Zéro FFmpeg).*")

            md_content = "\n".join(md_lines)
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(md_content)

            print(f"[PROGRESS] 100% - Traduction Express prête en Markdown ({len(segments)} segments) !", flush=True)

            context_summary = async_desc_result.get("text") or "Témoignage vidéo et transcription réalisés sur la Plateforme Aya."

            record_alexandre_agent("Pipeline", "total_python_pipeline", t_global_py_start, status="OK", details=f"Durée totale Python Express: {round(time.time() - t_global_py_start, 2)}s")

            response = {
                "success": True,
                "express_mode": True,
                "media_type": "audio" if not is_video else "video",
                "ai_model_used": ai_model_used,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "semantic_title": semantic_title,
                "clean_title": semantic_title,
                "duration": round(duration, 2),
                "context_summary": context_summary,
                "clean_text": full_text,
                "markdown_text": md_content,
                "markdown_filename": md_filename,
                "markdown_url": f"/download/{md_filename}",
                "segments_count": len(segments),
                "segments": segments,
                "silences_count": len(silences),
                "telemetry": ALEXANDRE_TELEMETRY
            }
            print("\n---JSON_OUTPUT_START---", flush=True)
            print(json.dumps(response, ensure_ascii=False, indent=2), flush=True)
            print("---JSON_OUTPUT_END---", flush=True)
            return

        # 5. Noms des fichiers de sortie normalisés (Max) basés sur le Titre Sémantique
        print("[PROGRESS] 70% - Renommage et application de la règle Zéro Gap (Max)...", flush=True)
        mp4_filename, ass_filename = generate_clean_output_filenames(
            media_input, source_lang, target_lang, title_override=clean_title_stem
        )

        ass_path = OUTPUT_DIR / ass_filename
        mp4_path = OUTPUT_DIR / mp4_filename

        # 6. Génération du fichier .ASS (Lionel / Thomas)
        print("[PROGRESS] 75% - Génération et stylisation des sous-titres .ASS...", flush=True)
        t0_ass = time.time()
        build_ass_file(segments, ass_path, is_video, width, height, duration, sub_color_hex, sub_margin_v)
        record_alexandre_agent("Lionel", "lionel_ass_styling", t0_ass, details=f"Fichier: {ass_filename}")

        # 7. Incrustation vidéo FFmpeg (Thomas - S'exécute en parallèle de la rédaction de Nadine en arrière-plan)
        print("[PROGRESS] 80% - Encodage et incrustation vidéo FFmpeg en cours (en parallèle du thread IA)...", flush=True)
        t0_ffmpeg = time.time()
        render_video_ffmpeg(media_input, ass_path, mp4_path, is_video, duration, bg_theme=bg_theme, has_audio=has_audio)
        record_alexandre_agent("Thomas", "thomas_ffmpeg_encode", t0_ffmpeg, details=f"Encodage final: {mp4_filename}")

        # 8. Synchronisation de la Smart Description Asynchrone
        if desc_thread.is_alive():
            print("[PROGRESS] 97% - Synchronisation de la Smart Description TikTok...", flush=True)
            desc_thread.join(timeout=25)

        context_summary = async_desc_result.get("text", "")
        if not context_summary:
            context_summary = generate_tiktok_description(segments, semantic_title=semantic_title, target_lang=target_lang, user_context=user_context)

        if desc_path and not desc_path.exists():
            with open(desc_path, 'w', encoding='utf-8') as df:
                df.write(context_summary.strip() + '\n')
            print(f"[PACK TIKTOK SUCCÈS] Assets générés : {cover_filename} | {desc_filename}", flush=True)

        print("[PROGRESS] 100% - Vidéo sous-titrée et pack finalisés avec succès !", flush=True)

        record_alexandre_agent("Pipeline", "total_python_pipeline", t_global_py_start, status="OK", details=f"Durée totale Python: {round(time.time() - t_global_py_start, 2)}s")

        # 9. Réponse finale JSON
        response = {
            "success": True,
            "media_type": "video" if is_video else "audio",
            "ai_model_used": ai_model_used,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "semantic_title": semantic_title,
            "clean_title": semantic_title,
            "sub_color": sub_color_hex,
            "sub_position": sub_margin_v,
            "duration": round(duration, 2),
            "context_summary": context_summary,
            "mp4_filename": mp4_filename,
            "mp4_url": f"/download/{mp4_filename}",
            "ass_filename": ass_filename,
            "ass_url": f"/download/{ass_filename}",
            "generate_tiktok_pack": generate_tiktok_pack,
            "bg_theme": bg_theme if not is_video else None,
            "cover_filename": cover_filename,
            "cover_url": f"/download/{cover_filename}" if cover_filename else None,
            "desc_filename": desc_filename,
            "desc_url": f"/download/{desc_filename}" if desc_filename else None,
            "segments_count": len(segments),
            "silences_count": len(silences),
            "execution_profile": ff_prof["label"],
            "telemetry": ALEXANDRE_TELEMETRY
        }
        print("\n---JSON_OUTPUT_START---", flush=True)
        print(json.dumps(response, ensure_ascii=False, indent=2), flush=True)
        print("---JSON_OUTPUT_END---", flush=True)

    except Exception as e:
        raw_msg = str(e)
        code = "PROCESSING_ERROR"
        if "MEDIA_TOO_BIG" in raw_msg:
            code = "MEDIA_TOO_BIG"
            err_msg = "Le fichier Telegram est trop lourd (>20Mo) ou protégé. Veuillez le télécharger manuellement et l'uploader via la zone de dépôt."
        elif any(k in raw_msg.lower() for k in ["429", "resource_exhausted", "resourceexhausted", "quota", "surchargés", "overloaded", "exhausted"]):
            code = "AI_QUOTA_EXCEEDED"
            err_msg = "Les serveurs IA sont temporairement surchargés. Veuillez réessayer dans quelques minutes."
        elif any(k in raw_msg.lower() for k in ["ffprobe", "invalide", "corrompu", "aucun flux"]):
            code = "INVALID_MEDIA"
            err_msg = "Le fichier média est corrompu, vide ou dans un format non reconnu."
        else:
            err_msg = "Une anomalie s'est produite lors de la génération des sous-titres."

        err_res = {
            "success": False,
            "code": code,
            "message": err_msg,
            "error": err_msg
        }
        print("\n---JSON_OUTPUT_START---", flush=True)
        print(json.dumps(err_res, ensure_ascii=False, indent=2), flush=True)
        print("---JSON_OUTPUT_END---", flush=True)
        sys.exit(1)

    finally:
        # Nettoyage du Cache / Garbage Collection (Max) : Purge systématique des artefacts temporaires
        try:
            temp_dir = BASE_DIR / "temp_chunks"
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)

            # Purge des résidus audio .wav ou _temp.wav dans le répertoire de travail
            target_dirs = [BASE_DIR / "audio_a_traiter"]
            if 'media_input' in locals() and media_input:
                target_dirs.append(Path(media_input).parent)

            for d in target_dirs:
                if d.exists() and d.is_dir():
                    for f in d.glob("*.wav"):
                        if f.name.endswith("_temp.wav") or f.name.startswith("temp_"):
                            try:
                                f.unlink()
                                print(f"[GARBAGE COLLECTION] 🗑️ Résidu audio supprimé : {f.name}", flush=True)
                            except Exception:
                                pass
        except Exception:
            pass


if __name__ == "__main__":
    main()
