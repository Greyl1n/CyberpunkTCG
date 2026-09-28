#!/usr/bin/env python3
"""
Cyberpunk TCG - Linux Standalone Executable Builder
Compiles the application, all card images, and datasets into a standalone Linux binary.
Compatible with Fedora, Ubuntu, Debian, and other Linux distributions.
"""

import os
import sys
import subprocess
from pathlib import Path

def get_root_dir():
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "src").exists() and (p / "data").exists():
            return p
        p = p.parent
    return Path(__file__).resolve().parents[2]

ROOT_DIR = get_root_dir()

def build_standalone():
    print("=" * 65)
    print("⚡ CYBERPUNK TCG // COMPILING LINUX STANDALONE EXECUTABLE")
    print("=" * 65)

    # 1. Compile monolith HTML bundle first
    monolith_script = ROOT_DIR / "scripts" / "build_monolith.py"
    if monolith_script.exists():
        print("[*] Rebuilding monolith HTML bundle...")
        sys.path.insert(0, str(ROOT_DIR))
        import scripts.build_monolith as build_monolith
        build_monolith.build_monolith()
    else:
        print("[!] Warning: scripts/build_monolith.py not found.")

    # 2. Verify assets existence
    assets_dir = ROOT_DIR / "assets" / "cards"
    if not assets_dir.exists() or len(list(assets_dir.glob("*.webp"))) == 0:
        print("[!] Warning: Local card assets missing! Attempting download...")
        dl_script = ROOT_DIR / "scripts" / "download_official_cards.py"
        if dl_script.exists():
            import scripts.download_official_cards as dl
            dl.main()

    # 3. Path separator for PyInstaller data specs (':' on Linux/POSIX)
    sep = ":" if os.name != "nt" else ";"

    output_name = "Cyberpunk_TCG_Linux"
    dist_dir = ROOT_DIR / "dist"
    work_dir = ROOT_DIR / "build" / "linux"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name", output_name,
        "--distpath", str(dist_dir),
        "--workpath", str(work_dir),
        "--specpath", str(ROOT_DIR / "scripts" / "linux"),
        f"--icon={ROOT_DIR / 'assets' / 'icon.png'}",
        f"--add-data={ROOT_DIR / 'assets'}{sep}assets",
        f"--add-data={ROOT_DIR / 'data'}{sep}data",
        f"--add-data={ROOT_DIR / 'dist' / 'cyberpunk_tcg_monolith.html'}{sep}dist",
        f"--add-data={ROOT_DIR / 'dist' / 'assets'}{sep}dist/assets",
        f"--add-data={ROOT_DIR / 'index.html'}{sep}.",
        f"--add-data={ROOT_DIR / 'src'}{sep}src",
        str(ROOT_DIR / "scripts" / "launcher.py")
    ]

    print("[*] Executing PyInstaller command:")
    print("   ", " ".join(cmd))
    print("-" * 65)

    result = subprocess.run(cmd, cwd=str(ROOT_DIR))

    if result.returncode == 0:
        bin_path = dist_dir / output_name
        if bin_path.exists():
            # Ensure Linux executable bit is set
            try:
                os.chmod(bin_path, 0o755)
            except Exception:
                pass

            size_mb = bin_path.stat().st_size / (1024 * 1024)
            print("=" * 65)
            print(f"[SUCCESS] Standalone Linux Executable created:")
            print(f"  Path: {bin_path}")
            print(f"  Size: {size_mb:.2f} MB")
            print("  Compatibility: Fedora, Ubuntu, Debian, Arch")
            print("  Run with: ./dist/Cyberpunk_TCG_Linux")
            print("=" * 65)
            return bin_path
        else:
            print("[!] PyInstaller finished but output binary was not found.")
            return None
    else:
        print(f"[!] PyInstaller compilation failed with code: {result.returncode}")
        return None

if __name__ == "__main__":
    build_standalone()
