import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/qbank/admin/publish — approve paper and make questions live
export async function POST(req: Request) {
  try {
    const { paperId } = await req.json();
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const pool = getDbPool();
    await pool.query(
      `UPDATE papers_archive SET approval_status = 'APPROVED' WHERE source_id = $1`,
      [paperId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
