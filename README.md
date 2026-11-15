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
  "image": "",
  "alt": "Deskripsi gambar"
}
```

`image` dan `alt` boleh berupa string kosong. Situs mengambil hingga 100 berita terbaru melalui `GET /api/news`; running text dan arsip memakai koleksi yang sama.

## Mengelola konten melalui Atlas

Konten situs dipisahkan ke lima koleksi: `homepage_content`, `legislation_content`, `archives_content`, `activities_content`, dan `organization_content`. Setiap koleksi memakai satu dokumen dengan `key: "main"` dan data halaman di dalam field `content`. Endpoint `GET /api/content` menggabungkan dokumen-dokumen tersebut untuk frontend; tidak ada endpoint publik untuk mengubah konten.

File contoh berisi data ilustratif. Ganti atau hapus semua data contoh sebelum menampilkannya sebagai informasi resmi. Situs tidak memiliki dashboard admin atau sesi login. Halaman publik membaca konten dan berita langsung dari MongoDB; untuk mengubahnya, edit koleksi MongoDB secara langsung. Tidak ada endpoint publik untuk menulis atau mengubah konten. Backend tidak lagi membaca koleksi `admin_users`; koleksi lama tidak dihapus otomatis.

1. Pastikan pengguna aplikasi di **Atlas → Database Access** memiliki role `readWrite` pada database `dpm_km_unnes`; aplikasi memerlukan izin ini untuk menyimpan kiriman aspirasi. Jangan pernah menaruh kredensial database di browser atau konten publik.
2. Jika perlu memindahkan konten, buka [site-content.example.json](./site-content.example.json), lalu salin struktur dokumen di bawah nama koleksi ke Atlas. Setiap dokumen berbentuk `{ "key": "main", "content": { ... } }`.
3. Edit dokumen yang ada langsung di Atlas. Hindari membuat dokumen `key: "main"` duplikat pada koleksi yang sama, dan jangan menyalin data contoh untuk menimpa konten resmi.
4. Untuk memindahkan data dari koleksi lama `site_content`, salin field `homepage`, `legislation`, `archives`, `activities`, dan `organization` ke field `content` pada koleksi baru yang sesuai. Backend tetap menggunakan data lama sebagai fallback untuk bagian yang belum dipindahkan.
5. Daftar RUU berada di `legislation_content.content.bills`; tautkan `documentId` ke `id` yang sama pada `legislation_content.content.documents`. Arsip berada di `archives_content.content.items`, dengan kategori `laws` atau `activities`. Anggaran, laporan, dan galeri berada di `activities_content.content.budget`, `.oversight`, dan `.gallery`. Profil pengurus berada di `organization_content.content.profiles`; setiap profil perlu memiliki `name`, `position`, dan `photo`, sedangkan `photoAlt` bersifat opsional. Hanya profil lengkap yang menampilkan foto, nama, dan jabatan.
6. Berita dikelola langsung pada koleksi `news`. Semua dokumen berita di koleksi itu langsung tampil di situs, jadi hanya masukkan berita yang sudah disetujui.
7. Untuk gambar, gunakan URL HTTPS yang dapat diakses publik atau URL media GridFS yang sudah tersimpan (`/api/media/<id>`). Endpoint unggah admin sudah dihapus.

Dokumen yang disediakan: **Undang-Undang Keluarga Mahasiswa Universitas Negeri Semarang Nomor 6 Tahun 2025 tentang Pemilihan Umum Raya Keluarga Mahasiswa Universitas Negeri Semarang**. PDF aslinya tersedia di [`UU No. 6 Tahun 2025 tentang PEMIRA KM UNNES.pdf`](./UU%20No.%206%20Tahun%202025%20tentang%20PEMIRA%20KM%20UNNES.pdf). Untuk memublikasikannya, gunakan struktur berikut pada field `content` dokumen `legislation_content`:

```json
{
  "key": "main",
  "content": {
    "bills": [
      {
        "id": "uu-km-unnes-6-2025",
        "documentId": "uu-km-unnes-6-2025",
        "label": "Undang-Undang",
        "title": "Nomor 6 Tahun 2025 tentang Pemilihan Umum Raya",
        "description": "Naskah resmi UU KM UNNES yang disediakan untuk dibaca dan diunduh.",
        "status": "Naskah tersedia"
      }
    ],
    "documents": [
      {
        "id": "uu-km-unnes-6-2025",
        "badge": "NASKAH UNDANG-UNDANG",
        "type": "UNDANG-UNDANG KELUARGA MAHASISWA",
        "title": "PEMILIHAN UMUM RAYA KELUARGA MAHASISWA UNIVERSITAS NEGERI SEMARANG",
        "number": "Nomor 6 Tahun 2025",
        "subject": "PEMILIHAN UMUM RAYA KELUARGA MAHASISWA UNIVERSITAS NEGERI SEMARANG",
        "note": "Baca naskah lengkap pada pratinjau PDF atau unduh dokumen resmi.",
        "downloadUrl": "UU%20No.%206%20Tahun%202025%20tentang%20PEMIRA%20KM%20UNNES.pdf",
        "previewUrl": "UU%20No.%206%20Tahun%202025%20tentang%20PEMIRA%20KM%20UNNES.pdf",
        "sections": [],
        "chapters": [
          { "id": "bab-i", "chapter": "BAB I", "title": "KETENTUAN UMUM", "page": 2 }
        ]
      }
    ]
  }
}
```

`documentId` pada daftar harus sama persis dengan `id` naskah. Klik item UU di halaman Undang-Undang untuk menampilkan naskahnya. Untuk dokumen PDF gunakan `previewUrl` dan `downloadUrl` yang menunjuk ke file yang benar-benar tersedia. Navigasi bab dibentuk dari `chapters` pada dokumen yang aktif; setiap entri memakai `title` dan nomor halaman PDF 1-based pada `page`. Perbarui daftar `chapters` bersamaan dengan PDF agar tombol selalu mengikuti naskah terbaru. Jika dokumen berisi `sections` alih-alih PDF, navigasi dibuat dari bagian tersebut dan mengarah ke judul bagiannya. Untuk database lama, letakkan `chapters` pada `site_content.legislation.documents[]`; backend menggabungkannya sebagai fallback. Data contoh yang ditandai sebagai ilustrasi atau `sample` tidak ditampilkan sebagai informasi resmi.

Gunakan URL HTTPS untuk gambar dan dokumen eksternal. Tautan relatif hanya untuk file yang memang tersedia di situs. Semua konten pada koleksi-koleksi halaman dan arsip bersifat publik melalui API; jangan simpan aspirasi, data pribadi, atau rahasia di dalamnya.

## Aspirasi mahasiswa

Formulir beranda mengirim data ke `POST /api/aspirations`. Kiriman disimpan di koleksi `aspirations` dan tidak ditampilkan kepada publik. Endpoint memvalidasi isi dan membatasi kiriman hingga 10 per alamat IP per jam. Batasi akses koleksi ini kepada staf yang berwenang melalui Atlas.

## Deploy ke Railway

1. Unggah proyek ke repositori GitHub dan hubungkan repositori melalui **Railway → New Project → Deploy from GitHub repo**. Railway memakai `railway.json` untuk menjalankan `npm start` dan memeriksa `/api/health`.
2. Pada service Railway, buka **Variables** dan tambahkan `MONGODB_URI` berisi connection string dari Atlas serta `MONGODB_DB` dengan nilai `dpm_km_unnes`. Simpan kredensial hanya sebagai variable Railway, bukan di repositori. Jika variable `ADMIN_SESSION_SECRET`, `ADMIN_BOOTSTRAP_USERNAME`, atau `ADMIN_BOOTSTRAP_PASSWORD` lama masih ada, hapus karena tidak lagi digunakan.
3. Di Atlas, atur **Security → Network Access** agar mengizinkan koneksi keluar Railway. Gunakan static outbound IP jika tersedia untuk project/plan Anda dan izinkan hanya IP tersebut. Hindari `0.0.0.0/0`; jika Railway tidak menyediakan egress IP yang stabil, periksa opsi egress/IP statis yang tersedia sebelum memperluas akses Atlas.
4. Deploy service, buka domain yang dibuat Railway, lalu periksa `/api/health`. Respons sukses menunjukkan `"database":"connected"`.

Pastikan kredensial Atlas tidak pernah dimasukkan ke file yang di-commit. Jika connection string atau password pernah terlihat di tangkapan layar atau tersimpan di repositori, rotasi password database Atlas dan perbarui `MONGODB_URI` di Railway.

URL dashboard Atlas bukan connection string database maupun alamat hosting API. Ambil connection string driver dari **Connect → Drivers** di Atlas.
