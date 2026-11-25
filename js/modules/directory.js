
(function () {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.modules = window.FileBlock.modules || {};

  class DirectoryModule {
    constructor() { }

    buildDirectory(mode, activeFiles = {}, searchFileName = null) {
      const fileList = Object.values(activeFiles);

      if (mode === 'single') {
        return this.buildSingleLevel(fileList, searchFileName);
      } else if (mode === 'two_level') {
        return this.buildTwoLevel(fileList, searchFileName);
      } else if (mode === 'tree') {
        return this.buildTreeStructured(fileList, searchFileName);
      }
    }

    buildSingleLevel(fileList, searchFileName) {
      const files = fileList.map(f => ({
        name: f.name || f.id,
        sizeKB: f.sizeKB,
        blocks: f.allocatedBlocks,
        path: `/${f.name || f.id}`,
        classification: 'Direktori Root (/)'
      }));

      const nameCounts = {};
      let conflictCount = 0;
      files.forEach(f => {
        nameCounts[f.name] = (nameCounts[f.name] || 0) + 1;
        if (nameCounts[f.name] > 1) conflictCount++;
      });

      const target = searchFileName || (files[0] ? files[0].name : 'A');
      const targetIdx = files.findIndex(f => f.name === target);
      const lookupSteps = targetIdx >= 0 ? targetIdx + 1 : Math.max(1, files.length);

      return {
        mode: 'single',
        name: 'Single-Level Directory',
        maxDepth: 1,
        conflictCount,
        lookupSteps,
        explanation: 'Klasifikasi: Seluruh berkas disimpan langsung di bawah direktori root (/). Satu ruang nama global tanpa subfolder.',
        structure: {
          root: '/',
          files
        }
      };
    }

    buildTwoLevel(fileList, searchFileName) {
      const users = ['user1', 'user2'];
      const ufdMap = {
        'user1': [],
        'user2': []
      };

      fileList.forEach((f, idx) => {
        const user = idx < Math.ceil(fileList.length / 2) ? 'user1' : 'user2';
        ufdMap[user].push({
          name: f.name || f.id,
          sizeKB: f.sizeKB,
          blocks: f.allocatedBlocks,
          path: `/${user}/${f.name || f.id}`,
          owner: user,
          classification: `User File Directory (UFD: /${user})`
        });
      });

      let conflictCount = 0;
      users.forEach(u => {
        const counts = {};
        ufdMap[u].forEach(f => {
          counts[f.name] = (counts[f.name] || 0) + 1;
          if (counts[f.name] > 1) conflictCount++;
        });
      });

      const target = searchFileName || (fileList[0] ? fileList[0].name : 'A');
      let targetUser = users[0];
      let targetIdx = ufdMap[targetUser].findIndex(f => f.name === target);
      if (targetIdx === -1 && ufdMap[users[1]]) {
        targetUser = users[1];
        targetIdx = ufdMap[users[1]].findIndex(f => f.name === target);
      }
      const lookupSteps = 1 + (targetIdx >= 0 ? targetIdx + 1 : Math.max(1, ufdMap[targetUser].length));

      return {
        mode: 'two_level',
        name: 'Two-Level Directory',
        maxDepth: 2,
        conflictCount,
        lookupSteps,
        explanation: 'Klasifikasi: Berdasarkan Akun Pengguna. Master File Directory (MFD) memisahkan folder /user1 dan /user2 agar nama file sama tidak bertabrakan.',
        structure: {
          mfd: '/',
          users: Object.keys(ufdMap).map(u => ({
            username: u,
            path: `/${u}`,
            files: ufdMap[u]
          }))
        }
      };
    }

    buildTreeStructured(fileList, searchFileName) {
      const tree = {
        name: '/',
        type: 'dir',
        path: '/',
        children: []
      };

      const folderData = {
        name: 'data',
        type: 'dir',
        path: '/data',
        children: []
      };

      const folderArsip = {
        name: 'arsip',
        type: 'dir',
        path: '/data/arsip',
        children: []
      };

      folderData.children.push(folderArsip);
      tree.children.push(folderData);

      fileList.forEach((f, idx) => {
        const fileObj = {
          name: f.name || f.id,
          type: 'file',
          sizeKB: f.sizeKB,
          blocks: f.allocatedBlocks
        };

        if (idx === 0) {
          fileObj.path = `/${f.name || f.id}`;
          fileObj.classification = 'Level 1: Root (/)';
          tree.children.unshift(fileObj);
        } else if (idx === 1) {
          fileObj.path = `/data/${f.name || f.id}`;
          fileObj.classification = 'Level 2: Folder (/data)';
          folderData.children.unshift(fileObj);
        } else {
          fileObj.path = `/data/arsip/${f.name || f.id}`;
          fileObj.classification = 'Level 3: Subfolder Bersarang (/data/arsip)';
          folderArsip.children.push(fileObj);
        }
      });

      return {
        mode: 'tree',
        name: 'Tree-Structured Directory',
        maxDepth: 3,
        conflictCount: 0,
        lookupSteps: 3,
        explanation: 'Klasifikasi: Pohon direktori bersarang (Nested Tree). Level 1: Root (/), Level 2: Direktori Kerja (/data), Level 3: Subdirektori Bersarang (/data/arsip).',
        structure: tree
      };
    }
  }

  window.FileBlock.modules.directory = new DirectoryModule();
})();
