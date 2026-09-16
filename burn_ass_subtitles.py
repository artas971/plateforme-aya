import sys
import os
import json
import subprocess

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_IN_DIR = os.path.join(BASE_DIR, "audio_a_traiter")
AUDIO_OUT_DIR = os.path.join(BASE_DIR, "fichiers_reponse_a_envoyer")

os.makedirs(AUDIO_IN_DIR, exist_ok=True)
os.makedirs(AUDIO_OUT_DIR, exist_ok=True)

def find_file(target_name):
    if not target_name or not isinstance(target_name, str):
        return None
    paths = [
        os.path.join(AUDIO_IN_DIR, target_name),
        os.path.join(BASE_DIR, target_name)
    ]
    for p in paths:
        if os.path.exists(p):
            return p

    normalized_target = target_name.replace(" ", "_").lower()
    for d in [AUDIO_IN_DIR, BASE_DIR]:
        for f in os.listdir(d):
            if f.replace(" ", "_").lower() == normalized_target or f.replace(" ", "_").lower().startswith(normalized_target.split(".")[0]):
                return os.path.join(d, f)
    return None

def burn_subtitles(video_name, ass_name_or_content):
    if isinstance(ass_name_or_content, dict):
        ass_name_or_content = ass_name_or_content.get("value") or ass_name_or_content.get("ass_content") or ""

    if not isinstance(video_name, str):
        video_name = str(video_name) if video_name else ""

    if not isinstance(ass_name_or_content, str):
        ass_name_or_content = str(ass_name_or_content) if ass_name_or_content else ""

    video_path = find_file(video_name)
    if not video_path or not os.path.exists(video_path):
        return {"error": f"Vidéo source {video_name} introuvable"}

    base_name = os.path.splitext(os.path.basename(video_path))[0].replace(" ", "_")
    ass_path = os.path.join(AUDIO_OUT_DIR, f"subtitles_{base_name}.ass")

    # If ass_name_or_content is full ASS text (contains [Script Info])
    if "[Script Info]" in ass_name_or_content:
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_name_or_content)
    else:
        # It's an existing filename
        custom_ass = find_file(ass_name_or_content)
        if custom_ass and os.path.exists(custom_ass):
            ass_path = custom_ass

    if not os.path.exists(ass_path):
        return {"error": f"Fichier de sous-titres .ASS introuvable ({ass_path})"}

    out_video_name = f"{base_name}_VOSTFR.mp4"
    out_video_path = os.path.join(AUDIO_OUT_DIR, out_video_name)

    # Escape path for FFmpeg filter on Windows
    escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"ass='{escaped_ass}'",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "copy",
        out_video_path
    ]

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")

    if not os.path.exists(out_video_path):
        return {"error": f"Échec de la génération MP4 : {res.stderr}"}

    return {
        "success": True,
        "video_filename": out_video_name,
        "video_url": f"/fichiers_reponse_a_envoyer/{out_video_name}",
        "ass_filename": os.path.basename(ass_path)
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        # Check payload file
        payload_file = os.path.join(BASE_DIR, "burn_payload.json")
        if os.path.exists(payload_file):
            with open(payload_file, "r", encoding="utf-8") as f:
                pdata = json.load(f)
                video_name = pdata.get("video_filename")
                ass_content = pdata.get("ass_content")
                res = burn_subtitles(video_name, ass_content)
                print(json.dumps(res, ensure_ascii=False, indent=2))
                sys.exit(0)

        print(json.dumps({"error": "Paramètres vidéo et sous-titres requis"}))
        sys.exit(1)

    video_name = sys.argv[1]
    ass_param = sys.argv[2]
    res = burn_subtitles(video_name, ass_param)
    print(json.dumps(res, ensure_ascii=False, indent=2))
