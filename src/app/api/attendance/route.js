import { NextResponse } from 'next/server';
import { uploadPhoto, saveAttendance } from '@/lib/db';

// Rumus Haversine untuk menghitung jarak antara 2 koordinat (dalam meter)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Jari-jari bumi dalam meter
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Hasil dalam meter
}

// Koordinat Kantor (8°09'08.6"S 113°26'29.2"E)
const TARGET_LAT = -8.1523889;
const TARGET_LON = 113.4414444;
const MAX_RADIUS_METERS = 100; // Radius toleransi 100 meter

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, photo, latitude, longitude } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama karyawan wajib diisi.' }, { status: 400 });
    }

    if (!photo) {
      return NextResponse.json({ error: 'Foto absensi wajib diambil.' }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return NextResponse.json({ 
        error: 'Izin lokasi diperlukan. Gagal mendeteksi lokasi GPS Anda.' 
      }, { status: 400 });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ error: 'Format koordinat lokasi GPS tidak valid.' }, { status: 400 });
    }

    // Hitung jarak dari kantor
    const distance = getDistance(lat, lon, TARGET_LAT, TARGET_LON);

    if (distance > MAX_RADIUS_METERS) {
      return NextResponse.json({
        error: `Anda berada di luar area kantor. Jarak Anda: ${Math.round(distance)} meter dari kantor (maksimal toleransi ${MAX_RADIUS_METERS} meter).`
      }, { status: 400 });
    }

    // 1. Unggah foto (ke Vercel Blob atau ke folder lokal public/uploads)
    const photoUrl = await uploadPhoto(photo);

    // 2. Simpan data absensi dengan koordinat dan jarak
    const record = await saveAttendance(
      name.trim(), 
      photoUrl, 
      lat, 
      lon, 
      Math.round(distance)
    );

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error) {
    console.error('API Error (Attendance):', error);
    return NextResponse.json(
      { error: `Gagal memproses absensi: ${error.message || error.toString()}` },
      { status: 500 }
    );
  }
}
