import type { ErrorCode } from "../constants/error-codes.js";
import type { ApiErrorDetail } from "../types/api-response.type.js";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode = "INTERNAL_SERVER_ERROR",
    public readonly statusCode: number = 500,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
  }
}
