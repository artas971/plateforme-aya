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

    # Division de la durée en deux parts égales
    split_time = round(start + (dur / 2.0), 2)
    split_time = max(start + 0.3, min(split_time, end - 0.3))

    part1_text = " ".join(words[:best_split]).strip()
    part2_text = " ".join(words[best_split:]).strip()

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

    # Nettoyage des espaces résiduels
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def find_smart_cut_point(w_start: float, total_duration: float, silences: list, min_chunk: float = 20.0, max_chunk: float = 35.0, default_chunk: float = 30.0) -> float:
    """
    Découpage adaptatif (Smart Chunking) :
    Recherche le dernier vrai silence situé entre (w_start + 20s) et (w_start + 35s).
    Si trouvé, définit la fin de la fenêtre au milieu de ce silence pour ne jamais couper un mot.
    Sinon, bascule sur un découpage standard à default_chunk (30s).
    """
    remaining = total_duration - w_start
    if remaining <= max_chunk:
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
        # Le dernier vrai silence situé dans la plage éligible
        last_s = candidate_silences[-1]
        cut_point = (last_s[0] + last_s[1]) / 2.0
        cut_point = max(search_start, min(cut_point, search_end))
        return round(cut_point, 2)

    # Fallback si aucun silence détecté
    return round(min(total_duration, w_start + default_chunk), 2)


def transcribe_window(chunk_path: str, mode: str, window_offset: float, window_dur: float, source_lang: str = 'auto', force_reprocess: bool = False) -> list:
    """
    Appelle l'IA pour transcrire/traduire une fenêtre délimitée sur les silences.
    Applique un CLAMPING STRICT (min/max) pour empêcher toute dérive temporelle ou débordement.
    """
    from gemini_translator import gemini_audio_transcribe_and_translate
    raw_segments = gemini_audio_transcribe_and_translate(chunk_path, mode=mode, total_duration=window_dur, source_lang=source_lang, force_reprocess=force_reprocess)
    
    if not raw_segments or len(raw_segments) == 0:
        return []

    window_segments = []
    for seg in raw_segments:
        raw_start = float(seg.get("start", 0.0))
        raw_end = float(seg.get("end", raw_start + 2.0))
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


