import pino from "pino";

import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,

  base: {
    service: "transaction-webhook-service",
    environment: env.NODE_ENV,
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});
