/**
 * Cyberpunk TCG - Central Reactive State & Persistence
 * Strictly enforces rules: Exactly 3 unique Legends, 40-50 main deck cards, RAM limits.
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
      cards: [],
      sideboard: []
    };
    this.savedDecks = [];
    this.favoriteDecks = new Set();
    this.filters = {
      search: '',
      factions: new Set(),
      types: new Set(),
      rarities: new Set(),
      maxCost: null,
      ownedOnly: false,
      collectionFilter: 'all', // 'all', 'owned', 'missing', 'incomplete'
      sortBy: localStorage.getItem('cyber_tcg_inventory_sort') || 'number' // 'number', 'number-desc', 'name', 'cost', 'owned', 'default'
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
      if (window.appDB && this.cards.length > 0) {
        window.appDB.cacheCards(this.cards);
      }
    } else {
      // 1. Fetch latest bundled cards.json first
      const candidates = [
        'data/cards.json',
        './data/cards.json',
        '../data/cards.json',
        '/data/cards.json'
      ];
      for (const p of candidates) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            this.cards = await res.json();
            if (Array.isArray(this.cards) && this.cards.length > 0) break;
          }
        } catch (e) {}
      }

      // 2. Fallback to cached cards in local DB only if fetch was unavailable/empty
      if ((!this.cards || this.cards.length === 0) && window.appDB) {
        try {
          const cached = await window.appDB.getCachedCards();
          if (cached && cached.length > 0) {
            this.cards = cached;
          }
        } catch (e) {}
      }

      // 3. Cache latest cards into local database for future offline loads
      if (window.appDB && this.cards && this.cards.length > 0) {
        window.appDB.cacheCards(this.cards);
      }
    }

    // 3. Load starter decks
    if (window.__CYBERPUNK_STARTER_DECKS__ && Array.isArray(window.__CYBERPUNK_STARTER_DECKS__)) {
      this.starterDecks = window.__CYBERPUNK_STARTER_DECKS__;
    } else {
      const deckCandidates = [
        'data/starter_decks.json',
        './data/starter_decks.json',
        '../data/starter_decks.json',
        '/data/starter_decks.json'
      ];
      for (const p of deckCandidates) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            this.starterDecks = await res.json();
            if (Array.isArray(this.starterDecks) && this.starterDecks.length > 0) break;
          }
        } catch (err) {}
      }
      if (!this.starterDecks) this.starterDecks = [];
    }

    // 4. Load inventory and saved decks from desktop disk / DB / storage
    const desktopState = await this.fetchDesktopState();
    await this.loadInventory(desktopState);
    await this.loadSavedDecks(desktopState);
    await this.loadFavoriteDecks(desktopState);

    if (desktopState && desktopState.activeDeck && Array.isArray(desktopState.activeDeck.cards) && desktopState.activeDeck.cards.length > 0) {
      this.loadDeck(desktopState.activeDeck);
    } else if (!this.activeDeck.cards || this.activeDeck.cards.length === 0) {
      if (this.savedDecks.length > 0) {
        this.loadDeck(this.savedDecks[0]);
      } else if (this.starterDecks.length > 0) {
        this.loadDeck(this.starterDecks[0]);
      }
    }

    this.emit('cards_loaded', this.cards);
  }

  async fetchDesktopState() {
    // 1. Try native PyWebView JS bridge if ready
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.load_user_state === 'function') {
      try {
        const state = await window.pywebview.api.load_user_state();
        if (state && typeof state === 'object' && Object.keys(state).length > 0) {
          return state;
        }
      } catch (e) {}
    }

    // 2. Try local desktop HTTP API endpoint (/api/user_state)
    try {
      const res = await fetch('/api/user_state', { cache: 'no-store' });
      if (res.ok) {
        const state = await res.json();
        if (state && typeof state === 'object') {
          return state;
        }
      }
    } catch (e) {}

    return null;
  }

  syncDesktopState(updates) {
    if (!updates || typeof updates !== 'object') return;

    // 1. Sync via native PyWebView JS bridge if available
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_user_state === 'function') {
      try {
        window.pywebview.api.save_user_state(updates);
      } catch (e) {}
    }

    // 2. Sync via local desktop HTTP API endpoint (/api/user_state)
    try {
      fetch('/api/user_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }).catch(() => {});
    } catch (e) {}
  }

  async loadInventory(desktopState = null) {
    let dbInventory = null;
    if (window.appDB) {
      try {
        dbInventory = await window.appDB.getInventory();
      } catch (e) {}
    }

    const hasOwnedCards = (inv) => inv && typeof inv === 'object' && Object.values(inv).some(v => (Number(v) || 0) > 0);
    const hasAnyEntries = (inv) => inv && typeof inv === 'object' && Object.keys(inv).length > 0;

    const deskInv = desktopState && desktopState.inventory ? desktopState.inventory : null;

    if (hasOwnedCards(deskInv)) {
      this.inventory = deskInv;
    } else if (hasOwnedCards(dbInventory)) {
      this.inventory = dbInventory;
    } else if (hasAnyEntries(deskInv)) {
      this.inventory = deskInv;
    } else if (hasAnyEntries(dbInventory)) {
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
    localStorage.setItem('cyber_tcg_inventory_empty_v2', 'true');
    if (window.appDB) {
      window.appDB.saveAllInventory(this.inventory);
    }
    this.syncDesktopState({ inventory: this.inventory });
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

  getBaseCards() {
    return this.cards.filter(c => !c.is_alt_art);
  }

  getUniqueOwnedCount() {
    return this.cards.filter(c => (this.inventory[c.id] || 0) > 0).length;
  }

  getPlaysetCount() {
    const baseCards = this.getBaseCards();
    return baseCards.filter(baseCard => {
      let totalCopies = Number(this.inventory[baseCard.id]) || 0;
      this.cards.forEach(c => {
        if (c.is_alt_art && (c.variant_of === baseCard.id || c.variant_of === baseCard.netdeck_id)) {
          totalCopies += (Number(this.inventory[c.id]) || 0);
        }
      });
      return totalCopies >= 3;
    }).length;
  }

  bulkSetInventory(count) {
    const target = Math.max(0, Number(count) || 0);
    this.cards.forEach(card => {
      this.inventory[card.id] = target;
    });
    this.saveInventory();
  }

  async loadSavedDecks(desktopState = null) {
    let dbDecks = null;
    if (window.appDB) {
      try {
        dbDecks = await window.appDB.getSavedDecks();
      } catch (e) {}
    }

    const deskDecks = desktopState && Array.isArray(desktopState.savedDecks) ? desktopState.savedDecks : null;

    if (deskDecks && deskDecks.length > 0) {
      this.savedDecks = deskDecks;
    } else if (Array.isArray(dbDecks) && dbDecks.length > 0) {
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
    this.syncDesktopState({ savedDecks: this.savedDecks, activeDeck: this.activeDeck });
    this.emit('saved_decks_changed', this.savedDecks);
  }

  async loadFavoriteDecks(desktopState = null) {
    let favList = [];
    if (desktopState && Array.isArray(desktopState.favoriteDecks)) {
      favList = desktopState.favoriteDecks;
    } else {
      const stored = localStorage.getItem('cyber_tcg_favorite_decks');
      if (stored) {
        try {
          favList = JSON.parse(stored);
        } catch (e) {
          favList = [];
        }
      }
    }
    this.favoriteDecks = new Set(Array.isArray(favList) ? favList : []);
  }

  saveFavoriteDecks() {
    const arr = Array.from(this.favoriteDecks);
    localStorage.setItem('cyber_tcg_favorite_decks', JSON.stringify(arr));
    this.syncDesktopState({ favoriteDecks: arr });
    this.emit('favorites_changed', arr);
  }

  toggleFavoriteDeck(deckId) {
    if (!deckId) return false;
    const isNow = !this.favoriteDecks.has(deckId);
    if (isNow) {
      this.favoriteDecks.add(deckId);
    } else {
      this.favoriteDecks.delete(deckId);
    }
    this.saveFavoriteDecks();
    return isNow;
  }

  isFavoriteDeck(deckId) {
    return this.favoriteDecks.has(deckId);
  }

  getFavoriteDecksCount() {
    return this.favoriteDecks.size;
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
    if (!this.activeDeck.sideboard) {
      this.activeDeck.sideboard = [];
    }
    this.syncDesktopState({ activeDeck: this.activeDeck });
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
      cards: [],
      sideboard: []
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

    // Check 3-copy rule across same card titles/variants
    const cardTitle = (card.card_title || card.name).toLowerCase();
    const copiesAcrossArts = this.activeDeck.cards.reduce((sum, item) => {
      const itemCard = this.getCardById(item.cardId);
      if (!itemCard) return sum;
      const itemTitle = (itemCard.card_title || itemCard.name).toLowerCase();
      if (itemTitle === cardTitle || (card.variant_of && (card.variant_of === itemCard.id || card.variant_of === itemCard.variant_of))) {
        return sum + item.count;
      }
      return sum;
    }, 0);

    if (copiesAcrossArts >= 3) {
      return { success: false, reason: `Max 3 copies allowed across all printings of ${card.card_title || card.name}.` };
    }

    const existing = this.activeDeck.cards.find(c => c.cardId === cardId);
    if (existing) {
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

  getDeckTotalSideboardCards() {
    return (this.activeDeck.sideboard || []).reduce((sum, item) => sum + item.count, 0);
  }

  addCardToSideboard(cardId) {
    const card = this.getCardById(cardId);
    if (!card) return { success: false, reason: 'Card not found.' };

    if (card.type === 'Legend') {
      return { success: false, reason: 'Legends belong in the 3-Legend Identity Zone, not Sideboard.' };
    }

    if (!this.activeDeck.sideboard) {
      this.activeDeck.sideboard = [];
    }

    const currentTotal = this.getDeckTotalSideboardCards();
    if (currentTotal >= 15) {
      return { success: false, reason: 'Sideboard limit reached (Maximum 15 cards allowed).' };
    }

    // Check 3-copy rule across main deck and sideboard combined
    const cardTitle = (card.card_title || card.name).toLowerCase();
    const countInDeck = (this.activeDeck.cards || []).reduce((sum, item) => {
      const itemCard = this.getCardById(item.cardId);
      if (!itemCard) return sum;
      const itemTitle = (itemCard.card_title || itemCard.name).toLowerCase();
      if (itemTitle === cardTitle || (card.variant_of && (card.variant_of === itemCard.id || card.variant_of === itemCard.variant_of))) {
        return sum + item.count;
      }
      return sum;
    }, 0);

    const countInSideboard = (this.activeDeck.sideboard || []).reduce((sum, item) => {
      const itemCard = this.getCardById(item.cardId);
      if (!itemCard) return sum;
      const itemTitle = (itemCard.card_title || itemCard.name).toLowerCase();
      if (itemTitle === cardTitle || (card.variant_of && (card.variant_of === itemCard.id || card.variant_of === itemCard.variant_of))) {
        return sum + item.count;
      }
      return sum;
    }, 0);

    if (countInDeck + countInSideboard >= 3) {
      return { success: false, reason: `Max 3 copies allowed across Main Deck and Sideboard for ${card.card_title || card.name}.` };
    }

    const existing = this.activeDeck.sideboard.find(c => c.cardId === cardId);
    if (existing) {
      existing.count += 1;
    } else {
      this.activeDeck.sideboard.push({ cardId: card.id, count: 1 });
    }

    this.emit('deck_changed', this.activeDeck);
    return { success: true };
  }

  removeCardFromSideboard(cardId) {
    if (!this.activeDeck.sideboard) return;
    const existingIdx = this.activeDeck.sideboard.findIndex(c => c.cardId === cardId);
    if (existingIdx === -1) return;

    if (this.activeDeck.sideboard[existingIdx].count > 1) {
      this.activeDeck.sideboard[existingIdx].count -= 1;
    } else {
      this.activeDeck.sideboard.splice(existingIdx, 1);
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
    const sideboardTotal = this.getDeckTotalSideboardCards();
    const ramPool = this.getDeckCumulativeRAM();

    const hasExact3Legends = legends.length === 3;
    const isCardCountValid = total >= 40 && total <= 50;
    const isSideboardValid = sideboardTotal <= 15;

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

    const isLegal = hasExact3Legends && isCardCountValid && isSideboardValid && !ramViolation;

    let message = '';
    if (legends.length < 3) {
      message = `Requires exactly 3 Legends (Currently ${legends.length}/3).`;
    } else if (legends.length > 3) {
      message = `Too many Legends (Must have exactly 3).`;
    } else if (total < 40) {
      message = `Need ${40 - total} more cards (${total}/40–50 required).`;
    } else if (total > 50) {
      message = `Exceeds 50 card limit (${total}/50 cards, remove ${total - 50}).`;
    } else if (sideboardTotal > 15) {
      message = `Sideboard exceeds 15 card limit (${sideboardTotal}/15 cards).`;
    } else if (ramViolation) {
      message = `RAM Error: ${ramViolation}`;
    } else {
      message = `Tournament Legal (3 Legends + ${total}/40–50 Cards${sideboardTotal > 0 ? ` + ${sideboardTotal} Sideboard` : ''})`;
    }

    return { isLegal, total, sideboardTotal, legendsCount: legends.length, ramPool, message };
  }
}

window.stateStore = new StateStore();
