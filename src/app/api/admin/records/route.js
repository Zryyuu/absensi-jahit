import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAttendanceRecords } from '@/lib/db';

const SECRET_SALT = process.env.ADMIN_SECRET_SALT || 'absensi-key-secret-12345';

export async function GET(request) {
  try {
    // 1. Verifikasi cookie sesi admin
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

    // 2. Ambil data absensi dari adapter database
    const records = await getAttendanceRecords();

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error('API Error (Get Records):', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat data.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
