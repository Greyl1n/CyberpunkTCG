/**
 * Cyberpunk TCG - Main Application Controller (Official WeirdCo Edition)
 */
class App {
  constructor() {
    this.activeTab = 'inventory';
    this.toastContainer = null;
  }

  async init() {
    console.log('%c[WEIRDCO CYBERPUNK TCG] Booting Neural Link UI...', 'color: #00f0ff; font-weight: bold;');

    this.setupToastContainer();
    this.setupNavigation();
    this.setupAudioToggle();
    this.setupMobileControls();
    this.setupScaleControls();
    this.setupInspectModal();

    // Initialize state & load card catalog
    await window.stateStore.loadInitialData();

    // Initialize controllers
    const inventoryGrid = document.getElementById('inventory-cards-grid');
    if (inventoryGrid) {
      window.inventoryController.init(inventoryGrid);
    }

    if (window.deckBuilderController) {
      window.deckBuilderController.init();
    }

    if (window.analyticsController) {
      window.analyticsController.init();
    }

    if (window.exportImportController) {
      window.exportImportController.init();
    }

    // Initialize Cardmarket Pricing Service
    if (window.cardmarketService) {
      await window.cardmarketService.init();
    }

    // Initialize Neural Camera Card Scanner
    if (window.cardScanner) {
      window.cardScanner.init();
      const openScannerBtn = document.getElementById('open-scanner-btn');
      if (openScannerBtn) {
        openScannerBtn.addEventListener('click', () => {
          window.cyberAudio.click();
          window.cardScanner.open();
        });
      }
    }

    this.populateStarterDecksList();

    this.showToast('WeirdCo Cyberpunk TCG Database online. 151 official cards loaded.');
  }

