import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const requestedId = url.searchParams.get('studentId');
  if (requestedId && requestedId !== auth.value.user.id && auth.value.role !== 'admin') return NextResponse.json({ error: 'Tidak punya akses ke riwayat pengguna lain.' }, { status: 403 });
  const studentId = auth.value.role === 'admin' && requestedId ? requestedId : auth.value.user.id;
  const { data, error } = await auth.value.adminClient.from('attendance_records').select('id,student_id,session_id,attendance_date,checked_in_at,status').eq('student_id', studentId).order('checked_in_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Gagal mengambil riwayat: ' + error.message }, { status: 500 });
  const rows = data || [];
  const sessionIds = [...new Set(rows.map(r => r.session_id))];
  const { data: sessions } = sessionIds.length ? await auth.value.adminClient.from('attendance_sessions').select('id,title,class_name').in('id', sessionIds) : { data: [] as {id:string;title:string;class_name:string|null}[] };
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  return NextResponse.json({ records: rows.map(r => ({ ...r, attendance_sessions: sessionMap.get(r.session_id) || null })) });
}
