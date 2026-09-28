#!/usr/bin/env python3
"""
Raw WeirdCo Card Data Fetcher
Fetches all raw card JSON from the NetDeck API and saves to data/weirdco_official_raw.json.
"""

import urllib.request
import json
from pathlib import Path

def get_root_dir():
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "src").exists() and (p / "data").exists():
            return p
        p = p.parent
    return Path(__file__).resolve().parents[2]

def fetch_all():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
    }

    all_cards = []
    offset = 0
    limit = 100

    while True:
        url = f'https://api.netdeck.gg/api/cards/cyberpunk?limit={limit}&offset={offset}'
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
        items = data.get('items', [])
        if not items:
            break
        all_cards.extend(items)
        offset += len(items)
        total = data.get('total', 0)
        print(f"Fetched {len(all_cards)} / {total} cards...")
        if len(all_cards) >= total:
            break

    root_dir = get_root_dir()
    out_file = root_dir / 'data' / 'weirdco_official_raw.json'
    print(f"Done! Total cards fetched: {len(all_cards)}")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(all_cards, f, indent=2)

    print(f"Saved raw card data to {out_file}")

if __name__ == "__main__":
    fetch_all()
