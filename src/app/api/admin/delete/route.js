import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { deleteAttendanceRecord } from '@/lib/db';

const SECRET_SALT = process.env.ADMIN_SECRET_SALT || 'absensi-key-secret-12345';

/**
 * API untuk menghapus satu record absensi berdasarkan ID.
 * Hanya admin yang sudah login yang bisa menghapus.
 */
export async function DELETE(request) {
  try {
    // 1. Verifikasi sesi admin
    const sessionCookie = request.cookies.get('admin_session');
    const token = sessionCookie?.value;

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const expectedToken = crypto
      .createHmac('sha256', SECRET_SALT)
      .update(adminPassword)
      .digest('hex');

    if (!token || token !== expectedToken) {
      return NextResponse.json(
        { error: 'Akses ditolak. Sesi Anda tidak valid atau telah berakhir.' },
        { status: 401 }
      );
    }

    // 2. Ambil ID record dari body request
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'ID record tidak valid.' },
        { status: 400 }
      );
    }

    // 3. Hapus record dari database
    await deleteAttendanceRecord(id);

    return NextResponse.json({ success: true, message: 'Data absensi berhasil dihapus.' });
  } catch (error) {
    console.error('API Error (Delete Record):', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus data absensi.' },
      { status: 500 }
    );
  }
}
