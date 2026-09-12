/**
 * Cyberpunk TCG - Central Reactive State & Persistence (WeirdCo Official)
 */
class StateStore {
  constructor() {
    this.cards = [];
    this.starterDecks = [];
    this.inventory = {};
    this.activeDeck = {
      id: 'custom-deck-1',
      name: 'V: Streetkid Crew',
      faction: 'Red',
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
      ownedOnly: false
    };
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

  async loadInitialData() {
    // 1. Check if cards are embedded into window (Monolith mode)
    if (window.__CYBERPUNK_CARDS__ && Array.isArray(window.__CYBERPUNK_CARDS__)) {
      this.cards = window.__CYBERPUNK_CARDS__;
    } else {
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

    // 2. Load starter decks
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

    // 3. Initialize Inventory
    this.loadInventory();

    // 4. Initialize saved decks
    this.loadSavedDecks();

    // 5. If no active deck is loaded, load starter deck
    if (!this.activeDeck.cards || this.activeDeck.cards.length === 0) {
      if (this.savedDecks.length > 0) {
        this.activeDeck = JSON.parse(JSON.stringify(this.savedDecks[0]));
      } else if (this.starterDecks.length > 0) {
        this.loadDeck(this.starterDecks[0]);
      }
    }

    this.emit('cards_loaded', this.cards);
  }

  loadInventory() {
    const saved = localStorage.getItem('cyber_tcg_inventory');
    if (saved) {
      try {
        this.inventory = JSON.parse(saved);
      } catch (e) {
        this.inventory = {};
      }
    }
    // Default 3 copies for every official card
    this.cards.forEach(card => {
      if (this.inventory[card.id] === undefined) {
        this.inventory[card.id] = 3;
      }
    });
    this.saveInventory();
  }

  saveInventory() {
    localStorage.setItem('cyber_tcg_inventory', JSON.stringify(this.inventory));
    this.emit('inventory_changed', this.inventory);
  }

  setInventoryCount(cardId, count) {
    this.inventory[cardId] = Math.max(0, count);
    this.saveInventory();
  }

  loadSavedDecks() {
    const saved = localStorage.getItem('cyber_tcg_saved_decks');
    if (saved) {
      try {
        this.savedDecks = JSON.parse(saved);
      } catch (e) {
        this.savedDecks = [];
      }
    }
    if (this.savedDecks.length === 0 && this.starterDecks.length > 0) {
      this.savedDecks = JSON.parse(JSON.stringify(this.starterDecks));
      this.saveDecks();
    }
  }

  saveDecks() {
    localStorage.setItem('cyber_tcg_saved_decks', JSON.stringify(this.savedDecks));
    this.emit('saved_decks_changed', this.savedDecks);
  }

  loadDeck(deckObj) {
    this.activeDeck = JSON.parse(JSON.stringify(deckObj));
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
      faction: 'Red',
      leaderId: null,
      cards: []
    };
    this.saveCurrentDeck();
    this.emit('deck_changed', this.activeDeck);
  }

  addCardToDeck(cardId) {
    const card = this.getCardById(cardId);
    if (!card) return false;

    const isLegend = card.type === 'Legend' || (card.keywords && card.keywords.includes('Legend'));

    if (isLegend) {
      // If user adds a Legend, set as Leader
      const existing = this.activeDeck.cards.find(c => c.cardId === cardId);
      if (existing) {
        return { success: false, reason: 'Only 1 copy of a Legend card allowed.' };
      }
      this.activeDeck.leaderId = card.id;
      this.activeDeck.faction = card.color || card.faction;
      this.activeDeck.cards.push({ cardId: card.id, count: 1 });
      this.emit('deck_changed', this.activeDeck);
      return { success: true };
    }

    // Normal cards: max 3 copies
    const existing = this.activeDeck.cards.find(c => c.cardId === cardId);
    if (existing) {
      if (existing.count >= 3) {
        return { success: false, reason: `Max 3 copies allowed for ${card.name}.` };
      }
      existing.count += 1;
    } else {
      this.activeDeck.cards.push({ cardId: cardId, count: 1 });
    }

    this.emit('deck_changed', this.activeDeck);
    return { success: true };
  }

  removeCardFromDeck(cardId) {
    const existingIdx = this.activeDeck.cards.findIndex(c => c.cardId === cardId);
    if (existingIdx === -1) return;

    if (this.activeDeck.cards[existingIdx].count > 1) {
      this.activeDeck.cards[existingIdx].count -= 1;
    } else {
      this.activeDeck.cards.splice(existingIdx, 1);
      if (this.activeDeck.leaderId === cardId) {
        this.activeDeck.leaderId = null;
      }
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
    const total = this.getDeckTotalCards();
    const hasLeader = !!this.activeDeck.leaderId;
    const isLegal = total >= 40 && total <= 60 && hasLeader;
    
    let message = '';
    if (!hasLeader) {
      message = 'Deck must have a designated Legend.';
    } else if (total < 40) {
      message = `Need ${40 - total} more card(s) for 40-card minimum.`;
    } else if (total > 60) {
      message = `Deck exceeds 60 card limit by ${total - 60}.`;
    } else {
      message = 'Tournament Legal (40-60 Cards + Legend)';
    }

    return { isLegal, total, message, hasLeader };
  }
}

window.stateStore = new StateStore();
