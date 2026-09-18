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

import time

def generate_slug_from_text(arabic_text):
    clean_ascii = re.sub(r'[^a-zA-Z0-9]+', '_', arabic_text).strip('_')
    words = [w.lower() for w in clean_ascii.split('_') if w][:4]
    slug = "_".join(words) if words else "reponse_fr"
    return f"{slug}_{int(time.time())}"

from dotenv import load_dotenv
load_dotenv()

def translate_arabic_to_french(text_ar):
    text_clean = text_ar.strip()
    if not text_clean:
        return ""

    # Nettoyage si copier-coller de l'historique
    lines = text_clean.split("\n")
    cleaned_lines = []
    for line in lines:
        line_s = line.strip()
        if not line_s:
            continue
        if line_s.startswith("👤") or line_s.startswith("🕒") or line_s.startswith("🔊"):
            continue
        if line_s.startswith("✨"):
            continue
        cleaned_lines.append(line_s)

    content_to_translate = "\n".join(cleaned_lines) if cleaned_lines else text_clean

    # Si le texte ne contient aucun caractère arabe (déjà en français), on le retourne directement
    stripped_text = content_to_translate.strip()
    if stripped_text:
        arabic_chars = sum(1 for c in stripped_text if '\u0600' <= c <= '\u06FF')
        if arabic_chars == 0:
            return stripped_text

    # 1. Traduction IA via Google Gemini 2.5 Flash (Arabe Palestinien Gaza vers Français)
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if gemini_key:
        prompt = (
            "Tu es un traducteur expert d'élite spécialisé dans le dialecte arabe palestinien de Gaza et le français.\n"
            "Ta mission : Traduire le texte en dialecte arabe palestinien de Gaza ci-dessous en FRANÇAIS AUTHENTIQUE, fluide et fidèle.\n"
            "Conserve les vocatifs ('Mon frère Steve', 'Ma sœur Soso', etc.) et respecte les nuances émotionnelles et de contexte.\n\n"
            "Texte arabe à traduire :\n"
            f"\"\"\"{content_to_translate}\"\"\"\n\n"
            "Ne renvoie QUE la traduction en français, sans guillemets, sans introduction ni conclusion."
        )

        models = [
            os.environ.get("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash"),
            os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite"),
            "gemini-flash-latest",
            "gemini-3.5-flash-lite"
        ]

        for model_name in models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    french_out = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    if french_out:
                        return french_out
            except Exception as e:
                print(f"[Gemini AR->FR Warning] Modèle {model_name} a échoué: {e}, tentative avec le suivant...")

    # 2. Fallback de secours
    try:
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=fr&dt=t&q=' + urllib.parse.quote(content_to_translate[:1000])
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=10)
        res_json = json.loads(response.read().decode('utf-8'))
        
        translated_chunks = []
        if res_json and isinstance(res_json, list) and res_json[0]:
            for chunk in res_json[0]:
                if isinstance(chunk, list) and len(chunk) > 0 and isinstance(chunk[0], str):
                    translated_chunks.append(chunk[0])

        french_raw = "".join(translated_chunks) if translated_chunks else content_to_translate
    except Exception as e:
        print("Fallback translation used:", e)
        french_raw = content_to_translate

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
