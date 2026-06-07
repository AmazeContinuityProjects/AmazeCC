import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { UserID, subscription, vitol_enabled, vitol_reminder_day, vitol_reminder_time } = body;

        if (!UserID || !subscription || !subscription.endpoint) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const pool = getDbPool();

        // Upsert into push_subscriptions
        await pool.query(
            `INSERT INTO push_subscriptions 
                (user_id, endpoint, p256dh, auth, vitol_enabled, vitol_reminder_day, vitol_reminder_time, updated_at) 
             VALUES 
                ($1, $2, $3, $4, $5, $6, $7, now())
             ON CONFLICT (endpoint) 
             DO UPDATE SET 
                user_id = EXCLUDED.user_id,
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth,
                vitol_enabled = EXCLUDED.vitol_enabled,
                vitol_reminder_day = EXCLUDED.vitol_reminder_day,
                vitol_reminder_time = EXCLUDED.vitol_reminder_time,
                updated_at = now()`,
            [
                UserID, 
                subscription.endpoint, 
                subscription.keys?.p256dh || '', 
                subscription.keys?.auth || '',
                !!vitol_enabled,
                vitol_reminder_day ?? null,
                vitol_reminder_time || null
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Subscribe error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
