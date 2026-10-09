# Cyberpunk TCG // Fan Companion & Deck Builder

An interactive companion, card inventory manager, and deck builder for the **Cyberpunk Trading Card Game** (*Welcome to Night City* set).

> [!NOTE]
> **Disclaimer & Non-Affiliation:** This is an independent fan-made companion tool. This project is not affiliated with, endorsed by, or supported by WeirdCo Games, CD PROJEKT RED, R. Talsorian Games, or any related entity. All card names, game mechanics, and artwork remain the property of their respective owners.

---

## ⚡ Key Features

- **🖥️ Standalone Windows Desktop App (`dist/Cyberpunk_TCG.exe`):**
  - Completely self-contained `.exe` bundling Python runtime, native desktop GUI window, all 151 card images, and audio engine.
  - Zero dependencies or installation required.

- **🌐 Zero-Dependency Monolith HTML (`dist/cyberpunk_tcg_monolith.html`):**
  - Standalone single-file application with all HTML, CSS, JavaScript, datasets, and starter decks inlined.
  - Runs in any modern browser (Chrome, Edge, Firefox) completely offline.

- **🗃️ 151 Indexed Cards & Artwork:**
  - Complete database covering the *Welcome to Night City* release and expansion pack.
  - **151 high-resolution card artwork renders** stored locally in `assets/cards/` for 100% offline access.
  - Authentic characters: **V (Streetkid), Adam Smasher (Ender of Legends), Johnny Silverhand (Rocking Renegade), Yorinobu Arasaka, Rogue Amendiares, Dexter DeShawn, Rebecca**, and more.
  - Complete card anatomy and stats:
    - **Card Types:** `Legend`, `Unit`, `Program`, `Gear`.
    - **Factions / Colors:** `Red`, `Yellow`, `Green`, `Blue`.
    - **Cost in Eddies (€$)**, **RAM**, **Power**, and **Sell Tags (€$)**.

- **📦 Personal Inventory & Playset Tracker:**
  - Starts empty by default (`0` cards owned).
  - Direct numerical input on every card: click into the box and type your owned count, or use `+` / `-`.
  - Live collection dashboard: **Total Cards Owned**, **Unique Cards Collected**, **Full Playsets (3+ copies)**, and **Completion %**.
  - Quick filters: `In Inventory (>0)`, `Missing (0)`, `Need Playset (<3)`.
  - Batch collection utilities: Set all 1x, Set all 3x playset, or Reset all to 0.
  - **📦 Complete Inventory Export & Backup:** Export entire collection to **Full JSON Backup (`.json`)**, **Spreadsheet (`.csv`)**, or **Text Checklist (`.txt`)** with instant **Save to File** or **Copy to Clipboard**. Supports filtering to only owned cards (`>0`).

- **🔍 Full Card Inspector Modal:**
  - Multi-tier resilient image resolution with active DOM cache and directory fallbacks.
  - Dynamic neon glow matching each card's faction color.
  - Click any active Legend in the 3-Legend Zone or card name in the deck list to inspect.
  - Dismissible with close button, backdrop click, or `Escape` key.

- **🛠️ Tournament Deck Builder:**
  - Enforces tournament rules:
    - **Exactly 3 Legends** required.
    - **40 to 50 Cards** in main deck.
    - **Max 3 copies** of any non-Legend card.
    - **RAM Requirement Validation**.
  - Dedicated **3-Legend Identity Zone** with full thumbnail visibility, RAM telemetry, and click-to-inspect.
  - Real-time **Eddie Cost (€$) Curve** and cumulative RAM telemetry.

