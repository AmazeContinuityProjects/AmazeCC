import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://shoot.amazecc.com";
    const posthogKey =
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "phc_obkUKCrFiFpJGfqSbx9LsJzmZDNdzdHhvpSFDhxSwGUt";
    const serviceName = process.env.POSTHOG_SERVICE_NAME || "my-nextjs-app";

    const exporter = new OTLPLogExporter({
      url: `${posthogHost.replace(/\/+$/, "")}/i/v1/logs`,
      headers: {
        Authorization: `Bearer ${posthogKey}`,
      },
    });

    const loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        "service.name": serviceName,
      }),
      processors: [new SimpleLogRecordProcessor({ exporter })],
    });

    // make the logger available globally
    (globalThis as any).__posthogLogger = loggerProvider.getLogger(serviceName);
  }
}
