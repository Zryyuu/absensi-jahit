import { NextResponse } from 'next/server';
import { getAttendanceRecords } from '@/lib/db';

export async function GET() {
  try {
    const records = await getAttendanceRecords();
    return NextResponse.json({
      records: records.map(r => ({
        id: r.id,
        name: r.name,
        nameLength: r.name?.length,
        timestamp: r.timestamp
      }))
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
