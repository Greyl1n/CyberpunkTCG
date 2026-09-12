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

    this.populateStarterDecksList();

    this.showToast('WeirdCo Cyberpunk TCG Database online. 151 official cards loaded.');
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

  populateStarterDecksList() {
    const container = document.getElementById('starter-decks-catalog');
    if (!container) return;

    container.innerHTML = '';
    const allPresets = [...window.stateStore.starterDecks];

    const colorHexes = {
      Red: '#ff003c',
      Yellow: '#fcee0a',
      Green: '#00ff66',
      Blue: '#00f0ff'
    };

    allPresets.forEach(preset => {
      const cardEl = document.createElement('div');
      cardEl.className = 'stat-card';
      const borderHex = colorHexes[preset.faction] || '#00f0ff';
      cardEl.style.borderLeft = `4px solid ${borderHex}`;

      const leaderCard = window.stateStore.getCardById(preset.leaderId);
      const totalCards = preset.cards.reduce((sum, i) => sum + i.count, 0);

      cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: ${borderHex}; font-weight: bold; text-transform: uppercase;">
              ${preset.faction} Alignment Preset
            </div>
            <div style="font-size: 1.25rem; font-weight: bold; color: #fff; margin-top: 4px;">
              ${preset.name}
            </div>
          </div>
          <span class="brand-badge">${totalCards} CARDS</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
          ${preset.description}
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">
          Legend: <span style="color: var(--neon-yellow); font-weight: bold;">${leaderCard ? leaderCard.name : preset.leaderId}</span>
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <button class="cyber-btn cyber-btn-accent" data-load-preset="${preset.id}" style="width: 100%;">
            Load into Active Deck Builder
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

  openInspectModal(card) {
    const modal = document.getElementById('inspect-modal');
    if (!modal) return;

    const imgEl = document.getElementById('inspect-modal-img');
    const titleEl = document.getElementById('inspect-modal-title');
    const typeEl = document.getElementById('inspect-modal-type');
    const statsEl = document.getElementById('inspect-modal-stats');
    const rulesEl = document.getElementById('inspect-modal-rules');
    const artistEl = document.getElementById('inspect-modal-artist');

    const imgSrc = card.image_local || card.image_url;
    if (imgEl) {
      imgEl.src = imgSrc;
      imgEl.onerror = () => {
        if (card.image_url) imgEl.src = card.image_url;
      };
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

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
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
