'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ExcelJS from 'exceljs';

const ITEMS_PER_PAGE = 10;

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [selectedExportYear, setSelectedExportYear] = useState(new Date().getFullYear());
  
  // State Pengaturan
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsEmployees, setSettingsEmployees] = useState([]);
  const [settingsLateTime, setSettingsLateTime] = useState('08:15');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Reset ke halaman 1 ketika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettingsEmployees(data.settings.employees || []);
          setSettingsLateTime(data.settings.lateTime || '08:15');
        }
      }
    } catch (err) {
      console.error('Gagal mengambil pengaturan:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employees: settingsEmployees,
          lateTime: settingsLateTime,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({ type: 'success', text: 'Pengaturan berhasil disimpan!' });
        setShowSettingsModal(false);
      } else {
        setNotification({ type: 'error', text: data.error || 'Gagal menyimpan pengaturan.' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Koneksi gagal saat menyimpan pengaturan.' });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleAddEmployee = () => {
    const trimmed = newEmployeeName.trim();
    if (!trimmed) return;
    const exists = settingsEmployees.some(emp => {
      const nameVal = typeof emp === 'string' ? emp : emp.name;
      return nameVal.toLowerCase() === trimmed.toLowerCase();
    });
    if (exists) {
      alert('Nama karyawan ini sudah terdaftar.');
      return;
    }
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const newEmpObj = { name: trimmed, addedAt: todayStr };
    setSettingsEmployees((prev) => {
      const updated = [...prev, newEmpObj];
      return updated.sort((a, b) => {
        const nameA = typeof a === 'string' ? a : a.name;
        const nameB = typeof b === 'string' ? b : b.name;
        return nameA.localeCompare(nameB);
      });
    });
    setNewEmployeeName('');
  };

  const handleRemoveEmployee = (nameToRemove) => {
    if (confirm(`Yakin ingin menghapus "${nameToRemove}" dari daftar karyawan?`)) {
      setSettingsEmployees((prev) => prev.filter(emp => {
        const nameVal = typeof emp === 'string' ? emp : emp.name;
        return nameVal !== nameToRemove;
      }));
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/admin/records');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setIsLoggedIn(true);
        fetchSettings();
      } else if (res.status === 401) {
        setIsLoggedIn(false);
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
        await fetchRecords();
        await fetchSettings();
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
        setNotification({ type: 'error', text: 'Sesi Anda telah kadaluarsa. Silakan login ulang.' });
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setNotification({ type: 'success', text: `Data absensi "${deleteTarget.name}" berhasil dihapus.` });
      } else if (res.status === 401) {
        setIsLoggedIn(false);
        setNotification({ type: 'error', text: 'Sesi Anda telah kadaluarsa. Silakan login ulang.' });
      } else {
        setNotification({ type: 'error', text: data.error || 'Gagal menghapus data.' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Koneksi gagal saat menghapus data.' });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}.${minutes} WIB`;
  };

  const getSecurePhotoUrl = (photoUrl) => {
    if (!photoUrl) return '';
    return `/api/admin/photo?url=${encodeURIComponent(photoUrl)}`;
  };

  // Filter records berdasarkan nama dan tanggal (termasuk status Tidak Hadir/Belum Hadir)
  const filteredRecords = (() => {
    // 1. Dapatkan check-in riil yang cocok dengan filter nama & tanggal
    const actualMatches = records.filter((rec) => {
      const matchName = rec.name.toLowerCase().includes(searchTerm.toLowerCase());
      let matchDate = true;
      if (dateFilter) {
        const recDate = new Date(rec.timestamp).toISOString().split('T')[0];
        matchDate = recDate === dateFilter;
      }
      return matchName && matchDate;
    });

    // Tentukan tanggal rekap absent: jika dateFilter diset, gunakan dateFilter. Jika tidak, gunakan hari ini (todayJkt).
    const now = new Date();
    const todayJkt = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD format
    const activeDate = dateFilter || todayJkt;

    // Rekap absent berlaku jika:
    // - dateFilter diset dan dateFilter <= todayJkt
    // - ATAU dateFilter TIDAK diset (maka rekap untuk todayJkt)
    const shouldRekap = !dateFilter || (dateFilter <= todayJkt);

    if (shouldRekap) {
      const hourStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
        hour: '2-digit'
      });
      const hourJkt = parseInt(hourStr, 10);

      const isPastDate = activeDate < todayJkt;
      const statusLabel = (isPastDate || hourJkt >= 15) ? 'Tidak Hadir' : 'Belum Hadir';

      // Dapatkan daftar nama karyawan yang sudah check-in pada activeDate (case-insensitive)
      const checkedInNames = records
        .filter(rec => {
          const recDate = new Date(rec.timestamp).toISOString().split('T')[0];
          return recDate === activeDate;
        })
        .map((r) => r.name.toLowerCase());

      // Cari karyawan terdaftar yang belum absen pada activeDate
      const absentRecords = settingsEmployees
        .filter((emp) => {
          const empName = typeof emp === 'string' ? emp : emp.name;
          const addedDate = typeof emp === 'string' ? '1970-01-01' : (emp.addedAt || '1970-01-01');
          
          const isMatchName = empName.toLowerCase().includes(searchTerm.toLowerCase());
          const hasCheckedIn = checkedInNames.includes(empName.toLowerCase());
          const isAlreadyAdded = activeDate >= addedDate;

          return isMatchName && !hasCheckedIn && isAlreadyAdded;
        })
        .map((emp) => {
          const empName = typeof emp === 'string' ? emp : emp.name;
          return {
            id: `absent-${empName}-${activeDate}`,
            name: empName,
            photoUrl: null,
            timestamp: `${activeDate}T12:00:00.000`, // Menggunakan waktu lokal siang agar tidak bergeser hari karena timezone browser
            status: statusLabel,
          };
        });

      // Urutkan check-in asli (Hadir/Telat) di atas, Tidak Hadir/Belum Hadir di bawah
      return [...actualMatches, ...absentRecords];
    }

    return actualMatches;
  })();

  // Paginasi
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Helper: hitung halaman paginasi yang ditampilkan (max 5 tombol angka)
  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Filter records untuk ekspor berdasarkan bulan dan tahun yang dipilih
  const getExportRecords = (monthVal, yearVal) => {
    return filteredRecords.filter((rec) => {
      const date = new Date(rec.timestamp);
      const matchYear = date.getFullYear() === parseInt(yearVal, 10);
      if (monthVal === 'all') return matchYear;
      const monthIndex = parseInt(monthVal, 10);
      return matchYear && date.getMonth() === monthIndex;
    });
  };

  // Ekspor ke Excel
  const exportToExcel = async (monthVal, yearVal) => {
    const dataToExport = getExportRecords(monthVal, yearVal);
    if (dataToExport.length === 0) {
      setNotification({ type: 'error', text: 'Tidak ada data untuk diekspor.' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AbsenKu Cloud';
    workbook.created = new Date();

    const monthLabel = monthVal === 'all' ? 'Semua Bulan' : BULAN_NAMES[parseInt(monthVal, 10)];
    const sheet = workbook.addWorksheet(`Rekap ${monthLabel} ${yearVal}`, {
      properties: { defaultRowHeight: 20 },
    });

    sheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Nama Karyawan', key: 'nama', width: 28 },
      { header: 'Tanggal', key: 'tanggal', width: 24 },
      { header: 'Waktu', key: 'waktu', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Jarak (Meter)', key: 'jarak', width: 16 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0D9668' } },
        bottom: { style: 'thin', color: { argb: 'FF0D9668' } },
        left: { style: 'thin', color: { argb: 'FF0D9668' } },
        right: { style: 'thin', color: { argb: 'FF0D9668' } },
      };
    });

    dataToExport.forEach((rec, index) => {
      const isAbsent = rec.status === 'Tidak Hadir' || rec.status === 'Belum Hadir';
      const row = sheet.addRow({
        no: index + 1,
        nama: rec.name,
        tanggal: formatDate(rec.timestamp),
        waktu: isAbsent ? '—' : formatTime(rec.timestamp),
        status: rec.status || 'Hadir',
        jarak: isAbsent ? '—' : (rec.distance !== undefined && rec.distance !== null ? `${rec.distance} m` : '—'),
      });
      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });

    // Auto-fit kolom
    sheet.columns.forEach((col) => {
      let maxLen = col.header ? col.header.length : 10;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const cellLen = cell.value ? cell.value.toString().length : 0;
        if (cellLen > maxLen) maxLen = cellLen;
      });
      col.width = maxLen + 4;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileSuffix = monthVal === 'all' ? `semua_${yearVal}` : `${BULAN_NAMES[parseInt(monthVal, 10)].toLowerCase()}_${yearVal}`;
    link.download = `rekap_absensi_${fileSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ======================== RENDER ========================

  // Loading screen
  if (isLoading && !isLoggedIn) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
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

  // Login form
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
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="admin-pass" className="form-label">Password Administrator</label>
              <input id="admin-pass" type="password" className="form-input" placeholder="Masukkan password admin"
                value={password} onChange={(e) => setPassword(e.target.value)} required disabled={actionLoading}
              />
            </div>
            <button type="submit" className="btn btn-primary"
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

  // ======================== DASHBOARD ========================
  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Nav */}
      <header className="header-nav" style={{ marginBottom: '2rem' }}>
        <div className="nav-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V12H17V17Z" fill="currentColor"/>
          </svg>
          Dashboard Admin
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '0.5rem 0.85rem' }}>
            Halaman Absen
          </Link>
          <button 
            onClick={() => { fetchSettings(); setShowSettingsModal(true); }} 
            className="btn btn-secondary" 
            style={{ fontSize: '0.82rem', padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Pengaturan
          </button>
          <button onClick={handleLogout} className="btn btn-danger" style={{ fontSize: '0.82rem', padding: '0.5rem 0.85rem' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div className={`alert-banner alert-banner-${notification.type}`} style={{ marginBottom: '1.25rem' }}>
          {notification.type === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '0.65rem', borderRadius: '10px', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>Total Absensi</span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>{records.length}</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'var(--accent-secondary)', padding: '0.65rem', borderRadius: '10px', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>Hari Ini</span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>
              {records.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString()).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Export Bar — 1 baris */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          {/* Input Cari Nama dengan tombol reset pada border input */}
          <div style={{ position: 'relative', flex: '1 1 140px', minWidth: 0 }}>
            <input
              type="text" className="form-input" placeholder="Cari nama..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                title="Hapus pencarian"
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '1.5px solid var(--error)',
                  background: '#ffffff',
                  color: 'var(--error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: 2,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = 'var(--error)';
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Input Tanggal dengan tombol reset pada border input */}
          <div style={{ position: 'relative', flex: '0 0 auto', width: '150px' }}>
            <input
              type="date" className="form-input"
              value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: '100%' }}
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                title="Hapus filter tanggal"
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '1.5px solid var(--error)',
                  background: '#ffffff',
                  color: 'var(--error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: 2,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = 'var(--error)';
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={records.length === 0}
              style={{ fontSize: '0.85rem', padding: '0.6rem 1rem' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Ekspor Excel
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '0.25rem' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showExportDropdown && (() => {
              const availableYears = Array.from(
                new Set(records.map((rec) => new Date(rec.timestamp).getFullYear()))
              ).sort((a, b) => b - a);
              
              const activeExportYear = availableYears.includes(selectedExportYear)
                ? selectedExportYear
                : (availableYears[0] || new Date().getFullYear());

              const totalCountForYear = records.filter(
                (rec) => new Date(rec.timestamp).getFullYear() === activeExportYear
              ).length;

              return (
                <>
                  <div 
                    onClick={() => setShowExportDropdown(false)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 15,
                      background: 'transparent'
                    }}
                  />
                  <div className="export-dropdown">
                    {/* Header Pilihan Tahun */}
                    <div style={{ 
                      padding: '0.65rem 1rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-tertiary)',
                      marginBottom: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>TAHUN REKAP:</span>
                      <select
                        value={activeExportYear}
                        onChange={(e) => setSelectedExportYear(parseInt(e.target.value, 10))}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: '600',
                          outline: 'none',
                        }}
                      >
                        {availableYears.length > 0 ? (
                          availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))
                        ) : (
                          <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        )}
                      </select>
                    </div>

                    <div style={{ padding: '0.35rem 1rem 0.15rem', fontSize: '0.68rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                      PILIH BULAN REKAP
                    </div>
                    
                    {/* Container Scrollable untuk Bulan */}
                    <div style={{ 
                      overflowY: 'auto', 
                      maxHeight: '200px', 
                      display: 'flex', 
                      flexDirection: 'column',
                      paddingBottom: '0.25rem'
                    }}>
                      {/* Semua Bulan */}
                      <button
                        type="button"
                        onClick={() => {
                          if (totalCountForYear > 0) {
                            exportToExcel('all', activeExportYear.toString());
                            setShowExportDropdown(false);
                          }
                        }}
                        disabled={totalCountForYear === 0}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0.6rem 1rem',
                          textAlign: 'left',
                          fontSize: '0.82rem',
                          color: totalCountForYear > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                          cursor: totalCountForYear > 0 ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          fontFamily: 'inherit',
                          opacity: totalCountForYear > 0 ? 1 : 0.5,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (totalCountForYear > 0) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>Semua Bulan ({activeExportYear})</span>
                        <span style={{ fontSize: '0.72rem', color: totalCountForYear > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: '600' }}>
                          {totalCountForYear}
                        </span>
                      </button>
                      
                      {/* Per Bulan */}
                      {BULAN_NAMES.map((name, index) => {
                        const count = records.filter(rec => {
                          const d = new Date(rec.timestamp);
                          return d.getFullYear() === activeExportYear && d.getMonth() === index;
                        }).length;

                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              if (count > 0) {
                                exportToExcel(index.toString(), activeExportYear.toString());
                                setShowExportDropdown(false);
                              }
                            }}
                            disabled={count === 0}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0.6rem 1rem',
                              textAlign: 'left',
                              fontSize: '0.82rem',
                              color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: count > 0 ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                              opacity: count > 0 ? 1 : 0.5,
                              fontFamily: 'inherit',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (count > 0) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span>{name}</span>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              color: count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', 
                              background: count > 0 ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)', 
                              padding: '0.1rem 0.45rem', 
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Riwayat Absensi</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {filteredRecords.length} total data
          </span>
        </div>
        
        {isLoading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Memuat data absensi...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <p>Tidak ditemukan data absensi.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Foto</th>
                    <th>Nama</th>
                    <th>Tanggal</th>
                    <th>Jam</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record, index) => (
                    <tr key={record.id}>
                      <td style={{ width: '42px' }}>{startIndex + index + 1}</td>
                      <td style={{ width: '80px' }}>
                        {record.photoUrl ? (
                          <div 
                            style={{ 
                              width: '56px', height: '42px', borderRadius: '6px', overflow: 'hidden', 
                              border: '1px solid var(--border-color)', cursor: 'zoom-in',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                            }}
                            onClick={() => setSelectedPhoto(record)}
                            title="Klik untuk memperbesar"
                          >
                            <img 
                              src={getSecurePhotoUrl(record.photoUrl)} alt={record.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f1f5f9;color:#94a3b8;font-size:0.6rem;text-align:center">Foto</div>';
                              }}
                            />
                          </div>
                        ) : (
                          <div 
                            style={{ 
                              width: '56px', height: '42px', borderRadius: '6px', 
                              border: '1px dashed var(--border-color)', display: 'flex', 
                              alignItems: 'center', justifyContent: 'center', 
                              background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.65rem' 
                            }}
                          >
                            —
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)', maxWidth: '160px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.name}</div>
                        {record.distance !== undefined && record.distance !== null && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>{record.distance}m dari kantor</span>
                          </div>
                        )}
                      </td>
                      <td>{formatDate(record.timestamp)}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {(record.status === 'Tidak Hadir' || record.status === 'Belum Hadir') ? '—' : formatTime(record.timestamp)}
                      </td>
                      <td>
                        <span className={`badge ${
                          record.status === 'Telat' ? 'badge-warning' : 
                          (record.status === 'Tidak Hadir' || record.status === 'Belum Hadir') ? 'badge-danger' : 
                          'badge-success'
                        }`}>
                          {record.status || 'Hadir'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {(record.status !== 'Tidak Hadir' && record.status !== 'Belum Hadir') ? (
                          <button className="btn-icon-delete" onClick={() => setDeleteTarget(record)} title="Hapus">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginasi */}
            {totalPages > 1 && (
              <>
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹
                  </button>
                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    ›
                  </button>
                </div>
                <p className="pagination-info">
                  Menampilkan {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredRecords.length)} dari {filteredRecords.length} data
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal Foto */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem' }}>Bukti Foto: {selectedPhoto.name}</h3>
              <button onClick={() => setSelectedPhoto(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}>
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0, backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
              <img src={getSecurePhotoUrl(selectedPhoto.photoUrl)} alt={selectedPhoto.name}
                style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }}
              />
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <p><strong>Nama:</strong> {selectedPhoto.name}</p>
              <p><strong>Waktu:</strong> {formatDate(selectedPhoto.timestamp)} — {formatTime(selectedPhoto.timestamp)}</p>
              {selectedPhoto.distance !== undefined && selectedPhoto.distance !== null && (
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.25rem' }}>
                  <strong>Lokasi:</strong> 
                  <span>{selectedPhoto.distance} meter dari kantor ({selectedPhoto.latitude.toFixed(6)}, {selectedPhoto.longitude.toFixed(6)})</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Konfirmasi Hapus
              </h3>
              <button onClick={() => !deleteLoading && setDeleteTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: deleteLoading ? 'not-allowed' : 'pointer', fontSize: '1.25rem' }}
                disabled={deleteLoading}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                Yakin ingin <strong style={{ color: 'var(--error)' }}>menghapus permanen</strong> data ini? Tindakan <strong>tidak dapat dibatalkan</strong>.
              </p>
              <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.92rem' }}>{deleteTarget.name}</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatDate(deleteTarget.timestamp)} — {formatTime(deleteTarget.timestamp)}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}>Batal</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}>
                  {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => !settingsLoading && setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Pengaturan Absensi
              </h3>
              <button 
                onClick={() => !settingsLoading && setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: settingsLoading ? 'not-allowed' : 'pointer', fontSize: '1.25rem' }}
                disabled={settingsLoading}
              >&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              
              {/* Form Input Jam Masuk (Batas Telat) */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Jam Batas Masuk (Format WIB)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={settingsLateTime}
                    onChange={(e) => setSettingsLateTime(e.target.value)}
                    disabled={settingsLoading}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>WIB</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Absensi yang terkirim melebihi batas jam masuk ini otomatis akan berstatus "Telat".
                </p>
              </div>

              {/* Input Daftar Karyawan */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Daftar Karyawan Terdaftar ({settingsEmployees.length})</label>
                
                {/* Kolom Tambah Karyawan */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Masukkan nama karyawan baru..."
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmployee();
                      }
                    }}
                    disabled={settingsLoading}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleAddEmployee}
                    disabled={settingsLoading || !newEmployeeName.trim()}
                    style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                  >
                    Tambah
                  </button>
                </div>

                {/* List Karyawan */}
                <div style={{ 
                  maxHeight: '180px', 
                  overflowY: 'auto', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-primary)'
                }}>
                  {settingsEmployees.length === 0 ? (
                    <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Belum ada nama karyawan yang ditambahkan.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {settingsEmployees.map((emp, idx) => {
                        const empName = typeof emp === 'string' ? emp : emp.name;
                        const addedDate = typeof emp === 'string' ? null : emp.addedAt;
                        return (
                          <div 
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.55rem 0.85rem',
                              borderBottom: idx === settingsEmployees.length - 1 ? 'none' : '1px solid var(--border-color)',
                              fontSize: '0.88rem',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{empName}</span>
                              {addedDate && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mulai rekap: {addedDate}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveEmployee(empName)}
                              disabled={settingsLoading}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                padding: '0.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.8,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.8}
                              title={`Hapus ${empName}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Simpan/Batal */}
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowSettingsModal(false)} 
                  disabled={settingsLoading}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSaveSettings} 
                  disabled={settingsLoading}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}
                >
                  {settingsLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      <footer>
        &copy; {new Date().getFullYear()} AbsenKu Cloud. Panel Dashboard Admin.
      </footer>
    </div>
  );
}
