'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cek apakah admin sudah login (cookie masih valid) saat halaman dibuka
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/admin/records');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error('Gagal mengecek sesi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return;

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsLoggedIn(true);
        // Langsung ambil data setelah login berhasil
        await fetchRecords();
      } else {
        setError(data.error || 'Password salah.');
      }
    } catch (err) {
      setError('Koneksi gagal. Silakan coba lagi.');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/records');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      } else if (res.status === 401) {
        setIsLoggedIn(false);
      }
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsLoggedIn(false);
      setRecords([]);
      setPassword('');
    } catch (err) {
      console.error('Gagal logout:', err);
    }
  };

  // Memformat tanggal ISO ke format Indonesia yang mudah dibaca
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Memformat waktu ISO ke format Jam:Menit:Detik WIB
  const formatTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' WIB';
  };

  // Memfilter data berdasarkan input nama dan filter tanggal
  const filteredRecords = records.filter((rec) => {
    const matchName = rec.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchDate = true;
    if (dateFilter) {
      const recDate = new Date(rec.timestamp).toISOString().split('T')[0]; // format YYYY-MM-DD
      matchDate = recDate === dateFilter;
    }

    return matchName && matchDate;
  });

  // Ekspor data ke CSV
  const exportToCSV = () => {
    if (filteredRecords.length === 0) return;

    // Header CSV
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'No,ID Absensi,Nama Karyawan,Tanggal,Waktu,URL Foto\n';

    // Baris Data
    filteredRecords.forEach((rec, index) => {
      const dateStr = formatDate(rec.timestamp).replace(/,/g, '');
      const timeStr = formatTime(rec.timestamp);
      const row = `${index + 1},${rec.id},"${rec.name}",${dateStr},${timeStr},"${rec.photoUrl}"`;
      csvContent += row + '\n';
    });

    // Buat link download secara dinamis
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_absensi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Tampilan Loading Awal saat memeriksa Sesi
  if (isLoading && !isLoggedIn) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(16, 185, 129, 0.2)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'scanning 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: 'var(--text-secondary)' }}>Memeriksa sesi admin...</p>
        </div>
      </div>
    );
  }

  // Tampilan FORM LOGIN jika tidak terautentikasi
  if (!isLoggedIn) {
    return (
      <div className="container" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '85vh' }}>
        <div className="glass-card" style={{ maxWidth: '400px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Login Admin</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Masukkan password untuk mengelola dan memantau riwayat absensi.
            </p>
          </div>

          {error && (
            <div className="alert-banner alert-banner-error" style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="admin-pass" className="form-label">Password Administrator</label>
              <input
                id="admin-pass"
                type="password"
                className="form-input"
                placeholder="Masukkan password admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={actionLoading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '1rem' }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
            </button>

            <Link href="/" className="btn btn-secondary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}>
              Kembali ke Beranda
            </Link>
          </form>
        </div>
      </div>
    );
  }

  // Tampilan UTAMA DASHBOARD ADMIN (Terautentikasi)
  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Dashboard Nav */}
      <header className="header-nav" style={{ marginBottom: '3rem' }}>
        <div className="nav-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V12H17V17Z" fill="currentColor"/>
          </svg>
          Dashboard Admin
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            Halaman Absen
          </Link>
          <button onClick={handleLogout} className="btn btn-danger" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            Keluar (Logout)
          </button>
        </div>
      </header>

      {/* Overview Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ backgroundColor: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '0.75rem', borderRadius: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block' }}>Total Absensi</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800' }}>{records.length}</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ backgroundColor: 'var(--accent-secondary-glow)', color: 'var(--accent-secondary)', padding: '0.75rem', borderRadius: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block' }}>Absensi Hari Ini</span>
            <span style={{ fontSize: '1.75rem', fontWeight: '800' }}>
              {records.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString()).length}
            </span>
          </div>
        </div>
      </div>

      {/* Control bar for filters and exports */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Filters Group */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', flex: 1 }}>
          <div style={{ minWidth: '220px', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Cari nama karyawan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.7rem 1rem' }}
            />
          </div>
          <div style={{ minWidth: '170px' }}>
            <input
              type="date"
              className="form-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ padding: '0.7rem 1rem' }}
            />
          </div>
          { (searchTerm || dateFilter) && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setSearchTerm(''); setDateFilter(''); }}
              style={{ padding: '0.7rem 1rem' }}
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem' }} className="no-print">
          <button
            className="btn btn-secondary"
            onClick={handlePrint}
            disabled={filteredRecords.length === 0}
            style={{ padding: '0.7rem 1.25rem', fontSize: '0.9rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Cetak
          </button>
          <button
            className="btn btn-primary"
            onClick={exportToCSV}
            disabled={filteredRecords.length === 0}
            style={{ padding: '0.7rem 1.25rem', fontSize: '0.9rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Attendance History Table Card */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>Riwayat Absensi Terkini</h2>
        
        {isLoading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Memuat data absensi...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <p>Tidak ditemukan data absensi karyawan.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Foto</th>
                  <th>Nama Karyawan</th>
                  <th>Tanggal</th>
                  <th>Jam Server</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr key={record.id}>
                    <td style={{ width: '50px' }}>{index + 1}</td>
                    <td style={{ width: '100px' }}>
                      <div 
                        style={{ 
                          width: '70px', 
                          height: '52px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          border: '1px solid var(--glass-border)',
                          cursor: 'zoom-in',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }}
                        onClick={() => setSelectedPhoto(record)}
                        title="Klik untuk memperbesar foto"
                      >
                        <img 
                          src={record.photoUrl} 
                          alt={record.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{record.name}</td>
                    <td>{formatDate(record.timestamp)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatTime(record.timestamp)}</td>
                    <td>
                      <span className="badge badge-success">Hadir</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Photo Enlargement */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem' }}>Bukti Foto: {selectedPhoto.name}</h3>
              <button 
                onClick={() => setSelectedPhoto(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer',
                  fontSize: '1.25rem'
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0, backgroundColor: '#090d16', display: 'flex', justifyContent: 'center' }}>
              <img 
                src={selectedPhoto.photoUrl} 
                alt={selectedPhoto.name}
                style={{ width: '100%', maxHeight: '450px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p><strong>Nama:</strong> {selectedPhoto.name}</p>
              <p><strong>ID Record:</strong> {selectedPhoto.id}</p>
              <p><strong>Waktu Absen:</strong> {formatDate(selectedPhoto.timestamp)} - {formatTime(selectedPhoto.timestamp)}</p>
            </div>
          </div>
        </div>
      )}

      <footer>
        &copy; {new Date().getFullYear()} AbsenKu Cloud. Panel Dashboard Admin Absensi.
      </footer>

      {/* CSS Khusus untuk Print Halaman */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .glass-card {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .no-print, header, footer, .btn, input {
            display: none !important;
          }
          .modern-table th {
            background: #f1f5f9 !important;
            color: #000000 !important;
            border-bottom: 2px solid #000000 !important;
          }
          .modern-table td {
            color: #000000 !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
