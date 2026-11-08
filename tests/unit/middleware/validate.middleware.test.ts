import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const { sendErrorMock } = vi.hoisted(() => ({
  sendErrorMock: vi.fn(),
}));

vi.mock("../../../src/utils/api-response.js", () => ({
  sendError: sendErrorMock,
}));

import {
  validateRequest,
  validateQuery,
} from "../../../src/middleware/validate.middleware.js";

describe("Validation Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {},
      query: {},
    };

    res = {
      locals: {},
    } as Response;

    next = vi.fn();
  });

  describe("validateRequest", () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it("should call next when request body is valid", () => {
      req.body = {
        name: "Srujan",
        age: 22,
      };

      const middleware = validateRequest(schema);

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(sendErrorMock).not.toHaveBeenCalled();
    });

    it("should replace request body with validated data", () => {
      req.body = {
        name: "Srujan",
        age: 22,
        extra: "unexpected",
      };

      const middleware = validateRequest(schema);

      middleware(req as Request, res as Response, next);

      expect(req.body).toEqual({
        name: "Srujan",
        age: 22,
      });
    });

    it("should return 400 when request body is invalid", () => {
      req.body = {
        name: "",
        age: -1,
      };

      const middleware = validateRequest(schema);

      middleware(req as Request, res as Response, next);

      expect(sendErrorMock).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: expect.any(Array),
        }),
        400,
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should include field-level validation details", () => {
      req.body = {
        name: "",
        age: -1,
      };

      const middleware = validateRequest(schema);

      middleware(req as Request, res as Response, next);

      const error = sendErrorMock.mock.calls[0][1];

      expect(error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "name",
          }),
          expect.objectContaining({
            field: "age",
          }),
        ]),
      );
    });
  });

  describe("validateQuery", () => {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    });

    it("should call next when query parameters are valid", () => {
      req.query = {
        page: "2",
        limit: "20",
      };

      const middleware = validateQuery(schema);

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(sendErrorMock).not.toHaveBeenCalled();
    });

    it("should store parsed query data in res.locals.validatedQuery", () => {
      req.query = {
        page: "2",
        limit: "20",
      };

      const middleware = validateQuery(schema);

      middleware(req as Request, res as Response, next);

      expect(res.locals?.validatedQuery).toEqual({
        page: 2,
        limit: 20,
      });
    });

    it("should apply default values to missing query parameters", () => {
      req.query = {};

      const middleware = validateQuery(schema);

      middleware(req as Request, res as Response, next);

      expect(res.locals?.validatedQuery).toEqual({
        page: 1,
        limit: 10,
      });
    });

    it("should return 400 when query parameters are invalid", () => {
      req.query = {
        page: "-1",
        limit: "200",
      };

      const middleware = validateQuery(schema);

      middleware(req as Request, res as Response, next);

      expect(sendErrorMock).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          code: "VALIDATION_ERROR",
          message: "Query validation failed",
          details: expect.any(Array),
        }),
        400,
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should not set validatedQuery when validation fails", () => {
      req.query = {
        page: "invalid",
      };

      const middleware = validateQuery(schema);

      middleware(req as Request, res as Response, next);

      expect(res.locals?.validatedQuery).toBeUndefined();
    });
  });
});
