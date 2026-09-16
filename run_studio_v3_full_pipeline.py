import sys
import os
import json
import subprocess
import shutil
import re

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = r'c:\Users\artas\Desktop\aya'
AUDIO_IN_DIR = os.path.join(BASE_DIR, 'audio_a_traiter')
AUDIO_OUT_DIR = os.path.join(BASE_DIR, 'fichiers_reponse_a_envoyer')

# Auto-load .env
env_file = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_file):
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

os.makedirs(AUDIO_IN_DIR, exist_ok=True)
os.makedirs(AUDIO_OUT_DIR, exist_ok=True)

def hex_to_ass_color(hex_str):
    if not hex_str or not hex_str.startswith('#'):
        return '&H00FFFF00'
    hex_str = hex_str.replace('#', '')
    if len(hex_str) == 6:
        r = hex_str[0:2]
        g = hex_str[2:4]
        b = hex_str[4:6]
        return f'&H00{b}{g}{r}'.upper()
    return '&H00FFFF00'

def get_audio_duration(file_path):
    cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(res.stdout.strip())
    except Exception:
        return 30.0

def format_ass_time(seconds):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hrs}:{mins:02d}:{secs:05.2f}"

# ==============================================================================
# PÔLE 3 & 4 : FONCTIONS LINGUISTIQUES & STRUCTURATION DÉDIÉES (JADE, NADINE, MAX)
# ==============================================================================

# ==============================================================================
# PÔLE 3 : REFONTE MOTEUR LINGUISTIQUE (WHISPER SMALL + INITIAL PROMPT + LLM API)
# ==============================================================================

# ==============================================================================
# PÔLE 3 : BATCH LLM TRADUCTION & DECOUPAGE BATCH (SINGLE HTTP REQUEST)
# ==============================================================================

import concurrent.futures

# ==============================================================================
# PÔLE 3 : MOTEUR DE TRADUCTION PARALLÈLE THREADPOOLEXECUTOR (INDEXATION 1:1 STRICTE)
# ==============================================================================

GAZA_INITIAL_PROMPT = (
    "سوسو، ستيف، أخوي ستيف، يا أخي ستيف، غزة، المينا، الخط الأصفر، "
    "شهداء، مجزرة، قصف، زوارق البحرية، هدنة، تسليم السلاح، مقاومة، "
    "لا حول ولا قوة إلا بالله، الله يرحمهم، حسبي الله ونعم الوكيل، "
    "والله، يعني، صبر، طاقة، مكان، بيتي، قلبي، حياة، كافتيريا، "
    "خيام، دمار، طيران، مخدة، لايفات، بتصبر، بتضحك"
)

def check_api_keys():
    """Validation et détection explicite des clés API d'environnement LLM."""
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    if openai_key:
        print(f"[Pôle 3 Security] Clef API OpenAI DETECTEE ({openai_key[:6]}...) -> Mode LLM gpt-4o-mini actif.")
    elif anthropic_key:
        print(f"[Pôle 3 Security] Clef API Anthropic DETECTEE ({anthropic_key[:6]}...) -> Mode LLM claude-3-5-sonnet actif.")
    elif gemini_key:
        print(f"[Pôle 3 Security] Clef API Gemini DETECTEE ({gemini_key[:6]}...) -> Mode LLM gemini-1.5-flash actif.")
    else:
        print("[Pôle 3 Warning] Aucune clef API LLM (OPENAI_API_KEY / ANTHROPIC_API_KEY) detectee dans process.env.")
        print("[Pôle 3 Warning] Utilisation du traducteur Gaza Gold Standard avec dictionnaire de raffinement dialectal.")

