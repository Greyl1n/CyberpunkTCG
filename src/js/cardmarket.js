/**
 * Cyberpunk TCG - Cardmarket Price & Marketplace Integration Service
 * Manages official Cardmarket singles pricing, live online fetching, and search deep-links.
 */
class CardmarketService {
  constructor() {
    this.prices = {};
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.lastSync = null;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners('connectivity_change', true);
      this.tryOnlineSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners('connectivity_change', false);
    });
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  notifyListeners(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }

  async init() {
    // 1. Check if prices were embedded into monolith bundle
    if (window.__CYBERPUNK_CARDMARKET_PRICES__ && typeof window.__CYBERPUNK_CARDMARKET_PRICES__ === 'object') {
      this.prices = window.__CYBERPUNK_CARDMARKET_PRICES__;
      console.log(`[Cardmarket] Loaded ${Object.keys(this.prices).length} card prices from embedded bundle.`);
    } else {
      // 2. Fetch from local JSON file
      const candidates = [
        'data/cardmarket_prices.json',
        '../data/cardmarket_prices.json',
        './data/cardmarket_prices.json',
        '/data/cardmarket_prices.json'
      ];

      for (const path of candidates) {
        try {
          const resp = await fetch(path);
          if (resp.ok) {
            this.prices = await resp.json();
            console.log(`[Cardmarket] Loaded ${Object.keys(this.prices).length} card prices from ${path}`);
            break;
          }
        } catch (e) {
          // Continue to next candidate
        }
      }
    }

    // 3. If online, attempt background sync with server proxy if available
    if (this.isOnline) {
      this.tryOnlineSync();
    }
  }

  async tryOnlineSync() {
    try {
      // Check if local dev/container server proxy is available
      const resp = await fetch('/api/cardmarket/prices', { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const liveData = await resp.json();
        if (liveData && typeof liveData === 'object' && Object.keys(liveData).length > 0) {
          this.prices = { ...this.prices, ...liveData };
          this.lastSync = new Date();
          console.log('[Cardmarket] Synchronized live market prices from API endpoint.');
          this.notifyListeners('prices_updated', this.prices);
        }
      }
    } catch (e) {
      // Silent fallback to offline dataset
    }
  }

  getPrice(cardId) {
    if (!cardId) return null;
    return this.prices[cardId] || null;
  }

  formatPrice(num, currency = '€') {
    if (num === undefined || num === null || isNaN(num)) return '--';
    return `${Number(num).toFixed(2)} ${currency}`;
  }

  getSearchUrl(card) {
    if (!card) return 'https://www.cardmarket.com/en/Cyberpunk';
    const query = encodeURIComponent((card.name || '').replace(/[:]/g, '').trim());
    return `https://www.cardmarket.com/en/Cyberpunk/Products/Search?searchString=${query}`;
  }

  renderPriceBadge(card, options = {}) {
    const priceData = this.getPrice(card?.id);
    const trend = priceData?.trend !== undefined ? this.formatPrice(priceData.trend) : 'N/A';
    const low = priceData?.low !== undefined ? this.formatPrice(priceData.low) : 'N/A';
    const searchUrl = this.getSearchUrl(card);
    const statusClass = this.isOnline ? 'online' : 'offline';
    const statusText = this.isOnline ? 'LIVE MARKET' : 'OFFLINE CACHE';

    return `
      <div class="cardmarket-badge-box">
        <div class="cardmarket-badge-header">
          <span class="cm-logo">⚡ CARDMARKET</span>
          <span class="cm-status-pill ${statusClass}" title="Status: ${statusText}">
            <span class="status-dot-sm"></span> ${statusText}
          </span>
        </div>
        <div class="cardmarket-pricing-row">
          <div class="cm-price-item">
            <span class="cm-price-label">TREND</span>
            <span class="cm-price-value text-accent">${trend}</span>
          </div>
          <div class="cm-price-item">
            <span class="cm-price-label">FROM</span>
            <span class="cm-price-value">${low}</span>
          </div>
          <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="cyber-btn cyber-btn-xs cm-link-btn" title="View live listings on Cardmarket">
            MARKET ↗
          </a>
        </div>
      </div>
    `;
  }
}

// Global singleton instance
window.cardmarketService = new CardmarketService();
