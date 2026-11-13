# Notifications — Data Model

`PushSubscription = { endpoint, keys: { p256dh, auth }, userId? }` (server-side; never shipped client-side).
`NotificationPreferences = { category flags, quietHours: { start, end }, muteUntil? }`.
