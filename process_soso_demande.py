import whisper
import json
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

print("Loading Whisper model...")
model = whisper.load_model('small')

print("Transcribing Arabic audio soso_demande.wav...")
res_ar = model.transcribe('audio_a_traiter/soso_demande.wav', language='ar')

print("Translating to English...")
res_en = model.transcribe('audio_a_traiter/soso_demande.wav', task='translate')

data = {
    "file_name": "soso demande.ogg",
    "duration": 59.05,
    "arabic_text": res_ar["text"].strip(),
    "english_translation": res_en["text"].strip(),
    "ar_segments": [{"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()} for s in res_ar["segments"]],
    "en_segments": [{"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()} for s in res_en["segments"]]
}

with open("soso_demande_analysis.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("SUCCESS_SOSO_DEMANDE")
