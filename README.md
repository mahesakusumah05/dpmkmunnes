# Portal DPM KM UNNES

Situs disajikan oleh Express. Berita dimuat dari MongoDB Atlas; formulir aspirasi menyimpan kiriman ke MongoDB.

## Menjalankan secara lokal

1. Gunakan Node.js versi 20 atau lebih baru.
2. Salin `.env.example` menjadi `.env`.
3. Di MongoDB Atlas, buat pengguna database dengan peran `readWrite` hanya untuk database `dpm_km_unnes`, lalu izinkan alamat IP mesin ini di **Network Access**.
4. Isi `MONGODB_URI` di `.env` dengan connection string dari **Connect → Drivers** di Atlas. Jangan memasukkan kredensial ke kode atau membagikannya melalui chat.
5. Jalankan `npm install`, lalu `npm run dev`. Buka `http://localhost:3000`.

Server tidak akan berjalan tanpa koneksi MongoDB yang berhasil. Endpoint `/api/health` menunjukkan status koneksi database.

## Mengelola berita melalui Atlas

Buat database `dpm_km_unnes` dan koleksi `news`, lalu tambahkan dokumen berikut. Semua dokumen dalam koleksi ini langsung ditampilkan ke publik, jadi tambahkan hanya berita yang sudah disetujui.

```json
{
  "label": "Berita DPM KM UNNES",
  "title": "Judul berita",
  "description": "Ringkasan berita",
  "date": "2026-11-15",
  "image": "https://images.unsplash.com/example",
  "alt": "Deskripsi gambar"
}
```

`image` dan `alt` boleh berupa string kosong. Situs mengambil hingga 100 berita terbaru melalui `GET /api/news`; running text dan arsip memakai koleksi yang sama.

## Aspirasi mahasiswa

Formulir beranda mengirim data ke `POST /api/aspirations`. Kiriman disimpan di koleksi `aspirations` dan tidak ditampilkan kepada publik. Endpoint memvalidasi isi dan membatasi kiriman hingga 10 per alamat IP per jam. Batasi akses koleksi ini kepada staf yang berwenang melalui Atlas.

## Deploy ke Render

Hubungkan repositori proyek ke Render sebagai **Web Service**, atau gunakan Blueprint dari `render.yaml`. Isi `MONGODB_URI` sebagai secret environment variable di Render; jangan simpan kredensial di repositori. Izinkan alamat egress Render di **Atlas Network Access** dan gunakan pengguna database dengan peran minimum yang diperlukan. Jika layanan Render memakai alamat egress dinamis, gunakan IP statis jika tersedia daripada membuka akses jaringan secara luas. Render menyediakan `PORT` secara otomatis.

URL dashboard Atlas bukan connection string database maupun alamat hosting API. Ambil connection string driver dari **Connect → Drivers** di Atlas.
