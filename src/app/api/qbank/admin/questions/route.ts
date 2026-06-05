import { NextResponse, NextRequest } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/qbank/admin/questions?paperId=xxx
export async function GET(req: NextRequest) {
  try {
    const paperId = req.nextUrl.searchParams.get('paperId');
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM qbank_questions WHERE source_id = $1 ORDER BY question_number ASC`,
      [paperId]
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/qbank/admin/questions — add a new question
export async function POST(req: NextRequest) {
  try {
    const { paperId } = await req.json();
    if (!paperId) return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });

    const pool = getDbPool();
    const { rows } = await pool.query(
      `INSERT INTO qbank_questions (source_id, question_number, question_text, marks, question_type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [paperId, 'New', 'Enter question text here...', 0, 'DESCRIPTIVE']
    );
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/qbank/admin/questions — update a question
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId } = body;
    if (!questionId) return NextResponse.json({ success: false, error: 'questionId required' }, { status: 400 });

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const addUpdate = (field: string, value: any) => {
      updates.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    };

    if ('questionText' in body) addUpdate('question_text', body.questionText);
    if ('questionNumber' in body) addUpdate('question_number', body.questionNumber);
    if ('marks' in body) addUpdate('marks', body.marks);
    if ('questionType' in body) addUpdate('question_type', body.questionType);
    if ('options' in body) addUpdate('options', body.options ? JSON.stringify(body.options) : null);
    if ('correctAnswer' in body) addUpdate('correct_answer', body.correctAnswer);
    if ('imageUrl' in body) addUpdate('image_url', body.imageUrl);

    if (updates.length === 0) return NextResponse.json({ success: true });

    values.push(questionId);
    const query = `UPDATE qbank_questions SET ${updates.join(', ')} WHERE question_id = $${paramIndex}`;

    const pool = getDbPool();
    await pool.query(query, values);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/qbank/admin/questions — delete a question
export async function DELETE(req: NextRequest) {
  try {
    const { questionId } = await req.json();
    if (!questionId) return NextResponse.json({ success: false, error: 'questionId required' }, { status: 400 });

    const pool = getDbPool();
    await pool.query(`DELETE FROM qbank_questions WHERE question_id = $1`, [questionId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
