import sys
import os
import json
import subprocess
import asyncio
import urllib.request
import urllib.parse
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
import time

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

# Load WhisperModel into RAM ONCE at startup
print("[Whisper Service] Chargement du modèle Whisper 'small' avec VAD en mémoire RAM...")
t_start = time.time()

try:
    from faster_whisper import WhisperModel
    GLOBAL_MODEL = WhisperModel('small', device='cpu', compute_type='int8')
    print(f"[Whisper Service] Modèle Whisper 'small' chargé avec succès en {time.time() - t_start:.2f} secondes !")
except Exception as e:
    print(f"[Whisper Service Warning] Erreur au chargement de faster-whisper: {e}")
    GLOBAL_MODEL = None

try:
    import edge_tts
except ImportError:
    edge_tts = None

def find_file(target_name):
    if os.path.isabs(target_name) and os.path.exists(target_name):
        return target_name
    if os.path.exists(target_name):
        return os.path.abspath(target_name)
    paths = [
        os.path.join(AUDIO_IN_DIR, target_name),
        os.path.join(BASE_DIR, target_name)
    ]
    for p in paths:
        if os.path.exists(p):
            return p

    normalized_target = target_name.replace(" ", "_").lower()
    for d in [AUDIO_IN_DIR, BASE_DIR]:
        if os.path.exists(d):
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
        response = urllib.request.urlopen(req, timeout=15)
        res_json = json.loads(response.read().decode('utf-8'))
        fr_trans = ''.join([s[0] for s in res_json[0] if isinstance(s, list) and len(s) > 0 and isinstance(s[0], str)])
        return fr_trans.strip()
    except Exception as e:
        print("Error translating AR to FR:", e)
        return arabic_text

def translate_fr_to_ar(french_text):
    text_clean = french_text.strip()
    if not text_clean:
        return ""

    pre_replacements = {
        r'\ble live\b': 'le direct en ligne',
        r'\bun live\b': 'un direct en ligne',
        r'\bdu live\b': 'du direct en ligne',
        r'\bce live\b': 'ce direct en ligne',
        r'\blive\b': 'direct en ligne',
        r'\bdébriefer\b': 'parler ensemble',
        r'\bdébriefing\b': 'discussion',
        r'\bfaire le point\b': 'discuter ensemble',
        r'\bs\'interroger\b': 'se parler',
        r'\bpseudo\b': 'nom d\'utilisateur',
    }

    processed_fr = text_clean
    for pattern, replacement in pre_replacements.items():
        processed_fr = re.sub(pattern, replacement, processed_fr, flags=re.IGNORECASE)

    try:
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=ar&dt=t&q=' + urllib.parse.quote(processed_fr)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        res_json = json.loads(response.read().decode('utf-8'))
        translated_chunks = []
        if res_json and isinstance(res_json, list) and res_json[0]:
            for chunk in res_json[0]:
                if isinstance(chunk, list) and len(chunk) > 0 and isinstance(chunk[0], str):
                    translated_chunks.append(chunk[0])
        arabic_raw = "".join(translated_chunks) if translated_chunks else text_clean
    except Exception as e:
        print("Error translating FR to AR:", e)
        arabic_raw = text_clean

    replacements = {
        r'\bاستخلاص المعلومات\b': 'نِحْكي ونِتْطَمَّن عَ بَعَض',
        r'\bاستجوب\b': 'نِحْكي',
        r'\bنستجوب\b': 'نِحْكي مَع بَعَض',
        r'\bأخت غلوبال\b': 'الأُخْت يونيفيرسال',
        r'\bالأخت العالمية\b': 'الأُخْت يونيفيرسال',
        r'\bيونيفيرسال\b': 'الأُخْت يونيفيرسال',
        r'\bوطن\b': 'الأُخْت وَطَن',
        r'\bباي بال\b': 'بايبال',
        r'\bبايبال\b': 'بايبال',
        r'\bأليس كذلك\b': 'صَح؟',
        r'\bمباشر عبر الإنترنت\b': 'بَثّ مُبَاشِر',
        r'\bمباشر على الإنترنت\b': 'بَثّ مُبَاشِر',
        r'\bالبث المباشر\b': 'البَثّ المُبَاشِر',
    }
    arabic_refined = arabic_raw
    for pattern, replacement in replacements.items():
        arabic_refined = re.sub(pattern, replacement, arabic_refined)
    return arabic_refined

