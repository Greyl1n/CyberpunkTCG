/**
 * Cyberpunk TCG - Card Fingerprint Matcher (v3.0)
 *
 * Client-side illumination-invariant feature extraction and real-time cosine
 * similarity matching against data/card_embeddings.json.
 *
 * The math in extractFeaturesFromPixels() mirrors
 * scripts/ai/build_card_features.py :: extract_features_from_pixels() exactly.
 * Parity is verified by tests/test_ai_vision.py (via Node.js).
 *
 * Decision rules (thresholds come from the embeddings payload):
 *   - instant accept: score >= min_score AND margin >= min_margin
 *   - vote accept   : same top-1 card in `confirm_frames` of the last `vote_window`
 *                     frames, each with score >= vote_min_score AND margin >= vote_min_margin
 */
(function (root) {
  'use strict';

  const WORK_W = 64, WORK_H = 88;
  const INSET_X = 2, INSET_Y = 2;
  const THUMB_W = 16, THUMB_H = 22;
  const GRID_W = 8, GRID_H = 11;
  const W_LUMA = 1.0, W_GRAD = 0.5, W_CHROMA = 1.0;
  const DIMENSION = THUMB_W * THUMB_H + GRID_W * GRID_H * 3; // 616

  const DEFAULT_THRESHOLDS = {
    min_score: 0.50,
    min_margin: 0.10,
    vote_min_score: 0.36,
    vote_min_margin: 0.04,
    confirm_frames: 2,
    vote_window: 4
  };

  function znormInPlace(arr) {
    const n = arr.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += arr[i];
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) {
      arr[i] -= mean;
      v += arr[i] * arr[i];
    }
    const sd = Math.sqrt(v / n);
    if (sd > 1e-6) {
      for (let i = 0; i < n; i++) arr[i] /= sd;
    }
    return arr;
  }

  function unitInto(src, dst, offset, weight) {
    let n = 0;
    for (let i = 0; i < src.length; i++) n += src[i] * src[i];
    n = Math.sqrt(n);
    const k = n > 1e-6 ? weight / n : weight;
    for (let i = 0; i < src.length; i++) dst[offset + i] = src[i] * k;
  }

  function blockMean(img, w, h, gw, gh) {
    const bw = w / gw, bh = h / gh, area = bw * bh;
    const out = new Float64Array(gw * gh);
    for (let r = 0; r < gh; r++) {
      for (let c = 0; c < gw; c++) {
        let s = 0;
        for (let y = r * bh; y < (r + 1) * bh; y++) {
          const row = y * w;
          for (let x = c * bw; x < (c + 1) * bw; x++) s += img[row + x];
        }
        out[r * gw + c] = s / area;
      }
    }
    return out;
  }

  /**
   * Raw (un-centered) v3 feature vector from a 64x88 RGBA pixel buffer.
   * @param {Uint8ClampedArray|Uint8Array|ArrayLike<number>} pixels 64*88*4 RGBA values
   * @returns {Float64Array} 616-D raw feature vector
   */
  function extractFeaturesFromPixels(pixels) {
    const N = WORK_W * WORK_H;
    const R = new Float64Array(N), G = new Float64Array(N), B = new Float64Array(N);
    let mr = 0, mg = 0, mb = 0;
    for (let i = 0; i < N; i++) {
      const p = i * 4;
      R[i] = pixels[p] / 255.0; G[i] = pixels[p + 1] / 255.0; B[i] = pixels[p + 2] / 255.0;
      mr += R[i]; mg += G[i]; mb += B[i];
    }
    mr = mr / N + 1e-6; mg = mg / N + 1e-6; mb = mb / N + 1e-6;
    const mAll = (mr + mg + mb) / 3;
    const kr = mAll / mr, kg = mAll / mg, kb = mAll / mb;

    // 0. Gray-world white balance + luminance
    const gray = new Float64Array(N);
    const rg = new Float64Array(N), yb = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const r = R[i] * kr, g = G[i] * kg, b = B[i] * kb;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      const s = r + g + b + 1e-3;
      rg[i] = (r - g) / s;
      yb[i] = (r + g - 2.0 * b) / s;
    }
    znormInPlace(gray);

    // 1. Luminance thumbnail
    const fLuma = znormInPlace(blockMean(gray, WORK_W, WORK_H, THUMB_W, THUMB_H));

    // 2. Gradient energy (central differences, edge-replicated)
    const mag = new Float64Array(N);
    for (let y = 0; y < WORK_H; y++) {
      const yu = y > 0 ? y - 1 : 0, yd = y < WORK_H - 1 ? y + 1 : WORK_H - 1;
      for (let x = 0; x < WORK_W; x++) {
        const xl = x > 0 ? x - 1 : 0, xr = x < WORK_W - 1 ? x + 1 : WORK_W - 1;
        const gx = gray[y * WORK_W + xr] - gray[y * WORK_W + xl];
        const gy = gray[yd * WORK_W + x] - gray[yu * WORK_W + x];
        mag[y * WORK_W + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    const fGrad = znormInPlace(blockMean(mag, WORK_W, WORK_H, GRID_W, GRID_H));

    // 3. Opponent-colour chroma
    const c1 = blockMean(rg, WORK_W, WORK_H, GRID_W, GRID_H);
    const c2 = blockMean(yb, WORK_W, WORK_H, GRID_W, GRID_H);
    const fChroma = new Float64Array(c1.length * 2);
    fChroma.set(c1, 0);
    fChroma.set(c2, c1.length);
    let cm = 0;
    for (let i = 0; i < fChroma.length; i++) cm += fChroma[i];
    cm /= fChroma.length;
    for (let i = 0; i < fChroma.length; i++) fChroma[i] -= cm;

    const out = new Float64Array(DIMENSION);
    unitInto(fLuma, out, 0, W_LUMA);
    unitInto(fGrad, out, fLuma.length, W_GRAD);
    unitInto(fChroma, out, fLuma.length + fGrad.length, W_CHROMA);
    return out;
  }

  class AICardMatcher {
    constructor() {
      this.isLoaded = false;
      this.ids = [];
      this.matrix = null;       // Float32Array ids.length * dim
      this.mean = null;         // Float64Array dim
      this.dim = DIMENSION;
      this.cardsIndex = {};
      this.thresholds = Object.assign({}, DEFAULT_THRESHOLDS);
      this.manifest = null;
      this.lastInferenceMs = null;
      this.loadError = null;
      this._work = null;
      this._workCtx = null;
      this._steps = [];
      this._cardLookup = null;
    }

    async init() {
      try {
        let payload = root.__CYBERPUNK_CARD_EMBEDDINGS__;
        if (!payload || !payload.embeddings) {
          const resp = await fetch('data/card_embeddings.json', { cache: 'no-cache' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          payload = await resp.json();
        }
        this.loadFromPayload(payload);
        return this.isLoaded;
      } catch (e) {
        this.loadError = String(e);
        console.warn('[CardMatcher] Could not load embeddings:', e);
        return false;
      }
    }

    loadFromPayload(p) {
      if (!p || !p.embeddings) return;
      const dim = p.dimension || DIMENSION;
      if (dim !== DIMENSION || !Array.isArray(p.mean_vector)) {
        this.loadError = `Incompatible embeddings (dimension ${dim}, version ${p.version}). Rebuild with scripts/ai/update_cards_ai.py`;
        console.warn('[CardMatcher]', this.loadError);
        this.isLoaded = false;
        return;
      }
      this.ids = Object.keys(p.embeddings);
      this.dim = dim;
      this.matrix = new Float32Array(this.ids.length * dim);
      this.ids.forEach((id, r) => this.matrix.set(p.embeddings[id], r * dim));
      this.mean = Float64Array.from(p.mean_vector);
      this.cardsIndex = p.cards_index || {};
      this.thresholds = Object.assign({}, DEFAULT_THRESHOLDS, p.thresholds || {});
      this.manifest = {
        version: p.version || '3.0.0',
        algorithm: p.algorithm || 'CyberVision-PerceptualEmbedding-v3',
        dimension: dim,
        cardCount: this.ids.length,
        updatedAt: p.updated_at
      };
      this._cardLookup = null;
      this.loadError = null;
      this.isLoaded = true;
    }

    _scratch(i, w, h) {
      if (!this._steps[i]) {
        const c = document.createElement('canvas');
        this._steps[i] = { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
      }
      const s = this._steps[i];
      if (s.c.width !== w || s.c.height !== h) { s.c.width = w; s.c.height = h; }
      s.ctx.imageSmoothingEnabled = true;
      s.ctx.imageSmoothingQuality = 'high';
      return s;
    }

    /**
     * Draw a region of any canvas/image/video into the canonical 64x88 canvas
     * (border inset + stepwise anti-aliased downscale) and return RGBA pixels.
     * @param {CanvasImageSource} source
     * @param {{x:number,y:number,w:number,h:number}} [rect] region in source pixels (defaults to full source)
     */
    canonicalPixels(source, rect) {
      if (typeof document === 'undefined') return null;
      const sw = source.videoWidth || source.naturalWidth || source.width;
      const sh = source.videoHeight || source.naturalHeight || source.height;
      const r = rect || { x: 0, y: 0, w: sw, h: sh };
      // Trim inset border
      let sx = r.x + r.w * INSET_X / WORK_W;
      let sy = r.y + r.h * INSET_Y / WORK_H;
      let cw = r.w * (WORK_W - 2 * INSET_X) / WORK_W;
      let ch = r.h * (WORK_H - 2 * INSET_Y) / WORK_H;

      // Stepwise halving keeps the downscale anti-aliased on every browser
      let src = source, step = 0;
      while (cw > WORK_W * 2.5 && ch > WORK_H * 2.5) {
        const nw = Math.max(WORK_W, Math.round(cw / 2));
        const nh = Math.max(WORK_H, Math.round(ch / 2));
        const s = this._scratch(step, nw, nh);
        s.ctx.drawImage(src, sx, sy, cw, ch, 0, 0, nw, nh);
        src = s.c; sx = 0; sy = 0; cw = nw; ch = nh; step++;
      }
      if (!this._work) {
        this._work = document.createElement('canvas');
        this._work.width = WORK_W;
        this._work.height = WORK_H;
        this._workCtx = this._work.getContext('2d', { willReadFrequently: true });
      }
      const ctx = this._workCtx;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, sx, sy, cw, ch, 0, 0, WORK_W, WORK_H);
      return ctx.getImageData(0, 0, WORK_W, WORK_H).data;
    }

    /**
     * Extract the centered, unit-length query vector for a source region.
     * @returns {Float32Array|null}
     */
    extractFeatures(source, rect) {
      const px = this.canonicalPixels(source, rect);
      if (!px) return null;
      return this.centerQuery(extractFeaturesFromPixels(px));
    }

    centerQuery(raw) {
      const q = new Float32Array(this.dim);
      let n = 0;
      for (let i = 0; i < this.dim; i++) {
        const v = raw[i] - (this.mean ? this.mean[i] : 0);
        q[i] = v;
        n += v * v;
      }
      n = Math.sqrt(n);
      if (n > 1e-9) for (let i = 0; i < this.dim; i++) q[i] /= n;
      return q;
    }

    lookupCard(id) {
      const cards = root.stateStore?.cards || [];
      if (!this._cardLookup || this._cardLookup.size !== cards.length) {
        this._cardLookup = new Map(cards.map(c => [c.id, c]));
      }
      return this._cardLookup.get(id) || this.cardsIndex[id] || { id };
    }

    /**
     * Cosine similarity against the reference matrix.
     * @returns {{bestCard, candidateId, score, margin, confidence, accepted, topMatches}}
     */
    match(queryVec, topK = 3) {
      const empty = { bestCard: null, candidateId: null, score: 0, margin: 0, confidence: 0, accepted: false, topMatches: [] };
      if (!this.isLoaded || !queryVec) return empty;

      const t0 = (root.performance || Date).now();
      const n = this.ids.length, dim = this.dim, M = this.matrix;
      let b1 = -1, b2 = -1, s1 = -Infinity, s2 = -Infinity;
      const scores = new Float32Array(n);
      for (let r = 0; r < n; r++) {
        let s = 0;
        const off = r * dim;
        for (let i = 0; i < dim; i++) s += M[off + i] * queryVec[i];
        scores[r] = s;
        if (s > s1) { s2 = s1; b2 = b1; s1 = s; b1 = r; }
        else if (s > s2) { s2 = s; b2 = r; }
      }
      const margin = s1 - (b2 >= 0 ? s2 : -1);
      const th = this.thresholds;
      const accepted = s1 >= th.min_score && margin >= th.min_margin;

      // Confidence display metric (0 - 100%)
      const scorePart = Math.min(1, Math.max(0, s1 / Math.max(0.01, th.min_score)));
      const marginPart = Math.min(1, Math.max(0, margin / Math.max(0.01, th.min_margin)));
      const confidence = Math.round(100 * (0.5 * scorePart + 0.5 * marginPart));

      let topMatches = [];
      if (topK > 0) {
        topMatches = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, topK)
          .map(r => ({ id: this.ids[r], score: scores[r] }));
      }
      this.lastInferenceMs = (root.performance || Date).now() - t0;

      return {
        bestCard: accepted ? this.lookupCard(this.ids[b1]) : null,
        candidateId: this.ids[b1],
        score: s1,
        margin: margin,
        confidence: confidence,
        accepted: accepted,
        topMatches
      };
    }
  }

  root.CardFingerprint = {
    WORK_W,
    WORK_H,
    DIMENSION,
    DEFAULT_THRESHOLDS,
    extractFeaturesFromPixels,
    AICardMatcher
  };
  root.cyberCardMatcher = new AICardMatcher();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CardFingerprint;
  }
})(typeof window !== 'undefined' ? window : globalThis);
