#!/usr/bin/env python3
"""
Cyberpunk TCG - AI Feature Indexer & Model Builder (v3.0)

Extracts illumination-invariant perceptual fingerprints for all cards in
data/cards.json and generates data/card_embeddings.json and models/manifest.json.

The feature math in `extract_features_from_pixels` is mirrored 1:1 in
src/js/ai_card_matcher.js (`extractFeaturesFromPixels`). If you change one,
change the other and run `python -m unittest tests.test_ai_vision` (it
verifies Python/JS parity through Node.js when available).

v3 fingerprint (616-D, per 64x88 canonical card image):
  0. Gray-world white balance       -> invariant to colour cast / exposure
  1. 16x22 z-normalised luminance thumbnail (352)
  2. 8x11 gradient-energy grid (88)       -> layout / text-box structure
  3. 8x11 opponent-colour chroma grid (2 x 88 = 176)
  Each group is unit-normalised then weighted (1.0 / 0.5 / 1.0).
  The dataset mean vector is subtracted from every embedding (and from the
  live camera query at runtime) before L2 normalisation. This "centering"
  removes what all cards have in common and greatly widens the gap between
  the correct card and the runner-up.
"""

import sys
import json
import time
from pathlib import Path
import numpy as np
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / 'data'
MODELS_DIR = ROOT_DIR / 'models'

VERSION = "3.0.0"
ALGORITHM = "CyberVision-PerceptualEmbedding-v3"
ENGINE = "edge-perceptual-v3"

WORK_W, WORK_H = 64, 88
# Border trimmed before resizing (in canonical pixels). Keeps background /
# sleeve edges out of the fingerprint when the crop is slightly loose.
INSET_X, INSET_Y = 2, 2
THUMB_W, THUMB_H = 16, 22
GRID_W, GRID_H = 8, 11
W_LUMA, W_GRAD, W_CHROMA = 1.0, 0.5, 1.0
DIMENSION = THUMB_W * THUMB_H + GRID_W * GRID_H + 2 * GRID_W * GRID_H  # 616

# Decision thresholds on centered cosine similarity (calibrated with
# scripts/ai/test_robustness.py on simulated camera captures).
THRESHOLDS = {
    "min_score": 0.50,        # single-frame instant accept
    "min_margin": 0.10,
    "vote_min_score": 0.36,   # multi-frame accept (same card in N of last M frames)
    "vote_min_margin": 0.04,
    "confirm_frames": 2,
    "vote_window": 4,
}


def _znorm(x: np.ndarray) -> np.ndarray:
    x = x - x.mean()
    s = x.std()
    return x / s if s > 1e-6 else x


def _unit(x: np.ndarray) -> np.ndarray:
    n = np.sqrt(np.sum(x * x))
    return x / n if n > 1e-6 else x