def process_audio_scan_5s(media_path: str, target_lang: str, total_duration: float, silences: list, source_lang: str = 'auto', force_reprocess: bool = False) -> tuple:
    """
    Protocole Scan 5s Anti-Résumé & Smart Chunking sur Silences :
    Découpe dynamique sur les silences réels (20s à 35s),
    clamping strict anti-dérive et raccord Zéro Gap conditionné aux silences.
    Option Bypass Cache (force_reprocess) pour réanalyse complète et assainissement du cache.
    """
    mode = 'VOAR' if target_lang.lower() == 'ar' else 'VOSTFR'
    print(f"[PROGRESS] 40% - Analyse IA de l'audio ({total_duration:.1f}s) en mode {mode} (source: {source_lang})...", flush=True)

    cache_dir = BASE_DIR / "cache_transcriptions"
    base_name = Path(media_path).stem[:50]
    raw_stem = re.sub(r"^\d+_", "", base_name)
    found_cache = False
    all_segments = []

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
                                    print(f"[PROTOCOLE SMART CHUNK] ⚡ Cache global détecté ({fname}) : {len(cached_segs)} segments déjà transcrits.", flush=True)
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
                        except Exception:
                            pass

    if not found_cache:
        # Si le fichier est court (<= 35s), analyse directe
        if total_duration <= 35.0:
            from gemini_translator import gemini_audio_transcribe_and_translate
            raw_segs = gemini_audio_transcribe_and_translate(media_path, mode=mode, total_duration=total_duration, source_lang=source_lang, force_reprocess=force_reprocess)
            if not raw_segs:
                openai_key = os.environ.get("OPENAI_API_KEY")
                if openai_key:
                    from run_studio_v3_full_pipeline import transcribe_via_openai_api
                    raw_segs = transcribe_via_openai_api(media_path, openai_key, mode=mode)

            for s in (raw_segs or []):
                s_start = max(0.0, min(float(s.get("start", 0)), total_duration))
                s_end = max(s_start + 0.2, min(float(s.get("end", s_start + 2.0)), total_duration))
                txt = s.get("text", "").strip()
                if txt:
                    all_segments.append({
                        "start": round(s_start, 2),
                        "end": round(s_end, 2),
                        "text": txt
                    })

            print("[PROGRESS] 70% - Transcription directe terminée.", flush=True)

        else:
            # Long fichier : Smart Chunking adaptatif basé sur les silences réels (20s à 35s)
            temp_dir = BASE_DIR / "temp_chunks"
            temp_dir.mkdir(parents=True, exist_ok=True)

            windows_plan = []
            cursor = 0.0
            while cursor < total_duration:
                next_cut = find_smart_cut_point(cursor, total_duration, silences, min_chunk=20.0, max_chunk=35.0, default_chunk=30.0)
                if next_cut <= cursor:
                    next_cut = min(total_duration, cursor + 30.0)
                windows_plan.append((cursor, next_cut))
                cursor = next_cut

            total_windows = len(windows_plan)
            print(f"[SMART CHUNKING] {total_windows} fenêtre(s) adaptative(s) planifiée(s) sur les silences réels (20s-35s).", flush=True)

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
                    w_segs = transcribe_window(str(chunk_file.resolve()), mode, w_start, w_dur, source_lang=source_lang, force_reprocess=force_reprocess)
                    all_segments.extend(w_segs)
                finally:
                    if chunk_file.exists():
                        try: chunk_file.unlink()
                        except Exception: pass

            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)

            print("[PROGRESS] 70% - Toutes les fenêtres ont été transcrites avec succès.", flush=True)

    if not all_segments:
        raise RuntimeError("Les serveurs IA sont temporairement surchargés. Veuillez réessayer dans quelques minutes.")

    # Tri chronologique absolu
    all_segments.sort(key=lambda x: x["start"])

    # RÈGLE ZÉRO GAP AVEC DÉTECTION DES SILENCES RÉELS & ANTI-CHEVAUCHEMENT
    print("[POST-TRAITEMENT] Application de la règle Zéro Gap conditionnée aux silences...", flush=True)
    for i in range(len(all_segments) - 1):
        cur_end = all_segments[i]["end"]
        nxt_start = all_segments[i + 1]["start"]
        gap = nxt_start - cur_end

        if gap > 0:
            # Vérifier si un silence réel (> 0.3s) existe dans ce trou
            is_silent = has_silence_between(cur_end, nxt_start, silences)
            if not is_silent:
                # Pas de silence : La personne parle ou enchaîne -> ZÉRO GAP !
                all_segments[i]["end"] = nxt_start
        elif gap < 0:
            # Chevauchement anormal : réajuster la fin du segment précédent
            all_segments[i]["end"] = max(all_segments[i]["start"] + 0.3, nxt_start)

    # Clamping strict final contre toute dérive au-delà de la durée totale
    for seg in all_segments:
        seg["start"] = max(0.0, min(seg["start"], total_duration))
        seg["end"] = max(seg["start"] + 0.2, min(seg["end"], total_duration))

    # Alignement du dernier segment sur la durée totale si la parole va jusqu'au bout
    last_end = all_segments[-1]["end"]
    if not has_silence_between(last_end, total_duration, silences):
        all_segments[-1]["end"] = total_duration
    all_segments[-1]["end"] = max(all_segments[-1]["start"] + 0.2, min(all_segments[-1]["end"], total_duration))

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


