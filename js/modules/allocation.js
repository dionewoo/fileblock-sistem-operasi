
(function() {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.modules = window.FileBlock.modules || {};

  class AllocationModule {
    constructor() {}

    allocateFile(diskModel, blocks, activeFiles, op, config, auxiliaryState) {
      const method = config.method || 'contiguous';
      const fileId = op.file || op.name;
      const fileName = op.name || op.file;
      const sizeKB = Number(op.sizeKB) || config.blockSizeKB;
      const blockSizeKB = config.blockSizeKB;
      const blocksNeeded = Math.ceil(sizeKB / blockSizeKB);
      const internalFragKB = (blocksNeeded * blockSizeKB) - sizeKB;
      const colorObj = diskModel.getFileColor(fileId);

      if (method === 'contiguous') {
        return this.allocateContiguous(diskModel, blocks, activeFiles, {
          fileId, fileName, sizeKB, blocksNeeded, internalFragKB, colorObj
        }, config);
      } else if (method === 'linked') {
        return this.allocateLinked(diskModel, blocks, activeFiles, {
          fileId, fileName, sizeKB, blocksNeeded, internalFragKB, colorObj
        }, config, auxiliaryState.fat);
      } else if (method === 'indexed') {
        return this.allocateIndexed(diskModel, blocks, activeFiles, {
          fileId, fileName, sizeKB, blocksNeeded, internalFragKB, colorObj
        }, config, auxiliaryState.inodes);
      }
    }

    allocateContiguous(diskModel, blocks, activeFiles, fileData, config) {
      const { fileId, fileName, sizeKB, blocksNeeded, internalFragKB, colorObj } = fileData;
      const startIdx = diskModel.findFirstFit(blocks, blocksNeeded);
      const holes = diskModel.findFreeHoles(blocks);
      const totalFree = holes.reduce((acc, h) => acc + h.length, 0);
      const maxHole = holes.reduce((max, h) => Math.max(max, h.length), 0);

      if (startIdx === -1) {
        const isExternalFrag = totalFree >= blocksNeeded;
        let failLog = `Gagal mengalokasikan File '${fileName}' (${sizeKB} KB = ${blocksNeeded} blok). `;
        if (isExternalFrag) {
          failLog += `Fragmentasi Eksternal: Total ruang kosong ${totalFree} blok (${totalFree * config.blockSizeKB} KB), namun lubang terbesar hanya ${maxHole} blok kontigu.`;
        } else {
          failLog += `Disk penuh: sisa ${totalFree} blok, butuh ${blocksNeeded} blok.`;
        }

        return {
          ok: false,
          failureReason: isExternalFrag ? 'EXTERNAL_FRAGMENTATION' : 'OUT_OF_SPACE',
          log: failLog,
          blocks,
          activeFiles,
          allocatedIndices: [],
          internalFragKB: 0
        };
      }

      const allocatedIndices = [];
      for (let i = 0; i < blocksNeeded; i++) {
        const idx = startIdx + i;
        allocatedIndices.push(idx);
        blocks[idx] = {
          ...blocks[idx],
          status: 'allocated',
          fileId,
          fileName,
          blockOffset: i,
          totalFileBlocks: blocksNeeded,
          isIndexBlock: false,
          nextPointer: (i < blocksNeeded - 1) ? idx + 1 : -1,
          internalFragKB: (i === blocksNeeded - 1) ? internalFragKB : 0,
          color: colorObj.bg,
          colorBorder: colorObj.border,
          colorText: colorObj.text
        };
      }

      activeFiles[fileId] = {
        id: fileId,
        name: fileName,
        sizeKB,
        blocksCount: blocksNeeded,
        startBlock: startIdx,
        allocatedBlocks: allocatedIndices,
        internalFragKB,
        color: colorObj.bg,
        colorBorder: colorObj.border,
        colorText: colorObj.text
      };

      return {
        ok: true,
        log: `File ${fileName} (${sizeKB} KB) dialokasikan pada blok ${startIdx}-${startIdx + blocksNeeded - 1}. Sisa frag. internal: ${internalFragKB} KB.`,
        blocks,
        activeFiles,
        allocatedIndices,
        internalFragKB
      };
    }

    allocateLinked(diskModel, blocks, activeFiles, fileData, config, fatTable) {
      const { fileId, fileName, sizeKB, blocksNeeded, internalFragKB, colorObj } = fileData;
      const freeIndices = diskModel.getFreeBlockIndices(blocks);

      if (freeIndices.length < blocksNeeded) {
        return {
          ok: false,
          failureReason: 'OUT_OF_SPACE',
          log: `Gagal mengalokasikan File '${fileName}': disk penuh (tersedia ${freeIndices.length} blok, butuh ${blocksNeeded} blok).`,
          blocks,
          activeFiles,
          fat: fatTable,
          allocatedIndices: [],
          internalFragKB: 0
        };
      }

      const allocatedIndices = freeIndices.slice(0, blocksNeeded);

      for (let i = 0; i < blocksNeeded; i++) {
        const curIdx = allocatedIndices[i];
        const nextIdx = (i < blocksNeeded - 1) ? allocatedIndices[i + 1] : -1;

        blocks[curIdx] = {
          ...blocks[curIdx],
          status: 'allocated',
          fileId,
          fileName,
          blockOffset: i,
          totalFileBlocks: blocksNeeded,
          isIndexBlock: false,
          nextPointer: nextIdx,
          internalFragKB: (i === blocksNeeded - 1) ? internalFragKB : 0,
          color: colorObj.bg,
          colorBorder: colorObj.border,
          colorText: colorObj.text
        };

        if (fatTable) {
          fatTable[curIdx] = {
            blockIndex: curIdx,
            fileId,
            next: nextIdx,
            status: 'ALLOCATED'
          };
        }
      }

      activeFiles[fileId] = {
        id: fileId,
        name: fileName,
        sizeKB,
        blocksCount: blocksNeeded,
        startBlock: allocatedIndices[0],
        allocatedBlocks: allocatedIndices,
        internalFragKB,
        color: colorObj.bg,
        colorBorder: colorObj.border,
        colorText: colorObj.text
      };

      const chainStr = allocatedIndices.join(' → ');
      return {
        ok: true,
        log: `File ${fileName} (${sizeKB} KB) dialokasikan via Linked FAT: [${chainStr} → EOF]. Frag. internal: ${internalFragKB} KB.`,
        blocks,
        activeFiles,
        fat: fatTable,
        allocatedIndices,
        internalFragKB
      };
    }

    allocateIndexed(diskModel, blocks, activeFiles, fileData, config, inodeTable) {
      const { fileId, fileName, sizeKB, blocksNeeded, internalFragKB, colorObj } = fileData;
      const freeIndices = diskModel.getFreeBlockIndices(blocks);

      if (freeIndices.length < blocksNeeded) {
        return {
          ok: false,
          failureReason: 'OUT_OF_SPACE',
          log: `Gagal mengalokasikan File '${fileName}': disk penuh (tersedia ${freeIndices.length} blok, butuh ${blocksNeeded} blok).`,
          blocks,
          activeFiles,
          inodes: inodeTable,
          allocatedIndices: [],
          internalFragKB: 0
        };
      }

      const allocatedDataBlocks = freeIndices.slice(0, blocksNeeded);
      const inodeNum = Object.keys(inodeTable || {}).length + 1;

      for (let i = 0; i < blocksNeeded; i++) {
        const curIdx = allocatedDataBlocks[i];
        blocks[curIdx] = {
          ...blocks[curIdx],
          status: 'allocated',
          fileId,
          fileName,
          blockOffset: i,
          totalFileBlocks: blocksNeeded,
          isIndexBlock: false,
          nextPointer: `i-${inodeNum}`,
          internalFragKB: (i === blocksNeeded - 1) ? internalFragKB : 0,
          color: colorObj.bg,
          colorBorder: colorObj.border,
          colorText: colorObj.text
        };
      }

      if (inodeTable) {
        inodeTable[fileId] = {
          inodeNumber: inodeNum,
          fileId,
          name: fileName,
          sizeKB,
          directPointers: [...allocatedDataBlocks],
          color: colorObj.bg,
          colorBorder: colorObj.border
        };
      }

      activeFiles[fileId] = {
        id: fileId,
        name: fileName,
        sizeKB,
        blocksCount: blocksNeeded,
        inodeNumber: inodeNum,
        allocatedBlocks: allocatedDataBlocks,
        internalFragKB,
        color: colorObj.bg,
        colorBorder: colorObj.border,
        colorText: colorObj.text
      };

      return {
        ok: true,
        log: `File ${fileName} (${sizeKB} KB) dialokasikan via Indexed (Inode #${inodeNum}): pointer langsung ke [${allocatedDataBlocks.join(', ')}]. Frag. internal: ${internalFragKB} KB.`,
        blocks,
        activeFiles,
        inodes: inodeTable,
        allocatedIndices: allocatedDataBlocks,
        internalFragKB
      };
    }

    deallocateFile(diskModel, blocks, activeFiles, fileId, auxiliaryState) {
      const file = activeFiles[fileId];
      if (!file) {
        return {
          ok: false,
          log: `File '${fileId}' tidak ditemukan untuk dihapus.`,
          blocks,
          activeFiles,
          ...auxiliaryState
        };
      }

      const freedBlocks = [...(file.allocatedBlocks || [])];

      freedBlocks.forEach(idx => {
        if (blocks[idx]) {
          blocks[idx] = {
            index: idx,
            status: 'hole',
            fileId: null,
            fileName: null,
            blockOffset: 0,
            totalFileBlocks: 0,
            isIndexBlock: false,
            nextPointer: null,
            internalFragKB: 0,
            color: null,
            colorBorder: null,
            colorText: null
          };
        }

        if (auxiliaryState.fat && auxiliaryState.fat[idx]) {
          auxiliaryState.fat[idx] = {
            blockIndex: idx,
            fileId: null,
            next: null,
            status: 'FREE'
          };
        }
      });

      if (auxiliaryState.inodes && auxiliaryState.inodes[fileId]) {
        delete auxiliaryState.inodes[fileId];
      }

      delete activeFiles[fileId];

      return {
        ok: true,
        log: `File ${file.name || fileId} dihapus. Blok [${freedBlocks.join(', ')}] kini berstatus Bebas (Lubang/Hole).`,
        blocks,
        activeFiles,
        freedBlocks,
        ...auxiliaryState
      };
    }

    calculateAccessCost(method, accessN = 4) {
      if (method === 'contiguous') {
        return {
          cost: 1,
          description: `1 Akses Langsung (Alamat = Start + ${accessN - 1})`
        };
      } else if (method === 'linked') {
        return {
          cost: accessN,
          description: `${accessN} Akses Sekuensial (Menelusuri pointer FAT ke-1 s/d ke-${accessN})`
        };
      } else if (method === 'indexed') {
        return {
          cost: 2,
          description: `2 Akses (1 baca Inode/Index Block + 1 langsung ke Blok Data ke-${accessN})`
        };
      }
      return { cost: 1, description: '1 Akses' };
    }
  }

  window.FileBlock.modules.allocation = new AllocationModule();
})();

