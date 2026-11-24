# Rekap Penjualan & Ringkasan Telegram

Aplikasi web analitik penjualan distributor berbasis **React + Express + SQLite** untuk membaca dan membersihkan data invoice (`sales.csv`), menampilkan performa per **region** dan **brand**, memvisualisasikan **tren penjualan bulanan & forecast**, **diagram alir Sankey**, menandai **5 outlet terlemah**, serta menyusun **ringkasan satu paragraf siap kirim untuk Telegram**.

Seluruh dataset yang aktif disimpan ke **SQLite (`data/sales.sqlite`)** sehingga data yang diunggah tidak hilang saat browser di-refresh atau server dimulai ulang.

---

## Fitur Utama

1. **Persistensi SQLite (`node:sqlite`)**:
   - Menggunakan database SQLite lokal (`data/sales.sqlite` secara default, dapat diatur via `SQLITE_DB_PATH`).
   - Saat pertama kali dijalankan, database otomatis terisi dari `public/sales.csv` (jika tersedia) atau 32 baris preview awal terverifikasi.
   - Setiap unggahan CSV baru melalui antarmuka web disimpan secara atomik ke SQLite (`BEGIN IMMEDIATE ... COMMIT`) melalui endpoint `POST /api/sales/import`.
2. **Penjualan per Region & Brand**: Agregasi *net sales*, *gross sales*, diskon, volume karton, dan pangsa (%) dengan filter interaktif.
3. **Tren Bulanan & Forecast Penjualan (Hybrid Node + Python CLI)**:
   - Mendukung perhitungan lokal instan (*Tren Linear* & *Rata-rata Tertimbang*) serta mode **Hybrid Python (`POST /api/forecast/python`)** yang mengeksekusi script CLI `scripts/forecast_worker.py` via `child_process.spawn`.
   - Worker Python memodelkan tren harian + musiman mingguan (*Damped Holt + Weekday Seasonality*, serta otomatis memakai `statsmodels` / `autogluon.timeseries` jika terpasang) lalu menyimpannya ke cache SQLite (`forecast_cache`).
4. **Diagram Alir Penjualan (Sankey)**: Memetakan aliran nilai penjualan dari **Region → Brand** maupun **Region → Tipe Outlet → Brand**.
5. **Deteksi 5 Outlet Terlemah**: Mengurutkan outlet dengan kinerja terendah disertai diagnosis penyebab utama (retur, frekuensi minim, volume rendah, atau nilai invoice kecil).
6. **Ringkasan Eksekutif Telegram (List / 1 Paragraf)**: Otomatis menyusun ringkasan siap salin untuk Sales Manager.
7. **Pembersihan & Audit Kualitas Data**: Normalisasi nama region (`Jabar` / `JAWA BARAT` → `Jawa Barat`), perapian spasi berlebih, deteksi duplikat identik, penandaan `salesman` kosong (`Belum Tercatat`), serta pemisahan dokumen retur (`RTR*` / nilai negatif).

---

## Struktur Proyek (Modular)

```text
├── server.ts                  # Entrypoint HTTP server & graceful shutdown
├── scripts/
│   ├── forecast_worker.py     # Worker CLI Python (Damped Holt + Statsmodels / AutoGluon opsional)
│   └── test_forecast_worker.py# Unit test worker Python
├── server/
│   ├── config.ts              # Konfigurasi environment (PORT, SQLITE_DB_PATH, PYTHON_FORECAST_BIN)
│   ├── app.ts                 # Factory aplikasi Express (terpisah untuk pengujian)
│   ├── salesDb.ts             # Repository SQLite (transaksi import, query harian, forecast_cache)
│   ├── services/
│   │   └── pythonForecastRunner.ts # Eksekutor aman Python CLI (stdin/stdout JSON)
│   ├── db/
│   │   ├── schema.ts          # Skema tabel & index SQLite (datasets, sales_rows, forecast_cache)
│   │   └── rowMapper.ts       # Pemetaan baris SQLite ke model domain
│   └── routes/
│       └── salesRoutes.ts     # Router API (/api/health, /api/sales, /import, /reset, /forecast/python)
├── src/
│   ├── App.tsx                # Layout utama & orkestrasi tampilan
│   ├── services/salesApi.ts   # Klien HTTP frontend ke backend SQLite & Python forecast
│   ├── hooks/                 # Custom React hooks (useSalesDashboard, useDebouncedValue)
│   ├── utils/                 # Logika murni (parser CSV, analitik, forecast, sankey, formatter)
│   ├── components/            # Komponen UI modular per bagian dashboard
│   ├── types/sales.ts         # Kontrak tipe TypeScript terpusat
│   └── data/starterCsv.ts     # Dataset fallback 32 baris terverifikasi
├── requirements-forecast.txt  # Dependensi Python forecast (numpy, pandas, statsmodels, scikit-learn)
├── Dockerfile                 # Multi-stage Docker build (Node 22 + Python 3 virtualenv)
└── .env.example               # Contoh variabel lingkungan
```

---

## Cara Menjalankan di Komputer Lokal

### Prasyarat
- **Node.js versi 22.x** atau lebih baru (diperlukan untuk dukungan bawaan `node:sqlite`).

### Langkah Menjalankan

1. **Pasang dependensi**:
   ```bash
   npm install
   ```

2. **(Opsional) Muat file `sales.csv` otomatis saat inisialisasi awal**:
   - Buat folder `public/` lalu salin file `sales.csv` Anda ke `public/sales.csv`.
   - Jika `data/sales.sqlite` belum dibuat, server otomatis membaca `public/sales.csv` ke SQLite saat startup.
   - Anda juga selalu bisa mengunggah atau menempel isi CSV langsung dari tombol **Unggah sales.csv** di kanan atas aplikasi.

3. **Jalankan mode development**:
   ```bash
   npm run dev
   ```
   Buka browser ke `http://localhost:3000`.

4. **Jalankan mode produksi lokal**:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

---

## Menjalankan dengan Docker

Database SQLite disimpan di `/app/data/sales.sqlite` di dalam container. Gunakan *volume mount* agar data tetap tersimpan walaupun container dibuat ulang.

1. **Build image Docker**:
   ```bash
   docker build -t rekap-penjualan-app .
   ```

2. **Jalankan container (dengan persistensi SQLite lokal)**:
   ```bash
   mkdir -p data
   docker run -d \
     --name rekap-penjualan \
     -p 3000:3000 \
     -v "$(pwd)/data:/app/data" \
     rekap-penjualan-app
   ```

3. *(Opsional)* Jika ingin langsung menyertakan file `sales.csv` lokal sebagai seed awal container baru:
   ```bash
   docker run -d \
     --name rekap-penjualan \
     -p 3000:3000 \
     -v "$(pwd)/data:/app/data" \
     -v "$(pwd)/sales.csv:/app/public/sales.csv:ro" \
     rekap-penjualan-app
   ```

4. Akses aplikasi di `http://localhost:3000` dan cek status server di `http://localhost:3000/api/health`.

---

## Unit Test & Verifikasi Kode

```bash
# Jalankan seluruh unit test (SQLite persistence, API routes, CSV parser, forecast, sankey)
npx tsx --test server/salesDb.test.ts server/salesRoutes.test.ts src/utils/salesPipeline.test.ts src/utils/salesForecast.test.ts src/utils/sankeyBuilder.test.ts

# Verifikasi tipe TypeScript & build produksi
npm run lint
npm run build
```
