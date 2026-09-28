/**
 * Cyberpunk TCG - Unified Local Offline Database (WeirdCo Official)
 * Provides robust on-device persistence via IndexedDB (backed by SQLite on Android)
 * with transparent fallbacks and automatic data migration from localStorage.
 */

class AppDatabase {
  constructor() {
    this.dbName = 'CyberpunkTCG_DB';
    this.dbVersion = 1;
    this.db = null;
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Initialize IndexedDB and create object stores
   */
  async init() {
    if (!this.isSupported) {
      console.warn('[AppDB] IndexedDB not available, falling back to localStorage');
      return false;
    }

    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, this.dbVersion);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          
          // 1. Inventory Store (Key: cardId)
          if (!db.objectStoreNames.contains('inventory')) {
            const invStore = db.createObjectStore('inventory', { keyPath: 'cardId' });
            invStore.createIndex('count', 'count', { unique: false });
          }

          // 2. Saved Decks Store (Key: id)
          if (!db.objectStoreNames.contains('decks')) {
            const deckStore = db.createObjectStore('decks', { keyPath: 'id' });
            deckStore.createIndex('name', 'name', { unique: false });
            deckStore.createIndex('faction', 'faction', { unique: false });
          }

          // 3. Card Catalog Store (Key: id)
          if (!db.objectStoreNames.contains('cards')) {
            const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
            cardStore.createIndex('color', 'color', { unique: false });
            cardStore.createIndex('type', 'type', { unique: false });
            cardStore.createIndex('rarity', 'rarity', { unique: false });
            cardStore.createIndex('cost', 'cost', { unique: false });
          }

          // 4. App Settings / Preferences Store (Key: key)
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      });

      console.log('[AppDB] Offline Database initialized successfully.');
      
      // Migrate existing user data from localStorage
      await this.migrateFromLocalStorage();
      return true;
    } catch (err) {
      console.error('[AppDB] Failed to initialize IndexedDB:', err);
      return false;
    }
  }

  /**
   * Migrate existing localStorage records into IndexedDB seamlessly
   */
  async migrateFromLocalStorage() {
    try {
      // 1. Migrate Inventory
      const localInv = localStorage.getItem('cyber_tcg_inventory');
      if (localInv) {
        const parsedInv = JSON.parse(localInv);
        const existingCount = await this.getInventoryRecordCount();
        if (existingCount === 0 && Object.keys(parsedInv).length > 0) {
          console.log('[AppDB] Migrating inventory from localStorage to IndexedDB...');
          await this.saveAllInventory(parsedInv);
        }
      }

      // 2. Migrate Decks
      const localDecks = localStorage.getItem('cyber_tcg_saved_decks');
      if (localDecks) {
        const parsedDecks = JSON.parse(localDecks);
        const existingDecks = await this.getSavedDecks();
        if (existingDecks.length === 0 && Array.isArray(parsedDecks) && parsedDecks.length > 0) {
          console.log('[AppDB] Migrating saved decks from localStorage to IndexedDB...');
          await this.saveAllDecks(parsedDecks);
        }
      }
    } catch (err) {
      console.warn('[AppDB] Non-critical error during migration:', err);
    }
  }

  /**
   * Helper: Get total count of inventory items in DB
   */
  async getInventoryRecordCount() {
    if (!this.db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('inventory', 'readonly');
        const req = tx.objectStore('inventory').count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }

  /**
   * Load entire inventory as { [cardId]: count } map
   */
  async getInventory() {
    if (!this.db) {
      const saved = localStorage.getItem('cyber_tcg_inventory');
      return saved ? JSON.parse(saved) : {};
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('inventory', 'readonly');
        const store = tx.objectStore('inventory');
        const req = store.getAll();

        req.onsuccess = () => {
          const result = {};
          if (Array.isArray(req.result)) {
            req.result.forEach(item => {
              result[item.cardId] = Number(item.count) || 0;
            });
          }
          resolve(result);
        };

        req.onerror = () => {
          const saved = localStorage.getItem('cyber_tcg_inventory');
          resolve(saved ? JSON.parse(saved) : {});
        };
      } catch (e) {
        const saved = localStorage.getItem('cyber_tcg_inventory');
        resolve(saved ? JSON.parse(saved) : {});
      }
    });
  }

  /**
   * Save a single inventory count
   */
  async saveInventoryItem(cardId, count) {
    const val = Math.max(0, Number(count) || 0);
    
    // Always mirror to localStorage for instantaneous sync
    try {
      const local = localStorage.getItem('cyber_tcg_inventory');
      const inv = local ? JSON.parse(local) : {};
      inv[cardId] = val;
      localStorage.setItem('cyber_tcg_inventory', JSON.stringify(inv));
    } catch (e) {}

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('inventory', 'readwrite');
        const store = tx.objectStore('inventory');
        store.put({
          cardId: cardId,
          count: val,
          updatedAt: new Date().toISOString()
        });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Bulk save inventory map
   */
  async saveAllInventory(inventoryMap) {
    // Mirror to localStorage
    try {
      localStorage.setItem('cyber_tcg_inventory', JSON.stringify(inventoryMap));
    } catch (e) {}

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('inventory', 'readwrite');
        const store = tx.objectStore('inventory');
        const now = new Date().toISOString();

        Object.entries(inventoryMap).forEach(([cardId, count]) => {
          store.put({
            cardId,
            count: Math.max(0, Number(count) || 0),
            updatedAt: now
          });
        });

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Get all saved decks
   */
  async getSavedDecks() {
    if (!this.db) {
      const saved = localStorage.getItem('cyber_tcg_saved_decks');
      return saved ? JSON.parse(saved) : [];
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('decks', 'readonly');
        const store = tx.objectStore('decks');
        const req = store.getAll();

        req.onsuccess = () => {
          if (Array.isArray(req.result) && req.result.length > 0) {
            resolve(req.result);
          } else {
            const saved = localStorage.getItem('cyber_tcg_saved_decks');
            resolve(saved ? JSON.parse(saved) : []);
          }
        };

        req.onerror = () => {
          const saved = localStorage.getItem('cyber_tcg_saved_decks');
          resolve(saved ? JSON.parse(saved) : []);
        };
      } catch (e) {
        const saved = localStorage.getItem('cyber_tcg_saved_decks');
        resolve(saved ? JSON.parse(saved) : []);
      }
    });
  }

  /**
   * Save or update a single deck
   */
  async saveDeck(deckObj) {
    if (!deckObj || !deckObj.id) return;
    const cleanDeck = JSON.parse(JSON.stringify(deckObj));
    cleanDeck.updatedAt = new Date().toISOString();

    // Mirror to localStorage
    try {
      const local = localStorage.getItem('cyber_tcg_saved_decks');
      let decks = local ? JSON.parse(local) : [];
      const idx = decks.findIndex(d => d.id === cleanDeck.id);
      if (idx >= 0) decks[idx] = cleanDeck;
      else decks.push(cleanDeck);
      localStorage.setItem('cyber_tcg_saved_decks', JSON.stringify(decks));
    } catch (e) {}

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('decks', 'readwrite');
        tx.objectStore('decks').put(cleanDeck);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Bulk save array of decks
   */
  async saveAllDecks(decksList) {
    if (!Array.isArray(decksList)) return;
    
    // Mirror to localStorage
    try {
      localStorage.setItem('cyber_tcg_saved_decks', JSON.stringify(decksList));
    } catch (e) {}

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('decks', 'readwrite');
        const store = tx.objectStore('decks');
        const now = new Date().toISOString();

        decksList.forEach(deck => {
          const item = JSON.parse(JSON.stringify(deck));
          if (!item.updatedAt) item.updatedAt = now;
          store.put(item);
        });

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Delete a deck by ID
   */
  async deleteDeck(deckId) {
    // Mirror to localStorage
    try {
      const local = localStorage.getItem('cyber_tcg_saved_decks');
      let decks = local ? JSON.parse(local) : [];
      decks = decks.filter(d => d.id !== deckId);
      localStorage.setItem('cyber_tcg_saved_decks', JSON.stringify(decks));
    } catch (e) {}

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('decks', 'readwrite');
        tx.objectStore('decks').delete(deckId);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Cache official card dataset locally
   */
  async cacheCards(cardsList) {
    if (!this.db || !Array.isArray(cardsList) || cardsList.length === 0) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('cards', 'readwrite');
        const store = tx.objectStore('cards');
        cardsList.forEach(card => store.put(card));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Get cached cards from database
   */
  async getCachedCards() {
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('cards', 'readonly');
        const req = tx.objectStore('cards').getAll();
        req.onsuccess = () => resolve(req.result && req.result.length > 0 ? req.result : null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Key-value settings store
   */
  async getSetting(key, defaultValue = null) {
    if (!this.db) {
      const val = localStorage.getItem(`cyber_setting_${key}`);
      return val !== null ? JSON.parse(val) : defaultValue;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
        req.onerror = () => resolve(defaultValue);
      } catch (e) {
        resolve(defaultValue);
      }
    });
  }

  async setSetting(key, value) {
    try {
      localStorage.setItem(`cyber_setting_${key}`, JSON.stringify(value));
    } catch (e) {}

    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key, value, updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
}

// Global Singleton Instance
window.appDB = new AppDatabase();
