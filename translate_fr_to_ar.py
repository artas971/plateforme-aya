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

def generate_slug_from_text(french_text):
    clean_ascii = re.sub(r'[^a-zA-Z0-9]+', '_', french_text).strip('_')
    words = [w.lower() for w in clean_ascii.split('_') if w][:4]
    slug = "_".join(words) if words else "reponse_aya"
    return f"{slug}_{int(time.time())}"

from dotenv import load_dotenv
load_dotenv()

def translate_to_palestinian_arabic(text_fr):
    text_clean = text_fr.strip()
    if not text_clean:
        return ""

    # Nettoyage préventif : si l'utilisateur a accidentellement collé l'historique du chat
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

    # Si le texte est déjà en arabe (plus de 40% de caractères arabes), on le retourne directement
    stripped_text = content_to_translate.strip()
    if stripped_text:
        arabic_chars = sum(1 for c in stripped_text if '\u0600' <= c <= '\u06FF')
        if (arabic_chars / len(stripped_text)) > 0.4:
            return stripped_text

    # 1. Traduction IA de haute fidélité via Google Gemini 2.5 Flash (Agent Nadine - Ammiya Gaza)
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if gemini_key:
        prompt = (
            "Tu es l'Agent Nadine, traductrice experte d'élite spécialisée dans l'Arabe Palestinien dialectal de Gaza (Ammiya de Gaza - العامية الغزاوية) et le français.\n"
            "Ta mission : Traduire le texte français ci-dessous en ARABE PALESTINIEN AUTHENTIQUE DE GAZA (VOAR).\n\n"
            "DIRECTIVES LINGUISTIQUES STRICTES :\n"
            "1. RÈGLE DU DIALECTE PUR (AMMIYA DE GAZA) :\n"
            "TU DOIS OBLIGATOIREMENT utiliser l'Arabe Palestinien dialectal (Ammiya de Gaza). N'utilise JAMAIS l'arabe classique (Fusha).\n"
            "Utilise le vocabulaire quotidien et vivant de Gaza (ex: 'صحون' au lieu de 'أطباق', 'اللي' au lieu de 'أولئك الذين', "
            "'هلقيت / هسا' au lieu de 'الآن', 'بدي / بدنا' au lieu de 'أريد / نريد', 'عشان' au lieu de 'من أجل / لكي', "
            "'مش' au lieu de 'ليس', 'شو' au lieu de 'ماذا', 'حكي' au lieu de 'كلام', 'كتير' au lieu de 'كثيراً').\n\n"
            "2. RÈGLE DES NUANCES & ANALYSE SÉMANTIQUE DES NÉGATIONS :\n"
            "Fais une analyse sémantique profonde des expressions idiomatiques et des doubles négations françaises (ex: 'ne... que') avant de traduire, pour préserver le sens originel exact.\n"
            "ATTENTION FORMELLE AU CONTRESENS SUR LES NÉGATIONS RESTRICTIVES :\n"
            "La phrase 'Il n'y a pas de violence qu'avec des armes' signifie impérativement qu'il existe d'autres formes de violence (la violence n'est pas uniquement armée).\n"
            "Tu DOIS impérativement traduire par : 'العنف مش بس بالسلاح' ou 'في عنف مش بس بالسلاح'.\n"
            "Il est STRICTEMENT INTERDIT de faire un contresens en affirmant l'inverse (ex: 'ولا عنف إلا بالسلاح' ou 'العنف بس بالسلاح' sont formellement PROSCRITS).\n\n"
            "Texte français à traduire :\n"
            f"\"\"\"{content_to_translate}\"\"\"\n\n"
            "Ne renvoie QUE la traduction finale en arabe palestinien, sans guillemets, sans texte français, sans introduction ni conclusion."
        )

        models = [
            os.environ.get("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash"),
            os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite"),
            "gemini-flash-latest",
            "gemini-3.5-flash-lite",
            "gemini-3-flash-preview"
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
                    arabic_out = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    if arabic_out:
                        # Vérification de sécurité : le résultat doit contenir des caractères arabes
                        if any('\u0600' <= char <= '\u06FF' for char in arabic_out):
                            return arabic_out
            except Exception as e:
                print(f"[Gemini Chat Translate Warning] Modèle {model_name} a échoué: {e}, tentative avec le suivant...")

    # 2. Fallback de secours si les API Gemini sont inaccessibles
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

    processed_fr = content_to_translate
    for pattern, replacement in pre_replacements.items():
        processed_fr = re.sub(pattern, replacement, processed_fr, flags=re.IGNORECASE)

    try:
        url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=ar&dt=t&q=' + urllib.parse.quote(processed_fr[:1000])
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=10)
        res_json = json.loads(response.read().decode('utf-8'))
        
        translated_chunks = []
        if res_json and isinstance(res_json, list) and res_json[0]:
            for chunk in res_json[0]:
                if isinstance(chunk, list) and len(chunk) > 0 and isinstance(chunk[0], str):
                    translated_chunks.append(chunk[0])

        arabic_raw = "".join(translated_chunks) if translated_chunks else content_to_translate
    except Exception as e:
        print("Fallback translation used:", e)
        arabic_raw = content_to_translate

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
