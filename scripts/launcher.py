#!/usr/bin/env python3
"""
Cyberpunk TCG - Desktop Application Launcher
Serves the bundled application and opens a native desktop window via pywebview.
"""

import os
import sys
import threading
import http.server
import socketserver
import webbrowser
from pathlib import Path

def get_base_dir():
    """Get the base directory where assets and data live (handles PyInstaller temp folder)."""
    if getattr(sys, 'frozen', False):
        # Running inside PyInstaller bundle
        return Path(sys._MEIPASS)
    else:
        # Running in standard Python environment
        return Path(__file__).resolve().parent.parent

BASE_DIR = get_base_dir()

class CyberpunkServerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            root_index = BASE_DIR / 'index.html'
            monolith = BASE_DIR / 'dist' / 'cyberpunk_tcg_monolith.html'
            if root_index.exists():
                self.path = '/index.html'
            elif monolith.exists():
                self.path = '/dist/cyberpunk_tcg_monolith.html'
            else:
                self.path = '/src/index.html'
        return super().do_GET()

    def list_directory(self, path):
        # Disable directory listing for security
        self.send_error(403, "Directory listing is forbidden")
        return None

    def log_message(self, format, *args):
        # Silence HTTP console logs
        pass

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    port = 8080
    for _ in range(30):
        try:
            httpd = socketserver.TCPServer(("127.0.0.1", port), CyberpunkServerHandler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            return port, httpd
        except OSError:
            port += 1
    return None, None

def main():
    port, server = start_server()
    if not port:
        print("Failed to bind to a local port.")
        sys.exit(1)

    url = f"http://localhost:{port}/"

    # Try launching with pywebview
    try:
        import webview
        
        # Configure native window
        window = webview.create_window(
            title="CYBERPUNK TCG // NEURAL LINK (WEIRDCO OFFICIAL)",
            url=url,
            width=1400,
            height=900,
            min_size=(1000, 700),
            background_color='#07080d',
            text_select=False
        )
        
        webview.start(debug=False)
    except Exception as e:
        # Fallback to default browser
        webbrowser.open(url)
        # Keep process alive if browser fallback
        import time
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    main()
