import type { ErrorRequestHandler } from "express";

import { logger } from "../lib/logger.js";
import { AppError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    sendError(
      res,
      {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
      error.statusCode,
    );
    return;
  }

  logger.error({ err: error }, "Unhandled application error");

  sendError(res, {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
};
