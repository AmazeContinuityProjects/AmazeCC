import { SeverityNumber, type Logger } from "@opentelemetry/api-logs";

/**
 * Returns the global OpenTelemetry PostHog logger configured in instrumentation.ts
 */
export function getPostHogServerLogger(): Logger | undefined {
  return (globalThis as unknown as { __posthogLogger?: Logger }).__posthogLogger;
}

export interface PostHogLogEvent {
  body: string;
  severityNumber?: SeverityNumber;
  severityText?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
}

/**
 * Emit a structured log directly to PostHog via the global OpenTelemetry logger.
 */
export function logToPostHog({
  body,
  severityNumber = SeverityNumber.INFO,
  severityText = "INFO",
  attributes = {},
}: PostHogLogEvent): void {
  const logger = getPostHogServerLogger();
  if (!logger) return;

  logger.emit({
    severityNumber,
    severityText,
    body,
    attributes: attributes as Record<string, string | number | boolean>,
  });
}
