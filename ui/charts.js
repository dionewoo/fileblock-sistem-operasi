
(function() {
  'use strict';

  window.FileBlock = window.FileBlock || {};
  window.FileBlock.ui = window.FileBlock.ui || {};

  class ChartMetricsManager {
    constructor() {
      this.accessChart = null;
      this.fragChart = null;
      this.memoryChart = null;
    }

    init() {
      if (typeof Chart === 'undefined') return;

      const chartFont = {
        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
        size: 11,
        weight: 'bold'
      };

      const ctxAccess = document.getElementById('chart-disk-access');
      if (ctxAccess) {
        if (this.accessChart) this.accessChart.destroy();
        this.accessChart = new Chart(ctxAccess, {
          type: 'bar',
          data: {
            labels: ['Contiguous', 'Linked (FAT)', 'Indexed (Inode)'],
            datasets: [{
              label: 'Akses Disk',
              data: [0, 0, 0],
              backgroundColor: ['#2563eb', '#3b82f6', '#60a5fa'],
              borderColor: '#000000',
              borderWidth: 1,
              borderRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                suggestedMax: 4,
                ticks: { stepSize: 1, color: '#000000', font: chartFont },
                grid: { color: '#e2e8f0' },
                title: { display: true, text: 'Akses I/O', color: '#000000', font: chartFont }
              },
              x: {
                ticks: { color: '#000000', font: chartFont },
                grid: { display: false }
              }
            }
          }
        });
      }

      const ctxFrag = document.getElementById('chart-fragmentation');
      if (ctxFrag) {
        if (this.fragChart) this.fragChart.destroy();
        this.fragChart = new Chart(ctxFrag, {
          type: 'bar',
          data: {
            labels: ['Contiguous', 'Linked (FAT)', 'Indexed (Inode)'],
            datasets: [{
              label: 'Frag. Internal (KB)',
              data: [0, 0, 0],
              backgroundColor: ['#60a5fa', '#3b82f6', '#2563eb'],
              borderColor: '#000000',
              borderWidth: 1,
              borderRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                suggestedMax: 8,
                ticks: { color: '#000000', font: chartFont },
                grid: { color: '#e2e8f0' },
                title: { display: true, text: 'KB', color: '#000000', font: chartFont }
              },
              x: {
                ticks: { color: '#000000', font: chartFont },
                grid: { display: false }
              }
            }
          }
        });
      }

      const ctxMem = document.getElementById('chart-memory-overhead');
      if (ctxMem) {
        if (this.memoryChart) this.memoryChart.destroy();
        this.memoryChart = new Chart(ctxMem, {
          type: 'bar',
          data: {
            labels: ['Contiguous', 'Linked (FAT)', 'Indexed (Inode)'],
            datasets: [{
              label: 'Memori Struktur (Bytes)',
              data: [0, 48, 0],
              backgroundColor: ['#93c5fd', '#3b82f6', '#2563eb'],
              borderColor: '#000000',
              borderWidth: 1,
              borderRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                suggestedMax: 120,
                ticks: { color: '#000000', font: chartFont },
                grid: { color: '#e2e8f0' },
                title: { display: true, text: 'Bytes', color: '#000000', font: chartFont }
              },
              x: {
                ticks: { color: '#000000', font: chartFont },
                grid: { display: false }
              }
            }
          }
        });
      }
    }

    updateCharts(comparisonResults) {
      if (!comparisonResults) return;

      const c = comparisonResults.contiguous.metrics || {};
      const l = comparisonResults.linked.metrics || {};
      const i = comparisonResults.indexed.metrics || {};

      if (this.accessChart) {
        this.accessChart.data.datasets[0].data = [
          c.readCostBlockN || 0,
          l.readCostBlockN || 0,
          i.readCostBlockN || 0
        ];
        this.accessChart.update();
      }

      if (this.fragChart) {
        this.fragChart.data.datasets[0].data = [
          c.internalFragKB || 0,
          l.internalFragKB || 0,
          i.internalFragKB || 0
        ];
        this.fragChart.update();
      }

      if (this.memoryChart) {
        this.memoryChart.data.datasets[0].data = [
          c.structureMemoryBytes || 0,
          l.structureMemoryBytes || 0,
          i.structureMemoryBytes || 0
        ];
        this.memoryChart.update();
      }
    }

    renderComparisonTable(comparisonResults) {
      const tbody = document.getElementById('comparison-table-body');
      if (!tbody || !comparisonResults) return;

      const c = comparisonResults.contiguous.metrics || {};
      const l = comparisonResults.linked.metrics || {};
      const i = comparisonResults.indexed.metrics || {};

      const getStatusText = (m) => {
        if (!m || m.activeFilesCount === 0) return 'Siap Alokasi';
        if (m.failedCount > 0) return 'Gagal (Frag. Eksternal)';
        return 'Berhasil';
      };

      const rows = [
        {
          method: 'Contiguous (First-Fit)',
          status: getStatusText(c),
          externalFrag: c.externalFrag ? 'Ya' : 'Tidak',
          internalFrag: `${c.internalFragKB || 0} KB`,
          readCost: `${c.readCostBlockN || 0} Akses`,
          structureMem: `${c.structureMemoryBytes || 0} B`,
          metadata: `${c.metadataEntries || 0} entri`,
          prosCons: 'Akses cepat; rentan fragmentasi eksternal.'
        },
        {
          method: 'Linked Allocation (FAT)',
          status: getStatusText(l),
          externalFrag: 'Tidak',
          internalFrag: `${l.internalFragKB || 0} KB`,
          readCost: `${l.readCostBlockN || 0} Akses`,
          structureMem: `${l.structureMemoryBytes || 0} B`,
          metadata: `${l.metadataEntries || 0} entri`,
          prosCons: 'Bebas fragmentasi eksternal; akses acak lambat.'
        },
        {
          method: 'Indexed Allocation (Inode)',
          status: getStatusText(i),
          externalFrag: 'Tidak',
          internalFrag: `${i.internalFragKB || 0} KB`,
          readCost: `${i.readCostBlockN || 0} Akses`,
          structureMem: `${i.structureMemoryBytes || 0} B`,
          metadata: `${i.metadataEntries || 0} entri`,
          prosCons: 'Akses acak langsung via pointer; overhead blok indeks.'
        }
      ];

      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-200 text-xs text-black hover:bg-slate-50';
        tr.innerHTML = `
          <td class="py-2 px-3 font-bold text-black">${r.method}</td>
          <td class="py-2 px-3 font-semibold text-black">${r.status}</td>
          <td class="py-2 px-3 font-semibold text-black">${r.externalFrag}</td>
          <td class="py-2 px-3 text-black">${r.internalFrag}</td>
          <td class="py-2 px-3 font-bold text-blue-700">${r.readCost}</td>
          <td class="py-2 px-3 text-black">${r.structureMem}</td>
          <td class="py-2 px-3 text-black">${r.metadata}</td>
          <td class="py-2 px-3 text-black">${r.prosCons}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    resize() {
      if (this.accessChart) this.accessChart.resize();
      if (this.fragChart) this.fragChart.resize();
      if (this.memoryChart) this.memoryChart.resize();
    }
  }

  window.FileBlock.ui.charts = new ChartMetricsManager();
})();
