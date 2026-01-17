import pino from "pino"

// Sensitive fields to redact from logs
const REDACT_PATHS = [
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.clientSecret",
  "*.stripe_payment_intent",
  "*.email",
  "*.phone",
  "*.plate",
  "*.customer_email",
  "*.customer_phone",
  "*.customer_plate",
  "*.purchaserEmail",
  "*.vehiclePlate",
]

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  browser: {
    asObject: true,
  },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

export default logger
