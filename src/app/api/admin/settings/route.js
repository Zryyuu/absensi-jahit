import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSettings, saveSettings } from '@/lib/db';

const SECRET_SALT = process.env.ADMIN_SECRET_SALT || 'absensi-key-secret-12345';

function checkAuth(request) {
  const sessionCookie = request.cookies.get('admin_session');
  const token = sessionCookie?.value;

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const expectedToken = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(adminPassword)
    .digest('hex');

  return token && token === expectedToken;
}

export async function GET(request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Sesi Anda tidak valid atau telah berakhir.' },
        { status: 401 }
      );
    }

    const settings = await getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('API Error (Get Settings):', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil pengaturan.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Sesi Anda tidak valid atau telah berakhir.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { employees, lateTime, holidays } = body;

    if (!Array.isArray(employees)) {
      return NextResponse.json({ error: 'Daftar nama karyawan harus berupa array.' }, { status: 400 });
    }

    if (!lateTime || !/^\d{2}:\d{2}$/.test(lateTime)) {
      return NextResponse.json({ error: 'Format jam masuk tidak valid (harus HH:MM).' }, { status: 400 });
    }

    if (holidays && !Array.isArray(holidays)) {
      return NextResponse.json({ error: 'Daftar tanggal libur harus berupa array.' }, { status: 400 });
    }

    const settings = await saveSettings({ employees, lateTime, holidays: holidays || [] });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('API Error (Post Settings):', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan pengaturan.' }, { status: 500 });
  }
}
