/**
 * Cyberpunk TCG - Deck & Inventory Export / Import Controller
 */
class ExportImportController {
  init() {
    this.setupModals();
  }

  setupModals() {
    // Export Deck Button
    const exportBtn = document.getElementById('export-deck-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        this.openExportModal();
      });
    }

    // Import Deck Button
    const importBtn = document.getElementById('import-deck-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        this.openImportModal();
      });
    }

    // Copy to clipboard
    const copyBtn = document.getElementById('modal-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const textEl = document.getElementById('export-textarea');
        if (textEl) {
          navigator.clipboard.writeText(textEl.value).then(() => {
            window.cyberAudio.success();
            window.app.showToast('Deck data copied to clipboard!');
          });
        }
      });
    }

    // Process Import
    const processImportBtn = document.getElementById('modal-process-import-btn');
    if (processImportBtn) {
      processImportBtn.addEventListener('click', () => {
        const textEl = document.getElementById('import-textarea');
        if (textEl && textEl.value.trim()) {
          const success = this.importDeckString(textEl.value.trim());
          if (success) {
            this.closeModal('import-modal');
          }
        }
      });
    }

    // Close buttons on all modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.cyberAudio.click();
        const modal = btn.closest('.cyber-modal-backdrop');
        if (modal) modal.classList.remove('active');
      });
    });
  }

  generateTextExport(deck) {
    let out = `// CYBERPUNK TCG DECK: ${deck.name}\n`;
    out += `// FACTION: ${deck.faction}\n`;
    if (deck.leaderId) {
      const leader = window.stateStore.getCardById(deck.leaderId);
      out += `// LEADER: ${leader ? leader.name : deck.leaderId} (${deck.leaderId})\n`;
    }
    out += `\n`;

    deck.cards.forEach(item => {
      const card = window.stateStore.getCardById(item.cardId);
      const name = card ? card.name : item.cardId;
      out += `${item.count}x [${item.cardId}] ${name}\n`;
    });

    return out;
  }

  generateCompactCode(deck) {
    const compactObj = {
      n: deck.name,
      f: deck.faction,
      l: deck.leaderId,
      c: deck.cards.map(i => `${i.cardId}:${i.count}`)
    };
    return 'CPTCG_' + btoa(JSON.stringify(compactObj));
  }

  openExportModal() {
    const deck = window.stateStore.activeDeck;
    const modal = document.getElementById('export-modal');
    const textarea = document.getElementById('export-textarea');

    if (modal && textarea) {
      const exportType = document.querySelector('input[name="export-format"]:checked')?.value || 'code';
      if (exportType === 'json') {
        textarea.value = JSON.stringify(deck, null, 2);
      } else if (exportType === 'text') {
        textarea.value = this.generateTextExport(deck);
      } else {
        textarea.value = this.generateCompactCode(deck);
      }

      // Format radio changes
      document.querySelectorAll('input[name="export-format"]').forEach(radio => {
        radio.onchange = () => {
          if (radio.value === 'json') {
            textarea.value = JSON.stringify(deck, null, 2);
          } else if (radio.value === 'text') {
            textarea.value = this.generateTextExport(deck);
          } else {
            textarea.value = this.generateCompactCode(deck);
          }
        };
      });

      modal.classList.add('active');
    }
  }

  openImportModal() {
    const modal = document.getElementById('import-modal');
    const textarea = document.getElementById('import-textarea');
    if (modal && textarea) {
      textarea.value = '';
      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  importDeckString(str) {
    try {
      let importedDeck = null;

      // Check if compact base64 code
      if (str.startsWith('CPTCG_')) {
        const jsonStr = atob(str.substring(6));
        const compact = JSON.parse(jsonStr);
        importedDeck = {
          id: 'imported-' + Date.now(),
          name: compact.n || 'Imported Runner Deck',
          faction: compact.f || 'Neutral',
          leaderId: compact.l || null,
          cards: (compact.c || []).map(entry => {
            const [id, count] = entry.split(':');
            return { cardId: id, count: parseInt(count, 10) || 1 };
          })
        };
      } else if (str.trim().startsWith('{')) {
        // Plain JSON
        const parsed = JSON.parse(str);
        importedDeck = {
          id: 'imported-' + Date.now(),
          name: parsed.name || 'Imported Deck',
          faction: parsed.faction || 'Neutral',
          leaderId: parsed.leaderId || null,
          cards: parsed.cards || []
        };
      } else {
        // Line-by-line text list (e.g., "3x [CP-002] Arasaka Cyber-Ninja")
        const lines = str.split('\n');
        const cards = [];
        let leaderId = null;
        let name = 'Imported Deck';

        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          if (trimmed.startsWith('// CYBERPUNK TCG DECK:')) {
            name = trimmed.replace('// CYBERPUNK TCG DECK:', '').trim();
          } else if (trimmed.startsWith('// LEADER:')) {
            const m = trimmed.match(/\((CP-\d+)\)/);
            if (m) leaderId = m[1];
          } else {
            const cardMatch = trimmed.match(/^(\d+)x?\s+\[?(CP-\d+)\]?/i);
            if (cardMatch) {
              const count = parseInt(cardMatch[1], 10);
              const cardId = cardMatch[2].toUpperCase();
              cards.push({ cardId, count });
            }
          }
        });

        if (cards.length > 0) {
          importedDeck = {
            id: 'imported-' + Date.now(),
            name,
            faction: 'Custom',
            leaderId,
            cards
          };
        }
      }

      if (!importedDeck || importedDeck.cards.length === 0) {
        throw new Error('Unrecognized deck format or no valid card IDs found.');
      }

      // Verify card IDs exist in database
      const validCards = importedDeck.cards.filter(item => {
        return window.stateStore.getCardById(item.cardId);
      });

      importedDeck.cards = validCards;
      window.stateStore.loadDeck(importedDeck);
      window.stateStore.saveCurrentDeck();
      window.cyberAudio.success();
      window.app.showToast(`Successfully imported deck "${importedDeck.name}" with ${window.stateStore.getDeckTotalCards()} cards!`);
      return true;
    } catch (err) {
      window.cyberAudio.playTone(180, 'sawtooth', 0.2, 0.05);
      window.app.showToast('Import Failed: ' + err.message, 'error');
      return false;
    }
  }
}

window.exportImportController = new ExportImportController();
