import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/qbank/questions?course=CSE1001
export async function GET(req: NextRequest) {
  try {
    const courseCode = req.nextUrl.searchParams.get('course');
    if (!courseCode) {
      return NextResponse.json({ success: false, error: 'course param required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT q.*, p.source_type, p.exam_semester, p.exam_year 
       FROM qbank_questions q
       JOIN papers_archive p ON q.source_id = p.source_id
       WHERE p.course_code = $1 AND p.approval_status = 'APPROVED'
       ORDER BY q.question_number`,
      [courseCode]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Questions fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
