# PostHog Data Warehouse Setup Report

Created 0 of 1 detected sources in PostHog. The MongoDB credential prompt timed out, so the source still needs browser setup.

## Changes made

- Inspected the MongoDB warehouse connector requirements.
- Confirmed that no real `MONGODB_URI` is currently set in the project's environment files; it was detected only from the documented template signal.
- Generated a secure PostHog connection page for MongoDB.
- No application source code or environment credentials were changed.

## Files created

- `docs/reports/posthog-warehouse-report.md`

## Manual step required

1. While signed in as the same PostHog user, open [Connect MongoDB securely](https://us.posthog.com/project/712727/data-warehouse/connect?kind=MongoDB).
2. Enter the MongoDB connection string and optional database name, then validate and save the connection details.
3. Ensure the database is reachable from PostHog's network; localhost and private-network hosts cannot be reached directly.
4. Return to the wizard afterward to create the source and start its table syncs. The stored credentials expire after 24 hours and are single-use.
