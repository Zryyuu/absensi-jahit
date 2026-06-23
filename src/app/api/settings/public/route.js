import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      success: true,
      employees: (settings.employees || []).map(emp => typeof emp === 'string' ? emp : emp.name),
      lateTime: settings.lateTime || '08:15',
    });
  } catch (error) {
    console.error('API Error (Get Public Settings):', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat data.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
