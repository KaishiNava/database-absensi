'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ShieldCheck, Users, UserPlus, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadMyProfile, type UserProfile } from '@/lib/profile';

type Student = { id: string; full_name: string | null; role: string; class_name: string | null; is_verified: boolean };
export default function AdminPage() {
  const [status,setStatus]=useState('Memeriksa sesi dan role...');
  const [isAdmin,setIsAdmin]=useState(false);
  const [profile,setProfile]=useState<UserProfile|null>(null);
  const [userId,setUserId]=useState('');
  const [students,setStudents]=useState<Student[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [className,setClassName]=useState('');
  const router=useRouter();
  const projectHost = (() => { try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : 'ENV URL BELUM DIISI'; } catch { return 'URL SUPABASE TIDAK VALID'; } })();

  const checkAccess = useCallback(async () => {
    setStatus('Memeriksa sesi dan role...'); setNotice('');
    if(!supabase){setStatus('Supabase belum dikonfigurasi. Periksa environment variables Vercel.');return;}
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError){setStatus('Gagal membaca sesi: '+authError.message);return;}
    if(!user){router.replace('/login');return;}
    setUserId(user.id);
    try {
      const p=await loadMyProfile(user.id);
      setProfile(p);
      if(p.role!=='admin'){setIsAdmin(false);setStatus(`Akses ditolak: database yang dipakai website membaca role "${p.role}".`);return;}
      setIsAdmin(true);setStatus('');
      const {data,error}=await supabase.from('profiles').select('id,full_name,role,class_name,is_verified').order('created_at',{ascending:false});
      if(error) setNotice('Role admin terbaca, tetapi daftar profil belum bisa dimuat. Periksa RLS: '+error.message);
      else setStudents((data||[]) as Student[]);
    } catch(e) {
      setIsAdmin(false);setStatus(e instanceof Error?e.message:'Gagal membaca profil.');
    }
  },[router]);
  useEffect(()=>{void checkAccess();},[checkAccess]);

  async function createStudent(e:React.FormEvent){
    e.preventDefault();setBusy(true);setNotice('');
    try {
      const {data:{session}}=await supabase!.auth.getSession();
      const response=await fetch('/api/admin/students',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token||''}`},body:JSON.stringify({name,email,password,className})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||'Gagal membuat akun siswa.');
      setNotice(`Akun siswa berhasil dibuat: ${result.email}. Simpan password awal dengan aman dan berikan langsung kepada siswa.`);
      setName('');setEmail('');setPassword('');setClassName('');
      await checkAccess();
    } catch(e){setNotice(e instanceof Error?e.message:'Terjadi kesalahan.');}
    finally{setBusy(false);}
  }
  async function logout(){await supabase?.auth.signOut();router.replace('/login');}
  return <main className="app-shell shell">
    <header className="app-nav"><Link href="/" className="brand">HADIR<span>!</span></Link><button className="button button-small button-light" onClick={logout}><LogOut size={16}/> Keluar</button></header>
    <Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link>
    <div className="dashboard-head"><div><div className="eyebrow"><span className="dot"/> ADMIN SPACE</div><h1>PANEL ADMIN.</h1><p>Kelola akun dan kehadiran sekolah dari satu tempat.</p></div>{profile?.is_verified&&<span className="verified"><BadgeCheck size={18} fill="currentColor"/> VERIFIED</span>}</div>
    {status&&<div className="notice">{status}<div className="diagnostic"><b>ID akun:</b> {userId||'—'}<br/><b>Project Supabase dari website:</b> {projectHost}<br/><b>Role terbaca:</b> {profile?.role||'belum terbaca'}<br/><b>Verified:</b> {String(profile?.is_verified??false)}<br/><button className="button button-small" onClick={()=>void checkAccess()}><RefreshCw size={14}/> Periksa ulang</button></div><p className="muted">Jika ID akun sama dengan ID yang kamu update di SQL tetapi role tetap student, website kemungkinan memakai project Supabase berbeda atau environment variable Vercel belum diperbarui. Cocokkan project host di atas dengan URL project di Supabase.</p></div>}
    {notice&&<div className="notice">{notice}</div>}
    {isAdmin&&<>
      <section className="stats-grid"><article className="stat-card"><span>TOTAL AKUN</span><strong>{students.length}</strong><small>Profil yang bisa dibaca admin</small></article><article className="stat-card"><span>AKUN SISWA</span><strong>{students.filter(s=>s.role==='student').length}</strong><small>Termasuk kelas yang sudah diatur</small></article><article className="stat-card"><span>ADMIN VERIFIED</span><strong>{students.filter(s=>s.role==='admin'&&s.is_verified).length}</strong><small>Administrator terverifikasi</small></article></section>
      <section className="welcome-panel admin-panel"><div><span className="panel-label">BUAT AKUN BARU</span><h2><UserPlus size={24}/> Tambah siswa</h2><p>Akun dibuat melalui endpoint server yang memerlukan service role hanya di server.</p></div><div className="big-icon"><Users size={48}/></div></section>
      <form className="form admin-form" onSubmit={createStudent}>
        <label>Nama lengkap<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></label>
        <label>Email login<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="off"/></label>
        <label>Password awal (minimal 8 karakter)<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label>
        <label>Kelas<input value={className} onChange={e=>setClassName(e.target.value)} required maxLength={40} placeholder="X RPL 1"/></label>
        <button className="button" disabled={busy}>{busy?'Membuat akun...':'Buat akun siswa'} <UserPlus size={17}/></button>
      </form>
      <section className="student-list"><h2><Users size={22}/> Daftar akun</h2>{students.map(s=><article key={s.id} className="student-row"><div><b>{s.full_name||'Tanpa nama'}</b><small>{s.class_name||'Kelas belum diatur'} · {s.id}</small></div><span className={s.role==='admin'?'role-admin':'role-student'}>{s.role==='admin'?'ADMIN':'SISWA'}{s.is_verified?' ✓':''}</span></article>)}</section>
      <div className="notice">QR absensi dan rekap belum aktif pada build ini. Setelah konfigurasi server dan skema SQL diperbarui, fitur QR bisa diaktifkan.</div>
    </>}
  </main>;
}