def _block_mean(img: np.ndarray, bh: int, bw: int) -> np.ndarray:
    h, w = img.shape
    return img.reshape(h // bh, bh, w // bw, bw).mean(axis=(1, 3))


def extract_features_from_pixels(rgb: np.ndarray) -> np.ndarray:
    """
    Raw (un-centered) v3 feature vector from an 88x64x3 RGB array (uint8 or 0..255 floats).
    Must stay numerically identical to extractFeaturesFromPixels() in ai_card_matcher.js.
    """
    a = np.asarray(rgb, dtype=np.float64)[:, :, :3] / 255.0
    assert a.shape == (WORK_H, WORK_W, 3), a.shape

    # 0. Gray-world white balance
    means = a.reshape(-1, 3).mean(axis=0) + 1e-6
    a = a * (means.mean() / means)

    # 1. Luminance thumbnail
    g = _znorm(0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2])
    f_luma = _znorm(_block_mean(g, WORK_H // THUMB_H, WORK_W // THUMB_W)).ravel()

    # 2. Gradient energy (central differences, edge-replicated border)
    gp = np.pad(g, 1, mode='edge')
    gx = gp[1:-1, 2:] - gp[1:-1, :-2]
    gy = gp[2:, 1:-1] - gp[:-2, 1:-1]
    mag = np.sqrt(gx * gx + gy * gy)
    f_grad = _znorm(_block_mean(mag, WORK_H // GRID_H, WORK_W // GRID_W)).ravel()

    # 3. Opponent-colour chroma
    s = a.sum(axis=2) + 1e-3
    rg = (a[:, :, 0] - a[:, :, 1]) / s
    yb = (a[:, :, 0] + a[:, :, 1] - 2.0 * a[:, :, 2]) / s
    f_chroma = np.concatenate([
        _block_mean(rg, WORK_H // GRID_H, WORK_W // GRID_W).ravel(),
        _block_mean(yb, WORK_H // GRID_H, WORK_W // GRID_W).ravel(),
    ])
    f_chroma = f_chroma - f_chroma.mean()

    return np.concatenate([
        _unit(f_luma) * W_LUMA,
        _unit(f_grad) * W_GRAD,
        _unit(f_chroma) * W_CHROMA,
    ]).astype(np.float64)


def canonicalize_image(img: Image.Image) -> np.ndarray:
    """Composite onto neutral grey, trim the inset border and box-resize to 64x88 RGB uint8."""
    im = img.convert('RGBA')
    bg = Image.new('RGBA', im.size, (128, 128, 128, 255))
    im = Image.alpha_composite(bg, im).convert('RGB')
    w, h = im.size
    box = (w * INSET_X / WORK_W, h * INSET_Y / WORK_H,
           w * (WORK_W - INSET_X) / WORK_W, h * (WORK_H - INSET_Y) / WORK_H)
    im = im.resize((WORK_W, WORK_H), Image.Resampling.BOX, box=box)
    return np.array(im, dtype=np.uint8)


def compute_raw_features(img: Image.Image) -> np.ndarray:
    return extract_features_from_pixels(canonicalize_image(img))


def compute_card_features(img: Image.Image, mean_vector=None) -> list:
    """
    Final (centered, unit-length) fingerprint for a single image.
    If mean_vector is None the raw normalised vector is returned (useful for tests).
    """
    v = compute_raw_features(img)
    if mean_vector is not None:
        v = v - np.asarray(mean_vector, dtype=np.float64)
    v = _unit(v)
    return [round(float(x), 5) for x in v]


def build_feature_database():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    cards_json_path = DATA_DIR / 'cards.json'
    if not cards_json_path.exists():
        raise FileNotFoundError(f"Missing cards database at {cards_json_path}")

    cards = json.loads(cards_json_path.read_text(encoding='utf-8'))
    print(f"[*] Found {len(cards)} cards in {cards_json_path.name}")

    raw = {}
    card_index = {}
    missing_assets = []

    start_t = time.time()
    for card in cards:
        cid = card['id']
        img_rel = card.get('image_local', '')
        img_path = ROOT_DIR / img_rel
        if not img_rel or not img_path.exists():
            missing_assets.append((cid, img_rel))
            continue
        try:
            with Image.open(img_path) as im:
                raw[cid] = compute_raw_features(im)
            card_index[cid] = {
                "id": cid,
                "name": card.get("name", ""),
                "print_number": card.get("print_number", ""),
                "set_code": card.get("set_code", ""),
                "faction": card.get("faction", ""),
                "type": card.get("type", ""),
                "cost": card.get("cost", 0),
                "rarity": card.get("rarity", ""),
                "image_local": card.get("image_local", "")
            }
        except Exception as e:
            print(f"[!] Error processing {cid}: {e}")

    if not raw:
        raise RuntimeError("No card images could be indexed.")

    ids = list(raw)
    mat = np.stack([raw[i] for i in ids])
    mean_vec = mat.mean(axis=0)
    centered = mat - mean_vec
    centered /= np.linalg.norm(centered, axis=1, keepdims=True)
    embeddings = {cid: [round(float(x), 5) for x in centered[k]] for k, cid in enumerate(ids)}

    # Database self-separation report
    sims = centered @ centered.T
    np.fill_diagonal(sims, -1.0)
    i, j = np.unravel_index(np.argmax(sims), sims.shape)
    elapsed = time.time() - start_t
    print(f"[OK] Indexed {len(embeddings)}/{len(cards)} card fingerprints in {elapsed:.2f}s")
    print(f"[i]  Most similar pair: {ids[i]} <-> {ids[j]} (cos {sims[i, j]:.3f})")
    if missing_assets:
        print(f"[!] Warning: {len(missing_assets)} cards had missing local images:")
        for cid, rel in missing_assets[:5]:
            print(f"    - {cid}: {rel}")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    params = {
        "work_size": [WORK_W, WORK_H],
        "inset": [INSET_X, INSET_Y],
        "thumb": [THUMB_W, THUMB_H],
        "grid": [GRID_W, GRID_H],
        "weights": [W_LUMA, W_GRAD, W_CHROMA],
    }
    out_payload = {
        "version": VERSION,
        "algorithm": ALGORITHM,
        "dimension": DIMENSION,
        "target_aspect": "63:88",
        "card_count": len(embeddings),
        "updated_at": now,
        "params": params,
        "thresholds": THRESHOLDS,
        "mean_vector": [round(float(x), 6) for x in mean_vec],
        "cards_index": card_index,
        "embeddings": embeddings
    }

    out_file = DATA_DIR / 'card_embeddings.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(out_payload, f, separators=(',', ':'))
    print(f"[OK] Saved embeddings database to {out_file} ({out_file.stat().st_size // 1024} KB)")

    manifest = {
        "model_name": "CyberVision Neural Core",
        "version": VERSION,
        "engine": ENGINE,
        "algorithm": ALGORITHM,
        "dimension": DIMENSION,
        "cards_indexed": len(embeddings),
        "target_resolution": [WORK_W, WORK_H],
        "params": params,
        "thresholds": THRESHOLDS,
        "supported_sets": sorted({c.get("set_name", "") for c in cards if c.get("set_name")}),
        "embeddings_file": "data/card_embeddings.json",
        "updated_at": now
    }
    manifest_file = MODELS_DIR / 'manifest.json'
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"[OK] Saved AI model manifest to {manifest_file}")
    return out_payload


if __name__ == '__main__':
    build_feature_database()
