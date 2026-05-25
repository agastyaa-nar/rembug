<p align="center">
  <img src="web/public/rembug-logo.svg" alt="Rembug Logo" width="120" />
</p>

<h1 align="center">Rembug</h1>

<p align="center">
  Forum diskusi modern untuk mencatat pertanyaan, keputusan, komentar, reply, dan like dalam satu ruang yang rapi.
</p>

<p align="center">
  <a href="#fitur">Fitur</a> |
  <a href="#preview">Preview</a> |
  <a href="#arsitektur">Arsitektur</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#api-endpoints">API</a> |
  <a href="#deploy">Deploy</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js Badge" />
  <img src="https://img.shields.io/badge/Hapi-API-00A4EF?style=for-the-badge" alt="Hapi Badge" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL Badge" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="React Badge" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind Badge" />
</p>

---

## Preview

<p align="center">
  <img src="web/src/assets/rembug-hero.png" alt="Rembug Hero Preview" width="900" />
</p>

Rembug terdiri dari dua bagian utama:

- **Backend API** dengan Hapi, PostgreSQL, JWT, clean architecture, dan automated tests.
- **Frontend web** dengan React, Vite, Tailwind CSS, landing page, auth page, forum feed, thread detail, komentar, reply, dan like.

---

## Fitur

| Area | Fitur |
| --- | --- |
| Auth | Register, login, logout, JWT access token, refresh token |
| Thread | Buat thread, lihat feed thread, lihat detail thread |
| Komentar | Tambah komentar, hapus komentar milik sendiri |
| Reply | Tambah reply, hapus reply milik sendiri |
| Like | Toggle like pada komentar |
| Frontend | Landing page, login/register page, forum feed, detail thread, responsive UI |
| Testing | Unit test, integration test, repository test, use case test |

<details>
<summary><strong>Yang masih berupa UI dummy</strong></summary>

Beberapa bagian tampilan sudah disiapkan untuk pengembangan lanjutan, tetapi belum punya endpoint khusus:

- Search thread/komentar
- Filter `Popular`, `Newest`, `Team notes`
- Topik/tag forum
- Trending sidebar
- Bookmark/saved post
- Vote thread
- Profile detail user

</details>

---

## Arsitektur

Project ini memakai pendekatan clean architecture agar domain, use case, repository, dan HTTP handler tetap terpisah.

```mermaid
flowchart TD
  Browser["Browser / React UI"]
  API["Hapi API"]
  Handler["HTTP Handlers"]
  UseCase["Application Use Cases"]
  Domain["Domain Entities & Repositories"]
  Infra["PostgreSQL Repositories"]
  DB[("PostgreSQL")]

  Browser --> API
  API --> Handler
  Handler --> UseCase
  UseCase --> Domain
  UseCase --> Infra
  Infra --> DB
```

Struktur folder penting:

```text
forum-api
├── src
│   ├── Applications
│   ├── Commons
│   ├── Domains
│   ├── Infrastructures
│   └── Interfaces
├── migrations
├── tests
├── web
│   ├── public
│   └── src
└── DEPLOYMENT.md
```

---

## Tech Stack

| Layer | Teknologi |
| --- | --- |
| Backend | Node.js, Hapi |
| Auth | @hapi/jwt, bcrypt |
| Database | PostgreSQL, node-pg-migrate |
| Frontend | React, Vite |
| Styling | Tailwind CSS |
| Testing | Jest |
| Deploy | Render, Neon, Vercel |

---

## Quick Start

### 1. Clone dan install dependency

```bash
git clone https://github.com/username/forum-api.git
cd forum-api
npm install
```

### 2. Siapkan environment backend

Buat file `.env` di root project:

```env
HOST=localhost
PORT=5000

PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password_database
PGDATABASE=forumapi

ACCESS_TOKEN_KEY=secret_access_token
REFRESH_TOKEN_KEY=secret_refresh_token
ACCESS_TOKEN_AGE=1800
```

Untuk production dengan Neon, gunakan:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ACCESS_TOKEN_KEY=secret_access_token
REFRESH_TOKEN_KEY=secret_refresh_token
ACCESS_TOKEN_AGE=1800
```

### 3. Jalankan migration

```bash
npm run migrate up
```

### 4. Jalankan backend

```bash
npm run start:dev
```

Backend berjalan di:

```text
http://localhost:5000
```

### 5. Jalankan frontend

```bash
npm run web:dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

---

## Web Environment

Frontend membaca URL backend dari `VITE_API_BASE_URL`.

Contoh `.env` untuk web:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Untuk production:

```env
VITE_API_BASE_URL=https://nama-backend.onrender.com
```

Jangan tambahkan slash di akhir URL.

---

## API Endpoints

### Users

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/users` | Register user |

### Authentications

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/authentications` | Login |
| PUT | `/authentications` | Refresh access token |
| DELETE | `/authentications` | Logout |

### Threads

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/threads` | Ambil feed thread |
| POST | `/threads` | Buat thread |
| GET | `/threads/{threadId}` | Detail thread |

### Comments

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/threads/{threadId}/comments` | Tambah komentar |
| DELETE | `/threads/{threadId}/comments/{commentId}` | Hapus komentar |

### Replies

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/threads/{threadId}/comments/{commentId}/replies` | Tambah reply |
| DELETE | `/threads/{threadId}/comments/{commentId}/replies/{replyId}` | Hapus reply |

### Likes

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| PUT | `/threads/{threadId}/comments/{commentId}/likes` | Toggle like komentar |

---

## Testing

Jalankan semua test:

```bash
npm test
```

Test mencakup:

- domain entities
- use cases
- repositories
- HTTP endpoints
- authentication
- comment likes

---

## Deploy

Panduan deploy lengkap tersedia di:

[DEPLOYMENT.md](DEPLOYMENT.md)

Rekomendasi stack deploy:

```text
Frontend: Vercel
Backend : Render
Database: Neon PostgreSQL
```

<details>
<summary><strong>Checklist production</strong></summary>

- Set `DATABASE_URL` di Render.
- Set `HOST=0.0.0.0` di Render.
- Set `ACCESS_TOKEN_KEY`.
- Set `REFRESH_TOKEN_KEY`.
- Jalankan migration ke Neon.
- Set `VITE_API_BASE_URL` di Vercel.
- Redeploy backend dan frontend setelah mengubah environment variables.

</details>

---

## Troubleshooting

<details>
<summary><strong>Backend mencari localhost:5432 di Render</strong></summary>

Pastikan `DATABASE_URL` sudah diset di Render dan backend sudah memakai konfigurasi production.

File pool database production menggunakan `DATABASE_URL`:

```js
const productionConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }
  : {};
```

</details>

<details>
<summary><strong>Frontend terkena CORS</strong></summary>

Pastikan:

- Backend Render sudah live.
- `VITE_API_BASE_URL` mengarah ke backend Render.
- Tidak ada slash di akhir `VITE_API_BASE_URL`.
- Vercel sudah redeploy setelah env diubah.

</details>

<details>
<summary><strong>Migration tidak membuat tabel baru</strong></summary>

Jika muncul:

```text
No migrations to run!
```

berarti database target sudah punya catatan migration. Pastikan backend production memakai database yang sama dengan database yang dimigration.

</details>

---

## Author

Built with care by **Dhanar Agastya Rakalangi**.

---

<p align="center">
  Copyright (c) 2026 Rembug. All rights reserved.
</p>
