import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET_SALT = process.env.ADMIN_SECRET_SALT || 'absensi-key-secret-12345';

export async function POST(request) {
  try {
    const body = await request.json();
    const { password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password === adminPassword) {
      // Hasilkan token hash yang aman menggunakan crypto bawaan Node.js
      const token = crypto
        .createHmac('sha256', SECRET_SALT)
        .update(adminPassword)
        .digest('hex');

      const response = NextResponse.json({ success: true });
      
      // Set cookie HTTP-only agar aman dari pencurian javascript (XSS)
      response.cookies.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // Sesi berlaku 1 hari
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Password admin salah.' }, { status: 401 });
  } catch (error) {
    console.error('API Error (Admin Login):', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}
