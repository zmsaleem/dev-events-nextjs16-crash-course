import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!token || !host) {
    if (process.env.NODE_ENV !== "production") {
      const missingVariable = !token
        ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "NEXT_PUBLIC_POSTHOG_HOST"

      console.warn(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
      )
    }
    return
  }

  const posthogLoggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "devevents-web",
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host.replace(/\/$/, "")}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      }),
    ],
  })
  const posthogLogger = posthogLoggerProvider.getLogger("posthog-log-capture")

  posthogLogger.emit({
    body: "PostHog log capture initialized",
    severityText: "INFO",
    attributes: {
      event: "posthog_log_capture_initialized",
      runtime: "nodejs",
    },
  })
}
