import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: { fullName?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 }); }
  const fullName = String(body.fullName || '').trim();
  if (fullName.length < 2 || fullName.length > 100) return NextResponse.json({ error: 'Nama harus berisi 2–100 karakter.' }, { status: 400 });
  const { data, error } = await auth.value.adminClient.from('profiles').update({ full_name: fullName }).eq('id', auth.value.user.id).select('id,full_name,role,class_name,is_verified').single();
  if (error || !data) return NextResponse.json({ error: 'Nama gagal disimpan: ' + (error?.message || 'profil tidak ditemukan') }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
