
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
      tip.className = 'fixed hidden px-3 py-2 text-xs bg-white border border-slate-900 rounded-none pointer-events-none z-50 text-black leading-tight';
      document.body.appendChild(tip);

      document.addEventListener('mousemove', (e) => {
        const t = document.getElementById('disk-tooltip');
        if (t && !t.classList.contains('hidden')) {
          t.style.left = `${e.clientX + 12}px`;
          t.style.top = `${e.clientY + 12}px`;
        }
      });
    }

    renderDiskGrid(blocks, method = 'contiguous') {
      const container = document.getElementById('disk-grid');
      if (!container) return;

      container.innerHTML = '';
      const total = blocks.length;

      let colsClass = 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12';
      if (total <= 16) {
        colsClass = 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6';
      } else if (total > 32) {
        colsClass = 'grid-cols-4 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12';
      }
      container.className = `grid ${colsClass} gap-1.5 w-full`;

      blocks.forEach((b, idx) => {
        const blockEl = document.createElement('div');
        blockEl.setAttribute('data-index', idx);

        let statusClass = 'bg-white hover:bg-slate-50 border border-slate-300 text-black';
        let contentHtml = '';

        if (b.status === 'allocated') {
          statusClass = 'border border-blue-600 bg-blue-100 text-black font-semibold';
          let pointerInfo = '';
          if (method === 'linked') {
            pointerInfo = b.nextPointer !== -1 && b.nextPointer !== null
              ? `<span class="text-[9px] font-mono text-blue-700">→ #${b.nextPointer}</span>`
              : `<span class="text-[9px] font-mono text-blue-700 font-bold">EOF</span>`;
          } else if (method === 'indexed') {
            pointerInfo = `<span class="text-[9px] font-mono text-blue-700">${b.nextPointer || 'inode'}</span>`;
          }

          contentHtml = `
            <div class="flex items-center justify-between w-full leading-none">
              <span class="text-[11px] font-bold text-black truncate">${b.fileName || b.fileId}</span>
              ${pointerInfo}
            </div>
            <div class="text-[9px] text-slate-600 font-mono mt-0.5">
              b-${b.blockOffset + 1}/${b.totalFileBlocks}
            </div>
          `;
        } else if (b.status === 'hole') {
          statusClass = 'hole-state border border-dashed border-blue-600 bg-white text-black';
          contentHtml = `
            <span class="text-[9px] font-mono text-blue-700">
              [lubang]
            </span>
          `;
        }

        blockEl.className = `disk-block flex flex-col justify-between p-1 rounded-none cursor-pointer min-h-[38px] ${statusClass}`;
        blockEl.innerHTML = `
          <div class="flex items-center justify-between w-full text-[10px] font-mono text-black leading-none">
            <span class="font-bold">#${idx}</span>
          </div>
          <div class="w-full">${contentHtml}</div>
        `;

        blockEl.addEventListener('mouseenter', () => this.showTooltip(b, method));
        blockEl.addEventListener('mouseleave', () => this.hideTooltip());

        container.appendChild(blockEl);
      });
    }

    showTooltip(b, method) {
      const tip = document.getElementById('disk-tooltip');
      if (!tip) return;

      let statusBadge = 'Blok Bebas';
      let detail = 'Blok belum terisi data file.';

      if (b.status === 'allocated') {
        statusBadge = `Terisi (${b.fileName || b.fileId})`;
        detail = `
          <div>File: <strong>${b.fileName || b.fileId}</strong> (Bagian ${b.blockOffset + 1} dari ${b.totalFileBlocks})</div>
          <div>Frag. Internal: <strong>${b.internalFragKB || 0} KB</strong></div>
          ${method === 'linked' ? `<div>Next: <strong>${b.nextPointer === -1 ? 'EOF' : '#' + b.nextPointer}</strong></div>` : ''}
          ${method === 'indexed' ? `<div>Pointer: <strong>${b.nextPointer || 'Indeks'}</strong></div>` : ''}
        `;
      } else if (b.status === 'hole') {
        statusBadge = 'Lubang (Fragmentasi Eksternal)';
        detail = 'Blok bekas file yang dihapus.';
      }

      tip.innerHTML = `
        <div class="font-bold border-b border-black pb-1 mb-1 text-black">Blok Memori #${b.index}</div>
        <div class="text-[11px] space-y-0.5 text-black">
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

        let nextBadge = '<span class="text-slate-400 font-mono">-</span>';
        if (isAllocated) {
          if (entry.next === -1 || entry.next === null) {
            nextBadge = '<span class="px-1.5 py-0.2 bg-slate-200 text-black font-bold text-[10px]">EOF</span>';
          } else {
            nextBadge = `<span class="px-1.5 py-0.2 bg-blue-100 text-black font-bold font-mono text-[10px]">#${entry.next}</span>`;
          }
        }

        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-200 text-xs text-black ${isAllocated ? 'bg-blue-50/40' : ''}`;
        tr.innerHTML = `
          <td class="py-1 px-3 font-mono font-bold text-black">#${entry.blockIndex}</td>
          <td class="py-1 px-3 font-medium text-black">${fileName}</td>
          <td class="py-1 px-3">${nextBadge}</td>
          <td class="py-1 px-3 font-medium text-black">${entry.status}</td>
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
        card.className = 'p-2.5 bg-white border border-slate-300 rounded-sm space-y-1.5 text-black';

        const pointersBadge = item.directPointers.map((p, i) =>
          `<span class="px-1.5 py-0.5 border border-blue-400 bg-blue-50 text-black font-mono text-[10px]">p[${i}]: #${p}</span>`
        ).join(' ');

        card.innerHTML = `
          <div class="flex items-center justify-between border-b border-slate-200 pb-1 text-black">
            <span class="font-bold text-xs">Inode #${item.inodeNumber}</span>
            <span class="text-xs font-semibold text-blue-700">${item.name} (${item.sizeKB} KB)</span>
          </div>
          <div class="text-[11px] text-black">
            <span class="font-semibold block mb-0.5">Pointer Blok Data:</span>
            <div class="flex flex-wrap gap-1">${pointersBadge}</div>
          </div>
        `;
        listEl.appendChild(card);
      }
    }

    renderFreeSpaceModule(freeSpaceState, blockSizeKB, activeMode = 'bitmap') {
      if (!freeSpaceState) return;

      document.querySelectorAll('.freespace-tab-btn').forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        btn.classList.toggle('active', mode === activeMode);
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
          bitBox.className = `bit-box flex flex-col items-center justify-center border text-xs font-mono font-bold ${isOne ? 'bg-blue-100 border-blue-600 text-black' : 'bg-white border-blue-600 border-dashed text-black'
            }`;
          bitBox.innerHTML = `
            <span>${b.bit}</span>
            <span class="text-[8px] font-normal">#${b.index}</span>
          `;
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
          listContainer.innerHTML = '<span class="text-xs text-black">Tidak ada blok bebas.</span>';
        } else {
          indices.forEach((idx, i) => {
            const node = document.createElement('div');
            node.className = 'flex items-center gap-1.5 text-black';
            node.innerHTML = `
              <div class="px-2 py-0.5 border border-slate-400 bg-white text-xs font-mono font-bold text-black">
                Blok #${idx}
              </div>
              <span class="text-black text-xs">${i < indices.length - 1 ? '→' : '→ <span class="font-bold">NULL</span>'}</span>
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
          groupingContainer.innerHTML = '<span class="text-xs text-black">Tidak ada grup blok bebas.</span>';
        } else {
          groups.forEach(g => {
            const card = document.createElement('div');
            card.className = 'p-2.5 bg-white border border-slate-300 rounded-sm space-y-1.5 text-black';

            const blocksList = g.freeBlocks.map(b =>
              `<span class="px-1.5 py-0.2 border border-blue-400 bg-blue-50 text-black font-mono text-[11px]">#${b}</span>`
            ).join(' ');

            card.innerHTML = `
              <div class="flex items-center justify-between border-b border-slate-200 pb-1">
                <span class="font-bold text-xs text-black">Grup #${g.groupId}</span>
                <span class="text-[10px] text-slate-600">Header: #${g.headerBlock}</span>
              </div>
              <div class="text-xs">
                <span class="text-[11px] font-semibold block mb-0.5">Daftar Blok Bebas:</span>
                <div class="flex flex-wrap gap-1">${blocksList}</div>
              </div>
              <div class="text-[11px] pt-1 border-t border-slate-200 flex items-center justify-between">
                <span>Next Group:</span>
                <strong class="font-mono text-black">${g.nextGroupBlock !== null ? '#' + g.nextGroupBlock : 'NULL'}</strong>
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

      if (lookupBitmap) lookupBitmap.textContent = `${freeSpaceState.bitmap.lookupSteps} langkah`;
      if (lookupList) lookupList.textContent = `${freeSpaceState.freeList.lookupSteps} langkah`;
      if (lookupGrouping) lookupGrouping.textContent = `${freeSpaceState.grouping.lookupSteps} langkah`;
    }

    renderDirectoryModule(dirData, activeMode = 'single') {
      if (!dirData) return;

      document.querySelectorAll('.dir-tab-btn').forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        btn.classList.toggle('active', mode === activeMode);
      });

      const maxDepthEl = document.getElementById('dir-max-depth');
      const lookupStepsEl = document.getElementById('dir-lookup-steps');
      const conflictCountEl = document.getElementById('dir-conflict-count');
      const descEl = document.getElementById('dir-mode-desc');

      if (maxDepthEl) maxDepthEl.textContent = dirData.maxDepth;
      if (lookupStepsEl) lookupStepsEl.textContent = `${dirData.lookupSteps} langkah`;
      if (conflictCountEl) conflictCountEl.textContent = dirData.conflictCount;
      if (descEl) descEl.textContent = dirData.explanation;

      const visualContainer = document.getElementById('directory-visual-container');
      if (!visualContainer) return;
      visualContainer.innerHTML = '';

      if (dirData.mode === 'single') {
        const files = dirData.structure.files;
        let fileRows = files.map(f => `
          <tr class="border-b border-slate-200 text-xs text-black">
            <td class="py-1.5 px-3 font-semibold text-black">${f.name}</td>
            <td class="py-1.5 px-3 text-black">${f.sizeKB} KB</td>
            <td class="py-1.5 px-3 font-mono text-[11px] text-blue-700">[${(f.blocks || []).join(', ')}]</td>
            <td class="py-1.5 px-3 font-mono text-[11px] text-black">${f.path}</td>
          </tr>
        `).join('');

        if (files.length === 0) {
          fileRows = `<tr><td colspan="4" class="py-3 text-center text-xs text-black">Direktori kosong</td></tr>`;
        }

        visualContainer.innerHTML = `
          <div class="border border-slate-300 rounded-sm bg-white">
            <div class="p-2 bg-slate-100 border-b border-slate-300 text-xs font-bold text-black">
              Direktori Root (/)
            </div>
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-black border-b border-slate-200 text-[11px]">
                <tr>
                  <th class="py-1.5 px-3">Nama File</th>
                  <th class="py-1.5 px-3">Ukuran</th>
                  <th class="py-1.5 px-3">Blok Terisi</th>
                  <th class="py-1.5 px-3">Path</th>
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
            <div class="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 text-xs text-black">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-black">${f.name}</span>
                <span class="text-[10px] text-blue-700 font-mono">${f.path}</span>
              </div>
              <span class="text-[11px] font-mono text-black">${f.sizeKB} KB</span>
            </div>
          `).join('');

          return `
            <div class="p-2.5 bg-white border border-slate-300 rounded-none space-y-1 text-black">
              <div class="font-bold text-xs text-black border-b border-slate-200 pb-0.5">
                Pemilik (User): ${u.username} (${u.path})
              </div>
              <div class="space-y-1">
                ${files || '<span class="text-xs text-black">Tidak ada file</span>'}
              </div>
            </div>
          `;
        }).join('');

        visualContainer.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${usersHtml}</div>`;
      } else if (dirData.mode === 'tree') {
        const tree = dirData.structure;

        const renderSubTree = (node) => {
          if (node.type === 'file') {
            return `
              <div class="tree-node flex items-center justify-between py-0.5 text-xs text-black">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-black">${node.name}</span>
                  <span class="text-[10px] text-blue-700 font-mono">${node.path}</span>
                </div>
                <span class="text-[10px] font-mono text-black">${node.sizeKB} KB</span>
              </div>
            `;
          }

          const childrenHtml = (node.children || []).map(c => renderSubTree(c)).join('');
          return `
            <div class="tree-node space-y-0.5 text-black">
              <div class="text-xs font-bold text-black flex items-center gap-1.5">
                <span>[dir] ${node.name}</span>
                <span class="text-[10px] font-normal text-slate-600 font-mono">(${node.path})</span>
              </div>
              <div class="pl-3 border-l border-slate-300 space-y-0.5 my-1">
                ${childrenHtml || '<span class="text-[11px] text-slate-500 italic">Folder kosong</span>'}
              </div>
            </div>
          `;
        };

        visualContainer.innerHTML = `
          <div class="p-3 bg-white border border-slate-300 rounded-sm text-black">
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
        tr.className = 'border-b border-slate-200 text-xs text-black hover:bg-slate-50';

        const blocksStr = (f.allocatedBlocks || []).map(b => `#${b}`).join(', ');

        tr.innerHTML = `
          <td class="py-1.5 px-2 font-bold text-black">${f.name || f.id}</td>
          <td class="py-1.5 px-2 text-black">${f.sizeKB} KB</td>
          <td class="py-1.5 px-2 font-mono text-[11px] text-blue-700">${blocksStr || '-'}</td>
          <td class="py-1.5 px-2 text-black">${f.internalFragKB || 0} KB</td>
          <td class="py-1.5 px-2 text-right">
            <button class="btn-delete-file px-2 py-0.5 text-[11px] font-semibold text-black bg-white hover:bg-slate-100 border border-slate-400" data-file-id="${f.id}">
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
      const bannerContainer = document.getElementById('step-alert-banner');
      const indicator = document.getElementById('step-progress-indicator');
      if (!logContainer) return;

      if (indicator) {
        indicator.textContent = `Langkah ${currentStepIndex} dari ${totalSteps - 1}`;
      }

      if (bannerContainer) {
        if (!step.ok) {
          bannerContainer.classList.remove('hidden');
          bannerContainer.className = 'p-2.5 mb-2.5 border border-blue-600 bg-blue-50 text-black text-xs font-medium';
          bannerContainer.innerHTML = `
            <div>
              <strong class="text-black">Status: ${step.failureReason === 'EXTERNAL_FRAGMENTATION' ? 'Fragmentasi Eksternal Terjadi' : 'Alokasi Gagal'}</strong>
              <p class="mt-0.5 text-black">${step.log}</p>
            </div>
          `;
        } else {
          bannerContainer.classList.add('hidden');
        }
      }

      logContainer.innerHTML = `
        <div class="flex items-center gap-2 mb-1 text-black">
          <span class="px-1.5 py-0.5 bg-blue-100 border border-blue-300 font-bold text-[11px] text-black">${step.op}</span>
          <span>•</span>
          <span class="text-xs font-semibold text-black">${step.ok ? 'Sukses' : 'Gagal'}</span>
        </div>
        <p class="text-xs text-black leading-normal">${step.log}</p>
      `;
    }
  }

  window.FileBlock.ui.diskView = new DiskViewRenderer();
})();
