# Portal DPM KM UNNES

Situs disajikan oleh Express. Berita dimuat dari MongoDB Atlas; formulir aspirasi menyimpan kiriman ke MongoDB.

## Menjalankan secara lokal

1. Gunakan Node.js versi 20 atau lebih baru.
2. Salin `.env.example` menjadi `.env`.
3. Di MongoDB Atlas, buat pengguna database dengan peran `readWrite` hanya untuk database `dpm_km_unnes`, lalu izinkan alamat IP mesin ini di **Network Access**.
4. Isi `MONGODB_URI` di `.env` dengan connection string dari **Connect → Drivers** di Atlas. Jangan memasukkan kredensial ke kode atau membagikannya melalui chat.
5. Isi konfigurasi SMTP pada `.env` jika fitur email aspirasi akan digunakan.
6. Jalankan `npm install`, lalu `npm run create-admin` untuk membuat akun dashboard. Perintah ini meminta nama pengguna, email, dan kata sandi secara lokal; kata sandi tidak ditampilkan saat diketik.
7. Jalankan `npm run dev`. Buka `http://localhost:3000`.

Server tidak akan berjalan tanpa koneksi MongoDB yang berhasil. Endpoint `/api/health` menunjukkan status koneksi database.

## Dashboard admin

Akun dashboard disimpan pada koleksi `users` di database `dpm_km_unnes`; koleksi akan dibuat otomatis saat menjalankan `npm run create-admin`, jadi tidak perlu membuatnya secara manual. Jalankan perintah tersebut dari terminal setelah `MONGODB_URI` di `.env` terisi. Setiap akun memiliki `username`, `email`, `passwordHash`, `role: "admin"`, `isActive`, dan `createdAt`. Kata sandi di-hash dengan scrypt, bukan disimpan sebagai teks biasa. Untuk menambah admin lain, jalankan perintah yang sama lagi dengan nama pengguna berbeda. Untuk memperbarui email akun admin yang sudah ada, jalankan kembali perintah tersebut dan masukkan nama pengguna yang sama; kata sandi tidak berubah. Buka `http://localhost:3000/admin.html` setelah server berjalan dan database terhubung.

`MONGODB_URI` tetap diperlukan agar server dapat terhubung ke Atlas. Kredensial pada URI itu adalah kredensial pengguna database MongoDB, bukan username dan kata sandi untuk masuk ke dashboard.

Dashboard dapat membuat, mengubah, dan menghapus berita. Formulir Beranda mengelola logo situs, slide hero, video YouTube, dan kutipan; bagian video tampil jika tautan video YouTube yang valid diisi. Formulir Undang-Undang mengelola daftar naskah, tautan dokumen, daftar legislasi, status, riwayat perubahan, dan tahapan; formulir Pengarsipan mengelola arsip undang-undang dan kegiatan beserta label, tanggal/tahun, format, tautan, dan gambar; formulir Kegiatan mengelola dokumen anggaran, tabel ringkasan, laporan pengawasan, serta galeri foto; formulir Struktur mengelola profil foto, nama, dan jabatan. Status daftar UU diberi warna merah untuk Perencanaan, kuning untuk Dalam pembahasan, dan hijau untuk Disahkan. Status riwayat perubahan diberi warna merah untuk Diajukan, kuning untuk Dalam proses, dan hijau untuk Disahkan. Perubahan konten langsung disimpan ke MongoDB dan ditampilkan di situs publik.

Sesi admin disimpan di MongoDB, berlaku selama 8 jam, memakai cookie `HttpOnly`/`SameSite=Strict`, pemeriksaan origin, dan token CSRF. Percobaan login dibatasi. Kiriman aspirasi tidak tersedia di dashboard maupun endpoint admin. Jangan menaruh kredensial di browser atau repositori.

## Data konten

Berita tersimpan di koleksi `news`, sedangkan konten halaman dipisahkan ke lima koleksi: `homepage_content`, `legislation_content`, `archives_content`, `activities_content`, dan `organization_content`. Setiap koleksi memakai satu dokumen dengan `key: "main"` dan data halaman di dalam field `content`. Endpoint publik hanya dapat membaca konten dan berita; endpoint tulis memerlukan sesi admin.

