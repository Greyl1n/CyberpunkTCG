#!/usr/bin/env python3
"""
Cyberpunk TCG - Community Decks Updater (cyberpunktcg.com / NetDeck.gg)
Fetches the latest tournament and community decks from cyberpunktcg.com,
including 3-Legend identities, 40-50 main deck cards, and Sideboard zones.
"""

import os
import sys
import re
import json
import time
import urllib.request
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
CARDS_FILE = DATA_DIR / "cards.json"
STARTERS_FILE = DATA_DIR / "starter_decks.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
    'Accept': 'application/json'
}

def normalize_text(s):
    if not s:
        return ""
    s = s.replace("’", "'").replace("‘", "'").replace("`", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r'[\u0300-\u036f]', '', s)
    return re.sub(r'[^a-z0-9]', '', s.lower())

def load_card_mappings():
    with open(CARDS_FILE, "r", encoding="utf-8") as f:
        cards = json.load(f)

    id_map = {}
    name_map = {}

    for c in cards:
        cid = c["id"]
        id_map[cid] = cid
        id_map[cid.replace("cb-", "")] = cid
        if c.get("netdeck_id"):
            id_map[c["netdeck_id"]] = cid
        if c.get("slug"):
            id_map[c["slug"]] = cid
            id_map["cb-" + c["slug"]] = cid

        name_lower = c["name"].lower().strip()
        name_map[name_lower] = cid
        name_map[normalize_text(c["name"])] = cid

        if c.get("card_title"):
            title_lower = c["card_title"].lower().strip()
            name_map[title_lower] = cid
            name_map[normalize_text(c["card_title"])] = cid

    return cards, id_map, name_map

def resolve_card_id(raw_id, raw_slug, raw_name, id_map, name_map):
    if raw_id and raw_id in id_map:
        return id_map[raw_id]
    if raw_slug:
        clean_slug = raw_slug.replace("cb-", "")
        if raw_slug in id_map:
            return id_map[raw_slug]
        if clean_slug in id_map:
            return id_map[clean_slug]
    if raw_name:
        nl = raw_name.lower().strip()
        if nl in name_map:
            return name_map[nl]
        norm = normalize_text(raw_name)
        if norm in name_map:
            return name_map[norm]
        # Strip subtitle if format is "Name — Subtitle" or "Name: Subtitle"
        base_name = re.split(r'[\u2014\u2013\-:]', raw_name)[0].strip()
        base_norm = normalize_text(base_name)
        if base_norm in name_map:
            return name_map[base_norm]
    return None

