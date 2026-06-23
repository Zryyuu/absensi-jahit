'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function AttendancePage() {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text: '' }

  const [employeeList, setEmployeeList] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Ambil pengaturan karyawan saat halaman dimuat
  useEffect(() => {
    fetchPublicSettings();
  }, []);

  const fetchPublicSettings = async () => {
    try {
      const res = await fetch('/api/settings/public');
      if (res.ok) {
        const data = await res.json();
        setEmployeeList(data.employees || []);
      }
    } catch (err) {
      console.error('Gagal memuat daftar karyawan:', err);
    }
  };

  // Menghentikan kamera saat komponen dilepas (unmount)
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setStatus(null);
    
    // Pastikan videoRef.current ada sebelum mengakses kamera
    if (!videoRef.current) {
      // Tunggu render cycle React selesai
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    try {
      // Langkah 1: Coba dengan spesifikasi kamera depan ideal
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      connectStreamToVideo(stream);
    } catch (err) {
      console.warn('Gagal akses kamera dengan format ideal, mencoba fallback 1...', err);
      try {
        // Langkah 2: Fallback hanya mendeteksi kamera depan saja
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        connectStreamToVideo(stream);
      } catch (err2) {
        console.warn('Gagal fallback 1, mencoba fallback 2 (video: true)...', err2);
        try {
          // Langkah 3: Ambil kamera apapun yang tersedia
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          connectStreamToVideo(stream);
        } catch (errFinal) {
          console.error('Kamera gagal diakses sepenuhnya:', errFinal);
          setStatus({
            type: 'error',
            text: 'Izin kamera ditolak atau kamera tidak terdeteksi. Silakan aktifkan izin kamera di pengaturan browser Anda.',
          });
        }
      }
    }
  };

  const connectStreamToVideo = (stream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setIsCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const context = canvas.getContext('2d');
      // Mirror foto agar sesuai dengan layar preview
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhoto(dataUrl);
      
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeName = name;
    
    if (!activeName || !activeName.trim()) {
      setStatus({ type: 'error', text: 'Silakan masukkan atau pilih nama Anda.' });
      return;
    }
    if (!photo) {
      setStatus({ type: 'error', text: 'Silakan ambil foto terlebih dahulu.' });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: activeName.trim(),
          photo: photo,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          text: `Absensi berhasil! Terima kasih, ${data.record.name}.`,
        });
        setName('');
        setPhoto(null);
      } else {
        setStatus({
          type: 'error',
          text: data.error || 'Gagal memproses absensi.',
        });
      }
    } catch (err) {
      console.error('Error submit absensi:', err);
      setStatus({
        type: 'error',
        text: 'Koneksi gagal. Periksa jaringan Anda dan coba lagi.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Header Navigation */}
      <header className="header-nav">
        <div className="nav-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
          AbsenKu Cloud
        </div>
        <Link href="/admin" className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '0.5rem 0.85rem' }}>
          Dashboard Admin
        </Link>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
        <div className="glass-card">
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '0.4rem', color: 'var(--accent-primary)' }}>E-Absensi Karyawan</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
              Masukkan nama Anda dan ambil foto langsung untuk melalukan absensi hari ini.
            </p>
          </div>

          {/* Status Message */}
          {status && (
            <div className={`alert-banner alert-banner-${status.type}`}>
              {status.type === 'success' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              <span>{status.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
             {/* Input Nama */}
             <div className="form-group">
               <label htmlFor="name-input" className="form-label">
                 Nama Lengkap Karyawan
               </label>
               {employeeList.length > 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                   <select
                     id="name-select"
                     className="form-select"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     disabled={isLoading}
                     style={{ width: '100%' }}
                     required
                   >
                     <option value="">-- Pilih Nama Lengkap Anda --</option>
                     {employeeList.map((empName) => (
                       <option key={empName} value={empName}>
                         {empName}
                       </option>
                     ))}
                   </select>
                 </div>
               ) : (
                 <input
                   id="name-input"
                   type="text"
                   className="form-input"
                   placeholder="Masukkan nama lengkap Anda..."
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   disabled={isLoading}
                   required
                 />
               )}
             </div>

            {/* Video Camera Container */}
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <span className="form-label">Ambil Foto Absensi</span>
              
              <div className={`camera-container ${isCameraActive ? 'active' : ''}`}>
                {/* Video element - SELALU ter-mount di DOM agar tidak bernilai null */}
                <video
                  ref={videoRef}
                  className="camera-video"
                  autoPlay
                  playsInline
                  muted
                  style={{ 
                    transform: 'scaleX(-1)',
                    display: (isCameraActive && !photo) ? 'block' : 'none'
                  }}
                />
                
                {/* Efek Scanning ketika kamera menyala */}
                {isCameraActive && !photo && <div className="camera-scanline"></div>}

                {/* Tampilan preview foto jika berhasil diambil */}
                {photo && (
                  <img
                    src={photo}
                    alt="Preview Absensi"
                    className="camera-preview-img"
                  />
                )}

                {/* Tampilan overlay jika kamera mati dan belum ada foto */}
                {!isCameraActive && !photo && (
                  <div className="camera-overlay">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      Kamera belum aktif. Berikan izin akses kamera untuk melakukan foto absensi.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={startCamera}
                      disabled={isLoading}
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                    >
                      Aktifkan Kamera
                    </button>
                  </div>
                )}
              </div>

              {/* Tombol Aksi Kamera */}
              {(isCameraActive || photo) && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                  {isCameraActive && !photo && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={capturePhoto}
                      style={{ flex: 1 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      Ambil Foto
                    </button>
                  )}
                  {photo && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={retakePhoto}
                      disabled={isLoading}
                      style={{ flex: 1 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                      </svg>
                      Foto Ulang
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={stopCamera}
                    disabled={isLoading || !isCameraActive}
                    style={{ padding: '0.75rem 1rem' }}
                    title="Matikan Kamera"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            {/* Tombol Kirim Form */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
              disabled={!name.trim() || !photo || isLoading}
            >
              {isLoading ? 'Mengirim data...' : 'Kirim Absensi Sekarang'}
            </button>
          </form>
        </div>
      </main>

      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <footer>
        &copy; {new Date().getFullYear()} AbsenKu Cloud. Aplikasi Absensi Terverifikasi Waktu Server.
      </footer>
    </div>
  );
}