File contoh berisi data ilustratif. Ganti atau hapus semua data contoh sebelum menampilkannya sebagai informasi resmi. Untuk pengelolaan langsung melalui Atlas, dokumen koleksi halaman berbentuk `{ "key": "main", "content": { ... } }`. Backend tetap menggunakan `site_content` sebagai fallback untuk bagian yang belum dipindahkan.

1. Pastikan pengguna aplikasi di **Atlas → Database Access** memiliki role `readWrite` pada database `dpm_km_unnes`; aplikasi memerlukan izin ini untuk berita, konten, dan kiriman aspirasi. Jangan pernah menaruh kredensial database di browser atau konten publik.
2. Jika perlu memindahkan konten, buka [site-content.example.json](./site-content.example.json), lalu salin struktur dokumen di bawah nama koleksi ke Atlas. Setiap dokumen berbentuk `{ "key": "main", "content": { ... } }`.
3. Edit dokumen yang ada langsung di Atlas. Hindari membuat dokumen `key: "main"` duplikat pada koleksi yang sama, dan jangan menyalin data contoh untuk menimpa konten resmi.
4. Untuk memindahkan data dari koleksi lama `site_content`, salin field `homepage`, `legislation`, `archives`, `activities`, dan `organization` ke field `content` pada koleksi baru yang sesuai. Backend tetap menggunakan data lama sebagai fallback untuk bagian yang belum dipindahkan.
5. Daftar RUU berada di `legislation_content.content.bills`; tautkan `documentId` ke `id` yang sama pada `legislation_content.content.documents`. Arsip berada di `archives_content.content.items`, dengan kategori `laws` atau `activities`. Anggaran, laporan, dan galeri berada di `activities_content.content.budget`, `.oversight`, dan `.gallery`. Profil pengurus berada di `organization_content.content.profiles`; setiap profil perlu memiliki `name`, `position`, dan `photo`, sedangkan `photoAlt` bersifat opsional. Hanya profil lengkap yang menampilkan foto, nama, dan jabatan.
6. Untuk gambar, gunakan URL HTTPS yang dapat diakses publik atau URL media GridFS yang sudah tersimpan (`/api/media/<id>`). Dashboard tidak menyediakan unggah berkas.

