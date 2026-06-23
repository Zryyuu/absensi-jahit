import fs from 'fs/promises';
import path from 'path';
import { put, del } from '@vercel/blob';
import { kv } from '@vercel/kv';

// Memeriksa variabel environment yang dibutuhkan
const getMissingEnvVars = () => {
  const missing = [];
  if (!process.env.KV_REST_API_URL) missing.push("KV_REST_API_URL");
  if (!process.env.KV_REST_API_TOKEN) missing.push("KV_REST_API_TOKEN");
  if (!process.env.BLOB_READ_WRITE_TOKEN) missing.push("BLOB_READ_WRITE_TOKEN");
  return missing;
};

const isCloudEnabled = () => {
  return getMissingEnvVars().length === 0;
};

// Cek apakah kode berjalan di server produksi Vercel
const isProduction = () => {
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
};

/**
 * Mengunggah/menyimpan foto absensi.
 * @param {string} photoBase64 - Foto dalam format base64
 * @returns {Promise<string>} URL publik foto
 */
export async function uploadPhoto(photoBase64) {
  const missingVars = getMissingEnvVars();

  // Jika di Vercel (Produksi), paksa menggunakan Cloud Storage
  if (isProduction() && missingVars.length > 0) {
    throw new Error(
      `Penyimpanan Cloud gagal. Variabel Environment berikut belum terdeteksi di Vercel: [${missingVars.join(', ')}]. Pastikan Anda sudah menghubungkan KV/Upstash & Blob di tab Storage Vercel.`
    );
  }

  // Membersihkan prefix base64
  const matches = photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let base64Data = photoBase64;
  let mimeType = 'image/jpeg';

  if (matches && matches.length === 3) {
    mimeType = matches[1];
    base64Data = matches[2];
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `absensi-${Date.now()}.jpg`;

  if (isCloudEnabled()) {
    // Unggah ke Vercel Blob
    const blob = await put(`uploads/${filename}`, buffer, {
      contentType: mimeType,
      access: 'public',
    });
    return blob.url;
  } else {
    // Simpan ke lokal (public/uploads)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return `/uploads/${filename}`;
  }
}

/**
 * Menyimpan rekaman absensi ke database.
 * @param {string} name - Nama karyawan
 * @param {string} photoUrl - URL foto karyawan
 * @returns {Promise<object>} Record absensi
 */
export async function saveAttendance(name, photoUrl) {
  const timestamp = new Date().toISOString();
  
  // Hitung status (Hadir atau Telat) berdasarkan pengaturan jam masuk
  let status = 'Hadir';
  try {
    const settings = await getSettings();
    const lateTimeStr = settings.lateTime || '08:00';
    
    // Dapatkan waktu Jakarta (WIB) dari timestamp
    const dateObj = new Date(timestamp);
    const jktTimeStr = dateObj.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Jakarta',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    
    if (jktTimeStr > lateTimeStr) {
      status = 'Telat';
    }
  } catch (err) {
    console.warn('Gagal memverifikasi status telat:', err.message);
  }

  const record = {
    id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    photoUrl,
    timestamp,
    status,
  };

  const missingVars = getMissingEnvVars();
  if (isProduction() && missingVars.length > 0) {
    throw new Error(
      `Database Cloud gagal. Variabel Environment berikut belum terdeteksi di Vercel: [${missingVars.join(', ')}].`
    );
  }

  if (isCloudEnabled()) {
    // Simpan ke Vercel KV (lpush)
    await kv.lpush('attendance_records', record);
  } else {
    // Simpan ke file JSON lokal (src/data/db.json)
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const filePath = path.join(dataDir, 'db.json');

    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    let records = [];
    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      records = JSON.parse(fileData);
    } catch {
      // File belum ada, inisialisasi kosong
    }

    records.unshift(record);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
  }

  return record;
}

/**
 * Mengambil semua rekaman absensi.
 * @returns {Promise<Array>} List data absensi
 */
export async function getAttendanceRecords() {
  if (isCloudEnabled()) {
    const records = await kv.lrange('attendance_records', 0, -1);
    return records || [];
  } else {
    const filePath = path.join(process.cwd(), 'src', 'data', 'db.json');
    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileData);
    } catch {
      return [];
    }
  }
}

/**
 * Menghapus satu rekaman absensi berdasarkan ID.
 * Juga menghapus foto terkait dari Vercel Blob (jika cloud) atau dari folder lokal.
 * @param {string} id - ID record yang akan dihapus
 * @returns {Promise<boolean>} true jika berhasil dihapus
 */
