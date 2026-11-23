
(function() {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.modules = window.FileBlock.modules || {};

  class FreeSpaceModule {
    constructor() {}

    analyzeFreeSpace(blocks, blockSizeKB = 4, neededBlocks = 4) {
      const totalBlocks = blocks.length;
      const bitmap = [];
      const freeList = [];

      for (let i = 0; i < totalBlocks; i++) {
        const isAllocated = (blocks[i].status === 'allocated');
        bitmap.push({
          index: i,
          bit: isAllocated ? 1 : 0,
          status: blocks[i].status,
          fileId: blocks[i].fileId
        });

        if (!isAllocated) {
          freeList.push(i);
        }
      }

      const groupSize = 4;
      const grouping = [];
      for (let i = 0; i < freeList.length; i += groupSize) {
        const chunk = freeList.slice(i, i + groupSize);
        const hasNextGroup = (i + groupSize < freeList.length);
        const nextGroupPointer = hasNextGroup ? freeList[i + groupSize] : null;

        grouping.push({
          groupId: Math.floor(i / groupSize) + 1,
          headerBlock: chunk[0],
          freeBlocks: chunk,
          nextGroupBlock: nextGroupPointer
        });
      }

      const bitmapMemoryBytes = Math.max(1, Math.ceil(totalBlocks / 8));
      let bitmapLookupSteps = 0;
      let foundZeroes = 0;
      for (let i = 0; i < bitmap.length; i++) {
        bitmapLookupSteps++;
        if (bitmap[i].bit === 0) {
          foundZeroes++;
          if (foundZeroes >= neededBlocks) break;
        }
      }

      const freeListMemoryBytes = freeList.length * 4;
      const freeListLookupSteps = Math.min(neededBlocks, freeList.length);

      const groupingMemoryBytes = grouping.length * (groupSize * 4);
      const groupingLookupSteps = Math.ceil(Math.min(neededBlocks, freeList.length) / (groupSize - 1)) || 1;

      return {
        totalFreeBlocks: freeList.length,
        totalFreeKB: freeList.length * blockSizeKB,
        bitmap: {
          array: bitmap,
          bitString: bitmap.map(b => b.bit).join(''),
          memoryBytes: bitmapMemoryBytes,
          lookupSteps: bitmapLookupSteps,
          explanation: `Memori: ${bitmapMemoryBytes} Byte (${totalBlocks} bit). Mencari ${neededBlocks} blok bebas membutuhkan pemindaian ${bitmapLookupSteps} bit.`
        },
        freeList: {
          indices: freeList,
          memoryBytes: freeListMemoryBytes,
          lookupSteps: freeListLookupSteps,
          explanation: `Memori: ${freeListMemoryBytes} Byte (${freeList.length} pointer × 4B). Mengambil ${neededBlocks} blok bebas membutuhkan ${freeListLookupSteps} langkah traversi pointer.`
        },
        grouping: {
          groups: grouping,
          groupSize,
          memoryBytes: groupingMemoryBytes,
          lookupSteps: groupingLookupSteps,
          explanation: `Memori: ${groupingMemoryBytes} Byte (${grouping.length} grup penunjuk). Mengambil ${neededBlocks} blok bebas membutuhkan ${groupingLookupSteps} langkah pembacaan blok penunjuk.`
        }
      };
    }
  }

  window.FileBlock.modules.freespace = new FreeSpaceModule();
})();