def render_video_ffmpeg(media_path: str, ass_path: Path, output_mp4_path: Path, is_video: bool, duration: float, bg_theme: str = 'bg_palestine', has_audio: bool = True):
    """
    Incruste les sous-titres via FFmpeg :
    - SI VIDÉO : Conserve la vidéo originale intacte (aucun fond, aucun recadrage, dimensions d'origine préservées).
    - SI AUDIO PUR : Applique la logique Issue #7 (Fond 9:16 avec thème choisi).
    """
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
                '-i', media_path,
                '-vf', vf_filter,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
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
                '-threads', '0',
                '-loop', '1', '-i', bg_image,
                '-i', media_path,
                '-vf', f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles='{escaped_ass}'",
                '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage',
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


def generate_lionel_cover(title_text: str, output_cover_path: Path, episode_num: int = 1, target_lang: str = 'fr') -> str:
    """
    Génère la Couverture 9:16 officielle par l'Agent Lionel :
    - Format 1080x1920 (9:16 vertical)
    - Design abstrait géométrique (Zéro humain)
    - Palette stricte : Noir (#070B12), Blanc (#FFFFFF), Vert (#007A3D), Rouge (#CE1126)
    - Titre et n° d'épisode centrés en police Impact
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

    # 3. En-tête : Badge Officiel AYA STUDIO
    try:
        font_badge = ImageFont.truetype(FONT_SEGOE, 28)
    except Exception:
        font_badge = ImageFont.load_default()

    draw.text((width // 2, 220), "AYA STUDIO • PALESTINIAN ECHO", font=font_badge, fill=(255, 255, 255), anchor='mm')
    draw.line([(width // 2 - 160, 250), (width // 2 + 160, 250)], fill=(206, 17, 38), width=3)

    # 4. Numéro d'épisode centré en police Impact
    try:
        font_ep_num = ImageFont.truetype(FONT_IMPACT, 120)
        font_ep_label = ImageFont.truetype(FONT_IMPACT, 42)
    except Exception:
        font_ep_num = ImageFont.load_default()
        font_ep_label = ImageFont.load_default()

    ep_label_text = "ÉPISODE" if target_lang != 'ar' else "الحلقة"
    ep_num_text = f"#{episode_num}"

    box_w, box_h = 320, 150
    box_x1 = (width - box_w) // 2
    box_y1 = 580
    box_x2 = box_x1 + box_w
    box_y2 = box_y1 + box_h

    draw.rectangle([(box_x1, box_y1), (box_x2, box_y2)], fill=(15, 23, 42), outline=(0, 122, 61), width=3)
    draw.text((width // 2, box_y1 + 35), ep_label_text, font=font_ep_label, fill=(206, 17, 38), anchor='mm')
    draw.text((width // 2, box_y1 + 95), ep_num_text, font=font_ep_num, fill=(255, 255, 255), anchor='mm')

    # 5. Titre Centré en Police Impact (Haute Visibilité & Ombre Portée)
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
    total_text_h = len(title_lines) * line_spacing
    start_y = 1040 - (total_text_h // 2)

    for i, line in enumerate(title_lines):
        y = start_y + (i * line_spacing)
        # Ombre portée 4px noire
        for ox in (-4, 4):
            for oy in (-4, 4):
                draw.text((width // 2 + ox, y + oy), line, font=font_title, fill=(0, 0, 0), anchor='mm')
        # Texte pur blanc
        draw.text((width // 2, y), line, font=font_title, fill=(255, 255, 255), anchor='mm')

    # 6. Séparateur bicolore (Rouge / Blanc / Vert)
    sep_y = start_y + total_text_h + 40
    draw.line([(width // 2 - 180, sep_y), (width // 2, sep_y)], fill=(206, 17, 38), width=5)
    draw.line([(width // 2, sep_y), (width // 2 + 180, sep_y)], fill=(0, 122, 61), width=5)
    draw.polygon([
        (width // 2, sep_y - 8),
        (width // 2 + 8, sep_y),
        (width // 2, sep_y + 8),
        (width // 2 - 8, sep_y)
    ], fill=(255, 255, 255))

    # 7. Pied d'affiche & Badge VOSTFR / VOAR
    tag = "VOAR" if target_lang.lower() == 'ar' else "VOSTFR"
    try:
        font_foot = ImageFont.truetype(FONT_SEGOE, 30)
        font_tag = ImageFont.truetype(FONT_IMPACT, 34)
    except Exception:
        font_foot = ImageFont.load_default()
        font_tag = ImageFont.load_default()

    draw.text((width // 2, 1700), "DOCUMENT & TÉMOIGNAGE EXCLUSIF", font=font_foot, fill=(156, 163, 175), anchor='mm')
    tag_box_w, tag_box_h = 160, 48
    draw.rounded_rectangle(
        [(width // 2 - tag_box_w // 2, 1740), (width // 2 + tag_box_w // 2, 1740 + tag_box_h)],
        radius=8,
        fill=(206, 17, 38) if tag == 'VOSTFR' else (0, 122, 61)
    )
    draw.text((width // 2, 1740 + tag_box_h // 2), tag, font=font_tag, fill=(255, 255, 255), anchor='mm')

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
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 500}
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

#Gaza #Palestine #Témoignage #UrgenceGaza #AyaStudio #TikTok #PourToi #{tag}"""

    output_desc_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_desc_path, 'w', encoding='utf-8') as f:
        f.write(desc_content.strip() + '\n')

    print(f"[AGENT STEVE] Description TikTok produite : {output_desc_path.name}", flush=True)
    return str(output_desc_path)


