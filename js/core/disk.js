(function() {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.core = window.FileBlock.core || {};

  class DiskModel {
    constructor(totalBlock, blockSizeKB){
      this.totalBlock = totalBlock;
      this.blockSizeKB = blockSizeKB;
    }
  }

  static createBlock(index){
    index: index,
    status: 'free',
    fileId: null,
    fileName: null,
    blockOffset: 0,
    totalFileBlock: 0,
    nextPointer: null,
    internalFragKB: 0
  };
  
  createEmptyBlocks(n){
    const size = n === undefined ? this.totalBlocks : n;
    const blocks = [];
    for (let i =0; i < size; i++) blocks.push(DiskModel.createBlocks(i));
    return blocks;
  }
  
  cloneBlocks(blocks){
    return blocks.map(function (b) { return Object.assign({}, b); });
  }
  
  calcBlocksNeeded(sizeKB){
    return Math.ceil(sizeKB / this.blockSizeKB);
  }
  
  calcInternalFragKB(sizeKB){
    return this.calcBlocksNeeded(sizeKB) * this.blockSizeKB - sizeKB;
  }
  
  itsFree(blocks){
    return block.status !== 'allocated';
  }
  
  findFreeBlockIndices(blocks){
    const list = [];
      blocks.forEach(function (b, i) { if (b.status !== 'allocated') list.push(i); });
      return list;
  }
  
  findFreeHoles(blocks){
    const holes = [];
      let start = -1;
      for (let i = 0; i <= blocks.length; i++) {
        const empty = i < blocks.length && blocks[i].status !== 'allocated';
        if (empty && start < 0) start = i;
        if (!empty && start >= 0) {
          holes.push({ start: start, end: i - 1, length: i - start });
          start = -1;
        }
      }
      return holes;
  }
  
  largestHoleLength(blocks){
    return this.findFreeHoles(blocks).reduce(function (m, h) {
        return Math.max(m, h.length);
      }, 0);
  }
  
  findFirstFit(blocks, n) {
      const holes = this.findFreeHoles(blocks);
      for (let i = 0; i < holes.length; i++) {
        if (holes[i].length >= n) return holes[i].start;
      }
      return -1;
    }
  
  hasExternalFragmentation(blocks, n) {
      return this.findFreeBlockIndices(blocks).length >= n &&
             this.largestHoleLength(blocks) < n;
    }
  
  getFileBlockIndices(blocks, fileId) {
      const list = [];
      blocks.forEach(function (b, i) { if (b.fileId === fileId) list.push(i); });
      return list;
    }
  
  markAllocated(blocks, index, info) {
      const b = blocks[index];
      b.status = 'allocated';
      b.fileId = info.fileId;
      b.fileName = info.fileName || info.fileId;
      b.blockOffset = info.blockOffset || 0;
      b.totalFileBlocks = info.totalFileBlocks || 0;
      b.nextPointer = info.nextPointer === undefined ? null : info.nextPointer;
      b.internalFragKB = info.internalFragKB || 0;
      return b;
    }
  
  releaseBlock(blocks, index, asHole) {
      const b = blocks[index];
      b.status = asHole === false ? 'free' : 'hole';
      b.fileId = null;
      b.fileName = null;
      b.blockOffset = 0;
      b.totalFileBlocks = 0;
      b.nextPointer = null;
      b.internalFragKB = 0;
      return b;
    }
  
  releaseFile(blocks, fileId) {
      const freed = this.getFileBlockIndices(blocks, fileId);
      freed.forEach(function (i) { this.releaseBlock(blocks, i, true); }, this);
      return freed;
    }
  
  defragment(blocks) {
      const result = this.createEmptyBlocks(blocks.length);
      const newLayout = {};
      let copied = 0;
      let cursor = 0;
      let i = 0;

      while (i < blocks.length) {
        if (blocks[i].status !== 'allocated') { i++; continue; }
        const fileId = blocks[i].fileId;
        newLayout[fileId] = [];
        while (i < blocks.length && blocks[i].fileId === fileId) {
          const dst = Object.assign({}, blocks[i], { index: cursor });
          result[cursor] = dst;
          newLayout[fileId].push(cursor);
          if (cursor !== i) copied++;
          cursor++;
          i++;
        }
      }
      return { blocks: result, copiedBlocks: copied, newLayout: newLayout };
    }
  
  static validateConfig(diskSize, blockKB) {
      if (!Number.isInteger(diskSize) || diskSize <= 0)
        return { ok: false, msg: 'Ukuran disk harus bilangan bulat positif.' };
      if (!(blockKB > 0))
        return { ok: false, msg: 'Ukuran blok harus lebih dari 0 KB.' };
      return { ok: true };
    }
  
  validateOp(blocks, activeFiles, op) {
      const type = (op.type || '').toLowerCase();
      const id = op.file || op.name;
      if (!id || !String(id).trim())
        return { ok: false, msg: 'Nama file tidak boleh kosong.' };

      if (type === 'create') {
        if (!(Number(op.sizeKB) > 0))
          return { ok: false, msg: 'Ukuran file harus lebih dari 0 KB (tidak boleh negatif atau kosong).' };
        if (activeFiles && activeFiles[id])
          return { ok: false, msg: 'File "' + id + '" sudah ada. Gunakan nama lain.' };
        if (this.findFreeBlockIndices(blocks).length === 0)
          return { ok: false, msg: 'Disk penuh, tidak ada blok kosong.' };
      } else if (type === 'delete') {
        if (!activeFiles || !activeFiles[id])
          return { ok: false, msg: 'File "' + id + '" tidak ditemukan di disk.' };
      } else {
        return { ok: false, msg: 'Jenis operasi tidak dikenal: ' + op.type };
      }
      return { ok: true };
    }
  }

  window.FileBlock.core.DiskModel = DiskModel;
})();
