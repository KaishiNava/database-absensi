import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { authenticate, jakartaDate } from '@/lib/server/auth';

export const runtime = 'nodejs';
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.value.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat melihat sesi absensi.' }, { status: 403 });
  const { data, error } = await auth.value.adminClient.from('attendance_sessions')
    .select('id,title,class_name,attendance_date,starts_at,expires_at,status,created_at')
    .order('created_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: 'Gagal mengambil sesi: ' + error.message }, { status: 500 });
  return NextResponse.json({ sessions: data || [] });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.value.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat membuat QR absensi.' }, { status: 403 });
  let body: { title?: string; className?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Data permintaan tidak valid.' }, { status: 400 }); }
  const title = String(body.title || 'Absensi Harian').trim().slice(0, 100);
  const className = String(body.className || '').trim().slice(0, 40) || null;
  if (!title) return NextResponse.json({ error: 'Nama sesi wajib diisi.' }, { status: 400 });
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  const { data, error } = await auth.value.adminClient.from('attendance_sessions').insert({
    created_by: auth.value.user.id, title, class_name: className, attendance_date: jakartaDate(now),
    starts_at: now.toISOString(), expires_at: expires.toISOString(), token_hash: hashToken(token), status: 'active'
  }).select('id,title,class_name,attendance_date,starts_at,expires_at,status').single();
  if (error || !data) return NextResponse.json({ error: 'Gagal membuat sesi QR: ' + (error?.message || 'data tidak tersedia') }, { status: 500 });
  return NextResponse.json({ session: data, token }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.value.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat menutup sesi.' }, { status: 403 });
  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Data permintaan tidak valid.' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'ID sesi wajib diisi.' }, { status: 400 });
  const { error } = await auth.value.adminClient.from('attendance_sessions').update({ status: 'closed' }).eq('id', body.id).eq('status', 'active');
  if (error) return NextResponse.json({ error: 'Gagal menutup sesi: ' + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
