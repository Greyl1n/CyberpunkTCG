#!/usr/bin/env python3
"""
Update documentation markdown files to version 3.3.0
with 189 cards, 146 decks, sideboard system, and favorite decks.
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent

# 1. Update README.md
readme_path = root / "README.md"
with open(readme_path, "r", encoding="utf-8") as f:
    text = f.read()

# Update title and subtitle
text = text.replace(
    "# Cyberpunk TCG // Fan Companion & Deck Builder\n\nAn interactive companion, card inventory manager, and deck builder for the **Cyberpunk Trading Card Game** (*Welcome to Night City* set).",
    "# Cyberpunk TCG // Fan Companion & Deck Builder\n\n**Version 3.3.0 (Tournament & Sideboard Edition)**  \nAn interactive companion, card inventory manager, tournament deck builder, and community deck archive for the **Cyberpunk Trading Card Game** (*Welcome to Night City* set)."
)
text = text.replace(
    "# Cyberpunk TCG // Fan Companion & Deck Builder\r\n\r\nAn interactive companion, card inventory manager, and deck builder for the **Cyberpunk Trading Card Game** (*Welcome to Night City* set).",
    "# Cyberpunk TCG // Fan Companion & Deck Builder\r\n\r\n**Version 3.3.0 (Tournament & Sideboard Edition)**  \r\nAn interactive companion, card inventory manager, tournament deck builder, and community deck archive for the **Cyberpunk Trading Card Game** (*Welcome to Night City* set)."
)

text = text.replace("all 151 card images", "all 189 card images")
text = text.replace("151 Indexed Cards & Artwork:", "189 Indexed Cards & Artwork (151 Core + 38 Alt-Arts):")
text = text.replace("151 high-resolution card artwork renders", "189 high-resolution card artwork renders")

old_presets = """- **⚡ 59 Core & Community Decks:**
  - **4 Core Starter Decks** (*Arasaka Embracing Destruction*, *The Heist*, *Afterlife Syndicate*, *Arasaka Corporate Dynasty*).
  - **55 Community Decks** curated directly from [cyberpunktcg.com/decks?tab=community](https://cyberpunktcg.com/decks?tab=community).
  - Searchable by name, author, archetype, or color.
  - Faction-themed **"⚡ Load into Deck Builder"** buttons matching each deck's primary color."""

new_presets = """- **⚡ 146 Pre-Built & Community Decks with Sideboards & Favorites:**
  - **4 Core Starter Decks** (*Arasaka Embracing Destruction*, *The Heist*, *Afterlife Syndicate*, *Arasaka Corporate Dynasty*).
  - **142 Community Decks** curated directly from [cyberpunktcg.com/decks?tab=community](https://cyberpunktcg.com/decks?tab=community).
  - **🛡️ Dedicated Sideboard Preview:** Decks with sideboards display an interactive sideboard strip with card chips, quantities, and click-to-inspect.
  - **★ Favorite Decks:** 1-click star toggle (`★` / `☆`) to bookmark decks. Favorites persist across sessions (in `localStorage` and desktop `user_state.json`) and can be filtered instantly via the **★ Favorites (X)** category pill.
  - Searchable by name, author, archetype, legend, or color.
  - Faction-themed **"⚡ Load into Deck Builder"** buttons matching each deck's primary color."""

text = text.replace(old_presets, new_presets)
text = text.replace(old_presets.replace("\n", "\r\n"), new_presets.replace("\n", "\r\n"))

old_builder = """- **🛠️ Tournament Deck Builder:**
  - Enforces tournament rules:
    - **Exactly 3 Legends** required.
    - **40 to 50 Cards** in main deck.
    - **Max 3 copies** of any non-Legend card.
    - **RAM Requirement Validation**.
  - Dedicated **3-Legend Identity Zone** with full thumbnail visibility, RAM telemetry, and click-to-inspect.
  - Real-time **Eddie Cost (€$) Curve** and cumulative RAM telemetry."""

new_builder = """- **🛠️ Tournament Deck Builder with Dedicated Sideboard:**
  - Enforces official tournament rules:
    - **Exactly 3 Legends** required.
    - **40 to 50 Cards** in main deck.
    - **Up to 15 Cards** in Sideboard (with dedicated zone, counters, and +/- controls).
    - **Max 3 copies** of any non-Legend card across main deck and sideboard.
    - **RAM Requirement Validation**.
  - Dedicated **3-Legend Identity Zone** with full thumbnail visibility, RAM telemetry, and click-to-inspect.
  - Dedicated **Sideboard Zone (Max 15 Cards)** with quick swap, count badge, and "+ Side" action buttons on card catalog.
  - Real-time **Eddie Cost (€$) Curve** and cumulative RAM telemetry."""

text = text.replace(old_builder, new_builder)
text = text.replace(old_builder.replace("\n", "\r\n"), new_builder.replace("\n", "\r\n"))

text = text.replace(
    "Click any active Legend in the 3-Legend Zone or card name in the deck list to inspect.",
    "Click any active Legend in the 3-Legend Zone, sideboard chip, or card name in the deck list to inspect."
)

text = text.replace(
    "formatted text decklists, or raw JSON, with **💾 Save to File** (`.cptcg`, `.txt`, `.json`)",
    "formatted text decklists (with `// Sideboard` section), or raw JSON, with **💾 Save to File** (`.cptcg`, `.txt`, `.json`)"
)

text = text.replace("cards.json              # 151 cards", "cards.json              # 189 cards (151 core + 38 alt-arts)")
text = text.replace("starter_decks.json      # 59 starter", "starter_decks.json      # 146 starter and community")
text = text.replace("assets/                     # 151 high-resolution", "assets/                     # 189 high-resolution")

with open(readme_path, "w", encoding="utf-8") as f:
    f.write(text)
print("[+] README.md updated successfully")

# 2. Update INSTRUCTIONS.md
instructions_path = root / "INSTRUCTIONS.md"
with open(instructions_path, "r", encoding="utf-8") as f:
    in_text = f.read()

in_text = in_text.replace("151 card images", "189 card images")
in_text = in_text.replace("151 Indexed Cards", "189 Indexed Cards")
in_text = in_text.replace("59 starter", "146 starter and community")
in_text = in_text.replace("59 Pre-built", "146 Pre-built")
in_text = in_text.replace("151 high-resolution", "189 high-resolution")

with open(instructions_path, "w", encoding="utf-8") as f:
    f.write(in_text)
print("[+] INSTRUCTIONS.md updated successfully")

# 3. Update introductions.md
intro_path = root / "introductions.md"
with open(intro_path, "r", encoding="utf-8") as f:
    it_text = f.read()

it_text = it_text.replace("151 card artworks", "189 card artworks")
it_text = it_text.replace("59 pre-loaded", "146 pre-loaded")
it_text = it_text.replace(
    "11/11 tests",
    "15/15 tests"
)
it_text = it_text.replace(
    "## 🛠️ Tournament Deck Builder\n\n1. **Select 3 Legends:** Choose 3 unique Legends from your collection or the card database.\n2. **Main Deck Construction:** Add 40 to 50 cards (Units, Programs, Gear). Max 3 copies per card.\n3. **RAM & Curve Telemetry:** Watch your deck's RAM sufficiency and Eddie cost distribution graphs update in real time.\n4. **Export & Share:**\n   - **Base64 Deck Codes:** Share compact `CPTCG_...` strings directly with opponents or tournament judges.\n   - **File Download:** Save your deck as `.cptcg`, `.json`, or text checklist.\n5. **Starter & NetDeck Library:** Explore 59 pre-loaded tournament and starter decks, including *Arasaka Embracing Destruction* and *The Heist*.",
    "## 🛠️ Tournament Deck Builder & Sideboard\n\n1. **Select 3 Legends:** Choose 3 unique Legends from your collection or the card database.\n2. **Main Deck Construction:** Add 40 to 50 cards (Units, Programs, Gear). Max 3 copies per card.\n3. **Tournament Sideboard (Up to 15 Cards):** Build your tactical sideboard with dedicated controls, count monitors, and easy card swapping.\n4. **RAM & Curve Telemetry:** Watch your deck's RAM sufficiency and Eddie cost distribution graphs update in real time.\n5. **Export & Share:**\n   - **Base64 Deck Codes:** Share compact `CPTCG_...` strings directly with opponents or tournament judges (sideboards fully preserved).\n   - **File Download:** Save your deck as `.cptcg`, `.json`, or formatted text decklist with dedicated `// Sideboard` section.\n6. **Starter & NetDeck Library (146 Decks):** Explore 146 pre-loaded tournament and community decks from cyberpunktcg.com with sideboard previews and 1-click **★ Favorite Decks** bookmarking."
)
it_text = it_text.replace(
    "## 🛠️ Tournament Deck Builder\r\n\r\n1. **Select 3 Legends:** Choose 3 unique Legends from your collection or the card database.\r\n2. **Main Deck Construction:** Add 40 to 50 cards (Units, Programs, Gear). Max 3 copies per card.\r\n3. **RAM & Curve Telemetry:** Watch your deck's RAM sufficiency and Eddie cost distribution graphs update in real time.\r\n4. **Export & Share:**\r\n   - **Base64 Deck Codes:** Share compact `CPTCG_...` strings directly with opponents or tournament judges.\r\n   - **File Download:** Save your deck as `.cptcg`, `.json`, or text checklist.\r\n5. **Starter & NetDeck Library:** Explore 59 pre-loaded tournament and starter decks, including *Arasaka Embracing Destruction* and *The Heist*.",
    "## 🛠️ Tournament Deck Builder & Sideboard\r\n\r\n1. **Select 3 Legends:** Choose 3 unique Legends from your collection or the card database.\r\n2. **Main Deck Construction:** Add 40 to 50 cards (Units, Programs, Gear). Max 3 copies per card.\r\n3. **Tournament Sideboard (Up to 15 Cards):** Build your tactical sideboard with dedicated controls, count monitors, and easy card swapping.\r\n4. **RAM & Curve Telemetry:** Watch your deck's RAM sufficiency and Eddie cost distribution graphs update in real time.\r\n5. **Export & Share:**\r\n   - **Base64 Deck Codes:** Share compact `CPTCG_...` strings directly with opponents or tournament judges (sideboards fully preserved).\r\n   - **File Download:** Save your deck as `.cptcg`, `.json`, or formatted text decklist with dedicated `// Sideboard` section.\r\n6. **Starter & NetDeck Library (146 Decks):** Explore 146 pre-loaded tournament and community decks from cyberpunktcg.com with sideboard previews and 1-click **★ Favorite Decks** bookmarking."
)

with open(intro_path, "w", encoding="utf-8") as f:
    f.write(it_text)
print("[+] introductions.md updated successfully")
