'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Scanner = { start: (camera: string | MediaTrackConstraints, config: object, success: (decodedText: string) => void, failure?: (error: string) => void) => Promise<void>; stop: () => Promise<void>; clear: () => void };
export default function ScanAttendancePage() {
  const router = useRouter();
  const scannerRef = useRef<Scanner | null>(null);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('Login diperlukan untuk melakukan absensi.');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [success, setSuccess] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => { (async () => { if (!supabase) { setStatus('Supabase belum dikonfigurasi.'); return; } const { data: { user } } = await supabase.auth.getUser(); if (!user) router.replace('/login'); else setStatus('Arahkan kamera ke QR absensi dari admin.'); })(); return () => { void scannerRef.current?.stop().catch(() => undefined); }; }, [router]);

  async function submitToken(rawToken: string) {
    if (!supabase || busy || scannedRef.current) return;
    const clean = rawToken.trim();
    if (!clean) { setStatus('Token QR belum diisi.'); return; }
    setBusy(true); setStatus('Memvalidasi QR dan mencatat kehadiran...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/attendance/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ token: clean }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Absensi gagal.');
      scannedRef.current = true; setSuccess(true); setStatus(`Berhasil! Absensi “${result.sessionTitle}” tercatat pada ${new Date(result.record.checked_in_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}.`);
      await stopCamera();
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  }
  async function startCamera() {
    setStatus('Meminta izin kamera...');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader') as unknown as Scanner;
      scannerRef.current = scanner;
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 }, (decoded) => { if (!scannedRef.current) { void submitToken(decoded); } }, () => undefined);
      setCameraOn(true); setStatus('Kamera aktif. Posisikan QR di dalam kotak.');
    } catch (e) { setStatus('Kamera tidak dapat dibuka. Pastikan situs memakai HTTPS dan izin kamera diberikan. Kamu tetap bisa memasukkan token QR secara manual.'); }
  }
  async function stopCamera() { if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch { /* camera already stopped */ } scannerRef.current = null; } setCameraOn(false); }
  function reset() { scannedRef.current = false; setSuccess(false); setToken(''); setStatus('Arahkan kamera ke QR absensi dari admin.'); }

  return <main className="app-shell shell"><header className="app-nav"><Link href="/" className="brand">HADIR<span>!</span></Link><Link href="/dashboard" className="button button-small button-light"><ArrowLeft size={16}/> Dashboard</Link></header><div className="dashboard-head"><div><div className="eyebrow"><span className="dot"/> ABSENSI SISWA</div><h1>SCAN & HADIR.</h1><p>Scan QR aktif dari admin. Setiap siswa hanya bisa absen sekali per sesi.</p></div></div><section className="scanner-card"><div className="scanner-title"><ScanLine size={24}/><h2>PEMINDAI QR</h2></div><div id="qr-reader" className="qr-reader"/><div className="panel-actions"><button className="button" disabled={cameraOn||success} onClick={()=>void startCamera()}><Camera size={18}/> {cameraOn?'Kamera aktif':'Buka kamera'}</button>{cameraOn&&<button className="button button-light" onClick={()=>void stopCamera()}>Matikan kamera</button>}</div><div className={success?'notice notice-success':'notice'}>{success&&<CheckCircle2 size={18}/>} {status}</div>{!success&&<form className="form" onSubmit={e=>{e.preventDefault();void submitToken(token);}}><label>Atau masukkan token QR<input value={token} onChange={e=>setToken(e.target.value)} placeholder="Tempel token QR di sini" autoComplete="off"/></label><button className="button" disabled={busy}>{busy?'Memproses...':'Kirim absensi'} <ScanLine size={17}/></button></form>}{success&&<button className="button" onClick={reset}><RefreshCw size={16}/> Scan sesi lain</button>}</section><p className="muted">Tips: izinkan akses kamera pada browser. QR hanya berlaku di tanggal pembuatannya dan selama satu jam sejak dibuat.</p></main>;
}
