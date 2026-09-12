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
    this.render();

    window.stateStore.on('cards_loaded', () => this.render());
    window.stateStore.on('filters_changed', () => this.render());
    window.stateStore.on('inventory_changed', () => this.updateInventoryBadges());
  }

  setupFiltersUI() {
    this.searchInput = document.getElementById('inventory-search');
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        window.stateStore.filters.search = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

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
        window.stateStore.filters.factions.clear();
        window.stateStore.filters.types.clear();
        window.stateStore.filters.rarities.clear();
        if (this.searchInput) this.searchInput.value = '';
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        this.render();
      });
    }
  }

  getFilteredCards() {
    const { cards, filters } = window.stateStore;
    return cards.filter(card => {
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

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const filtered = this.getFilteredCards();
    const countEl = document.getElementById('inventory-count-display');
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${window.stateStore.cards.length} Official WeirdCo Cards`;
    }

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--text-dim); font-family: var(--font-mono);">
          <div style="font-size: 2.5rem; margin-bottom: 10px;">⚠️</div>
          <div style="font-size: 1.1rem; color: var(--neon-cyan);">NO OFFICIAL CARDS MATCHING FILTER CRITERIA</div>
          <p style="margin-top: 8px;">Try clearing filters or search query.</p>
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
      const qtyVal = wrapper.querySelector('.qty-val');
      if (qtyVal && cardId) {
        const count = window.stateStore.inventory[cardId] || 0;
        qtyVal.textContent = `x${count}`;
      }
    });
  }
}

window.inventoryController = new InventoryController();
