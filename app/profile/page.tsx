'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, UserRound, Save, PencilLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ProfileData = { id: string; email: string; name: string; role: string; className: string; verified: boolean };
export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [notice, setNotice] = useState('Memuat profil...');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    if (!supabase) { setNotice('Supabase belum dikonfigurasi.'); return; }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { router.replace('/login'); return; }
    const { data: p, error } = await supabase.from('profiles').select('full_name,role,class_name,is_verified').eq('id', user.id).maybeSingle();
    if (error) { setNotice('Profil gagal dimuat: ' + error.message); return; }
    const profile = { id: user.id, email: user.email || '', name: p?.full_name || '', role: p?.role || 'student', className: p?.class_name || 'Belum diatur', verified: !!p?.is_verified };
    setData(profile); setName(profile.name); setNotice('');
  }, [router]);
  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 100) { setNotice('Nama harus berisi 2–100 karakter.'); return; }
    if (!supabase) { setNotice('Supabase belum dikonfigurasi.'); return; }
    setSaving(true); setNotice('Menyimpan nama...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ fullName: clean }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Nama gagal disimpan.');
      setData(current => current ? { ...current, name: result.profile.full_name } : current);
      setName(result.profile.full_name); setEditing(false); setNotice('Nama profil berhasil diperbarui.');
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Nama gagal disimpan.'); }
    finally { setSaving(false); }
  }

  return <main className="auth-page shell"><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><section className="profile-card"><div className="profile-avatar"><UserRound size={40}/></div><div className="eyebrow">PROFIL AKUN</div>
    {!editing ? <><div className="profile-name-line"><h1>{data?.name || 'Nama belum diatur'}</h1>{data?.verified && <BadgeCheck className="verified-check-icon" size={23} aria-label="Terverifikasi" title="Terverifikasi"/>}</div><button className="button button-small button-light profile-edit-button" onClick={() => { setName(data?.name || ''); setEditing(true); setNotice(''); }}><PencilLine size={16}/> Edit nama</button></> : <form className="form profile-name-form" onSubmit={saveName}><label>Nama lengkap<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" placeholder="Masukkan nama lengkap"/></label><div className="panel-actions"><button className="button" disabled={saving}><Save size={16}/>{saving ? 'Menyimpan...' : 'Simpan nama'}</button><button type="button" className="button button-light" disabled={saving} onClick={() => { setEditing(false); setName(data?.name || ''); setNotice(''); }}>Batal</button></div></form>}
    <div className="profile-fields"><div><span>EMAIL</span><strong>{data?.email || '—'}</strong></div><div><span>PERAN</span><strong>{data?.role === 'admin' ? 'Administrator' : 'Siswa'}</strong></div><div><span>KELAS</span><strong>{data?.className || '—'}</strong></div><div><span>ID AKUN</span><strong className="id-text">{data?.id || '—'}</strong></div></div>
    {notice && <div className="notice">{notice}</div>}<p className="muted">Kamu bisa mengubah nama profil saja. Email, peran, kelas, dan status verifikasi tidak bisa diubah dari halaman ini.</p></section></main>;
}
