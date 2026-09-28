#!/usr/bin/env python3
"""
Cyberpunk TCG - Production Container Web Server (Hardened)
Multithreaded, secure, zero-external-dependency web server for hosting Cyberpunk TCG online
or running inside Docker/Podman containers.
"""

import http.server
import socketserver
import os
import sys
import signal
import urllib.parse
from pathlib import Path

# Ensure UTF-8 output encoding across all operating systems
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Paths
def get_root_dir():
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "src").exists() and (p / "data").exists():
            return p
        p = p.parent
    return Path(__file__).resolve().parents[2]

ROOT_DIR = get_root_dir()
DIST_DIR = ROOT_DIR / "dist"
MONOLITH_PATH = DIST_DIR / "cyberpunk_tcg_monolith.html"
SRC_INDEX = ROOT_DIR / "src" / "index.html"

# Configuration from environment variables
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

# Whitelisted path prefixes permitted for public HTTP serving
ALLOWED_PUBLIC_PREFIXES = ("/dist/", "/assets/", "/data/", "/src/")

# Forbidden extensions and sensitive names
FORBIDDEN_EXTENSIONS = (
    ".py", ".pyc", ".sh", ".bash", ".yml", ".yaml", ".env", ".md",
    ".git", ".gitignore", ".dockerignore", "dockerfile"
)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Multithreaded HTTP Server with daemon threads to prevent DoS connection hanging."""
    daemon_threads = True
    allow_reuse_address = True

class ProductionTCGHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def is_path_safe(self, path: str) -> bool:
        """Enforce strict path traversal prevention and file-type access controls."""
        parsed_path = urllib.parse.urlparse(path).path
        clean_path = os.path.normpath(urllib.parse.unquote(parsed_path))

        # Block any path attempting directory traversal
        if ".." in clean_path.split(os.sep):
            return False

        # Normalize with leading slash
        norm_url = clean_path.replace("\\", "/")
        if not norm_url.startswith("/"):
            norm_url = "/" + norm_url

        # Check for hidden files/folders (.git, .env, etc.)
        parts = [p for p in norm_url.split("/") if p]
        for part in parts:
            if part.startswith("."):
                return False

        # Check for forbidden extensions
        lower_path = norm_url.lower()
        for ext in FORBIDDEN_EXTENSIONS:
            if lower_path.endswith(ext) or ext in parts:
                return False

        # Allow root routes
        if norm_url in ("/", "/index.html", "/monolith"):
            return True

        # Restrict serving to allowed asset prefixes
        if any(norm_url.startswith(prefix) for prefix in ALLOWED_PUBLIC_PREFIXES):
            # Ensure physical file is strictly inside ROOT_DIR
            resolved_target = (ROOT_DIR / norm_url.lstrip("/")).resolve()
            try:
                resolved_target.relative_to(ROOT_DIR)
                return True
            except ValueError:
                return False

        return False

    def do_GET(self):
        # 1. Healthcheck endpoint for Docker / Kubernetes / Cloud monitors
        if self.path in ("/health", "/healthz", "/ping"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(b'{"status":"healthy","service":"cyberpunk_tcg"}\n')
            return

        # 2. Path safety check
        if not self.is_path_safe(self.path):
            self.send_error(403, "Access forbidden")
            return

        # 3. Route root '/' or '/monolith' to the standalone monolith HTML bundle
        clean_url = urllib.parse.urlparse(self.path).path
        if clean_url in ('/', '/index.html', '/monolith'):
            root_index = ROOT_DIR / 'index.html'
            if root_index.exists():
                self.path = '/index.html'
            elif MONOLITH_PATH.exists():
                self.path = '/dist/cyberpunk_tcg_monolith.html'
            elif SRC_INDEX.exists():
                self.path = '/src/index.html'

        return super().do_GET()

    def list_directory(self, path):
        """Disable directory browsing to protect against information disclosure."""
        self.send_error(403, "Directory listing is forbidden")
        return None

    def end_headers(self):
        # Security and caching headers
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        self.send_header("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data: blob:;")

        if self.path.endswith((".webp", ".png", ".jpg", ".mp3", ".wav")):
            # Long cache for static game media
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

    def log_message(self, format, *args):
        # Clean production log output
        sys.stdout.write(f"[{self.log_date_time_string()}] {self.client_address[0]} - {args[0]}\n")
        sys.stdout.flush()

def ensure_monolith_built():
    """Ensure dist/cyberpunk_tcg_monolith.html is compiled and available."""
    if not MONOLITH_PATH.exists():
        print("[*] Monolith HTML not found. Compiling now...")
        sys.path.insert(0, str(ROOT_DIR))
        import scripts.build_monolith as build_monolith
        build_monolith.build_monolith()

def main():
    ensure_monolith_built()

    httpd = ThreadedHTTPServer((HOST, PORT), ProductionTCGHandler)

    def shutdown_handler(signum, frame):
        print("\n[*] Gracefully shutting down Cyberpunk TCG server...")
        httpd.server_close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    print("=" * 65)
    print("⚡ CYBERPUNK TCG // SECURE PRODUCTION SERVER RUNNING")
    print("=" * 65)
    print(f"[*] Bound to:      http://{HOST}:{PORT}/")
    print(f"[*] Architecture:  Multithreaded (concurrent connections)")
    print(f"[*] Directory List: Disabled (403 Forbidden)")
    print(f"[*] Healthcheck:   http://{HOST}:{PORT}/health")
    print("=" * 65)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        shutdown_handler(None, None)

if __name__ == "__main__":
    main()
