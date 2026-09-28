/**
 * Cyberpunk TCG - Official Analytics & Deck Metrics Controller
 */
class AnalyticsController {
  init() {
    this.update();
  }

  update() {
    const deck = window.stateStore.activeDeck;
    if (!deck) return;

    let totalCards = 0;
    let totalCost = 0;
    let costCount = 0;

    const typeCounts = {
      Legend: 0,
      Unit: 0,
      Program: 0,
      Gear: 0
    };
    const colorCounts = {};

    deck.cards.forEach(item => {
      const card = window.stateStore.getCardById(item.cardId);
      if (card) {
        totalCards += item.count;
        if (card.cost !== null && card.cost !== undefined) {
          totalCost += card.cost * item.count;
          costCount += item.count;
        }

        const t = card.type || 'Unit';
        typeCounts[t] = (typeCounts[t] || 0) + item.count;

        const col = card.color || card.faction || 'Neutral';
        colorCounts[col] = (colorCounts[col] || 0) + item.count;
      }
    });

    const avgCost = costCount > 0 ? (totalCost / costCount).toFixed(1) : '0.0';

    // Update Stat Cards
    const totalEl = document.getElementById('stat-total-cards');
    if (totalEl) totalEl.textContent = `${totalCards} / 40–50`;

    const avgEl = document.getElementById('stat-avg-cost');
    if (avgEl) avgEl.textContent = `€$ ${avgCost}`;

    const legends = deck.legends || [];
    const ramPool = window.stateStore.getDeckCumulativeRAM();
    const leaderEl = document.getElementById('stat-leader-name');
    if (leaderEl) {
      if (legends.length > 0) {
        const names = legends.map(id => {
          const c = window.stateStore.getCardById(id);
          return c ? c.card_title || c.name : id;
        }).join(', ');
        leaderEl.textContent = `${legends.length}/3 Legends (${names})`;
      } else {
        leaderEl.textContent = '0/3 Legends Assigned';
      }
    }

    // Type Breakdown Cards
    const typeBreakdownEl = document.getElementById('analytics-type-breakdown');
    if (typeBreakdownEl) {
      typeBreakdownEl.innerHTML = Object.entries(typeCounts).map(([type, count]) => {
        const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
        const sub = type === 'Legend' ? 'Identity & RAM anchor' 
                  : type === 'Unit' ? 'Combatants on the field' 
                  : type === 'Program' ? 'Cyber actions & quickhacks' 
                  : 'Weapons & cyberware gear';
        return `
          <div class="stat-card">
            <div class="stat-card-title">${type} Cards</div>
            <div class="stat-card-value">${count} <span style="font-size: 1rem; color: var(--neon-cyan);">${pct}%</span></div>
            <div class="stat-card-sub">${sub}</div>
          </div>
        `;
      }).join('');
    }

    // Color Breakdown Bars
    const factionListEl = document.getElementById('analytics-faction-list');
    if (factionListEl) {
      const allColors = ['Red', 'Yellow', 'Green', 'Blue'];
      const colorHexes = {
        Red: '#ff003c',
        Yellow: '#fcee0a',
        Green: '#00ff66',
        Blue: '#00f0ff'
      };

      factionListEl.innerHTML = allColors.map(color => {
        const count = colorCounts[color] || 0;
        const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
        const hex = colorHexes[color] || '#8892b0';

        return `
          <div class="faction-bar-item">
            <div class="faction-bar-label">
              <span style="color: ${hex}; font-weight: bold;">${color}</span>
              <span>${count} cards (${pct}%)</span>
            </div>
            <div class="faction-bar-track">
              <div class="faction-bar-fill" style="width: ${pct}%; background: ${hex};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

window.analyticsController = new AnalyticsController();
