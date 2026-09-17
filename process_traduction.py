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
from pathlib import Path
from dotenv import load_dotenv

# Encodage console sécurisé
if sys.stdout and sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

OUTPUT_DIR = BASE_DIR / "fichiers_reponse_a_envoyer"
DEFAULT_BG = BASE_DIR / "modern_dark_bg.jpg"
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
        '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration',
        '-of', 'json', media_path
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
    except Exception as e:
        print(f"[PROBE WARNING] Erreur ffprobe: {e}", file=sys.stderr)
        data = {"streams": [], "format": {"duration": "30.0"}}

    duration = 30.0
    if "format" in data and "duration" in data["format"]:
        try:
            duration = float(data["format"]["duration"])
        except Exception:
            duration = 30.0

    is_video = False
    width = 1080
    height = 1920

    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            cname = stream.get("codec_name", "").lower()
            if cname not in ["mjpeg", "png", "bmp"]:
                is_video = True
                width = int(stream.get("width", 1080))
                height = int(stream.get("height", 1920))
                break

    return {
        "is_video": is_video,
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


def split_segment_if_exceeds_5s(segment: dict, max_duration: float = 5.0) -> list:
    """Découpe tout segment brut dépassant 5 secondes en sous-blocs séquentiels équilibrés."""
    start = float(segment.get("start", 0))
    end = float(segment.get("end", start + 2.0))
    text = segment.get("text", "").strip()
    dur = end - start

    if dur <= max_duration or not text:
        return [{"start": start, "end": end, "text": text}]

    words = text.split()
    if len(words) <= 1:
        return [{"start": start, "end": end, "text": text}]

    num_parts = int(dur // max_duration) + 1
    words_per_part = max(1, len(words) // num_parts)
    part_dur = dur / num_parts

    parts = []
    for p in range(num_parts):
        p_start = start + (p * part_dur)
        p_end = start + ((p + 1) * part_dur) if p < num_parts - 1 else end
        w_chunk = words[p * words_per_part : (p + 1) * words_per_part] if p < num_parts - 1 else words[p * words_per_part:]
        if w_chunk:
            parts.append({
                "start": round(p_start, 2),
                "end": round(p_end, 2),
                "text": " ".join(w_chunk)
            })

    return parts


def transcribe_window_30s(chunk_path: str, mode: str, window_offset: float, window_dur: float, source_lang: str = 'auto') -> list:
    """Appelle l'IA pour transcrire/traduire une fenêtre de 30 secondes avec le protocole Scan 5s."""
    from gemini_translator import gemini_audio_transcribe_and_translate
    raw_segments = gemini_audio_transcribe_and_translate(chunk_path, mode=mode, total_duration=window_dur, source_lang=source_lang)
    
    if not raw_segments or len(raw_segments) == 0:
        return []

    # Ajustement des timestamps relatifs à la fenêtre globale et sous-découpage 5s
    window_segments = []
    for seg in raw_segments:
        s_rel = float(seg.get("start", 0))
        e_rel = float(seg.get("end", s_rel + 2.0))
        txt = seg.get("text", "").strip()

        seg_adjusted = {
            "start": round(window_offset + s_rel, 2),
            "end": round(window_offset + e_rel, 2),
            "text": txt
        }
        # Découpe stricte si > 5 secondes
        sub_5s_parts = split_segment_if_exceeds_5s(seg_adjusted, max_duration=5.0)
        window_segments.extend(sub_5s_parts)

    return window_segments


def process_audio_scan_5s(media_path: str, target_lang: str, total_duration: float, silences: list, source_lang: str = 'auto') -> list:
    """
    Protocole Scan 5s Anti-Résumé :
    Divise l'audio en fenêtres de 30 secondes si le fichier est long,
    puis applique l'analyse 5s et le raccord Zéro Gap conditionné aux silences.
    """
    mode = 'VOAR' if target_lang.lower() == 'ar' else 'VOSTFR'
    print(f"[PROGRESS] 40% - Analyse IA de l'audio ({total_duration:.1f}s) en mode {mode} (source: {source_lang})...", flush=True)

    # Si le fichier est court (<= 35s), analyse directe
    if total_duration <= 35.0:
        from gemini_translator import gemini_audio_transcribe_and_translate
        raw_segs = gemini_audio_transcribe_and_translate(media_path, mode=mode, total_duration=total_duration, source_lang=source_lang)
        if not raw_segs:
            # Fallback Whisper Cloud
            openai_key = os.environ.get("OPENAI_API_KEY")
            if openai_key:
                from run_studio_v3_full_pipeline import transcribe_via_openai_api
                raw_segs = transcribe_via_openai_api(media_path, openai_key, mode=mode)

        all_segments = []
        for s in (raw_segs or []):
            all_segments.extend(split_segment_if_exceeds_5s(s, max_duration=5.0))

        print("[PROGRESS] 70% - Transcription directe terminée.", flush=True)

    else:
        # Long fichier : Découpage en fenêtres étanches de 30 secondes
        WINDOW_SIZE = 30.0
        num_windows = int(total_duration // WINDOW_SIZE) + (1 if total_duration % WINDOW_SIZE > 0 else 0)
        print(f"[PROTOCOLE SCAN 5S] Découpage en {num_windows} fenêtres étanches de 30s (Anti-Attention Drift)...", flush=True)

        all_segments = []
        temp_dir = BASE_DIR / "temp_chunks"
        temp_dir.mkdir(parents=True, exist_ok=True)

        for w_idx in range(num_windows):
            w_start = w_idx * WINDOW_SIZE
            w_end = min(total_duration, (w_idx + 1) * WINDOW_SIZE)
            w_dur = w_end - w_start

            current_pct = int(40 + (w_idx / num_windows) * 30)
            print(f"[PROGRESS] {current_pct}% - Analyse IA : Fenêtre {w_idx + 1}/{num_windows} [{w_start:.0f}s-{w_end:.0f}s]...", flush=True)
            chunk_file = temp_dir / f"chunk_{os.getpid()}_{w_idx}.mp3"

            # Extraction sans réencodage lourd
            cmd_cut = [
                'ffmpeg', '-y',
                '-ss', str(w_start), '-to', str(w_end),
                '-i', media_path,
                '-vn', '-ar', '24000', '-ac', '1', '-b:a', '64k',
                str(chunk_file.resolve())
            ]
            subprocess.run(cmd_cut, capture_output=True, check=True)

            try:
                w_segs = transcribe_window_30s(str(chunk_file.resolve()), mode, w_start, w_dur, source_lang=source_lang)
                all_segments.extend(w_segs)
            finally:
                if chunk_file.exists():
                    try: chunk_file.unlink()
                    except Exception: pass

        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)

        print("[PROGRESS] 70% - Toutes les fenêtres ont été transcrites avec succès.", flush=True)

    if not all_segments:
        raise RuntimeError("Aucun segment de sous-titre n'a pu être produit pour ce média.")

    # Tri chronologique absolu
    all_segments.sort(key=lambda x: x["start"])

    # RÈGLE ZÉRO GAP AVEC DÉTECTION DES SILENCES RÉELS
    print("[POST-TRAITEMENT] Application de la règle Zéro Gap conditionnée aux silences...")
    for i in range(len(all_segments) - 1):
        cur_end = all_segments[i]["end"]
        nxt_start = all_segments[i + 1]["start"]
        gap = nxt_start - cur_end

        if gap > 0:
            # Vérifier si un silence réel (> 0.3s) existe dans ce trou
            is_silent = has_silence_between(cur_end, nxt_start, silences)
            if is_silent:
                # Silence réel : Le bloc s'arrête net à la fin de la parole
                pass
            else:
                # Pas de silence : La personne parle ou enchaîne -> ZÉRO GAP !
                all_segments[i]["end"] = nxt_start

    # Alignement du dernier segment sur la durée totale si la parole va jusqu'au bout
    last_end = all_segments[-1]["end"]
    if not has_silence_between(last_end, total_duration, silences):
        all_segments[-1]["end"] = total_duration

    print(f"[PROTOCOLE SCAN 5S SUCCÈS] {len(all_segments)} sous-titres générés sans aucun trou non justifié.")
    return all_segments


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

    # Adaptation PlayRes proportionnelle
    if not is_video or height >= width:
        play_res_x = 1080
        play_res_y = 1920
        font_size = 72
        margin_lr = 20
        margin_v = sub_margin_v
    else:
        # Vidéo paysage 16:9
        play_res_x = 1920
        play_res_y = 1080
        font_size = 64
        margin_lr = 40
        # Si position haute (150) -> 80, milieu (500) -> 540, bas (950) -> 80
        if sub_margin_v <= 250:
            margin_v = 80 # Haut
        elif sub_margin_v <= 700:
            margin_v = 540 # Milieu
        else:
            margin_v = 90  # Bas

    ass_events = []
    for seg in segments:
        start_sec = float(seg["start"])
        end_sec = float(seg["end"])
        t_start = format_ass_time(start_sec)
        t_end = format_ass_time(end_sec)
        text_clean = format_subtitle_blocks(seg["text"].strip())
        if text_clean:
            ass_events.append(f"Dialogue: 0,{t_start},{t_end},SubtitleStyle,,0,0,0,,{text_clean}")

    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SubtitleStyle,Impact,{font_size},{ass_primary_color},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ass_events)

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    print(f"[ASS SUCCÈS] Fichier généré : {output_ass_path.name}")


def render_video_ffmpeg(media_path: str, ass_path: Path, output_mp4_path: Path, is_video: bool, duration: float):
    """Incruste les sous-titres via FFmpeg sans toucher aux proportions d'origine."""
    escaped_ass = str(ass_path.resolve()).replace("\\", "/").replace(":", "\\:")

    if is_video:
        print("[FFMPEG] Incrustation sur flux vidéo original (aucun recadrage forcé)...")
        cmd = [
            'ffmpeg', '-y',
            '-i', media_path,
            '-vf', f"subtitles='{escaped_ass}'",
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
            '-c:a', 'aac', '-b:a', '192k',
            '-movflags', '+faststart',
            str(output_mp4_path.resolve())
        ]
    else:
        print("[FFMPEG] Génération vidéo avec image de fond standard modern_dark_bg.jpg...")
        bg_image = str(DEFAULT_BG.resolve())
        cmd = [
            'ffmpeg', '-y',
            '-threads', '0',
            '-loop', '1', '-i', bg_image,
            '-i', media_path,
            '-vf', f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles='{escaped_ass}'",
            '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage',
            '-c:a', 'aac', '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            str(output_mp4_path.resolve())
        ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Erreur d'encodage FFmpeg: {res.stderr[-500:]}")

    print(f"[FFMPEG SUCCÈS] Vidéo produite : {output_mp4_path.name} ({output_mp4_path.stat().st_size} octets)")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Argument fichier média manquant."}))
        sys.exit(1)

    media_input = sys.argv[1]
    target_lang = sys.argv[2] if len(sys.argv) > 2 else 'fr'
    sub_color_hex = sys.argv[3] if len(sys.argv) > 3 else '#FFFF00'
    try:
        sub_margin_v = int(sys.argv[4]) if len(sys.argv) > 4 else 950
    except ValueError:
        sub_margin_v = 950
    source_lang = sys.argv[5] if len(sys.argv) > 5 else 'auto'

    if not os.path.exists(media_input):
        print(json.dumps({"success": False, "error": f"Fichier introuvable : {media_input}"}))
        sys.exit(1)

    try:
        print("[PROGRESS] 5% - Initialisation du pipeline de traduction & sous-titrage...", flush=True)

        # 1. Analyse média & Silences réels
        print("[PROGRESS] 12% - Analyse acoustique et cartographie des silences FFmpeg...", flush=True)
        media_info = probe_media(media_input)
        is_video = media_info["is_video"]
        duration = media_info["duration"]
        width = media_info["width"]
        height = media_info["height"]

        silences = detect_audio_silences(media_input, noise_threshold="-30dB", min_duration=0.30)
        print(f"[PROGRESS] 25% - Structure média validée ({duration:.1f}s, {'vidéo' if is_video else 'audio'}, {len(silences)} silences détectés).", flush=True)

        # 2. Transcription & Traduction par Protocole Scan 5s
        segments = process_audio_scan_5s(media_input, target_lang, duration, silences, source_lang=source_lang)

        # 3. Noms des fichiers de sortie
        print("[PROGRESS] 78% - Post-traitement temporel et application de la règle Zéro Gap...", flush=True)
        clean_stem = re.sub(r"[^\w.-]", "_", Path(media_input).stem)
        unique_id = f"{clean_stem}_{source_lang}_{target_lang}_{sub_margin_v}"
        ass_filename = f"subtitles_{unique_id}.ass"
        mp4_filename = f"video_{unique_id}.mp4"

        ass_path = OUTPUT_DIR / ass_filename
        mp4_path = OUTPUT_DIR / mp4_filename

        # 4. Génération du fichier .ASS
        print("[PROGRESS] 85% - Génération et stylisation des sous-titres .ASS...", flush=True)
        build_ass_file(segments, ass_path, is_video, width, height, duration, sub_color_hex, sub_margin_v)

        # 5. Incrustation vidéo FFmpeg
        print("[PROGRESS] 92% - Encodage et incrustation vidéo FFmpeg en cours...", flush=True)
        render_video_ffmpeg(media_input, ass_path, mp4_path, is_video, duration)

        print("[PROGRESS] 100% - Vidéo sous-titrée finalisée avec succès !", flush=True)

        # 6. Réponse finale JSON
        response = {
            "success": True,
            "media_type": "video" if is_video else "audio",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "sub_color": sub_color_hex,
            "sub_position": sub_margin_v,
            "duration": round(duration, 2),
            "mp4_filename": mp4_filename,
            "mp4_url": f"/download/{mp4_filename}",
            "ass_filename": ass_filename,
            "ass_url": f"/download/{ass_filename}",
            "segments_count": len(segments),
            "silences_count": len(silences)
        }
        print("\n---JSON_OUTPUT_START---", flush=True)
        print(json.dumps(response, ensure_ascii=False, indent=2), flush=True)
        print("---JSON_OUTPUT_END---", flush=True)

    except Exception as e:
        err_res = {"success": False, "error": str(e)}
        print("\n---JSON_OUTPUT_START---", flush=True)
        print(json.dumps(err_res, ensure_ascii=False, indent=2), flush=True)
        print("---JSON_OUTPUT_END---", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
