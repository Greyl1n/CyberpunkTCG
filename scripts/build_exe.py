#!/usr/bin/env python3
"""
Cyberpunk TCG - Windows Executable Builder (.exe)
Compiles the application, all 151 official card images, and data into a standalone Windows .exe.
"""

import os
import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def build_executable():
    print("=" * 60)
    print("CYBERPUNK TCG // COMPILING WINDOWS EXECUTABLE (.EXE)")
    print("=" * 60)

    # 1. Ensure monolith HTML is built first
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    import scripts.build_monolith as build_monolith
    build_monolith.build_monolith()

    # 2. Check assets existence
    assets_dir = ROOT_DIR / "assets" / "cards"
    if not assets_dir.exists() or len(list(assets_dir.glob("*.webp"))) == 0:
        print("[!] Warning: Local card assets missing! Running downloader...")
        import scripts.download_official_cards as dl
        dl.main()

    # 3. Construct PyInstaller command
    sep = ";" if os.name == "nt" else ":"
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name", "Cyberpunk_TCG",
        "--distpath", str(ROOT_DIR / "dist"),
        "--workpath", str(ROOT_DIR / "build"),
        "--specpath", str(ROOT_DIR / "scripts"),
        f"--icon={ROOT_DIR / 'assets' / 'icon.ico'}",
        f"--add-data={ROOT_DIR / 'assets'}{sep}assets",
        f"--add-data={ROOT_DIR / 'data'}{sep}data",
        f"--add-data={ROOT_DIR / 'dist' / 'cyberpunk_tcg_monolith.html'}{sep}dist",
        f"--add-data={ROOT_DIR / 'dist' / 'assets'}{sep}dist/assets",
        f"--add-data={ROOT_DIR / 'index.html'}{sep}.",
        f"--add-data={ROOT_DIR / 'src'}{sep}src",
        str(ROOT_DIR / "scripts" / "launcher.py")
    ]

    print("[*] Running PyInstaller command:")
    print("   ", " ".join(cmd))
    print("-" * 60)

    result = subprocess.run(cmd, cwd=str(ROOT_DIR))
    
    if result.returncode == 0:
        exe_path = ROOT_DIR / "dist" / "Cyberpunk_TCG.exe"
        if exe_path.exists():
            size_mb = exe_path.stat().st_size / (1024 * 1024)
            print("=" * 60)
            print(f"[SUCCESS] Standalone Executable created:")
            print(f"  Path: {exe_path}")
            print(f"  Size: {size_mb:.2f} MB")
            print("  Includes: 151 official card images, data, audio, and native GUI")
            print("=" * 60)
            return exe_path
        else:
            print("[!] PyInstaller succeeded but exe was not found at expected path.")
            return None
    else:
        print(f"[!] PyInstaller failed with exit code: {result.returncode}")
        return None

if __name__ == "__main__":
    build_executable()
