'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Users, UserPlus, RefreshCw, LogOut, QrCode, XCircle, Download, ClipboardList, CalendarDays } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { loadMyProfile, type UserProfile } from '@/lib/profile';

type Student = { id: string; full_name: string | null; role: string; class_name: string | null; is_verified: boolean };
type AttendanceSession = { id:string; title:string; class_name:string|null; attendance_date:string; starts_at:string; expires_at:string; status:string; created_at:string };
type AttendanceRecord = { id:string; student_id:string; session_id:string; attendance_date:string; checked_in_at:string; status:string; profiles?:{full_name:string|null;class_name:string|null}|null; attendance_sessions?:{title:string;class_name:string|null}|null };
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
  const [sessionTitle,setSessionTitle]=useState('Absensi Harian');
  const [sessionClass,setSessionClass]=useState('');
  const [sessions,setSessions]=useState<AttendanceSession[]>([]);
  const [records,setRecords]=useState<AttendanceRecord[]>([]);
  const [qrData,setQrData]=useState<{session:AttendanceSession;dataUrl:string}|null>(null);
  const [reportDate,setReportDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  const [attendanceBusy,setAttendanceBusy]=useState(false);
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
      try {
        const [sessionResult, reportResult] = await Promise.all([
          attendanceRequest('/api/attendance/sessions'),
          attendanceRequest('/api/attendance/report')
        ]);
        setSessions((sessionResult.sessions || []) as AttendanceSession[]);
        setRecords((reportResult.records || []) as AttendanceRecord[]);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : 'Laporan absensi belum dapat dimuat. Jalankan supabase/attendance.sql terlebih dahulu.');
      }
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
  async function attendanceRequest(path:string, method='GET', body?:unknown){
    const {data:{session}}=await supabase!.auth.getSession();
    const response=await fetch(path,{method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token||''}`},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json(); if(!response.ok) throw new Error(result.error||'Permintaan absensi gagal.'); return result;
  }
  async function createQr(e:React.FormEvent){
    e.preventDefault();setAttendanceBusy(true);setNotice('');
    try{const result=await attendanceRequest('/api/attendance/sessions','POST',{title:sessionTitle,className:sessionClass});const dataUrl=await QRCode.toDataURL(result.token,{width:320,margin:2,errorCorrectionLevel:'H'});setQrData({session:result.session,dataUrl});setNotice('QR berhasil dibuat. Simpan atau tampilkan QR ini kepada siswa; token hanya diberikan saat pembuatan.');await checkAccess();}
    catch(e){setNotice(e instanceof Error?e.message:'Gagal membuat QR.');}finally{setAttendanceBusy(false);}
  }
  async function closeSession(id:string){setAttendanceBusy(true);try{await attendanceRequest('/api/attendance/sessions','PATCH',{id});setNotice('Sesi absensi berhasil ditutup.');await checkAccess();if(qrData?.session.id===id)setQrData(null);}catch(e){setNotice(e instanceof Error?e.message:'Gagal menutup sesi.');}finally{setAttendanceBusy(false);}}
  function exportCsv(){const rows=records.filter(r=>!reportDate||r.attendance_date===reportDate);const quote=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[['Tanggal','Waktu','Nama','Kelas','Sesi','Status'].map(quote).join(','),...rows.map(r=>[r.attendance_date,new Date(r.checked_in_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}),r.profiles?.full_name,r.profiles?.class_name,r.attendance_sessions?.title,r.status].map(quote).join(','))].join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`laporan-absensi-${reportDate||'semua'}.csv`;a.click();URL.revokeObjectURL(url);}
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
      <section className="attendance-admin">
        <div className="section-heading"><div><span className="panel-label">SESI KEHADIRAN</span><h2><QrCode size={24}/> Buat QR absensi</h2><p>QR berlaku satu jam sejak dibuat dan hanya pada tanggal pembuatannya.</p></div></div>
        <form className="form admin-form" onSubmit={createQr}>
          <label>Nama sesi<input value={sessionTitle} onChange={e=>setSessionTitle(e.target.value)} required maxLength={100} placeholder="Absensi Pagi"/></label>
          <label>Kelas tujuan (opsional)<select value={sessionClass} onChange={e=>setSessionClass(e.target.value)}><option value="">Semua kelas</option>{Array.from(new Set(students.map(s=>s.class_name).filter((v):v is string=>!!v))).sort().map(c=><option key={c} value={c}>{c}</option>)}</select></label>
          <button className="button" disabled={attendanceBusy}>{attendanceBusy?'Membuat QR...':'Buat QR berlaku 1 jam'} <QrCode size={17}/></button>
        </form>
        {qrData&&<div className="qr-display"><div><span className="panel-label">QR AKTIF</span><h3>{qrData.session.title}</h3><p>{qrData.session.class_name||'Semua kelas'} · berakhir {new Date(qrData.session.expires_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})} WIB</p></div><img src={qrData.dataUrl} alt="QR absensi aktif"/><button className="button button-light" onClick={()=>{const a=document.createElement('a');a.href=qrData.dataUrl;a.download=`qr-absensi-${qrData.session.attendance_date}.png`;a.click();}}><Download size={16}/> Unduh QR</button><button className="button button-light" onClick={()=>setQrData(null)}><XCircle size={16}/> Tutup tampilan</button></div>}
        <div className="student-list"><h2><CalendarDays size={22}/> Sesi absensi</h2>{sessions.length===0?<p className="muted">Belum ada sesi. Buat QR pertama di atas.</p>:sessions.map(s=>{const expired=Date.now()>=new Date(s.expires_at).getTime();const state=s.status!=='active'?'DITUTUP':expired?'KEDALUWARSA':'AKTIF';return <article key={s.id} className="student-row"><div><b>{s.title}</b><small>{s.attendance_date} · {s.class_name||'Semua kelas'} · berakhir {new Date(s.expires_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})} WIB</small></div><div className="row-actions"><span className={state==='AKTIF'?'role-admin':'role-student'}>{state}</span>{s.status==='active'&&!expired&&<button className="button button-small button-light" disabled={attendanceBusy} onClick={()=>void closeSession(s.id)}>Tutup</button>}</div></article>})}</div>
        <div className="student-list"><div className="section-heading"><h2><ClipboardList size={22}/> Laporan kehadiran</h2><button className="button button-small" onClick={exportCsv}><Download size={15}/> Ekspor CSV</button></div><label className="date-filter">Tanggal laporan<input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}/></label><div className="report-summary"><b>{records.filter(r=>!reportDate||r.attendance_date===reportDate).length}</b><span>catatan kehadiran pada tanggal terpilih</span></div>{records.filter(r=>!reportDate||r.attendance_date===reportDate).length===0?<p className="muted">Belum ada data kehadiran pada tanggal ini.</p>:records.filter(r=>!reportDate||r.attendance_date===reportDate).map(r=><article key={r.id} className="student-row"><div><b>{r.profiles?.full_name||'Siswa'}</b><small>{r.profiles?.class_name||'Kelas belum diatur'} · {r.attendance_sessions?.title||'Sesi absensi'} · {new Date(r.checked_in_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'})}</small></div><span className="role-admin">HADIR</span></article>)}</div>
      </section>
    </>}
  </main>;
}
