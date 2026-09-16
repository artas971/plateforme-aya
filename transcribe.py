import json
import os
from faster_whisper import WhisperModel

audio_path = r"C:\Users\artas\Desktop\aya\audio_a_traiter\WhatsApp Audio 2026-08-27 at 12.55.32.aac"
output_json = r"C:\Users\artas\Desktop\aya\transcription.json"

print("Loading Whisper model...")
model = WhisperModel("small", device="cpu", compute_type="int8")

print("Transcribing...")
segments, info = model.transcribe(
    audio_path,
    language="ar",
    task="transcribe",
    beam_size=5,
    word_timestamps=True
)

results = []
for segment in segments:
    words_data = []
    if segment.words:
        for w in segment.words:
            words_data.append({
                "start": w.start,
                "end": w.end,
                "word": w.word,
                "probability": w.probability
            })
    results.append({
        "id": segment.id,
        "start": segment.start,
        "end": segment.end,
        "text": segment.text.strip(),
        "words": words_data
    })

with open(output_json, "w", encoding="utf-8") as f:
    json.dump({"language": info.language, "duration": info.duration, "segments": results}, f, ensure_ascii=False, indent=2)

print(f"Transcription saved to {output_json}. Total segments: {len(results)}")
