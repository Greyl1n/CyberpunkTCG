/**
 * Cyberpunk TCG - Deck Builder Controller
 */
class DeckBuilderController {
  constructor() {
    this.poolContainer = null;
    this.deckCardsContainer = null;
    this.deckNameInput = null;
    this.deckStatusBadge = null;
    this.leaderSlotEl = null;
  }

  init() {
    this.poolContainer = document.getElementById('deck-pool-cards');
    this.deckCardsContainer = document.getElementById('deck-cards-list');
    this.deckNameInput = document.getElementById('deck-name-input');
    this.deckStatusBadge = document.getElementById('deck-status-badge');
    this.leaderSlotEl = document.getElementById('deck-leader-slot');

    this.setupEvents();
    this.renderDeckPool();
    this.renderActiveDeck();

    window.stateStore.on('deck_changed', () => {
      this.renderActiveDeck();
      if (window.analyticsController) {
        window.analyticsController.update();
      }
    });

    window.stateStore.on('cards_loaded', () => {
      this.renderDeckPool();
      this.renderActiveDeck();
    });
  }

  setupEvents() {
    // Deck Name change
    if (this.deckNameInput) {
      this.deckNameInput.addEventListener('input', (e) => {
        window.stateStore.activeDeck.name = e.target.value.trim() || 'Untitled Deck';
        window.stateStore.saveCurrentDeck();
      });
    }

    // Pool Search in Deck Builder
    const poolSearch = document.getElementById('deck-pool-search');
    if (poolSearch) {
      poolSearch.addEventListener('input', (e) => {
        this.renderDeckPool(e.target.value.toLowerCase().trim());
      });
    }

    // Save Deck button
    const saveBtn = document.getElementById('save-deck-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window.cyberAudio.success();
        window.stateStore.saveCurrentDeck();
        window.app.showToast(`Deck "${window.stateStore.activeDeck.name}" saved to memory core!`);
      });
    }

    // New Deck button
    const newBtn = document.getElementById('new-deck-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        const name = prompt('Enter Cyber Deck Name:', 'Custom Runner ' + (window.stateStore.savedDecks.length + 1));
        if (name) {
          window.stateStore.createNewDeck(name);
          window.app.showToast(`Initialized new deck: ${name}`);
        }
      });
    }

    // Clear Deck button
    const clearBtn = document.getElementById('clear-deck-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all cards from active deck?')) {
          window.cyberAudio.remove();
          window.stateStore.activeDeck.cards = [];
          window.stateStore.activeDeck.leaderId = null;
          window.stateStore.emit('deck_changed', window.stateStore.activeDeck);
          window.app.showToast('Deck cards cleared', 'warn');
        }
      });
    }

    // Starter Decks Select Dropdown
    const starterSelect = document.getElementById('starter-deck-select');
    if (starterSelect) {
      starterSelect.addEventListener('change', (e) => {
        const deckId = e.target.value;
        if (!deckId) return;
        const target = window.stateStore.starterDecks.find(d => d.id === deckId) || 
                       window.stateStore.savedDecks.find(d => d.id === deckId);
        if (target) {
          window.cyberAudio.success();
          window.stateStore.loadDeck(target);
          window.app.showToast(`Loaded deck: ${target.name}`);
        }
      });
    }
  }

  renderDeckPool(searchQuery = '') {
    if (!this.poolContainer) return;
    this.poolContainer.innerHTML = '';

    const cards = window.stateStore.cards.filter(card => {
      if (!searchQuery) return true;
      return card.name.toLowerCase().includes(searchQuery) ||
             card.faction.toLowerCase().includes(searchQuery) ||
             card.type.toLowerCase().includes(searchQuery);
    });

    cards.forEach(card => {
      const cardEl = window.cardRenderer.renderCard(card, {
        showActions: true,
        compact: true
      });
      this.poolContainer.appendChild(cardEl);
    });
  }

  renderActiveDeck() {
    const deck = window.stateStore.activeDeck;
    if (!deck) return;

    if (this.deckNameInput && this.deckNameInput.value !== deck.name) {
      this.deckNameInput.value = deck.name;
    }

    // Validation Status
    const validation = window.stateStore.validateDeck();
    if (this.deckStatusBadge) {
      this.deckStatusBadge.className = `deck-status-badge ${validation.isLegal ? 'legal' : 'illegal'}`;
      this.deckStatusBadge.innerHTML = `
        <span>${validation.isLegal ? '✓' : '⚠️'}</span>
        <span>${validation.total} / 40 CARDS ${validation.isLegal ? '• LEGAL' : '• ' + validation.message}</span>
      `;
    }

    // Leader Display
    if (this.leaderSlotEl) {
      if (deck.leaderId) {
        const leaderCard = window.stateStore.getCardById(deck.leaderId);
        this.leaderSlotEl.innerHTML = `
          <div>
            <div class="leader-label">Designated Leader:</div>
            <div class="leader-name">${leaderCard ? leaderCard.name : 'Unknown'}</div>
          </div>
          <button class="cyber-btn" style="padding: 2px 8px; font-size: 0.7rem;" id="change-leader-btn">Clear</button>
        `;
        const clrBtn = this.leaderSlotEl.querySelector('#change-leader-btn');
        if (clrBtn) {
          clrBtn.addEventListener('click', () => {
            window.stateStore.activeDeck.leaderId = null;
            window.stateStore.emit('deck_changed', window.stateStore.activeDeck);
          });
        }
      } else {
        this.leaderSlotEl.innerHTML = `
          <div>
            <div class="leader-label">Leader Operative:</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">No Leader assigned (Add any Operative with 'Leader' keyword)</div>
          </div>
        `;
      }
    }

    // Cards list
    if (this.deckCardsContainer) {
      this.deckCardsContainer.innerHTML = '';

      if (deck.cards.length === 0) {
        this.deckCardsContainer.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--text-dim); font-family: var(--font-mono);">
            Empty Deck. Click "+ Deck" on any card from the inventory to slot it in.
          </div>
        `;
        return;
      }

      // Sort deck cards by Cost, then Name
      const sortedItems = [...deck.cards].sort((a, b) => {
        const cardA = window.stateStore.getCardById(a.cardId);
        const cardB = window.stateStore.getCardById(b.cardId);
        if (!cardA || !cardB) return 0;
        return cardA.cost - cardB.cost || cardA.name.localeCompare(cardB.name);
      });

      sortedItems.forEach(item => {
        const card = window.stateStore.getCardById(item.cardId);
        if (!card) return;

        const row = document.createElement('div');
        row.className = 'deck-card-row';

        const factionColor = `var(--faction-${card.faction.toLowerCase()})`;
        const isLeader = deck.leaderId === card.id;

        row.innerHTML = `
          <div class="deck-card-main">
            <div class="deck-card-cost">${card.cost}</div>
            <div class="deck-card-name" style="border-left: 3px solid ${factionColor}; padding-left: 6px;">
              ${card.name} ${isLeader ? '👑' : ''}
            </div>
          </div>
          <div class="deck-card-actions">
            <button class="deck-qty-btn remove" data-action="minus" title="Remove 1 copy">-</button>
            <span class="deck-card-qty">${item.count}</span>
            <button class="deck-qty-btn" data-action="plus" title="Add 1 copy">+</button>
            <button class="deck-qty-btn remove" data-action="delete" title="Delete from deck">×</button>
          </div>
        `;

        row.querySelector('[data-action="minus"]').addEventListener('click', () => {
          window.cyberAudio.remove();
          window.stateStore.removeCardFromDeck(card.id);
        });

        row.querySelector('[data-action="plus"]').addEventListener('click', () => {
          const res = window.stateStore.addCardToDeck(card.id);
          if (res && res.success) {
            window.cyberAudio.add();
          } else if (res && res.reason) {
            window.app.showToast(res.reason, 'warn');
          }
        });

        row.querySelector('[data-action="delete"]').addEventListener('click', () => {
          window.cyberAudio.remove();
          const idx = deck.cards.findIndex(c => c.cardId === card.id);
          if (idx !== -1) {
            deck.cards.splice(idx, 1);
            if (deck.leaderId === card.id) deck.leaderId = null;
            window.stateStore.emit('deck_changed', deck);
          }
        });

        this.deckCardsContainer.appendChild(row);
      });
    }

    // Mini RAM Curve Chart
    this.renderMiniCurve();
  }

  renderMiniCurve() {
    const barsContainer = document.getElementById('deck-curve-bars');
    if (!barsContainer) return;

    const deck = window.stateStore.activeDeck;
    const costBuckets = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6+

    deck.cards.forEach(item => {
      const card = window.stateStore.getCardById(item.cardId);
      if (card) {
        const bucket = Math.min(card.cost, 6);
        costBuckets[bucket] += item.count;
      }
    });

    const maxCount = Math.max(...costBuckets, 1);

    barsContainer.innerHTML = costBuckets.map((count, cost) => {
      const heightPercent = Math.max(8, (count / maxCount) * 100);
      const label = cost === 6 ? '6+' : cost;
      return `
        <div class="curve-col">
          <div class="curve-bar" style="height: ${heightPercent}%;">
            ${count > 0 ? `<span class="curve-bar-count">${count}</span>` : ''}
          </div>
          <span class="curve-cost-label">${label}</span>
        </div>
      `;
    }).join('');
  }
}

window.deckBuilderController = new DeckBuilderController();
