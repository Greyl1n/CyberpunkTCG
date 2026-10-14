/**
 * Cyberpunk TCG - Official Inventory & Catalog Controller
 */
class InventoryController {
  constructor() {
    this.container = null;
    this.searchInput = null;
  }

  init(containerEl) {
    this.container = containerEl;
    this.setupFiltersUI();
    this.setupBulkActions();
    this.render();

    window.stateStore.on('cards_loaded', () => {
      this.updateDashboardStats();
      this.render();
    });
    window.stateStore.on('filters_changed', () => this.render());
    window.stateStore.on('inventory_changed', () => {
      this.updateDashboardStats();
      this.updateInventoryBadges();
      if (window.stateStore.filters.collectionFilter && window.stateStore.filters.collectionFilter !== 'all') {
        this.render();
      }
    });
  }

  setupFiltersUI() {
    this.searchInput = document.getElementById('inventory-search');
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        window.stateStore.filters.search = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Sort dropdown (Card #, Name, Cost, Owned...)
    const sortSelect = document.getElementById('inventory-sort');
    if (sortSelect) {
      sortSelect.value = window.stateStore.filters.sortBy || 'number';
      sortSelect.addEventListener('change', (e) => {
        window.stateStore.filters.sortBy = e.target.value;
        try { localStorage.setItem('cyber_tcg_inventory_sort', e.target.value); } catch (err) {}
        if (window.cyberAudio) window.cyberAudio.click();
        this.render();
      });
    }

    // Collection Status Pills (All, In Inventory, Missing, Incomplete)
    const collectionPills = document.querySelectorAll('.filter-pill[data-collection]');
    collectionPills.forEach(pill => {
      pill.addEventListener('click', () => {
        window.cyberAudio.click();
        const col = pill.getAttribute('data-collection');
        window.stateStore.filters.collectionFilter = col;
        collectionPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.render();
      });
    });

    // Color Pills (Red, Yellow, Green, Blue)
    const colorPills = document.querySelectorAll('.filter-pill[data-color]');
    colorPills.forEach(pill => {
      pill.addEventListener('click', () => {
        window.cyberAudio.click();
        const c = pill.getAttribute('data-color');
        if (window.stateStore.filters.factions.has(c)) {
          window.stateStore.filters.factions.delete(c);
          pill.classList.remove('active');
        } else {
          window.stateStore.filters.factions.add(c);
          pill.classList.add('active');
        }
        this.render();
      });
    });

    // Card Type Pills (Legend, Unit, Program, Gear)
    const typePills = document.querySelectorAll('.filter-pill[data-type]');
    typePills.forEach(pill => {
      pill.addEventListener('click', () => {
        window.cyberAudio.click();
        const t = pill.getAttribute('data-type');
        if (window.stateStore.filters.types.has(t)) {
          window.stateStore.filters.types.delete(t);
          pill.classList.remove('active');
        } else {
          window.stateStore.filters.types.add(t);
          pill.classList.add('active');
        }
        this.render();
      });
    });

    // Rarity Pills
    const rarityPills = document.querySelectorAll('.filter-pill[data-rarity]');
    rarityPills.forEach(pill => {
      pill.addEventListener('click', () => {
        window.cyberAudio.click();
        const r = pill.getAttribute('data-rarity');
        if (window.stateStore.filters.rarities.has(r)) {
          window.stateStore.filters.rarities.delete(r);
          pill.classList.remove('active');
        } else {
          window.stateStore.filters.rarities.add(r);
          pill.classList.add('active');
        }
        this.render();
      });
    });

    // Reset Filters button
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        window.stateStore.filters.search = '';
        window.stateStore.filters.collectionFilter = 'all';
        window.stateStore.filters.factions.clear();
        window.stateStore.filters.types.clear();
        window.stateStore.filters.rarities.clear();
        if (this.searchInput) this.searchInput.value = '';
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        const allColl = document.querySelector('.filter-pill[data-collection="all"]');
        if (allColl) allColl.classList.add('active');
        this.render();
      });
    }
  }

  setupBulkActions() {
    const playsetBtn = document.getElementById('bulk-playset-btn');
    if (playsetBtn) {
      playsetBtn.addEventListener('click', () => {
        if (confirm('Set personal inventory of ALL cards to 3 copies (Full Playset)?')) {
          window.stateStore.bulkSetInventory(3);
          window.cyberAudio.success();
          if (window.app && window.app.showToast) {
            window.app.showToast('Inventory updated: 3x copies for all cards');
          }
        }
      });
    }

    const singletonBtn = document.getElementById('bulk-singleton-btn');
    if (singletonBtn) {
      singletonBtn.addEventListener('click', () => {
        if (confirm('Set personal inventory of ALL cards to 1 copy?')) {
          window.stateStore.bulkSetInventory(1);
          window.cyberAudio.success();
          if (window.app && window.app.showToast) {
            window.app.showToast('Inventory updated: 1x copy for all cards');
          }
        }
      });
    }

    const scanBtn = document.getElementById('inv-toolbar-scan-btn');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        if (window.cardScanner) {
          window.cyberAudio.click();
          window.cardScanner.open();
        }
      });
    }

    const clearBtn = document.getElementById('bulk-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Reset personal inventory to 0 cards? You can then add only cards you physically own.')) {
          window.stateStore.bulkSetInventory(0);
          window.cyberAudio.remove();
          if (window.app && window.app.showToast) {
            window.app.showToast('Inventory reset to 0 cards', 'warn');
          }
        }
      });
    }
  }

  updateDashboardStats() {
    const totalEl = document.getElementById('inv-total-cards');
    const uniqueEl = document.getElementById('inv-unique-cards');
    const playsetEl = document.getElementById('inv-playset-cards');
    const pctEl = document.getElementById('inv-completion-pct');

    if (!window.stateStore || !window.stateStore.cards) return;

    const totalCards = window.stateStore.getTotalInventoryCount();
    const uniqueCount = window.stateStore.getUniqueOwnedCount();
    const playsetCount = window.stateStore.getPlaysetCount();
    const totalOfficial = window.stateStore.cards.length || 151;
    const pct = totalOfficial > 0 ? Math.round((uniqueCount / totalOfficial) * 100) : 0;

    if (totalEl) totalEl.textContent = `${totalCards.toLocaleString()} Cards`;
    if (uniqueEl) uniqueEl.textContent = `${uniqueCount} / ${totalOfficial}`;
    if (playsetEl) playsetEl.textContent = `${playsetCount} / ${totalOfficial}`;
    if (pctEl) pctEl.textContent = `${pct}%`;
  }

  getFilteredCards() {
    const { cards, filters, inventory } = window.stateStore;
    return cards.filter(card => {
      // Collection status filter
      const count = inventory[card.id] || 0;
      if (filters.collectionFilter === 'owned' && count === 0) {
        return false;
      }
      if (filters.collectionFilter === 'missing' && count > 0) {
        return false;
      }
      if (filters.collectionFilter === 'incomplete' && count >= 3) {
        return false;
      }

      // Search text
      if (filters.search) {
        const q = filters.search;
        const matchName = (card.name || '').toLowerCase().includes(q);
        const matchSub = (card.subname || '').toLowerCase().includes(q);
        const matchAbility = (card.ability || '').toLowerCase().includes(q);
        const matchNum = (card.print_number || '').toLowerCase().includes(q);
        const matchKeywords = (card.keywords || []).some(k => k.toLowerCase().includes(q));
        if (!matchName && !matchSub && !matchAbility && !matchKeywords && !matchNum) {
          return false;
        }
      }

      // Color / Faction filter
      if (filters.factions.size > 0 && !filters.factions.has(card.color) && !filters.factions.has(card.faction)) {
        return false;
      }

      // Card Type filter
      if (filters.types.size > 0 && !filters.types.has(card.type)) {
        return false;
      }

      // Rarity filter
      if (filters.rarities.size > 0 && !filters.rarities.has(card.rarity)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Rank a set so the main retail set comes first, starter decks next, promos last.
   */
  static setRank(card) {
    const code = (card.set_code || '').toLowerCase();
    if (!code) return 1;
    if (code.startsWith('prm') || code.includes('promo')) return 3;
    if (code.includes('starter')) return 2;
    return 0;
  }

  /**
   * Parse a collector print number such as "005a" into { num: 5, suffix: "a" }.
   */
  static parsePrintNumber(pn) {
    const m = String(pn || '').trim().match(/^(\d+)\s*([a-z]*)/i);
    if (!m) return { num: Number.MAX_SAFE_INTEGER, suffix: String(pn || '') };
    return { num: parseInt(m[1], 10), suffix: m[2].toLowerCase() };
  }

  static compareByNumber(a, b) {
    const ra = InventoryController.setRank(a);
    const rb = InventoryController.setRank(b);
    if (ra !== rb) return ra - rb;
    const sa = (a.set_code || '');
    const sb = (b.set_code || '');
    if (sa !== sb) return sa.localeCompare(sb);
    const pa = InventoryController.parsePrintNumber(a.print_number);
    const pb = InventoryController.parsePrintNumber(b.print_number);
    if (pa.num !== pb.num) return pa.num - pb.num;
    if (pa.suffix !== pb.suffix) return pa.suffix.localeCompare(pb.suffix);
    return (a.name || '').localeCompare(b.name || '');
  }

  sortCards(cards) {
    const mode = window.stateStore.filters.sortBy || 'number';
    const inv = window.stateStore.inventory || {};
    const list = cards.slice();
    const byNum = InventoryController.compareByNumber;
    switch (mode) {
      case 'number':
        list.sort(byNum);
        break;
      case 'number-desc':
        list.sort((a, b) => byNum(b, a));
        break;
      case 'name':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '') || byNum(a, b));
        break;
      case 'cost':
        list.sort((a, b) => ((Number(a.cost) || 0) - (Number(b.cost) || 0)) || byNum(a, b));
        break;
      case 'owned':
        list.sort((a, b) => ((inv[b.id] || 0) - (inv[a.id] || 0)) || byNum(a, b));
        break;
      default:
        break; // database order
    }
    return list;
  }

  render() {
    this.updateDashboardStats();

    if (!this.container) return;
    this.container.innerHTML = '';

    const filtered = this.sortCards(this.getFilteredCards());
    const countEl = document.getElementById('inventory-count-display');
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${window.stateStore.cards.length} Cards`;
    }

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--text-dim); font-family: var(--font-mono);">
          <div style="font-size: 2.5rem; margin-bottom: 10px;">⚠️</div>
          <div style="font-size: 1.1rem; color: var(--neon-cyan);">NO CARDS MATCHING FILTER CRITERIA</div>
          <p style="margin-top: 8px;">Try clearing filters or switching Collection view.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(card => {
      const cardEl = window.cardRenderer.renderCard(card, {
        showActions: true
      });
      this.container.appendChild(cardEl);
    });
  }

  updateInventoryBadges() {
    const cards = document.querySelectorAll('.cyber-card-wrapper[data-card-id]');
    cards.forEach(wrapper => {
      const cardId = wrapper.getAttribute('data-card-id');
      if (!cardId) return;
      const count = window.stateStore.inventory[cardId] || 0;
      wrapper.classList.toggle('is-unowned', count === 0);

      const qtyInput = wrapper.querySelector('.qty-input');
      if (qtyInput && document.activeElement !== qtyInput) {
        qtyInput.value = count;
      }
      const qtyVal = wrapper.querySelector('.qty-val');
      if (qtyVal) {
        qtyVal.textContent = `${count}`;
      }
    });
  }
}

window.inventoryController = new InventoryController();
