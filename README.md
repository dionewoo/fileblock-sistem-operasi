# FileBlock

Simulator interaktif **alokasi file system** untuk mata kuliah Sistem Operasi. FileBlock memperlihatkan secara visual dan langkah demi langkah perbedaan tiga metode alokasi file: **Contiguous**, **Linked (FAT)**, dan **Indexed (inode)**.

> **Status:** Tahap awal (perencanaan & desain). Belum ada implementasi kode.

---

## Daftar Isi

1. [Tujuan](#tujuan)
2. [Fitur Utama](#fitur-utama)
3. [Cakupan Modul](#cakupan-modul)
4. [Skenario Demo](#skenario-demo)
5. [Rancangan Tampilan](#rancangan-tampilan)
6. [Struktur Proyek (Rencana)](#struktur-proyek-rencana)
7. [Roadmap](#roadmap)
8. [Cara Menjalankan](#cara-menjalankan)
9. [Catatan](#catatan)

---

## Tujuan

- Memvisualisasikan cara kerja tiga metode alokasi file pada disk.
- Membandingkan kelebihan dan kelemahan tiap metode dengan angka yang dapat dihitung manual.
- Menyediakan input yang dapat diubah (ukuran disk, ukuran blok, daftar operasi) agar simulator bisa dibuktikan kebenarannya saat demo.

## Fitur Utama

- **Form input**: ukuran disk, ukuran blok, dan daftar operasi (buat / hapus file).
- **Peta blok disk berwarna**: satu warna per file, blok kosong berwarna abu-abu atau merah.
- **Kontrol langkah**: tombol Prev / Next / Play, plus tab pemilihan metode.
- **Log penjelasan** tiap langkah, misalnya: *"D butuh 4 blok, lubang terbesar hanya 3, alokasi gagal."*
- **Tabel dan grafik batang perbandingan** ketiga metode.
- **Defragmentasi** (khusus Contiguous) sebagai fitur bonus.

## Cakupan Modul

| Modul | 3 Mekanisme | Metrik Pembanding |
|-------|-------------|-------------------|
| Alokasi file *(fokus tahap awal)* | Contiguous, Linked (FAT), Indexed (inode) | Fragmentasi internal/eksternal, akses disk untuk membaca blok ke-n |
| Free space management | Bitmap, Linked list, Grouping | Memori yang dipakai, langkah untuk menemukan blok kosong |
| Struktur direktori | Single-level, Two-level, Tree | Langkah pencarian file, konflik nama |

## Skenario Demo

**Input:** disk 12 blok (nomor 0-11), 1 blok = 4 KB. Blok dibutuhkan = `ceil(ukuran / 4 KB)`.

| No | Operasi | File | Ukuran | Butuh Blok |
|----|---------|------|--------|-----------|
| 1 | Buat | A | 10 KB | 3 |
| 2 | Buat | B | 6 KB | 2 |
| 3 | Buat | C | 15 KB | 4 |
| 4 | Hapus | B | - | - |
| 5 | Buat | D | 13 KB | 4 |

**Kondisi setelah langkah 4** (B dihapus): total ada 5 blok kosong, tetapi terpecah menjadi dua lubang (blok 3-4 dan blok 9-11).

```
Blok: 0 1 2 | 3 4 | 5 6 7 8 | 9 10 11
      A A A | - - | C C C C | -  -  -
```

**Hasil langkah 5** (buat D, butuh 4 blok):

| Metode | Hasil |
|--------|-------|
| Contiguous | **Gagal**: lubang terbesar hanya 3 blok (fragmentasi eksternal) |
| Linked (FAT) | **Berhasil**: 3 → 4 → 9 → 10 → NULL |
| Indexed (inode) | **Berhasil**: inode D = `[3, 4, 9, 10]` |

**Perbandingan:**

| Metrik | Contiguous | Linked | Indexed |
|--------|-----------|--------|---------|
| D berhasil disimpan? | Tidak | Ya | Ya |
| Fragmentasi eksternal | Ada (lubang 2 dan 3 blok) | Tidak ada | Tidak ada |
| Fragmentasi internal (A+C+D) | 3 KB (D gagal) | 6 KB | 6 KB |
| Akses disk untuk membaca blok ke-4 file D | - | 4 (telusuri 3, 4, 9, 10) | 2 (1 baca inode + 1 baca data) |
| Metadata | 2 angka per file (awal, panjang) | 1 pointer per blok | 1 tabel indeks per file |
| Biaya defragmentasi | 4 salinan blok | Tidak perlu | Tidak perlu |

Rincian fragmentasi internal: A menyia-nyiakan 2 KB (3 × 4 = 12, terpakai 10), C 1 KB (16 − 15), D 3 KB (16 − 13).

**Bonus defragmentasi (Contiguous):** file C dipindah ke blok 3-6 (4 salinan blok), lalu D muat di blok 7-10.

```
Blok: 0 1 2 | 3 4 5 6 | 7 8 9 10 | 11
      A A A | C C C C | D D D D  | -
```

> Skenario ini dipilih karena dalam satu alur terlihat kelemahan Contiguous (fragmentasi eksternal), kelemahan Linked (akses blok ke-n lambat), dan keunggulan Indexed (akses langsung).

## Rancangan Tampilan

| Area | Isi |
|------|-----|
| Kiri | Form input (ukuran disk, ukuran blok, daftar operasi) |
| Tengah | Peta blok disk berwarna, satu warna per file, lubang kosong abu-abu atau merah |
| Bawah | Tombol Prev / Next / Play, tab pilihan metode |
| Kanan | Log penjelasan tiap langkah |
| Paling bawah | Tabel dan grafik batang perbandingan (akses disk, fragmentasi, metadata) |

## Struktur Proyek (Rencana)

Struktur di bawah masih usulan dan dapat berubah setelah teknologi dipilih.

```
fileblock/
├── README.md
├── docs/              # dokumen desain, contoh input/proses/output
├── src/
│   ├── allocation/    # contiguous, linked, indexed
│   ├── freespace/     # bitmap, linked list, grouping (modul lanjutan)
│   ├── directory/     # single-level, two-level, tree (modul lanjutan)
│   └── ui/            # form input, peta disk, log, grafik
└── tests/             # uji skenario (termasuk skenario demo A-B-C-D)
```

## Roadmap

- [x] Merumuskan skenario demo dan hasil yang diharapkan
- [x] Menentukan metrik perbandingan dan rancangan tampilan
- [ ] Memilih teknologi (bahasa dan framework UI)
- [ ] Implementasi mesin simulasi: Contiguous
- [ ] Implementasi mesin simulasi: Linked (FAT)
- [ ] Implementasi mesin simulasi: Indexed (inode)
- [ ] Antarmuka: form input, peta blok, kontrol Prev / Next / Play, log
- [ ] Tabel dan grafik perbandingan
- [ ] Fitur defragmentasi (Contiguous)
- [ ] Uji skenario demo dan validasi hitungan manual
- [ ] Modul Free space management
- [ ] Modul Struktur direktori

## Cara Menjalankan

*Belum tersedia.* Bagian ini akan diisi setelah implementasi dimulai (instalasi, perintah menjalankan, dan contoh penggunaan).

## Catatan

- Pada metode Indexed, tabel indeks disimpan di area inode terpisah, bukan di blok data. Ini penyederhanaan yang sesuai dengan cara kerja inode di Unix.
- Angka pada skenario demo sengaja dibuat kecil agar bisa dihitung manual saat presentasi.
