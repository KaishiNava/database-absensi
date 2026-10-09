import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function getAuth(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return { error: 'Server belum dikonfigurasi. Periksa environment variables Supabase di Vercel.', status: 500 as const };
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { error: 'Sesi login tidak ditemukan.', status: 401 as const };
  const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await publicClient.auth.getUser(token);
  if (error || !user) return { error: 'Sesi tidak valid. Silakan login ulang.', status: 401 as const };
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return { error: 'Hanya admin yang boleh mengelola akun siswa.', status: 403 as const };
  return { user, adminClient };
}

export async function GET(request: Request) {
  const auth = await getAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.adminClient.from('profiles')
    .select('id,full_name,role,class_name,is_verified,created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Gagal memuat daftar akun: ' + error.message }, { status: 500 });
  return NextResponse.json({ students: data || [] });
}

export async function POST(request: Request) {
  const auth = await getAuth(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: { name?: string; email?: string; password?: string; className?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 }); }
  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const className = String(body.className || '').trim().slice(0, 40);
  if (!name || !email || password.length < 8 || !className) return NextResponse.json({ error: 'Nama, email, kelas, dan password minimal 8 karakter wajib diisi.' }, { status: 400 });
  const { data, error } = await auth.adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Akun gagal dibuat.' }, { status: 400 });
  const { error: profileError } = await auth.adminClient.from('profiles').upsert({ id: data.user.id, full_name: name, role: 'student', class_name: className, is_verified: false });
  if (profileError) {
    await auth.adminClient.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: 'Akun dibuat tetapi profil gagal disimpan: ' + profileError.message }, { status: 500 });
  }
  const { data: profile, error: readError } = await auth.adminClient.from('profiles').select('id,full_name,role,class_name,is_verified,created_at').eq('id', data.user.id).single();
  if (readError) return NextResponse.json({ error: 'Akun dibuat, tetapi profil tidak dapat dibaca: ' + readError.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.user.id, email: data.user.email, student: profile }, { status: 201 });
}
