/**
 * Cyberpunk TCG - Official Card Renderer
 * Renders high-resolution official WeirdCo card artwork, HUD chips, 3D tilt, and holographic foil.
 */
class CardRenderer {
  renderCard(card, options = {}) {
    const {
      showActions = true,
      compact = false
    } = options;

    const wrapper = document.createElement('div');
    wrapper.className = 'cyber-card-wrapper';
    wrapper.setAttribute('data-card-id', card.id);

    const rarityClass = `rarity-${(card.rarity || 'common').toLowerCase().replace(/\s+/g, '-')}`;
    const colorClass = `color-${(card.color || card.faction || 'neutral').toLowerCase()}`;

    const cardEl = document.createElement('div');
    cardEl.className = `cyber-card ${rarityClass} ${compact ? 'compact' : ''}`;

    // 1. Holographic Foil Layer
    const holoGlare = document.createElement('div');
    holoGlare.className = 'holo-glare';
    cardEl.appendChild(holoGlare);

    // 2. Official High-Resolution Card Artwork Layer
    const artContainer = document.createElement('div');
    artContainer.className = 'card-art-image-container';

    const cardImg = document.createElement('img');
    cardImg.className = 'card-art-img';
    cardImg.loading = 'lazy';
    cardImg.alt = card.name;

    // Multi-tier offline / relative / CDN fallback
    const localRel = card.image_local || `assets/cards/${card.id}.webp`;
    let triedParent = false;

    cardImg.onerror = () => {
      if (!triedParent) {
        triedParent = true;
        cardImg.src = `../${localRel}`;
      } else if (card.image_url && cardImg.src !== card.image_url) {
        cardImg.src = card.image_url;
      }
    };

    cardImg.src = localRel;

    artContainer.appendChild(cardImg);
    cardEl.appendChild(artContainer);

    // 3. Official HUD Overlay (Eddies, RAM, Power, Sell Tag)
    const hud = document.createElement('div');
    hud.className = 'card-art-hud-overlay';

    const eddieBadge = card.cost !== null && card.cost !== undefined
      ? `<span class="hud-badge eddie-cost" title="Cost: ${card.cost} Eddies">€$ ${card.cost}</span>`
      : `<span class="hud-badge" style="color: var(--text-dim);">-</span>`;

    const ramBadge = card.ram !== null && card.ram !== undefined && card.ram > 0
      ? `<span class="hud-badge ram-badge" title="RAM: ${card.ram}">💾 ${card.ram}</span>`
      : '';

    const powerBadge = card.power !== null && card.power !== undefined
      ? `<span class="hud-badge power-badge" title="Power: ${card.power}">⚔️ ${card.power}</span>`
      : '';

    const sellBadge = card.is_eddiable
      ? `<span class="hud-badge" title="Sell Tag: Sell from hand for 1 Eddie" style="color: var(--neon-yellow);">💲 SELL</span>`
      : '';

    const typeBadge = `<span class="hud-badge ${colorClass}">${card.type}</span>`;

    hud.innerHTML = `
      <div class="hud-top-row">
        <div style="display: flex; gap: 4px;">
          ${eddieBadge}
          ${ramBadge}
        </div>
        <div>
          ${typeBadge}
        </div>
      </div>
      <div class="hud-bottom-row">
        <div style="display: flex; gap: 4px;">
          ${sellBadge}
        </div>
        <div>
          ${powerBadge}
        </div>
      </div>
    `;
    cardEl.appendChild(hud);

    // 4. Inspect Magnifier Button
    const inspectBtn = document.createElement('button');
    inspectBtn.className = 'card-inspect-btn';
    inspectBtn.title = 'Inspect Full Card';
    inspectBtn.innerHTML = '🔍';
    inspectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.cyberAudio.click();
      if (window.app && window.app.openInspectModal) {
        window.app.openInspectModal(card);
      }
    });
    cardEl.appendChild(inspectBtn);

    cardEl.addEventListener('dblclick', () => {
      if (window.app && window.app.openInspectModal) {
        window.app.openInspectModal(card);
      }
    });

    // 5. Attach 3D Tilt Effect
    this.attachTiltEffect(cardEl, holoGlare);

    wrapper.appendChild(cardEl);

    // 6. Action Bar (Inventory quantity +/- and "+ Deck" button)
    if (showActions) {
      const ownedQty = window.stateStore ? (window.stateStore.inventory[card.id] || 0) : 3;
      const actionBar = document.createElement('div');
      actionBar.className = 'card-action-bar';
      actionBar.innerHTML = `
        <div class="qty-counter">
          <button class="qty-btn" data-action="dec" title="Decrease owned copy">-</button>
          <span class="qty-val" title="Owned Quantity">x${ownedQty}</span>
          <button class="qty-btn" data-action="inc" title="Increase owned copy">+</button>
        </div>
        <button class="cyber-btn deck-add-btn" data-action="add-deck">
          + Deck
        </button>
      `;

      const decBtn = actionBar.querySelector('[data-action="dec"]');
      const incBtn = actionBar.querySelector('[data-action="inc"]');
      const addDeckBtn = actionBar.querySelector('[data-action="add-deck"]');
      const qtyVal = actionBar.querySelector('.qty-val');

      decBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = window.stateStore.inventory[card.id] || 0;
        if (cur > 0) {
          window.stateStore.setInventoryCount(card.id, cur - 1);
          qtyVal.textContent = `x${cur - 1}`;
          window.cyberAudio.click();
        }
      });

      incBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = window.stateStore.inventory[card.id] || 0;
        window.stateStore.setInventoryCount(card.id, cur + 1);
        qtyVal.textContent = `x${cur + 1}`;
        window.cyberAudio.click();
      });

      addDeckBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const res = window.stateStore.addCardToDeck(card.id);
        if (res && res.success) {
          window.cyberAudio.add();
          window.app.showToast(`+1 ${card.name} added to deck`);
        } else if (res && res.reason) {
          window.cyberAudio.playTone(200, 'sawtooth', 0.15, 0.05);
          window.app.showToast(res.reason, 'warn');
        }
      });

      wrapper.appendChild(actionBar);
    }

    return wrapper;
  }

  attachTiltEffect(cardEl, glareEl) {
    cardEl.addEventListener('mouseenter', () => {
      window.cyberAudio.hover();
    });

    cardEl.addEventListener('mousemove', (e) => {
      const rect = cardEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -12;
      const rotateY = ((x - centerX) / centerX) * 12;

      cardEl.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;

      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;
      glareEl.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(0, 240, 255, 0.4) 0%, rgba(255, 0, 60, 0.25) 35%, transparent 70%)`;
      glareEl.style.opacity = '0.9';
    });

    cardEl.addEventListener('mouseleave', () => {
      cardEl.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      glareEl.style.opacity = '0';
    });
  }
}

window.cardRenderer = new CardRenderer();
