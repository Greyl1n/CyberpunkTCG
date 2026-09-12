#!/usr/bin/env python3
"""
Cyberpunk TCG - Local Development Server
Serves the modular web app and provides easy access to the compiled monolith.
"""

import http.server
import socketserver
import os
import sys
import webbrowser
from pathlib import Path

PORT = 8080
ROOT_DIR = Path(__file__).resolve().parent

class CyberpunkHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def do_GET(self):
        # Route root '/' to the modular src/index.html
        if self.path in ('/', '/index.html'):
            self.path = '/src/index.html'
        elif self.path == '/monolith':
            self.path = '/dist/cyberpunk_tcg_monolith.html'
        return super().do_GET()

def run_server():
    os.chdir(ROOT_DIR)
    
    # Ensure monolith is built
    import build_monolith
    try:
        build_monolith.build_monolith()
    except Exception as e:
        print(f"[!] Warning: Monolith build failed during startup: {e}")

    handler = CyberpunkHTTPRequestHandler
    
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    
    port = PORT
    for _ in range(10):
        try:
            with socketserver.TCPServer(("", port), handler) as httpd:
                print("=" * 60)
                print("⚡ CYBERPUNK TCG // NEURAL LINK SERVER ACTIVE")
                print("=" * 60)
                print(f"[*] Modular Dev App:   http://localhost:{port}/")
                print(f"[*] Standalone Monolith: http://localhost:{port}/monolith")
                print(f"[*] Local File Monolith: file://{ROOT_DIR / 'dist' / 'cyberpunk_tcg_monolith.html'}")
                print("=" * 60)
                print("Press Ctrl+C to terminate server.")
                httpd.serve_forever()
                break
        except OSError:
            port += 1

if __name__ == '__main__':
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n[!] Disconnected from Cyberspace.")
        sys.exit(0)
