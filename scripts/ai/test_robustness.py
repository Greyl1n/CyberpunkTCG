#!/usr/bin/env python3
"""
Robustness benchmark for the card fingerprint matcher.

Simulates phone-camera captures of every card (perspective tilt, loose/tight
crop with background, exposure, colour cast, shading gradient, glare, blur,
sensor noise, JPEG) and reports:
  * top-1 accuracy
  * single-frame accept rate / false-accept rate with the shipped thresholds
  * multi-frame vote accept rate (same card in N of the last M frames)

Usage:
  python scripts/ai/test_robustness.py            # normal + hard conditions
  python scripts/ai/test_robustness.py --trials 3
Requires: numpy, pillow, opencv-python
"""
import sys
import json
import argparse
from pathlib import Path
import numpy as np
from PIL import Image

try:
    import cv2
except ImportError:  # pragma: no cover
    print("opencv-python is required for the robustness benchmark: pip install opencv-python")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'ai'))
from build_card_features import canonicalize_image, extract_features_from_pixels, THRESHOLDS  # noqa: E402


def simulate(rgb, rng, hard=False):
    h, w = rgb.shape[:2]
    bgc = rng.integers(0, 255, 3)
    pad = int(0.35 * w)
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 3), np.uint8)
    canvas[:] = bgc
    canvas = np.clip(canvas + rng.normal(0, 25, canvas.shape), 0, 255).astype(np.uint8)
    canvas[pad:pad + h, pad:pad + w] = rgb
    j = 0.06 if hard else 0.035
    src = np.float32([[pad, pad], [pad + w, pad], [pad + w, pad + h], [pad, pad + h]])
    dst = src + rng.uniform(-j, j, (4, 2)).astype(np.float32) * np.float32([w, h])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(canvas, M, (canvas.shape[1], canvas.shape[0]),
                                 borderValue=tuple(int(x) for x in bgc))
    m = 0.06 if hard else 0.03
    x0 = pad + int(rng.uniform(-m, m) * w); x1 = pad + w + int(rng.uniform(-m, m) * w)
    y0 = pad + int(rng.uniform(-m, m) * h); y1 = pad + h + int(rng.uniform(-m, m) * h)
    crop = warped[y0:y1, x0:x1].astype(np.float32)
    crop = crop * rng.uniform(0.55, 1.35) * rng.uniform(0.8, 1.2, 3)
    yy = np.linspace(0, 1, crop.shape[0])[:, None, None]
    crop = crop * (1 + rng.uniform(-0.3, 0.3) * (yy - 0.5))
    crop = np.clip(crop, 0, 255)
    crop = 255 * (crop / 255) ** rng.uniform(0.75, 1.3)
    if rng.random() < 0.4:
        cy, cx = rng.integers(0, crop.shape[0]), rng.integers(0, crop.shape[1])
        Y, X = np.ogrid[:crop.shape[0], :crop.shape[1]]
        r = crop.shape[1] * rng.uniform(0.1, 0.25)
        crop = crop + 120 * np.exp(-((Y - cy) ** 2 + (X - cx) ** 2) / (2 * r * r))[..., None]
    crop = np.clip(crop, 0, 255).astype(np.uint8)
    s = rng.uniform(0.4, 0.9)
    crop = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    k = int(rng.choice([3, 5, 7])) if hard else int(rng.choice([1, 3, 5]))
    if k > 1:
        crop = cv2.GaussianBlur(crop, (k, k), 0)
    crop = np.clip(crop + rng.normal(0, 6, crop.shape), 0, 255).astype(np.uint8)
    _, enc = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 60])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


def run(trials=2):
    cards = json.loads((ROOT / 'data' / 'cards.json').read_text(encoding='utf-8'))
    db = json.loads((ROOT / 'data' / 'card_embeddings.json').read_text(encoding='utf-8'))
    ids = list(db['embeddings'])
    R = np.array([db['embeddings'][i] for i in ids], dtype=np.float64)
    mu = np.array(db['mean_vector'], dtype=np.float64)
    th = db.get('thresholds', THRESHOLDS)
    by_id = {c['id']: c for c in cards}

    imgs = {}
    for cid in ids:
        im = Image.open(ROOT / by_id[cid]['image_local']).convert('RGBA')
        bg = Image.new('RGBA', im.size, (128, 128, 128, 255))
        im = Image.alpha_composite(bg, im).convert('RGB').resize((366, 512), Image.Resampling.BOX)
        imgs[cid] = np.array(im)

    def query(img_rgb):
        q = extract_features_from_pixels(canonicalize_image(Image.fromarray(img_rgb))) - mu
        q /= np.linalg.norm(q)
        s = R @ q
        o = np.argsort(-s)
        return o[0], s[o[0]], s[o[0]] - s[o[1]]

    overall_ok = True
    for hard in (False, True):
        rng = np.random.default_rng(1234 + hard)
        n = correct = acc1 = false1 = vote_ok = vote_false = 0
        for _ in range(trials):
            for k, cid in enumerate(ids):
                # 4 consecutive "frames" of the same card for vote simulation
                frames = [query(simulate(imgs[cid], rng, hard)) for _ in range(4)]
                top, score, margin = frames[0]
                n += 1
                correct += top == k
                single = score >= th['min_score'] and margin >= th['min_margin']
                acc1 += single and top == k
                false1 += single and top != k
                # vote: accept first card seen confirm_frames times with relaxed thresholds
                counts = {}
                decided = None
                for (t, s, m) in frames:
                    if s >= th['min_score'] and m >= th['min_margin']:
                        decided = t; break
                    if s >= th['vote_min_score'] and m >= th['vote_min_margin']:
                        counts[t] = counts.get(t, 0) + 1
                        if counts[t] >= th['confirm_frames']:
                            decided = t; break
                vote_ok += decided == k
                vote_false += decided is not None and decided != k
        label = 'HARD  ' if hard else 'NORMAL'
        print(f"[{label}] top-1 {100*correct/n:5.1f}% | single-frame accept {100*acc1/n:5.1f}% "
              f"(false {100*false1/n:4.1f}%) | 4-frame vote accept {100*vote_ok/n:5.1f}% (false {100*vote_false/n:4.1f}%)")
        if not hard and (correct / n < 0.95 or false1 / n > 0.02):
            overall_ok = False
    return overall_ok


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--trials', type=int, default=2)
    ok = run(ap.parse_args().trials)
    sys.exit(0 if ok else 1)