def fetch_json(url, timeout=10):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def update_decks():
    print("=" * 65)
    print("CYBERPUNK TCG // UPDATING COMMUNITY DECKS WITH SIDEBOARD")
    print("=" * 65)

    cards, id_map, name_map = load_card_mappings()
    card_dict = {c["id"]: c for c in cards}
    print(f"[*] Loaded {len(cards)} database cards for reference.")

    # 1. Preserve Official Core Starters from existing file
    official_starters = []
    if STARTERS_FILE.exists():
        with open(STARTERS_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f)
        for d in existing:
            if d.get("category") == "Official Starter":
                if "sideboard" not in d:
                    d["sideboard"] = []
                if "sideboard_count" not in d:
                    d["sideboard_count"] = 0
                official_starters.append(d)

    print(f"[*] Preserved {len(official_starters)} Official Core Starter decks.")

    # 2. Fetch public decks list from cyberpunktcg.com (both popular and recent)
    raw_deck_summaries = {}
    endpoints = [
        ("popular", "https://api.netdeck.gg/api/cyberpunk/decks/public?limit=80&sort=popular"),
        ("recent", "https://api.netdeck.gg/api/cyberpunk/decks/public?limit=80&sort=recent")
    ]

    for label, url in endpoints:
        print(f"[*] Querying {label} decks list from {url}...")
        try:
            data = fetch_json(url, timeout=12)
            items = data.get("items", [])
            for it in items:
                raw_deck_summaries[it["id"]] = it
            print(f"    -> Received {len(items)} {label} decks (Total unique: {len(raw_deck_summaries)})")
        except Exception as e:
            print(f"    [!] Warning: Failed fetching {label} decks: {e}")

    # 3. Fetch detailed deck information in parallel
    print(f"[*] Fetching full deck manifests & sideboard zones for {len(raw_deck_summaries)} decks...")
    full_decks = []

    def fetch_deck_detail(d_id, meta):
        d_url = f"https://api.netdeck.gg/api/cyberpunk/decks/{d_id}"
        try:
            data = fetch_json(d_url, timeout=10)
            return meta, data
        except Exception:
            return meta, None

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_deck_detail, d_id, meta) for d_id, meta in raw_deck_summaries.items()]
        for fut in as_completed(futures):
            meta, data = fut.result()
            if data:
                full_decks.append((meta, data))

    print(f"[+] Downloaded {len(full_decks)} full deck manifests.")

    # 4. Parse, validate, and extract Legends, Main Deck, and Sideboard
    community_decks = []
    seen_names = set()

    for meta, data in full_decks:
        d_id = meta["id"]
        d_name = (data.get("name") or meta.get("name") or "Unnamed Cyber Deck").strip()
        owner = (meta.get("owner") or {}).get("display_name") or "Community Netrunner"
        desc = (data.get("description") or f"Community deck curated from cyberpunktcg.com by {owner}.").strip()

        zones = data.get("zones", [])
        leg_zone = next((z for z in zones if z.get("zone_code") == "legends"), None)
        deck_zone = next((z for z in zones if z.get("zone_code") == "deck"), None)
        sb_zone = next((z for z in zones if z.get("zone_code") == "sideboard"), None)

        # Parse Legends
        legends = []
        for c_entry in (leg_zone.get("cards", []) if leg_zone else []):
            c_info = c_entry.get("card") or {}
            matched_id = resolve_card_id(
                c_entry.get("card_entity_id"),
                c_info.get("slug"),
                c_info.get("name"),
                id_map,
                name_map
            )
            if matched_id and matched_id not in legends:
                legends.append(matched_id)

        # Parse Main Deck Cards
        main_cards = []
        for c_entry in (deck_zone.get("cards", []) if deck_zone else []):
            qty = c_entry.get("quantity", 1)
            c_info = c_entry.get("card") or {}
            matched_id = resolve_card_id(
                c_entry.get("card_entity_id"),
                c_info.get("slug"),
                c_info.get("name"),
                id_map,
                name_map
            )
            if matched_id:
                # Merge if existing
                existing = next((m for m in main_cards if m["cardId"] == matched_id), None)
                if existing:
                    existing["count"] += qty
                else:
                    main_cards.append({"cardId": matched_id, "count": qty})

        # Parse Sideboard Cards
        sideboard_cards = []
        for c_entry in (sb_zone.get("cards", []) if sb_zone else []):
            qty = c_entry.get("quantity", 1)
            c_info = c_entry.get("card") or {}
            matched_id = resolve_card_id(
                c_entry.get("card_entity_id"),
                c_info.get("slug"),
                c_info.get("name"),
                id_map,
                name_map
            )
            if matched_id:
                existing = next((s for s in sideboard_cards if s["cardId"] == matched_id), None)
                if existing:
                    existing["count"] += qty
                else:
                    sideboard_cards.append({"cardId": matched_id, "count": qty})

        total_main = sum(c["count"] for c in main_cards)
        total_sideboard = sum(c["count"] for c in sideboard_cards)

        # Tournament legality rules: exactly 3 legends, 40 to 50 main deck cards, 0 to 15 sideboard cards
        if len(legends) != 3 or not (40 <= total_main <= 50) or total_sideboard > 15:
            continue

        # Skip duplicate generic "New Deck" if identical
        name_key = f"{d_name.lower()}:{owner.lower()}"
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        # Calculate dominant faction
        legend_colors = [card_dict[lid]["color"] for lid in legends if lid in card_dict]
        main_colors = [card_dict[m["cardId"]]["color"] for m in main_cards if m["cardId"] in card_dict]
        color_counts = Counter(legend_colors + main_colors)
        color_counts.pop("Neutral", None)
        dominant_color = color_counts.most_common(1)[0][0] if color_counts else "Neutral"

        slug_id = f"cyberpunktcg-{d_id[:8]}"

        deck_obj = {
            "id": slug_id,
            "netdeck_deck_id": d_id,
            "name": d_name,
            "faction": dominant_color,
            "category": "Community Deck",
            "source": "cyberpunktcg.com",
            "author": owner,
            "description": desc,
            "legends": legends,
            "cards": main_cards,
            "sideboard": sideboard_cards,
            "total_cards": total_main,
            "sideboard_count": total_sideboard
        }
        community_decks.append(deck_obj)

    # Sort community decks: decks with sideboards and high quality first
    community_decks.sort(key=lambda d: (d["sideboard_count"] > 0, d["name"]), reverse=True)

    print(f"[+] Total legal community decks validated: {len(community_decks)}")
    with_sb = sum(1 for d in community_decks if d["sideboard_count"] > 0)
    print(f"[+] Decks with dedicated Sideboards: {with_sb} / {len(community_decks)}")

    # 5. Combine and save to data/starter_decks.json
    all_decks = official_starters + community_decks
    with open(STARTERS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_decks, f, indent=2)

    print(f"[*] Saved {len(all_decks)} decks ({len(official_starters)} official + {len(community_decks)} community) to {STARTERS_FILE}")
    print("=" * 65)
    return len(all_decks)

if __name__ == "__main__":
    update_decks()
