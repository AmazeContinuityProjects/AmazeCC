import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// We use the Supabase Storage REST API for uploads, server-side
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST /api/qbank/upload
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { courseCode, title, paperType, examYear, examSemester, uploaderRegNo, fileUrl, isAdmin } = json;

    if (!courseCode || !title || !fileUrl) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // All uploads go to PENDING now, even if admin
    const status = 'PENDING';

    // Insert into database via pg pool
    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO papers_archive (course_code, title, source_type, exam_year, exam_semester, file_url, uploader_reg_no, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING source_id`,
      [courseCode, title, paperType || 'CAT 1', parseInt(examYear) || new Date().getFullYear(), examSemester || 'Fall', fileUrl, uploaderRegNo || 'anonymous', status]
    );

    return NextResponse.json({ success: true, sourceId: rows[0].source_id });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