def generate_semantic_title_and_context(segments: list, media_path: str = None, target_lang: str = 'fr') -> tuple:
    """
    Génère conjointement :
    1. semantic_title : Un titre ultra-court, accrocheur et percutant (Max 40 caractères), résumant la vidéo.
    2. context_summary : La description SEO TikTok détaillée (~3500 caractères).
    Consigne stricte (Nadine - Ticket Séquençage du Titre Sémantique) :
    "L'IA ne doit plus renvoyer uniquement la description longue, mais un objet JSON structuré contenant deux éléments :
    semantic_title et context_summary."
    """
    if not segments:
        return "Témoignage de Palestine", "Témoignage vidéo et transcription réalisés sur la Plateforme Aya."

    raw_testimony_text = " ".join([s.get("text", "").strip() for s in segments if s.get("text", "").strip()]).strip()
    if not raw_testimony_text:
        return "Témoignage de Palestine", "Témoignage vidéo et transcription réalisés sur la Plateforme Aya."

    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    lang_instruction = "en français soigné, percutant et humain" if target_lang.lower() != 'ar' else "en arabe soigné, percutant et humain"

    semantic_title = ""
    context_summary = ""

    if gemini_key:
        try:
            prompt = f"""Tu es Nadine, linguiste, directrice éditoriale et experte en narration et SEO TikTok pour la Plateforme Aya.

MISSION STRICTE & OBLIGATOIRE :
En te basant EXCLUSIVEMENT sur la transcription ci-jointe, analyse ce témoignage et renvoie un JSON STRICT composé exactement de deux clés : "semantic_title" et "context_summary".

1. "semantic_title" : Un titre ultra-court, accrocheur et percutant ({lang_instruction}), résumant fidèlement la scène ou le message central du média.
   - Longueur STRICTE : MAXIMUM 40 CARACTÈRES.
   - Exemples de titres attendus :
     * "L'Appel d'une Mère à Gaza"
     * "Dignité Face aux Ruines"
     * "Pénurie d'Eau à Rafah"
     * "Le Courage d'Enseigner"
   - RÈGLES FORMELLES :
     * Interdiction absolue d'inclure des noms de fichiers techniques, des timestamps ou des chiffres bruts (pas de "tg_...", pas de chiffres bruts).
     * Aucune formule générique superflue ("Vidéo de...", "Témoignage sur...", "Extrait...").
     * Direct, captivant, humain et percutant.

2. "context_summary" : Le texte de publication SEO TikTok ({lang_instruction}).
   - CONSIGNES STRICTES ANTI-PARESSE :
     * Le 'context_summary' DOIT être un texte très long (minimum 400 mots / ~3500 caractères).
     * Tu dois OBLIGATOIREMENT structurer ta réponse en 5 longs paragraphes narratifs détaillés et aérés :
       1. 🔥 LE HOOK VIRAL : Une accroche viscérale de 2 à 3 lignes qui capte l'attention et stoppe net le scroll.
       2. 📌 CONTEXTE DÉTAILLÉ DE LA SCÈNE : Raconte la scène avec précision (qui parle, lieu, épreuves du quotidien, déroulement chronologique fidèle aux propos rapportés).
       3. 💬 CITATIONS DIRECTES EXTRAITES DU MÉDIA : Mets en valeur 2 à 4 citations marquantes mot à mot prononcées par la personne entre guillemets.
       4. 🧠 ANALYSE HUMAINE ET PORTÉE UNIVERSELLE : Développe la leçon de résilience, la dignité et pourquoi ce témoignage est vital pour l'Histoire et l'humanité.
       5. 👉 APPEL À L'ACTION ENGAGÉ : Incite la communauté à commenter, partager et enregistrer pour briser le mur du silence.
     * À la toute fin du texte, tu DOIS obligatoirement inclure un bloc de 15 à 30 hashtags ultra-ciblés (ex: #Gaza #Palestine #Solidarité #Témoignage #Résilience #Justice #AyaStudio #TikTokNews #PourToi #FYP).

RÈGLE ABSOLUE DE SORTIE :
Renvoie UNIQUEMENT l'objet JSON valide pur, sans aucun préambule, sans texte avant ou après, et sans balises Markdown (pas de ```json, pas de ```).
{{
  "semantic_title": "Titre percutant (max 40 car)",
  "context_summary": "Texte très long de 5 longs paragraphes détaillés (min 400 mots) suivi du bloc de 15 à 30 hashtags..."
}}

TRANSCRIPTION COMPLÈTE DU TÉMOIGNAGE :
\"\"\"
{raw_testimony_text[:5500]}
\"\"\"
"""
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 3000,
                    "responseMimeType": "application/json"
                }
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                raw_text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')

                if raw_text and len(raw_text.strip()) > 30:
                    clean_raw = raw_text.strip()
                    clean_raw = re.sub(r'^```(?:json)?\s*', '', clean_raw)
                    clean_raw = re.sub(r'\s*```$', '', clean_raw)

                    parsed = None
                    try:
                        parsed = json.loads(clean_raw)
                    except Exception:
                        json_match = re.search(r'(\{[\s\S]*\})', clean_raw)
                        if json_match:
                            try:
                                parsed = json.loads(json_match.group(1))
                            except Exception:
                                pass

                    if isinstance(parsed, dict):
                        semantic_title = str(parsed.get("semantic_title", "")).strip()
                        context_summary = str(parsed.get("context_summary", "")).strip()

                    # Élimination stricte de toute fuite de syntaxe JSON dans context_summary
                    if '"semantic_title":' in context_summary or context_summary.startswith('{'):
                        try:
                            sub_json = json.loads(context_summary)
                            if isinstance(sub_json, dict):
                                context_summary = str(sub_json.get("context_summary", context_summary)).strip()
                                if not semantic_title:
                                    semantic_title = str(sub_json.get("semantic_title", "")).strip()
                        except Exception:
                            context_summary = re.sub(r'^\s*\{\s*"semantic_title"\s*:\s*"[^"]*",\s*"context_summary"\s*:\s*"?', '', context_summary)
                            context_summary = re.sub(r'"?\s*\}\s*$', '', context_summary)

                    # Nettoyage des guillemets d'englobement et échappements résiduels
                    context_summary = context_summary.strip('"\n\r\t ')
                    if '\\n' in context_summary and '\n' not in context_summary:
                        context_summary = context_summary.replace('\\n', '\n')
                    if '\\"' in context_summary:
                        context_summary = context_summary.replace('\\"', '"')

                    semantic_title = semantic_title.strip('"\n\r\t ')
                    if '\\"' in semantic_title:
                        semantic_title = semantic_title.replace('\\"', '"')

                    if not semantic_title:
                        m_title = re.search(r'"semantic_title"\s*:\s*"([^"]+)"', raw_text)
                        if m_title:
                            semantic_title = m_title.group(1).strip()

                    if not context_summary:
                        m_desc = re.search(r'"context_summary"\s*:\s*"([\s\S]+?)"\s*\}?\s*$', raw_text)
                        if m_desc:
                            context_summary = m_desc.group(1).strip()

                    if semantic_title and context_summary:
                        print(f"[IA NADINE] ✅ Titre Sémantique ('{semantic_title}') & Smart Description ({len(context_summary)} car.) générés via JSON Mode !", flush=True)

        except Exception as e:
            print(f"[IA NADINE WARNING] Erreur appel Gemini LLM : {e}, bascule sur modèle heuristique.", file=sys.stderr)

    # Fallback si titre sémantique non extrait
    if not semantic_title:
        first_words = [w for w in raw_testimony_text.split() if len(w) > 2][:5]
        if first_words:
            semantic_title = " ".join(first_words).capitalize()
        else:
            semantic_title = "Témoignage de Palestine" if target_lang != 'ar' else "شهادة حية من فلسطين"

    # Tronquage propre à 40 caractères maximum
    if len(semantic_title) > 40:
        truncated = semantic_title[:38]
        if ' ' in truncated:
            semantic_title = truncated.rsplit(' ', 1)[0]
        else:
            semantic_title = truncated

    # Fallback pour la description si absente ou trop courte
    if not context_summary or len(context_summary) < 200:
        quotes = [s.get("text", "").strip() for s in segments if len(s.get("text", "").strip()) > 15][:4]
        quotes_formatted = "\n".join([f"« {q} »" for q in quotes]) if quotes else f"« {raw_testimony_text[:120]}... »"

        context_summary = f"""🔥 TÉMOIGNAGE EXCLUSIF DU TERRAIN : UNE RÉALITÉ BRUTE SANS FILTRE

📌 CONTEXTE DE CE TÉMOIGNAGE DIRECT
Chaque mot prononcé dans cet enregistrement résonne comme une archive vivante de notre époque. Les personnes qui s'expriment ici partagent sans détour la réalité de leur quotidien, marquée par une résilience hors du commun et la volonté inaltérable de faire entendre la vérité. 

À travers ces paroles authentiques, nous découvrons les conditions vécues sur le terrain : l'incertitude permanente, la force des liens familiaux et communautaires, ainsi que la détermination à rester debout malgré les bouleversements qui frappent chaque foyer. Ce récit ne décrit pas seulement des événements, il incarne l'esprit et la dignité inébranlable de ceux qui refusent d'être oubliés.

💬 PAROLES FORTES EXTRAITES DU MÉDIA :
{quotes_formatted}

🧠 ANALYSE HUMAINE ET PORTÉE UNIVERSELLE
Ce témoignage dépasse la simple chronique du présent. Il pose une question fondamentale sur notre humanité commune et sur l'importance de préserver et documenter chaque voix pour l'Histoire. La sincérité du ton et la gravité des faits relatés nous rappellent que derrière chaque statistique, il y a des visages, des espoirs, des projets interrompus et un courage immense qui mérite d'être relayé avec respect et fidélité.

La transmission de ces messages à travers le monde est un devoir de mémoire et de solidarité. En refusant l'indifférence, chaque spectateur devient un maillon de la transmission de ces vérités indispensables.

👉 REJOIGNEZ LA VOIX DE LA SOLIDARITÉ
Ne laissez pas cette voix disparaître dans les méandres de l'algorithme. Commentez pour soutenir la démarche, partagez massivement autour de vous et enregistrez cette publication pour garantir sa visibilité à grande échelle. Ensemble, brisons le mur du silence.

🏷️ #Gaza #Palestine #Témoignage #Vérité #Humanité #Résilience #UrgenceGaza #PalestineLibre #StopWar #GazaUnderAttack #TémoinsDuRéel #Actualité #Histoire #Solidarité #Justice #AyaPlatform #TikTokNews #PourToi #FYP #Viral #Explore #Documentation #DroitsHumains #Paix #VoixDeGaza #Résistance #Courage #ReportageTerrain"""

    # Garantie anti-paresse : vérification finale des hashtags
    if '#' not in context_summary:
        context_summary += "\n\n#Gaza #Palestine #Témoignage #Vérité #Humanité #Résilience #UrgenceGaza #PalestineLibre #Solidarité #Justice #AyaStudio #TikTokNews #PourToi #FYP"

    return semantic_title.strip(), context_summary.strip()


