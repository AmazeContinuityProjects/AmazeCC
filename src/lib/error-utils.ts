import { isPostHogConfigured, posthog } from "./posthog";

type ErrorLevel = "silent" | "log" | "warn" | "error";

export interface ReportErrorOptions {
  level?: ErrorLevel;
  userMessage?: string;
  context?: string;
}

export function reportError(err: unknown, options: ReportErrorOptions = {}): void {
  const { level = "error", userMessage, context } = options;
  const prefix = context ? `[${context}]` : "";
  const message = err instanceof Error ? err.message : String(err);

  switch (level) {
    case "silent":
      break;
    case "log":
      console.log(`${prefix} ${message}`, err);
      break;
    case "warn":
      console.warn(`${prefix} ${message}`, err);
      if (isPostHogConfigured()) {
        try {
          posthog.capture("app_warning", { message, context, userMessage });
        } catch {}
      }
      break;
    case "error":
    default:
      console.error(`${prefix} ${message}`, err);
      if (isPostHogConfigured()) {
        try {
          posthog.captureException(err, {
            extra: { context, userMessage, level },
          });
        } catch {}
      }
      break;
  }

  if (userMessage) {
    // Could integrate with a toast/notification system here
  }
}
