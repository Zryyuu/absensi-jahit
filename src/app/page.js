'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function AttendancePage() {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text: '' }

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Menghentikan kamera saat komponen dilepas (unmount)
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setStatus(null);
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user', // Kamera depan (selfie)
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Gagal mengakses kamera:', err);
      setStatus({
        type: 'error',
        text: 'Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin kamera pada browser Anda.',
      });
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
      
      // Menyesuaikan ukuran canvas dengan resolusi video asli
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const context = canvas.getContext('2d');
      // Mirror image agar sama dengan tampilan selfie di layar
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Ambil gambar sebagai format JPEG dengan kualitas 0.8 untuk hemat storage
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhoto(dataUrl);
      
      // Hentikan stream kamera setelah foto berhasil diambil
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatus({ type: 'error', text: 'Silakan masukkan nama Anda.' });
      return;
    }
    if (!photo) {
      setStatus({ type: 'error', text: 'Silakan ambil foto terlebih dahulu sebelum mengirim absensi.' });
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
          name: name.trim(),
          photo: photo,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          text: `Absensi berhasil dicatat! Terima kasih, ${data.record.name}.`,
        });
        setName('');
        setPhoto(null);
      } else {
        setStatus({
          type: 'error',
          text: data.error || 'Terjadi kesalahan saat memproses absensi.',
        });
      }
    } catch (err) {
      console.error('Error saat submit absensi:', err);
      setStatus({
        type: 'error',
        text: 'Koneksi gagal. Pastikan Anda terhubung ke internet dan coba lagi.',
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
          AbsenKu Cloud
        </div>
        <Link href="/admin" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
          Dashboard Admin
        </Link>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '550px', margin: '0 auto' }}>
        <div className="glass-card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>E-Absensi Karyawan</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Silakan masukkan nama Anda dan ambil foto langsung untuk melalukan absensi hari ini.
            </p>
          </div>

          {/* Status Banners */}
          {status && (
            <div className={`alert-banner alert-banner-${status.type}`}>
              {status.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              {status.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Input Nama */}
            <div className="form-group">
              <label htmlFor="name-input" className="form-label">
                Nama Lengkap Karyawan
              </label>
              <input
                id="name-input"
                type="text"
                className="form-input"
                placeholder="Contoh: Budi Santoso"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {/* Webcam / Preview Camera */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <span className="form-label">Foto Absensi (Wajib Kamera Live)</span>
              
              <div className={`camera-container ${isCameraActive ? 'active' : ''}`}>
                {/* 1. Camera View Finder */}
                {isCameraActive && !photo && (
                  <>
                    <video
                      ref={videoRef}
                      className="camera-video"
                      autoPlay
                      playsInline
                      muted
                      style={{ transform: 'scaleX(-1)' }} // Mirror view for natural interaction
                    />
                    <div className="camera-scanline"></div>
                  </>
                )}

                {/* 2. Photo Snapshot Taken */}
                {photo && (
                  <img
                    src={photo}
                    alt="Preview Absensi"
                    className="camera-preview-img"
                  />
                )}

                {/* 3. Initial Inactive State */}
                {!isCameraActive && !photo && (
                  <div className="camera-overlay">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <p style={{ fontSize: '0.9rem' }}>Kamera belum diaktifkan. Berikan izin akses kamera untuk mengambil foto absensi.</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={startCamera}
                      disabled={isLoading}
                      style={{ fontSize: '0.85rem' }}
                    >
                      Aktifkan Kamera
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Actions Bar */}
              {(isCameraActive || photo) && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* Submit Attendance Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }}
              disabled={!name.trim() || !photo || isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'scanning 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}/>
                    <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"/>
                  </svg>
                  Mengirim data...
                </>
              ) : (
                'Kirim Absensi Sekarang'
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Hidden canvas for snapshotting */}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <footer>
        &copy; {new Date().getFullYear()} AbsenKu Cloud. Aplikasi Absensi Terverifikasi Waktu Server.
      </footer>
    </div>
  );
}
