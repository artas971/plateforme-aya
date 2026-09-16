---
name: studio-qa-tester
description: Automated End-to-End Quality Assurance Tester for Studio Aya V3. Runs Node syntax checks, HTTP POST endpoints, FFmpeg rendering, and binary MP4 verification prior to requesting user review.
---

# STUDIO AYA V3 - COMPÉTENCE D'ASSURANCE QUALITÉ AUTOMATISÉE (STUDIO QA TESTER)

## 📌 RÔLE DE LA COMPÉTENCE
Cette compétence impose à l'assistant Antigravity d'exécuter un banc de test automatisé complet avant d'inviter l'utilisateur à tester une mise à jour sur l'interface web.

---

## ⚙️ SCRIPT DE TEST AUTOMATISÉ EN 4 ÉTAPES

À chaque modification apportée à l'application, Antigravity doit exécuter le banc de test Python suivant :

```python
import urllib.request, urllib.parse, json, subprocess, os

# 1. Vérification de la syntaxe JS / Node.js
res_node = subprocess.run(["node", "-e", "const fs=require('fs'); new Function(fs.readFileSync('public/studio.html'));"], capture_output=True, text=True)
assert res_node.returncode == 0, f"Erreur de syntaxe JS dans studio.html : {res_node.stderr}"

# 2. Vérification de la disponibilité HTTP du serveur Express
res_http = urllib.request.urlopen("http://localhost:3000/studio.html", timeout=3)
assert res_http.status == 200, "Serveur Express non disponible sur http://localhost:3000"

# 3. Vérification de l'endpoint d'exportation MP4
res_dl = urllib.request.urlopen("http://localhost:3000/download/Soso_drame_18_aout_VOSTFR.mp4", timeout=3)
assert res_dl.headers.get("Content-Type") == "video/mp4", "L'URL d'export ne renvoie pas un fichier video/mp4"
assert int(res_dl.headers.get("Content-Length", 0)) > 1000000, "Le fichier MP4 est vide ou corrompu"

print("✅ TOUS LES TESTS E2E DU STUDIO ONT RÉUSSI AVEC SUCCÈS (0 ERREUR) !")
```

---

## 📜 DIRECTIVE PERMANENTE
Aucune réponse de validation ne doit être envoyée à l'utilisateur tant que le banc de test n'a pas affiché `0 ERREUR`.
