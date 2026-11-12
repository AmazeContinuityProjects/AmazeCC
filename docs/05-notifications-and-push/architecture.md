# Notifications — Architecture

Web Push (VAPID): service worker push handler → browser notification; subscriptions stored server-side (`push_subscriptions` table, sql/supabase_setup.sql). Quiet hours enforced client-side for scheduling + server-side for delivery windows (dual check).
In-app banners reuse the toast system for zero-config visibility. Fallback: in-app toast only (no push permission).
