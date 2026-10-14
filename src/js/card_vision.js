/**
 * Cyberpunk TCG - Card Vision & Auto-Framing Engine (v3.0)
 * Provides:
 * 1. Single downscaled frame grab per scan tick (shared by all detectors)
 * 2. Card boundary / quadrilateral detection restricted to the reticle region
 * 3. 4-point perspective transform (homography) with bilinear sampling to deskew tilted cards
 */

class CardVisionEngine {
  constructor() {
    // Shared downscaled frame (long side <= FRAME_MAX)
    this.FRAME_MAX = 960;
    this.frameCanvas = document.createElement('canvas');
    this.frameCtx = this.frameCanvas.getContext('2d', { willReadFrequently: true });
    this.frameScale = 1; // video px per frame px

    this.analysisCanvas = document.createElement('canvas');
    this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true });
    this.ANALYSIS_MAX = 220;

    this.deskewCanvas = document.createElement('canvas');
    this.deskewCtx = this.deskewCanvas.getContext('2d', { willReadFrequently: true });
    this.destWidth = 128;
    this.destHeight = 176;
    this.deskewCanvas.width = this.destWidth;
    this.deskewCanvas.height = this.destHeight;

    // Smoothed quad tracking for jitter reduction
    this.smoothCorners = null;
    this.smoothAlpha = 0.5;
  }

  /**
   * Grab the current video frame into the shared downscaled frame canvas.
   * @param {HTMLVideoElement} video
   * @returns {HTMLCanvasElement|null}
   */
  grabFrame(video) {
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const vW = video.videoWidth, vH = video.videoHeight;
    const s = Math.min(1, this.FRAME_MAX / Math.max(vW, vH));
    const fW = Math.round(vW * s), fH = Math.round(vH * s);
    if (this.frameCanvas.width !== fW || this.frameCanvas.height !== fH) {
      this.frameCanvas.width = fW;
      this.frameCanvas.height = fH;
    }
    this.frameCtx.imageSmoothingEnabled = true;
    this.frameCtx.imageSmoothingQuality = 'high';
    this.frameCtx.drawImage(video, 0, 0, fW, fH);
    this.frameScale = vW / fW;
    return this.frameCanvas;
  }

  resetTracking() {
    this.smoothCorners = null;
  }

  /**
   * Find the card quad inside a region of interest of the frame canvas.
   * @param {{x:number,y:number,w:number,h:number}} roi region in frame-canvas pixels
   * @returns {Array<{x:number,y:number}>|null} corners [TL, TR, BR, BL] in frame-canvas pixels
   */
  detectCardQuad(roi) {
    const F = this.frameCanvas;
    if (!F.width || !roi) return null;
    const rx = Math.max(0, Math.floor(roi.x));
    const ry = Math.max(0, Math.floor(roi.y));
    const rw = Math.min(F.width - rx, Math.ceil(roi.w));
    const rh = Math.min(F.height - ry, Math.ceil(roi.h));
    if (rw < 40 || rh < 40) return null;

    const k = Math.min(1, this.ANALYSIS_MAX / Math.max(rw, rh));
    const aW = Math.max(32, Math.round(rw * k));
    const aH = Math.max(32, Math.round(rh * k));
    if (this.analysisCanvas.width !== aW || this.analysisCanvas.height !== aH) {
      this.analysisCanvas.width = aW;
      this.analysisCanvas.height = aH;
    }
    this.analysisCtx.drawImage(F, rx, ry, rw, rh, 0, 0, aW, aH);
    const pixels = this.analysisCtx.getImageData(0, 0, aW, aH).data;

    const gray = new Uint8Array(aW * aH);
    for (let i = 0; i < aW * aH; i++) {
      const p = i * 4;
      gray[i] = (pixels[p] * 77 + pixels[p + 1] * 150 + pixels[p + 2] * 29) >> 8;
    }

    // Sobel gradient magnitude
    const grad = new Uint8Array(aW * aH);
    let gradSum = 0;
    for (let y = 1; y < aH - 1; y++) {
      const row = y * aW;
      for (let x = 1; x < aW - 1; x++) {
        const gx = -gray[row - aW + x - 1] + gray[row - aW + x + 1]
                   - 2 * gray[row + x - 1] + 2 * gray[row + x + 1]
                   - gray[row + aW + x - 1] + gray[row + aW + x + 1];
        const gy = -gray[row - aW + x - 1] - 2 * gray[row - aW + x] - gray[row - aW + x + 1]
                   + gray[row + aW + x - 1] + 2 * gray[row + aW + x] + gray[row + aW + x + 1];
        const mag = Math.min(255, (Math.abs(gx) + Math.abs(gy)) >> 1);
        grad[row + x] = mag;
        gradSum += mag;
      }
    }
    const threshold = Math.max(30, Math.min(90, Math.floor((gradSum / (aW * aH)) * 2.2)));

    // Strong edge points (skip the outermost 2px of the ROI)
    const pts = [];
    for (let y = 2; y < aH - 2; y += 2) {
      const row = y * aW;
      for (let x = 2; x < aW - 2; x += 2) {
        if (grad[row + x] > threshold) pts.push(x, y);
      }
    }
    if (pts.length < 60) return null;

    // Extreme points along the 4 diagonals: TL min(x+y), BR max(x+y), TR max(x-y), BL min(x-y)
    let tl = 0, br = 0, tr = 0, bl = 0;
    let vTL = Infinity, vBR = -Infinity, vTR = -Infinity, vBL = Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      const s = x + y, d = x - y;
      if (s < vTL) { vTL = s; tl = i; }
      if (s > vBR) { vBR = s; br = i; }
      if (d > vTR) { vTR = d; tr = i; }
      if (d < vBL) { vBL = d; bl = i; }
    }
    const inv = 1 / k;
    const toFrame = (i) => ({ x: rx + pts[i] * inv, y: ry + pts[i + 1] * inv });
    const raw = [toFrame(tl), toFrame(tr), toFrame(br), toFrame(bl)];

    // Geometry validation
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const wTop = dist(raw[0], raw[1]), wBot = dist(raw[3], raw[2]);
    const hL = dist(raw[0], raw[3]), hR = dist(raw[1], raw[2]);
    const avgW = (wTop + wBot) / 2, avgH = (hL + hR) / 2;
    if (avgW < rw * 0.35 || avgH < rh * 0.35) return null;           // too small vs ROI
    const aspect = avgW / avgH;                                       // card = 0.716
    if (aspect < 0.55 || aspect > 0.92) return null;
    if (Math.min(wTop, wBot) / Math.max(wTop, wBot) < 0.7) return null; // implausible keystone
    if (Math.min(hL, hR) / Math.max(hL, hR) < 0.7) return null;

    // Temporal smoothing (reset on large jumps)
    if (this.smoothCorners) {
      let jump = 0;
      for (let i = 0; i < 4; i++) jump = Math.max(jump, dist(this.smoothCorners[i], raw[i]));
      if (jump > avgW * 0.25) this.smoothCorners = null;
    }
    if (!this.smoothCorners) {
      this.smoothCorners = raw.map(p => ({ x: p.x, y: p.y }));
    } else {
      const a = this.smoothAlpha;
      for (let i = 0; i < 4; i++) {
        this.smoothCorners[i].x += (raw[i].x - this.smoothCorners[i].x) * a;
        this.smoothCorners[i].y += (raw[i].y - this.smoothCorners[i].y) * a;
      }
    }
    return this.smoothCorners.map(p => ({ x: p.x, y: p.y }));
  }

  /**
   * Perspective-warp the card quad (frame-canvas coords) into a flat 128x176 canvas.
   * @param {Array<{x:number,y:number}>} corners [TL, TR, BR, BL]
   * @returns {HTMLCanvasElement}
   */
  deskewCard(corners) {
    const dW = this.destWidth, dH = this.destHeight;
    const H = this.getHomography(
      [{ x: 0, y: 0 }, { x: dW, y: 0 }, { x: dW, y: dH }, { x: 0, y: dH }],
      corners
    );

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of corners) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const F = this.frameCanvas;
    minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
    const cropW = Math.max(1, Math.min(F.width - minX, Math.ceil(maxX - minX) + 1));
    const cropH = Math.max(1, Math.min(F.height - minY, Math.ceil(maxY - minY) + 1));
    const src = this.frameCtx.getImageData(minX, minY, cropW, cropH).data;

    const out = this.deskewCtx.createImageData(dW, dH);
    const o = out.data;
    for (let v = 0; v < dH; v++) {
      const vc = v + 0.5;
      for (let u = 0; u < dW; u++) {
        const uc = u + 0.5;
        const den = H[6] * uc + H[7] * vc + H[8];
        let sx = (H[0] * uc + H[1] * vc + H[2]) / den - minX - 0.5;
        let sy = (H[3] * uc + H[4] * vc + H[5]) / den - minY - 0.5;
        if (sx < 0) sx = 0; if (sy < 0) sy = 0;
        if (sx > cropW - 1) sx = cropW - 1; if (sy > cropH - 1) sy = cropH - 1;
        const x0 = sx | 0, y0 = sy | 0;
        const x1 = Math.min(cropW - 1, x0 + 1), y1 = Math.min(cropH - 1, y0 + 1);
        const fx = sx - x0, fy = sy - y0;
        const i00 = (y0 * cropW + x0) * 4, i01 = (y0 * cropW + x1) * 4;
        const i10 = (y1 * cropW + x0) * 4, i11 = (y1 * cropW + x1) * 4;
        const oi = (v * dW + u) * 4;
        for (let c = 0; c < 3; c++) {
          const top = src[i00 + c] + (src[i01 + c] - src[i00 + c]) * fx;
          const bot = src[i10 + c] + (src[i11 + c] - src[i10 + c]) * fx;
          o[oi + c] = top + (bot - top) * fy;
        }
        o[oi + 3] = 255;
      }
    }
    this.deskewCtx.putImageData(out, 0, 0);
    return this.deskewCanvas;
  }

  /**
   * Compute 3x3 Homography Matrix from 4 source points to 4 destination points
   */
  getHomography(src, dst) {
    const P = [];
    for (let i = 0; i < 4; i++) {
      const x = src[i].x, y = src[i].y;
      const u = dst[i].x, v = dst[i].y;
      P.push([-x, -y, -1, 0, 0, 0, x * u, y * u, u]);
      P.push([0, 0, 0, -x, -y, -1, x * v, y * v, v]);
    }

    // Solve Ah = 0 using Gaussian elimination with h[8] = 1
    const A = [];
    const b = [];
    for (let i = 0; i < 8; i++) {
      A.push(P[i].slice(0, 8));
      b.push(-P[i][8]);
    }

    for (let i = 0; i < 8; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < 8; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }
      for (let k = i; k < 8; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmpB = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmpB;

      for (let k = i + 1; k < 8; k++) {
        const c = -A[k][i] / (A[i][i] || 1e-7);
        for (let j = i; j < 8; j++) {
          if (i === j) A[k][j] = 0;
          else A[k][j] += c * A[i][j];
        }
        b[k] += c * b[i];
      }
    }

    const h = new Array(9);
    h[8] = 1.0;
    for (let i = 7; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < 8; j++) {
        sum -= A[i][j] * h[j];
      }
      h[i] = sum / (A[i][i] || 1e-7);
    }
    return h;
  }
}

// Global instance
window.cyberCardVision = new CardVisionEngine();
