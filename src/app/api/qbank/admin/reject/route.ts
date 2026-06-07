import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { isAdminAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/qbank/admin/reject — reject a paper
export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { paperId } = await req.json();
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const pool = getDbPool();
    await pool.query(
      `UPDATE papers_archive SET approval_status = 'REJECTED' WHERE source_id = $1`,
      [paperId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
