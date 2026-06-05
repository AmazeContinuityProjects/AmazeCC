const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query(`ALTER TABLE papers_archive ADD COLUMN IF NOT EXISTS exam_semester TEXT;`);
    console.log("Successfully added exam_semester column!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
