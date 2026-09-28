/**
 * Cyberpunk TCG - Deck & Inventory Export / Import Controller
 * Supports exporting decks and card inventories to Clipboard and File (.json, .csv, .txt, .cptcg).
 */
class ExportImportController {
  init() {
    this.setupModals();
  }

  downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  setupModals() {
    // 1. Export Deck Button (Header)
    const exportDeckBtn = document.getElementById('export-deck-btn');
    if (exportDeckBtn) {
      exportDeckBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        this.openExportModal();
      });
    }

    // 2. Export Inventory Buttons (Header + Toolbar)
    const exportInvHeaderBtn = document.getElementById('export-inventory-btn');
    if (exportInvHeaderBtn) {
      exportInvHeaderBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        this.openInventoryExportModal();
      });
    }

    const exportInvToolbarBtn = document.getElementById('inv-toolbar-export-btn');
    if (exportInvToolbarBtn) {
      exportInvToolbarBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        this.openInventoryExportModal();
      });
    }

    // 3. Import Button (Header)
    const importBtn = document.getElementById('import-deck-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        this.openImportModal();
      });
    }

    // 4. Deck Modal: Copy to Clipboard
    const copyDeckBtn = document.getElementById('modal-copy-btn');
    if (copyDeckBtn) {
      copyDeckBtn.addEventListener('click', () => {
        const textEl = document.getElementById('export-textarea');
        if (textEl) {
          navigator.clipboard.writeText(textEl.value).then(() => {
            window.cyberAudio.success();
            window.app.showToast('Deck data copied to clipboard!');
          });
        }
      });
    }

    // 5. Deck Modal: Save to File
    const downloadDeckBtn = document.getElementById('modal-download-btn');
    if (downloadDeckBtn) {
      downloadDeckBtn.addEventListener('click', () => {
        this.saveDeckToFile();
      });
    }

    // 6. Inventory Modal: Copy to Clipboard
    const copyInvBtn = document.getElementById('inv-modal-copy-btn');
    if (copyInvBtn) {
      copyInvBtn.addEventListener('click', () => {
        const textEl = document.getElementById('inv-export-textarea');
        if (textEl) {
          navigator.clipboard.writeText(textEl.value).then(() => {
            window.cyberAudio.success();
            window.app.showToast('Inventory data copied to clipboard!');
          });
        }
      });
    }

    // 7. Inventory Modal: Save to File
    const downloadInvBtn = document.getElementById('inv-modal-download-btn');
    if (downloadInvBtn) {
      downloadInvBtn.addEventListener('click', () => {
        this.saveInventoryToFile();
      });
    }

    // 8. File Input & Browse Button
    const browseFileBtn = document.getElementById('modal-browse-file-btn');
    const fileInput = document.getElementById('import-file-input');
    const fileNameDisplay = document.getElementById('import-file-name');

    if (browseFileBtn && fileInput) {
      browseFileBtn.addEventListener('click', () => {
        window.cyberAudio.click();
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (fileNameDisplay) {
          fileNameDisplay.textContent = file.name;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const content = loadEvent.target.result;
          const textEl = document.getElementById('import-textarea');
          if (textEl) {
            textEl.value = content;
          }
          window.cyberAudio.click();

          // Auto-execute import from file
          const success = this.importDataString(content);
          if (success) {
            this.closeModal('import-modal');
          }
        };

        reader.onerror = () => {
          window.app.showToast(`Error reading file "${file.name}"`, 'error');
        };

        reader.readAsText(file);
      });
    }

    // 9. Process Import Button (Manual or Textarea)
    const processImportBtn = document.getElementById('modal-process-import-btn');
    if (processImportBtn) {
      processImportBtn.addEventListener('click', () => {
        const textEl = document.getElementById('import-textarea');
        if (textEl && textEl.value.trim()) {
          const success = this.importDataString(textEl.value.trim());
          if (success) {
            this.closeModal('import-modal');
          }
        }
      });
    }

    // 9. Close buttons on all modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.cyberAudio.click();
        const modal = btn.closest('.cyber-modal-backdrop');
        if (modal) modal.classList.remove('active');
      });
    });

    // 10. Close when clicking outside modal content (on backdrop)
    document.querySelectorAll('.cyber-modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          window.cyberAudio.click();
          modal.classList.remove('active');
        }
      });
    });

    // 11. Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.cyber-modal-backdrop.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });
  }

  // ===========================================================================
  // DECK EXPORT
  // ===========================================================================

  generateTextExport(deck) {
    let out = `# ${(deck.name || 'CYBER DECK').toUpperCase()}\n\n`;

    const legends = deck.legends || (deck.leaderId ? [deck.leaderId] : []);
    if (legends.length > 0) {
      out += `// Legends (${legends.length})\n`;
      legends.forEach(legId => {
        const leg = window.stateStore.getCardById(legId);
        const name = leg ? leg.name : legId;
        out += `1 ${name}\n`;
      });
      out += `\n`;
    }

    const units = [];
    const gears = [];
    const programs = [];
    const other = [];

    deck.cards.forEach(item => {
      const card = window.stateStore.getCardById(item.cardId);
      const name = card ? card.name : item.cardId;
      const type = (card ? card.type : '').toLowerCase();
      const entry = { name, count: item.count };

      if (type === 'unit') units.push(entry);
      else if (type === 'gear') gears.push(entry);
      else if (type === 'program') programs.push(entry);
      else other.push(entry);
    });

    if (units.length > 0) {
      const totalUnits = units.reduce((sum, u) => sum + u.count, 0);
      out += `// Units (${totalUnits})\n`;
      units.forEach(u => { out += `${u.count} ${u.name}\n`; });
      out += `\n`;
    }

    if (gears.length > 0) {
      const totalGears = gears.reduce((sum, g) => sum + g.count, 0);
      out += `// Gears (${totalGears})\n`;
      gears.forEach(g => { out += `${g.count} ${g.name}\n`; });
      out += `\n`;
    }

    if (programs.length > 0) {
      const totalPrograms = programs.reduce((sum, p) => sum + p.count, 0);
      out += `// Programs (${totalPrograms})\n`;
      programs.forEach(p => { out += `${p.count} ${p.name}\n`; });
      out += `\n`;
    }

    if (other.length > 0) {
      const totalOther = other.reduce((sum, o) => sum + o.count, 0);
      out += `// Cards (${totalOther})\n`;
      other.forEach(o => { out += `${o.count} ${o.name}\n`; });
      out += `\n`;
    }

    return out.trim();
  }

  generateCompactCode(deck) {
    const compactObj = {
      n: deck.name,
      f: deck.faction,
      legs: deck.legends || (deck.leaderId ? [deck.leaderId] : []),
      c: deck.cards.map(i => `${i.cardId}:${i.count}`)
    };
    return 'CPTCG_' + btoa(JSON.stringify(compactObj));
  }

  updateDeckExportTextarea() {
    const deck = window.stateStore.activeDeck;
    const textarea = document.getElementById('export-textarea');
    if (!textarea || !deck) return;

    const exportType = document.querySelector('input[name="export-format"]:checked')?.value || 'code';
    if (exportType === 'json') {
      textarea.value = JSON.stringify(deck, null, 2);
    } else if (exportType === 'text') {
      textarea.value = this.generateTextExport(deck);
    } else {
      textarea.value = this.generateCompactCode(deck);
    }
  }

  openExportModal() {
    const modal = document.getElementById('export-modal');
    if (!modal) return;

    this.updateDeckExportTextarea();

    // Setup radio changes
    document.querySelectorAll('input[name="export-format"]').forEach(radio => {
      radio.onchange = () => {
        this.updateDeckExportTextarea();
      };
    });

    modal.classList.add('active');
  }

  saveDeckToFile() {
    const deck = window.stateStore.activeDeck;
    const textEl = document.getElementById('export-textarea');
    if (!deck || !textEl) return;

    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'code';
    const safeName = (deck.name || 'cyberpunk_deck').replace(/[^a-zA-Z0-9_-]/g, '_');

    let filename = `${safeName}.cptcg`;
    let mimeType = 'text/plain;charset=utf-8';

    if (format === 'json') {
      filename = `${safeName}.json`;
      mimeType = 'application/json;charset=utf-8';
    } else if (format === 'text') {
      filename = `${safeName}.txt`;
      mimeType = 'text/plain;charset=utf-8';
    }

    this.downloadFile(filename, textEl.value, mimeType);
    window.cyberAudio.success();
    window.app.showToast(`Saved deck to "${filename}"`);
  }

  // ===========================================================================
  // INVENTORY EXPORT
  // ===========================================================================

  generateInventoryJson(ownedOnly = false) {
    const invMap = {};
    const cards = window.stateStore.cards || [];

    cards.forEach(c => {
      const count = Number(window.stateStore.inventory[c.id]) || 0;
      if (!ownedOnly || count > 0) {
        invMap[c.id] = count;
      }
    });

    const totalCopies = Object.values(invMap).reduce((sum, v) => sum + v, 0);
    const uniqueCollected = Object.values(invMap).filter(v => v > 0).length;

    const backupObj = {
      format: 'Cyberpunk_TCG_Inventory',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      stats: {
        totalCopies,
        uniqueCollected,
        totalDatabaseCards: cards.length
      },
      inventory: invMap
    };

    return JSON.stringify(backupObj, null, 2);
  }

  generateInventoryCsv(ownedOnly = false) {
    const cards = window.stateStore.cards || [];
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'Card ID',
      'Name',
      'Color/Faction',
      'Type',
      'Rarity',
      'Cost (€$)',
      'RAM',
      'Power',
      'Sell Tag (€$)',
      'Copies Owned'
    ];

    const rows = [headers.map(escapeCsv).join(',')];

    cards.forEach(c => {
      const count = Number(window.stateStore.inventory[c.id]) || 0;
      if (!ownedOnly || count > 0) {
        const row = [
          c.id || '',
          c.name || '',
          c.color || c.faction || '',
          c.type || '',
          c.rarity || '',
          c.cost !== null && c.cost !== undefined ? c.cost : '',
          c.ram !== null && c.ram !== undefined ? c.ram : '',
          c.power !== null && c.power !== undefined ? c.power : '',
          c.sell_cost !== null && c.sell_cost !== undefined ? c.sell_cost : '',
          count
        ];
        rows.push(row.map(escapeCsv).join(','));
      }
    });

    return rows.join('\r\n');
  }

  generateInventoryText(ownedOnly = false) {
    const cards = window.stateStore.cards || [];
    const totalCopies = window.stateStore.getTotalInventoryCount ? window.stateStore.getTotalInventoryCount() : 0;
    const uniqueOwned = window.stateStore.getUniqueOwnedCount ? window.stateStore.getUniqueOwnedCount() : 0;

    let out = `// CYBERPUNK TCG // OFFICIAL WEIRDCO CARD INVENTORY\n`;
    out += `// EXPORT DATE: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    out += `// TOTAL COPIES: ${totalCopies} | UNIQUE COLLECTED: ${uniqueOwned} / ${cards.length}\n`;
    out += `${'='.repeat(65)}\n\n`;

    let filteredCards = cards;
    if (ownedOnly) {
      filteredCards = cards.filter(c => (Number(window.stateStore.inventory[c.id]) || 0) > 0);
    }

    filteredCards.forEach(c => {
      const count = Number(window.stateStore.inventory[c.id]) || 0;
      const stats = [];
      if (c.cost !== null && c.cost !== undefined) stats.push(`€$${c.cost}`);
      if (c.ram !== null && c.ram !== undefined) stats.push(`${c.ram} RAM`);
      if (c.power !== null && c.power !== undefined) stats.push(`${c.power} PWR`);
      const statStr = stats.length > 0 ? ` [${stats.join(', ')}]` : '';

      out += `${count}x [${c.id}] ${c.name} (${c.color || c.faction} ${c.type})${statStr}\n`;
    });

    return out;
  }

  updateInventoryExportTextarea() {
    const textarea = document.getElementById('inv-export-textarea');
    if (!textarea) return;

    const format = document.querySelector('input[name="inv-export-format"]:checked')?.value || 'json';
    const ownedOnly = document.getElementById('inv-export-owned-only')?.checked || false;

    if (format === 'csv') {
      textarea.value = this.generateInventoryCsv(ownedOnly);
    } else if (format === 'text') {
      textarea.value = this.generateInventoryText(ownedOnly);
    } else {
      textarea.value = this.generateInventoryJson(ownedOnly);
    }
  }

  openInventoryExportModal() {
    const modal = document.getElementById('export-inventory-modal');
    if (!modal) return;

    this.updateInventoryExportTextarea();

    // Radio format changes
    document.querySelectorAll('input[name="inv-export-format"]').forEach(radio => {
      radio.onchange = () => {
        this.updateInventoryExportTextarea();
      };
    });

    // Checkbox changes
    const ownedOnlyCheckbox = document.getElementById('inv-export-owned-only');
    if (ownedOnlyCheckbox) {
      ownedOnlyCheckbox.onchange = () => {
        this.updateInventoryExportTextarea();
      };
    }

    modal.classList.add('active');
  }

  saveInventoryToFile() {
    const textEl = document.getElementById('inv-export-textarea');
    if (!textEl) return;

    const format = document.querySelector('input[name="inv-export-format"]:checked')?.value || 'json';
    const dateStr = new Date().toISOString().slice(0, 10);

    let filename = `cyberpunk_inventory_${dateStr}.json`;
    let mimeType = 'application/json;charset=utf-8';

    if (format === 'csv') {
      filename = `cyberpunk_inventory_${dateStr}.csv`;
      mimeType = 'text/csv;charset=utf-8';
    } else if (format === 'text') {
      filename = `cyberpunk_inventory_${dateStr}.txt`;
      mimeType = 'text/plain;charset=utf-8';
    }

    this.downloadFile(filename, textEl.value, mimeType);
    window.cyberAudio.success();
    window.app.showToast(`Saved inventory to "${filename}"`);
  }

  // ===========================================================================
  // IMPORT (DECKS & INVENTORY BACKUPS)
  // ===========================================================================

  openImportModal() {
    const modal = document.getElementById('import-modal');
    const textarea = document.getElementById('import-textarea');
    const fileNameDisplay = document.getElementById('import-file-name');
    const fileInput = document.getElementById('import-file-input');

    if (modal && textarea) {
      textarea.value = '';
      if (fileNameDisplay) fileNameDisplay.textContent = '';
      if (fileInput) fileInput.value = '';
      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  importDataString(str) {
    try {
      const trimmed = str.trim();

      // 1. Check if it's an Inventory JSON Backup
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && parsed.inventory && typeof parsed.inventory === 'object') {
            let importedCount = 0;
            Object.entries(parsed.inventory).forEach(([cardId, count]) => {
              if (window.stateStore.getCardById(cardId)) {
                window.stateStore.inventory[cardId] = Math.max(0, parseInt(count, 10) || 0);
                importedCount++;
              }
            });

            window.stateStore.saveInventory();
            window.stateStore.emit('inventory_changed');
            window.cyberAudio.success();
            window.app.showToast(`Successfully imported inventory for ${importedCount} cards!`);
            return true;
          }
        } catch (jsonErr) {
          // Continue to deck JSON or other parsers
        }
      }

      // 2. Check if it's a CSV Inventory file
      if (trimmed.includes('Card ID') || trimmed.includes('Copies Owned') || (trimmed.includes(',') && trimmed.includes('cb-'))) {
        const lines = trimmed.split(/\r?\n/);
        if (lines.length > 1) {
          const parseCsvLine = (line) => {
            const result = [];
            let inQuotes = false;
            let current = '';
            for (let i = 0; i < line.length; i++) {
              const c = line[i];
              if (c === '"') {
                if (inQuotes && line[i + 1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (c === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += c;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headerRow = parseCsvLine(lines[0]);
          let idCol = headerRow.findIndex(h => /card\s*id/i.test(h) || /^id$/i.test(h));
          let countCol = headerRow.findIndex(h => /copies\s*owned/i.test(h) || /count/i.test(h) || /qty/i.test(h));

          if (idCol === -1) idCol = 0;
          if (countCol === -1) countCol = headerRow.length - 1;

          let importedCount = 0;
          for (let i = 1; i < lines.length; i++) {
            const rowStr = lines[i].trim();
            if (!rowStr) continue;
            const cols = parseCsvLine(rowStr);
            const cardId = cols[idCol];
            const count = parseInt(cols[countCol], 10);
            if (cardId && !isNaN(count) && window.stateStore.getCardById(cardId)) {
              window.stateStore.inventory[cardId] = Math.max(0, count);
              importedCount++;
            }
          }

          if (importedCount > 0) {
            window.stateStore.saveInventory();
            window.stateStore.emit('inventory_changed');
            window.cyberAudio.success();
            window.app.showToast(`Successfully imported inventory from CSV for ${importedCount} cards!`);
            return true;
          }
        }
      }

      // 3. Check if it's an Inventory Text Checklist export
      if (trimmed.includes('OFFICIAL WEIRDCO CARD INVENTORY') || trimmed.includes('// TOTAL COPIES:')) {
        const lines = trimmed.split('\n');
        let importedCount = 0;
        lines.forEach(line => {
          const match = line.trim().match(/^(\d+)x?\s+\[?([a-zA-Z0-9\-_]+)\]?/i);
          if (match) {
            const count = parseInt(match[1], 10);
            const cardId = match[2];
            if (window.stateStore.getCardById(cardId)) {
              window.stateStore.inventory[cardId] = Math.max(0, count);
              importedCount++;
            }
          }
        });

        if (importedCount > 0) {
          window.stateStore.saveInventory();
          window.stateStore.emit('inventory_changed');
          window.cyberAudio.success();
          window.app.showToast(`Successfully imported inventory checklist for ${importedCount} cards!`);
          return true;
        }
      }

      // 4. Otherwise process as a Deck import (.cptcg Base64, Deck JSON, or Deck text list)
      return this.importDeckString(str);
    } catch (err) {
      window.cyberAudio.playTone(180, 'sawtooth', 0.2, 0.05);
      window.app.showToast('Import Failed: ' + err.message, 'error');
      return false;
    }
  }

  resolveCard(identifier) {
    if (!identifier) return null;
    const trimmed = String(identifier).trim();
    if (!trimmed) return null;

    // 1. Direct ID lookup
    let card = window.stateStore.getCardById(trimmed);
    if (card) return card;

    // 2. Direct ID with or without 'cb-' prefix
    if (trimmed.startsWith('cb-')) {
      card = window.stateStore.getCardById(trimmed.replace(/^cb-/, ''));
      if (card) return card;
    } else {
      card = window.stateStore.getCardById(`cb-${trimmed}`);
      if (card) return card;
    }

    // 3. Remove optional trailing qualifiers e.g. " (005a)" or " [cb-...]" or " (Rare)"
    const cleaned = trimmed
      .replace(/\s*\([^\)]*\)\s*$/, '')
      .replace(/\s*\[[^\]]*\]\s*$/, '')
      .trim();

    const allCards = window.stateStore.cards || [];

    const normalizeStr = (s) => {
      if (!s) return '';
      return s
        .replace(/[’‘ʻ`]/g, "'")
        .replace(/[“”]/g, '"')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    };

    const targetNorm = normalizeStr(cleaned);

    // 4. Exact normalized name match
    card = allCards.find(c => normalizeStr(c.name) === targetNorm);
    if (card) return card;

    // 5. Title & Subname combinations: "Title: Subname", "Title - Subname", "Title Subname"
    card = allCards.find(c => {
      const t = normalizeStr(c.card_title || '');
      const s = normalizeStr(c.subname || '');
      if (!t || !s) return false;
      return targetNorm === `${t}: ${s}` ||
             targetNorm === `${t} - ${s}` ||
             targetNorm === `${t} ${s}`;
    });
    if (card) return card;

    // 6. Alphanumeric-only match (ignores all punctuation and spacing)
    const targetAlpha = targetNorm.replace(/[^a-z0-9]/g, '');
    if (targetAlpha.length >= 3) {
      card = allCards.find(c => {
        const cAlpha = normalizeStr(c.name).replace(/[^a-z0-9]/g, '');
        return cAlpha === targetAlpha;
      });
      if (card) return card;
    }

    // 7. Title only if unambiguous
    const titleMatches = allCards.filter(c => normalizeStr(c.card_title || '') === targetNorm);
    if (titleMatches.length === 1) {
      return titleMatches[0];
    }

    return null;
  }

  importDeckString(str) {
    let importedDeck = null;

    // 1. Check if compact base64 code
    if (str.startsWith('CPTCG_')) {
      const jsonStr = atob(str.substring(6));
      const compact = JSON.parse(jsonStr);
      importedDeck = {
        id: 'imported-' + Date.now(),
        name: compact.n || 'Imported Runner Deck',
        faction: compact.f || 'Neutral',
        legends: compact.legs || (compact.l ? [compact.l] : []),
        cards: (compact.c || []).map(entry => {
          const [id, count] = entry.split(':');
          return { cardId: id, count: parseInt(count, 10) || 1 };
        })
      };
    } else if (str.trim().startsWith('{')) {
      // 2. Plain Deck JSON
      const parsed = JSON.parse(str);
      importedDeck = {
        id: 'imported-' + Date.now(),
        name: parsed.name || 'Imported Deck',
        faction: parsed.faction || 'Neutral',
        legends: parsed.legends || (parsed.leaderId ? [parsed.leaderId] : []),
        cards: parsed.cards || []
      };
    } else {
      // 3. Line-by-line text list (supports official cyberpunktcg.com / NetDeck.gg / raw text)
      const lines = str.split(/\r?\n/);
      const cards = [];
      const legends = [];
      const unresolvedNames = [];
      let deckName = 'Imported Cyber Deck';
      let currentSection = 'main'; // 'legends' | 'main'
      let nameExplicitlySet = false;

      lines.forEach((rawLine, lineIdx) => {
        const line = rawLine.trim();
        if (!line) return;

        // Check for Deck Title header:
        // e.g. "# STAUL BRIGHT" or "// CYBERPUNK TCG DECK: Name" or "DECK: Name"
        if (line.startsWith('#')) {
          const candidate = line.replace(/^#+\s*/, '').trim();
          if (candidate && !candidate.startsWith('/')) {
            deckName = candidate;
            nameExplicitlySet = true;
            return;
          }
        }

        const titleMatch = line.match(/^(?:\/\/|--)\s*(?:CYBERPUNK\s*TCG\s*DECK|DECK|NAME):\s*(.+)$/i);
        if (titleMatch) {
          deckName = titleMatch[1].trim();
          nameExplicitlySet = true;
          return;
        }

        // Legacy format for legends: // LEGEND 1: V: Streetkid (cb-v-streetkid)
        const legMatch = line.match(/^(?:\/\/|--)\s*LEGEND\s*\d*:\s*(.+)$/i);
        if (legMatch) {
          const idMatch = legMatch[1].match(/\(([a-zA-Z0-9\-_]+)\)/);
          const legNameOrId = idMatch ? idMatch[1] : legMatch[1].trim();
          const legCard = this.resolveCard(legNameOrId);
          if (legCard && !legends.includes(legCard.id)) {
            legends.push(legCard.id);
          }
          return;
        }

        // Check for Section Headers:
        // e.g. "// Legends (3)", "// Units (17)", "// Gears (10)", "// Programs (13)"
        if (line.startsWith('//') || line.startsWith('#') || line.startsWith('[') || line.startsWith('--')) {
          const secLower = line.toLowerCase();
          if (/legend|identity|identities|leader/i.test(secLower)) {
            currentSection = 'legends';
            return;
          } else if (/unit|gear|program|main|card|deck/i.test(secLower)) {
            currentSection = 'main';
            return;
          }
          return;
        }

        // If very first non-empty line has no numbers and looks like a title
        if (lineIdx === 0 && !nameExplicitlySet && !/^\d/.test(line) && !line.includes(':')) {
          deckName = line;
          nameExplicitlySet = true;
          return;
        }

        // Parse card line:
        // Pattern 1: "1 Goro Takemura: Vengeful Bodyguard" or "3x Sketchy Ripper" or "3 [cb-sketchy-ripper]"
        let count = 1;
        let cardStr = line;

        const mCountPrefix = line.match(/^(\d+)[xX]?\s+(.+)$/);
        const mCountSuffix1 = line.match(/^(.+?)\s+[xX](\d+)$/);
        const mCountSuffix2 = line.match(/^(.+?)\s+\((\d+)\)$/);

        if (mCountPrefix) {
          count = parseInt(mCountPrefix[1], 10) || 1;
          cardStr = mCountPrefix[2].trim();
        } else if (mCountSuffix1) {
          cardStr = mCountSuffix1[1].trim();
          count = parseInt(mCountSuffix1[2], 10) || 1;
        } else if (mCountSuffix2) {
          cardStr = mCountSuffix2[1].trim();
          count = parseInt(mCountSuffix2[2], 10) || 1;
        }

        // Handle bracketed "[cb-...]"
        const mBracket = cardStr.match(/\[([a-zA-Z0-9\-_]+)\]/);
        if (mBracket) {
          cardStr = mBracket[1];
        }

        const card = this.resolveCard(cardStr);
        if (card) {
          if (card.type === 'Legend' || currentSection === 'legends') {
            if (card.type === 'Legend') {
              if (!legends.includes(card.id)) {
                legends.push(card.id);
              }
            } else {
              const existing = cards.find(c => c.cardId === card.id);
              if (existing) existing.count += count;
              else cards.push({ cardId: card.id, count });
            }
          } else {
            const existing = cards.find(c => c.cardId === card.id);
            if (existing) existing.count += count;
            else cards.push({ cardId: card.id, count });
          }
        } else {
          unresolvedNames.push(cardStr);
        }
      });

      // Calculate dominant faction from cards and legends
      const allDeckCards = [
        ...legends.map(id => window.stateStore.getCardById(id)),
        ...cards.map(c => window.stateStore.getCardById(c.cardId))
      ].filter(Boolean);

      const colorCounts = {};
      allDeckCards.forEach(c => {
        if (c.color && c.color !== 'Neutral') {
          colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }
      });
      let dominantFaction = 'Neutral';
      let maxColorCount = 0;
      Object.entries(colorCounts).forEach(([col, cnt]) => {
        if (cnt > maxColorCount) {
          maxColorCount = cnt;
          dominantFaction = col;
        }
      });

      if (cards.length > 0 || legends.length > 0) {
        importedDeck = {
          id: 'imported-' + Date.now(),
          name: deckName,
          faction: dominantFaction,
          legends,
          cards
        };
      }

      if (unresolvedNames.length > 0 && window.app && window.app.showToast) {
        window.app.showToast(`Warning: ${unresolvedNames.length} card(s) could not be matched: ${unresolvedNames.slice(0, 3).join(', ')}${unresolvedNames.length > 3 ? '...' : ''}`, 'warn');
      }
    }

    if (!importedDeck || (importedDeck.cards.length === 0 && importedDeck.legends.length === 0)) {
      throw new Error('Unrecognized deck format or no valid cards found in import data.');
    }

    // Verify card IDs exist in database
    importedDeck.cards = importedDeck.cards.filter(item => {
      return window.stateStore.getCardById(item.cardId);
    });
    importedDeck.legends = (importedDeck.legends || []).filter(id => {
      return window.stateStore.getCardById(id);
    });

    window.stateStore.loadDeck(importedDeck);
    window.stateStore.saveCurrentDeck();

    if (window.app && window.app.switchTab) {
      window.app.switchTab('deck-builder');
    }

    window.cyberAudio.success();
    window.app.showToast(`Successfully imported deck "${importedDeck.name}" (${importedDeck.legends.length} Legends, ${window.stateStore.getDeckTotalCards()} Cards)!`);
    return true;
  }
}

window.exportImportController = new ExportImportController();
