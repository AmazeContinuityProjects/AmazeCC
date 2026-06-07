import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { UserID, endpoint } = body;

        if (!UserID || !endpoint) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const pool = getDbPool();

        await pool.query(
            `DELETE FROM push_subscriptions WHERE endpoint = $1`,
            [endpoint]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Unsubscribe error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
