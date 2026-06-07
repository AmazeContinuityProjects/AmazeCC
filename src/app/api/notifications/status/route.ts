import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const UserID = searchParams.get('UserID');

    if (!UserID) {
        return NextResponse.json({ error: "Missing UserID" }, { status: 400 });
    }

    try {
        const pool = getDbPool();
        const { rows } = await pool.query(
            `SELECT vitol_enabled, vitol_reminder_day, vitol_reminder_time 
             FROM push_subscriptions 
             WHERE user_id = $1 LIMIT 1`,
            [UserID]
        );

        if (rows.length === 0) {
            return NextResponse.json({
                vitol: false,
                vitol_reminder_day: 1,
                vitol_reminder_time: "10:00"
            });
        }

        return NextResponse.json({
            vitol: rows[0].vitol_enabled,
            vitol_reminder_day: rows[0].vitol_reminder_day,
            vitol_reminder_time: rows[0].vitol_reminder_time
        });
    } catch (error) {
        console.error("Status check error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
