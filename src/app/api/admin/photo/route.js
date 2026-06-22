import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET_SALT = process.env.ADMIN_SECRET_SALT || 'absensi-key-secret-12345';

/**
 * API proxy untuk mengakses foto absensi secara aman.
 * Hanya admin yang sudah login (memiliki cookie sesi valid) yang bisa melihat foto.
 * Foto asli tidak bisa diakses langsung oleh publik.
 */
export async function GET(request) {
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
        { error: 'Akses ditolak. Anda harus login sebagai admin untuk melihat foto.' },
        { status: 401 }
      );
    }

    // 2. Ambil URL foto dari query parameter
    const { searchParams } = new URL(request.url);
    const photoUrl = searchParams.get('url');

    if (!photoUrl) {
      return NextResponse.json({ error: 'URL foto tidak diberikan.' }, { status: 400 });
    }

    // 3. Validasi URL foto - hanya izinkan URL dari Vercel Blob atau path lokal
    const isVercelBlob = photoUrl.startsWith('https://') && photoUrl.includes('.vercel-storage.com');
    const isLocalUpload = photoUrl.startsWith('/uploads/');

    if (!isVercelBlob && !isLocalUpload) {
      return NextResponse.json({ error: 'URL foto tidak valid.' }, { status: 403 });
    }

    // 4. Fetch foto dari sumber asli
    let imageResponse;

    if (isLocalUpload) {
      // Untuk foto lokal, redirect ke path internal
      // Di production, ini seharusnya tidak terjadi karena menggunakan Vercel Blob
      return NextResponse.redirect(new URL(photoUrl, request.url));
    } else {
      // Fetch dari Vercel Blob Storage
      imageResponse = await fetch(photoUrl, {
        headers: {
          'Accept': 'image/*',
        },
      });
    }

    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // 5. Return gambar dengan header keamanan
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('API Error (Photo Proxy):', error);
    return NextResponse.json({ error: 'Gagal memuat foto.' }, { status: 500 });
  }
}
