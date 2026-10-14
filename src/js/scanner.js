/**
 * Cyberpunk TCG - Neural HUD Camera Card Scanner & Collection Tracker
 * Provides camera stream acquisition, real-time OCR text recognition,
 * collector number & title matching, inventory increments, and Cardmarket pricing.
 */
class CardScannerController {
  constructor() {
    this.modal = null;
    this.video = null;
    this.canvas = null;
    this.trackingCanvas = null;
    this.stream = null;
    this.videoTrack = null;
    this.capabilities = {};
    this.torchEnabled = false;
    this.isScanning = false;
    this.activeCard = null;
    this.facingMode = 'environment'; // 'environment' (back) or 'user' (front)
    this.autoAddMode = false;
    this.ocrWorker = null;
    this.ocrLoading = false;
    this.scanInterval = null;
    this.lastDetectedId = null;
    this.detectionCooldown = 0;
    this.focusRing = null;
    this.aiModal = null;
  }

  init() {
    this.modal = document.getElementById('scanner-modal');
    this.video = document.getElementById('scanner-video');
    this.canvas = document.getElementById('scanner-canvas');
    this.trackingCanvas = document.getElementById('scanner-tracking-canvas');
    this.aiModal = document.getElementById('ai-model-modal');

    if (!this.modal || !this.video || !this.canvas) {
      console.warn('[Scanner] Scanner DOM elements missing.');
      return;
    }

    // Initialize AI Neural Card Matcher in background
    if (window.cyberCardMatcher) {
      window.cyberCardMatcher.init();
    }

    this.bindEvents();
    this.bindAIModalEvents();
  }

  bindEvents() {
    // Close button & backdrop
    const closeBtns = this.modal.querySelectorAll('.scanner-close-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    });

    // AI Model Info Button
    const aiBtn = document.getElementById('scanner-ai-model-btn');
    if (aiBtn) {
      aiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openAIModal();
      });
    }

