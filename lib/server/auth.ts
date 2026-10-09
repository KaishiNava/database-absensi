import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type ServerAuth = { user: User; adminClient: SupabaseClient; role: string; profile: { id: string; full_name: string | null; role: string; class_name: string | null; is_verified: boolean } };

export async function authenticate(request: Request): Promise<{ ok: true; value: ServerAuth } | { ok: false; status: number; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return { ok: false, status: 500, error: 'Server belum dikonfigurasi. Periksa environment variables Supabase di Vercel.' };
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Sesi login tidak ditemukan. Silakan login ulang.' };
  const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await publicClient.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Sesi tidak valid. Silakan login ulang.' };
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await adminClient.from('profiles').select('id,full_name,role,class_name,is_verified').eq('id', user.id).maybeSingle();
  if (profileError || !profile) return { ok: false, status: 403, error: 'Profil akun tidak ditemukan. Hubungi administrator.' };
  return { ok: true, value: { user, adminClient, role: profile.role, profile } };
}

export function jakartaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
