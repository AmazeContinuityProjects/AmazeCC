import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST — run all migrations (buses + Q-Bank tables)
export async function POST() {
  try {
    const pool = getDbPool();

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
    }

    const sql = `
      -- Buses table
      CREATE TABLE IF NOT EXISTS buses (
        id SERIAL PRIMARY KEY,
        type TEXT,
        route TEXT,
        boarding_points JSONB,
        driver_phone TEXT,
        driver_name TEXT,
        whatsapp_group TEXT,
        bus_location TEXT
      );

      -- Papers archive
      CREATE TABLE IF NOT EXISTS papers_archive (
        source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_code TEXT,
        title TEXT,
        source_type TEXT,
        exam_year INT,
        file_url TEXT,
        uploader_reg_no TEXT,
        approval_status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- Extracted questions
      CREATE TABLE IF NOT EXISTS qbank_questions (
        question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID REFERENCES papers_archive(source_id) ON DELETE CASCADE,
        question_number TEXT,
        question_text TEXT,
        image_url TEXT,
        question_type TEXT,
        options JSONB,
        correct_answer TEXT,
        marks INT
      );

      -- Topics / course objectives
      CREATE TABLE IF NOT EXISTS qbank_topics (
        topic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_code TEXT,
        topic_name TEXT
      );

      -- Junction table
      CREATE TABLE IF NOT EXISTS qbank_question_topics (
        question_id UUID REFERENCES qbank_questions(question_id) ON DELETE CASCADE,
        topic_id UUID REFERENCES qbank_topics(topic_id) ON DELETE CASCADE,
        PRIMARY KEY(question_id, topic_id)
      );
    `;

    await pool.query(sql);

    return NextResponse.json({ success: true, message: 'All tables created: buses, papers_archive, qbank_questions, qbank_topics, qbank_question_topics' });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — health check: DB connectivity + list tables
export async function GET() {
  try {
    const pool = getDbPool();

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ connected: false, error: 'DATABASE_URL not set' });
    }

    const { rows } = await pool.query("SELECT NOW() as time, current_database() as db");

    const { rows: tables } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    return NextResponse.json({
      connected: true,
      db: rows[0].db,
      serverTime: rows[0].time,
      tables: tables.map(t => t.table_name),
    });
  } catch (error: any) {
    console.error('DB check failed:', error);
    return NextResponse.json({ connected: false, error: error.message });
  }
}
