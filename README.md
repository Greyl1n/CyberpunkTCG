# Cyberpunk TCG // Official WeirdCo Edition

An interactive companion, card inventory manager, and tournament deck builder for the **Official WeirdCo Cyberpunk Trading Card Game** (*Welcome to Night City* set).

---

## ⚡ Key Features

- **🖥️ Standalone Windows Desktop App (`dist/Cyberpunk_TCG.exe`):**
  - Completely self-contained `.exe` bundling Python runtime, native desktop GUI window, all 151 official card images, and audio engine.
  - Zero dependencies or installation required.

- **🌐 Zero-Dependency Monolith HTML (`dist/cyberpunk_tcg_monolith.html`):**
  - Standalone single-file application with all HTML, CSS, JavaScript, datasets, and starter decks inlined.
  - Runs in any modern browser (Chrome, Edge, Firefox) completely offline.

- **🗃️ 151 Official WeirdCo Cards & Artwork:**
  - Complete database loaded directly from the official NetDeck / WeirdCo repository.
  - **151 high-resolution official card artwork renders** stored locally in `assets/cards/` for 100% offline access.
  - Authentic characters: **V (Streetkid), Adam Smasher (Ender of Legends), Johnny Silverhand (Rocking Renegade), Yorinobu Arasaka, Rogue Amendiares, Dexter DeShawn, Rebecca**, and more.
  - Official stats and anatomy:
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
  - Enforces official tournament rules:
    - **Exactly 3 Legends** required.
    - **40 to 50 Cards** in main deck.
    - **Max 3 copies** of any non-Legend card.
    - **RAM Requirement Validation**.
  - Dedicated **3-Legend Identity Zone** with full thumbnail visibility, RAM telemetry, and click-to-inspect.
  - Real-time **Eddie Cost (€$) Curve** and cumulative RAM telemetry.

- **⚡ 59 Official & CyberpunkTCG.com Community Decks:**
  - **4 Official WeirdCo Starter Decks** (*Arasaka Embracing Destruction*, *The Heist*, *Afterlife Syndicate*, *Arasaka Corporate Dynasty*).
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
*(See `standalone_linux/README.md` to build or install desktop shortcut).*

### Option 4: Production Container / Online Server (Docker / Podman)
Run the web application container locally or on a remote VPS:
```bash
# On Fedora / RHEL (Podman):
bash server_container/run_podman.sh

# On Ubuntu / Debian (Docker):
bash server_container/run_docker.sh
```
Access at: `http://localhost:8080/`
*(See `server_container/README.md` for full cloud deployment & Nginx SSL instructions).*

### Option 5: Local Development Server
```powershell
python scripts/server.py
```
- Modular App: http://localhost:8080/
- Monolith Bundle: http://localhost:8080/monolith

---

## 🛠️ Build Scripts

All build and maintenance scripts are organized across dedicated directories:

### Rebuild Monolith HTML
```powershell
python scripts/build_monolith.py
```

### Rebuild Windows Executable (.exe)
```powershell
python scripts/build_exe.py
```

### Rebuild Linux Standalone Executable
```bash
# On Linux:
bash standalone_linux/build.sh

# Or via isolated container (Podman/Docker):
bash standalone_linux/build_with_container.sh
```

### Run Unit Tests
```powershell
python -m unittest discover tests
```

---

## 📁 Repository Structure

```
Cyberpunk_TCG/
├── assets/                    # 151 high-resolution official card artwork renders (.webp)
│   └── cards/
├── data/
│   ├── cards.json             # 151 official WeirdCo cards with full stats & rules
│   └── starter_decks.json     # 59 official and community tournament legal decks
├── dist/
│   ├── cyberpunk_tcg_monolith.html # Standalone single-file HTML bundle
│   ├── Cyberpunk_TCG.exe      # Windows standalone executable
│   └── assets/cards/          # Standalone card assets mirror for portable distribution
├── scripts/                   # Build tools, dev servers, and utilities
│   ├── build_monolith.py      # Monolith HTML compiler
│   ├── build_exe.py           # PyInstaller Windows .exe builder
│   ├── server.py              # Local HTTP development server
│   ├── launcher.py            # Desktop app GUI launcher (pywebview)
│   ├── download_official_cards.py # Asset downloader utility
│   └── fetch_all_raw.py       # Raw card data extractor
├── server_container/          # Containerized web server for local & online VPS hosting
│   ├── Dockerfile             # Production Python slim container
│   ├── docker-compose.yml     # 1-command orchestration
│   ├── server_prod.py         # Production server with /health and env config
│   ├── run_docker.sh          # Quick launch with Docker (Ubuntu/Debian)
│   ├── run_podman.sh          # Quick launch with Podman (Fedora/RHEL)
│   └── README.md              # VPS hosting & Nginx SSL reverse-proxy guide
├── standalone_linux/          # Standalone Linux desktop application packaging
│   ├── build.sh               # Native build script for Fedora & Ubuntu
│   ├── build_standalone.py    # PyInstaller Linux packager
│   ├── Dockerfile.builder     # Hermetic container builder (Ubuntu 22.04 LTS glibc)
│   ├── build_with_container.sh# One-click containerized binary compiler
│   ├── cyberpunk-tcg.desktop  # Linux desktop application entry
│   ├── install_desktop_shortcut.sh # Application menu shortcut installer
│   └── README.md              # Linux setup and desktop integration guide
├── src/                       # Modular source code
│   ├── index.html             # Main application template
│   ├── css/                   # Stylesheets (base, cards, components, layout)
│   └── js/                    # Modular controllers (state, audio, deck_builder, etc.)
├── tests/                     # Automated validation tests
│   └── test_tcg_logic.py
├── .gitignore                 # Clean Git configuration for GitHub
└── README.md                  # Project documentation
```

