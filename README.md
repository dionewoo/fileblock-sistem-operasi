# FileBlock: Simulator Alokasi File System

**Mata Kuliah:** Sistem Operasi  
**Kategori:** B (Aplikasi Simulasi Fungsi Sistem Operasi)  
**Kapasitas Tim:** 6 Anggota  
**Teknologi:** HTML5, CSS3, JavaScript murni (Client-Side, zero-build, no ES modules)

---

## 1. Ringkasan Proyek

FileBlock adalah aplikasi web interaktif (*Single Page Application*) yang memvisualisasikan mekanisme internal Sistem Operasi dalam mengelola penyimpanan sekunder (disk). Disk direpresentasikan dalam bentuk susunan blok visual (CSS Grid) di mana pengguna dapat menjalankan simulasi langkah demi langkah (*step-by-step*), mengamati terjadinya fragmentasi, serta membandingkan performa 3 modul utama (9 mekanisme).

### Modul & Mekanisme yang Diuji:
1. **Modul A: Alokasi File**
   - Contiguous Allocation (First-Fit)
   - Linked Allocation (File Allocation Table / FAT)
   - Indexed Allocation (Inode / Blok Indeks)
   - *Fitur Spesifik:* Visualisasi Peta Disk, Tabel FAT, Kartu Inode, dan **Defragmentasi Disk**.
2. **Modul B: Free Space Management**
   - Bitmap (Bit Array)
   - Linked List (Free List Pointer Chain)
   - Grouping (Pointer Group Header)
   - *Metrik:* Memori struktur data (Bytes) dan langkah pencarian $N$ blok kosong (*lookup steps*).
3. **Modul C: Struktur Direktori**
   - Single-level Directory
   - Two-level Directory (MFD & UFD)
   - Tree-structured Directory (Hierarki folder bersarang)
   - *Metrik:* Kedalaman direktori maks, langkah pencarian file, dan deteksi konflik nama file (*name collision*).

---

## 2. Struktur Repositori & Pembagian Tugas (6 Anggota)

Sesuai dengan dokumen **Spesifikasi Teknis & Perancangan Simulator File System**:

```
fileblock/
├── index.html              # Layout Antarmuka Utama (Tab Navigasi Modul A, B, C)
├── css/
│   └── style.css           # Styling Komponen UI, Layout Grid Blok Disk, & Controls
├── js/
│   ├── core/
│   │   ├── disk.js         # Data Model Disk & Fungsi Manipulasi Bersama
│   │   └── runner.js       # Engine Eksekusi Simulasi & Pembangkit Objek Steps
│   ├── modules/
│   │   ├── allocation.js   # Algoritma Modul A (Contiguous, Linked, Indexed)
│   │   ├── freespace.js    # Algoritma Modul B (Bitmap, Linked List, Grouping)
│   │   └── directory.js    # Algoritma Modul C (Single, Two-level, Tree)
│   └── ui/
│       ├── diskView.js     # Komponen Render Peta Blok Disk, Tabel FAT, & Inode
│       ├── controls.js     # Handler Event Kontrol Simulasi & Form Input
│       └── charts.js       # Komponen Grafik Chart.js & Tabel Metrik
├── docs/                   # Dokumentasi Proyek, Laporan PDF, Slide, & Screenshot
│   └── spesifikasi_teknis.md
└── README.md               # Dokumentasi Panduan & Penggunaan AI
```

### Pembagian Tugas Anggota:
1. **Ketua / Integrator**: Setup repositori Git, arsitektur `disk.js`, layout `index.html`, review code, dan deployment.
2. **Dev Inti 1**: Modul A (Contiguous & Linked FAT), kalkulasi fragmentasi internal/eksternal, dan biaya akses blok ke-n.
3. **Dev Inti 2**: Modul A (Indexed Inode) & Modul B (Bitmap, Linked List, Grouping), kalkulasi memori struktur data.
4. **Dev Inti 3**: Modul C (Single-level, Two-level, Tree-structured), kedalaman struktur, dan pendeteksian konflik nama.
5. **Dev Antarmuka**: Visualisasi grid disk CSS, logika pemutar (Prev/Next/Play/Pause), form input, defragmentasi, dan grafik Chart.js.
6. **QA & Dokumentasi**: Pengujian skenario wajib, validasi perhitungan metrik, dokumentasi README.md, dan laporan akhir.

---

## 3. Kontrak Data Internal (Core Engine ke UI Layer)

Eksekusi simulasi dijalankan melalui fungsi `window.FileBlock.run(input, method)` dengan format kontrak data:

```javascript
// Input Simulasi
const input = {
  diskSize: 12, // Total blok memori disk
  blockKB: 4,   // Ukuran per blok (KB)
  accessN: 4,   // Posisi blok yang diuji baca
  ops: [
    { type: "create", name: "A", sizeKB: 10 },
    { type: "create", name: "B", sizeKB: 6 },
    { type: "create", name: "C", sizeKB: 15 },
    { type: "delete", name: "B" },
    { type: "create", name: "D", sizeKB: 13 }
  ]
};

// Output Hasil Simulasi
const output = window.FileBlock.run(input, "contiguous");
// output = { method, steps: [...], metrics: { allocatedCount, failedCount, internalFragKB, externalFrag, readCostBlockN, metadataEntries, structureMemoryBytes, lookupSteps } }
```

---

## 4. Hasil Verifikasi Skenario Utama (Uji Soal Wajib)

Skenario: Disk 12 blok, ukuran 4 KB (Total 48 KB). Operasi: `buat A (10KB)`, `buat B (6KB)`, `buat C (15KB)`, `hapus B`, `buat D (13KB)`.
- **Contiguous Allocation**:
  - Gagal mengalokasikan D (13 KB = butuh 4 blok) akibat **Fragmentasi Eksternal** (total ruang kosong ada 5 blok, namun blok berurutan terbesar hanya 3 blok).
  - Sisa fragmentasi internal total: **3 KB** (A: 2 KB + C: 1 KB).
  - Biaya baca blok ke-4: **1 akses**.
- **Linked Allocation (FAT)**:
  - Berhasil mengalokasikan D menyebar pada blok bebas `[3, 4, 9, 10]`.
  - Sisa fragmentasi internal total: **6 KB** (A: 2 KB + C: 1 KB + D: 3 KB).
  - Biaya baca blok ke-4: **4 akses**.
- **Indexed Allocation (Inode)**:
  - Berhasil mengalokasikan D.
  - Sisa fragmentasi internal total: **6 KB**.
  - Biaya baca blok ke-4: **2 akses** (1 ke Inode + 1 langsung ke blok data).

---

## 5. Cara Menjalankan

1. Buka folder proyek ini di komputer Anda.
2. Klik dua kali file `index.html` pada browser apa saja (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).
3. Tanpa instalasi dependensi, tanpa build tools, dan dapat langsung dibuka offline maupun via protokol `file://`.

