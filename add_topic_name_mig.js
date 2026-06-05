require('dotenv').config({ path: ['.env.local', '.env'] });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await pool.query('ALTER TABLE qbank_questions ADD COLUMN IF NOT EXISTS topic_name TEXT;');
    console.log('Successfully added topic_name column!');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
