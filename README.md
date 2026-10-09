# HADIR! — Prototipe Absensi Neo-Brutalism

Starter Next.js + TypeScript + Supabase untuk sistem absensi siswa. Termasuk landing page, login email/password, dashboard, profil, halaman admin dengan badge verified, dan skema awal database/RLS.

## Persiapan lokal

1. Install Node.js 20+.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari Supabase Project Settings → API.
5. Buka Supabase → SQL Editor, jalankan isi `supabase/schema.sql`.
6. Di Supabase Auth, buat akun pengguna. Profil akan dibuat otomatis oleh trigger.
7. Untuk menjadikan akun sebagai admin, salin UUID akun dari Authentication → Users lalu jalankan query `UPDATE` yang dikomentari di akhir schema.sql dengan UUID tersebut.
8. Jalankan `npm run dev`.

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
