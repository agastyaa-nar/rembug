# Panduan Deploy Rembug

Panduan ini memakai kombinasi:

- Frontend: Vercel
- Backend API: Render Free Web Service
- Database: Neon Free PostgreSQL

Arsitektur akhirnya:

```text
Browser
  -> Vercel frontend
  -> Render backend API
  -> Neon PostgreSQL
```

## 1. Siapkan Database Neon

1. Buka https://neon.com dan buat akun.
2. Buat project baru, misalnya `rembug`.
3. Pilih region yang dekat dengan backend. Untuk Render free, region yang umum dipakai bisa `Singapore` jika tersedia, atau region terdekat lain.
4. Buka menu **Connection Details**.
5. Copy connection string PostgreSQL. Pilih yang pooled jika tersedia.

Contoh bentuk connection string:

```text
postgresql://user:password@host/dbname?sslmode=require
```

Simpan string ini. Nanti dipakai sebagai `DATABASE_URL`.

## 2. Jalankan Migration ke Neon

Di terminal lokal, masuk ke folder project:

```powershell
cd "D:\Dhanar\Code\Dicoding\Backend Expert\Project 2\forum-api"
```

Set `DATABASE_URL` ke connection string Neon:

```powershell
$env:DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

Jalankan migration:

```powershell
npm run migrate up
```

Kalau sukses, tabel production sudah dibuat di Neon.

## 3. Deploy Backend ke Render

1. Push project ke GitHub.
2. Buka https://render.com.
3. Pilih **New** -> **Web Service**.
4. Connect repository GitHub project ini.
5. Isi konfigurasi:

```text
Name: rembug-api
Runtime: Node
Branch: main
Root Directory: forum-api
Build Command: npm install
Start Command: npm start
```

Jika repository GitHub langsung berisi folder `forum-api` sebagai root, kosongkan **Root Directory**.

Tambahkan environment variables di Render:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=10000
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ACCESS_TOKEN_KEY=isi_dengan_random_secret_panjang
REFRESH_TOKEN_KEY=isi_dengan_random_secret_lain
ACCESS_TOKEN_AGE=1800
```

Catatan:

- `DATABASE_URL` pakai connection string dari Neon.
- `ACCESS_TOKEN_KEY` dan `REFRESH_TOKEN_KEY` jangan sama.
- Render biasanya menyediakan `PORT`, tapi aman juga diset manual.

Setelah deploy berhasil, Render akan memberi URL seperti:

```text
https://rembug-api.onrender.com
```

Tes API:

```powershell
Invoke-RestMethod https://rembug-api.onrender.com/threads
```

Kalau response JSON muncul, backend sudah hidup.

## 4. Deploy Frontend ke Vercel

1. Buka https://vercel.com.
2. Import repository GitHub.
3. Atur project sebagai Vite app.
4. Isi konfigurasi build:

```text
Framework Preset: Vite
Root Directory: forum-api/web
Build Command: npm run web:build
Output Directory: dist
Install Command: npm install
```

Jika Vercel gagal karena root sudah masuk folder `web`, gunakan:

```text
Build Command: npm run build
```

Namun kondisi project saat ini script build ada di root `forum-api`, jadi konfigurasi paling aman:

```text
Root Directory: forum-api
Build Command: npm run web:build
Output Directory: web/dist
```

Tambahkan environment variable di Vercel:

```text
VITE_API_BASE_URL=https://rembug-api.onrender.com
```

Ganti URL tersebut dengan URL backend Render milikmu.

Penting:

- Jangan tambahkan slash di akhir URL.
- Benar: `https://rembug-api.onrender.com`
- Hindari: `https://rembug-api.onrender.com/`
- Setelah mengubah env di Vercel, wajib redeploy frontend.

Deploy ulang frontend setelah environment variable disimpan.

## 5. Cek Setelah Deploy

Urutan pengecekan:

1. Buka URL backend Render:

```text
https://rembug-api.onrender.com/threads
```

2. Buka URL frontend Vercel.
3. Register akun baru.
4. Login.
5. Buat thread.
6. Buka thread detail.
7. Tambahkan komentar, reply, dan like.

Kalau register/login gagal, cek:

- `ACCESS_TOKEN_KEY` dan `REFRESH_TOKEN_KEY` sudah ada di Render.
- Backend Render sudah redeploy setelah env ditambahkan.
- `VITE_API_BASE_URL` di Vercel sudah mengarah ke URL Render.
- Migration sudah dijalankan ke Neon.

## 6. Catatan Penting Free Tier

- Render Free Web Service bisa sleep setelah idle. Request pertama bisa lambat sekitar beberapa puluh detik.
- Jangan simpan data penting di filesystem Render. Data forum harus masuk Neon.
- Neon Free punya limit storage dan compute, tapi cocok untuk demo/portfolio.
- Jangan memakai database test lokal untuk production.
- Backup data Neon secara berkala kalau data mulai penting.

## 7. Backup Database Neon

Untuk backup dari Neon ke file lokal:

```powershell
pg_dump "postgresql://user:password@host/dbname?sslmode=require" -f rembug-backup.sql
```

Untuk restore:

```powershell
psql "postgresql://user:password@host/dbname?sslmode=require" -f rembug-backup.sql
```

## 8. Troubleshooting Cepat

Backend error `password authentication failed`:

- Connection string salah.
- Password Neon berubah.
- Env `DATABASE_URL` di Render belum benar.

Backend error SSL:

- Pastikan connection string mengandung `sslmode=require`.

Frontend tidak bisa fetch API:

- Pastikan backend Render sudah online.
- Pastikan `VITE_API_BASE_URL` di Vercel benar.
- Redeploy Vercel setelah mengubah env.
- Jika browser menampilkan URL seperti `https://domain.onrender.com//authentications`, hapus slash terakhir dari `VITE_API_BASE_URL`, lalu redeploy.
- Jika masih kena CORS, buka URL backend langsung di browser. Kalau backend error atau belum wake up, response CORS bisa tidak muncul.

Data kosong di production:

- Itu normal kalau data lokal belum dimigrasikan.
- Jalankan migration ke Neon.
- Kalau ingin membawa data lokal, perlu `pg_dump` dari database lokal lalu restore ke Neon.
