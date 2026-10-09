'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type CameraInfo = { id: string; label: string };
type Scanner = {
  start: (camera: string | MediaTrackConstraints, config: object, success: (decodedText: string) => void, failure?: (error: string) => void) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  getCameras: () => Promise<CameraInfo[]>;
};
function cameraErrorMessage(error: unknown) {
  const e = error as { name?: string; message?: string };
  switch (e?.name) {
    case 'NotAllowedError': case 'PermissionDeniedError': return 'Browser menolak akses kamera. Buka ikon pengaturan situs di address bar, izinkan Kamera, lalu muat ulang halaman.';
    case 'NotFoundError': case 'DevicesNotFoundError': return 'Kamera tidak ditemukan oleh browser. Pastikan aplikasi lain tidak sedang memakai kamera.';
    case 'NotReadableError': case 'TrackStartError': return 'Kamera sedang digunakan aplikasi lain atau gagal dibuka. Tutup aplikasi kamera/meeting lalu coba lagi.';
    case 'OverconstrainedError': return 'Kamera belakang tidak tersedia dengan pengaturan ini. Coba lagi atau gunakan input token manual.';
    case 'SecurityError': case 'TypeError': return 'Browser tidak menyediakan akses kamera. Pastikan halaman dibuka melalui HTTPS dan bukan browser dalam aplikasi.';
    default: return `Kamera gagal dibuka${e?.name ? ` (${e.name})` : ''}${e?.message ? `: ${e.message}` : '.'} Coba muat ulang atau masukkan token secara manual.`;
  }
}
export default function ScanAttendancePage() {
  const router = useRouter();
  const scannerRef = useRef<Scanner | null>(null);
  const mountedRef = useRef(false);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('Login diperlukan untuk melakukan absensi.');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      if (!supabase) { setStatus('Supabase belum dikonfigurasi.'); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace('/login');
      else setStatus('Tekan “Buka kamera” untuk memulai pemindaian QR.');
    })();
    return () => { mountedRef.current = false; void scannerRef.current?.stop().catch(() => undefined); };
  }, [router]);

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
    if (cameraBusy || cameraOn || success) return;
    setCameraBusy(true); setStatus('Menyiapkan kamera...');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Halaman ini tidak memiliki akses kamera HTTPS.'), { name: 'SecurityError' });
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader') as unknown as Scanner;
      scannerRef.current = scanner;
      // Ask for available cameras first; selecting the concrete rear-camera ID is more reliable on some Android browsers.
      let cameras: CameraInfo[] = [];
      try { cameras = await scanner.getCameras(); } catch { /* start() below will surface the actual error */ }
      const rear = cameras.find(c => /back|rear|environment|belakang|traseira/i.test(c.label));
      const selectedCamera = rear?.id || cameras[cameras.length - 1]?.id;
      const config = { fps: 10, qrbox: (viewfinderWidth: number, viewfinderHeight: number) => { const side = Math.max(180, Math.min(280, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72))); return { width: side, height: side }; }, aspectRatio: 1 };
      try {
        await scanner.start(selectedCamera || { facingMode: 'environment' }, config, (decoded) => { if (!scannedRef.current) void submitToken(decoded); }, () => undefined);
      } catch (firstError) {
        // Retry with browser facingMode if selecting a camera ID failed.
        if (selectedCamera) await scanner.start({ facingMode: 'environment' }, config, (decoded) => { if (!scannedRef.current) void submitToken(decoded); }, () => undefined);
        else throw firstError;
      }
      if (mountedRef.current) { setCameraOn(true); setStatus('Kamera aktif. Posisikan QR di dalam kotak.'); }
    } catch (e) {
      if (scannerRef.current) { try { await scannerRef.current.stop(); } catch { /* not started */ } try { scannerRef.current.clear(); } catch { /* ignore */ } scannerRef.current = null; }
      setCameraOn(false); setStatus(cameraErrorMessage(e));
    } finally { setCameraBusy(false); }
  }
  async function stopCamera() {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch { /* camera may already be stopped */ } try { scannerRef.current.clear(); } catch { /* ignore */ } scannerRef.current = null; }
    setCameraOn(false);
  }
  function reset() { scannedRef.current = false; setSuccess(false); setToken(''); setStatus('Tekan “Buka kamera” untuk memulai pemindaian QR.'); }

  return <main className="app-shell shell"><header className="app-nav"><Link href="/" className="brand">HADIR<span>!</span></Link><Link href="/dashboard" className="button button-small button-light"><ArrowLeft size={16}/> Dashboard</Link></header><div className="dashboard-head"><div><div className="eyebrow"><span className="dot"/> ABSENSI SISWA</div><h1>SCAN & HADIR.</h1><p>Scan QR aktif dari admin. Setiap siswa hanya bisa absen sekali per sesi.</p></div></div><section className="scanner-card"><div className="scanner-title"><ScanLine size={24}/><h2>PEMINDAI QR</h2></div><div id="qr-reader" className="qr-reader"/><div className="panel-actions"><button className="button" disabled={cameraOn||cameraBusy||success} onClick={()=>void startCamera()}><Camera size={18}/> {cameraBusy?'Menyiapkan kamera...':cameraOn?'Kamera aktif':'Buka kamera'}</button>{cameraOn&&<button className="button button-light" onClick={()=>void stopCamera()}>Matikan kamera</button>}</div><div className={success?'notice notice-success':'notice'}>{success&&<CheckCircle2 size={18}/>} {status}</div>{!success&&<form className="form" onSubmit={e=>{e.preventDefault();void submitToken(token);}}><label>Atau masukkan token QR<input value={token} onChange={e=>setToken(e.target.value)} placeholder="Tempel token QR di sini" autoComplete="off"/></label><button className="button" disabled={busy}>{busy?'Memproses...':'Kirim absensi'} <ScanLine size={17}/></button></form>}{success&&<button className="button" onClick={reset}><RefreshCw size={16}/> Scan sesi lain</button>}</section><p className="muted">Jika kamera tetap tidak terbuka, tutup aplikasi lain yang memakai kamera lalu muat ulang halaman. HTTPS dan izin browser diperlukan. QR hanya berlaku pada tanggal pembuatannya dan selama satu jam sejak dibuat.</p></main>;
}
