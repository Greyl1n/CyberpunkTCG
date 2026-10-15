#!/usr/bin/env python3
"""
Cyberpunk TCG - Alternate Art Cards Importer
Fetches and downloads:
 - 31 Iconic Rares (β141 - β171)
 - Female V (005b)
 - 6 Box Toppers (BT1 - BT6)
Integrates them into data/cards.json, data/cardmarket_prices.json, and downloads artwork to assets/cards/.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
ASSETS_DIR = ROOT_DIR / "assets" / "cards"
CARDS_JSON = DATA_DIR / "cards.json"
PRICES_JSON = DATA_DIR / "cardmarket_prices.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# 1. Iconic Rares (β141 - β171) & Female V (b5b)
ALT_CARDS_SPECS = [
    # Base gender variant
    {
        "slug": "v-streetkid-b-b5b",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/v-streetkid-b-b5b/",
        "id": "cb-v-streetkid-alt",
        "print_number": "005b",
        "name_suffix": " (Female V)",
        "rarity": "Rare",
        "set_name": "Welcome to Night City — Retail",
        "set_code": "welcometonightcityretail",
        "base_search": ("V", "Streetkid")
    },
    # Iconic Legends (18 cards)
    {
        "slug": "adam-smasher-ender-of-legends-ilegend-b141",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/adam-smasher-ender-of-legends-ilegend-b141/",
        "id": "cb-adam-smasher-ender-of-legends-iconic",
        "print_number": "β141",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Adam Smasher", "Ender of Legends")
    },
    {
        "slug": "dexter-deshawn-off-the-grid-ilegend-b142",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/dexter-deshawn-off-the-grid-ilegend-b142/",
        "id": "cb-dexter-deshawn-off-the-grid-iconic",
        "print_number": "β142",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Dexter DeShawn", "Off the Grid")
    },
    {
        "slug": "royce-psycho-on-the-edge-ilegend-b143",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/royce-psycho-on-the-edge-ilegend-b143/",
        "id": "cb-royce-psycho-on-the-edge-iconic",
        "print_number": "β143",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Royce", "Psycho on the Edge")
    },
    {
        "slug": "v-streetkid-ilegend-b144",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/v-streetkid-ilegend-b144/",
        "id": "cb-v-streetkid-iconic",
        "print_number": "β144",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("V", "Streetkid")
    },
    {
        "slug": "dum-dum-maelstrom-triggerman-ilegend-b145",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/dum-dum-maelstrom-triggerman-ilegend-b145/",
        "id": "cb-dum-dum-maelstrom-triggerman-iconic",
        "print_number": "β145",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Dum Dum", "Maelstrom Triggerman")
    },
    {
        "slug": "kerry-eurodyne-axe-attitude-audience-ilegend-b146",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/kerry-eurodyne-axe-attitude-audience-ilegend-b146/",
        "id": "cb-kerry-eurodyne-axe-attitude-audience-iconic",
        "print_number": "β146",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Kerry Eurodyne", "Axe, Attitude, Audience")
    },
    {
        "slug": "muamar-reyes-el-capitan-ilegend-b147",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/muamar-reyes-el-capitan-ilegend-b147/",
        "id": "cb-muamar-reyes-el-capitan-iconic",
        "print_number": "β147",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Muamar Reyes", "El Capitán")
    },
    {
        "slug": "river-ward-detective-on-the-hunt-ilegend-b148",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/river-ward-detective-on-the-hunt-ilegend-b148/",
        "id": "cb-river-ward-detective-on-the-hunt-iconic",
        "print_number": "β148",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("River Ward", "Detective on the Hunt")
    },
    {
        "slug": "rogue-amendiares-preem-solo-ilegend-b149",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/rogue-amendiares-preem-solo-ilegend-b149/",
        "id": "cb-rogue-amendiares-preem-solo-iconic",
        "print_number": "β149",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Rogue Amendiares", "Preem Solo")
    },
    {
        "slug": "goro-takemura-vengeful-bodyguard-ilegend-b150",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/goro-takemura-vengeful-bodyguard-ilegend-b150/",
        "id": "cb-goro-takemura-vengeful-bodyguard-iconic",
        "print_number": "β150",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Goro Takemura", "Vengeful Bodyguard")
    },
    {
        "slug": "hanako-arasaka-daughter-of-the-emperor-ilegend-b151",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/hanako-arasaka-daughter-of-the-emperor-ilegend-b151/",
        "id": "cb-hanako-arasaka-daughter-of-the-emperor-iconic",
        "print_number": "β151",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Hanako Arasaka", "Daughter of the Emperor")
    },
    {
        "slug": "jackie-welles-mamas-favorite-ilegend-b152",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/jackie-welles-mamas-favorite-ilegend-b152/",
        "id": "cb-jackie-welles-mamas-favorite-iconic",
        "print_number": "β152",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Jackie Welles", "Mama's Favorite")
    },
    {
        "slug": "padre-man-of-the-cross-ilegend-b153",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/padre-man-of-the-cross-ilegend-b153/",
        "id": "cb-padre-man-of-the-cross-iconic",
        "print_number": "β153",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Padre", "Man of the Cross")
    },
    {
        "slug": "panam-palmer-nomad-cavalry-ilegend-b154",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/panam-palmer-nomad-cavalry-ilegend-b154/",
        "id": "cb-panam-palmer-nomad-cavalry-iconic",
        "print_number": "β154",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Panam Palmer", "Nomad Cavalry")
    },
    {
        "slug": "alt-cunningham-soulkiller-architect-ilegend-b155",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/alt-cunningham-soulkiller-architect-ilegend-b155/",
        "id": "cb-alt-cunningham-soulkiller-architect-iconic",
        "print_number": "β155",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Alt Cunningham", "Soulkiller Architect")
    },
    {
        "slug": "evelyn-parker-beautiful-enigma-ilegend-b156",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/evelyn-parker-beautiful-enigma-ilegend-b156/",
        "id": "cb-evelyn-parker-beautiful-enigma-iconic",
        "print_number": "β156",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Evelyn Parker", "Beautiful Enigma")
    },
    {
        "slug": "judy-alvarez-braindance-maestro-ilegend-b157",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/judy-alvarez-braindance-maestro-ilegend-b157/",
        "id": "cb-judy-alvarez-braindance-maestro-iconic",
        "print_number": "β157",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Judy", "Braindance Maestro")
    },
    {
        "slug": "wakako-okada-peace-and-harmony-ilegend-b158",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/wakako-okada-peace-and-harmony-ilegend-b158/",
        "id": "cb-wakako-okada-peace-and-harmony-iconic",
        "print_number": "β158",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Legend",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Wakako Okada", "Peace and Harmony")
    },
    # Iconic Other (9 cards)
    {
        "slug": "johnny-silverhand-never-stop-fighting-io-b159",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/johnny-silverhand-never-stop-fighting-io-b159/",
        "id": "cb-johnny-silverhand-never-stop-fighting-iconic",
        "print_number": "β159",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Johnny Silverhand", "Never Stop Fighting")
    },
    {
        "slug": "adam-smasher-metal-over-meat-io-b160",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/adam-smasher-metal-over-meat-io-b160/",
        "id": "cb-adam-smasher-metal-over-meat-iconic",
        "print_number": "β160",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Adam Smasher", "Metal Over Meat")
    },
    {
        "slug": "alt-cunningham-mother-of-daemons-io-b161",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/alt-cunningham-mother-of-daemons-io-b161/",
        "id": "cb-alt-cunningham-mother-of-daemons-iconic",
        "print_number": "β161",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Alt Cunningham", "Mother of Daemons")
    },
    {
        "slug": "hanako-arasaka-in-a-gilded-cage-io-b162",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/hanako-arasaka-in-a-gilded-cage-io-b162/",
        "id": "cb-hanako-arasaka-in-a-gilded-cage-iconic",
        "print_number": "β162",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Hanako Arasaka", "In a Gilded Cage")
    },
    {
        "slug": "the-relic-experimental-biochip-io-b163",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/the-relic-experimental-biochip-io-b163/",
        "id": "cb-the-relic-experimental-biochip-iconic",
        "print_number": "β163",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("The Relic", "Experimental Biochip")
    },
    {
        "slug": "sandayu-oda-hanakos-guardian-io-b164",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/sandayu-oda-hanakos-guardian-io-b164/",
        "id": "cb-sandayu-oda-hanakos-guardian-iconic",
        "print_number": "β164",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Sandayu Oda", "Hanako's Guardian")
    },
    {
        "slug": "overwatch-panams-gift-io-b165",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/overwatch-panams-gift-io-b165/",
        "id": "cb-overwatch-panams-gift-iconic",
        "print_number": "β165",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Overwatch", "Panam's Gift")
    },
    {
        "slug": "rogue-amendiares-queen-of-the-afterlife-io-b166",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/rogue-amendiares-queen-of-the-afterlife-io-b166/",
        "id": "cb-rogue-amendiares-queen-of-the-afterlife-iconic",
        "print_number": "β166",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Rogue Amendiares", "Queen of the Afterlife")
    },
    {
        "slug": "towerfall-io-b167",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/towerfall-io-b167/",
        "id": "cb-towerfall-iconic",
        "print_number": "β167",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Other",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Towerfall", None)
    },
    # Iconic Secret (4 cards)
    {
        "slug": "johnny-silverhand-rocking-renegade-isecret-b168",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/johnny-silverhand-rocking-renegade-isecret-b168/",
        "id": "cb-johnny-silverhand-rocking-renegade-iconic",
        "print_number": "β168",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Secret",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Johnny Silverhand", "Rocking Renegade")
    },
    {
        "slug": "sasha-yakovleva-wont-let-you-down-isecret-b169",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/sasha-yakovleva-wont-let-you-down-isecret-b169/",
        "id": "cb-sasha-yakovleva-wont-let-you-down-iconic",
        "print_number": "β169",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Secret",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Sasha Yakovleva", "Won't Let You Down")
    },
    {
        "slug": "panam-palmer-strength-through-family-isecret-b170",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/panam-palmer-strength-through-family-isecret-b170/",
        "id": "cb-panam-palmer-strength-through-family-iconic",
        "print_number": "β170",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Secret",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Panam Palmer", "Strength Through Family")
    },
    {
        "slug": "judy-alvarez-nothing-to-doubt-isecret-b171",
        "url": "https://sparkl.gg/cyberpunk/welcome-to-night-city-beta/judy-alvarez-nothing-to-doubt-isecret-b171/",
        "id": "cb-judy-alvarez-nothing-to-doubt-iconic",
        "print_number": "β171",
        "name_suffix": " (Iconic)",
        "rarity": "Iconic Secret",
        "set_name": "Welcome to Night City — Iconic",
        "set_code": "iconic",
        "base_search": ("Judy", "Nothing to Doubt")
    },
    # Box Toppers (6 cards)
    {
        "slug": "yorinobu-arasaka-embracing-destruction-b1",
        "url": "https://sparkl.gg/cyberpunk/box-toppers-beta/yorinobu-arasaka-embracing-destruction-b1/",
        "id": "cb-yorinobu-arasaka-embracing-destruction-boxtopper",
        "print_number": "BT1",
        "name_suffix": " (Box Topper)",
        "rarity": "Box Topper",
        "set_name": "Box Toppers",
        "set_code": "boxtoppers",
        "base_search": ("Yorinobu Arasaka", "Embracing Destruction")
    },
    {
        "slug": "viktor-vektor-sit-down-and-relax-b2",
        "url": "https://sparkl.gg/cyberpunk/box-toppers-beta/viktor-vektor-sit-down-and-relax-b2/",
        "id": "cb-viktor-vektor-sit-down-and-relax-boxtopper",
        "print_number": "BT2",
        "name_suffix": " (Box Topper)",
        "rarity": "Box Topper",
        "set_name": "Box Toppers",
        "set_code": "boxtoppers",
        "base_search": ("Viktor Vektor", "Sit Down and Relax")
    },
    {
        "slug": "goro-takemura-hands-unclean-b3",
        "url": "https://sparkl.gg/cyberpunk/box-toppers-beta/goro-takemura-hands-unclean-b3/",
        "id": "cb-goro-takemura-hands-unclean-boxtopper",
        "print_number": "BT3",
        "name_suffix": " (Box Topper)",
        "rarity": "Box Topper",
        "set_name": "Box Toppers",
        "set_code": "boxtoppers",
        "base_search": ("Goro Takemura", "Hands Unclean")
    },
    {
        "slug": "saburo-arasaka-stubborn-patriarch-b4",
        "url": "https://sparkl.gg/cyberpunk/box-toppers-beta/saburo-arasaka-stubborn-patriarch-b4/",
        "id": "cb-saburo-arasaka-stubborn-patriarch-boxtopper",
        "print_number": "BT4",
        "name_suffix": " (Box Topper)",
        "rarity": "Box Topper",
        "set_name": "Box Toppers",
        "set_code": "boxtoppers",
        "base_search": ("Saburo Arasaka", "Stubborn Patriarch")
    },
    {
        "slug": "jackie-welles-pour-one-out-for-me-b5",
        "url": "https://sparkl.gg/cyberpunk/box-toppers-beta/jackie-welles-pour-one-out-for-me-b5/",
        "id": "cb-jackie-welles-pour-one-out-for-me-boxtopper",
        "print_number": "BT5",
        "name_suffix": " (Box Topper)",
        "rarity": "Box Topper",
        "set_name": "Box Toppers",
        "set_code": "boxtoppers",
        "base_search": ("Jackie Welles", "Pour One Out For Me")
    },
    {
        "slug": "v-corporate-exile-b6",
        "url": "https://sparkl.gg/cyberpunk/box-toppers-beta/v-corporate-exile-b6/",
        "id": "cb-v-corporate-exile-boxtopper",
        "print_number": "BT6",
        "name_suffix": " (Box Topper)",
        "rarity": "Box Topper",
        "set_name": "Box Toppers",
        "set_code": "boxtoppers",
        "base_search": ("V", "Corporate Exile")
    }
]

def find_base_card(cards, title_part, subname_part=None):
    title_lower = title_part.lower()
    sub_lower = subname_part.lower() if subname_part else None
    
    for c in cards:
        c_title = (c.get('card_title') or c.get('name') or '').lower()
        c_sub = (c.get('subname') or '').lower()
        if sub_lower and sub_lower in c_sub and title_lower in c_title:
            return c
        elif not sub_lower and title_lower == c_title:
            return c
            
    # Fuzzy match in full name
    for c in cards:
        c_name = (c.get('name') or '').lower()
        if title_lower in c_name and (not sub_lower or sub_lower in c_name):
            return c
            
    return None

def fetch_page_info(spec):
    try:
        req = urllib.request.Request(spec['url'], headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8')
            
        img_match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        img_url = img_match.group(1) if img_match else None
        
        # Extract Cardmarket price if present
        cm_price = 0.0
        cm_match = re.search(r'€([0-9.,]+)\s*</span>\s*<span>Cardmarket|Cardmarket[^€]*€([0-9.,]+)', html)
        if cm_match:
            val_str = cm_match.group(1) or cm_match.group(2)
            try:
                cm_price = float(val_str.replace(',', '.'))
            except:
                pass
        else:
            # Fallback regex for price
            cm_match2 = re.search(r'€([0-9]+(?:\.[0-9]+)?)', html)
            if cm_match2:
                try:
                    cm_price = float(cm_match2.group(1))
                except:
                    pass

        return spec, img_url, cm_price, None
    except Exception as e:
        return spec, None, 0.0, str(e)

def download_image(img_url, out_path):
    if out_path.exists() and out_path.stat().st_size > 5000:
        return True
    try:
        req = urllib.request.Request(img_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read()
        with open(out_path, 'wb') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"  [!] Failed to download image {img_url}: {e}")
        return False

def main():
    print("=" * 65)
    print("CYBERPUNK TCG // IMPORTING ALTERNATE ART CARDS")
    print("=" * 65)
    
    with open(CARDS_JSON, 'r', encoding='utf-8') as f:
        existing_cards = json.load(f)
        
    prices = {}
    if PRICES_JSON.exists():
        with open(PRICES_JSON, 'r', encoding='utf-8') as f:
            prices = json.load(f)
            
    print(f"[*] Current cards in database: {len(existing_cards)}")
    
    # Check if cards are already imported
    existing_ids = {c['id'] for c in existing_cards}
    
    print(f"[*] Fetching metadata for {len(ALT_CARDS_SPECS)} alternative art cards...")
    
    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(fetch_page_info, spec) for spec in ALT_CARDS_SPECS]
        for f in futures:
            results.append(f.result())
            
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    
    new_card_objs = []
    
    for spec, img_url, cm_price, err in results:
        card_id = spec['id']
        base_title, base_sub = spec['base_search']
        base_card = find_base_card(existing_cards, base_title, base_sub)
        
        if not base_card:
            print(f"  [!] Could not find base card for: {base_title} - {base_sub}")
            continue
            
        print(f"  [+] Matched {spec['print_number']} {spec['rarity']}: {base_card['card_title']} -> {card_id}")
        
        # Download image
        local_filename = f"{card_id}.webp"
        out_image_path = ASSETS_DIR / local_filename
        
        if img_url:
            download_image(img_url, out_image_path)
        elif not out_image_path.exists():
            # If no image URL, copy base card's image as fallback
            base_img = ROOT_DIR / base_card.get('image_local', '')
            if base_img.exists():
                import shutil
                shutil.copy2(base_img, out_image_path)
                
        # Build card object
        name = f"{base_card['name']}{spec['name_suffix']}"
        keywords = list(base_card.get('keywords', []))
        if 'Alternate Art' not in keywords:
            keywords.append('Alternate Art')
            
        new_card = {
            "id": card_id,
            "netdeck_id": f"alt-{card_id}",
            "print_number": spec['print_number'],
            "name": name,
            "card_title": base_card.get('card_title') or base_card.get('name'),
            "subname": base_card.get('subname') or "",
            "faction": base_card.get('faction') or "Neutral",
            "color": base_card.get('color') or "Neutral",
            "type": base_card.get('type') or "Unit",
            "rarity": spec['rarity'],
            "cost": base_card.get('cost', 0),
            "atk": base_card.get('atk', 0),
            "power": base_card.get('power', 0),
            "def": base_card.get('def', 0),
            "ram": base_card.get('ram', 0),
            "is_eddiable": base_card.get('is_eddiable', False),
            "keywords": keywords,
            "ability": base_card.get('ability', ""),
            "flavor": base_card.get('flavor', ""),
            "artist": base_card.get('artist', "WeirdCo Studios"),
            "set_name": spec['set_name'],
            "set_code": spec['set_code'],
            "image_url": img_url or base_card.get('image_url', ''),
            "image_local": f"assets/cards/{local_filename}",
            "is_official": True,
            "is_alt_art": True,
            "variant_of": base_card['id'],
            "icon": base_card.get('icon', 'cpu')
        }
        
        # Pricing
        if cm_price > 0:
            prices[card_id] = {
                "card_id": card_id,
                "print_number": spec['print_number'],
                "name": name,
                "rarity": spec['rarity'],
                "low": round(cm_price * 0.85, 2),
                "trend": round(cm_price, 2),
                "avg": round(cm_price * 1.15, 2),
                "currency": "€",
                "url": spec['url'],
                "last_updated": "2026-10-15"
            }
            
        new_card_objs.append(new_card)

    # Merge into cards.json
    final_cards = []
    # Retain non-alt or update existing
    existing_map = {c['id']: c for c in existing_cards}
    for c in new_card_objs:
        existing_map[c['id']] = c
        
    final_cards = list(existing_map.values())
    
    with open(CARDS_JSON, 'w', encoding='utf-8') as f:
        json.dump(final_cards, f, indent=2)
        
    with open(PRICES_JSON, 'w', encoding='utf-8') as f:
        json.dump(prices, f, indent=2)
        
    print(f"\n[SUCCESS] Updated {CARDS_JSON.name}: total cards now {len(final_cards)}")
    print(f"[SUCCESS] Updated {PRICES_JSON.name}: total tracked prices {len(prices)}")

if __name__ == '__main__':
    main()
