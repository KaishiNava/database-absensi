import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.value.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat melihat laporan absensi.' }, { status: 403 });
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  let query = auth.value.adminClient.from('attendance_records').select('id,student_id,session_id,attendance_date,checked_in_at,status').order('checked_in_at', { ascending: false }).limit(500);
  if (date) query = query.eq('attendance_date', date);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Gagal mengambil laporan: ' + error.message }, { status: 500 });
  const rows = data || [];
  const profileIds = [...new Set(rows.map(r => r.student_id))];
  const sessionIds = [...new Set(rows.map(r => r.session_id))];
  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    profileIds.length ? auth.value.adminClient.from('profiles').select('id,full_name,class_name').in('id', profileIds) : Promise.resolve({ data: [] as {id:string;full_name:string|null;class_name:string|null}[] }),
    sessionIds.length ? auth.value.adminClient.from('attendance_sessions').select('id,title,class_name').in('id', sessionIds) : Promise.resolve({ data: [] as {id:string;title:string;class_name:string|null}[] })
  ]);
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));
  return NextResponse.json({ records: rows.map(r => ({ ...r, profiles: profileMap.get(r.student_id) || null, attendance_sessions: sessionMap.get(r.session_id) || null })) });
}
