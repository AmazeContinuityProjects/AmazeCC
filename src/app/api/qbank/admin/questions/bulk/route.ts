import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get('admin_auth')?.value !== 'true') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { paperId, questions } = await req.json();

    if (!paperId || !Array.isArray(questions)) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing questions for this paper
      await client.query('DELETE FROM qbank_questions WHERE source_id = $1', [paperId]);

      // Insert new questions
      for (const q of questions) {
        await client.query(
          `INSERT INTO qbank_questions (source_id, question_number, question_type, topic_name, marks, question_text, options, correct_answer, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            paperId,
            q.question_number?.toString() || '1',
            q.question_type || (q.options && Object.keys(q.options).length > 0 ? 'MCQ' : 'DESCRIPTIVE'),
            q.topic_name || null,
            parseInt(q.marks) || 0,
            q.question_text || '',
            q.options ? JSON.stringify(q.options) : null,
            q.correct_answer || null,
            q.image_url || null
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, count: questions.length });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Bulk questions import error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
