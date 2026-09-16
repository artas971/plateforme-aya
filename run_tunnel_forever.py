import subprocess
import time
import json
import re
import os

NEGATIVE_WORDS = [
    "alert", "war", "kill", "fail", "error", "limit", "dead", "crisis", 
    "fear", "danger", "bug", "attack", "risk", "harm", "toxic", "threat", 
    "anxiety", "pain", "loss", "crash", "fault", "warning", "ban", "block",
    "cigarette", "smoke", "tobacco", "cigar", "pichunter", "porn", "jews", "jew"
]

def is_negative_url(url):
    url_lower = url.lower()
    for word in NEGATIVE_WORDS:
        if word in url_lower:
            return True, word
    return False, None

def main():
    print("[Tunnel Manager] Démarrage du gestionnaire de tunnel avec filtre de bienveillance visuelle...")
    while True:
        try:
            print("[Tunnel Manager] Recherche d'un lien d'accès harmonieux et sécurisé...")
            proc = subprocess.Popen(
                [r"C:\Users\artas\Desktop\aya\cloudflared.exe", "tunnel", "--url", "http://localhost:3000", "--protocol", "http2"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace"
            )

            tunnel_url = None
            rejected = False

            for line in iter(proc.stdout.readline, ''):
                if not line:
                    break
                if "trycloudflare.com" in line:
                    match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                    if match:
                        candidate_url = match.group(0)
                        is_neg, bad_word = is_negative_url(candidate_url)
                        if is_neg:
                            print(f"[Filtre Positif] Rejet du lien '{candidate_url}' (mot anxiogène détecté : '{bad_word}'). Régénération immédiate...")
                            proc.terminate()
                            rejected = True
                            break
                        
                        if candidate_url != tunnel_url:
                            tunnel_url = candidate_url
                            print(f"\n=======================================================")
                            print(f"  [LIEN DISTANT HARMONIEUX ACTIF] : {tunnel_url}")
                            print(f"=======================================================\n")
                            
                            try:
                                with open(r"C:\Users\artas\Desktop\aya\public\active_tunnel.json", "w", encoding="utf-8") as f:
                                    json.dump({"url": tunnel_url, "time": time.time()}, f)
                                with open(r"C:\Users\artas\Desktop\Lien_Actif_Aya.txt", "w", encoding="utf-8") as f:
                                    f.write(f"Lien Distant Actif pour Aya :\n{tunnel_url}\n")
                                print(f"[Fichier Mis à Jour] Lien écrit dans Lien_Actif_Aya.txt", flush=True)
                            except Exception as e:
                                print("Error writing status files:", e, flush=True)

            if not rejected:
                proc.wait()

        except Exception as e:
            print("[Tunnel Manager Error]:", e)

        time.sleep(1)

if __name__ == "__main__":
    main()
