#!/usr/bin/env python3
"""
Cyberpunk TCG - Card fingerprint database builder / updater.

Rebuilds data/card_embeddings.json and models/manifest.json from data/cards.json
and the card images in assets/cards/. A full rebuild of ~150 cards takes a few
seconds.

Adding a new set:
  1. Add card entries to data/cards.json (with "image_local").
  2. Put the images in assets/cards/.
  3. python scripts/ai/update_cards_ai.py
  4. python scripts/ai/test_robustness.py   (or python -m unittest discover tests)
  5. python scripts/build_monolith.py       (and rebuild apps as needed)

Usage:
  python scripts/ai/update_cards_ai.py            # rebuild
  python scripts/ai/update_cards_ai.py --status   # show coverage only
"""

import sys
import json
import argparse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = ROOT_DIR / "models"
EMB_FILE = DATA_DIR / "card_embeddings.json"
MANIFEST_FILE = MODELS_DIR / "manifest.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_card_features import build_feature_database


def load_cards():
    return json.loads((DATA_DIR / "cards.json").read_text(encoding="utf-8"))


def status():
    cards = load_cards()
    print("=" * 60)
    print("CARD FINGERPRINT DATABASE STATUS")
    print("=" * 60)
    print(f"Cards in cards.json:      {len(cards)}")
    if not EMB_FILE.exists():
        print("card_embeddings.json:     MISSING - run without --status to build")
        return 1
    db = json.loads(EMB_FILE.read_text(encoding="utf-8"))
    emb = db.get("embeddings", {})
    missing = [c["id"] for c in cards if c["id"] not in emb]
    stale = [i for i in emb if i not in {c["id"] for c in cards}]
    print(f"Fingerprints indexed:     {len(emb)}")
    print(f"Embedding version:        {db.get('version', 'legacy')}")
    print(f"Algorithm:                {db.get('algorithm', 'unknown')}")
    print(f"Last built:               {db.get('updated_at', '?')}")
    print(f"Thresholds:               {db.get('thresholds', {})}")
    print(f"Missing from index:       {len(missing)}  {missing[:5]}")
    print(f"Removed cards still in:   {len(stale)}  {stale[:5]}")
    ok = not missing and not stale and len(emb) == len(cards)
    print("[OK] Up to date." if ok else "[!] Rebuild needed: python scripts/ai/update_cards_ai.py")
    print("=" * 60)
    return 0 if ok else 1


def build():
    build_feature_database()
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--status", action="store_true", help="show index coverage only")
    ap.add_argument("--force", action="store_true", help="(kept for compatibility; every run is a full rebuild)")
    a = ap.parse_args()
    sys.exit(status() if a.status else build())
