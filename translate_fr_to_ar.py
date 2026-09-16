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

def generate_slug_from_text(french_text):
    words = re.findall(r'\w+', french_text)
    first_5 = words[:5]
    if not first_5:
        return "reponse_aya"
    clean_words = [w.lower() for w in first_5]
    return "_".join(clean_words)

def translate_to_palestinian_arabic(text_fr):
    text_clean = text_fr.strip()
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
        print("Fallback translation used:", e)
        arabic_raw = text_clean

    arabic_refined = arabic_raw

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
        r'\bالبث المباشر\b': 'البَثّ المُمباشِر',
    }

    for pattern, replacement in replacements.items():
        arabic_refined = re.sub(pattern, replacement, arabic_refined)

    return arabic_refined

async def generate_natural_arabic_voice(text_ar, output_filename, voice="ar-JO-SanaNeural", rate="-6%"):
    communicate = edge_tts.Communicate(
        text=text_ar,
        voice=voice,
        rate=rate,
        pitch="+0Hz"
    )
    await communicate.save(output_filename)

if __name__ == "__main__":
    french_text = ""
    voice_choice = "ar-JO-SanaNeural"

    # Read from input_payload.json to preserve 100% of newlines, multi-line quotes and special characters
    if os.path.exists("input_payload.json"):
        try:
            with open("input_payload.json", "r", encoding="utf-8") as f:
                payload = json.load(f)
                french_text = payload.get("text_fr", "")
                voice_choice = payload.get("voice", "ar-JO-SanaNeural")
        except Exception as e:
            print("Error reading input_payload.json:", e)

    if not french_text and len(sys.argv) > 1:
        french_text = sys.argv[1]
        if len(sys.argv) > 2:
            voice_choice = sys.argv[2]

    if not french_text:
        french_text = "C'est important qu'on fasse le point ensemble et qu'on discute de tout."

    slug = generate_slug_from_text(french_text)
    audio_filename = f"{slug}.mp3"

    arabic_translation = translate_to_palestinian_arabic(french_text)

    target_dir = "fichiers_reponse_a_envoyer"
    os.makedirs(target_dir, exist_ok=True)
    folder_audio_path = os.path.join(target_dir, audio_filename)

    asyncio.run(generate_natural_arabic_voice(arabic_translation, folder_audio_path, voice=voice_choice))

    res = {
        "french_original": french_text,
        "arabic_translation": arabic_translation,
        "voice_used": voice_choice,
        "audio_file": audio_filename,
        "folder_file": folder_audio_path
    }

    with open("reponse_result.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    print("SUCCESS_DYNAMIC_TRANSLATION_SINGLE_FILE")
