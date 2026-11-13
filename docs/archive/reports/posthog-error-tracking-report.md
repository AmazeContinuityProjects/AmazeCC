---
title: "PostHog Error Tracking"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# PostHog Error Tracking

> ⚠️ **Needs your attention**
>
> - Add the `POSTHOG_API_KEY` GitHub Actions secret and the `POSTHOG_PROJECT_ID` and `POSTHOG_HOST` repository variables before the next production deployment.
> - If Vercel is an active production deployment path, add the same three variables to the Vercel project's Production build environment, keeping `POSTHOG_API_KEY` sensitive.

## What error tracking does now

Client-side unhandled errors are captured automatically by the PostHog browser SDK through exception autocapture. Errors handled by Next.js error boundaries are explicitly sent with `posthog.captureException(error)` from:

- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `instrumentation-client.ts` (browser exception autocapture configuration)

The app is a static export, so there is no deployed Next.js server runtime requiring server-side error capture. PostHog is already initialized for the client; no additional PostHog SDK dependency was needed for exception capture.

Source-map upload is wired through the Next.js configuration and CI workflows. The changed files are:

- `next.config.mjs`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.github/workflows/ci.yaml`
- `.github/workflows/nextjs.yml`

The exact production build command is `pnpm run build`. Every production build using the configured credentials uploads source maps to PostHog. Upload is guarded by `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID`, so builds without those values continue without uploading.

## What you still need to do

1. The local source-map upload key is already configured in `.env`; no new key is needed for local builds. If you need to create or rotate one, use the [PostHog source-map key page](https://us.posthog.com/source-maps-key) with the Source map upload preset.
2. In GitHub repository **Settings → Secrets and variables → Actions**, create the secret `POSTHOG_API_KEY` and repository variables `POSTHOG_PROJECT_ID` and `POSTHOG_HOST`. These are consumed by the `pnpm run build` steps in `.github/workflows/ci.yaml` and `.github/workflows/nextjs.yml`. Use project ID `712727` for `POSTHOG_PROJECT_ID` and the configured PostHog host for `POSTHOG_HOST`.
3. If Vercel deployments are active, add `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, and `POSTHOG_HOST` to the Vercel project's **Production** build environment. Keep `POSTHOG_API_KEY` as a secret. The checked-in repository does not expose a safe way to configure those provider-side values.

## Verification

The finished production build command was `pnpm build` (equivalent to the configured production build) and it passed. It created release `AmazeCC@7fe078d` and uploaded source-map batches containing 102 and 160 chunks. The first symbol set is already in PostHog. Verification reused the successful build from the configuration task rather than running a second build.

To verify end to end, trigger an error and view it at [PostHog Error Tracking](https://us.posthog.com/project/712727/error_tracking). Uploaded symbol sets are listed at [Error Tracking configuration](https://us.posthog.com/project/712727/error_tracking/configuration).

Local runs, tests, and pull-request builds are unchanged. This setup has no release-linking step; production exceptions are captured and symbolized when the production build's upload variables are present, but no separate `POSTHOG_RELEASE_ID` is injected by this workflow.
