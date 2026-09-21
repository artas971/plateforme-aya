import sys
import subprocess
import os

if sys.platform != 'win32':
    print("HEADLESS_SKIPPED")
    sys.exit(0)

default_target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fichiers_reponse_a_envoyer")
target_path = sys.argv[1] if len(sys.argv) > 1 else default_target

if os.path.exists(target_path):
    if os.path.isfile(target_path):
        subprocess.Popen(f'explorer.exe /select,"{target_path}"')
    else:
        subprocess.Popen(f'explorer.exe "{target_path}"')
    print("SUCCESS_OPEN_EXPLORER")
else:
    print("PATH_NOT_FOUND")