  setupMobileControls() {
    const menuToggleBtn = document.getElementById('mobile-menu-toggle-btn');
    const headerActionsMenu = document.getElementById('header-actions-menu');
    const mobileBackdrop = document.getElementById('mobile-drawer-backdrop');
    const deckPanel = document.getElementById('active-deck-panel');
    const mobileDeckOpenBtn = document.getElementById('mobile-deck-open-btn');
    const mobileDeckCloseBtn = document.getElementById('mobile-deck-close-btn');

    const closeAllDrawers = () => {
      if (headerActionsMenu) headerActionsMenu.classList.remove('open');
      if (deckPanel) deckPanel.classList.remove('mobile-open');
      if (mobileBackdrop) mobileBackdrop.classList.remove('active');
    };

    if (menuToggleBtn && headerActionsMenu) {
      menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.cyberAudio.click();
        const isOpen = headerActionsMenu.classList.toggle('open');
        // Only activate drawer backdrop on mobile viewports (<= 768px)
        if (mobileBackdrop) {
          if (window.innerWidth <= 768) {
            mobileBackdrop.classList.toggle('active', isOpen);
          } else {
            mobileBackdrop.classList.remove('active');
          }
        }
      });
    }

    if (mobileDeckOpenBtn && deckPanel) {
      mobileDeckOpenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.cyberAudio.click();
        deckPanel.classList.add('mobile-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
      });
    }

    if (mobileDeckCloseBtn && deckPanel) {
      mobileDeckCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.cyberAudio.click();
        deckPanel.classList.remove('mobile-open');
        if (mobileBackdrop) mobileBackdrop.classList.remove('active');
      });
    }

    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', () => {
        closeAllDrawers();
      });
    }

    // Dismiss Actions menu on outside click (desktop & mobile)
    document.addEventListener('click', (e) => {
      if (headerActionsMenu && headerActionsMenu.classList.contains('open')) {
        if (!headerActionsMenu.contains(e.target) && !menuToggleBtn.contains(e.target)) {
          closeAllDrawers();
        }
      }
    });

    if (headerActionsMenu) {
      headerActionsMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.id !== 'audio-toggle-btn') {
            closeAllDrawers();
          }
        });
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDrawers();
      }
    });

    this.closeMobileDrawers = closeAllDrawers;
  }

  setupScaleControls() {
    const updateButtons = (currentScale) => {
      document.querySelectorAll('.scale-btn').forEach(btn => {
        if (btn.dataset.scale === currentScale) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    };

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.scale-btn');
      if (btn && btn.dataset.scale) {
        window.cyberAudio.click();
        window.stateStore.setCardScale(btn.dataset.scale);
      }
    });

    window.stateStore.on('scale_changed', (scale) => {
      updateButtons(scale);
    });

    window.stateStore.applyCardScale();
    updateButtons(window.stateStore.cardScale || 'auto');
  }

  setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        window.cyberAudio.click();
        const targetTab = tab.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    if (this.closeMobileDrawers) {
      this.closeMobileDrawers();
    }

    document.querySelectorAll('.nav-tab').forEach(t => {
      if (t.getAttribute('data-tab') === tabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-panel').forEach(p => {
      if (p.id === `tab-${tabId}`) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    if (tabId === 'deck-builder') {
      window.deckBuilderController.renderActiveDeck();
    } else if (tabId === 'analytics') {
      window.analyticsController.update();
    } else if (tabId === 'inventory') {
      window.inventoryController.render();
    }
  }

  setupAudioToggle() {
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (!audioBtn) return;

    const updateLabel = () => {
      const isMuted = window.cyberAudio.isMuted();
      audioBtn.innerHTML = isMuted ? '🔇 AUDIO: OFF' : '🔊 AUDIO: ON';
      audioBtn.style.color = isMuted ? 'var(--text-dim)' : 'var(--neon-cyan)';
    };

    updateLabel();

    audioBtn.addEventListener('click', () => {
      window.cyberAudio.toggleMute();
      updateLabel();
      if (!window.cyberAudio.isMuted()) {
        window.cyberAudio.click();
        this.showToast('Audio synthesizers activated');
      }
    });
  }

  setupStarterDecksUI() {
    if (this._starterDecksUISetup) return;
    this._starterDecksUISetup = true;

    this.presetFilters = {
      search: '',
      category: 'all',
      color: null
    };

    const searchInput = document.getElementById('preset-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.presetFilters.search = e.target.value.toLowerCase().trim();
        this.renderStarterDecks();
      });
    }

    const catPills = document.querySelectorAll('.filter-pill[data-preset-cat]');
    const allPresets = window.stateStore.starterDecks || [];
    const offCount = allPresets.filter(d => d.category === 'Official Starter').length;
    const commCount = allPresets.filter(d => d.category !== 'Official Starter').length;
    catPills.forEach(pill => {
      const cat = pill.getAttribute('data-preset-cat');
      if (cat === 'all') pill.textContent = `All Decks (${allPresets.length})`;
      else if (cat === 'official') pill.textContent = `⭐ Official Starters (${offCount})`;
      else if (cat === 'community') pill.textContent = `🌐 CyberpunkTCG.com Community (${commCount})`;

      pill.addEventListener('click', () => {
        window.cyberAudio.click();
        this.presetFilters.category = pill.getAttribute('data-preset-cat');
        catPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.renderStarterDecks();
      });
    });

    const colorPills = document.querySelectorAll('.filter-pill[data-preset-color]');
    colorPills.forEach(pill => {
      pill.addEventListener('click', () => {
        window.cyberAudio.click();
        const c = pill.getAttribute('data-preset-color');
        if (this.presetFilters.color === c) {
          this.presetFilters.color = null;
          pill.classList.remove('active');
        } else {
          this.presetFilters.color = c;
          colorPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        }
        this.renderStarterDecks();
      });
    });
  }

  populateStarterDecksList() {
    this.setupStarterDecksUI();
    this.renderStarterDecks();
  }

  renderStarterDecks() {
    const container = document.getElementById('starter-decks-catalog');
    if (!container) return;

    container.innerHTML = '';
    const allPresets = [...window.stateStore.starterDecks];
    const filters = this.presetFilters || { search: '', category: 'all', color: null };

    const filtered = allPresets.filter(preset => {
      // Category filter
      if (filters.category === 'official' && preset.category !== 'Official Starter') {
        return false;
      }
      if (filters.category === 'community' && preset.category !== 'Community Deck') {
        return false;
      }

      // Color filter
      if (filters.color && preset.faction !== filters.color) {
        return false;
      }

      // Search text
      if (filters.search) {
        const q = filters.search;
        const matchName = (preset.name || '').toLowerCase().includes(q);
        const matchDesc = (preset.description || '').toLowerCase().includes(q);
        const matchAuthor = (preset.author || '').toLowerCase().includes(q);
        const matchLegends = (preset.legends || []).some(id => {
          const c = window.stateStore.getCardById(id);
          return c && (c.name.toLowerCase().includes(q) || (c.card_title || '').toLowerCase().includes(q));
        });
        if (!matchName && !matchDesc && !matchAuthor && !matchLegends) {
          return false;
        }
      }

      return true;
    });

    const countDisplay = document.getElementById('preset-count-display');
    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length} of ${allPresets.length} Decks Available`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--text-dim); font-family: var(--font-mono);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-size: 1.1rem; color: var(--neon-cyan);">NO DECKS FOUND MATCHING CRITERIA</div>
          <p style="margin-top: 6px;">Try clearing filters or search query.</p>
        </div>
      `;
      return;
    }

    const colorHexes = {
      Red: '#ff003c',
      Yellow: '#fcee0a',
      Green: '#00ff66',
      Blue: '#00f0ff'
    };

    filtered.forEach(preset => {
      const cardEl = document.createElement('div');
      cardEl.className = 'stat-card';
      const borderHex = colorHexes[preset.faction] || '#00f0ff';
      cardEl.style.borderLeft = `4px solid ${borderHex}`;

      const isOfficial = preset.category === 'Official Starter';
      const badgeHtml = isOfficial
        ? `<span class="badge-official">⭐ OFFICIAL WEIRDCO</span>`
        : `<span class="badge-community">🌐 CYBERPUNKTCG.COM</span>`;

      const legendsHtml = (preset.legends || []).map(id => {
        const c = window.stateStore.getCardById(id);
        const title = c ? c.card_title || c.name : id;
        const fullName = c ? c.name : id;
        const img = c ? (c.image_local || `assets/cards/${id}.webp`) : `assets/cards/${id}.webp`;
        const col = c ? c.color : preset.faction;
        const colHex = colorHexes[col] || '#00f0ff';
        return `
          <div class="preset-legend-chip" style="border-left-color: ${colHex};" title="${fullName}">
            <img src="${img}" class="preset-legend-img" alt="${title}" onerror="this.onerror=null; this.src='../${img}';">
            <span>${title}</span>
          </div>
        `;
      }).join('');

      const totalCards = preset.cards.reduce((sum, i) => sum + i.count, 0);

      cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: ${borderHex}; font-weight: bold; text-transform: uppercase;">
                ${preset.faction} ALIGNMENT
              </span>
              ${badgeHtml}
            </div>
            <div style="font-size: 1.25rem; font-weight: bold; color: #fff; margin-top: 4px;">
              ${preset.name}
            </div>
            ${preset.author && !isOfficial ? `<div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">Community deck by <strong>${preset.author}</strong></div>` : ''}
          </div>
          <span class="brand-badge">${totalCards} CARDS</span>
        </div>

        <div style="margin-top: 6px;">
          <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-dim); margin-bottom: 4px;">
            3 IDENTITIES / LEGENDS:
          </div>
          <div class="preset-legends-row">
            ${legendsHtml}
          </div>
        </div>

        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; margin-top: 6px;">
          ${preset.description}
        </div>

        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <button class="cyber-btn cyber-btn-${(preset.faction || 'blue').toLowerCase()}" data-load-preset="${preset.id}" style="flex: 1;">
            ⚡ Load into Deck Builder
          </button>
        </div>
      `;

      cardEl.querySelector('[data-load-preset]').addEventListener('click', () => {
        window.cyberAudio.success();
        window.stateStore.loadDeck(preset);
        this.switchTab('deck-builder');
        this.showToast(`Loaded "${preset.name}" into Deck Builder!`);
      });

      container.appendChild(cardEl);
    });
  }

  setupInspectModal() {
    const modal = document.getElementById('inspect-modal');
    if (!modal) return;

    const closeModal = () => {
      window.cyberAudio.click();
      modal.classList.remove('active');
    };

    modal.querySelectorAll('.modal-close-btn, .inspect-modal-footer-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  openInspectModal(card) {
    const modal = document.getElementById('inspect-modal');
    if (!modal) return;

    const imgEl = document.getElementById('inspect-modal-img');
    const titleEl = document.getElementById('inspect-modal-title');
    const typeEl = document.getElementById('inspect-modal-type');
    const statsEl = document.getElementById('inspect-modal-stats');
    const rulesEl = document.getElementById('inspect-modal-rules');
    const artistEl = document.getElementById('inspect-modal-artist');

    if (imgEl) {
      // Find if this card is currently rendered on screen with a loaded image
      const renderedCardImg = document.querySelector(`.cyber-card-wrapper[data-card-id="${card.id}"] .card-art-img`);
      const cleanId = (card.id || '').replace(/^cb-/, '');
      const candidates = [];

      // 1. If currently rendered in the DOM, its src/currentSrc is already valid and cached
      if (renderedCardImg && renderedCardImg.currentSrc) {
        candidates.push(renderedCardImg.currentSrc);
      } else if (renderedCardImg && renderedCardImg.src) {
        candidates.push(renderedCardImg.src);
      }

      // 2. Relative paths from current location (handles /dist/, /src/, and root)
      if (card.image_local) {
        candidates.push(card.image_local);
        candidates.push(`../${card.image_local}`);
        candidates.push(`./${card.image_local}`);
      }

      // 3. Clean ID fallbacks
      if (cleanId) {
        candidates.push(`assets/cards/${cleanId}.webp`);
        candidates.push(`../assets/cards/${cleanId}.webp`);
        candidates.push(`./assets/cards/${cleanId}.webp`);
      }

      // 4. Remote CDN fallback
      if (card.image_url) {
        candidates.push(card.image_url);
      }

      const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

      let candidateIdx = 0;
      imgEl.alt = `${card.name} - Official WeirdCo Card Artwork`;

      // Set thematic border & glow based on card color
      const colorGlow = card.color === 'Red' ? 'var(--neon-magenta)'
                      : card.color === 'Yellow' ? 'var(--neon-yellow)'
                      : card.color === 'Green' ? 'var(--neon-green)'
                      : 'var(--neon-cyan)';
      imgEl.style.borderColor = colorGlow;
      imgEl.style.boxShadow = `0 0 35px ${colorGlow}`;

      imgEl.onerror = () => {
        candidateIdx++;
        if (candidateIdx < uniqueCandidates.length) {
          imgEl.src = uniqueCandidates[candidateIdx];
        }
      };

      if (uniqueCandidates.length > 0) {
        imgEl.src = uniqueCandidates[0];
      }
    }

    if (titleEl) titleEl.textContent = `${card.name} (${card.print_number})`;
    if (typeEl) typeEl.textContent = `${card.color} ${card.type} • ${card.rarity}`;

    if (statsEl) {
      const parts = [];
      if (card.cost !== null && card.cost !== undefined) parts.push(`€$ ${card.cost} Cost`);
      if (card.ram !== null && card.ram !== undefined && card.ram > 0) parts.push(`💾 ${card.ram} RAM`);
      if (card.power !== null && card.power !== undefined) parts.push(`⚔️ ${card.power} Power`);
      if (card.is_eddiable) parts.push(`💲 Sell Tag`);
      statsEl.innerHTML = parts.map(p => `<span class="keyword-pill">${p}</span>`).join(' ');
    }

    if (rulesEl) {
      rulesEl.textContent = card.ability || 'No rules text.';
    }

    if (artistEl) {
      artistEl.textContent = `Illustrated by ${card.artist || 'WeirdCo'} • Set: ${card.set_name || 'Welcome to Night City'}`;
    }

    const cmEl = document.getElementById('inspect-modal-cardmarket');
    if (cmEl) {
      cmEl.innerHTML = window.cardmarketService ? window.cardmarketService.renderPriceBadge(card) : '';
    }

    modal.classList.add('active');
  }

  setupToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    this.toastContainer = container;
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `cyber-toast ${type}`;

    let icon = '⚡';
    if (type === 'warn') icon = '⚠️';
    if (type === 'error') icon = '🛑';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    toast.appendChild(iconSpan);

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
