import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  full_name: string | null;
  role: 'student' | 'admin' | string;
  class_name: string | null;
  is_verified: boolean;
};

export async function loadMyProfile(userId: string) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  // Fetch from the currently authenticated Supabase project; do not trust metadata.
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,role,class_name,is_verified')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(`Profil tidak ditemukan untuk akun ${userId}. Pastikan trigger profiles aktif dan website memakai project Supabase yang sama.`);
  }
  return data as UserProfile;
}
