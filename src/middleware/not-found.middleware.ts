import type { RequestHandler } from "express";
import { sendError } from "../utils/api-response.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, { code: "INVALID_REQUEST", message: "Route not found!" }, 404);
};
