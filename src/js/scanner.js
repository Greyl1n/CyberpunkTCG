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
  }

  init() {
    this.modal = document.getElementById('scanner-modal');
    this.video = document.getElementById('scanner-video');
    this.canvas = document.getElementById('scanner-canvas');

    if (!this.modal || !this.video || !this.canvas) {
      console.warn('[Scanner] Scanner DOM elements missing.');
      return;
    }

    this.bindEvents();
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
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });
  }

  async open() {
    if (!this.modal) return;
    this.modal.style.display = 'flex';
    this.modal.classList.add('active');
    this.updateStatus('INITIALIZING NEURAL LINK...', false);

    // Reset detected card & hide indicator
    this.dismissIndicator();

    // Start video stream with continuous autofocus
    await this.startCamera();

    // Lazy-load Tesseract OCR if not already initialized
    this.initOCR();

    // Start background scan ticker (checks frame every 1200ms)
    this.startAutoScanLoop();
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    this.modal.style.display = 'none';
    this.stopCamera();
    this.stopAutoScanLoop();
    this.dismissIndicator();
    this.updateStatus('OFFLINE', false);
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
    let tickCount = 0;
    this.scanInterval = setInterval(() => {
      if (this.modal.classList.contains('active') && !this.isScanning) {
        tickCount++;
        // Periodic autofocus sweep every ~4.5s if camera is idle
        if (tickCount % 3 === 0 && !this.activeCard && this.videoTrack && this.capabilities.focusMode?.includes('continuous')) {
          try {
            this.videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
          } catch (e) {}
        }
        if (Date.now() > this.detectionCooldown && !this.activeCard) {
          this.captureAndProcessFrame(true); // background auto-scan
        }
      }
    }, 1500);
  }

  stopAutoScanLoop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
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

  async captureAndProcessFrame(isAuto = false) {
    if (!this.video || !this.video.videoWidth || this.isScanning) return;
    this.isScanning = true;

    if (!isAuto) {
      this.updateStatus('PROCESSING SCAN...', false);
    }

    try {
      const ctx = this.canvas.getContext('2d');
      const vWidth = this.video.videoWidth;
      const vHeight = this.video.videoHeight;

      const reticleEl = document.getElementById('scanner-reticle');
      let boxX, boxY, boxWidth, boxHeight;

      if (reticleEl && this.video.clientWidth && this.video.clientHeight) {
        const reticleRect = reticleEl.getBoundingClientRect();
        const videoRect = this.video.getBoundingClientRect();

        // Calculate object-fit: cover scaling and cropping
        const videoRatio = vWidth / vHeight;
        const elemRatio = videoRect.width / videoRect.height;
        let renderedWidth, renderedHeight, offsetX, offsetY;

        if (elemRatio > videoRatio) {
          // Video width matches element width, height is cropped
          renderedWidth = videoRect.width;
          renderedHeight = videoRect.width / videoRatio;
          offsetX = 0;
          offsetY = (renderedHeight - videoRect.height) / 2;
        } else {
          // Video height matches element height, width is cropped
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
        // Fallback card bounding box
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

      this.canvas.width = Math.max(1, Math.round(boxWidth));
      this.canvas.height = Math.max(1, Math.round(boxHeight));

      ctx.drawImage(this.video, boxX, boxY, boxWidth, boxHeight, 0, 0, this.canvas.width, this.canvas.height);

      // Perform OCR if worker is ready
      let matchedCard = null;
      if (this.ocrWorker) {
        const ocrRes = await this.ocrWorker.recognize(this.canvas);
        const recognizedText = ocrRes?.data?.text || '';
        matchedCard = this.matchCardFromText(recognizedText);
      }

      if (matchedCard) {
        this.handleCardDetected(matchedCard);
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

  handleCardDetected(card) {
    if (!card) return;

    this.activeCard = card;
    this.updateStatus(`TARGET: ${card.name}`, true);

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
    this.updateStatus('TAP SCREEN TO FOCUS // ALIGN CARD', false);
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
