(function () {
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
        family: "'Space Grotesk', system-ui, sans-serif",
        size: 11,
        weight: 'bold'
      };

      const barColors = ['#FBBF24', '#BFE3FF', '#F472B6'];
      const borderColor = '#111111';

      const ctxAccess = document.getElementById('chart-disk-access');
      if (ctxAccess) {
        if (this.accessChart) this.accessChart.destroy();
        this.accessChart = new Chart(ctxAccess, {
          type: 'bar',
          data: {
            labels: ['Contiguous', 'Linked', 'Indexed'],
            datasets: [{
              label: 'Akses Disk',
              data: [1, 4, 2],
              backgroundColor: barColors,
              borderColor: borderColor,
              borderWidth: 2,
              borderRadius: 6
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
                ticks: { stepSize: 1, color: '#111111', font: chartFont },
                grid: { color: '#e2e8f0', borderDash: [3, 3] }
              },
              x: {
                ticks: { color: '#111111', font: chartFont },
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
            labels: ['Contiguous', 'Linked', 'Indexed'],
            datasets: [{
              label: 'Frag. Internal (KB)',
              data: [2, 2, 4],
              backgroundColor: barColors,
              borderColor: borderColor,
              borderWidth: 2,
              borderRadius: 6
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
                ticks: { color: '#111111', font: chartFont },
                grid: { color: '#e2e8f0', borderDash: [3, 3] }
              },
              x: {
                ticks: { color: '#111111', font: chartFont },
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
            labels: ['Contiguous', 'Linked', 'Indexed'],
            datasets: [{
              label: 'Memori Struktur (B)',
              data: [0, 48, 24],
              backgroundColor: barColors,
              borderColor: borderColor,
              borderWidth: 2,
              borderRadius: 6
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
                suggestedMax: 60,
                ticks: { color: '#111111', font: chartFont },
                grid: { color: '#e2e8f0', borderDash: [3, 3] }
              },
              x: {
                ticks: { color: '#111111', font: chartFont },
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
          c.readCostBlockN !== undefined ? c.readCostBlockN : 1,
          l.readCostBlockN !== undefined ? l.readCostBlockN : 4,
          i.readCostBlockN !== undefined ? i.readCostBlockN : 2
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
          l.structureMemoryBytes || 48,
          i.structureMemoryBytes || 24
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

      const renderStatusBadge = (m) => {
        if (m && m.failedCount > 0) {
          return '<span class="pill er" style="padding:1px 12px;font-size:11px">Gagal</span>';
        }
        return '<span class="pill ok" style="padding:1px 12px;font-size:11px">Siap</span>';
      };

      const rows = [
        {
          method: 'Contiguous (First-Fit)',
          status: renderStatusBadge(c),
          externalFrag: c.externalFrag ? 'Ya' : 'Tidak',
          internalFrag: `${c.internalFragKB || 0} KB`,
          readCost: `${c.readCostBlockN || 1} akses`,
          prosCons: 'Akses cepat; rentan fragmentasi eksternal.'
        },
        {
          method: 'Linked Allocation (FAT)',
          status: renderStatusBadge(l),
          externalFrag: 'Tidak',
          internalFrag: `${l.internalFragKB || 0} KB`,
          readCost: `${l.readCostBlockN || 'n'} akses`,
          prosCons: 'Bebas fragmentasi eksternal; akses acak lambat.'
        },
        {
          method: 'Indexed (Inode)',
          status: renderStatusBadge(i),
          externalFrag: 'Tidak',
          internalFrag: `${i.internalFragKB || 0} KB`,
          readCost: `${i.readCostBlockN || 2} akses`,
          prosCons: 'Akses acak langsung; overhead blok indeks.'
        }
      ];

      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><b>${r.method}</b></td>
          <td>${r.status}</td>
          <td>${r.externalFrag}</td>
          <td>${r.internalFrag}</td>
          <td style="font-family:monospace;font-weight:700">${r.readCost}</td>
          <td>${r.prosCons}</td>
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
