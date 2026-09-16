import sys
import json
import asyncio
import edge_tts
import re
import os
import urllib.request
import urllib.parse

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def generate_slug_from_text(arabic_text):
    words = re.findall(r'\w+', arabic_text)
    first_5 = words[:5]
    if not first_5:
        return "reponse_fr"
    clean_words = [w.lower() for w in first_5]
    return "_".join(clean_words)

def translate_arabic_to_french(text_ar):
    text_clean = text_ar.strip()
    if not text_clean:
        return ""

    try:
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=fr&dt=t&q=' + urllib.parse.quote(text_clean)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        res_json = json.loads(response.read().decode('utf-8'))
        
        translated_chunks = []
        if res_json and isinstance(res_json, list) and res_json[0]:
            for chunk in res_json[0]:
                if isinstance(chunk, list) and len(chunk) > 0 and isinstance(chunk[0], str):
                    translated_chunks.append(chunk[0])

        french_raw = "".join(translated_chunks) if translated_chunks else text_clean
    except Exception as e:
        print("Fallback translation used:", e)
        french_raw = text_clean

    return french_raw

async def generate_french_voice(text_fr, output_filename, voice="fr-FR-VivienneMultilingualNeural"):
    communicate = edge_tts.Communicate(
        text=text_fr,
        voice=voice,
        rate="+0%",
        pitch="+0Hz"
    )
    await communicate.save(output_filename)

if __name__ == "__main__":
    arabic_text = ""
    voice_choice = "fr-FR-VivienneMultilingualNeural"

    if os.path.exists("input_ar_payload.json"):
        try:
            with open("input_ar_payload.json", "r", encoding="utf-8") as f:
                payload = json.load(f)
                arabic_text = payload.get("text_ar", "")
                voice_choice = payload.get("voice", "fr-FR-VivienneMultilingualNeural")
        except Exception as e:
            print("Error reading input_ar_payload.json:", e)

    if not arabic_text and len(sys.argv) > 1:
        arabic_text = sys.argv[1]

    if not arabic_text:
        arabic_text = "مرحباً يا سوسو كيف حالك اليوم؟"

    slug = generate_slug_from_text(arabic_text)
    audio_filename = f"reponse_fr_{Date.now() if 'Date' in globals() else 'audio'}.mp3"

    french_translation = translate_arabic_to_french(arabic_text)

    target_dir = "fichiers_reponse_a_envoyer"
    os.makedirs(target_dir, exist_ok=True)
    
    # Generate unique audio filename
    import time
    audio_filename = f"audio_fr_{int(time.time())}.mp3"
    folder_audio_path = os.path.join(target_dir, audio_filename)

    asyncio.run(generate_french_voice(french_translation, folder_audio_path, voice=voice_choice))

    res = {
        "arabic_original": arabic_text,
        "french_translation": french_translation,
        "voice_used": voice_choice,
        "audio_file": audio_filename,
        "folder_file": folder_audio_path
    }

    with open("reponse_fr_result.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    print("SUCCESS_ARABIC_TO_FRENCH_TRANSLATION")
