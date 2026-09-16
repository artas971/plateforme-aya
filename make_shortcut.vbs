
Set WshShell = CreateObject("WScript.Shell")
Set objShortcut = WshShell.CreateShortcut("C:\Users\artas\Desktop\Message pour John.lnk")
objShortcut.TargetPath = "C:\Users\artas\Desktop\aya\message pour john"
objShortcut.Description = "Accès direct au dossier des messages et audios reçus pour John"
objShortcut.IconLocation = "shell32.dll,4"
objShortcut.Save
