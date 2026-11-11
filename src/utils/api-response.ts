import type { Response } from "express";

import type {
  ApiErrorPayload,
  SuccessResponse,
} from "../types/api-response.type.js";

export function sendSuccess<T>(
  res: Response,
  options: SuccessResponse<T>,
  statusCode = 200,
): void {
  switch (options.type) {
    case "resource":
      res.status(statusCode).json(options.data);
      return;

    case "list":
      res.status(statusCode).json({
        success: true,
        data: options.data,
        pagination: options.pagination,
      });
      return;

    case "message":
      res.status(statusCode).json({ message: options.message });
      return;
  }
}

export function sendError(
  res: Response,
  error: ApiErrorPayload,
  statusCode = 500,
): void {
  res.status(statusCode).json({
    success: false,
    error,
  });
}
