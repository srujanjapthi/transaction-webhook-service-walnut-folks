import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { sendError } from "../utils/api-response.js";

export function validateRequest(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      sendError(
        res,
        {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
        },
        400,
      );
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      sendError(
        res,
        {
          code: "VALIDATION_ERROR",
          message: "Query validation failed",
          details: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
        },
        400,
      );
      return;
    }

    res.locals.validatedQuery = result.data;
    next();
  };
}
