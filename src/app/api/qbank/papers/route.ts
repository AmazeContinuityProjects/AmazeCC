import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/qbank/papers?course=CSE1001
export async function GET(req: NextRequest) {
  try {
    const courseCode = req.nextUrl.searchParams.get('course');
    if (!courseCode) {
      return NextResponse.json({ success: false, error: 'course param required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE course_code = $1 AND approval_status = 'APPROVED' ORDER BY created_at DESC`,
      [courseCode]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Papers fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