- **⚡ 59 Core & Community Decks:**
  - **4 Core Starter Decks** (*Arasaka Embracing Destruction*, *The Heist*, *Afterlife Syndicate*, *Arasaka Corporate Dynasty*).
  - **55 Community Decks** curated directly from [cyberpunktcg.com/decks?tab=community](https://cyberpunktcg.com/decks?tab=community).
  - Searchable by name, author, archetype, or color.
  - Faction-themed **"⚡ Load into Deck Builder"** buttons matching each deck's primary color.

- **📤 Deck & Inventory Sharing, Backup & File Downloads:**
  - **Export Decks:** Export via compact Base64 codes (`CPTCG_...`), formatted text decklists, or raw JSON, with **💾 Save to File** (`.cptcg`, `.txt`, `.json`) and **📋 Copy to Clipboard**.
  - **Universal Import:** 1-click import supporting deck codes, deck JSON, text lists, and full inventory JSON backups.

---

## 🚀 How to Run

### Option 1: Standalone Monolith HTML (Browser Version)
Open directly in any browser:
```
dist/cyberpunk_tcg_monolith.html
```

### Option 2: Standalone Windows Executable (.exe)
Launch directly from file explorer:
```
dist/Cyberpunk_TCG.exe
```

### Option 3: Standalone Linux Desktop App (Fedora & Ubuntu)
Launch the native Linux standalone binary:
```bash
./dist/Cyberpunk_TCG_Linux
```
*(See `scripts/linux/README.md` to build or install desktop shortcut).*

### Option 4: Production Container / Online Server (Docker / Podman)
Run the web application container locally or on a remote VPS:
```bash
# On Fedora / RHEL (Podman):
bash scripts/container/run_podman.sh

# On Ubuntu / Debian (Docker):
bash scripts/container/run_docker.sh
```
Access at: `http://localhost:8080/`
*(See `scripts/container/README.md` for full cloud deployment & Nginx SSL instructions).*

### Option 5: Local Development Server
```powershell
python scripts/server.py
```
- Modular App: http://localhost:8080/
- Monolith Bundle: http://localhost:8080/monolith

### Option 6: Android APK (Phone & Tablet)
Build and run on any Android device with offline database and responsive phone/tablet scaling:
```powershell
# Sync assets & build Android project:
python scripts/build_android.py

# Compile debug APK:
.\android\gradlew.bat -p android assembleDebug

# Or open in Android Studio:
npx cap open android
```
Output APK location: `dist/Cyberpunk_TCG.apk` (and `android/app/build/outputs/apk/debug/app-debug.apk`)

---

## 🛠️ Build Scripts

All build, helper, packaging, and scraping scripts are neatly organized in the `scripts/` directory:

### Rebuild Monolith HTML
```powershell
python scripts/build_monolith.py
```

### Build & Sync Android APK Project
```powershell
python scripts/build_android.py
```

### Rebuild Windows Executable (.exe)
```powershell
python scripts/build_exe.py
```

### Rebuild Linux Standalone Executable
```bash
# On Linux:
bash scripts/linux/build.sh

# Or via isolated container (Podman/Docker):
bash scripts/linux/build_with_container.sh
```

### Run Unit Tests
```powershell
python -m unittest discover tests
```

---

## 🧠 CyberVision AI Neural Scanner (v2.0)

The v2.0 scanner replaces legacy rigid OCR with an edge computer vision and vector embedding pipeline:
1. **Real-Time Auto-Framing & Deskewing**: An edge contour quadrilateral detector locates cards anywhere in the camera feed at any tilt or angle, applying a 4-point homography transform to flatten it automatically.
2. **256-D Perceptual Visual Embeddings**: Generates multi-scale spatial and frequency-domain embeddings and matches against pre-indexed card fingerprints in `< 10ms` with high confidence.
3. **Updatability Pipeline**: To add new cards or update the AI model without retraining from scratch:
```powershell
# Check index status:
python scripts/ai/update_cards_ai.py --status

# Incremental update (indexes any new or modified cards in data/cards.json):
python scripts/ai/update_cards_ai.py

# Force full re-index:
python scripts/ai/update_cards_ai.py --force
```

---

## 📁 Repository Structure

```
Cyberpunk_TCG/
├── index.html                  # Standalone monolith HTML (1-click run & GitHub Pages)
├── LICENSE                     # Creative Commons Attribution-NonCommercial 4.0 International
├── README.md                   # Complete documentation
├── INSTRUCTIONS.md             # Linux & Container deployment manual
├── .gitignore                  # Git ignore rules for build artifacts and large binaries
├── package.json                # Capacitor bridge configuration
├── capacitor.config.json       # Android runtime configuration
│
├── src/                        # Modular web application source code
│   ├── index.html              # Main application template
│   ├── css/                    # Modular styles (base, cards, components, scanner)
│   └── js/                     # Modular controllers (state, audio, deck_builder, scanner, etc.)
│
├── data/                       # Card datasets and rules
│   ├── cards.json              # 151 cards with complete stats & rules
│   ├── starter_decks.json      # 59 starter and community tournament legal decks
│   ├── cardmarket_prices.json  # Live pricing data from Cardmarket
│   ├── sets.json               # Expansion sets manifest
│   └── rules_manifest.json     # Deck building constraints & tournament rules
│
├── assets/                     # 151 high-resolution card artwork renders (.webp)
│   ├── cards/                  # Offline card artwork library
│   ├── background.webp         # Cyberpunk theme background
│   ├── logo.png                # Application branding logo
│   └── icon.ico / icon.png     # Application icons
│
├── models/                     # AI Vision model weights & manifest
│   └── manifest.json           # Active neural engine metadata & configuration
│
├── android/                    # Native Android Studio / Gradle project (Capacitor)
├── dist/                       # Output distribution packages (APK, EXE, Monolith HTML)
├── tests/                      # Automated unit test suite (tcg logic & AI vision)
│
└── scripts/                    # ALL HELPER, BUILD, AND MAINTENANCE SCRIPTS
    ├── build_monolith.py       # Monolith single-file HTML bundle compiler
    ├── build_exe.py            # Windows standalone .exe PyInstaller builder
    ├── build_android.py        # Android Capacitor sync & Gradle APK builder
    ├── server.py               # Local development server with /api/ai endpoints
    ├── launcher.py             # Desktop app GUI launcher (PyQt5 / WebKit)
    │
    ├── ai/                     # CyberVision AI feature indexers & update tools
    │   ├── build_card_features.py # Precomputes 256-d visual vector database
    │   └── update_cards_ai.py  # Incremental card & model updater CLI
    │
    ├── linux/                  # Standalone Linux desktop packaging
    │   ├── build.sh            # Native Linux desktop compiler (Fedora / Ubuntu)
    │   ├── build_standalone.py # Linux PyInstaller packager
    │   ├── build_with_container.sh # Containerized hermetic compiler
    │   ├── Dockerfile.builder  # Builder container configuration
    │   ├── cyberpunk-tcg.desktop # System desktop entry
    │   ├── install_desktop_shortcut.sh # Application menu shortcut installer
    │   └── README.md           # Linux packaging documentation
    │
    ├── container/              # Production web server container (Docker / Podman)
    │   ├── Dockerfile          # Production Python slim container
    │   ├── docker-compose.yml  # 1-command orchestration
    │   ├── server_prod.py      # Hardened web server with /health endpoint
    │   ├── run_docker.sh       # Quick launch with Docker (Ubuntu / Debian)
    │   ├── run_podman.sh       # Quick launch with Podman (Fedora / RHEL)
    │   └── README.md           # Cloud VPS hosting & reverse-proxy guide
    │
    └── scrapers/               # Card database scrapers & NetDeck utilities
        ├── download_official_cards.py # Asset downloader utility
        └── fetch_all_raw.py    # Raw API extractor
```

