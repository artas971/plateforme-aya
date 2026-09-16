import sys
import os
import json
import subprocess
import whisper
import edge_tts
import asyncio
import urllib.request
import urllib.parse
import re

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
    communicate = edge_tts.Communicate(text=text_fr, voice="fr-FR-VivienneMultilingualNeural")
    await communicate.save(output_mp3)

async def generate_arabic_tts(text_ar, output_mp3, voice="ar-JO-SanaNeural"):
    communicate = edge_tts.Communicate(text=text_ar, voice=voice, rate="-6%")
    await communicate.save(output_mp3)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No filename provided"}))
        sys.exit(1)

    requested_name = sys.argv[1]
    target_lang_arg = sys.argv[2] if len(sys.argv) > 2 else None

    input_path = find_file(requested_name)

    if not input_path or not os.path.exists(input_path):
        print(json.dumps({"error": f"Fichier {requested_name} introuvable"}))
        sys.exit(1)

    import time
    wav_temp = os.path.join(AUDIO_IN_DIR, f"temp_{int(time.time()*1000)}.wav")
    convert_to_wav(input_path, wav_temp)

    # Transcribe audio using faster-whisper (CTranslate2) or standard whisper
    try:
        from faster_whisper import WhisperModel
        fw_model = WhisperModel('base', device='cpu', compute_type='int8')
        segments, info = fw_model.transcribe(wav_temp, beam_size=1)
        detected_lang = info.language
        transcribed_text = " ".join([s.text.strip() for s in segments if s.text]).strip()
    except Exception as fw_err:
        print(f"Faster-whisper fallback to standard whisper: {fw_err}")
        model = whisper.load_model('base')
        audio = whisper.load_audio(wav_temp)
        audio = whisper.pad_or_trim(audio)
        mel = whisper.log_mel_spectrogram(audio).to(model.device)
        _, probs = model.detect_language(mel)
        detected_lang = max(probs, key=probs.get)
        res_whisper = model.transcribe(wav_temp, language=detected_lang, fp16=False)
        transcribed_text = res_whisper["text"].strip()

    base_name = os.path.splitext(os.path.basename(input_path))[0].replace(" ", "_")
    out_mp3_name = f"traduction_{base_name}.mp3"
    out_mp3_path = os.path.join(AUDIO_OUT_DIR, out_mp3_name)

    # Determine final direction:
    # If target_lang_arg is specified, respect it.
    # Otherwise, if detected_lang is 'fr', translate to 'ar'. If detected_lang is 'ar', translate to 'fr'.
    if target_lang_arg:
        final_target = target_lang_arg
    else:
        final_target = 'ar' if detected_lang == 'fr' else 'fr'

    if final_target == 'ar':
        # Input was French (or target requested is Palestinian Arabic)
        if detected_lang == 'fr':
            french_text = transcribed_text
            arabic_text = translate_fr_to_ar(french_text)
        else:
            arabic_text = transcribed_text
            french_text = translate_ar_to_fr(arabic_text)

        asyncio.run(generate_arabic_tts(arabic_text, out_mp3_path))
    else:
        # Final target is French
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
        "french_audio_file": out_mp3_name
    }

    with open("single_process_out.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    print("SUCCESS_PROCESS_SINGLE")
