# Express API Generator

![Express API Generator](images/icon.png)

## Deskripsi

Express API Generator adalah extension VSCode yang mempermudah pembuatan struktur **Express.js API** dan endpoint CRUD secara otomatis.
Dengan extension ini, Anda dapat memulai proyek Express baru atau menambahkan endpoint baru hanya dengan beberapa klik.

---

## Fitur

### 1. Init Project

- Membuat folder project dengan struktur standar:
  my-api/
  └── src/
  ├── controller/
  ├── middleware/
  ├── models/
  ├── routes/
  └── config/
  └── index.js
- Membuat .gitignore yang otomatis mengabaikan node_modules/ dan .env
- Membuat file env.example dengan template konfigurasi
- Membuat file src/config/database.js untuk koneksi MySQL
- Menginstall dependencies otomatis: express, dotenv, mysql2
- Menginstall devDependencies otomatis: nodemon
- Mengupdate package.json:
  - "main": "src/index.js"
  - Scripts:
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"

### 2. Add Endpoint

- Membuat **Controller**, **Model**, dan **Route** secara otomatis untuk endpoint baru
- Mengupdate src/index.js agar endpoint baru langsung dapat digunakan
- Contoh pembuatan endpoint:
  - Nama endpoint: users
  - Hasil:
    src/controller/usersController.js
    src/models/usersModels.js
    src/routes/usersRoutes.js

---

## Instalasi

### 1. Dari VSIX

1. Download file .vsix
2. Buka VSCode → Extensions → klik tiga titik → Install from VSIX...
3. Pilih file .vsix

### 2. Dari Marketplace (nanti, jika sudah dipublish)

- Cari **Express API Generator** di Extensions Marketplace
- Klik Install

---

## Cara Menggunakan

### 1. Init Project

1. Buka folder kosong di VSCode
2. Tekan Ctrl+Shift+P → ketik Init Express Project
3. Tunggu sampai semua file dan folder dibuat otomatis

### 2. Add Endpoint

1. Tekan Ctrl+Shift+P → ketik Add Endpoint
2. Masukkan nama endpoint (misal: users)
3. Controller, Model, Route, dan update index.js otomatis dibuat

---

## Struktur Folder Hasil Init

my-api/
├─ src/
│ ├─ controller/
│ ├─ middleware/
│ ├─ models/
│ ├─ routes/
│ └─ config/
│ └─ database.js
│ └─ index.js
├─ .gitignore
├─ env.example
└─ package.json

---

## Contoh .env.example

PORT=xxxx
DB_HOST=xxxx
DB_USERNAME=xxxx
DB_PASSWORD=xxxx
DB_NAME=xxxx

---

## Requirement

- VSCode terbaru
- Node.js versi 16+
- NPM

---

## Kontribusi

PR, isu, dan saran sangat diterima.
Silakan fork repo dan buat pull request jika ingin menambahkan fitur baru atau perbaikan.

---

## Lisensi

MIT License © 2025 Faris Syafiq Sujana
