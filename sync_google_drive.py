#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Module d'ingestion automatisée Google Drive - Plateforme Aya
Télécharge les nouveaux fichiers audio et vidéo déposés dans un dossier Google Drive partagé.
Garantit la déduplication et l'intégrité des médias avant injection dans le pipeline.
"""

import os
import sys
import io
import re
import json
import time
import argparse
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Imports clients Google Cloud
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    from googleapiclient.errors import HttpError
except ImportError:
    print("[ERREUR] Les modules google-api-python-client et google-auth ne sont pas installés.")
    print("Installez-les via : pip install google-api-python-client google-auth")
    sys.exit(1)

# Chargement de l'environnement
load_dotenv()

# Extensions de fichiers média acceptées
VALID_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".opus", ".wma"}
VALID_VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi", ".webm"}
VALID_EXTENSIONS = VALID_AUDIO_EXTENSIONS.union(VALID_VIDEO_EXTENSIONS)

LEDGER_FILE = Path("drive_synced_files.json")
DEFAULT_TARGET_DIR = Path("audio_a_traiter")
DEFAULT_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def sanitize_filename(filename: str) -> str:
    """Nettoie le nom de fichier pour éviter les conflits d'encodage et de shell."""
    name, ext = os.path.splitext(filename)
    clean_name = re.sub(r"[^\w\-_.]", "_", name)
    clean_name = re.sub(r"_+", "_", clean_name).strip("_")
    if not clean_name:
        clean_name = f"media_{int(time.time())}"
    return f"{clean_name}{ext.lower()}"


def load_sync_ledger() -> dict:
    """Charge l'historique des fichiers déjà synchronisés."""
    if LEDGER_FILE.exists():
        try:
            with open(LEDGER_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ATTENTION] Impossible de lire {LEDGER_FILE} ({e}). Réinitialisation du registre.")
    return {"synced_files": {}}


def save_sync_ledger(ledger: dict):
    """Enregistre l'historique des fichiers synchronisés de manière atomique."""
    temp_file = LEDGER_FILE.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2, ensure_ascii=False)
    temp_file.replace(LEDGER_FILE)


def init_drive_service(credentials_path: str):
    """Initialise et authentifie le client Google Drive API via Service Account."""
    if not os.path.exists(credentials_path):
        raise FileNotFoundError(
            f"Fichier de clé du compte de service introuvable : '{credentials_path}'.\n"
            f"Veuillez créer un compte de service sur Google Cloud Console et déposer le JSON."
        )

    creds = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=DEFAULT_SCOPES
    )
    return build("drive", "v3", credentials=creds)


def list_files_in_folder(service, folder_id: str) -> list:
    """Liste récursivement les fichiers non supprimés présents dans le dossier Google Drive."""
    query = f"'{folder_id}' in parents and trashed = false"
    items = []
    page_token = None

    while True:
        results = (
            service.files()
            .list(
                q=query,
                pageSize=100,
                fields="nextPageToken, files(id, name, mimeType, size, modifiedTime)",
                pageToken=page_token,
            )
            .execute()
        )
        items.extend(results.get("files", []))
        page_token = results.get("nextPageToken")
        if not page_token:
            break

    return items


def download_drive_file(service, file_id: str, destination_path: Path) -> bool:
    """Télécharge un fichier Google Drive en streaming par morceaux (chunks)."""
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request, chunksize=1024 * 1024 * 2)  # 2MB chunks

    done = False
    print(f"  -> Téléchargement en cours...", end="", flush=True)
    while not done:
        status, done = downloader.next_chunk()
        if status:
            print(f" {int(status.progress() * 100)}%", end="", flush=True)
    print(" [OK]")

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    with open(destination_path, "wb") as f:
        f.write(fh.getvalue())

    return True


