/**
 * Cyberpunk TCG - Deck Builder Controller (Official 3-Legend Edition)
 */
class DeckBuilderController {
  constructor() {
    this.poolContainer = null;
    this.deckCardsContainer = null;
    this.deckNameInput = null;
    this.deckStatusBadge = null;
    this.legendsZoneEl = null;

    // Subtab & Deck Cards View Properties
    this.activeSubtab = 'pool'; // 'pool' or 'selected'
    this.deckFilterType = 'all'; // 'all', 'Legend', 'Unit', 'Gear', 'Program'
    this.deckCardsSearch = '';
    this.deckSelectedGrid = null;
    this.subtabBtnPool = null;
    this.subtabBtnSelected = null;
    this.poolPane = null;
    this.selectedPane = null;
    this.deckTabCounter = null;
    this.poolTabCounter = null;
  }

  init() {
    this.poolContainer = document.getElementById('deck-pool-cards');
    this.deckCardsContainer = document.getElementById('deck-cards-list');
    this.deckNameInput = document.getElementById('deck-name-input');
    this.deckStatusBadge = document.getElementById('deck-status-badge');
    this.legendsZoneEl = document.getElementById('deck-legends-zone');

    // Subtab Elements
    this.deckSelectedGrid = document.getElementById('deck-selected-cards-grid');
    this.subtabBtnPool = document.getElementById('subtab-btn-pool');
    this.subtabBtnSelected = document.getElementById('subtab-btn-selected');
    this.poolPane = document.getElementById('deck-pool-subtab-pane');
    this.selectedPane = document.getElementById('deck-selected-subtab-pane');
    this.deckTabCounter = document.getElementById('deck-tab-counter');
    this.poolTabCounter = document.getElementById('pool-tab-counter');

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

    window.stateStore.on('inventory_changed', () => {
      if (this.activeSubtab === 'selected') {
        this.renderDeckSelectedCards();
      }
    });
  }