    // Camera Switcher
    const switchCamBtn = document.getElementById('scanner-switch-cam-btn');
    if (switchCamBtn) {
      switchCamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCameraFacing();
      });
    }

    // Torch / Flashlight Button
    const torchBtn = document.getElementById('scanner-torch-btn');
    if (torchBtn) {
      torchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTorch();
      });
    }

    // Tap-to-Focus on Viewport
    const viewport = document.getElementById('scanner-viewport');
    if (viewport) {
      viewport.addEventListener('click', (e) => {
        // If clicking an interactive button or card indicator, do not trigger focus ring
        if (e.target.closest('button, input, label, .scanner-card-indicator')) return;
        this.triggerAutofocus(e.clientX, e.clientY);
      });
    }

    // Manual Scan / Snapshot button
    const snapBtn = document.getElementById('scanner-snap-btn');
    if (snapBtn) {
      snapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.captureAndProcessFrame();
      });
    }

    // Auto-Add toggle
    const autoAddToggle = document.getElementById('scanner-auto-add-toggle');
    if (autoAddToggle) {
      autoAddToggle.addEventListener('change', (e) => {
        this.autoAddMode = e.target.checked;
      });
    }

    // Scanner quick search input (fallback if camera angle/lighting is tricky)
    const quickSearchInput = document.getElementById('scanner-quick-search');
    if (quickSearchInput) {
      quickSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length >= 2) {
          this.searchCardDirect(query);
        }
      });
    }

    // Keydown Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.aiModal && this.aiModal.style.display !== 'none') {
          this.closeAIModal();
        } else if (this.modal.classList.contains('active')) {
          this.close();
        }
      }
    });
  }

  bindAIModalEvents() {
    if (!this.aiModal) return;
    const closeBtns = [
      document.getElementById('ai-model-modal-close-btn'),
      document.getElementById('ai-close-btn')
    ];
    closeBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeAIModal();
        });
      }
    });

    const resyncBtn = document.getElementById('ai-resync-btn');
    if (resyncBtn) {
      resyncBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        resyncBtn.disabled = true;
        resyncBtn.textContent = '🔄 SYNCING...';
        if (window.cyberCardMatcher) {
          const success = await window.cyberCardMatcher.init();
          if (success) {
            this.showToast('AI Model & Card Embeddings re-synced successfully!', 'success');
            this.updateAIModalDisplay();
          } else {
            this.showToast('Could not re-sync embeddings.', 'error');
          }
        }
        resyncBtn.disabled = false;
        resyncBtn.textContent = '🔄 RELOAD EMBEDDINGS';
      });
    }
  }

  openAIModal() {
    if (!this.aiModal) return;
    this.updateAIModalDisplay();
    this.aiModal.style.display = 'flex';
  }

  closeAIModal() {
    if (!this.aiModal) return;
    this.aiModal.style.display = 'none';
  }

  updateAIModalDisplay() {
    if (!window.cyberCardMatcher) return;
    const manifest = window.cyberCardMatcher.manifest;
    const countEl = document.getElementById('ai-card-count');
    const dimEl = document.getElementById('ai-emb-dim');
    const engineEl = document.getElementById('ai-engine-name');

    if (manifest) {
      if (countEl) countEl.textContent = `${manifest.cardCount || 151} Cards Loaded`;
      if (dimEl) dimEl.textContent = `${manifest.dimension || 256}-D Perceptual Multi-Scale`;
      if (engineEl) engineEl.textContent = `${manifest.algorithm || 'CyberVision Edge AI (v2.0)'}`;
    }
  }

  async open() {
    if (!this.modal) return;
    this.modal.style.display = 'flex';
    this.modal.classList.add('active');
    this.updateStatus('INITIALIZING CYBERVISION AI...', false);

    // Reset detected card & hide indicator
    this.dismissIndicator();
    this.clearTrackingCanvas();

    // Ensure AI model is ready
    if (window.cyberCardMatcher && !window.cyberCardMatcher.isLoaded) {
      window.cyberCardMatcher.init().then(() => {
        this.updateStatus('AI VISION ONLINE // POINT AT CARD', false);
      });
    }

    // Start video stream with continuous autofocus
    await this.startCamera();

    // Start high-speed background scan ticker (checks frame every 380ms)
    this.startAutoScanLoop();
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    this.modal.style.display = 'none';
    this.stopCamera();
    this.stopAutoScanLoop();
    this.dismissIndicator();
    this.clearTrackingCanvas();
    this.updateStatus('OFFLINE', false);
  }

  clearTrackingCanvas() {
    if (!this.trackingCanvas) return;
    const ctx = this.trackingCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.trackingCanvas.width, this.trackingCanvas.height);
  }

  videoCoordToScreen(vx, vy) {
    if (!this.video || !this.video.videoWidth) return { x: vx, y: vy };
    const vW = this.video.videoWidth;
    const vH = this.video.videoHeight;
    const rect = this.video.getBoundingClientRect();
    const eW = rect.width;
    const eH = rect.height;

    const videoRatio = vW / vH;
    const elemRatio = eW / eH;
    let renderW, renderH, offsetX, offsetY;

    if (elemRatio > videoRatio) {
      renderW = eW;
      renderH = eW / videoRatio;
      offsetX = 0;
      offsetY = (renderH - eH) / 2;
    } else {
      renderH = eH;
      renderW = eH * videoRatio;
      offsetY = 0;
      offsetX = (renderW - eW) / 2;
    }

    const scale = renderW / vW;
    const sx = vx * scale - offsetX;
    const sy = vy * scale - offsetY;
    return { x: sx, y: sy };
  }

  drawTrackingPolygon(corners, isLocked = false) {
    if (!this.trackingCanvas || !this.video || !corners) return;
    const rect = this.video.getBoundingClientRect();
    if (this.trackingCanvas.width !== rect.width || this.trackingCanvas.height !== rect.height) {
      this.trackingCanvas.width = rect.width;
      this.trackingCanvas.height = rect.height;
    }

    const ctx = this.trackingCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.trackingCanvas.width, this.trackingCanvas.height);

    const pts = corners.map(p => this.videoCoordToScreen(p.x, p.y));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();

    ctx.strokeStyle = isLocked ? '#00ff66' : '#00f0ff';
    ctx.lineWidth = isLocked ? 3.5 : 2;
    ctx.shadowColor = isLocked ? 'rgba(0, 255, 102, 0.8)' : 'rgba(0, 240, 255, 0.6)';
    ctx.shadowBlur = 12;
    ctx.stroke();

    if (isLocked) {
      ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
      ctx.fill();
    }

    // Corner targeting rings
    pts.forEach(p => {
      ctx.fillStyle = isLocked ? '#00ff66' : '#fcee0a';
      ctx.shadowColor = isLocked ? '#00ff66' : '#fcee0a';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isLocked ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  async startCamera() {
    try {
      this.stopCamera();

      // Advanced constraints requesting continuous autofocus & high resolution
      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          focusMode: { ideal: 'continuous' },
          advanced: [
            { focusMode: 'continuous' }
          ]
        },
        audio: false
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (fallbackErr) {
        console.warn('[Scanner] Ideal constraints rejected, falling back to basic camera:', fallbackErr);
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: this.facingMode } },
          audio: false
        });
      }

      this.video.srcObject = this.stream;
      await this.video.play();

      this.videoTrack = this.stream.getVideoTracks()[0];
      if (this.videoTrack) {
        this.capabilities = this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {};
        console.log('[Scanner] Camera capabilities:', this.capabilities);

        // Apply continuous autofocus if hardware supports it
        if (this.capabilities.focusMode && this.capabilities.focusMode.includes('continuous')) {
          try {
            await this.videoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            });
            console.log('[Scanner] Hardware continuous autofocus active.');
          } catch (e) {
            console.warn('[Scanner] Could not apply continuous autofocus constraint:', e);
          }
        }

        // Show/hide torch button based on hardware support
        const torchBtn = document.getElementById('scanner-torch-btn');
        if (torchBtn) {
          if (this.capabilities.torch) {
            torchBtn.style.display = 'inline-flex';
          } else {
            torchBtn.style.display = 'none';
          }
        }
      }

      this.updateStatus('TAP SCREEN TO FOCUS // ALIGN CARD', false);
    } catch (err) {
      console.error('[Scanner] Camera access error:', err);
      this.updateStatus('CAMERA ACCESS DENIED OR UNAVAILABLE', false);
      this.showToast('Could not access camera. Please allow camera permissions or use manual search.', 'error');
    }
  }

  async triggerAutofocus(clientX, clientY) {
    if (!this.focusRing) {
      this.focusRing = document.getElementById('scanner-focus-ring');
    }

    if (this.focusRing) {
      this.focusRing.style.left = `${clientX}px`;
      this.focusRing.style.top = `${clientY}px`;
      this.focusRing.style.display = 'block';
      this.focusRing.className = 'scanner-focus-ring focusing';

      setTimeout(() => {
        if (this.focusRing) this.focusRing.className = 'scanner-focus-ring focused';
      }, 300);

      setTimeout(() => {
        if (this.focusRing) this.focusRing.style.display = 'none';
      }, 650);
    }

    if (this.videoTrack && this.videoTrack.applyConstraints) {
      try {
        const advanced = [];
        if (this.capabilities.pointsOfInterest && this.video) {
          const rect = this.video.getBoundingClientRect();
          const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
          const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
          advanced.push({ pointsOfInterest: [{ x: normX, y: normY }] });
        }

        if (this.capabilities.focusMode && this.capabilities.focusMode.includes('continuous')) {
          advanced.push({ focusMode: 'continuous' });
        }

        if (advanced.length > 0) {
          await this.videoTrack.applyConstraints({ advanced });
        }
      } catch (e) {
        console.warn('[Scanner] Tap-to-focus constraint error:', e);
      }
    }
  }

  async toggleTorch() {
    if (!this.videoTrack || !this.capabilities.torch) return;
    this.torchEnabled = !this.torchEnabled;
    const torchBtn = document.getElementById('scanner-torch-btn');
    if (torchBtn) {
      torchBtn.classList.toggle('active', this.torchEnabled);
    }
    try {
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: this.torchEnabled }]
      });
    } catch (e) {
      console.warn('[Scanner] Could not toggle torch:', e);
    }
  }

  stopCamera() {
    if (this.videoTrack && this.torchEnabled) {
      try {
        this.videoTrack.applyConstraints({ advanced: [{ torch: false }] });
      } catch (e) {}
      this.torchEnabled = false;
      const torchBtn = document.getElementById('scanner-torch-btn');
      if (torchBtn) torchBtn.classList.remove('active');
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.videoTrack = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  toggleCameraFacing() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.startCamera();
  }

  startAutoScanLoop() {
    this.stopAutoScanLoop();
    this.scanLoopActive = true;
    this.resetVotes();
    let tickCount = 0;
    const SCAN_DELAY_MS = 110; // pause between frames (~6-9 fps incl. processing)

    const tick = async () => {
      if (!this.scanLoopActive) return;
      if (this.modal.classList.contains('active') && !this.isScanning) {
        tickCount++;
        // Periodic autofocus nudge every ~4s while idle
        if (tickCount % 30 === 0 && !this.activeCard && this.videoTrack && this.capabilities.focusMode?.includes('continuous')) {
          try {
            this.videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
          } catch (e) {}
        }
        if (Date.now() > this.detectionCooldown && !this.activeCard) {
          await this.captureAndProcessFrame(true);
        }
      }
      if (this.scanLoopActive) {
        this.scanInterval = setTimeout(tick, SCAN_DELAY_MS);
      }
    };
    this.scanInterval = setTimeout(tick, SCAN_DELAY_MS);
  }

  stopAutoScanLoop() {
    this.scanLoopActive = false;
    if (this.scanInterval) {
      clearTimeout(this.scanInterval);
      this.scanInterval = null;
    }
  }

  resetVotes() {
    this.voteHistory = [];
    this.emptyStreak = 0;
    if (window.cyberCardVision) window.cyberCardVision.resetTracking();
  }

  updateStatus(text, isLocked = false) {
    const statusChip = document.getElementById('scanner-status-chip');
    const reticle = document.getElementById('scanner-reticle');
    if (statusChip) {
      statusChip.textContent = text;
      statusChip.className = isLocked ? 'scanner-status-chip locked' : 'scanner-status-chip';
    }
    if (reticle) {
      if (isLocked) {
        reticle.classList.add('target-locked');
      } else {
        reticle.classList.remove('target-locked');
      }
    }
  }

  async initOCR() {
    if (this.ocrWorker || this.ocrLoading) return;
    this.ocrLoading = true;

    // Load Tesseract if not already present on window
    if (!window.Tesseract) {
      try {
        await this.loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      } catch (e) {
        console.warn('[Scanner] Could not load Tesseract from CDN. Offline text recognition fallback active.', e);
        this.ocrLoading = false;
        return;
      }
    }

    if (window.Tesseract) {
      try {
        this.ocrWorker = await window.Tesseract.createWorker('eng');
        console.log('[Scanner] Tesseract OCR neural engine loaded.');
      } catch (e) {
        console.warn('[Scanner] Tesseract initialization error:', e);
      }
    }
    this.ocrLoading = false;
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Reticle rectangle in video pixel coordinates.
   * @returns {{x:number,y:number,w:number,h:number}|null}
   */
  getReticleBox() {
    if (!this.video || !this.video.videoWidth) return null;
    const vWidth = this.video.videoWidth;
    const vHeight = this.video.videoHeight;
    const reticleEl = document.getElementById('scanner-reticle');
    let boxX, boxY, boxWidth, boxHeight;

    if (reticleEl && this.video.clientWidth && this.video.clientHeight) {
      const reticleRect = reticleEl.getBoundingClientRect();
      const videoRect = this.video.getBoundingClientRect();
      const videoRatio = vWidth / vHeight;
      const elemRatio = videoRect.width / videoRect.height;
      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (elemRatio > videoRatio) {
        renderedWidth = videoRect.width;
        renderedHeight = videoRect.width / videoRatio;
        offsetX = 0;
        offsetY = (renderedHeight - videoRect.height) / 2;
      } else {
        renderedHeight = videoRect.height;
        renderedWidth = videoRect.height * videoRatio;
        offsetY = 0;
        offsetX = (renderedWidth - videoRect.width) / 2;
      }

      const scale = vWidth / renderedWidth;
      const relativeLeft = (reticleRect.left - videoRect.left) + offsetX;
      const relativeTop = (reticleRect.top - videoRect.top) + offsetY;

      boxX = Math.max(0, relativeLeft * scale);
      boxY = Math.max(0, relativeTop * scale);
      boxWidth = Math.min(vWidth - boxX, reticleRect.width * scale);
      boxHeight = Math.min(vHeight - boxY, reticleRect.height * scale);
    } else {
      const targetAspect = 63 / 88;
      boxHeight = vHeight * 0.75;
      boxWidth = boxHeight * targetAspect;
      if (boxWidth > vWidth * 0.85) {
        boxWidth = vWidth * 0.85;
        boxHeight = boxWidth / targetAspect;
      }
      boxX = (vWidth - boxWidth) / 2;
      boxY = (vHeight - boxHeight) / 2;
    }
    if (boxWidth < 8 || boxHeight < 8) return null;
    return { x: boxX, y: boxY, w: boxWidth, h: boxHeight };
  }

  cropCenterFrame() {
    const box = this.getReticleBox();
    if (!box) return;
    const ctx = this.canvas.getContext('2d');
    this.canvas.width = Math.max(1, Math.round(box.w));
    this.canvas.height = Math.max(1, Math.round(box.h));
    ctx.drawImage(this.video, box.x, box.y, box.w, box.h, 0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Build candidate regions (frame-canvas coords) to fingerprint for this tick.
   * Card-aspect boxes centred in the reticle at several scales cover cards held
   * slightly closer / further than the guide frame.
   */
  buildCandidateBoxes(reticle, frameW, frameH) {
    const CARD_ASPECT = 63 / 88;
    let w = reticle.w, h = reticle.h;
    if (w / h > CARD_ASPECT) w = h * CARD_ASPECT; else h = w / CARD_ASPECT;
    const cx = reticle.x + reticle.w / 2, cy = reticle.y + reticle.h / 2;
    const boxes = [];
    for (const s of [1.0, 0.9, 0.8, 1.1]) {
      const bw = w * s, bh = h * s;
      const x = Math.max(0, cx - bw / 2), y = Math.max(0, cy - bh / 2);
      const cw = Math.min(frameW - x, bw), ch = Math.min(frameH - y, bh);
      if (cw > 16 && ch > 16) boxes.push({ x, y, w: cw, h: ch, scale: s });
    }
    return boxes;
  }

  /**
   * Multi-frame vote: accept when the same card is top-1 (with relaxed thresholds)
   * in `confirm_frames` of the last `vote_window` frames.
   */
  registerVote(res) {
    const th = window.cyberCardMatcher.thresholds;
    const ok = res && res.score >= th.vote_min_score && res.margin >= th.vote_min_margin;
    this.voteHistory = this.voteHistory || [];
    this.voteHistory.push(ok ? res.candidateId : null);
    const win = th.vote_window || 4;
    while (this.voteHistory.length > win) this.voteHistory.shift();
    if (!ok) return 0;
    return this.voteHistory.filter(id => id === res.candidateId).length;
  }

  async captureAndProcessFrame(isAuto = false) {
    if (!this.video || !this.video.videoWidth || this.isScanning) return;
    this.isScanning = true;

    if (!isAuto) {
      this.updateStatus('AI INFERENCE SCAN...', false);
    }

    try {
      const vision = window.cyberCardVision;
      const matcher = window.cyberCardMatcher;
      let matchedCard = null;
      let matchConfidence = 0;

      if (vision && matcher && matcher.isLoaded) {
        const t0 = performance.now();
        const frame = vision.grabFrame(this.video);
        const reticleV = this.getReticleBox();
        if (frame && reticleV) {
          const fs = vision.frameScale;
          const reticle = { x: reticleV.x / fs, y: reticleV.y / fs, w: reticleV.w / fs, h: reticleV.h / fs };

          // Candidate 1: deskewed card quad found around the reticle
          const pad = 0.18;
          const roi = {
            x: reticle.x - reticle.w * pad, y: reticle.y - reticle.h * pad,
            w: reticle.w * (1 + 2 * pad), h: reticle.h * (1 + 2 * pad)
          };
          const quad = vision.detectCardQuad(roi);
          let best = null;
          let bestQuad = false;
          if (quad) {
            const res = matcher.match(matcher.extractFeatures(vision.deskewCard(quad)), 0);
            best = res;
            bestQuad = true;
          }

          // Candidates 2..n: multi-scale reticle crops
          for (const box of this.buildCandidateBoxes(reticle, frame.width, frame.height)) {
            const res = matcher.match(matcher.extractFeatures(frame, box), 0);
            if (!best || res.score + res.margin > best.score + best.margin) { best = res; bestQuad = false; }
          }

          const th = matcher.thresholds;
          const votes = this.registerVote(best);
          const voteAccepted = votes >= (th.confirm_frames || 2);
          const blocked = this.blockedCardId && best && best.candidateId === this.blockedCardId;

          // Track "empty" frames to release the same-card guard once the card is removed
          if (!best || best.score < th.vote_min_score) {
            this.emptyStreak = (this.emptyStreak || 0) + 1;
            if (this.emptyStreak >= 3) this.blockedCardId = null;
          } else {
            this.emptyStreak = 0;
            if (this.blockedCardId && best.candidateId !== this.blockedCardId) this.blockedCardId = null;
          }
          if (this.blockedCardId && Date.now() > (this.blockedUntil || 0) && !this.autoAddMode) {
            this.blockedCardId = null; // manual mode: allow re-detecting the same card after a short pause
          }

          // HUD overlay
          if (quad) {
            const quadV = quad.map(p => ({ x: p.x * fs, y: p.y * fs }));
            this.drawTrackingPolygon(quadV, !!(best && (best.accepted || voteAccepted) && bestQuad));
          } else {
            this.clearTrackingCanvas();
          }

          if (best && !blocked && (best.accepted || voteAccepted)) {
            matchedCard = matcher.lookupCard(best.candidateId);
            matchConfidence = Math.max(best.confidence, voteAccepted ? 80 : 0);
          } else if (best && !blocked && best.score >= th.vote_min_score && isAuto) {
            const guess = matcher.lookupCard(best.candidateId);
            this.updateStatus(`LOCKING ON… ${guess.name || best.candidateId} [${best.confidence}%]`, false);
          } else if (isAuto && !this.activeCard) {
            this.updateStatus(blocked ? 'CARD LOGGED // SHOW NEXT CARD' : 'AI AUTO-TRACKING ACTIVE // POINT CAMERA AT CARD', false);
          }
          this.lastFrameMs = performance.now() - t0;
        }
      }

      // Fallback: OCR if manual snapshot button pressed & OCR worker is ready
      if (!matchedCard && !isAuto && this.ocrWorker) {
        this.cropCenterFrame();
        const ocrRes = await this.ocrWorker.recognize(this.canvas);
        const recognizedText = ocrRes?.data?.text || '';
        matchedCard = this.matchCardFromText(recognizedText);
        if (matchedCard) matchConfidence = 85;
      }

      if (matchedCard) {
        this.handleCardDetected(matchedCard, matchConfidence);
      } else if (!isAuto) {
        this.updateStatus('NO TARGET IDENTIFIED // REALIGN CARD', false);
      }
    } catch (err) {
      console.error('[Scanner] Processing frame error:', err);
    } finally {
      this.isScanning = false;
    }
  }

  matchCardFromText(rawText) {
    if (!rawText || !window.stateStore || !window.stateStore.cards) return null;

    const text = rawText.toUpperCase();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const cards = window.stateStore.cards;

    // Strategy 1: Check for unique 3-4 character collector print number (e.g., '005a', '004', '031', '124')
    for (const card of cards) {
      const pNum = (card.print_number || '').toUpperCase();
      if (pNum && pNum.length >= 3) {
        const regex = new RegExp(`\\b${pNum}\\b`, 'i');
        if (regex.test(text)) {
          console.log(`[Scanner] Matched by collector number: ${pNum} (${card.name})`);
          return card;
        }
      }
    }

    // Strategy 2: Fuzzy match on card names & subnames
    let bestMatch = null;
    let highestScore = 0;

    for (const card of cards) {
      const cardName = (card.name || '').toUpperCase().replace(/[:']/g, '');
      const cardTitle = (card.card_title || '').toUpperCase().replace(/[:']/g, '');
      const subname = (card.subname || '').toUpperCase().replace(/[:']/g, '');

      for (const line of lines) {
        const cleanLine = line.replace(/[^A-Z0-9 ]/g, ' ').trim();
        if (cleanLine.length < 3) continue;

        // Substring direct containment check
        if (cardName.length > 4 && cleanLine.includes(cardName)) {
          return card;
        }

        // Title + Subname combo check
        if (cardTitle.length >= 3 && subname.length >= 3) {
          if (cleanLine.includes(cardTitle) && text.includes(subname)) {
            return card;
          }
        }

        // Similarity score
        const score = this.calculateSimilarity(cleanLine, cardName);
        if (score > highestScore && score >= 0.72) {
          highestScore = score;
          bestMatch = card;
        }
      }
    }

    if (bestMatch && highestScore >= 0.72) {
      console.log(`[Scanner] Fuzzy matched: ${bestMatch.name} (score: ${highestScore.toFixed(2)})`);
      return bestMatch;
    }

    return null;
  }

  calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    // Check substring match
    if (longer.includes(shorter) && shorter.length >= 4) {
      return 0.85;
    }

    // Levenshtein distance
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return (longer.length - costs[s2.length]) / longer.length;
  }

  handleCardDetected(card, confidence = null) {
    if (!card) return;

    this.activeCard = card;
    this.blockedCardId = card.id;
    this.blockedUntil = Date.now() + 3500;
    const confText = confidence ? ` [${confidence}%]` : '';
    this.updateStatus(`TARGET: ${card.name}${confText}`, true);

    if (window.cyberAudio) {
      window.cyberAudio.click();
    }

    this.renderCardIndicator(card);

    // Auto-Add Mode Handling
    if (this.autoAddMode) {
      if (this.lastDetectedId !== card.id || Date.now() > this.detectionCooldown) {
        this.addCardToCollection(card, 1);
        this.lastDetectedId = card.id;
        this.detectionCooldown = Date.now() + 2500;

        const addBtn = document.getElementById('indicator-add-btn');
        if (addBtn) {
          addBtn.innerHTML = '✓ AUTO-ADDED (+1)';
          addBtn.classList.add('success');
        }

        setTimeout(() => {
          this.dismissIndicator();
        }, 1500);
      }
    }
  }

  searchCardDirect(query) {
    if (!window.stateStore || !window.stateStore.cards) return;
    const q = query.toLowerCase();
    const card = window.stateStore.cards.find(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.print_number && c.print_number.toLowerCase() === q)
    );
    if (card) {
      this.handleCardDetected(card);
    }
  }

  renderCardIndicator(card) {
    const indicator = document.getElementById('scanner-card-indicator');
    const controlsBar = document.getElementById('scanner-controls-bar');
    if (!indicator) return;

    if (!card) {
      this.dismissIndicator();
      return;
    }

    if (controlsBar) controlsBar.style.display = 'none';

    const currentOwned = (window.stateStore?.inventory?.[card.id]) || 0;
    const cleanId = (card.id || '').replace(/^cb-/, '');
    const imgSrc = card.image_local || `assets/cards/${cleanId}.webp`;
    const priceText = window.cardmarketService ? window.cardmarketService.getPrice(card.id) : null;
    const priceDisplay = priceText ? `€${priceText}` : '€0.45';

    indicator.innerHTML = `
      <div class="indicator-header-row">
        <span class="indicator-badge">🎯 TARGET RECOGNIZED</span>
        <button type="button" class="indicator-dismiss-btn" id="indicator-dismiss-btn" title="Dismiss and resume scanning">
          ✕ SCAN NEXT
        </button>
      </div>

      <div class="indicator-card-content">
        <img src="${imgSrc}" class="indicator-card-thumb" alt="${card.name}" onerror="this.src='${card.image_url || ''}'">
        <div class="indicator-card-details">
          <div class="indicator-card-title">${card.name}</div>
          <div class="indicator-card-sub">#${card.print_number} • ${card.color} ${card.type} • ${card.rarity}</div>
          <div class="indicator-card-pills">
            <span class="keyword-pill">€$ ${card.cost ?? 0}</span>
            ${card.ram ? `<span class="keyword-pill">💾 ${card.ram} RAM</span>` : ''}
            ${card.power ? `<span class="keyword-pill">⚔️ ${card.power} POW</span>` : ''}
            <span class="indicator-price-tag" title="Cardmarket estimated price">🏷️ ${priceDisplay}</span>
          </div>
        </div>
      </div>

      <div class="indicator-action-row">
        <div class="indicator-qty-controls">
          <button type="button" class="indicator-qty-btn" id="indicator-minus-btn" title="Decrease owned count">−</button>
          <div class="indicator-qty-val" id="indicator-qty-val">${currentOwned}</div>
          <button type="button" class="indicator-qty-btn" id="indicator-plus-btn" title="Increase owned count">+</button>
        </div>
        <button type="button" class="cyber-btn cyber-btn-accent indicator-add-btn" id="indicator-add-btn">
          ➕ ADD +1 TO COLLECTION
        </button>
      </div>
    `;

    indicator.classList.add('active');

    // Wire events on the card indicator
    const dismissBtn = document.getElementById('indicator-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissIndicator();
      });
    }

    const minusBtn = document.getElementById('indicator-minus-btn');
    const plusBtn = document.getElementById('indicator-plus-btn');
    const qtyVal = document.getElementById('indicator-qty-val');
    const addBtn = document.getElementById('indicator-add-btn');

    if (minusBtn && qtyVal) {
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = parseInt(qtyVal.textContent, 10) || 0;
        const next = Math.max(0, current - 1);
        qtyVal.textContent = next;
        this.setCardCount(card, next);
      });
    }

    if (plusBtn && qtyVal) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = parseInt(qtyVal.textContent, 10) || 0;
        const next = current + 1;
        qtyVal.textContent = next;
        this.setCardCount(card, next);
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addCardToCollection(card, 1);
        addBtn.innerHTML = '✓ ADDED TO COLLECTION!';
        addBtn.classList.add('success');
        if (qtyVal) {
          qtyVal.textContent = (window.stateStore?.inventory?.[card.id]) || 1;
        }
        setTimeout(() => {
          this.dismissIndicator();
        }, 1200);
      });
    }
  }

  dismissIndicator() {
    const indicator = document.getElementById('scanner-card-indicator');
    const controlsBar = document.getElementById('scanner-controls-bar');
    if (indicator) {
      indicator.classList.remove('active');
    }
    if (controlsBar) {
      controlsBar.style.display = 'flex';
    }
    this.activeCard = null;
    this.resetVotes();
    this.clearTrackingCanvas();
    this.updateStatus('AI AUTO-TRACKING ACTIVE // POINT CAMERA AT CARD', false);
  }

  setCardCount(card, count) {
    if (!window.stateStore) return;
    window.stateStore.setInventoryCount(card.id, count);
    if (window.cyberAudio) window.cyberAudio.click();
  }

  addCardToCollection(card, delta = 1) {
    if (!window.stateStore) return;
    const current = (window.stateStore.inventory[card.id]) || 0;
    const nextCount = current + delta;
    window.stateStore.setInventoryCount(card.id, nextCount);

    if (window.cyberAudio) {
      window.cyberAudio.chime();
    }

    this.showToast(`Added ${card.name} to Collection! (Now: ${nextCount}x)`, 'success');
  }

  showToast(message, type = 'info') {
    if (window.cyberApp && typeof window.cyberApp.showToast === 'function') {
      window.cyberApp.showToast(message, type);
    } else {
      console.log(`[Toast ${type}]: ${message}`);
    }
  }
}

// Global singleton instance
window.cardScanner = new CardScannerController();
