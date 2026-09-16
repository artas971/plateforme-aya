import sys
import os
import json
import subprocess
import re
import urllib.request
import urllib.parse
from faster_whisper import WhisperModel

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

def convert_to_wav(input_path, output_wav):
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vn", "-ar", "16000", "-ac", "1", output_wav]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def translate_ar_to_fr(arabic_text):
    text_clean = arabic_text.strip()
    if not text_clean:
        return ""
    try:
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=fr&dt=t&q=' + urllib.parse.quote(text_clean)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=10)
        res_json = json.loads(response.read().decode('utf-8'))
        fr_trans = ''.join([s[0] for s in res_json[0] if isinstance(s, list) and len(s) > 0 and isinstance(s[0], str)])
        return fr_trans.strip()
    except Exception as e:
        print("Error translating AR to FR:", e, sys.stderr)
        return text_clean

def format_ass_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int(round((seconds - int(seconds)) * 100))
    if centisecs >= 100:
        centisecs = 99
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

ASS_HEADER = """[Script Info]
Title: Sous-Titres Francais VOSTFR
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def generate_subtitles(requested_name, target_lang='fr'):
    input_path = find_file(requested_name)
    if not input_path or not os.path.exists(input_path):
        return {"error": f"Fichier {requested_name} introuvable"}

    wav_temp = os.path.join(AUDIO_IN_DIR, f"temp_sub_{Date_now_id()}.wav")
    convert_to_wav(input_path, wav_temp)

    try:
        model = WhisperModel('base', device='cpu', compute_type='int8')
        segments_raw, info = model.transcribe(wav_temp, vad_filter=True, vad_parameters=dict(min_silence_duration_ms=400))
        detected_lang = info.language
    except Exception as e:
        return {"error": f"Erreur de transcription Whisper : {str(e)}"}

    segments_list = []
    ass_dialogues = []

    full_arabic_parts = []
    full_french_parts = []

    idx = 1
    for seg in segments_raw:
        ar_text = seg.text.strip()
        if not ar_text:
            continue

        start_ts = format_ass_timestamp(seg.start)
        end_ts = format_ass_timestamp(seg.end)

        if detected_lang == 'fr' or target_lang == 'ar':
            fr_text = ar_text
            # If target requested is Arabic, translate French to Arabic
            final_sub_text = fr_text
        else:
            # Palestinian Arabic to French Subtitle
            fr_text = translate_ar_to_fr(ar_text)
            final_sub_text = fr_text

        full_arabic_parts.append(ar_text)
        full_french_parts.append(fr_text)

        ass_dialogues.append(f"Dialogue: 0,{start_ts},{end_ts},Default,,0,0,0,,{final_sub_text}")

        segments_list.append({
            "id": idx,
            "start": start_ts,
            "end": end_ts,
            "start_sec": seg.start,
            "end_sec": seg.end,
            "arabic_text": ar_text,
            "french_text": fr_text
        })
        idx += 1

    if os.path.exists(wav_temp):
        try:
            os.remove(wav_temp)
        except Exception:
            pass

    ass_content = ASS_HEADER + "\n".join(ass_dialogues) + "\n"

    base_name = os.path.splitext(os.path.basename(input_path))[0].replace(" ", "_")
    ass_filename = f"subtitles_{base_name}.ass"
    ass_file_path = os.path.join(AUDIO_OUT_DIR, ass_filename)

    with open(ass_file_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    return {
        "success": True,
        "video_filename": requested_name,
        "ass_filename": ass_filename,
        "ass_url": f"/fichiers_reponse_a_envoyer/{ass_filename}",
        "ass_content": ass_content,
        "detected_lang": detected_lang,
        "target_lang": target_lang,
        "full_arabic_text": " ".join(full_arabic_parts),
        "full_french_translation": " ".join(full_french_parts),
        "segments": segments_list
    }

def Date_now_id():
    import time
    return int(time.time() * 1000)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Nom de fichier vidéo requis"}))
        sys.exit(1)

    requested_name = sys.argv[1]
    target_lang = sys.argv[2] if len(sys.argv) > 2 else 'fr'

    res = generate_subtitles(requested_name, target_lang)
    print(json.dumps(res, ensure_ascii=False, indent=2))
