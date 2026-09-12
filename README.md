# Cyberpunk TCG // Official WeirdCo Edition

An interactive companion, card inventory manager, and tournament deck builder for the **Official WeirdCo Cyberpunk Trading Card Game** (*Welcome to Night City* set).

---

## ⚡ What's Included

- **🗃️ 151 Official WeirdCo Cards & Artwork:**
  - Complete database loaded directly from the official NetDeck / WeirdCo repository.
  - **151 high-resolution official card artwork renders** stored locally in `assets/cards/` (17.4 MB total) for 100% offline access.
  - Authentic characters & cards: **V (Streetkid), Adam Smasher (Ender of Legends), Johnny Silverhand (Rocking Renegade), Yorinobu Arasaka, Rogue Amendiares, Dexter DeShawn, Rebecca**, and more.
  - Official stats and anatomy:
    - **Card Types:** `Legend`, `Unit`, `Program`, `Gear`.
    - **Colors:** `Red`, `Yellow`, `Green`, `Blue`.
    - **Cost in Eddies (€$)**, **RAM**, **Power**, and **Sell Tags (€$)**.

- **🔍 Holographic 3D Tilt & Zoom Inspection:**
  - Official card renders with interactive 3D perspective mouse-tilt.
  - Dynamic holographic foil glare shader.
  - Magnifier button (🔍) or double-click to open full-resolution inspection modal with rules text, traits, and artist credits.

- **🛠️ Tournament Deck Builder:**
  - Enforces official deck rules: 40-card minimum, 1 Legend limit, 3-copy card limits.
  - Designated **Legend** slot.
  - Real-time **Eddie Cost (€$) Curve** and **RAM** telemetry.
  - Save, name, and manage multiple custom decks in `localStorage`.

- **⚡ Official Starter Decks:**
  - *Arasaka Embracing Destruction* (Red control led by Yorinobu Arasaka).
  - *The Heist: V Streetkid Crew* (Red aggro led by V: Streetkid).
  - *Afterlife Legend: Rogue Syndicate* (Yellow combat led by Rogue Amendiares).

- **📤 Deck Sharing & Codes:**
  - Export/import via compact Base64 codes (`CPTCG_...`), standard text decklists, or JSON.
  - 1-click clipboard copying.

---

## 🚀 How to Run

### Option 1: Standalone Monolith HTML (Double-Click to Run!)
Double-click:
```
dist/cyberpunk_tcg_monolith.html
```
Open it in any modern browser. It contains all 151 official cards, embedded styles, audio synth, and scripts. It reads the local images from `assets/cards/` (with automatic fallback to the official CDN).

To rebuild the monolith HTML:
```powershell
python build_monolith.py
```

### Option 2: Local Python Server
```powershell
python server.py
```
- Modular App: [http://localhost:8080/](http://localhost:8080/)
- Monolith Bundle: [http://localhost:8080/monolith](http://localhost:8080/monolith)

---

## 📁 File Structure

```
Cyberpunk_TCG/
├── assets/
│   └── cards/                 # 151 high-resolution official card artwork renders (.webp)
├── data/
│   ├── cards.json             # 151 official WeirdCo cards with full stats
│   ├── starter_decks.json     # Official pre-constructed 40-card starter decks
│   └── custom_starter_cards.json # Backup of custom cards
├── dist/
│   └── cyberpunk_tcg_monolith.html # Single-file zero-dependency bundle (~308 KB)
├── scripts/
│   └── download_official_cards.py # Asset updater script
├── src/
│   ├── index.html             # Modular dev shell
│   ├── css/                   # base.css, cards.css, components.css
│   └── js/                    # audio.js, state.js, card_renderer.js, inventory.js, deck_builder.js, analytics.js, export_import.js, app.js
├── build_monolith.py          # Monolith compiler
├── server.py                  # Local HTTP development server
└── tests/
    └── test_tcg_logic.py      # Automated unit tests
```

---

## 🧪 Testing

```powershell
python -m unittest tests/test_tcg_logic.py
```
