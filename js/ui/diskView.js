(function () {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.ui = window.FileBlock.ui || {};

  class DiskViewRenderer {
    constructor() {
      this.initTooltip();
    }

    initTooltip() {
      if (document.getElementById('disk-tooltip')) return;
      const tip = document.createElement('div');
      tip.id = 'disk-tooltip';
      tip.className = 'disk-tooltip hidden';
      document.body.appendChild(tip);

      document.addEventListener('mousemove', (e) => {
        const t = document.getElementById('disk-tooltip');
        if (t && !t.classList.contains('hidden')) {
          t.style.left = `${e.clientX + 14}px`;
          t.style.top = `${e.clientY + 14}px`;
        }
      });
    }

    renderDiskGrid(blocks, method = 'contiguous') {
      const container = document.getElementById('disk-grid');
      if (!container) return;

      container.innerHTML = '';
      container.className = 'blocks';

      blocks.forEach((b, idx) => {
        const blockEl = document.createElement('div');
        blockEl.setAttribute('data-index', idx);

        let pointerInfo = '';
        if (method === 'linked') {
          pointerInfo = (b.nextPointer !== -1 && b.nextPointer !== null && b.nextPointer !== undefined)
            ? `<span style="font-size:9px;font-family:monospace;font-weight:700">→ #${b.nextPointer}</span>`
            : `<span style="font-size:9px;font-family:monospace;font-weight:700">EOF</span>`;
        } else if (method === 'indexed') {
          pointerInfo = `<span style="font-size:9px;font-family:monospace;font-weight:700">${b.nextPointer || 'inode'}</span>`;
        }

        if (b.status === 'allocated') {
          blockEl.className = 'blk u';
          if (b.color) {
            blockEl.style.backgroundColor = b.color;
          }
          blockEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
              <span>#${idx}</span>
              ${pointerInfo}
            </div>
            <b style="align-self:center;font-size:13px">${b.fileName || b.fileId || '^ _ ^'}</b>
          `;
        } else if (b.status === 'hole') {
          blockEl.className = 'blk h';
          blockEl.innerHTML = `
            <span>#${idx}</span>
            <b style="align-self:center;font-size:12px;color:#E11D48">T_T</b>
          `;
        } else {
          blockEl.className = 'blk';
          blockEl.innerHTML = `
            <span>#${idx}</span>
            <b style="align-self:center;font-size:13px;color:var(--mut)">-_-</b>
          `;
        }

        blockEl.addEventListener('click', () => {
          if (b.status === 'free' || b.status === 'hole') {
            const customInp = document.getElementById('input-custom-blocks');
            if (customInp) {
              let current = customInp.value.split(/[,;\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
              if (current.includes(idx)) {
                current = current.filter(x => x !== idx);
              } else {
                current.push(idx);
              }
              customInp.value = current.join(', ');
            }
          }
        });

        blockEl.addEventListener('mouseenter', () => this.showTooltip(b, method));
        blockEl.addEventListener('mouseleave', () => this.hideTooltip());

        container.appendChild(blockEl);
      });

      this.updateTipsBox(method, blocks);
    }

    updateTipsBox(method, blocks) {
      const tipTextEl = document.getElementById('allocation-tip-text');
      if (!tipTextEl) return;

      const hasHole = blocks.some(b => b.status === 'hole');

      if (method === 'contiguous') {
        if (hasHole) {
          tipTextEl.textContent = 'First-Fit memilih lubang pertama yang cukup besar. Blok kosong yang terpotong menjadi lubang (fragmentasi eksternal), file yang lebih besar tidak muat di lubang sempit.';
        } else {
          tipTextEl.textContent = 'Contiguous menempatkan file berurutan dalam satu kontigu. Akses sangat cepat (1 I/O), namun berisiko fragmentasi eksternal bila ada file yang dihapus.';
        }
      } else if (method === 'linked') {
        tipTextEl.textContent = 'Linked (FAT) menyambung blok lewat penunjuk. File dapat terpencar di blok mana pun tanpa ada fragmentasi eksternal!';
      } else if (method === 'indexed') {
        tipTextEl.textContent = 'Indexed (Inode) memakai satu blok indeks yang menunjuk semua blok data. Akses acak langsung via tabel pointer!';
      }
    }

    showTooltip(b, method) {
      const tip = document.getElementById('disk-tooltip');
      if (!tip) return;

      let statusBadge = 'Bebas';
      let detail = 'Blok belum terisi data file.';

      if (b.status === 'allocated') {
        statusBadge = `Terisi - File ${b.fileName || b.fileId}`;
        detail = `
          <div>Ukuran File: <strong>${b.sizeKB || (b.totalFileBlocks * 4)} KB</strong></div>
          <div>Bagian: <strong>Blok ke-${b.blockOffset + 1} dari ${b.totalFileBlocks}</strong></div>
          <div>Frag. Internal: <strong>${b.internalFragKB || 0} KB</strong></div>
          ${method === 'linked' ? `<div>Next Pointer: <strong>${b.nextPointer === -1 ? 'EOF' : '#' + b.nextPointer}</strong></div>` : ''}
          ${method === 'indexed' ? `<div>Pointer: <strong>${b.nextPointer || 'Indeks Inode'}</strong></div>` : ''}
        `;
      } else if (b.status === 'hole') {
        statusBadge = 'Lubang (Fragmentasi Eksternal)';
        detail = 'Fragmentasi Eksternal: blok bebas bekas file terhapus yang terisolasi.';
      }

      tip.innerHTML = `
        <div style="font-weight:700;border-bottom:1px solid var(--ink);padding-bottom:4px;margin-bottom:4px">Blok Memori #${b.index}</div>
        <div style="font-size:11px;line-height:1.4">
          <div>Status: <strong>${statusBadge}</strong></div>
          ${detail}
        </div>
      `;
      tip.classList.remove('hidden');
    }

    hideTooltip() {
      const tip = document.getElementById('disk-tooltip');
      if (tip) tip.classList.add('hidden');
    }

    renderFatTable(fatTable, activeFiles) {
      const container = document.getElementById('fat-table-container');
      const tbody = document.getElementById('fat-table-body');
      if (!container || !tbody) return;

      if (!fatTable || fatTable.length === 0) {
        container.classList.add('hidden');
        return;
      }

      container.classList.remove('hidden');
      tbody.innerHTML = '';

      fatTable.forEach((entry) => {
        const isAllocated = (entry.status === 'ALLOCATED');
        const fileObj = entry.fileId && activeFiles ? activeFiles[entry.fileId] : null;
        const fileName = fileObj ? fileObj.name : (entry.fileId || '-');

        let nextBadge = '<span style="color:var(--mut);font-family:monospace">-</span>';
        if (isAllocated) {
          if (entry.next === -1 || entry.next === null) {
            nextBadge = '<span class="pill" style="background:#e2e8f0;padding:1px 8px;font-size:10px">EOF</span>';
          } else {
            nextBadge = `<span class="pill" style="background:var(--bl);padding:1px 8px;font-size:10px">#${entry.next}</span>`;
          }
        }

        const tr = document.createElement('tr');
        if (isAllocated) tr.style.background = 'var(--soft)';
        tr.innerHTML = `
          <td style="font-family:monospace;font-weight:700">#${entry.blockIndex}</td>
          <td><b>${fileName}</b></td>
          <td>${nextBadge}</td>
          <td>${entry.status}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    renderInodeCards(inodes) {
      const container = document.getElementById('inode-cards-container');
      const listEl = document.getElementById('inode-cards-list');
      if (!container || !listEl) return;

      if (!inodes || Object.keys(inodes).length === 0) {
        container.classList.add('hidden');
        return;
      }

      container.classList.remove('hidden');
      listEl.innerHTML = '';

      for (const fId in inodes) {
        const item = inodes[fId];
        const card = document.createElement('div');
        card.className = 'stat';
        card.style.textAlign = 'left';

        const pointersBadge = item.directPointers.map((p, i) =>
          `<span class="pill" style="background:var(--pu);padding:2px 8px;font-size:10px">p[${i}]: #${p}</span>`
        ).join(' ');

        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--mut);padding-bottom:4px;margin-bottom:6px">
            <b>Inode #${item.inodeNumber}</b>
            <span style="font-weight:700;color:var(--pk)">${item.name} (${item.sizeKB} KB)</span>
          </div>
          <div style="font-size:11px">
            <span style="display:block;margin-bottom:4px">Pointer Data:</span>
            <div style="display:flex;flex-wrap:wrap;gap:4px">${pointersBadge}</div>
          </div>
        `;
        listEl.appendChild(card);
      }
    }

    renderFreeSpaceModule(freeSpaceState, blockSizeKB, activeMode = 'bitmap') {
      if (!freeSpaceState) return;

      document.querySelectorAll('.freespace-tab-btn').forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        const isActive = (mode === activeMode);
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('on', isActive);
      });

      const modes = ['bitmap', 'linked', 'grouping'];
      modes.forEach(m => {
        const el = document.getElementById(`freespace-view-${m}`);
        if (el) el.classList.toggle('hidden', m !== activeMode);
      });

      const bitContainer = document.getElementById('bitmap-bits-array');
      const bitStringEl = document.getElementById('bitmap-string-display');
      if (bitContainer && freeSpaceState.bitmap) {
        bitContainer.innerHTML = '';
        freeSpaceState.bitmap.array.forEach(b => {
          const bitBox = document.createElement('div');
          const isOne = (b.bit === 1);
          bitBox.className = `bit${isOne ? ' u' : ''}`;
          bitBox.innerHTML = `${b.bit}<small>#${b.index}</small>`;
          bitContainer.appendChild(bitBox);
        });

        if (bitStringEl) {
          bitStringEl.textContent = freeSpaceState.bitmap.bitString;
        }
      }

      const listContainer = document.getElementById('freelist-chain-display');
      if (listContainer && freeSpaceState.freeList) {
        listContainer.innerHTML = '';
        const indices = freeSpaceState.freeList.indices;
        if (indices.length === 0) {
          listContainer.innerHTML = '<span style="color:var(--mut);font-style:italic">Tidak ada blok bebas. Disk penuh!</span>';
        } else {
          indices.forEach((idx, i) => {
            const node = document.createElement('div');
            node.style.display = 'inline-flex';
            node.style.alignItems = 'center';
            node.style.gap = '6px';
            node.innerHTML = `
              <span class="pill" style="background:var(--bl);padding:2px 8px">#${idx}</span>
              <span>${i < indices.length - 1 ? '→' : '→ <b style="font-family:monospace">NULL</b>'}</span>
            `;
            listContainer.appendChild(node);
          });
        }
      }

      const groupingContainer = document.getElementById('grouping-cards-display');
      if (groupingContainer && freeSpaceState.grouping) {
        groupingContainer.innerHTML = '';
        const groups = freeSpaceState.grouping.groups;
        if (groups.length === 0) {
          groupingContainer.innerHTML = '<span style="color:var(--mut);font-style:italic">Tidak ada grup blok bebas.</span>';
        } else {
          groups.forEach(g => {
            const card = document.createElement('div');
            card.className = 'stat';
            card.style.textAlign = 'left';

            const blocksList = g.freeBlocks.map(b =>
              `<span class="pill" style="background:var(--bl);padding:1px 6px;font-size:10px">#${b}</span>`
            ).join(' ');

            card.innerHTML = `
              <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--mut);padding-bottom:4px;margin-bottom:6px">
                <b>Grup #${g.groupId}</b>
                <span style="font-size:10px;color:var(--mut)">Header: #${g.headerBlock}</span>
              </div>
              <div style="font-size:11px">
                <span style="display:block;margin-bottom:4px">Daftar Blok Bebas:</span>
                <div style="display:flex;flex-wrap:wrap;gap:4px">${blocksList}</div>
              </div>
              <div style="font-size:11px;margin-top:6px;border-top:1px solid var(--mut);padding-top:4px;display:flex;justify-content:space-between">
                <span>Next Group:</span>
                <strong style="font-family:monospace">${g.nextGroupBlock !== null ? '#' + g.nextGroupBlock : 'NULL'}</strong>
              </div>
            `;
            groupingContainer.appendChild(card);
          });
        }
      }

      const memBitmap = document.getElementById('metric-mem-bitmap');
      const memList = document.getElementById('metric-mem-freelist');
      const memGrouping = document.getElementById('metric-mem-grouping');
      const lookupBitmap = document.getElementById('metric-lookup-bitmap');
      const lookupList = document.getElementById('metric-lookup-freelist');
      const lookupGrouping = document.getElementById('metric-lookup-grouping');

      if (memBitmap) memBitmap.textContent = `${freeSpaceState.bitmap.memoryBytes} B`;
      if (memList) memList.textContent = `${freeSpaceState.freeList.memoryBytes} B`;
      if (memGrouping) memGrouping.textContent = `${freeSpaceState.grouping.memoryBytes} B`;

      if (lookupBitmap) lookupBitmap.textContent = `${freeSpaceState.bitmap.lookupSteps} Langkah`;
      if (lookupList) lookupList.textContent = `${freeSpaceState.freeList.lookupSteps} Langkah`;
      if (lookupGrouping) lookupGrouping.textContent = `${freeSpaceState.grouping.lookupSteps} Langkah`;
    }

    renderDirectoryModule(dirData, activeMode = 'single') {
      if (!dirData) return;

      document.querySelectorAll('.dir-tab-btn').forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        const isActive = (mode === activeMode);
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('on', isActive);
      });

      const maxDepthEl = document.getElementById('dir-max-depth');
      const lookupStepsEl = document.getElementById('dir-lookup-steps');
      const conflictCountEl = document.getElementById('dir-conflict-count');
      const descEl = document.getElementById('dir-mode-desc');

      if (maxDepthEl) maxDepthEl.textContent = dirData.maxDepth;
      if (lookupStepsEl) lookupStepsEl.textContent = `${dirData.lookupSteps} langkah`;
      if (conflictCountEl) conflictCountEl.textContent = dirData.conflictCount;
      if (descEl) descEl.textContent = 'Klasifikasi: ' + dirData.explanation;

      const visualContainer = document.getElementById('directory-visual-container');
      if (!visualContainer) return;
      visualContainer.innerHTML = '';

      if (dirData.mode === 'single') {
        const files = dirData.structure.files;
        let fileRows = files.map(f => `
          <tr>
            <td><b>${f.name}</b></td>
            <td>${f.sizeKB} KB</td>
            <td>[${(f.blocks || []).join(', ')}]</td>
            <td style="font-family:monospace">${f.path}</td>
          </tr>
        `).join('');

        if (files.length === 0) {
          fileRows = `<tr><td colspan="4" class="empty">Direktori kosong</td></tr>`;
        }

        visualContainer.innerHTML = `
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th colspan="4" style="padding:10px">Direktori Root (/)</th>
                </tr>
                <tr style="font-weight:700">
                  <td>Nama File</td>
                  <td>Ukuran</td>
                  <td>Blok Terisi</td>
                  <td>Path</td>
                </tr>
              </thead>
              <tbody>${fileRows}</tbody>
            </table>
          </div>
        `;
      } else if (dirData.mode === 'two_level') {
        const users = dirData.structure.users;
        const usersHtml = users.map(u => {
          const files = u.files.map(f => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--soft);border:1px solid var(--ink);border-radius:6px;margin-bottom:4px;font-size:11px">
              <div>
                <b>${f.name}</b>
                <span style="font-family:monospace;color:#2563EB;margin-left:4px">${f.path}</span>
              </div>
              <span>${f.sizeKB} KB</span>
            </div>
          `).join('');

          return `
            <div class="stat" style="text-align:left">
              <div style="font-weight:700;border-bottom:1px solid var(--mut);padding-bottom:4px;margin-bottom:6px;display:flex;justify-content:space-between">
                <span>User: ${u.username}</span>
                <span style="font-family:monospace;color:var(--mut);font-size:10px">${u.path}</span>
              </div>
              <div>${files || '<span style="color:var(--mut);font-style:italic">Tidak ada file</span>'}</div>
            </div>
          `;
        }).join('');

        visualContainer.innerHTML = `<div class="grid" style="grid-template-columns:1fr 1fr">${usersHtml}</div>`;
      } else if (dirData.mode === 'tree') {
        const tree = dirData.structure;

        const renderSubTree = (node) => {
          if (node.type === 'file') {
            return `
              <div class="tree-node" style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px">
                <div>
                  <b>📄 ${node.name}</b>
                  <span style="font-family:monospace;color:#2563EB;font-size:10px;margin-left:4px">${node.path}</span>
                </div>
                <span>${node.sizeKB} KB</span>
              </div>
            `;
          }

          const childrenHtml = (node.children || []).map(c => renderSubTree(c)).join('');
          return `
            <div class="tree-node" style="margin-bottom:4px">
              <div style="font-weight:700;font-size:12px">
                <span>📁 ${node.name}</span>
                <span style="font-size:10px;color:var(--mut);font-family:monospace">(${node.path})</span>
              </div>
              <div style="padding-left:14px;border-left:2px solid var(--ink);margin:4px 0">
                ${childrenHtml || '<span style="font-size:11px;color:var(--mut);font-style:italic">Folder kosong</span>'}
              </div>
            </div>
          `;
        };

        visualContainer.innerHTML = `
          <div class="tw" style="padding:12px">
            ${renderSubTree(tree)}
          </div>
        `;
      }
    }

    renderActiveFiles(activeFiles, onDelete) {
      const tbody = document.getElementById('active-files-tbody');
      const emptyEl = document.getElementById('active-files-empty');
      if (!tbody) return;

      tbody.innerHTML = '';
      const files = Object.values(activeFiles || {});

      if (files.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
      }

      if (emptyEl) emptyEl.classList.add('hidden');

      files.forEach(f => {
        const tr = document.createElement('tr');
        const blocksStr = (f.allocatedBlocks || []).join(', ');

        tr.innerHTML = `
          <td><b>${f.name || f.id}</b></td>
          <td>${f.sizeKB} KB</td>
          <td>${blocksStr || '-'}</td>
          <td>${f.internalFragKB || 0} KB</td>
          <td style="text-align:right">
            <button class="btn s btn-delete-file" data-file-id="${f.id}">
              Hapus
            </button>
          </td>
        `;

        const btnDel = tr.querySelector('.btn-delete-file');
        if (btnDel) {
          btnDel.addEventListener('click', () => onDelete(f.id));
        }

        tbody.appendChild(tr);
      });
    }

    renderStepLog(step, currentStepIndex, totalSteps) {
      const logContainer = document.getElementById('step-log-text');
      const indicator = document.getElementById('step-progress-indicator');
      const badgeOp = document.getElementById('step-log-badge-op');
      const badgeStatus = document.getElementById('step-log-badge-status');

      if (indicator) {
        indicator.textContent = `Langkah ${currentStepIndex} dari ${Math.max(1, totalSteps - 1)}`;
      }

      const opName = step.op || 'alloc';
      const isOk = !!step.ok;

      if (badgeOp) {
        badgeOp.textContent = opName;
        badgeOp.className = 'pill in';
      }
      if (badgeStatus) {
        badgeStatus.textContent = isOk ? 'Sukses' : 'Gagal';
        badgeStatus.className = isOk ? 'pill ok' : 'pill er';
      }

      if (logContainer) {
        logContainer.textContent = step.log || 'Siap menjalankan simulasi.';
      }
    }
  }

  window.FileBlock.ui.diskView = new DiskViewRenderer();
})();
