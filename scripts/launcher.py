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

class DesktopBridge:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def save_file_dialog(self, filename, content, mime_type="text/plain"):
        """Opens native OS Save File dialog and writes file to user's chosen location."""
        if not self._window:
            return {"success": False, "error": "Native desktop window not ready"}
        try:
            import webview
            ext = os.path.splitext(filename)[1].lower()
            if ext == ".cptcg":
                file_types = ("Cyberpunk Deck (*.cptcg)", "All files (*.*)")
            elif ext == ".json":
                file_types = ("JSON Document (*.json)", "All files (*.*)")
            elif ext == ".csv":
                file_types = ("CSV Spreadsheet (*.csv)", "All files (*.*)")
            elif ext == ".txt":
                file_types = ("Text File (*.txt)", "All files (*.*)")
            else:
                file_types = (f"File (*{ext})", "All files (*.*)") if ext else ("All files (*.*)",)

            # Determine initial folder (Documents or User Home)
            initial_dir = os.path.expanduser("~/Documents")
            if not os.path.exists(initial_dir):
                initial_dir = os.path.expanduser("~")

            dialog_type = getattr(webview.FileDialog, 'SAVE', getattr(webview, 'SAVE_DIALOG', 30))
            result = self._window.create_file_dialog(
                dialog_type=dialog_type,
                directory=initial_dir,
                save_filename=filename,
                file_types=file_types
            )

            if not result:
                return {"success": False, "cancelled": True}

            selected_path = result[0] if isinstance(result, (list, tuple)) else result
            if not selected_path:
                return {"success": False, "cancelled": True}

            # Ensure proper extension if omitted by user
            if ext and not str(selected_path).lower().endswith(ext):
                selected_path = str(selected_path) + ext

            with open(selected_path, "w", encoding="utf-8") as f:
                f.write(content)

            return {
                "success": True,
                "path": str(selected_path),
                "filename": os.path.basename(selected_path)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_file_dialog(self):
        """Opens native OS Open File dialog and reads contents."""
        if not self._window:
            return {"success": False, "error": "Native desktop window not ready"}
        try:
            import webview
            file_types = (
                "Supported TCG Files (*.cptcg;*.json;*.txt;*.csv)",
                "Cyberpunk Deck (*.cptcg)",
                "JSON Data (*.json)",
                "Spreadsheet (*.csv)",
                "Text (*.txt)",
                "All files (*.*)"
            )
            initial_dir = os.path.expanduser("~/Documents")
            if not os.path.exists(initial_dir):
                initial_dir = os.path.expanduser("~")

            dialog_type = getattr(webview.FileDialog, 'OPEN', getattr(webview, 'OPEN_DIALOG', 10))
            result = self._window.create_file_dialog(
                dialog_type=dialog_type,
                directory=initial_dir,
                allow_multiple=False,
                file_types=file_types
            )

            if not result:
                return {"success": False, "cancelled": True}

            selected_path = result[0] if isinstance(result, (list, tuple)) else result
            if not selected_path or not os.path.exists(selected_path):
                return {"success": False, "cancelled": True}

            with open(selected_path, "r", encoding="utf-8") as f:
                content = f.read()

            return {
                "success": True,
                "path": str(selected_path),
                "filename": os.path.basename(selected_path),
                "content": content
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

def main():
    port, server = start_server()
    if not port:
        print("Failed to bind to a local port.")
        sys.exit(1)

    url = f"http://localhost:{port}/"

    # Try launching with pywebview
    try:
        import webview
        
        bridge = DesktopBridge()

        # Configure native window
        window = webview.create_window(
            title="CYBERPUNK TCG // NEURAL LINK",
            url=url,
            js_api=bridge,
            width=1400,
            height=900,
            min_size=(1000, 700),
            background_color='#07080d',
            text_select=False
        )
        bridge.set_window(window)
        
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