Dokumen yang disediakan: **Undang-Undang Keluarga Mahasiswa Universitas Negeri Semarang Nomor 6 Tahun 2025 tentang Pemilihan Umum Raya Keluarga Mahasiswa Universitas Negeri Semarang**. Berkas TXT tersedia di [`UU No. 6 Tahun 2025 tentang PEMIRA KM UNNES.txt`](./UU%20No.%206%20Tahun%202025%20tentang%20PEMIRA%20KM%20UNNES.txt). Untuk memublikasikannya, gunakan struktur berikut pada field `content` dokumen `legislation_content`:

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
        "note": "Baca naskah lengkap pada halaman ini atau unduh dokumen resmi.",
        "downloadUrl": "UU%20No.%206%20Tahun%202025%20tentang%20PEMIRA%20KM%20UNNES.txt",
        "previewUrl": "UU%20No.%206%20Tahun%202025%20tentang%20PEMIRA%20KM%20UNNES.txt",
        "sections": [],
        "chapters": []
      }
    ]
  }
}
```

`documentId` pada daftar harus sama persis dengan `id` naskah. Klik item UU di halaman Undang-Undang untuk menampilkan naskahnya. `previewUrl` (atau field lama `textUrl`) digunakan untuk membaca file TXT yang tersedia pada situs; `downloadUrl` mengatur file yang diunduh dan dapat menunjuk ke TXT atau PDF yang benar-benar tersedia. Halaman membentuk navigasi BAB dengan membaca file TXT. Jika dokumen berisi `sections` alih-alih file TXT, navigasi dibuat dari bagian tersebut. Untuk database lama, backend tetap membaca `textUrl` sebagai fallback. Data contoh yang ditandai sebagai ilustrasi atau `sample` tidak ditampilkan sebagai informasi resmi.

Gunakan URL HTTPS untuk gambar dan dokumen eksternal. Tautan relatif hanya untuk file yang memang tersedia di situs. Semua konten pada koleksi-koleksi halaman dan arsip bersifat publik melalui API; jangan simpan aspirasi, data pribadi, atau rahasia di dalamnya.

## Aspirasi mahasiswa

Formulir beranda mengirim data ke `POST /api/aspirations`. Kiriman disimpan di koleksi `aspirations` dan tidak ditampilkan kepada publik. Setelah tersimpan, sistem mengirim email konfirmasi berisi ucapan terima kasih dan rincian aspirasi kepada pengirim, serta email pemberitahuan dengan rincian yang sama ke setiap akun admin aktif di koleksi `users` yang memiliki alamat `email` valid. Fitur ini memerlukan konfigurasi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, dan `SMTP_PASS`, serta setidaknya satu email admin. `SMTP_FROM` bersifat opsional dan memakai `SMTP_USER` jika kosong. Jika prasyarat belum siap, aspirasi tidak disimpan dan formulir menampilkan pesan; jika pengiriman email gagal setelah tersimpan, formulir memberi peringatan agar pengirim tidak mengirim ulang. Waktu tunggu DNS dan koneksi SMTP dibatasi agar formulir tidak menggantung tanpa batas. Untuk Gmail, gunakan `smtp.gmail.com` dan App Password, bukan kata sandi akun. Endpoint memvalidasi isi dan membatasi kiriman hingga 10 per alamat IP per jam. Batasi akses koleksi ini kepada staf yang berwenang melalui Atlas.

Jika formulir menyatakan aspirasi tersimpan tetapi email gagal, jangan kirim ulang. Periksa Railway deployment logs untuk `Email aspirasi tidak terkirim seluruhnya`: `senderSent` menunjukkan status email pengirim, sedangkan `adminsSent` dan `adminsTotal` menunjukkan status email admin. Versi server terbaru juga mencatat kode SMTP, perintah, dan respons provider yang telah dipersingkat serta disamarkan; rincian ini hanya ada di log server, bukan respons publik.

## Deploy ke Railway

1. Unggah proyek ke repositori GitHub dan hubungkan repositori melalui **Railway → New Project → Deploy from GitHub repo**. Railway memakai `railway.json` untuk menjalankan `npm start` dan memeriksa `/api/health`.
2. Pada service Railway, buka **Variables** dan tambahkan `MONGODB_URI` berisi connection string dari Atlas serta `MONGODB_DB` dengan nilai `dpm_km_unnes`. Untuk email, tambahkan `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM`. `SMTP_FROM` bersifat opsional dan jika kosong memakai `SMTP_USER`. Kredensial dashboard dikelola di koleksi `users`, bukan di environment variables.
3. Di Atlas, atur **Security → Network Access** agar mengizinkan koneksi keluar Railway. Gunakan static outbound IP jika tersedia untuk project/plan Anda dan izinkan hanya IP tersebut. Hindari `0.0.0.0/0`; jika Railway tidak menyediakan egress IP yang stabil, periksa opsi egress/IP statis yang tersedia sebelum memperluas akses Atlas.
4. Buat akun admin dengan menjalankan `npm run create-admin` secara lokal menggunakan `MONGODB_URI` yang sama, setelah akses Atlas untuk mesin tersebut diizinkan. Deploy service, buka domain yang dibuat Railway, lalu periksa `/api/health`. Respons sukses menunjukkan `"database":"connected"`.

Pastikan kredensial Atlas tidak pernah dimasukkan ke file yang di-commit. Jika connection string atau password pernah terlihat di tangkapan layar atau tersimpan di repositori, rotasi password database Atlas dan perbarui `MONGODB_URI` di Railway.

URL dashboard Atlas bukan connection string database maupun alamat hosting API. Ambil connection string driver dari **Connect → Drivers** di Atlas.
