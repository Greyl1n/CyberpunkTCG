/**
 * Cyberpunk TCG - Central Reactive State & Persistence (WeirdCo Official)
 * Strictly enforces official rules: Exactly 3 unique Legends, 40-50 main deck cards, RAM limits.
 */
class StateStore {
  constructor() {
    this.cards = [];
    this.starterDecks = [];
    this.inventory = {};
    this.activeDeck = {
      id: 'custom-deck-1',
      name: 'The Heist: V Streetkid Crew',
      faction: 'Red',
      legends: [
        'cb-v-streetkid',
        'cb-johnny-silverhand-rocking-renegade',
        'cb-dexter-deshawn-off-the-grid'
      ],
      leaderId: 'cb-v-streetkid',
      cards: []
    };
    this.savedDecks = [];
    this.filters = {
      search: '',
      factions: new Set(),
      types: new Set(),
      rarities: new Set(),
      maxCost: null,
      ownedOnly: false,
      collectionFilter: 'all' // 'all', 'owned', 'missing', 'incomplete'
    };
    this.cardScale = localStorage.getItem('cyber_tcg_card_scale') || 'auto'; // 'auto', 'compact', 'large'
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  setCardScale(scale) {
    const valid = ['auto', 'compact', 'large'];
    this.cardScale = valid.includes(scale) ? scale : 'auto';
    localStorage.setItem('cyber_tcg_card_scale', this.cardScale);
    this.applyCardScale();
    this.emit('scale_changed', this.cardScale);
  }

  applyCardScale() {
    const appEl = document.documentElement;
    if (appEl) {
      appEl.classList.remove('scale-compact', 'scale-large', 'scale-auto');
      appEl.classList.add(`scale-${this.cardScale}`);
    }

    document.querySelectorAll('.scale-btn').forEach(btn => {
      const match = btn.getAttribute('data-scale') === this.cardScale;
      btn.classList.toggle('active', match);
    });
  }

  async loadInitialData() {
    this.applyCardScale();
    // 1. Initialize local offline database
    if (window.appDB) {
      try {
        await window.appDB.init();
      } catch (err) {
        console.warn('[StateStore] Database initialization warning:', err);
      }
    }

    // 2. Load card catalog (inlined, local DB cache, or relative JSON)
    if (window.__CYBERPUNK_CARDS__ && Array.isArray(window.__CYBERPUNK_CARDS__)) {
      this.cards = window.__CYBERPUNK_CARDS__;
    } else {
      // Check cached cards in DB first for instant offline startup
      if (window.appDB) {
        try {
          const cached = await window.appDB.getCachedCards();
          if (cached && cached.length > 0) {
            this.cards = cached;
          }
        } catch (e) {}
      }

      if (this.cards.length === 0) {
        try {
          const res = await fetch('../data/cards.json');
          this.cards = await res.json();
        } catch (err) {
          try {
            const res = await fetch('/data/cards.json');
            this.cards = await res.json();
          } catch (e) {
            console.error('Could not load cards.json', e);
          }
        }
      }

      // Cache cards into local database for future offline loads
      if (window.appDB && this.cards.length > 0) {
        window.appDB.cacheCards(this.cards);
      }
    }

    // 3. Load starter decks
    if (window.__CYBERPUNK_STARTER_DECKS__ && Array.isArray(window.__CYBERPUNK_STARTER_DECKS__)) {
      this.starterDecks = window.__CYBERPUNK_STARTER_DECKS__;
    } else {
      try {
        const res = await fetch('../data/starter_decks.json');
        this.starterDecks = await res.json();
      } catch (err) {
        try {
          const res = await fetch('/data/starter_decks.json');
          this.starterDecks = await res.json();
        } catch (e) {
          this.starterDecks = [];
        }
      }
    }

    // 4. Load inventory and saved decks from DB / storage
    await this.loadInventory();
    await this.loadSavedDecks();

    if (!this.activeDeck.cards || this.activeDeck.cards.length === 0) {
      if (this.savedDecks.length > 0) {
        this.loadDeck(this.savedDecks[0]);
      } else if (this.starterDecks.length > 0) {
        this.loadDeck(this.starterDecks[0]);
      }
    }

    this.emit('cards_loaded', this.cards);
  }

  async loadInventory() {
    let dbInventory = null;
    if (window.appDB) {
      try {
        dbInventory = await window.appDB.getInventory();
      } catch (e) {}
    }

    if (dbInventory && Object.keys(dbInventory).length > 0) {
      this.inventory = dbInventory;
    } else {
      const isV2 = localStorage.getItem('cyber_tcg_inventory_empty_v2');
      const saved = localStorage.getItem('cyber_tcg_inventory');

      if (isV2 && saved) {
        try {
          this.inventory = JSON.parse(saved);
        } catch (e) {
          this.inventory = {};
        }
      } else {
        // Default inventory starts completely EMPTY (0 cards)
        this.inventory = {};
        localStorage.setItem('cyber_tcg_inventory_empty_v2', 'true');
      }
    }

    this.cards.forEach(card => {
      if (this.inventory[card.id] === undefined) {
        this.inventory[card.id] = 0;
      }
    });

    this.saveInventory();
  }

  saveInventory() {
    localStorage.setItem('cyber_tcg_inventory', JSON.stringify(this.inventory));
    if (window.appDB) {
      window.appDB.saveAllInventory(this.inventory);
    }
    this.emit('inventory_changed', this.inventory);
  }

  setInventoryCount(cardId, count) {
    const val = Math.max(0, count);
    this.inventory[cardId] = val;
    if (window.appDB) {
      window.appDB.saveInventoryItem(cardId, val);
    }
    this.saveInventory();
  }

  getTotalInventoryCount() {
    return Object.values(this.inventory).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }

  getUniqueOwnedCount() {
    return this.cards.filter(c => (this.inventory[c.id] || 0) > 0).length;
  }

  getPlaysetCount() {
    return this.cards.filter(c => (this.inventory[c.id] || 0) >= 3).length;
  }

  bulkSetInventory(count) {
    const target = Math.max(0, Number(count) || 0);
    this.cards.forEach(card => {
      this.inventory[card.id] = target;
    });
    this.saveInventory();
  }

  async loadSavedDecks() {
    let dbDecks = null;
    if (window.appDB) {
      try {
        dbDecks = await window.appDB.getSavedDecks();
      } catch (e) {}
    }

    if (Array.isArray(dbDecks) && dbDecks.length > 0) {
      this.savedDecks = dbDecks;
    } else {
      const saved = localStorage.getItem('cyber_tcg_saved_decks');
      if (saved) {
        try {
          this.savedDecks = JSON.parse(saved);
        } catch (e) {
          this.savedDecks = [];
        }
      }
    }

    if (this.savedDecks.length === 0 && this.starterDecks.length > 0) {
      this.savedDecks = JSON.parse(JSON.stringify(this.starterDecks));
      this.saveDecks();
    }
  }

  saveDecks() {
    localStorage.setItem('cyber_tcg_saved_decks', JSON.stringify(this.savedDecks));
    if (window.appDB) {
      window.appDB.saveAllDecks(this.savedDecks);
    }
    this.emit('saved_decks_changed', this.savedDecks);
  }

  loadDeck(deckObj) {
    this.activeDeck = JSON.parse(JSON.stringify(deckObj));
    // Ensure deck has legends array
    if (!this.activeDeck.legends) {
      this.activeDeck.legends = [];
      if (this.activeDeck.leaderId) {
        this.activeDeck.legends.push(this.activeDeck.leaderId);
      }
    }
    this.emit('deck_changed', this.activeDeck);
  }

  saveCurrentDeck() {
    const idx = this.savedDecks.findIndex(d => d.id === this.activeDeck.id);
    if (idx >= 0) {
      this.savedDecks[idx] = JSON.parse(JSON.stringify(this.activeDeck));
    } else {
      this.savedDecks.push(JSON.parse(JSON.stringify(this.activeDeck)));
    }
    this.saveDecks();
    return true;
  }

  createNewDeck(name = 'New Cyber Deck') {
    this.activeDeck = {
      id: 'deck-' + Date.now(),
      name: name,
      faction: 'Neutral',
      legends: [],
      cards: []
    };
    this.saveCurrentDeck();
    this.emit('deck_changed', this.activeDeck);
  }

  getDeckCumulativeRAM() {
    const ramPool = { Red: 0, Yellow: 0, Green: 0, Blue: 0 };
    (this.activeDeck.legends || []).forEach(id => {
      const leg = this.getCardById(id);
      if (leg && leg.color && leg.ram) {
        ramPool[leg.color] = (ramPool[leg.color] || 0) + leg.ram;
      }
    });
    return ramPool;
  }

  addLegendToDeck(cardId) {
    if (!this.activeDeck.legends) {
      this.activeDeck.legends = [];
    }
    if (this.activeDeck.legends.length >= 3) {
      return { success: false, reason: 'Legend Zone is full (Maximum 3 Legends allowed).' };
    }
    const card = this.getCardById(cardId);
    if (!card) return { success: false, reason: 'Card not found.' };

    // Check unique names among legends
    const existing = this.activeDeck.legends.find(id => {
      const existingCard = this.getCardById(id);
      return existingCard && (existingCard.id === card.id || existingCard.card_title === card.card_title);
    });

    if (existing) {
      return { success: false, reason: `Deck already includes ${card.card_title} (All 3 Legends must have unique names).` };
    }

    this.activeDeck.legends.push(card.id);
    this.emit('deck_changed', this.activeDeck);
    return { success: true };
  }

  removeLegendFromDeck(cardId) {
    if (!this.activeDeck.legends) return;
    const idx = this.activeDeck.legends.indexOf(cardId);
    if (idx !== -1) {
      this.activeDeck.legends.splice(idx, 1);
      this.emit('deck_changed', this.activeDeck);
    }
  }

  addCardToDeck(cardId) {
    const card = this.getCardById(cardId);
    if (!card) return { success: false, reason: 'Card not found.' };

    if (card.type === 'Legend') {
      return this.addLegendToDeck(cardId);
    }

    // Normal main deck card (Unit, Program, Gear)
    const currentTotal = this.getDeckTotalCards();
    if (currentTotal >= 50) {
      return { success: false, reason: 'Main deck limit reached (Maximum 50 cards allowed).' };
    }

    const existing = this.activeDeck.cards.find(c => c.cardId === cardId);
    if (existing) {
      if (existing.count >= 3) {
        return { success: false, reason: `Max 3 copies allowed for ${card.name}.` };
      }
      existing.count += 1;
    } else {
      this.activeDeck.cards.push({ cardId: card.id, count: 1 });
    }

    this.emit('deck_changed', this.activeDeck);
    return { success: true };
  }

  removeCardFromDeck(cardId) {
    const card = this.getCardById(cardId);
    if (card && card.type === 'Legend') {
      this.removeLegendFromDeck(cardId);
      return;
    }

    const existingIdx = this.activeDeck.cards.findIndex(c => c.cardId === cardId);
    if (existingIdx === -1) return;

    if (this.activeDeck.cards[existingIdx].count > 1) {
      this.activeDeck.cards[existingIdx].count -= 1;
    } else {
      this.activeDeck.cards.splice(existingIdx, 1);
    }
    this.emit('deck_changed', this.activeDeck);
  }

  getCardById(id) {
    return this.cards.find(c => c.id === id || c.netdeck_id === id);
  }

  getDeckTotalCards() {
    return this.activeDeck.cards.reduce((sum, item) => sum + item.count, 0);
  }

  validateDeck() {
    const legends = this.activeDeck.legends || [];
    const total = this.getDeckTotalCards();
    const ramPool = this.getDeckCumulativeRAM();

    const hasExact3Legends = legends.length === 3;
    const isCardCountValid = total >= 40 && total <= 50;

    // Check RAM violations
    let ramViolation = null;
    for (const item of this.activeDeck.cards) {
      const card = this.getCardById(item.cardId);
      if (card && card.ram && card.ram > 0) {
        const available = ramPool[card.color] || 0;
        if (card.ram > available) {
          ramViolation = `${card.name} requires ${card.ram} ${card.color} RAM (Legends provide ${available})`;
          break;
        }
      }
    }

    const isLegal = hasExact3Legends && isCardCountValid && !ramViolation;

    let message = '';
    if (legends.length < 3) {
      message = `Requires exactly 3 Legends (Currently ${legends.length}/3).`;
    } else if (legends.length > 3) {
      message = `Too many Legends (Must have exactly 3).`;
    } else if (total < 40) {
      message = `Need ${40 - total} more cards (${total}/40–50 required).`;
    } else if (total > 50) {
      message = `Exceeds 50 card limit (${total}/50 cards, remove ${total - 50}).`;
    } else if (ramViolation) {
      message = `RAM Error: ${ramViolation}`;
    } else {
      message = `Tournament Legal (3 Legends + ${total}/40–50 Cards)`;
    }

    return { isLegal, total, legendsCount: legends.length, ramPool, message };
  }
}

window.stateStore = new StateStore();
