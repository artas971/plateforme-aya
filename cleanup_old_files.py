import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_OUT_DIR = os.path.join(BASE_DIR, "fichiers_reponse_a_envoyer")
AUDIO_IN_DIR = os.path.join(BASE_DIR, "audio_a_traiter")

ONE_DAY_SEC = 24 * 3600  # 24 heures (1 jour max)

def purge_old_files():
    now = time.time()
    deleted_count = 0

    # Purge des MP3 générés âgés de plus de 24h
    if os.path.exists(AUDIO_OUT_DIR):
        for fname in os.listdir(AUDIO_OUT_DIR):
            if fname.endswith(".mp3") or fname.endswith(".wav"):
                fpath = os.path.join(AUDIO_OUT_DIR, fname)
                if os.path.isfile(fpath):
                    mtime = os.path.getmtime(fpath)
                    if (now - mtime) > ONE_DAY_SEC:
                        try:
                            os.remove(fpath)
                            print(f"[Cleanup 24h] Supprimé fichier audio expiré (>24h): {fname}")
                            deleted_count += 1
                        except Exception as e:
                            print(f"[Cleanup Error] {fname}: {e}")

    # Purge des fichiers temporaires dans le dossier principal âgés de plus de 24h
    for fname in os.listdir(BASE_DIR):
        if fname.endswith("_temp.wav") or fname in ["single_process_out.json", "input_payload.json", "whatsapp_payload.json"]:
            fpath = os.path.join(BASE_DIR, fname)
            if os.path.isfile(fpath):
                mtime = os.path.getmtime(fpath)
                if (now - mtime) > ONE_DAY_SEC:
                    try:
                        os.remove(fpath)
                        print(f"[Cleanup 24h] Supprimé fichier temp: {fname}")
                        deleted_count += 1
                    except Exception as e:
                        pass

    print(f"Purge 24h terminée. Total supprimés: {deleted_count}")

if __name__ == "__main__":
    purge_old_files()
