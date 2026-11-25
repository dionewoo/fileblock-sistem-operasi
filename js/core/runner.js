
(function() {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.core = window.FileBlock.core || {};

  class SimulationRunner {
    constructor() {}

    computeStepMetrics(diskModel, currentBlocks, activeFiles, method, diskSize, blockKB, accessN, allocatedCount, failedCount, externalFragEncountered) {
      let internalFragKB = 0;
      let maxBlocksInAnyFile = 0;
      const fileIds = Object.keys(activeFiles);

      fileIds.forEach(fId => {
        const f = activeFiles[fId];
        internalFragKB += (f.internalFragKB || 0);
        if (f.blocksCount > maxBlocksInAnyFile) {
          maxBlocksInAnyFile = f.blocksCount;
        }
      });

      const holes = diskModel.findFreeHoles(currentBlocks);
      const totalFree = holes.reduce((acc, h) => acc + h.length, 0);
      const maxHole = holes.reduce((max, h) => Math.max(max, h.length), 0);
      const externalFrag = (method === 'contiguous') && (externalFragEncountered || (holes.length > 1 && totalFree > maxHole));

      let readCostBlockN = 0;
      if (fileIds.length > 0) {
        if (method === 'contiguous') {
          readCostBlockN = 1;
        } else if (method === 'linked') {
          readCostBlockN = Math.min(accessN, Math.max(1, maxBlocksInAnyFile));
        } else if (method === 'indexed') {
          readCostBlockN = 2;
        }
      }

      let metadataEntries = 0;
      let structureMemoryBytes = 0;
      if (method === 'contiguous') {
        metadataEntries = fileIds.length * 2;
        structureMemoryBytes = fileIds.length * 8;
      } else if (method === 'linked') {
        metadataEntries = diskSize;
        structureMemoryBytes = diskSize * 4;
      } else if (method === 'indexed') {
        metadataEntries = fileIds.length * 4;
        structureMemoryBytes = fileIds.length * 64;
      }

      return {
        allocatedCount,
        failedCount,
        internalFragKB,
        externalFrag,
        readCostBlockN,
        metadataEntries,
        structureMemoryBytes,
        activeFilesCount: fileIds.length
      };
    }

    run(input, method = 'contiguous') {
      const diskSize = Math.max(4, Math.min(128, Number(input.diskSize) || 12));
      const blockKB = Math.max(1, Number(input.blockKB) || 4);
      const accessN = Math.max(1, Math.min(diskSize, Number(input.accessN) || 4));
      const ops = Array.isArray(input.ops) ? input.ops : [];

      const diskModel = new window.FileBlock.core.DiskModel(diskSize, blockKB);
      const allocationModule = window.FileBlock.modules.allocation;
      const freeSpaceModule = window.FileBlock.modules.freespace;

      let currentBlocks = diskModel.createEmptyBlocks(diskSize);
      let activeFiles = {};
      let fatTable = [];
      let inodeTable = {};

      if (method === 'linked') {
        for (let i = 0; i < diskSize; i++) {
          fatTable.push({
            blockIndex: i,
            fileId: null,
            next: null,
            status: 'FREE'
          });
        }
      }

      const steps = [];
      let allocatedCount = 0;
      let failedCount = 0;
      let externalFragEncountered = false;

      const initialFreeState = freeSpaceModule.analyzeFreeSpace(currentBlocks, blockKB, accessN);
      const initialMetrics = this.computeStepMetrics(
        diskModel, currentBlocks, activeFiles, method, diskSize, blockKB, accessN, 0, 0, false
      );

      steps.push({
        stepIndex: 0,
        op: 'init',
        operation: { type: 'init', name: 'Inisialisasi', sizeKB: 0 },
        disk: currentBlocks.map(b => b.fileId || null),
        blocks: diskModel.cloneBlocks(currentBlocks),
        ok: true,
        log: ops.length === 0
          ? `Disk kosong (${diskSize} blok, ${blockKB} KB/blok). Silakan masukkan file melalui form Tambah File.`
          : `Disk diinisialisasi (${diskSize} blok, ${blockKB} KB/blok). Siap menjalankan langkah alokasi.`,
        fat: method === 'linked' ? JSON.parse(JSON.stringify(fatTable)) : null,
        inodes: method === 'indexed' ? JSON.parse(JSON.stringify(inodeTable)) : null,
        freeSpaceState: initialFreeState,
        activeFiles: {},
        failureReason: null,
        metrics: initialMetrics
      });

      ops.forEach((op, idx) => {
        const stepNum = idx + 1;
        const opType = (op.type || '').toLowerCase();
        const fileName = op.name || op.file || `File ${stepNum}`;
        const fileId = op.file || op.name || `F${stepNum}`;
        const sizeKB = Number(op.sizeKB) || blockKB;

        let res = null;
        const config = { totalBlocks: diskSize, blockSizeKB: blockKB, method, accessN };
        const aux = {
          fat: method === 'linked' ? fatTable : null,
          inodes: method === 'indexed' ? inodeTable : null
        };

        if (opType === 'create') {
          res = allocationModule.allocateFile(diskModel, diskModel.cloneBlocks(currentBlocks), JSON.parse(JSON.stringify(activeFiles)), {
            file: fileId,
            name: fileName,
            sizeKB,
            customBlocks: op.customBlocks
          }, config, aux);

          if (res.ok) {
            allocatedCount++;
            currentBlocks = res.blocks;
            activeFiles = res.activeFiles;
            if (res.fat) fatTable = res.fat;
            if (res.inodes) inodeTable = res.inodes;
          } else {
            failedCount++;
            if (res.failureReason === 'EXTERNAL_FRAGMENTATION') {
              externalFragEncountered = true;
            }
          }
        } else if (opType === 'delete') {
          res = allocationModule.deallocateFile(diskModel, diskModel.cloneBlocks(currentBlocks), JSON.parse(JSON.stringify(activeFiles)), fileId, aux);
          currentBlocks = res.blocks;
          activeFiles = res.activeFiles;
          if (res.fat) fatTable = res.fat;
          if (res.inodes) inodeTable = res.inodes;
        }

        const currentFreeState = freeSpaceModule.analyzeFreeSpace(currentBlocks, blockKB, accessN);
        const stepMetrics = this.computeStepMetrics(
          diskModel, currentBlocks, activeFiles, method, diskSize, blockKB, accessN, allocatedCount, failedCount, externalFragEncountered
        );

        steps.push({
          stepIndex: stepNum,
          op: `${opType === 'create' ? 'Buat' : 'Hapus'} ${fileName}`,
          operation: { type: opType, file: fileId, name: fileName, sizeKB },
          disk: currentBlocks.map(b => b.fileId || null),
          blocks: diskModel.cloneBlocks(currentBlocks),
          ok: res ? res.ok : true,
          log: res ? res.log : '',
          fat: method === 'linked' ? JSON.parse(JSON.stringify(fatTable)) : null,
          inodes: method === 'indexed' ? JSON.parse(JSON.stringify(inodeTable)) : null,
          freeSpaceState: currentFreeState,
          activeFiles: JSON.parse(JSON.stringify(activeFiles)),
          failureReason: res ? res.failureReason : null,
          metrics: stepMetrics
        });
      });

      const finalMetrics = steps[steps.length - 1].metrics;

      return {
        method,
        steps,
        metrics: finalMetrics
      };
    }

    runAllMethods(input) {
      return {
        contiguous: this.run(input, 'contiguous'),
        linked: this.run(input, 'linked'),
        indexed: this.run(input, 'indexed')
      };
    }
  }

  window.FileBlock.core.runner = new SimulationRunner();
  window.FileBlock.run = function(input, method) {
    return window.FileBlock.core.runner.run(input, method || 'contiguous');
  };
})();