def sync_drive(
    credentials_path: str = None,
    folder_id: str = None,
    target_dir: Path = DEFAULT_TARGET_DIR,
    dry_run: bool = False,
    auto_trigger_pipeline: bool = False,
) -> list:
    """
    Exécute un cycle complet de synchronisation Google Drive.
    Retourne la liste des chemins locaux des fichiers nouvellement téléchargés.
    """
    creds_file = credentials_path or os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "google_service_account.json")
    target_folder = folder_id or os.getenv("GOOGLE_DRIVE_FOLDER_ID")

    if not target_folder:
        print("[ERREUR] L'ID du dossier Google Drive n'est pas configuré.")
        print("Veuillez définir GOOGLE_DRIVE_FOLDER_ID dans votre fichier .env ou passer --folder-id.")
        return []

    if not os.path.exists(creds_file):
        print(f"[ERREUR] Le fichier d'authentification '{creds_file}' n'existe pas.")
        print("Téléchargez la clé JSON du compte de service depuis Google Cloud et placez-la ici.")
        return []

    print("=" * 60)
    print("      SYNCHRONISATION GOOGLE DRIVE -> PLATEFORME AYA")
    print("=" * 60)
    print(f"Dossier Drive ID     : {target_folder}")
    print(f"Clé Service Account  : {creds_file}")
    print(f"Dossier destination  : {target_dir.resolve()}")
    print(f"Mode simulation      : {'Oui (--dry-run)' if dry_run else 'Non'}")
    print("-" * 60)

    try:
        service = init_drive_service(creds_file)
        files = list_files_in_folder(service, target_folder)
    except HttpError as err:
        print(f"[ERREUR API GOOGLE] : {err}")
        if "404" in str(err):
            print("Astuce : Vérifiez que l'ID du dossier est correct et qu'il est partagé avec le compte de service.")
        return []
    except Exception as e:
        print(f"[ERREUR] Échec de l'initialisation Google Drive : {e}")
        return []

    print(f"[INFO] {len(files)} élément(s) détecté(s) dans le dossier distant.")

    ledger = load_sync_ledger()
    synced_map = ledger.setdefault("synced_files", {})
    newly_downloaded = []

    for file_info in files:
        file_id = file_info.get("id")
        orig_name = file_info.get("name", "sans_nom")
        file_size = int(file_info.get("size", 0)) if file_info.get("size") else 0
        mime_type = file_info.get("mimeType", "")
        _, ext = os.path.splitext(orig_name)

        is_media = (
            ext.lower() in VALID_EXTENSIONS
            or mime_type.startswith("audio/")
            or mime_type.startswith("video/")
        )

        if not is_media:
            print(f"[PASSÉ] Ignoré (type non média) : {orig_name} ({mime_type})")
            continue

        if file_id in synced_map:
            continue

        safe_name = sanitize_filename(orig_name)
        dest_file = target_dir / safe_name

        if dest_file.exists():
            stem = dest_file.stem
            dest_file = target_dir / f"{stem}_{file_id[:6]}{dest_file.suffix}"

        print(f"\n[NOUVEAU MÉDIA DÉTECTÉ] : {orig_name} -> {dest_file.name} ({file_size / (1024*1024):.2f} MB)")

        if dry_run:
            print("  (Mode dry-run actif, aucun téléchargement)")
            continue

        success = download_drive_file(service, file_id, dest_file)
        if success:
            synced_map[file_id] = {
                "original_name": orig_name,
                "local_path": str(dest_file.resolve()),
                "size_bytes": file_size,
                "mime_type": mime_type,
                "synced_at": datetime.utcnow().isoformat(),
            }
            save_sync_ledger(ledger)
            newly_downloaded.append(dest_file)

            if auto_trigger_pipeline:
                print(f"[PIPELINE] Déclenchement automatique du studio v3 pour : {dest_file.name}")
                cmd = f'py run_studio_v3_full_pipeline.py --input "{dest_file.resolve()}" --output "studio_v3_output"'
                os.system(cmd)

    print("\n" + "=" * 60)
    print(f"RÉSUMÉ : {len(newly_downloaded)} nouveau(x) fichier(s) ingéré(s).")
    print("=" * 60)

    return newly_downloaded


def main():
    parser = argparse.ArgumentParser(description="Synchronisation automatique de médias depuis Google Drive")
    parser.add_argument("--credentials", help="Chemin du fichier JSON de clé Service Account", default=None)
    parser.add_argument("--folder-id", help="ID du dossier Google Drive source", default=None)
    parser.add_argument("--target-dir", help="Dossier local de destination", default=str(DEFAULT_TARGET_DIR))
    parser.add_argument("--dry-run", action="store_true", help="Lister sans télécharger")
    parser.add_argument("--auto-process", action="store_true", help="Lancer automatiquement le pipeline v3")
    parser.add_argument("--poll", action="store_true", help="Tourner en boucle de surveillance")
    parser.add_argument("--interval", type=int, default=60, help="Intervalle en secondes entre chaque scrutation (si --poll)")

    args = parser.parse_args()
    target_path = Path(args.target_dir)

    if args.poll:
        print(f"[VEILLE] Démarrage du mode surveillance toutes les {args.interval} secondes. Ctrl+C pour arrêter.")
        try:
            while True:
                sync_drive(
                    credentials_path=args.credentials,
                    folder_id=args.folder_id,
                    target_dir=target_path,
                    dry_run=args.dry_run,
                    auto_trigger_pipeline=args.auto_process,
                )
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n[ARRÊT] Surveillance arrêtée par l'utilisateur.")
    else:
        sync_drive(
            credentials_path=args.credentials,
            folder_id=args.folder_id,
            target_dir=target_path,
            dry_run=args.dry_run,
            auto_trigger_pipeline=args.auto_process,
        )


if __name__ == "__main__":
    main()
