import { NextResponse } from 'next/server';
import { uploadPhoto, saveAttendance } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, photo } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama karyawan wajib diisi.' }, { status: 400 });
    }

    if (!photo) {
      return NextResponse.json({ error: 'Foto absensi wajib diambil.' }, { status: 400 });
    }

    // 1. Unggah foto (ke Vercel Blob atau ke folder lokal public/uploads)
    const photoUrl = await uploadPhoto(photo);

    // 2. Simpan data absensi (ke Vercel KV atau file JSON lokal)
    const record = await saveAttendance(name.trim(), photoUrl);

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error) {
    console.error('API Error (Attendance):', error);
    return NextResponse.json(
      { error: 'Gagal memproses absensi. Pastikan kamera diizinkan dan coba lagi.' },
      { status: 500 }
    );
  }
}
