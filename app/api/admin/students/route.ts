import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Server belum dikonfigurasi. Tambahkan SUPABASE_SERVICE_ROLE_KEY di Vercel Environment Variables (tanpa NEXT_PUBLIC_) lalu redeploy.' }, { status: 500 });
  }
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Sesi login tidak ditemukan.' }, { status: 401 });

  const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await publicClient.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: 'Sesi tidak valid. Silakan login ulang.' }, { status: 401 });

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actor, error: actorError } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (actorError || actor?.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang boleh membuat akun siswa.' }, { status: 403 });

  let body: { name?: string; email?: string; password?: string; className?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 }); }
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const className = String(body.className || '').trim();
  if (!name || !email || password.length < 8 || !className) return NextResponse.json({ error: 'Nama, email, kelas, dan password minimal 8 karakter wajib diisi.' }, { status: 400 });

  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Akun gagal dibuat.' }, { status: 400 });

  // Trigger creates the default student profile. Update only through the server service client.
  const { error: profileError } = await adminClient.from('profiles').upsert({
    id: data.user.id, full_name: name, role: 'student', class_name: className, is_verified: false
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: 'Akun dibuat tetapi profil gagal disimpan: ' + profileError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.user.id, email: data.user.email });
}