def generate_context_summary(segments: list, media_path: str = None, target_lang: str = 'fr') -> str:
    """Rétrocompatibilité : renvoie la description contextuelle."""
    _, desc = generate_semantic_title_and_context(segments, media_path=media_path, target_lang=target_lang)
    return desc


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

    try:
        mode_label = "⚡ Mode Express (Texte Uniquement)" if express_mode else "🎬 Vidéo Complète"
        print(f"[PROGRESS] 5% - Initialisation du pipeline de traduction ({mode_label})...", flush=True)

        # 1. Analyse média & Silences réels
        print("[PROGRESS] 12% - Analyse acoustique et cartographie des silences FFmpeg...", flush=True)
        media_info = probe_media(media_input)
        is_video = media_info["is_video"]
        has_audio = media_info.get("has_audio", True)
        duration = media_info["duration"]
        width = media_info["width"]
        height = media_info["height"]

        silences = detect_audio_silences(media_input, noise_threshold="-30dB", min_duration=0.30)
        print(f"[PROGRESS] 25% - Structure média validée ({duration:.1f}s, {'vidéo' if is_video else 'audio'}, {len(silences)} silences détectés).", flush=True)

        # 2. Transcription & Traduction par Protocole Scan 5s
        segments, ai_model_used = process_audio_scan_5s(media_input, target_lang, duration, silences, source_lang=source_lang, force_reprocess=force_reprocess)

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

        # 4. SÉQUENÇAGE CRITIQUE (Nadine) : Génération Immédiate du Titre Sémantique et de la Smart Description
        print("[PROGRESS] 65% - 🧠 Analyse sémantique IA : Génération du Titre Sémantique et de la Smart Description TikTok...", flush=True)
        semantic_title, context_summary = generate_semantic_title_and_context(segments, media_path=media_input, target_lang=target_lang)

        # Si un titre utilisateur non-technique et authentique a été explicitement fourni, on peut le conserver, sinon le titre sémantique IA prévaut
        if custom_title and not is_technical_title and len(custom_title) > 3:
            semantic_title = custom_title[:40]

        print(f"[TITRE SÉMANTIQUE IA] ✨ '{semantic_title}' ({len(semantic_title)} car.)", flush=True)
        print(f"[SMART DESCRIPTION SEO] 📝 {len(context_summary)} caractères générés par Nadine.", flush=True)

        # Assainissement pour nomenclature des fichiers (.mp4, .ass, .jpg, .txt, .md)
        clean_title_stem = sanitize_filename_stem(semantic_title, max_length=50)
        print(f"[NOMENCLATURE] 🏷️ Stem assaini : '{clean_title_stem}'", flush=True)

        # ⚡ COURT-CIRCUIT MODE EXPRESS (MODULE 2 : TEXTE MARKDOWN EN < 5S)
        if express_mode:
            print("[PROGRESS] 85% - Formatage Markdown structuré du texte traduit (Mode Express)...", flush=True)
            md_filename = f"{clean_title_stem} (Traduction Express).md"
            md_path = OUTPUT_DIR / md_filename

            full_text = " ".join([s.get("text", "").strip() for s in segments if s.get("text")]).strip()

            src_display = "Arabe palestinien (Gaza)" if source_lang == 'ar' else ("Français" if source_lang == 'fr' else "Détection automatique")
            tgt_display = "Arabe palestinien (VOAR)" if target_lang == 'ar' else "Français (VOSTFR)"

            md_lines = [
                f"# 📝 {semantic_title} - Traduction Texte Express",
                f"**Fichier source** : `{Path(media_input).name}`  ",
                f"**Sens** : `{src_display} ➔ {tgt_display}`  ",
                f"**Durée du média** : `{duration:.1f}s` | **Segments** : `{len(segments)}` | **Moteur IA** : `{ai_model_used}`  ",
                "",
                "---",
                "",
                "### 📜 Texte Traduit Intégral",
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
                "silences_count": len(silences)
            }
            print("\n---JSON_OUTPUT_START---", flush=True)
            print(json.dumps(response, ensure_ascii=False, indent=2), flush=True)
            print("---JSON_OUTPUT_END---", flush=True)
            return

        # 5. Noms des fichiers de sortie normalisés basés sur le Titre Sémantique
        print("[PROGRESS] 78% - Post-traitement temporel et application de la règle Zéro Gap...", flush=True)
        mp4_filename, ass_filename = generate_clean_output_filenames(
            media_input, source_lang, target_lang, title_override=clean_title_stem
        )

        ass_path = OUTPUT_DIR / ass_filename
        mp4_path = OUTPUT_DIR / mp4_filename

        # 6. Génération du fichier .ASS
        print("[PROGRESS] 85% - Génération et stylisation des sous-titres .ASS...", flush=True)
        build_ass_file(segments, ass_path, is_video, width, height, duration, sub_color_hex, sub_margin_v)

        # 7. Incrustation vidéo FFmpeg
        print("[PROGRESS] 92% - Encodage et incrustation vidéo FFmpeg en cours...", flush=True)
        render_video_ffmpeg(media_input, ass_path, mp4_path, is_video, duration, bg_theme=bg_theme, has_audio=has_audio)

        # 8. Couverture 9:16 Lionel & Pack Assets (S'exécute APRÈS la réponse de Gemini avec semantic_title)
        cover_filename = None
        desc_filename = None
        if generate_tiktok_pack:
            print("[PROGRESS] 98% - 🎨 Lionel produit la Couverture 9:16 avec le titre sémantique...", flush=True)
            cover_filename = f"{clean_title_stem} (Couverture 9-16).jpg"
            desc_filename = f"{clean_title_stem} (Description TikTok).txt"

            cover_path = OUTPUT_DIR / cover_filename
            desc_path = OUTPUT_DIR / desc_filename

            # L'Agent Lionel incruste le vrai titre sémantique centré en police Impact
            generate_lionel_cover(semantic_title, cover_path, episode_num=1, target_lang=target_lang)
            with open(desc_path, 'w', encoding='utf-8') as df:
                df.write(context_summary.strip() + '\n')
            print(f"[PACK TIKTOK SUCCÈS] Assets générés : {cover_filename} | {desc_filename}", flush=True)

        print("[PROGRESS] 100% - Vidéo sous-titrée finalisée avec succès !", flush=True)

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
            "silences_count": len(silences)
        }
        print("\n---JSON_OUTPUT_START---", flush=True)
        print(json.dumps(response, ensure_ascii=False, indent=2), flush=True)
        print("---JSON_OUTPUT_END---", flush=True)

    except Exception as e:
        raw_msg = str(e)
        code = "PROCESSING_ERROR"
        if "MEDIA_TOO_BIG" in raw_msg:
            code = "MEDIA_TOO_BIG"
            err_msg = "Cette vidéo Telegram est trop lourde pour un import automatique. Enregistrez-la depuis Telegram et glissez-la directement ici (jusqu'à 500 Mo)."
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


if __name__ == "__main__":
    main()
