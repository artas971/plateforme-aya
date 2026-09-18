import sys
import os
import json
import asyncio
import edge_tts

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Fichier payload manquant"}))
        sys.exit(1)

    payload_file = sys.argv[1]
    if not os.path.exists(payload_file):
        print(json.dumps({"success": False, "error": f"Fichier {payload_file} introuvable"}))
        sys.exit(1)

    with open(payload_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    text = data.get("text", "").strip()
    voice = data.get("voice", "ar-JO-SanaNeural")
    output_path = data.get("output_path", "")

    if not text or not output_path:
        print(json.dumps({"success": False, "error": "Texte ou chemin de sortie vide"}))
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # Nettoyage succinct
    communicate = edge_tts.Communicate(text=text, voice=voice, rate="-4%", pitch="+0Hz")
    await communicate.save(output_path)

    print(json.dumps({"success": True, "output_path": output_path}))

if __name__ == "__main__":
    asyncio.run(main())
