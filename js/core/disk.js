(function () {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.core = window.FileBlock.core || {};

  const HOLE_COLOR = { bg: '#fecaca', border: '#e11d48', text: '#e11d48' };

  class DiskModel {
    constructor(totalBlocks, blockSizeKB) {
      this.totalBlocks = totalBlocks;
      this.blockSizeKB = blockSizeKB;
    }


    static createBlock(index) {
      return {
        index: index,
        status: 'free',
        fileId: null,
        fileName: null,
        blockOffset: 0,
        totalFileBlocks: 0,
        nextPointer: null,
        internalFragKB: 0,
        isIndexBlock: false,
        color: null,
        colorBorder: null,
        colorText: null
      };
    }

    createEmptyBlocks(n) {
      const size = n === undefined ? this.totalBlocks : n;
      const blocks = [];
      for (let i = 0; i < size; i++) blocks.push(DiskModel.createBlock(i));
      return blocks;
    }

    cloneBlocks(blocks) {
      return blocks.map(function (b) { return Object.assign({}, b); });
    }

    getFileColor(fileId) {
      const s = String(fileId);
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 300;
      const hue = h + 30; // 30..329
      return {
        bg: 'hsl(' + hue + ', 70%, 85%)',
        border: 'hsl(' + hue + ', 55%, 40%)',
        text: 'hsl(' + hue + ', 60%, 22%)'
      };
    }


    calcBlocksNeeded(sizeKB) {
      return Math.ceil(sizeKB / this.blockSizeKB);
    }

    calcInternalFragKB(sizeKB) {
      return this.calcBlocksNeeded(sizeKB) * this.blockSizeKB - sizeKB;
    }


    isFree(block) {
      return block.status !== 'allocated';
    }

    getFreeBlockIndices(blocks) {
      const list = [];
      blocks.forEach(function (b, i) { if (b.status !== 'allocated') list.push(i); });
      return list;
    }

    findFreeBlockIndices(blocks) {
      return this.getFreeBlockIndices(blocks);
    }

    findFreeHoles(blocks) {
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

    largestHoleLength(blocks) {
      return this.findFreeHoles(blocks).reduce(function (m, h) {
        return Math.max(m, h.length);
      }, 0);
    }

    // First-fit: awal lubang pertama yang muat n blok, atau -1
    findFirstFit(blocks, n) {
      const holes = this.findFreeHoles(blocks);
      for (let i = 0; i < holes.length; i++) {
        if (holes[i].length >= n) return holes[i].start;
      }
      return -1;
    }

    hasExternalFragmentation(blocks, n) {
      return this.getFreeBlockIndices(blocks).length >= n &&
             this.largestHoleLength(blocks) < n;
    }

    getFileBlockIndices(blocks, fileId) {
      const list = [];
      blocks.forEach(function (b, i) { if (b.fileId === fileId) list.push(i); });
      return list;
    }

    markAllocated(blocks, index, info) {
      const b = blocks[index];
      const c = info.color || this.getFileColor(info.fileId);
      b.status = 'allocated';
      b.fileId = info.fileId;
      b.fileName = info.fileName || info.fileId;
      b.blockOffset = info.blockOffset || 0;
      b.totalFileBlocks = info.totalFileBlocks || 0;
      b.nextPointer = info.nextPointer === undefined ? null : info.nextPointer;
      b.internalFragKB = info.internalFragKB || 0;
      b.isIndexBlock = !!info.isIndexBlock;
      b.color = c.bg;
      b.colorBorder = c.border;
      b.colorText = c.text;
      return b;
    }

    releaseBlock(blocks, index, asHole) {
      const b = blocks[index];
      const hole = asHole !== false;
      b.status = hole ? 'hole' : 'free';
      b.fileId = null;
      b.fileName = null;
      b.blockOffset = 0;
      b.totalFileBlocks = 0;
      b.nextPointer = null;
      b.internalFragKB = 0;
      b.isIndexBlock = false;
      b.color = hole ? HOLE_COLOR.bg : null;
      b.colorBorder = hole ? HOLE_COLOR.border : null;
      b.colorText = hole ? HOLE_COLOR.text : null;
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
          const moved = Object.assign({}, blocks[i], { index: cursor });
          if (moved.nextPointer !== null && moved.nextPointer !== -1 &&
              typeof moved.nextPointer === 'number') {
            moved.nextPointer = cursor + 1; 
          }
          result[cursor] = moved;
          newLayout[fileId].push(cursor);
          if (cursor !== i) copied++;
          cursor++;
          i++;
        }
      }
      return { blocks: result, copiedBlocks: copied, newLayout: newLayout };
    }

    parseCustomBlocks(text, totalBlocks) {
      const max = totalBlocks === undefined ? this.totalBlocks : totalBlocks;
      const seen = {};
      const list = [];
      String(text || '').split(/[,;\s]+/).forEach(function (part) {
        if (part === '') return;
        const n = Number(part);
        if (Number.isInteger(n) && n >= 0 && n < max && !seen[n]) {
          seen[n] = true;
          list.push(n);
        }
      });
      return list;
    }

    validateCustomBlocks(blocks, list, needed) {
      if (!list || list.length === 0) return { ok: true }; 
      const taken = list.filter(function (i) { return blocks[i].status === 'allocated'; });
      if (taken.length > 0)
        return { ok: false, msg: 'Blok #' + taken.join(', #') + ' sudah terisi file lain.' };
      if (list.length > needed)
        return { ok: false, msg: 'Kamu memilih ' + list.length + ' blok, padahal file hanya butuh ' + needed + ' blok.' };
      return { ok: true };
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
        if (this.getFreeBlockIndices(blocks).length === 0)
          return { ok: false, msg: 'Disk penuh, tidak ada blok kosong.' };
        const check = this.validateCustomBlocks(blocks, op.customBlocks, this.calcBlocksNeeded(Number(op.sizeKB)));
        if (!check.ok) return check;
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