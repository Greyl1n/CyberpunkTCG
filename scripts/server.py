#!/usr/bin/env python3
"""
Cyberpunk TCG - Local Development Server
Serves the modular web app and provides easy access to the compiled monolith.
"""

import http.server
import socketserver
import os
import sys
import json
import webbrowser
from pathlib import Path

PORT = 8080
ROOT_DIR = Path(__file__).resolve().parent.parent

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.launcher import load_user_state, save_user_state

class CyberpunkHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def do_GET(self):
        # Route API for persistent user state (inventory & decks)
        if self.path.startswith('/api/user_state'):
            state_data = load_user_state()
            payload = json.dumps(state_data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Route API for Cardmarket prices
        if self.path.startswith('/api/cardmarket/prices'):
            prices_file = ROOT_DIR / 'data' / 'cardmarket_prices.json'
            if prices_file.exists():
                with open(prices_file, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_error(404, 'Prices dataset not found')
                return

        # Route API for AI Model Manifest & Status
        if self.path.startswith('/api/ai/status'):
            manifest_file = ROOT_DIR / 'models' / 'manifest.json'
            if manifest_file.exists():
                with open(manifest_file, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_error(404, 'AI Manifest not found')
                return

        # Route root '/' to the modular src/index.html
        if self.path in ('/', '/index.html'):
            self.path = '/src/index.html'
        elif self.path == '/monolith':
            self.path = '/dist/cyberpunk_tcg_monolith.html'
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/user_state'):
            try:
                length = int(self.headers.get('Content-Length', 0))
                raw_body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'
                updates = json.loads(raw_body)
                ok = save_user_state(updates)
                resp = json.dumps({"success": ok}).encode('utf-8')
                self.send_response(200 if ok else 500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
            except Exception as e:
                resp = json.dumps({"success": False, "error": str(e)}).encode('utf-8')
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
            return

        self.send_error(404, 'Endpoint not found')

def run_server():
    os.chdir(ROOT_DIR)
    
    # Ensure monolith is built
    import scripts.build_monolith as build_monolith
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
            with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
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
