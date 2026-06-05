import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/qbank/admin/queue — fetch all pending papers
export async function GET() {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE approval_status IN ('PENDING', 'OCR_PROCESSING', 'PENDING_Q_APPROVAL') ORDER BY created_at DESC`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
