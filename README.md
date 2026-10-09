# HADIR! — Prototipe Absensi Neo-Brutalism

Starter Next.js + TypeScript + Supabase untuk sistem absensi siswa. Termasuk landing page, login email/password, dashboard, profil, halaman admin dengan badge verified, dan skema awal database/RLS.

## Persiapan lokal

1. Install Node.js 20+.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari Supabase Project Settings → API.
5. Buka Supabase → SQL Editor, jalankan isi `supabase/schema.sql`.
6. Jalankan juga isi `supabase/attendance.sql` untuk membuat tabel sesi QR dan catatan absensi.
6. Di Supabase Auth, buat akun pengguna. Profil akan dibuat otomatis oleh trigger.
7. Untuk menjadikan akun sebagai admin, salin UUID akun dari Authentication → Users lalu jalankan query `UPDATE` yang dikomentari di akhir schema.sql dengan UUID tersebut.
8. Isi `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` untuk API server (jangan pernah commit file env).
9. Jalankan `npm run dev`.

## Deploy GitHub + Vercel

Push folder ini ke repository GitHub, import repository di Vercel, lalu tambahkan kedua environment variable yang sama di Project Settings → Environment Variables. Redeploy setelah menambahkan env.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: URL project Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key Supabase. Aman dipakai di browser dengan RLS yang benar.
- Jangan pernah menaruh `service_role` key di variabel `NEXT_PUBLIC_*` atau di frontend.

## Status prototipe

Sudah ada UI responsif, login Supabase, dashboard/profil yang membaca data profil, pemeriksaan role untuk tampilan admin, dan SQL awal dengan RLS. Ini belum merupakan sistem absensi produksi: pendaftaran publik belum disediakan, pengelolaan siswa belum ada, dan generator QR/scanner, token QR kedaluwarsa satu jam, pencatatan absensi serta laporan CSV belum diimplementasikan. Jangan gunakan sebagai absensi resmi sebelum fitur tersebut dan pengujian keamanan selesai.

## Catatan keamanan

Badge biru hanya tampilan UI berdasarkan `profiles.is_verified`; akses admin harus selalu divalidasi di database/API dengan RLS atau fungsi server. Jangan percaya role yang dikirim dari browser. Untuk admin sungguhan, buat akun melalui Auth lalu naikkan role lewat SQL Editor pemilik proyek.

## Update: admin debugging and create-student endpoint

- `/admin` now shows the currently authenticated UUID, Supabase project host, and role returned by the live `profiles` query if access is denied. Compare the project host to the Supabase project URL where you ran SQL. If the role still says `student`, the deployed website is reading a different project/profile or the SQL update targeted another UUID.
- Admin student creation uses `POST /api/admin/students`. Configure `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** Vercel environment variable (never `NEXT_PUBLIC_`, never commit the real key), then redeploy. The API verifies the caller's Supabase session and checks the role in the database before creating a student.
- The schema gives admins read access to profiles via `public.is_admin()` and retains student self-read. Review policies before production use.
- QR generation/scanning, expiry, attendance records, and reports are still not implemented in this package.

## API absensi

- `POST /api/attendance/sessions` — admin membuat QR, default durasi 1 jam.
- `GET /api/attendance/sessions` — admin melihat daftar sesi.
- `PATCH /api/attendance/sessions` — admin menutup sesi.
- `POST /api/attendance/checkin` — siswa memvalidasi token dan mencatat kehadiran.
- `GET /api/attendance/history` — riwayat akun yang sedang login.
- `GET /api/attendance/report?date=YYYY-MM-DD` — laporan admin.

Semua endpoint memvalidasi bearer access token dan membaca role dari tabel `profiles`; kunci service role hanya digunakan server-side.