async def generate_french_tts(text_fr, output_mp3):
    if edge_tts:
        communicate = edge_tts.Communicate(text=text_fr, voice="fr-FR-VivienneMultilingualNeural")
        await communicate.save(output_mp3)

async def generate_arabic_tts(text_ar, output_mp3, voice="ar-JO-SanaNeural"):
    if edge_tts:
        communicate = edge_tts.Communicate(text=text_ar, voice=voice, rate="-6%")
        await communicate.save(output_mp3)

def process_file_fast(requested_name, target_lang_arg=None):
    t0 = time.time()
    input_path = find_file(requested_name)
    if not input_path or not os.path.exists(input_path):
        return {"error": f"Fichier {requested_name} introuvable"}

    wav_temp = os.path.join(AUDIO_IN_DIR, f"temp_{int(time.time()*1000)}.wav")
    convert_to_wav(input_path, wav_temp)

    PALESTINIAN_PROMPT = "تسجيل صوتي باللهجة الفلسطينية الغزاوية العامية."
    segments_data = []

    if GLOBAL_MODEL:
        segments, info = GLOBAL_MODEL.transcribe(
            wav_temp, 
            beam_size=1, 
            initial_prompt=PALESTINIAN_PROMPT,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        detected_lang = info.language
        segments_list = list(segments)
        transcribed_text = " ".join([s.text.strip() for s in segments_list if s.text]).strip()
        segments_data = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments_list if s.text]
    else:
        import whisper
        model = whisper.load_model('small')
        audio = whisper.load_audio(wav_temp)
        audio = whisper.pad_or_trim(audio)
        mel = whisper.log_mel_spectrogram(audio).to(model.device)
        _, probs = model.detect_language(mel)
        detected_lang = max(probs, key=probs.get)
        res_whisper = model.transcribe(wav_temp, language=detected_lang, fp16=False, initial_prompt=PALESTINIAN_PROMPT)
        transcribed_text = res_whisper["text"].strip()
        segments_data = [{"start": round(s.get("start", 0), 2), "end": round(s.get("end", 0), 2), "text": s.get("text", "").strip()} for s in res_whisper.get("segments", [])]

    base_name = os.path.splitext(os.path.basename(input_path))[0].replace(" ", "_")
    out_mp3_name = f"traduction_{base_name}.mp3"
    out_mp3_path = os.path.join(AUDIO_OUT_DIR, out_mp3_name)

    if target_lang_arg:
        final_target = target_lang_arg
    else:
        final_target = 'ar' if detected_lang == 'fr' else 'fr'

    if final_target == 'ar':
        if detected_lang == 'fr':
            french_text = transcribed_text
            arabic_text = translate_fr_to_ar(french_text)
        else:
            arabic_text = transcribed_text
            french_text = translate_ar_to_fr(arabic_text)
        asyncio.run(generate_arabic_tts(arabic_text, out_mp3_path))
    else:
        if detected_lang == 'ar':
            arabic_text = transcribed_text
            french_text = translate_ar_to_fr(arabic_text)
        else:
            french_text = transcribed_text
            arabic_text = translate_fr_to_ar(french_text)
        asyncio.run(generate_french_tts(french_text, out_mp3_path))

    if os.path.exists(wav_temp):
        try:
            os.remove(wav_temp)
        except Exception:
            pass

    res = {
        "filename": requested_name,
        "detected_lang": detected_lang,
        "arabic_text": arabic_text,
        "french_translation": french_text,
        "french_audio_url": f"/fichiers_reponse_a_envoyer/{out_mp3_name}",
        "french_audio_file": out_mp3_name,
        "duration_sec": round(time.time() - t0, 2),
        "segments": segments_data
    }

    with open("single_process_out.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    print(f"[Whisper Service] Traité {requested_name} en {time.time() - t0:.2f}s !")
    return res

class WhisperServiceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "ready": GLOBAL_MODEL is not None}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/process':
            content_length = int(self.headers.get('Content-Length', 0))
            body_data = self.rfile.read(content_length)
            try:
                payload = json.loads(body_data.decode('utf-8'))
                filename = payload.get('filename')
                target_lang = payload.get('target_lang')
                result = process_file_fast(filename, target_lang)

                try:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
                except Exception:
                    pass
            except Exception as e:
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                except Exception:
                    pass
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

def run_service(port=5001):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, WhisperServiceHandler)
    print(f"[Whisper Service] Service Whisper ultra-rapide actif sur http://127.0.0.1:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_service()
