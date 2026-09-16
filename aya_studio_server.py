import http.server, socketserver, webbrowser, os, sys

PORT = 8080
DIRECTORY = r'c:\Users\artas\Desktop\aya'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

print(f"=== SERVEUR STUDIO AGENT TRADUCTEUR AYA V3 ===")
print(f"Lancement du Studio sur http://localhost:{PORT}/aya_studio.html ...")

webbrowser.open(f"http://localhost:{PORT}/aya_studio.html")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrêté avec succès.")
