(function () {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.ui = window.FileBlock.ui || {};

  class SimulationController {
    constructor() {
      this.method = 'contiguous';
      this.freeSpaceMode = 'bitmap';
      this.dirMode = 'single';
      this.playbackSpeed = 1200;
      this.isPlaying = false;
      this.playInterval = null;

      this.currentInput = {
        diskSize: 12,
        blockKB: 4,
        accessN: 4,
        ops: [
          { type: 'create', name: 'A', sizeKB: 10 },
          { type: 'create', name: 'B', sizeKB: 6 },
          { type: 'create', name: 'C', sizeKB: 15 },
          { type: 'delete', name: 'B' },
          { type: 'create', name: 'D', sizeKB: 13 }
        ]
      };

      this.simulationResult = null;
      this.comparisonResults = null;
      this.currentStepIndex = 0;
    }

    init() {
      this.bindEvents();
      this.runSimulation();
      this.goToStep(0);

      setTimeout(() => {
        if (window.FileBlock.ui.charts) {
          window.FileBlock.ui.charts.init();
          this.refreshAll();
        }
      }, 150);
    }

    bindEvents() {
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = link.getAttribute('data-target');
          if (target) {
            this.scrollToSection(target);
          }
        });
      });

      document.querySelectorAll('.method-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.method = btn.getAttribute('data-method') || 'contiguous';
          this.updateMethodTabs();
          this.runSimulation();
        });
      });

      document.querySelectorAll('.freespace-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.freeSpaceMode = btn.getAttribute('data-mode') || 'bitmap';
          this.renderFreeSpace();
        });
      });

      document.querySelectorAll('.dir-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.dirMode = btn.getAttribute('data-mode') || 'single';
          this.renderDirectory();
        });
      });

      const btnPrev = document.getElementById('btn-prev');
      const btnNext = document.getElementById('btn-next');
      const btnPlay = document.getElementById('btn-play');

      if (btnPrev) btnPrev.addEventListener('click', () => this.prevStep());
      if (btnNext) btnNext.addEventListener('click', () => this.nextStep());
      if (btnPlay) btnPlay.addEventListener('click', () => this.togglePlay());

      const speedSlider = document.getElementById('playback-speed-slider');
      if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
          this.playbackSpeed = Number(e.target.value);
          const lbl = document.getElementById('playback-speed-label');
          if (lbl) lbl.textContent = `${(this.playbackSpeed / 1000).toFixed(1)}s`;
          if (this.isPlaying) {
            this.pause();
            this.play();
          }
        });
      }

      const btnAdd = document.getElementById('btn-add-file');
      if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleAddFile();
        });
      }

      const addForm = document.getElementById('form-add-file');
      if (addForm) {
        addForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleAddFile();
        });
      }

      const btnClear = document.getElementById('btn-clear-disk');
      if (btnClear) {
        btnClear.addEventListener('click', (e) => {
          e.preventDefault();
          this.currentInput.ops = [];
          this.currentStepIndex = 0;
          this.runSimulation();
          this.goToStep(0);
          const nameInp = document.getElementById('input-file-name');
          if (nameInp) nameInp.value = 'A';
          const sizeInp = document.getElementById('input-file-size');
          if (sizeInp) sizeInp.value = '10';
        });
      }
    }

    scrollToSection(sectionId) {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      document.querySelectorAll('.nav-link').forEach(link => {
        const t = link.getAttribute('data-target');
        link.classList.toggle('active', t === sectionId);
      });
    }

    runSimulation() {
      this.simulationResult = window.FileBlock.run(this.currentInput, this.method);
      this.comparisonResults = window.FileBlock.core.runner.runAllMethods(this.currentInput);

      if (this.currentStepIndex >= this.simulationResult.steps.length) {
        this.currentStepIndex = Math.max(0, this.simulationResult.steps.length - 1);
      }

      this.refreshAll();
    }

    getCurrentStep() {
      if (!this.simulationResult || !this.simulationResult.steps || this.simulationResult.steps.length === 0) {
        return null;
      }
      const idx = Math.max(0, Math.min(this.simulationResult.steps.length - 1, this.currentStepIndex));
      return this.simulationResult.steps[idx];
    }

    refreshAll() {
      const step = this.getCurrentStep();
      if (!step) return;

      const totalSteps = this.simulationResult.steps.length;

      window.FileBlock.ui.diskView.renderDiskGrid(step.blocks, this.method);
      window.FileBlock.ui.diskView.renderStepLog(step, this.currentStepIndex, totalSteps);
      window.FileBlock.ui.diskView.renderActiveFiles(step.activeFiles, (fileId) => this.handleDeleteFile(fileId));
      window.FileBlock.ui.diskView.renderFatTable(step.fat, step.activeFiles);
      window.FileBlock.ui.diskView.renderInodeCards(step.inodes);

      this.renderFreeSpace();
      this.renderDirectory();

      if (window.FileBlock.ui.charts && this.comparisonResults) {
        const stepIdx = this.currentStepIndex;
        const cSteps = (this.comparisonResults.contiguous && this.comparisonResults.contiguous.steps) || [];
        const lSteps = (this.comparisonResults.linked && this.comparisonResults.linked.steps) || [];
        const iSteps = (this.comparisonResults.indexed && this.comparisonResults.indexed.steps) || [];

        const cStep = cSteps[Math.min(stepIdx, Math.max(0, cSteps.length - 1))] || step;
        const lStep = lSteps[Math.min(stepIdx, Math.max(0, lSteps.length - 1))] || step;
        const iStep = iSteps[Math.min(stepIdx, Math.max(0, iSteps.length - 1))] || step;

        const liveComparison = {
          contiguous: cStep,
          linked: lStep,
          indexed: iStep
        };

        window.FileBlock.ui.charts.updateCharts(liveComparison);
        window.FileBlock.ui.charts.renderComparisonTable(liveComparison);
      }
    }

    renderFreeSpace() {
      const step = this.getCurrentStep();
      if (!step) return;
      window.FileBlock.ui.diskView.renderFreeSpaceModule(step.freeSpaceState, this.currentInput.blockKB, this.freeSpaceMode);
    }

    renderDirectory() {
      const step = this.getCurrentStep();
      if (!step) return;
      const dirData = window.FileBlock.modules.directory.buildDirectory(this.dirMode, step.activeFiles);
      window.FileBlock.ui.diskView.renderDirectoryModule(dirData, this.dirMode);
    }

    updateMethodTabs() {
      document.querySelectorAll('.method-tab-btn').forEach(btn => {
        const m = btn.getAttribute('data-method');
        btn.classList.toggle('active', m === this.method);
      });
    }

    prevStep() {
      if (this.currentStepIndex > 0) {
        this.goToStep(this.currentStepIndex - 1);
      }
    }

    nextStep() {
      if (this.simulationResult && this.currentStepIndex < this.simulationResult.steps.length - 1) {
        this.goToStep(this.currentStepIndex + 1);
      } else if (this.isPlaying) {
        this.pause();
      }
    }

    goToStep(index) {
      if (!this.simulationResult || !this.simulationResult.steps) return;
      this.currentStepIndex = Math.max(0, Math.min(this.simulationResult.steps.length - 1, index));
      this.refreshAll();
    }

    togglePlay() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    }

    play() {
      if (!this.simulationResult || !this.simulationResult.steps || this.simulationResult.steps.length <= 1) return;
      if (this.currentStepIndex >= this.simulationResult.steps.length - 1) {
        this.currentStepIndex = 0;
      }
      this.isPlaying = true;
      this.updatePlayBtn();

      this.playInterval = setInterval(() => {
        if (this.currentStepIndex < this.simulationResult.steps.length - 1) {
          this.nextStep();
        } else {
          this.pause();
        }
      }, this.playbackSpeed);
    }

    pause() {
      this.isPlaying = false;
      if (this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = null;
      }
      this.updatePlayBtn();
    }

    updatePlayBtn() {
      const btn = document.getElementById('btn-play');
      if (!btn) return;
      btn.textContent = this.isPlaying ? 'Pause' : 'Play';
    }

    handleAddFile() {
      const nameInp = document.getElementById('input-file-name');
      const sizeInp = document.getElementById('input-file-size');

      let name = nameInp ? nameInp.value.trim() : '';
      const sizeKB = sizeInp ? Math.max(1, Number(sizeInp.value) || 4) : 4;

      if (!name) {
        const existingNames = this.currentInput.ops.filter(o => o.type === 'create').map(o => o.name);
        for (let code = 65; code <= 90; code++) {
          const letter = String.fromCharCode(code);
          if (!existingNames.includes(letter)) {
            name = letter;
            break;
          }
        }
        if (!name) name = `File${this.currentInput.ops.length + 1}`;
      }

      this.currentInput.ops.push({
        type: 'create',
        name,
        sizeKB
      });

      this.runSimulation();
      this.goToStep(this.simulationResult.steps.length - 1);

      if (nameInp) {
        const existingNames = this.currentInput.ops.filter(o => o.type === 'create').map(o => o.name);
        let nextName = '';
        for (let code = 65; code <= 90; code++) {
          const letter = String.fromCharCode(code);
          if (!existingNames.includes(letter)) {
            nextName = letter;
            break;
          }
        }
        nameInp.value = nextName || `File${this.currentInput.ops.length + 1}`;
      }
    }

    handleDeleteFile(fileId) {
      const step = this.getCurrentStep();
      if (!step || !step.activeFiles || !step.activeFiles[fileId]) return;

      const f = step.activeFiles[fileId];
      this.currentInput.ops.push({
        type: 'delete',
        name: f.name || fileId,
        file: fileId
      });

      this.runSimulation();
      this.goToStep(this.simulationResult.steps.length - 1);
    }
  }

  window.FileBlock.ui.controls = new SimulationController();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.FileBlock.ui.controls.init();
    });
  } else {
    window.FileBlock.ui.controls.init();
  }
})();
