import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classes = searchParams.get('classes');
    
    if (!classes) {
      return NextResponse.json({ error: 'No classes provided' }, { status: 400 });
    }

    const classIds = classes.split(',');
    if (classIds.length === 0) {
      return NextResponse.json({ error: 'Empty classes list' }, { status: 400 });
    }

    const pool = getDbPool();

    const overallQuery = await pool.query(
      `SELECT class_id, count, mean, m2 FROM class_overall_stats WHERE class_id = ANY($1)`,
      [classIds]
    );

    const assessmentQuery = await pool.query(
      `SELECT class_id, assessment_title, count, mean, m2 FROM class_assessment_stats WHERE class_id = ANY($1)`,
      [classIds]
    );

    const result: Record<string, any> = {};

    for (const cid of classIds) {
      result[cid] = {
        overall: null,
        assessments: {}
      };
    }

    overallQuery.rows.forEach(row => {
      const { class_id, count, mean, m2 } = row;
      const sd = count > 1 ? Math.sqrt(m2 / count) : 0;
      result[class_id].overall = { count, mean, sd };
    });

    assessmentQuery.rows.forEach(row => {
      const { class_id, assessment_title, count, mean, m2 } = row;
      const sd = count > 1 ? Math.sqrt(m2 / count) : 0;
      result[class_id].assessments[assessment_title] = { count, mean, sd };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Marks stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
