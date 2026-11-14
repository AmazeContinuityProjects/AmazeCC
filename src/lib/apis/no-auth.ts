/**
 * Operations the AmazeCC hosts serve without transport-attached credentials.
 *
 * Callers send these with `auth: "none"`: the sign-ins carry the username and
 * password in the body, the Event Hub reads carry their own `jsessionid`, and
 * the rest are public. The registry only routes a no-auth call to a route
 * marked `auth: "none"`, so a mount that serves one of these must mark it.
 * The value is the HTTP method, because the mount's method wins over the
 * caller's.
 */
export const NO_AUTH_OPERATIONS: ReadonlyMap<string, "GET" | "POST"> = new Map<string, "GET" | "POST">([
  ["login", "POST"],
  ["events/login", "POST"],
  ["events/profile", "POST"],
  ["events", "GET"],
  ["notifications/subscribe", "POST"],
]);
