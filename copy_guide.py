import shutil
import os
import subprocess

desktop_dir = r"C:\Users\artas\Desktop\Guide_Aya_Images"
os.makedirs(desktop_dir, exist_ok=True)

src1 = r"C:\Users\artas\.gemini\antigravity\brain\05d6d2c1-91bb-4c6f-b06a-2040c83f4073\guide_aya_step1_1786802793534.jpg"
src2 = r"C:\Users\artas\.gemini\antigravity\brain\05d6d2c1-91bb-4c6f-b06a-2040c83f4073\guide_aya_step2_1786802805047.jpg"
src3 = r"C:\Users\artas\.gemini\antigravity\brain\05d6d2c1-91bb-4c6f-b06a-2040c83f4073\guide_aya_step3_1786802814653.jpg"

shutil.copy(src1, os.path.join(desktop_dir, "1_Connexion_Aya.jpg"))
shutil.copy(src2, os.path.join(desktop_dir, "2_Ecouter_et_Traduire.jpg"))
shutil.copy(src3, os.path.join(desktop_dir, "3_Ecrire_et_Envoyer.jpg"))

print("COPIED GUIDE IMAGES TO DESKTOP FOLDER:", desktop_dir)
subprocess.Popen(f'explorer.exe "{desktop_dir}"')
