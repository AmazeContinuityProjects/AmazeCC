import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signAdminToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password required" }, { status: 400 });
        }

        // 1. Verify credentials against VTOP (via our backend)
        const loginRes = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (!loginRes.ok) {
            return NextResponse.json({ error: "Invalid VTOP Credentials or VTOP is down" }, { status: 401 });
        }

        // 2. Check against VIP list
        const adminIdsEnv = process.env.ADMIN_VTOP_IDS || "";
        const adminIds = adminIdsEnv.split(',').map(id => id.trim().toUpperCase());
        
        if (!adminIds.includes(username.toUpperCase())) {
            return NextResponse.json({ error: "Access Denied: You are not an authorized administrator." }, { status: 403 });
        }

        // 3. Generate signed token
        const token = signAdminToken(username.toUpperCase());

        // 4. Set HTTP-only cookie
        const cookieStore = await cookies();
        cookieStore.set('admin_auth', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return NextResponse.json({ success: true, username: username.toUpperCase() });

    } catch (err: any) {
        console.error("Admin auth error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
