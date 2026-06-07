import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import webpush from 'web-push';

export async function POST(req: NextRequest) {
    try {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.error("VAPID keys not configured");
            return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
        }

        webpush.setVapidDetails(
            'mailto:support@uni-cc.site',
            vapidPublicKey,
            vapidPrivateKey
        );

        const pool = getDbPool();
        
        // Find users whose scheduled time falls within the last 6 minutes in IST
        const { rows } = await pool.query(
            `SELECT endpoint, p256dh, auth, user_id 
             FROM push_subscriptions 
             WHERE vitol_enabled = true 
               AND vitol_reminder_day = EXTRACT(DOW FROM NOW() AT TIME ZONE 'Asia/Kolkata')
               AND vitol_reminder_time >= (NOW() AT TIME ZONE 'Asia/Kolkata' - INTERVAL '6 minutes')::time 
               AND vitol_reminder_time <= (NOW() AT TIME ZONE 'Asia/Kolkata')::time`
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: true, message: "No reminders due at this time." });
        }

        const payload = JSON.stringify({
            title: "VITOL Course Reminder",
            body: "You have a scheduled VITOL class starting now. Tap here to open.",
            icon: '/icon.png', 
            data: { url: "https://vitolcc.vit.ac.in/" }
        });

        const sendPromises = rows.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                }
            };
            
            return webpush.sendNotification(pushSubscription, payload).catch(err => {
                console.error("Failed to send reminder to endpoint", sub.endpoint, err);
                if (err.statusCode === 410) {
                    pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]).catch(console.error);
                }
            });
        });

        await Promise.allSettled(sendPromises);

        return NextResponse.json({ success: true, message: `Reminders sent to ${rows.length} users.` });
    } catch (error) {
        console.error("Cron Reminder error:", error);
        return NextResponse.json({ error: "Failed to run cron" }, { status: 500 });
    }
}
