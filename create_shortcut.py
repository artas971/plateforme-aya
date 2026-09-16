import os
import subprocess

vbs_content = r"""
Set WshShell = CreateObject("WScript.Shell")
Set objShortcut = WshShell.CreateShortcut("C:\Users\artas\Desktop\Message pour John.lnk")
objShortcut.TargetPath = "C:\Users\artas\Desktop\aya\message pour john"
objShortcut.Description = "Accès direct au dossier des messages et audios reçus pour John"
objShortcut.IconLocation = "shell32.dll,4"
objShortcut.Save
"""

vbs_path = r"C:\Users\artas\Desktop\aya\make_shortcut.vbs"
with open(vbs_path, "w", encoding="utf-8") as f:
    f.write(vbs_content)

subprocess.run(["cscript", "//nologo", vbs_path], check=True)
print("Raccourci 'Message pour John.lnk' créé avec succès sur le bureau !")
