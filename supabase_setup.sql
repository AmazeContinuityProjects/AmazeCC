-- Enable the required extensions for cron jobs and HTTP requests
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create the push subscriptions table
create table if not exists push_subscriptions (
    id bigint primary key generated always as identity,
    user_id text not null,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    vitol_enabled boolean default false,
    vitol_reminder_day integer, -- 0 (Sun) to 6 (Sat)
    vitol_reminder_time time, -- e.g., '10:00:00'
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Note: Because you are inserting securely via your Next.js backend with a service role key / Postgres connection pool,
-- you DO NOT need to enable Row Level Security (RLS) for the client. The frontend will hit your secure /api route.

-- Schedule the pg_cron job to trigger the Next.js API every 5 minutes
-- Replace YOUR_VERCEL_URL with your actual production URL when deployed
-- This calls the secure cron endpoint to dispatch Vitol Reminders
select cron.schedule(
    'vitol-reminders-cron', -- Job name
    '*/5 * * * *',          -- Every 5 minutes
    $$
    select net.http_post(
        url := 'https://amazecc.vercel.app/api/cron/reminders',
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
    $$
);
