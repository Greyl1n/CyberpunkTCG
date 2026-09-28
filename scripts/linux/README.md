# Cyberpunk TCG // Standalone Linux Desktop App

This folder contains the build configuration, scripts, and desktop integration for compiling and running the **native standalone Linux executable** (`Cyberpunk_TCG_Linux`) on **Fedora, Ubuntu, Debian, and other Linux distributions**.

---

## ⚡ Features
- **Zero-Dependency Portable Binary:** Bundles Python runtime, native GUI window (`pywebview`), 151 official card images, and audio engine into a single executable file.
- **Cross-Distro Compatibility:** Tested and compatible with both RPM-based (Fedora/RHEL) and DEB-based (Ubuntu/Debian) distributions.
- **Automatic Browser Fallback:** If native GTK/WebKit libraries are absent, the executable automatically opens the app in your default web browser without crashing.

---

## 🚀 How to Build

You have two choices to build the executable:

### Option A: Direct Native Build (Fastest on Linux)

1. **Install Prerequisites (One-time):**
   - **On Fedora:**
     ```bash
     sudo dnf install python3 python3-pip webkit2gtk4.0
     ```
   - **On Ubuntu / Debian:**
     ```bash
     sudo apt update && sudo apt install -y python3 python3-pip libwebkit2gtk-4.0-37
     # (or libwebkit2gtk-4.1-0 on Ubuntu 24.04+)
     ```

2. **Run Build Script:**
   ```bash
   bash scripts/linux/build.sh
   ```
   *The binary will be generated at `dist/Cyberpunk_TCG_Linux`.*

---

### Option B: Build via Container (No local build tools needed)

If you don't want to install Python development tools locally, or if you want to ensure universal `glibc` backward-compatibility, build inside a container using **Podman** (Fedora) or **Docker** (Ubuntu/Debian):

```bash
bash scripts/linux/build_with_container.sh
```

---

## 🎮 Running the Application

After building, launch the executable directly from the repository root:

```bash
./dist/Cyberpunk_TCG_Linux
```

---

## 🖥️ Install Desktop Icon & Application Menu Shortcut

To add Cyberpunk TCG to your GNOME, KDE, or XFCE application menu:

```bash
bash scripts/linux/install_desktop_shortcut.sh
```

You can now search for and launch **"Cyberpunk TCG"** like any native application!
