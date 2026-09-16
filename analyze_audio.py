import whisper
import json

print("Loading Whisper model...")
model = whisper.load_model('small')

print("Transcribing Arabic...")
res_ar = model.transcribe('audio.wav', language='ar')

print("Translating to English...")
res_en = model.transcribe('audio.wav', task='translate')

data = {
    "ar_text": res_ar["text"].strip(),
    "en_text": res_en["text"].strip(),
    "ar_segments": [{"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()} for s in res_ar["segments"]],
    "en_segments": [{"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()} for s in res_en["segments"]]
}

with open("analysis.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("SUCCESS_14S")
