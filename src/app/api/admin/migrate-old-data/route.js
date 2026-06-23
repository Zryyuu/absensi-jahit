import { NextResponse } from 'next/server';
import { getAttendanceRecords, saveAllRecords, saveSettings } from '@/lib/db';

export async function GET() {
  try {
    // 1. Ambil semua data absensi
    const records = await getAttendanceRecords();
    
    // 2. Pemetaan nama lama ke nama baru yang bersih
    const nameMapping = {
      'wahyudi': 'Yudhi',
      'varel': 'Farel',
      'muhammad rizki': 'Riski',
      'achzulfiki': 'Fiki',
      'miftahul jannah': 'Mitha',
      'faizzatur rohmah': 'Izah',
      'adellia seftia ramdhani': 'Adel'
    };
    
    let updatedCount = 0;
    const updatedRecords = records.map(rec => {
      const key = rec.name.trim().toLowerCase();
      if (nameMapping[key]) {
        updatedCount++;
        return { ...rec, name: nameMapping[key] };
      }
      return rec;
    });
    
    // 3. Simpan kembali seluruh record ke database
    await saveAllRecords(updatedRecords);
    
    // 4. Inisialisasi/simpan 10 nama karyawan resmi ke tabel pengaturan database
    const officialSettings = {
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
    await saveSettings(officialSettings);
    
    return NextResponse.json({
      success: true,
      message: 'Migrasi data dan inisialisasi pengaturan berhasil!',
      details: {
        totalRecords: records.length,
        updatedRecordsCount: updatedCount,
        settingsInitialized: true,
        mappedNames: Object.keys(nameMapping)
      }
    });
  } catch (error) {
    console.error('Migration Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
