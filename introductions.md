# ⚡ Cyberpunk TCG // Introduction & Player Guide

Welcome to the **Cyberpunk Trading Card Game Companion & Inventory Manager** (*Welcome to Night City* set).

> [!NOTE]
> **Disclaimer & Non-Affiliation:** This is an independent fan-made companion tool. This project is not affiliated with, endorsed by, or supported by WeirdCo Games, CD PROJEKT RED, R. Talsorian Games, or any related entity.

Whether you are scanning cards from physical booster packs with your phone, managing your collection, or engineering competitive 50-card tournament decks, this application is your offline neural link to Night City.

---

## 🎯 What is Cyberpunk TCG?

The **Cyberpunk Trading Card Game (TCG)** is a fast-paced tactical card game set in the dystopian universe of Cyberpunk. 

Players assemble a team of **3 Legends** (such as *V: Streetkid*, *Johnny Silverhand: Rocking Renegade*, or *Adam Smasher: Ender of Legends*) and construct a **40-to-50 card main deck** containing Units, Programs, and Gear. 

### Core Mechanics & Stats
- **Legends:** The anchor of your deck. You choose exactly 3 Legends who provide passive abilities, RAM generation, and tactical advantages.
- **Eddies (€$):** The primary currency used to deploy Units, install Cyberware Gear, and run Daemon Programs.
- **RAM (💾):** Digital bandwidth required to execute powerful netrunning Programs and activate special abilities.
- **Power (⚔️):** Combat damage dealt during clashes against enemy Units and Legend targets.
- **Factions & Colors:**
  - 🔴 **Red:** Aggressive combatants, Streetkids, high attack Mercenaries, and raw firepower.
  - 🟡 **Yellow:** Fast eddies, fixers, corporate executives, and economic acceleration.
  - 🟢 **Green:** Heavy armor, Nomad clans, cybernetic durability, and physical resilience.
  - 🔵 **Blue:** Netrunners, quickhacks, brain dances, and ICE daemons.

---

## 🚀 Running the App (Compiled Executables)

Precompiled, zero-dependency standalone binaries are ready in the `dist/` directory for **Windows, Android, and Linux**:

| Platform | Executable File | Instructions |
| :--- | :--- | :--- |
| **Windows** | `dist/Cyberpunk_TCG.exe` | Double-click to launch native desktop app. Includes all 151 card artworks, audio engine, and native GUI. |
| **Android** | `dist/Cyberpunk_TCG.apk` | Copy to your Android phone/tablet and install, or run `adb install -r dist/Cyberpunk_TCG.apk`. |
| **Linux** | `dist/Cyberpunk_TCG_Linux` | Run `chmod +x dist/Cyberpunk_TCG_Linux && ./dist/Cyberpunk_TCG_Linux` on Fedora, Ubuntu, Debian, or Arch. |
| **Web Browser** | `dist/cyberpunk_tcg_monolith.html` | Open directly in Chrome, Firefox, or Edge. 100% offline, zero internet or web server required. |

---

## 🧠 CyberVision AI Neural Scanner (v2.0)

The v2.0 scanner uses on-device computer vision and vector embeddings to identify physical cards instantly:

```
                  ┌───────────────────────────────┐
                  │       CAMERA LIVE FEED        │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │ 1. REAL-TIME AUTO-FRAMING     │
                  │ - Detects card at any angle   │
                  │ - 4-Point Homography deskew   │
                  │ - Glowing tracking polygon    │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │ 2. NEURAL FEATURE MATCHING    │
                  │ - 256-D Perceptual Embedding  │
                  │ - Cosine similarity < 10ms    │
                  │ - Real-time target lock (97%) │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │ 3. TARGET LOCK & INVENTORY    │
                  │ - Card stats & Cardmarket €$  │
                  │ - 1-Click / Auto-Add (+1)     │
                  └───────────────────────────────┘
```

### How to Scan Cards:
1. Click the **📷 SCAN** button in the top navigation bar (or mobile bottom bar).
2. Point your camera at any Cyberpunk TCG card.
3. The AI automatically detects the card's 4 corners and outlines it with a glowing neon cyber-tracker.
4. **Target Lock:** Once identified, the scanner displays the card's name, set number, stats, Cardmarket market value, and an **Add +1** button.
5. **AUTO-ADD Mode:** Toggle the `AUTO-ADD` switch to automatically increment your inventory on sight—perfect for cataloging full booster boxes or binders rapidly!

### Updating Cards & AI Models:
As new sets and expansions release:
- Place new card artworks into `assets/cards/` and metadata into `data/cards.json`.
- Run the AI updater:
  ```powershell
  python scripts/ai/update_cards_ai.py
  ```
- The AI vector database (`data/card_embeddings.json`) and manifest (`models/manifest.json`) are updated without needing to retrain neural networks!

---

## 🛠️ Tournament Deck Builder

1. **Select 3 Legends:** Choose 3 unique Legends from your collection or the card database.
2. **Main Deck Construction:** Add 40 to 50 cards (Units, Programs, Gear). Max 3 copies per card.
3. **RAM & Curve Telemetry:** Watch your deck's RAM sufficiency and Eddie cost distribution graphs update in real time.
4. **Export & Share:**
   - **Base64 Deck Codes:** Share compact `CPTCG_...` strings directly with opponents or tournament judges.
   - **File Download:** Save your deck as `.cptcg`, `.json`, or text checklist.
5. **Starter & NetDeck Library:** Explore 59 pre-loaded tournament and starter decks, including *Arasaka Embracing Destruction* and *The Heist*.

---

## 📦 Collection & Inventory Management

- **Playset Tracking:** Track which cards you have 1x, 2x, or a complete 3x playset.
- **Cardmarket Live Pricing:** Real-time secondary market prices for every card.
- **Full Backup:** Export and import your collection anytime in JSON or CSV.

---

## 💻 Developer & Rebuild Commands

```powershell
# Recompile Single-File Standalone HTML
python scripts/build_monolith.py

# Recompile Windows Executable (.exe)
python scripts/build_exe.py

# Recompile Android APK (.apk)
python scripts/build_android.py
.\android\gradlew.bat -p android assembleDebug

# Recompile Linux Standalone Executable (via WSL / Linux)
python3 scripts/linux/build_standalone.py

# Run Unit Tests
python -m unittest discover tests
```
