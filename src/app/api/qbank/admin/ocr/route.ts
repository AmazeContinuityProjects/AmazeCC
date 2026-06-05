import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { paperId } = await req.json();
    if (!paperId) return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 });

    const pool = getDbPool();

    // Update status to processing
    await pool.query(
      `UPDATE papers_archive SET approval_status = 'OCR_PROCESSING' WHERE source_id = $1`,
      [paperId]
    );

    // SIMULATED OCR DELAY — replace with GPT-4o Vision / Mathpix in production
    await new Promise(resolve => setTimeout(resolve, 3000));

    // MOCK extracted questions
    const extractedQuestions = [
      { num: "1", text: "Solve for x: $$\\frac{d}{dx} (e^{2x} \\sin x) = 0$$", marks: 5, type: "DESCRIPTIVE" },
      { num: "2", text: "A particle moves in a circle of radius 2m. If its speed is $$v = 4t^2$$, find its tangential acceleration at $$t = 1$$s.", marks: 10, type: "NUMERICAL" },
      { num: "3", text: "What is the time complexity of QuickSort in the worst case?", marks: 2, type: "MCQ" },
    ];

    for (const q of extractedQuestions) {
      const options = q.type === "MCQ" ? JSON.stringify({ A: "$$O(n \\log n)$$", B: "$$O(n^2)$$", C: "$$O(n)$$", D: "$$O(1)$$" }) : null;
      const answer = q.type === "MCQ" ? "B" : null;

      await pool.query(
        `INSERT INTO qbank_questions (source_id, question_number, question_text, marks, question_type, options, correct_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [paperId, q.num, q.text, q.marks, q.type, options, answer]
      );
    }

    await pool.query(
      `UPDATE papers_archive SET approval_status = 'PENDING_Q_APPROVAL' WHERE source_id = $1`,
      [paperId]
    );

    return NextResponse.json({ success: true, count: extractedQuestions.length });
  } catch (error: any) {
    console.error('OCR Pipeline Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
