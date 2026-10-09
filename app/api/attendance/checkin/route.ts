import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { authenticate, jakartaDate } from '@/lib/server/auth';
export const runtime = 'nodejs';
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.value.role !== 'student') return NextResponse.json({ error: 'Hanya akun siswa yang dapat melakukan absensi.' }, { status: 403 });
  let body: { token?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'QR tidak terbaca.' }, { status: 400 }); }
  const token = String(body.token || '').trim();
  if (token.length < 20 || token.length > 300) return NextResponse.json({ error: 'Token QR tidak valid.' }, { status: 400 });
  const { data: session, error } = await auth.value.adminClient.from('attendance_sessions').select('id,title,class_name,attendance_date,starts_at,expires_at,status,token_hash').eq('token_hash', hashToken(token)).maybeSingle();
  if (error) return NextResponse.json({ error: 'Gagal memvalidasi QR: ' + error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: 'QR tidak dikenal atau sudah tidak berlaku.' }, { status: 404 });
  const now = new Date();
  if (session.status !== 'active') return NextResponse.json({ error: 'Sesi absensi ini sudah ditutup admin.' }, { status: 410 });
  if (session.attendance_date !== jakartaDate(now)) return NextResponse.json({ error: 'QR hanya berlaku pada tanggal pembuatannya.' }, { status: 410 });
  if (now < new Date(session.starts_at) || now >= new Date(session.expires_at)) return NextResponse.json({ error: 'QR sudah kedaluwarsa. Minta admin membuat QR baru.' }, { status: 410 });
  if (session.class_name && session.class_name !== auth.value.profile.class_name) return NextResponse.json({ error: `QR ini hanya untuk kelas ${session.class_name}.` }, { status: 403 });
  const { data: existing } = await auth.value.adminClient.from('attendance_records').select('id,checked_in_at').eq('session_id', session.id).eq('student_id', auth.value.user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Kamu sudah melakukan absensi pada sesi ini.', alreadyCheckedIn: true, checkedInAt: existing.checked_in_at }, { status: 409 });
  const { data: record, error: insertError } = await auth.value.adminClient.from('attendance_records').insert({ session_id: session.id, student_id: auth.value.user.id, attendance_date: session.attendance_date, checked_in_at: now.toISOString(), status: 'present' }).select('id,checked_in_at,status').single();
  if (insertError) {
    if (insertError.code === '23505') return NextResponse.json({ error: 'Kamu sudah melakukan absensi pada sesi ini.' }, { status: 409 });
    return NextResponse.json({ error: 'Absensi gagal disimpan: ' + insertError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sessionTitle: session.title, record });
}