export async function deleteAttendanceRecord(id) {
  if (!id) throw new Error('ID record tidak boleh kosong.');

  if (isCloudEnabled()) {
    // Ambil semua record dari KV
    const records = await kv.lrange('attendance_records', 0, -1);
    const recordToDelete = records.find((r) => r.id === id);

    if (!recordToDelete) {
      throw new Error('Record tidak ditemukan.');
    }

    // Hapus dari KV list
    await kv.lrem('attendance_records', 1, recordToDelete);

    // Hapus foto dari Vercel Blob (jika URL berasal dari Vercel Blob)
    if (recordToDelete.photoUrl && recordToDelete.photoUrl.includes('.vercel-storage.com')) {
      try {
        await del(recordToDelete.photoUrl);
      } catch (err) {
        console.warn('Gagal menghapus foto dari Blob:', err.message);
        // Tidak fatal — record tetap terhapus meskipun foto gagal dihapus
      }
    }
  } else {
    // Mode lokal: Hapus dari file JSON
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const filePath = path.join(dataDir, 'db.json');

    let records = [];
    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      records = JSON.parse(fileData);
    } catch {
      throw new Error('Database lokal tidak ditemukan.');
    }

    const recordIndex = records.findIndex((r) => r.id === id);
    if (recordIndex === -1) {
      throw new Error('Record tidak ditemukan.');
    }

    const deletedRecord = records[recordIndex];

    // Hapus foto lokal jika ada
    if (deletedRecord.photoUrl && deletedRecord.photoUrl.startsWith('/uploads/')) {
      const photoPath = path.join(process.cwd(), 'public', deletedRecord.photoUrl);
      try {
        await fs.unlink(photoPath);
      } catch {
        // Foto mungkin sudah tidak ada
      }
    }

    records.splice(recordIndex, 1);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
  }

  return true;
}

/**
 * Mengambil pengaturan absensi (daftar karyawan dan jam masuk).
 * @returns {Promise<object>} Object pengaturan
 */
export async function getSettings() {
  const defaultSettings = {
    employees: [
      { name: "Adel", addedAt: "2026-06-23" },
      { name: "Fiki", addedAt: "2026-06-23" },
      { name: "Dimas", addedAt: "2026-06-23" },
      { name: "Andre", addedAt: "2026-06-23" },
      { name: "Farel", addedAt: "2026-06-23" },
      { name: "Agel", addedAt: "2026-06-23" },
      { name: "Izah", addedAt: "2026-06-23" },
      { name: "Yudhi", addedAt: "2026-06-23" },
      { name: "Mitha", addedAt: "2026-06-23" },
      { name: "Riski", addedAt: "2026-06-23" }
    ],
    lateTime: '08:15',
  };

  if (isCloudEnabled()) {
    try {
      const data = await kv.get('attendance_settings');
      return data || defaultSettings;
    } catch (err) {
      console.error('Gagal mengambil pengaturan dari KV:', err);
      return defaultSettings;
    }
  } else {
    const filePath = path.join(process.cwd(), 'src', 'data', 'settings.json');
    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileData);
    } catch {
      return defaultSettings;
    }
  }
}

/**
 * Menyimpan pengaturan absensi.
 * @param {object} settingsObject - Object berisi employees dan lateTime
 * @returns {Promise<object>} Object pengaturan yang disimpan
 */
export async function saveSettings(settingsObject) {
  const settings = {
    employees: settingsObject.employees || [],
    lateTime: settingsObject.lateTime || '08:00',
  };

  if (isCloudEnabled()) {
    await kv.set('attendance_settings', settings);
  } else {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const filePath = path.join(dataDir, 'settings.json');

    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    await fs.writeFile(filePath, JSON.stringify(settings, null, 2));
  }

  return settings;
}

/**
 * Menyimpan seluruh daftar rekaman absensi (menimpa data lama).
 * @param {Array} records - Array data absensi
 */
export async function saveAllRecords(records) {
  const missingVars = getMissingEnvVars();
  if (isProduction() && missingVars.length > 0) {
    throw new Error(`Database Cloud gagal. Env vars KV belum diset.`);
  }

  if (isCloudEnabled()) {
    await kv.del('attendance_records');
    if (records.length > 0) {
      // rpush untuk mempertahankan urutan array
      await kv.rpush('attendance_records', ...records);
    }
  } else {
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const filePath = path.join(dataDir, 'db.json');
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
  }
}

