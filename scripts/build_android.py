#!/usr/bin/env python3
"""
Cyberpunk TCG - Android APK Builder & Capacitor Sync Utility
Prepares web assets, card artwork, local database, and synchronizes the native Android Gradle project.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "src"
DATA_DIR = ROOT_DIR / "data"
ASSETS_DIR = ROOT_DIR / "assets"
DIST_DIR = ROOT_DIR / "dist"
ANDROID_BUILD_DIR = DIST_DIR / "android_build"
ANDROID_DIR = ROOT_DIR / "android"

def print_header(title):
    print("=" * 65)
    print(f"[*] WEIRDCO CYBERPUNK TCG // {title}")
    print("=" * 65)

def run_cmd(cmd, cwd=None):
    print(f"[*] Running: {cmd}")
    shell = True if sys.platform == 'win32' else False
    res = subprocess.run(cmd, shell=shell, cwd=cwd or ROOT_DIR)
    return res.returncode == 0

def prepare_web_bundle():
    print("\n[1/4] Preparing offline web application assets...")
    
    if ANDROID_BUILD_DIR.exists():
        shutil.rmtree(ANDROID_BUILD_DIR)
    ANDROID_BUILD_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Copy HTML
    shutil.copy2(SRC_DIR / "index.html", ANDROID_BUILD_DIR / "index.html")
    print("  [+] Copied index.html")

    # 2. Copy CSS
    shutil.copytree(SRC_DIR / "css", ANDROID_BUILD_DIR / "css")
    print("  [+] Copied css/ directory")

    # 3. Copy JS
    shutil.copytree(SRC_DIR / "js", ANDROID_BUILD_DIR / "js")
    print("  [+] Copied js/ directory (includes database.js & state store)")

    # 4. Copy Data
    shutil.copytree(DATA_DIR, ANDROID_BUILD_DIR / "data")
    print("  [+] Copied data/ directory (151 cards & starter decks)")

    # 5. Copy Assets & Card Art
    if ASSETS_DIR.exists():
        shutil.copytree(ASSETS_DIR, ANDROID_BUILD_DIR / "assets")
        card_count = len(list((ASSETS_DIR / "cards").glob("*.webp"))) if (ASSETS_DIR / "cards").exists() else 0
        print(f"  [+] Copied assets/ directory ({card_count} card artwork renders)")

    print("[+] Android web directory prepared at dist/android_build")

def check_capacitor():
    print("\n[2/4] Verifying Capacitor CLI...")
    npx_cmd = "npx.cmd" if sys.platform == 'win32' else "npx"
    try:
        res = subprocess.run([npx_cmd, "cap", "--version"], capture_output=True, text=True, shell=(sys.platform == 'win32'))
        if res.returncode == 0:
            print(f"  [+] Capacitor CLI detected: v{res.stdout.strip()}")
            return npx_cmd
    except Exception as e:
        pass
    print("  [!] Warning: Capacitor CLI not found in PATH. Run 'npm install' first.")
    return None

def sync_android_project(npx_cmd):
    print("\n[3/4] Synchronizing native Android project...")
    
    if not ANDROID_DIR.exists():
        print("  [*] Android project not found. Initializing with Capacitor...")
        success = run_cmd(f"{npx_cmd} cap add android")
        if not success:
            print("  [!] Failed to add Android platform. Make sure @capacitor/android is installed.")
            return False
    else:
        print("  [*] Existing Android project detected.")

    print("  [*] Syncing assets, plugins, and web build...")
    success = run_cmd(f"{npx_cmd} cap sync android")
    if not success:
        print("  [!] Sync failed.")
        return False

    # Adjust AndroidManifest permissions & configuration
    manifest_path = ANDROID_DIR / "app" / "src" / "main" / "AndroidManifest.xml"
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Ensure hardware acceleration and orientation support
            updated = False
            if 'android:usesCleartextTraffic' not in content:
                content = content.replace('<application', '<application android:usesCleartextTraffic="true"')
                updated = True

            if updated:
                with open(manifest_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print("  [+] Configured AndroidManifest.xml for offline WebView & cleartext traffic")
        except Exception as e:
            print(f"  [!] Note: Manifest tweak skipped: {e}")

    return True

def show_instructions():
    print_header("ANDROID APK BUILD COMPLETE & READY")
    gradlew_cmd = ".\\android\\gradlew.bat -p android assembleDebug" if sys.platform == 'win32' else "./android/gradlew -p android assembleDebug"
    
    # Check for Android SDK / local.properties
    local_prop = ANDROID_DIR / "local.properties"
    if not local_prop.exists():
        android_home = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
        if android_home and Path(android_home).exists():
            clean_path = str(Path(android_home).resolve()).replace('\\', '\\\\')
            with open(local_prop, "w", encoding="utf-8") as f:
                f.write(f"sdk.dir={clean_path}\n")
            print(f"  [+] Auto-configured android/local.properties with SDK at: {android_home}")

    print("\n[+] Next steps to compile and install the Android APK:")
    print("-----------------------------------------------------------------")
    print("Option A: Compile APK directly via command line (requires Android SDK):")
    print(f"   {gradlew_cmd}")
    print("\n   The compiled debug APK will be generated at:")
    print("   android/app/build/outputs/apk/debug/app-debug.apk")
    print("-----------------------------------------------------------------")
    print("Option B: Open in Android Studio (easiest, installs SDK automatically):")
    npx_cmd = "npx.cmd" if sys.platform == 'win32' else "npx"
    print(f"   {npx_cmd} cap open android")
    print("   Then click 'Build' > 'Build Bundle(s) / APK(s)' > 'Build APK(s)'.")
    print("-----------------------------------------------------------------")
    print("Option C: Re-sync after making any changes to cards, CSS, or code:")
    print(f"   python scripts/build_android.py")
    print("=" * 65)

def main():
    print_header("ANDROID APK BUNDLER & CAPACITOR SYNC")
    prepare_web_bundle()
    
    npx_cmd = check_capacitor()
    if not npx_cmd:
        print("\n[!] Please run 'npm install' to install dependencies before building Android.")
        sys.exit(1)

    if sync_android_project(npx_cmd):
        show_instructions()
    else:
        print("\n[!] Android sync could not be completed.")
        sys.exit(1)

if __name__ == '__main__':
    main()
