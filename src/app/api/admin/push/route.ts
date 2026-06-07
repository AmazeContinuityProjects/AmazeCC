import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import webpush from 'web-push';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, body: message } = body;

        if (!title || !message) {
            return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
        }

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
        const { rows } = await pool.query(
            `SELECT endpoint, p256dh, auth FROM push_subscriptions`
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: true, message: "No subscribers found." });
        }

        const payload = JSON.stringify({
            title,
            body: message,
            icon: '/icon.png', // Assuming there's a default icon in public folder
        });

        // Send to all subscribers concurrently
        const sendPromises = rows.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                }
            };
            
            return webpush.sendNotification(pushSubscription, payload).catch(err => {
                // Ignore individual errors (e.g. if a subscription has expired)
                console.error("Failed to send to endpoint", sub.endpoint, err);
                
                // Optionally: delete from db if statusCode === 410 (Gone)
                if (err.statusCode === 410) {
                    pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]).catch(console.error);
                }
            });
        });

        await Promise.allSettled(sendPromises);

        return NextResponse.json({ success: true, message: `Broadcast triggered for ${rows.length} users.` });
    } catch (error) {
        console.error("Broadcast error:", error);
        return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
    }
}
