import sys
import subprocess
import os

target_path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\artas\Desktop\aya\fichiers_reponse_a_envoyer"

if os.path.exists(target_path):
    if os.path.isfile(target_path):
        subprocess.Popen(f'explorer.exe /select,"{target_path}"')
    else:
        subprocess.Popen(f'explorer.exe "{target_path}"')
    print("SUCCESS_OPEN_EXPLORER")
else:
    print("PATH_NOT_FOUND")
