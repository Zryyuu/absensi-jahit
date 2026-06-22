import fs from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

// Helper untuk mengecek apakah kita harus menggunakan Cloud Vercel
const isCloudEnabled = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN && process.env.BLOB_READ_WRITE_TOKEN);
};

/**
 * Mengunggah/menyimpan foto absensi.
 * @param {string} photoBase64 - Foto dalam format base64 (data:image/jpeg;base64,...)
 * @returns {Promise<string>} URL publik foto yang bisa diakses
 */
export async function uploadPhoto(photoBase64) {
  // Membersihkan prefix base64 jika ada
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
    
    // Pastikan folder public/uploads ada
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
 * @returns {Promise<object>} Record absensi yang disimpan
 */
export async function saveAttendance(name, photoUrl) {
  const timestamp = new Date().toISOString();
  const record = {
    id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    photoUrl,
    timestamp,
  };

  if (isCloudEnabled()) {
    // Simpan ke Vercel KV (lpush agar data baru berada di urutan teratas)
    await kv.lpush('attendance_records', record);
  } else {
    // Simpan ke file JSON lokal (src/data/db.json)
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const filePath = path.join(dataDir, 'db.json');

    // Pastikan folder src/data ada
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

    // Masukkan ke awal array (descending order)
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
    // Ambil semua data dari Redis list
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
