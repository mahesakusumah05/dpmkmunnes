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

## Deploy ke Railway

1. Unggah proyek ke repositori GitHub dan hubungkan repositori melalui **Railway → New Project → Deploy from GitHub repo**. Railway memakai `railway.json` untuk menjalankan `npm start` dan memeriksa `/api/health`.
2. Pada service Railway, buka **Variables** dan tambahkan `MONGODB_URI` berisi connection string dari Atlas, serta `MONGODB_DB` dengan nilai `dpm_km_unnes`. Simpan URI sebagai variable rahasia dan jangan menaruhnya di repositori.
3. Di Atlas, atur **Security → Network Access** agar mengizinkan koneksi keluar Railway. Gunakan static outbound IP jika tersedia untuk project/plan Anda dan izinkan hanya IP tersebut. Hindari `0.0.0.0/0`; jika Railway tidak menyediakan egress IP yang stabil, periksa opsi egress/IP statis yang tersedia sebelum memperluas akses Atlas.
4. Deploy service, buka domain yang dibuat Railway, lalu periksa `/api/health`. Respons sukses menunjukkan `"database":"connected"`.

Pastikan kredensial Atlas tidak pernah dimasukkan ke file yang di-commit. Jika connection string atau password pernah terlihat di tangkapan layar atau tersimpan di repositori, rotasi password database Atlas dan perbarui `MONGODB_URI` di Railway.

URL dashboard Atlas bukan connection string database maupun alamat hosting API. Ambil connection string driver dari **Connect → Drivers** di Atlas.
