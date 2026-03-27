# QR Studio – Sistem Absensi Berbasis QR Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/neveerlabs/QR-Studio/blob/b658f3fa3c5646f4a7b173a2a170bc329348f383/LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)](https://mysql.com/)

Aplikasi web untuk menghasilkan, menyimpan, dan memindai QR code, dengan fitur absensi sekolah. Dikembangkan untuk memudahkan pencatatan kehadiran siswa dan guru secara modern dan efisien.

---

## Fitur Utama

### Role User (Tanpa Login)
- **Generate QR** – dua tipe:
  - **Catatan**: teks bebas (URL, catatan, dll.)
  - **Sekolah**: data lengkap siswa/guru (nama, role, status, NIS/NISN, kelas, tempat tanggal lahir)
- **Vault** – penyimpanan lokal (IndexedDB) semua QR yang pernah dibuat. Bisa lihat, download (sebagai `barcode.png`), dan hapus.

### Role Admin (Login)
- **Login Admin** – username/password default: `admin` / `admin123` (bisa diubah di `.env`)
- **Scan QR**:
  - Kamera live dengan bounding box dan scan line animasi
  - Upload gambar QR dari storage
  - Hanya memproses QR bertipe sekolah → mencatat kehadiran otomatis (satu kali per hari)
- **Absensi**:
  - Tabel kehadiran dengan filter tanggal
  - Hapus data user (siswa/guru) → juga menghapus semua catatan absensi terkait
- **Backup Data**:
  - Pilih periode (bulan, tahun) dan role (siswa, guru, semua)
  - Export ke Excel (`.xlsx`) dengan format tanggal lokal Indonesia (misal: `27 Maret 2026`)
- **Manajemen Data** – semua data siswa/guru tersimpan di database MySQL

---

## Contoh Tampilan (Review)

> *Gambar berikut adalah ilustrasi tampilan aplikasi.*

### Halaman utama (generate catatan)
![Generate catatan](https://github.com/neveerlabs/QR-Studio/raw/a498a0e91dc439d5e831a097a8f245d0ee8bf1c5/Screenshots/Screenshot%20(66).png)
*Masukkan teks di input, lalu klik `Generate QR` untuk generate, lalu klik `Simpan ke vault` untuk menyimpan dan unduh barcode.*

### Generate barcode sekolah (Siswa)
![QR Siswa](https://github.com/neveerlabs/QR-Studio/raw/bc150d32c0010fcd0e965caa00580a3507f11bf0/Screenshots/Screenshot%20(61).png
)
*Masukkan seluruh data input, lalu tekan tombol `Generate QR` untuk generate dan `Simpan ke vault`*

### Generate barcode sekolah (Guru)
![QR Guru](https://github.com/neveerlabs/QR-Studio/raw/bc150d32c0010fcd0e965caa00580a3507f11bf0/Screenshots/Screenshot%20(62).png)
*Masukkan seluruh input, klik `Generate QR` dan `Simpan ke vault`*

### Vault – Koleksi QR
![Vault](https://github.com/neveerlabs/QR-Studio/raw/a498a0e91dc439d5e831a097a8f245d0ee8bf1c5/Screenshots/Screenshot%20(67).png)
*Daftar QR yang pernah dibuat, dilengkapi tombol lihat, download, hapus.*

### Dashboard Admin – Scan Kamera
![Scan Kamera](https://github.com/neveerlabs/QR-Studio/raw/bc150d32c0010fcd0e965caa00580a3507f11bf0/Screenshots/Screenshot%20(63).png)
*Scanner dengan overlay bounding box dan garis animasi. Hasil scan ditampilkan di bawah.*

### Halaman Absensi
![Absensi](https://github.com/neveerlabs/QR-Studio/raw/bc150d32c0010fcd0e965caa00580a3507f11bf0/Screenshots/Screenshot%20(64).png)
*Tabel kehadiran, filter tanggal, dan tombol backup data.*

### Backup data ke excell
![Data backup](https://github.com/neveerlabs/QR-Studio/blob/ac1cff16f4194a457f3367f3e442532cb8af6806/Screenshots/Screenshot%20(69).png)
*Format data absen yang disimpan akan diexport ke dalam file excell. dan hanya menyimpan data absen yang hadir saja. Dan masih dalam tahao revisian*

---

## Teknologi yang Digunakan

| Bagian        | Teknologi                                                                 |
|---------------|---------------------------------------------------------------------------|
| Frontend      | HTML5, CSS3 (Glassmorphism, Responsif), JavaScript, FontAwesome 6, Inter |
| Library QR    | `qrcodejs` (generator), `html5-qrcode` (scanner)                         |
| Backend       | Node.js, Express, MySQL2, CORS, dotenv, crypto                           |
| Export Excel  | SheetJS (XLSX)                                                           |
| Database      | MySQL (tabel `users`, `absensi`, `devices`)                              |

---

## Instalasi & Menjalankan

### 1. Prasyarat
- Node.js (v16 atau lebih tinggi)
- MySQL (v8 atau lebih tinggi) – jalankan di XAMPP / MySQL Workbench / CLI
- Git (opsional)

### 2. Clone Repository
```bash
git clone https://github.com/neveerlabs/QR-Studio.git
cd QR-Studio
```

### 3. Install Dependencies Backend
```bash
npm install express mysql2 cors dotenv
```

### 4. Konfigurasi Database
Buat database MySQL, dengan nama `absensi_db`

Sesuaikan isi file .env dengan milik anda.
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=absensi_db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=3000
```
> Catatan: Tabel akan dibuat otomatis saat server pertama kali dijalankan.

### 5. Persiapan Frontend
Pastikan folder public berisi:

index.html

styling.css

script.js

logo.png (opsional, untuk favicon)

### 6. Jalankan Server
bash
node server.js
Server akan berjalan di http://localhost:3000.

### 7. Akses Aplikasi
User: langsung bisa generate QR dan melihat vault.

Admin: klik ikon profil → login dengan kredensial yang sudah diset.

| Endpoint           | Method | Deskripsi                                          |
|--------------------|--------|----------------------------------------------------|
| `/api/login`       | POST   | Login admin, menghasilkan `device_id`              |
| `/api/logout`      | POST   | Hapus `device_id`                                  |
| `/api/check-device`| GET    | Cek status device (admin/user)                     |
| `/api/users`       | POST   | Tambah data siswa/guru                             |
| `/api/users`       | GET    | Ambil semua data siswa/guru                        |
| `/api/users/:id`   | DELETE | Hapus data user dan semua absensinya               |
| `/api/absen`       | POST   | Catat kehadiran (memerlukan `device_id` admin)     |
| `/api/absen`       | GET    | Ambil data absensi hari ini (dengan filter `date`) |
| `/api/absen/month` | GET    | Ambil data absensi bulan/tahun (opsional `role`)   |

---

### Lisensi
MIT License – silakan digunakan, dimodifikasi, dan didistribusikan dengan tetap menyertakan kredit kepada pengembang asli.

---

### Catatan
QR yang dibuat untuk tipe sekolah akan langsung menyimpan data ke database dan QR tersebut mengandung id user, sehingga saat discan, sistem langsung mengenali siapa yang hadir.

Absensi hanya dapat dilakukan satu kali per hari per user.

Data backup disimpan dalam format Excel dengan kolom: Nama Panggilan, Nama Lengkap, Role, Status, Kelas, Waktu (tanggal dalam format Indonesia), Status Kehadiran.
