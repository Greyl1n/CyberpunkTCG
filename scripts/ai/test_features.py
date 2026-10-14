#!/usr/bin/env python3
"""
Test card feature extraction and self-similarity matrix across all 151 cards (v3).
"""
import sys
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / 'scripts' / 'ai'))
from build_card_features import compute_raw_features, DIMENSION

def main():
    cards_json_path = ROOT / 'data' / 'cards.json'
    cards = json.loads(cards_json_path.read_text(encoding='utf-8'))
    print(f"Total cards in JSON: {len(cards)}")

    vectors = {}
    missing = []
    for c in cards:
        img_path = ROOT / c.get('image_local', '')
        if img_path.exists():
            with Image.open(img_path) as im:
                vec = compute_raw_features(im)
                vectors[c['id']] = vec
        else:
            missing.append(c['id'])

    print(f"Successfully computed embeddings for {len(vectors)} cards (dim: {DIMENSION}). Missing images: {len(missing)}")

    # Check pairwise cosine similarities on centered features
    ids = list(vectors.keys())
    raw_mat = np.array([vectors[cid] for cid in ids])
    mean_vec = raw_mat.mean(axis=0)
    mat = raw_mat - mean_vec
    mat /= np.linalg.norm(mat, axis=1, keepdims=True)

    sims = np.dot(mat, mat.T)  # shape (N, N)

    # Self similarity should be 1.0
    diag = np.diag(sims)
    print(f"Self-similarity min: {diag.min():.4f}, max: {diag.max():.4f}")

    # Off-diagonal max similarity (most similar two cards in the entire game)
    np.fill_diagonal(sims, -1.0)
    max_sim = np.max(sims)
    max_idx = np.unravel_index(np.argmax(sims), sims.shape)
    c1, c2 = ids[max_idx[0]], ids[max_idx[1]]
    print(f"Highest similarity between different cards: {max_sim:.4f} between '{c1}' and '{c2}'")

    # Margin check
    top2_margin = 1.0 - max_sim
    print(f"Separation margin to closest pair: {top2_margin:.4f}")

if __name__ == '__main__':
    main()
