import os
import sys
import json
import subprocess
import whisper
import edge_tts
import asyncio
import urllib.request
import urllib.parse

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_IN_DIR = os.path.join(BASE_DIR, "audio_a_traiter")
AUDIO_OUT_DIR = os.path.join(BASE_DIR, "fichiers_reponse_a_envoyer")
DB_FILE = os.path.join(BASE_DIR, "processed_db.json")

os.makedirs(AUDIO_IN_DIR, exist_ok=True)
os.makedirs(AUDIO_OUT_DIR, exist_ok=True)

db = {}
if os.path.exists(DB_FILE):
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            db = json.load(f)
    except Exception:
        db = {}

def convert_to_wav(input_path, output_wav):
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vn", "-ar", "16000", "-ac", "1", output_wav]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def translate_ar_to_fr(arabic_text):
    try:
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=fr&dt=t&q=' + urllib.parse.quote(arabic_text)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        res_json = json.loads(response.read().decode('utf-8'))
        fr_trans = ''.join([s[0] for s in res_json[0]])
        return fr_trans.strip()
    except Exception as e:
        print("Error translating AR to FR:", e)
        return arabic_text

async def generate_french_tts(text_fr, output_mp3):
    communicate = edge_tts.Communicate(text=text_fr, voice="fr-FR-VivienneMultilingualNeural")
    await communicate.save(output_mp3)

def run_batch():
    valid_exts = (".mp4", ".mov", ".ogg", ".opus", ".wav", ".mp3", ".m4a")
    files_to_process = []

    for fname in os.listdir(AUDIO_IN_DIR):
        if fname.lower().endswith(valid_exts) and not fname.endswith("_temp.wav"):
            files_to_process.append(fname)

    if not files_to_process:
        print("Aucun fichier audio/vidéo dans audio_a_traiter.")
        return

    print(f"Trouvé {len(files_to_process)} fichier(s)...")
    model = whisper.load_model('small')

    for fname in files_to_process:
        in_path = os.path.join(AUDIO_IN_DIR, fname)
        wav_path = os.path.join(AUDIO_IN_DIR, f"{os.path.splitext(fname)[0]}_temp.wav")

        print(f"Processing: {fname}...")

        convert_to_wav(in_path, wav_path)

        res_ar = model.transcribe(wav_path, language='ar')
        ar_text = res_ar["text"].strip()

        # Direct Arabic to French translation
        fr_text = translate_ar_to_fr(ar_text)

        out_mp3_name = f"traduction_{os.path.splitext(fname)[0].replace(' ', '_')}.mp3"
        out_mp3_path = os.path.join(AUDIO_OUT_DIR, out_mp3_name)

        asyncio.run(generate_french_tts(fr_text, out_mp3_path))

        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                pass

        encoded_name = urllib.parse.quote(fname)
        db[fname] = {
            "filename": fname,
            "arabic_text": ar_text,
            "french_translation": fr_text,
            "french_audio_url": f"/fichiers_reponse_a_envoyer/{out_mp3_name}",
            "media_url": f"/audio_a_traiter/{encoded_name}"
        }

        print(f"SUCCESS_FR: {fname}")

    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print("ALL_BATCH_COMPLETED_FR")

if __name__ == "__main__":
    run_batch()