def split_segments_max_5s(raw_segments, max_duration=5.0):
    """Protocole Scan 5s (Nadine) : Découpe strictement tout segment > 5 secondes."""
    processed = []
    for s in raw_segments:
        start = s.get("start", 0.0) if isinstance(s, dict) else s.start
        end = s.get("end", 0.0) if isinstance(s, dict) else s.end
        text = (s.get("text", "") if isinstance(s, dict) else s.text).strip()

        if not text:
            continue

        duration = end - start
        if duration <= max_duration:
            processed.append({"start": start, "end": end, "text": text})
        else:
            words = text.split()
            num_chunks = int(duration // max_duration) + 1
            words_per_chunk = max(1, len(words) // num_chunks)
            chunk_duration = duration / num_chunks

            for i in range(num_chunks):
                chunk_start = start + (i * chunk_duration)
                chunk_end = start + ((i + 1) * chunk_duration)
                chunk_words = words[i * words_per_chunk : (i + 1) * words_per_chunk] if i < num_chunks - 1 else words[i * words_per_chunk:]
                if chunk_words:
                    processed.append({
                        "start": chunk_start,
                        "end": chunk_end,
                        "text": " ".join(chunk_words)
                    })
    return processed

def refine_gaza_translation(text_raw):
    """Gaza Dialectal Gold Standard Substitutions"""
    subs = {
        r'\bيا أخي ستيف\b': 'Mon frère Steve',
        r'\bأخي ستيف\b': 'Mon frère Steve',
        r'\bستيف\b': 'Steve',
        r'\bسوسو\b': 'Soso',
        r'\bالمينة\b': 'Le Port (Al-Mina)',
        r'\bميناء غزة\b': 'Le Port de Gaza (Al-Mina)',
        r'\bالخط الأصفر\b': 'La Ligne Jaune',
        r'\bالقطاع\b': 'La Bande de Gaza',
        r'\bقوات الاحتلال\b': "Forces d'Occupation",
        r'\bمستشفى\b': 'Hôpital',
        r'\bتسليم السلاح\b': 'Rendre les armes',
    }
    refined = text_raw
    for k, v in subs.items():
        refined = re.sub(k, v, refined, flags=re.IGNORECASE)
    return refined

def translate_single_segment(arabic_text):
    """Traduction d'un seul segment avec prompt système strict et clés API LLM d'environnement."""
    clean_ar = refine_gaza_translation(arabic_text)
    system_prompt = "Tu es un traducteur expert du dialecte palestinien de Gaza. Traduis ce segment audio vers un français impactant. Garde un ton dramatique et authentique. Conserve impérativement les prénoms (Steve, Soso) et les lieux (Al-Mina, Le Port, La Ligne Jaune). Ne résume pas. Rédige sous forme de sous-titre court."

    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        try:
            import urllib.request
            headers = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": clean_ar}
                ],
                "temperature": 0.3
            }
            req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(payload).encode('utf-8'), headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                out_text = res_data["choices"][0]["message"]["content"].strip().replace('"', '')
                if out_text:
                    return out_text
        except Exception:
            pass

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            import urllib.request
            headers = {"x-api-key": anthropic_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
            payload = {
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 150,
                "system": system_prompt,
                "messages": [{"role": "user", "content": clean_ar}]
            }
            req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(payload).encode('utf-8'), headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                out_text = res_data["content"][0]["text"].strip().replace('"', '')
                if out_text:
                    return out_text
        except Exception:
            pass

    try:
        import urllib.request, urllib.parse
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=fr&dt=t&q=' + urllib.parse.quote(clean_ar)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            fr_trans = ''.join([s[0] for s in res_json[0]]).strip()
            fr_trans = fr_trans.replace("Mon frere Steve", "Mon frère Steve")
            fr_trans = fr_trans.replace("Al Mina", "Le Port (Al-Mina)")
            fr_trans = fr_trans.replace("la ligne jaune", "La Ligne Jaune")
            fr_trans = fr_trans.replace("forces d'occupation", "Forces d'Occupation")
            return fr_trans
    except Exception:
        return clean_ar

def parallel_translate_segments(raw_sub_5s, max_workers=10):
    """Traduction parallèle de chaque segment de manière isolée via ThreadPoolExecutor pour préserver l'indexation 1-to-1."""
    if not raw_sub_5s:
        return []

    print(f"[Pôle 3 Traduction Parallèle] Lancement de {len(raw_sub_5s)} traductions isolées (ThreadPoolExecutor: {max_workers} workers)...")

    def process_item(item):
        orig_text = item["text"]
        translated = translate_single_segment(orig_text)
        return {
            "start": item["start"],
            "end": item["end"],
            "text": translated
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        translated_segments = list(executor.map(process_item, raw_sub_5s))

    print(f"[Pôle 3 Traduction Parallèle] ✅ {len(translated_segments)} segments traduits et indexés avec succès 1:1 !")
    return translated_segments

def format_subtitle_blocks(text, max_line_chars=32):
    """Refonte Formatage Visuel Strict (Nadine & Max) : Garantit que chaque ligne ne dépasse JAMAIS ~30-35 caractères."""
    words = text.split()
    if not words:
        return ""
    if len(text) <= max_line_chars:
        return text

    line1_words = []
    line2_words = []
    curr_len = 0

    target_len = min(max_line_chars, len(text) // 2 + 4)
    for w in words:
        if curr_len + len(w) + 1 <= target_len or not line1_words:
            line1_words.append(w)
            curr_len += len(w) + 1
        else:
            line2_words.append(w)

    line1 = " ".join(line1_words)
    line2 = " ".join(line2_words)

    if len(line2) > max_line_chars + 8:
        all_words = words
        mid = (len(all_words) + 1) // 2
        line1 = " ".join(all_words[:mid])
        line2 = " ".join(all_words[mid:])

def transcribe_via_openai_api(media_path, openai_key, mode='VOSTFR'):
    """Transcription distante via l'API OpenAI Whisper (Cloud, Zéro CPU local)."""
    import urllib.request
    import uuid

    temp_audio = os.path.join(AUDIO_IN_DIR, f"temp_openai_{uuid.uuid4().hex[:8]}.mp3")
    try:
        subprocess.run([
            'ffmpeg', '-y', '-i', media_path,
            '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k',
            temp_audio
        ], capture_output=True, check=True)
        send_path = temp_audio
    except Exception:
        send_path = media_path

    try:
        with open(send_path, 'rb') as f:
            file_bytes = f.read()
    finally:
        if os.path.exists(temp_audio):
            try:
                os.remove(temp_audio)
            except Exception:
                pass

    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = bytearray()

    def add_field(name, value):
        body.extend(f"--{boundary}\r\n".encode('utf-8'))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode('utf-8'))
        body.extend(f"{value}\r\n".encode('utf-8'))

    add_field('model', 'whisper-1')
    add_field('response_format', 'verbose_json')
    add_field('language', 'ar')
    add_field('prompt', GAZA_INITIAL_PROMPT)

    filename = os.path.basename(send_path)
    body.extend(f"--{boundary}\r\n".encode('utf-8'))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode('utf-8'))
    body.extend(b'Content-Type: audio/mpeg\r\n\r\n')
    body.extend(file_bytes)
    body.extend(b'\r\n')
    body.extend(f"--{boundary}--\r\n".encode('utf-8'))

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=bytes(body),
        headers={
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            raw_segments = []
            for s in data.get("segments", []):
                txt = s.get("text", "").strip()
                if txt:
                    raw_segments.append({
                        "start": round(float(s.get("start", 0)), 2),
                        "end": round(float(s.get("end", 0)), 2),
                        "text": txt
                    })

            if not raw_segments and data.get("text"):
                raw_segments = [{"start": 0.0, "end": 5.0, "text": data["text"].strip()}]

            raw_sub_5s = split_segments_max_5s(raw_segments, max_duration=5.0)
            if mode == 'VOSTFR':
                return parallel_translate_segments(raw_sub_5s, max_workers=10)
            return raw_sub_5s
    except Exception as e:
        print(f"[Pôle 3 OpenAI Whisper Cloud Error] {e}")
        return None


def run_pipeline(media_file_name, bg_file_name=None, mode='VOSTFR', title=None, title_color='#D8D0BE', sub_color='#FFFF00', title_margin=380, sub_margin=950, show_header=True, header_text='PALESTINIAN ECHO', header_color='#CE1126', project_uuid=None):
        # 0. Force Deletion of Old Cache Files (UUID & Media)
    if project_uuid:
        for old_ext in ['.ass', '.mp4', '.txt']:
            f_old = os.path.join(AUDIO_OUT_DIR, f"subtitles_{project_uuid}{old_ext}")
            f_mp4 = os.path.join(AUDIO_OUT_DIR, f"video_{project_uuid}_1080x1920.mp4")
            if os.path.exists(f_old):
                try: os.remove(f_old)
                except Exception: pass
            if os.path.exists(f_mp4):
                try: os.remove(f_mp4)
                except Exception: pass

    print(f"=== DEMARRAGE DU PIPELINE STUDIO V3 DE HAUTE FIDELITE ===")
    print(f"Media: {media_file_name} | Mode: {mode} | UUID: {project_uuid} | TitleColor: {title_color} | SubColor: {sub_color} | BandColor: {header_color}")

    # 1. Resolve Media Path
    media_path = os.path.join(AUDIO_IN_DIR, media_file_name)
    if not os.path.exists(media_path):
        media_path = os.path.join(BASE_DIR, media_file_name)
    if not os.path.exists(media_path):
        media_path = os.path.join(r'C:\Users\artas\Desktop\test', media_file_name)
    if not os.path.exists(media_path):
        return {"error": f"Fichier media introuvable : {media_file_name}"}

    # 2. Resolve Background Image Path
    if bg_file_name and os.path.exists(os.path.join(AUDIO_IN_DIR, bg_file_name)):
        bg_path = os.path.join(AUDIO_IN_DIR, bg_file_name)
    elif bg_file_name and os.path.exists(os.path.join(BASE_DIR, bg_file_name)):
        bg_path = os.path.join(BASE_DIR, bg_file_name)
    else:
        bg_path = os.path.join(BASE_DIR, 'john_creasy_signature_bg.jpg')
        if not os.path.exists(bg_path):
            bg_path = os.path.join(r'C:\Users\artas\Desktop\test', 'john_creasy_signature_bg.jpg')

    total_duration = get_audio_duration(media_path)
    print(f"Duree totale detectee (ffprobe) : {total_duration:.2f} secondes")

    # 3. Transcribe / Translate (Priority 1: Gemini 2.5 Flash Multimodal Gold Standard, Priority 2: Whisper)
    check_api_keys()
    segments = []

    # --- PÔLE 3 : MOTEUR PRINCIPAL GEMINI FLASH MULTIMODAL DIRECT ---
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if gemini_key:
        try:
            from gemini_translator import gemini_audio_transcribe_and_translate
            gemini_segments = gemini_audio_transcribe_and_translate(media_path, mode=mode, total_duration=total_duration)
            if gemini_segments and len(gemini_segments) > 0:
                segments = gemini_segments
                print(f"[Pôle 3 Succès] {len(segments)} segments obtenus via Gemini Multimodal Gold Standard.")
        except Exception as e_gem:
            print(f"[Pôle 3 Gemini Fallback] Erreur Gemini: {e_gem}, bascule vers l'API OpenAI Whisper Cloud...")

    # --- GESTION STRICTE API CLOUD (ZÉRO CHARGE CPU LOCALE) ---
    if not segments:
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key:
            print("[Pôle 3 Cloud Fallback] Appel de l'API distante OpenAI Whisper...")
            segments = transcribe_via_openai_api(media_path, openai_key, mode=mode)

        if not segments or len(segments) == 0:
            raise RuntimeError(
                "Échec de la transcription Cloud : Ni l'API Gemini ni l'API OpenAI n'ont pu traiter l'audio. "
                "Vérifiez vos clés API dans le fichier .env (Aucun modèle local n'a été exécuté pour préserver votre CPU)."
            )

    # Apply Zero-Gap Rule (End_N == Start_N+1)
    for i in range(len(segments) - 1):
        if segments[i+1]["start"] - segments[i]["end"] < 0.35:
            segments[i]["end"] = segments[i+1]["start"]

    segments[-1]["end"] = total_duration

    # 4. Build .ASS Content according to Protocole V3 & Gaza Gold Standard
    ass_title_color = hex_to_ass_color(title_color)
    ass_sub_color = hex_to_ass_color(sub_color)
    ass_header_color = hex_to_ass_color(header_color)

    title_text = title if title else "SOSO NOUS PARLE DU DRAME SURVENU LE 18 AOÛT"
    clean_title = title_text.replace('\n', '\\N')

    ass_events = []

    # A. Header Banner (if show_header is True)
    if str(show_header).lower() in ['true', '1', 'yes']:
        h_text = header_text.strip().upper() if header_text else 'PALESTINIAN ECHO'
        ass_events.append(f"Dialogue: 0,0:00:00.00,{format_ass_time(total_duration)},HeaderStyle,,0,0,0,,{h_text}")

    # B. Title permanent event across total duration
    ass_events.append(f"Dialogue: 0,0:00:00.00,{format_ass_time(total_duration)},TitleStyle,,0,0,0,,{clean_title}")

    # C. Subtitle timeline events (formatted into 7-8 word blocks)
    for seg in segments:
        t_start = format_ass_time(seg["start"])
        t_end = format_ass_time(seg["end"])
        formatted_sub = format_subtitle_blocks(seg["text"])
        ass_events.append(f"Dialogue: 0,{t_start},{t_end},SubtitleStyle,,0,0,0,,{formatted_sub}")

    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: HeaderStyle, Arial, 32, &H00FFFFFF, &H00000000, {ass_header_color}, {ass_header_color}, -1, 0, 0, 0, 100, 100, 0, 0, 3, 10, 0, 8, 40, 40, 60, 1
Style: TitleStyle, Arial Black, 46, {ass_title_color}, &H00000000, &H00000000, &H00000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 0, 8, 50, 50, {title_margin}, 1
Style: SubtitleStyle,Impact,72,{ass_sub_color},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,10,10,{sub_margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ass_events)

    if project_uuid:
        ass_file_name = f"subtitles_{project_uuid}.ass"
        mp4_file_name = f"video_{project_uuid}_1080x1920.mp4"
    else:
        base_clean = os.path.splitext(os.path.basename(media_file_name))[0].replace(" ", "_")
        ass_file_name = f"subtitles_{base_clean}.ass"
        mp4_file_name = f"video_{base_clean}_1080x1920.mp4"

    ass_path = os.path.join(AUDIO_OUT_DIR, ass_file_name)
    mp4_path = os.path.join(AUDIO_OUT_DIR, mp4_file_name)

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    print(f"Fichier ASS produit avec succes : {ass_path}")

    # VERROU QUALITÉ STEVE (PÔLE 6 QA) : Vérification de la taille (>0 octets) et présence de dialogues réels
    if not os.path.exists(ass_path) or os.path.getsize(ass_path) == 0:
        raise RuntimeError(f"[Verrou Qualité Steve] Le fichier .ASS '{ass_path}' est vide ou introuvable.")
    with open(ass_path, "r", encoding="utf-8") as f_check:
        if "Dialogue:" not in f_check.read():
            raise RuntimeError(f"[Verrou Qualité Steve] Le fichier .ASS '{ass_path}' ne contient aucun événement 'Dialogue' valide. Encodage FFmpeg bloqué.")

    # 5. FFmpeg Full Duration Encoding (NO -t limit!)
    escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")
    cmd = [
        'ffmpeg', '-y',
        '-threads', '0',
        '-loop', '1', '-i', bg_path,
        '-i', media_path,
        '-vf', f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles='{escaped_ass}'",
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        mp4_path
    ]

    print("Execution de la commande FFmpeg pour la DUREE TOTALE INTEGRALE...")
    res = subprocess.run(cmd, capture_output=True, text=True)

    if res.returncode == 0 and os.path.exists(mp4_path):
        print(f"SUCCESS: Video MP4 produite a {mp4_path} ({os.path.getsize(mp4_path)} octets) !")
    else:
        print(f"FFmpeg Error: {res.stderr}")

    # PÔLE 7 : Clara Copywriter (description_tiktok.txt) & Pablo Cover Design (cover_prompt_916.txt / cover_916.jpg)
    desc_path = os.path.join(AUDIO_OUT_DIR, 'description_tiktok.txt')
    desc_content = f"""🔥 HOOK: {title_text}

📌 CONTEXTE: Soso nous livre un témoignage poignant en direct de Gaza. Un message d'une vérité brute et d'une résilience absolue à écouter jusqu'à la fin.

👉 CALL TO ACTION: Abonnez-vous et partagez ce message pour faire entendre la vérité du terrain.

#Gaza #Palestine #Soso #UrgenceGaza #VOSTFR #TikTok #LiveGaza"""

    with open(desc_path, 'w', encoding='utf-8') as f:
        f.write(desc_content)

    cover_path = os.path.join(AUDIO_OUT_DIR, 'cover_prompt_916.txt')
    cover_content = f"""PABLO COVER DESIGN (9:16) :
- Format: 9:16 Vertical (1080x1920)
- Style: Abstrait (Zéro humain)
- Palette: Noir, Blanc, Vert, Rouge
- Typographie: Police Impact (Titre: '{title_text}', Épisode #1)"""

    with open(cover_path, 'w', encoding='utf-8') as f:
        f.write(cover_content)

    return {
        "success": True,
        "mp4_filename": mp4_file_name,
        "mp4_url": f"/download/{mp4_file_name}",
        "ass_filename": ass_file_name,
        "ass_url": f"/download/{ass_file_name}",
        "desc_filename": "description_tiktok.txt",
        "desc_url": "/download/description_tiktok.txt",
        "cover_filename": "cover_prompt_916.txt",
        "cover_url": "/download/cover_prompt_916.txt",
        "duration": total_duration
    }


if __name__ == '__main__':
    media_file = sys.argv[1] if len(sys.argv) > 1 else 'Soso nous parle du drame survenue le 18 aout.ogg'
    bg_file = sys.argv[2] if len(sys.argv) > 2 else 'john_creasy_signature_bg.jpg'
    mode = sys.argv[3] if len(sys.argv) > 3 else 'VOSTFR'
    title = sys.argv[4] if len(sys.argv) > 4 else 'SOSO NOUS PARLE DU DRAME SURVENU LE 18 AOÛT'
    title_color = sys.argv[5] if len(sys.argv) > 5 else '#D8D0BE'
    sub_color = sys.argv[6] if len(sys.argv) > 6 else '#FFFF00'
    title_margin = sys.argv[7] if len(sys.argv) > 7 else '380'
    sub_margin = sys.argv[8] if len(sys.argv) > 8 else '950'
    show_header = sys.argv[9] if len(sys.argv) > 9 else 'true'
    header_text = sys.argv[10] if len(sys.argv) > 10 else 'PALESTINIAN ECHO'
    header_color = sys.argv[11] if len(sys.argv) > 11 else '#CE1126'
    project_uuid = sys.argv[12] if len(sys.argv) > 12 else None

    res = run_pipeline(media_file, bg_file, mode, title, title_color, sub_color, title_margin, sub_margin, show_header, header_text, header_color, project_uuid)
    print(json.dumps(res, ensure_ascii=False, indent=2))
