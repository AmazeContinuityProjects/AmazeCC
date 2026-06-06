import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function POST(req: Request) {
  const pool = getDbPool();

  try {
    const body = await req.json();
    
    if (!body || !body.actions || !Array.isArray(body.actions) || !body.userHash || !body.timestamp) {
      console.log("Sync 400: Invalid payload format");
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    const { actions, userHash, timestamp } = body;
    const clientTimestamp = Number(timestamp);

    // Limit actions per request
    if (actions.length > 500) {
      console.log("Sync 400: Too many actions (" + actions.length + ")");
      return NextResponse.json({ error: "Too many actions" }, { status: 400 });
    }

    for (const action of actions) {
      const { type, classId, assessmentTitle, mark, oldMark } = action;

      if (typeof mark !== 'number' || mark < 0 || mark > 100) continue;
      if (!classId || typeof classId !== 'string') continue;
      if (!assessmentTitle || typeof assessmentTitle !== 'string') continue;

      const title = assessmentTitle === 'OVERALL' ? 'overall' : assessmentTitle;

      // Honor system timestamp check
      const { rows: existingHashes } = await pool.query(
        `SELECT last_updated_at FROM class_user_hashes WHERE class_id = $1 AND user_hash = $2`,
        [classId, userHash]
      );
      
      const existingHash = existingHashes.length > 0 ? existingHashes[0] : null;

      if (existingHash) {
        if (type === 'add') continue;
        if (type === 'update' && clientTimestamp < Number(existingHash.last_updated_at) - 30000) {
          continue;
        }
      } else {
        if (type === 'update') action.type = 'add';
      }

      // Record/update the hash timestamp
      await pool.query(
        `INSERT INTO class_user_hashes (class_id, user_hash, last_updated_at) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (class_id, user_hash) 
         DO UPDATE SET last_updated_at = EXCLUDED.last_updated_at`,
        [classId, userHash, clientTimestamp]
      );

      // Welford's update logic
      if (title === 'overall') {
        const { rows: statsRows } = await pool.query(
            `SELECT count, mean, m2 FROM class_overall_stats WHERE class_id = $1`,
            [classId]
        );
        let count = statsRows.length > 0 ? Number(statsRows[0].count) : 0;
        let mean = statsRows.length > 0 ? Number(statsRows[0].mean) : 0;
        let m2 = statsRows.length > 0 ? Number(statsRows[0].m2) : 0;

        if (action.type === 'update' && oldMark !== undefined) {
          if (count > 0) {
              const deltaRemove = oldMark - mean;
              mean -= deltaRemove / count;
              m2 -= deltaRemove * (oldMark - mean);
              count -= 1;
          }
        }

        count += 1;
        const deltaAdd = mark - mean;
        mean += deltaAdd / count;
        m2 += deltaAdd * (mark - mean);

        await pool.query(
            `INSERT INTO class_overall_stats (class_id, count, mean, m2) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (class_id) 
             DO UPDATE SET count = EXCLUDED.count, mean = EXCLUDED.mean, m2 = EXCLUDED.m2`,
            [classId, count, mean, m2]
        );
      } else {
        const { rows: statsRows } = await pool.query(
            `SELECT count, mean, m2 FROM class_assessment_stats WHERE class_id = $1 AND assessment_title = $2`,
            [classId, title]
        );
        let count = statsRows.length > 0 ? Number(statsRows[0].count) : 0;
        let mean = statsRows.length > 0 ? Number(statsRows[0].mean) : 0;
        let m2 = statsRows.length > 0 ? Number(statsRows[0].m2) : 0;

        if (action.type === 'update' && oldMark !== undefined) {
          if (count > 0) {
              const deltaRemove = oldMark - mean;
              mean -= deltaRemove / count;
              m2 -= deltaRemove * (oldMark - mean);
              count -= 1;
          }
        }

        count += 1;
        const deltaAdd = mark - mean;
        mean += deltaAdd / count;
        m2 += deltaAdd * (mark - mean);

        await pool.query(
            `INSERT INTO class_assessment_stats (class_id, assessment_title, count, mean, m2) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (class_id, assessment_title) 
             DO UPDATE SET count = EXCLUDED.count, mean = EXCLUDED.mean, m2 = EXCLUDED.m2`,
            [classId, title, count, mean, m2]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
