import whisper
import json
import asyncio
import edge_tts
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

print("Loading Whisper model...")
model = whisper.load_model('small')

print("Transcribing Arabic audio soso.wav...")
res_ar = model.transcribe('audio_a_traiter/soso.wav', language='ar')

print("Translating to English/French...")
res_en = model.transcribe('audio_a_traiter/soso.wav', task='translate')

# French translation refinement for Levantine dialogue
ar_full = res_ar["text"].strip()
en_full = res_en["text"].strip()

segments_data = []
for i, (s_ar, s_en) in enumerate(zip(res_ar["segments"], res_en["segments"])):
    segments_data.append({
        "id": i,
        "start": round(s_ar["start"], 2),
        "end": round(s_ar["end"], 2),
        "arabic": s_ar["text"].strip(),
        "english": s_en["text"].strip()
    })

data = {
    "file_name": "soso.mp4",
    "duration": 44.03,
    "arabic_text": ar_full,
    "english_translation": en_full,
    "segments": segments_data
}

with open("soso_analysis.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("SUCCESS_SOSO_TRANSCRIPTION")
