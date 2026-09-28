#!/usr/bin/env python3
"""
Official WeirdCo Cyberpunk TCG Asset & Database Downloader
Fetches all 151 official cards and downloads high-resolution artwork into assets/cards/.
"""

import os
import sys
import json
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_root_dir():
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "src").exists() and (p / "data").exists():
            return p
        p = p.parent
    return Path(__file__).resolve().parents[2]

ROOT_DIR = get_root_dir()
DATA_DIR = ROOT_DIR / "data"
ASSETS_DIR = ROOT_DIR / "assets" / "cards"
CARDS_JSON = DATA_DIR / "cards.json"
BACKUP_JSON = DATA_DIR / "custom_starter_cards.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json'
}

def fetch_official_cards():
    print("=" * 60)
    print("WEIRDCO CYBERPUNK TCG // FETCHING OFFICIAL CARDS")
    print("=" * 60)
    
    all_raw = []
    offset = 0
    limit = 100
    
    while True:
        url = f"https://api.netdeck.gg/api/cards/cyberpunk?limit={limit}&offset={offset}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        items = data.get('items', [])
        if not items:
            break
        all_raw.extend(items)
        offset += len(items)
        total = data.get('total', 0)
        print(f"[*] Fetched {len(all_raw)} of {total} cards...")
        if len(all_raw) >= total:
            break
            
    print(f"[+] Total official cards fetched: {len(all_raw)}")
    return all_raw

def download_image(card):
    slug = card.get('slug') or card.get('id')
    out_path = ASSETS_DIR / f"{slug}.webp"
    
    if out_path.exists() and out_path.stat().st_size > 1000:
        return slug, True, "already exists"
        
    img_url = card.get('image_url')
    if not img_url:
        return slug, False, "no image url"
        
    try:
        req = urllib.request.Request(img_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read()
        with open(out_path, 'wb') as f:
            f.write(content)
        return slug, True, f"downloaded {len(content)} bytes"
    except Exception as e:
        return slug, False, str(e)

def download_all_images(cards):
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[*] Downloading high-resolution card artwork into {ASSETS_DIR}...")
    
    success = 0
    failed = 0
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download_image, c): c for c in cards}
        for future in as_completed(futures):
            slug, ok, msg = future.result()
            if ok:
                success += 1
            else:
                failed += 1
                print(f"  [!] Failed {slug}: {msg}")
                
    print(f"[+] Download complete: {success} successful, {failed} failed.")

def normalize_card_data(raw_cards):
    normalized = []
    
    for c in raw_cards:
        slug = c.get('slug') or c.get('id')
        local_img = f"assets/cards/{slug}.webp"
        
        # Determine keywords & classifications
        classifications = c.get('classifications') or []
        keywords = list(classifications)
        if c.get('card_type') == 'Legend':
            if 'Legend' not in keywords:
                keywords.insert(0, 'Legend')
        if c.get('is_eddiable'):
            keywords.append('Sellable (€$)')
            
        card_obj = {
            "id": c.get('external_id') or c.get('id'),
            "netdeck_id": c.get('id'),
            "print_number": c.get('print_number') or "000",
            "name": c.get('display_name') or c.get('name'),
            "card_title": c.get('name'),
            "subname": c.get('subname'),
            "faction": c.get('color') or "Neutral",
            "color": c.get('color') or "Neutral",
            "type": c.get('card_type') or "Unit",
            "rarity": c.get('rarity') or "Common",
            "cost": c.get('cost') if c.get('cost') is not None else 0,
            "atk": c.get('power') if c.get('power') is not None else 0,
            "power": c.get('power') if c.get('power') is not None else 0,
            "def": c.get('power') if c.get('power') is not None else 0,
            "ram": c.get('ram') if c.get('ram') is not None else 0,
            "is_eddiable": bool(c.get('is_eddiable')),
            "keywords": keywords,
            "ability": c.get('rules_text') or "",
            "flavor": c.get('flavor_text') or "",
            "artist": c.get('artist') or "WeirdCo Studios",
            "set_name": c.get('set', {}).get('name', 'Welcome to Night City'),
            "set_code": c.get('set', {}).get('code', 'retail'),
            "image_url": c.get('image_url'),
            "image_local": local_img,
            "is_official": True,
            "icon": "cpu"
        }
        normalized.append(card_obj)
        
    return normalized

def main():
    # 1. Fetch official cards
    raw_cards = fetch_official_cards()
    
    # 2. Download all images locally
    download_all_images(raw_cards)
    
    # 3. Backup previous cards if not already backed up
    if CARDS_JSON.exists() and not BACKUP_JSON.exists():
        with open(CARDS_JSON, 'r', encoding='utf-8') as f:
            old_cards = json.load(f)
        with open(BACKUP_JSON, 'w', encoding='utf-8') as f:
            json.dump(old_cards, f, indent=2)
        print(f"[*] Backed up custom cards to {BACKUP_JSON}")
        
    # 4. Normalize and write to data/cards.json
    normalized_cards = normalize_card_data(raw_cards)
    with open(CARDS_JSON, 'w', encoding='utf-8') as f:
        json.dump(normalized_cards, f, indent=2)
        
    print(f"[SUCCESS] Saved {len(normalized_cards)} normalized official cards to {CARDS_JSON}")

if __name__ == '__main__':
    main()