  setupEvents() {
    if (this.deckNameInput) {
      this.deckNameInput.addEventListener('input', (e) => {
        window.stateStore.activeDeck.name = e.target.value.trim() || 'Untitled Deck';
        window.stateStore.saveCurrentDeck();
      });
    }

    // Subtab Navigation
    if (this.subtabBtnPool) {
      this.subtabBtnPool.addEventListener('click', () => {
        this.switchSubtab('pool');
      });
    }

    if (this.subtabBtnSelected) {
      this.subtabBtnSelected.addEventListener('click', () => {
        this.switchSubtab('selected');
      });
    }

    // Card Pool Search
    const poolSearch = document.getElementById('deck-pool-search');
    if (poolSearch) {
      poolSearch.addEventListener('input', (e) => {
        this.renderDeckPool(e.target.value.toLowerCase().trim());
      });
    }

    // Selected Deck Cards Search
    const selectedSearch = document.getElementById('deck-selected-search');
    if (selectedSearch) {
      selectedSearch.addEventListener('input', (e) => {
        this.deckCardsSearch = e.target.value.toLowerCase().trim();
        this.renderDeckSelectedCards();
      });
    }

    // Selected Deck Cards Filter Pills
    document.querySelectorAll('[data-deck-filter]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('[data-deck-filter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.deckFilterType = pill.getAttribute('data-deck-filter');
        window.cyberAudio.click();
        this.renderDeckSelectedCards();
      });
    });

    // Empty State Buttons
    const emptyPoolBtn = document.getElementById('deck-empty-goto-pool-btn');
    if (emptyPoolBtn) {
      emptyPoolBtn.addEventListener('click', () => {
        this.switchSubtab('pool');
      });
    }

    const emptyStartersBtn = document.getElementById('deck-empty-goto-starters-btn');
    if (emptyStartersBtn) {
      emptyStartersBtn.addEventListener('click', () => {
        if (window.app && window.app.switchTab) {
          window.app.switchTab('starter-decks');
        }
      });
    }

    const saveBtn = document.getElementById('save-deck-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window.cyberAudio.success();
        window.stateStore.saveCurrentDeck();
        window.app.showToast(`Deck "${window.stateStore.activeDeck.name}" saved to cyber core!`);
      });
    }

    const newBtn = document.getElementById('new-deck-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        const name = prompt('Enter Cyber Deck Name:', 'Night City Runner ' + (window.stateStore.savedDecks.length + 1));
        if (name) {
          window.stateStore.createNewDeck(name);
          window.app.showToast(`Initialized new deck: ${name}`);
        }
      });
    }

    const clearBtn = document.getElementById('clear-deck-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all cards and legends from active deck?')) {
          window.cyberAudio.remove();
          window.stateStore.activeDeck.cards = [];
          window.stateStore.activeDeck.legends = [];
          window.stateStore.emit('deck_changed', window.stateStore.activeDeck);
          window.app.showToast('Deck cards & legends cleared', 'warn');
        }
      });
    }
  }

  switchSubtab(subtab) {
    this.activeSubtab = subtab;
    if (window.cyberAudio) window.cyberAudio.click();

    if (subtab === 'pool') {
      if (this.subtabBtnPool) this.subtabBtnPool.classList.add('active');
      if (this.subtabBtnSelected) this.subtabBtnSelected.classList.remove('active');
      if (this.poolPane) {
        this.poolPane.classList.add('active');
        this.poolPane.style.display = 'flex';
      }
      if (this.selectedPane) {
        this.selectedPane.classList.remove('active');
        this.selectedPane.style.display = 'none';
      }
    } else {
      if (this.subtabBtnSelected) this.subtabBtnSelected.classList.add('active');
      if (this.subtabBtnPool) this.subtabBtnPool.classList.remove('active');
      if (this.poolPane) {
        this.poolPane.classList.remove('active');
        this.poolPane.style.display = 'none';
      }
      if (this.selectedPane) {
        this.selectedPane.classList.add('active');
        this.selectedPane.style.display = 'flex';
      }
      this.renderDeckSelectedCards();
    }
  }

  renderDeckPool(searchQuery = '') {
    if (!this.poolContainer) return;
    this.poolContainer.innerHTML = '';

    const cards = window.stateStore.cards.filter(card => {
      if (!searchQuery) return true;
      return (card.name || '').toLowerCase().includes(searchQuery) ||
             (card.color || '').toLowerCase().includes(searchQuery) ||
             (card.type || '').toLowerCase().includes(searchQuery);
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

    // 1. Validation Status Badge
    const validation = window.stateStore.validateDeck();
    if (this.deckStatusBadge) {
      this.deckStatusBadge.className = `deck-status-badge ${validation.isLegal ? 'legal' : 'illegal'}`;
      this.deckStatusBadge.innerHTML = `
        <span>${validation.isLegal ? '✓' : '⚠️'}</span>
        <span>${validation.legendsCount}/3 LEGENDS • ${validation.total}/40–50 CARDS • ${validation.isLegal ? 'LEGAL' : validation.message}</span>
      `;
    }

    const countBadge = document.getElementById('deck-cards-count-badge');
    const isCountLegal = validation.total >= 40 && validation.total <= 50;
    const isOverflow = validation.total > 50;

    if (countBadge) {
      countBadge.className = `deck-cards-count-badge ${isCountLegal ? 'legal' : isOverflow ? 'overflow' : 'incomplete'}`;
      countBadge.textContent = `${validation.total} / 40–50 Cards`;
    }

    const mobileBarName = document.getElementById('mobile-deck-bar-name');
    if (mobileBarName) {
      mobileBarName.textContent = deck.name || 'Untitled Deck';
    }

    const mobileBarCount = document.getElementById('mobile-deck-bar-count');
    if (mobileBarCount) {
      mobileBarCount.className = `mobile-deck-bar-count ${validation.isLegal ? 'legal' : isOverflow ? 'overflow' : 'incomplete'}`;
      mobileBarCount.textContent = `${validation.legendsCount}/3 Legends • ${validation.total}/40–50 Cards ${validation.isLegal ? '✓' : ''}`;
    }

    // Update Subtab Badges
    const totalMainCards = validation.total;
    const totalLegends = validation.legendsCount;
    if (this.deckTabCounter) {
      this.deckTabCounter.textContent = totalLegends > 0 ? `${totalMainCards} (+${totalLegends}L)` : `${totalMainCards}`;
    }
    if (this.poolTabCounter && window.stateStore.cards) {
      this.poolTabCounter.textContent = `${window.stateStore.cards.length}`;
    }

    // Keep Selected Deck Cards view updated if currently visible
    if (this.activeSubtab === 'selected') {
      this.renderDeckSelectedCards();
    }

    // 2. 3-Legend Zone Display
    if (this.legendsZoneEl) {
      const legends = deck.legends || [];
      const ramPool = window.stateStore.getDeckCumulativeRAM();
      
      let ramSummary = Object.entries(ramPool)
        .filter(([_, val]) => val > 0)
        .map(([col, val]) => `<span style="font-weight: bold; color: var(--neon-${col === 'Red' ? 'magenta' : col === 'Yellow' ? 'yellow' : col === 'Green' ? 'green' : 'cyan'});">${col}: ${val} RAM</span>`)
        .join(' • ');
      if (!ramSummary) ramSummary = '<span style="color: var(--text-dim);">No RAM generated (3 Legends required)</span>';

      let slotsHtml = '';
      for (let i = 0; i < 3; i++) {
        const legId = legends[i];
        if (legId) {
          const legCard = window.stateStore.getCardById(legId);
          const colName = legCard ? legCard.color : 'Neutral';
          const colColor = legCard ? `var(--neon-${colName === 'Red' ? 'magenta' : colName === 'Yellow' ? 'yellow' : colName === 'Green' ? 'green' : 'cyan'})` : '#fff';
          const cardName = legCard ? legCard.name : legId;
          const imgSrc = legCard ? (legCard.image_local || `assets/cards/${legId}.webp`) : `assets/cards/${legId}.webp`;
          const ramVal = legCard ? (legCard.ram || 0) : 0;
          const costVal = legCard ? (legCard.cost || 0) : 0;
          const powerVal = legCard && legCard.power !== undefined && legCard.power !== null ? legCard.power : null;

          slotsHtml += `
            <div class="legend-slot-item active" style="border-left-color: ${colColor};" title="Double click to inspect ${cardName}">
              <span class="legend-slot-badge" style="background: ${colColor};">L${i + 1}</span>
              <div class="legend-thumb-wrap">
                <img src="${imgSrc}" class="legend-slot-thumb" alt="${cardName}" onerror="this.onerror=null; this.src='../${imgSrc}';">
              </div>
              <div class="legend-slot-details">
                <div class="legend-slot-title" title="${cardName}">${cardName}</div>
                <div class="legend-slot-meta">
                  <span class="legend-meta-color" style="color: ${colColor}; font-weight: 700;">${colName}</span>
                  <span class="legend-meta-dot">•</span>
                  <span class="legend-meta-stat">€$ ${costVal}</span>
                  ${powerVal !== null ? `<span class="legend-meta-dot">•</span><span class="legend-meta-stat">⚔️ ${powerVal}</span>` : ''}
                </div>
              </div>
              <div class="legend-slot-ram-badge" style="border-color: ${colColor}; color: ${colColor};">
                💾 +${ramVal}
              </div>
              <button class="legend-slot-remove-btn" data-remove-legend="${legId}" title="Remove ${cardName}">×</button>
            </div>
          `;
        } else {
          slotsHtml += `
            <div class="legend-slot-item empty" data-slot="${i + 1}" title="Click to filter card pool for Legends">
              <span class="legend-slot-badge empty">L${i + 1}</span>
              <div class="legend-empty-info">
                <div class="legend-empty-title">LEGEND SLOT ${i + 1} • EMPTY</div>
                <div class="legend-empty-sub">Click "+ Deck" on any Legend in pool to assign</div>
              </div>
              <span class="legend-empty-icon">👑</span>
            </div>
          `;
        }
      }

      this.legendsZoneEl.innerHTML = `
        <div class="legend-zone-header">
          <div class="legend-zone-title-wrap">
            <span class="legend-zone-title">👑 3-LEGEND IDENTITY ZONE</span>
            <span class="legend-zone-count-badge ${legends.length === 3 ? 'complete' : 'incomplete'}">${legends.length}/3 SELECTED</span>
          </div>
          <div class="legend-zone-ram-summary">${ramSummary}</div>
        </div>
        <div class="legend-slots-container">
          ${slotsHtml}
        </div>
      `;

      // Attach remove handlers
      this.legendsZoneEl.querySelectorAll('[data-remove-legend]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-remove-legend');
          window.cyberAudio.remove();
          window.stateStore.removeLegendFromDeck(id);
        });
      });

      // Attach click to inspect active legend
      this.legendsZoneEl.querySelectorAll('.legend-slot-item.active').forEach(slot => {
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', () => {
          const id = slot.querySelector('[data-remove-legend]')?.getAttribute('data-remove-legend');
          if (id) {
            const legCard = window.stateStore.getCardById(id);
            if (legCard && window.app && window.app.openInspectModal) {
              window.cyberAudio.click();
              window.app.openInspectModal(legCard);
            }
          }
        });
      });

      // Attach empty slot click handlers to filter pool by Legend
      this.legendsZoneEl.querySelectorAll('.legend-slot-item.empty').forEach(emptySlot => {
        emptySlot.addEventListener('click', () => {
          window.cyberAudio.click();
          const poolSearch = document.getElementById('deck-pool-search');
          if (poolSearch) {
            poolSearch.value = 'Legend';
            this.renderDeckPool('legend');
            if (window.app && window.app.showToast) {
              window.app.showToast('Filtered pool to Legends. Click "+ Deck" to add!');
            }
          }
        });
      });
    }

    // 3. Main Deck Cards list
    if (this.deckCardsContainer) {
      this.deckCardsContainer.innerHTML = '';

      if (deck.cards.length === 0) {
        this.deckCardsContainer.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--text-dim); font-family: var(--font-mono);">
            Main deck is empty. Click "+ Deck" on non-Legend cards (Units, Programs, Gear) to add them (40–50 required).
          </div>
        `;
        return;
      }

      // Sort deck cards by Cost, then Name
      const sortedItems = [...deck.cards].sort((a, b) => {
        const cardA = window.stateStore.getCardById(a.cardId);
        const cardB = window.stateStore.getCardById(b.cardId);
        if (!cardA || !cardB) return 0;
        return (cardA.cost || 0) - (cardB.cost || 0) || cardA.name.localeCompare(cardB.name);
      });

      sortedItems.forEach(item => {
        const card = window.stateStore.getCardById(item.cardId);
        if (!card) return;

        const row = document.createElement('div');
        row.className = 'deck-card-row';

        const colorHex = card.color === 'Red' ? 'var(--neon-magenta)' 
                       : card.color === 'Yellow' ? 'var(--neon-yellow)' 
                       : card.color === 'Green' ? 'var(--neon-green)' 
                       : 'var(--neon-cyan)';

        row.innerHTML = `
          <div class="deck-card-main">
            <div class="deck-card-cost">€$ ${card.cost !== null ? card.cost : '-'}</div>
            <div class="deck-card-name" style="border-left: 3px solid ${colorHex}; padding-left: 6px;">
              ${card.name} <span style="font-size: 0.7rem; color: var(--text-dim);">(${card.type})</span>
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

        const cardMainEl = row.querySelector('.deck-card-main');
        if (cardMainEl) {
          cardMainEl.style.cursor = 'pointer';
          cardMainEl.title = `Click to inspect ${card.name}`;
          cardMainEl.addEventListener('click', () => {
            if (window.app && window.app.openInspectModal) {
              window.cyberAudio.click();
              window.app.openInspectModal(card);
            }
          });
        }

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
            window.stateStore.emit('deck_changed', deck);
          }
        });

        this.deckCardsContainer.appendChild(row);
      });
    }

    // 4. Mini Eddie Cost Curve
    this.renderMiniCurve();
  }

  renderMiniCurve() {
    const barsContainer = document.getElementById('deck-curve-bars');
    if (!barsContainer) return;

    const deck = window.stateStore.activeDeck;
    const costBuckets = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6+

    deck.cards.forEach(item => {
      const card = window.stateStore.getCardById(item.cardId);
      if (card && card.cost !== null && card.cost !== undefined) {
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
          <span class="curve-cost-label">€$ ${label}</span>
        </div>
      `;
    }).join('');
  }

  renderDeckSelectedCards() {
    if (!this.deckSelectedGrid) return;
    const deck = window.stateStore.activeDeck;
    if (!deck) return;

    const legends = deck.legends || [];
    const mainCards = deck.cards || [];

    const totalMainCards = mainCards.reduce((sum, c) => sum + c.count, 0);
    const totalLegends = legends.length;
    const totalAll = totalMainCards + totalLegends;

    // Count breakdown by type
    let unitsCount = 0;
    let gearsCount = 0;
    let programsCount = 0;

    mainCards.forEach(item => {
      const card = window.stateStore.getCardById(item.cardId);
      if (card) {
        if (card.type === 'Unit') unitsCount += item.count;
        else if (card.type === 'Gear') gearsCount += item.count;
        else if (card.type === 'Program') programsCount += item.count;
      }
    });

    // Update filter pill counts
    const countAllEl = document.getElementById('deck-filter-count-all');
    if (countAllEl) countAllEl.textContent = totalAll;
    const countLegEl = document.getElementById('deck-filter-count-legends');
    if (countLegEl) countLegEl.textContent = totalLegends;
    const countUnitsEl = document.getElementById('deck-filter-count-units');
    if (countUnitsEl) countUnitsEl.textContent = unitsCount;
    const countGearsEl = document.getElementById('deck-filter-count-gears');
    if (countGearsEl) countGearsEl.textContent = gearsCount;
    const countProgsEl = document.getElementById('deck-filter-count-programs');
    if (countProgsEl) countProgsEl.textContent = programsCount;

    // Update Deck title and count tag
    const titleEl = document.getElementById('deck-selected-title');
    if (titleEl) {
      titleEl.textContent = `CARDS IN DECK: ${deck.name || 'Untitled Deck'}`;
    }

    const countTagEl = document.getElementById('deck-selected-count-tag');
    if (countTagEl) {
      const isLegal = totalMainCards >= 40 && totalMainCards <= 50;
      const isOverflow = totalMainCards > 50;
      countTagEl.className = `deck-selected-count-tag ${isLegal ? 'legal' : isOverflow ? 'overflow' : 'incomplete'}`;
      countTagEl.textContent = `${totalMainCards} / 40–50 Cards (${totalLegends}/3 Legends)`;
    }

    // Empty deck state check
    const emptyEl = document.getElementById('deck-selected-empty');
    if (totalAll === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      this.deckSelectedGrid.style.display = 'none';
      this.deckSelectedGrid.innerHTML = '';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    this.deckSelectedGrid.style.display = 'grid';
    this.deckSelectedGrid.innerHTML = '';

    const query = (this.deckCardsSearch || '').toLowerCase().trim();

    // Compile items to render based on active filter
    const itemsToRender = [];

    // 1. Legends
    if (this.deckFilterType === 'all' || this.deckFilterType === 'Legend') {
      legends.forEach((legId, idx) => {
        const card = window.stateStore.getCardById(legId);
        if (!card) return;
        if (query) {
          const match = (card.name || '').toLowerCase().includes(query) ||
                        (card.color || '').toLowerCase().includes(query) ||
                        (card.type || '').toLowerCase().includes(query);
          if (!match) return;
        }
        itemsToRender.push({
          card,
          count: 1,
          isLegend: true,
          slotIndex: idx + 1
        });
      });
    }

    // 2. Main Deck Cards
    if (this.deckFilterType !== 'Legend') {
      // Sort main cards by cost, then by name
      const sortedCards = [...mainCards].sort((a, b) => {
        const cardA = window.stateStore.getCardById(a.cardId);
        const cardB = window.stateStore.getCardById(b.cardId);
        if (!cardA || !cardB) return 0;
        return (cardA.cost || 0) - (cardB.cost || 0) || cardA.name.localeCompare(cardB.name);
      });

      sortedCards.forEach(item => {
        const card = window.stateStore.getCardById(item.cardId);
        if (!card) return;
        if (this.deckFilterType !== 'all' && card.type !== this.deckFilterType) return;
        if (query) {
          const match = (card.name || '').toLowerCase().includes(query) ||
                        (card.color || '').toLowerCase().includes(query) ||
                        (card.type || '').toLowerCase().includes(query);
          if (!match) return;
        }
        itemsToRender.push({
          card,
          count: item.count,
          isLegend: false
        });
      });
    }

    // If query returned 0 items
    if (itemsToRender.length === 0) {
      this.deckSelectedGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim); font-family: var(--font-mono);">
          No cards in active deck match your current filter or search "${this.deckCardsSearch}".
        </div>
      `;
      return;
    }

    // Render cards
    itemsToRender.forEach(item => {
      const { card, count, isLegend, slotIndex } = item;

      // Render the visual card without default inventory action bar
      const cardWrapper = window.cardRenderer.renderCard(card, {
        compact: true,
        showActions: false
      });

      const owned = window.stateStore.inventory[card.id] || 0;

      // Custom Deck Action Footer
      const footer = document.createElement('div');
      footer.className = 'deck-view-card-footer';

      if (isLegend) {
        footer.innerHTML = `
          <div class="deck-view-legend-badge">
            <span>👑 LEGEND • SLOT L${slotIndex}</span>
            <span>💾 +${card.ram || 0} RAM</span>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 2px;">
            <button class="cyber-btn cyber-btn-sm" style="flex: 1; font-size: 0.7rem; border-color: var(--neon-magenta); color: var(--neon-magenta); padding: 5px;" data-action="remove-legend" title="Remove this Legend from Identity Zone">
              ✕ REMOVE LEGEND
            </button>
          </div>
        `;

        footer.querySelector('[data-action="remove-legend"]').addEventListener('click', (e) => {
          e.stopPropagation();
          window.cyberAudio.remove();
          window.stateStore.removeLegendFromDeck(card.id);
        });
      } else {
        const isSufficient = owned >= count;
        footer.innerHTML = `
          <div class="deck-view-qty-row">
            <div class="deck-view-qty-controls">
              <button class="deck-view-btn deck-view-btn-dec" data-action="dec" title="Remove 1 copy from deck">−</button>
              <div class="deck-view-count-badge" title="${count} copies of ${card.name} in deck">
                ${count}x IN DECK
              </div>
              <button class="deck-view-btn deck-view-btn-inc" data-action="inc" title="Add 1 copy to deck">＋</button>
            </div>
            <button class="deck-view-btn deck-view-btn-delete" data-action="delete" title="Remove all copies from deck">🗑️</button>
          </div>
          <div class="deck-view-inv-status ${isSufficient ? 'ok' : 'shortage'}">
            <span>${isSufficient ? `✓ Owned: ${owned} in inventory` : `⚠️ Shortage: Need ${count - owned} (Have ${owned})`}</span>
          </div>
        `;

        footer.querySelector('[data-action="dec"]').addEventListener('click', (e) => {
          e.stopPropagation();
          window.cyberAudio.remove();
          window.stateStore.removeCardFromDeck(card.id);
        });

        footer.querySelector('[data-action="inc"]').addEventListener('click', (e) => {
          e.stopPropagation();
          const res = window.stateStore.addCardToDeck(card.id);
          if (res && res.success) {
            window.cyberAudio.add();
          } else if (res && res.reason) {
            window.cyberAudio.playTone(200, 'sawtooth', 0.15, 0.05);
            window.app.showToast(res.reason, 'warn');
          }
        });

        footer.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
          e.stopPropagation();
          window.cyberAudio.remove();
          const idx = deck.cards.findIndex(c => c.cardId === card.id);
          if (idx !== -1) {
            deck.cards.splice(idx, 1);
            window.stateStore.emit('deck_changed', deck);
          }
        });
      }

      cardWrapper.appendChild(footer);
      this.deckSelectedGrid.appendChild(cardWrapper);
    });
  }
}

window.deckBuilderController = new DeckBuilderController();
