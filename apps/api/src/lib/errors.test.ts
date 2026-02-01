import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import {
  errorResponse,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from "./errors";
import { logger } from "./logging";

describe("errorResponse", () => {
  let warnSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warnSpy = spyOn(logger, "warn").mockImplementation(() => {});
    errorSpy = spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  function createContext(path = "/test", method = "GET") {
    // Return a mock context with necessary properties
    return {
      get: (key: string) => (key === "requestId" ? "test-request-id" : undefined),
      req: { path, method },
      json: mock((body: unknown, status?: number) => {
        return new Response(JSON.stringify(body), { status: status ?? 200 });
      }),
    } as unknown as Parameters<typeof errorResponse>[0];
  }

  describe("AppError logging", () => {
    it("should log NotFoundError at warn level", () => {
      const c = createContext("/api/components/123", "GET");
      const error = new NotFoundError("Component not found");

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "NotFoundError: Component not found",
        expect.objectContaining({
          requestId: "test-request-id",
          path: "/api/components/123",
          method: "GET",
          statusCode: 404,
          errorCode: "NOT_FOUND",
          errorName: "NotFoundError",
        })
      );
    });

    it("should log ValidationError at warn level", () => {
      const c = createContext("/api/components", "POST");
      const error = new ValidationError("Name is required");

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "ValidationError: Name is required",
        expect.objectContaining({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
        })
      );
    });

    it("should log UnauthorizedError at warn level", () => {
      const c = createContext("/api/admin/components", "GET");
      const error = new UnauthorizedError("Invalid API key");

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "UnauthorizedError: Invalid API key",
        expect.objectContaining({
          statusCode: 401,
          errorCode: "UNAUTHORIZED",
        })
      );
    });

    it("should log ConflictError at warn level", () => {
      const c = createContext("/api/components", "POST");
      const error = new ConflictError("Component already exists");

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "ConflictError: Component already exists",
        expect.objectContaining({
          statusCode: 409,
          errorCode: "CONFLICT",
        })
      );
    });

    it("should return correct JSON response for AppError", () => {
      const c = createContext();
      const error = new NotFoundError("Resource not found");

      errorResponse(c, error);

      expect(c.json).toHaveBeenCalledWith(
        { error: { message: "Resource not found", code: "NOT_FOUND" } },
        404
      );
    });
  });

  describe("Postgres error logging", () => {
    it("should log unique constraint violation at warn level", () => {
      const c = createContext("/api/components", "POST");
      const error = { code: "23505", detail: "Key (slug)=(test) already exists" };

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "Database conflict: unique constraint violation",
        expect.objectContaining({
          statusCode: 409,
          errorCode: "CONFLICT",
          pgCode: "23505",
          detail: "Key (slug)=(test) already exists",
        })
      );
    });

    it("should log foreign key violation at warn level", () => {
      const c = createContext("/api/monitors", "POST");
      const error = { code: "23503", detail: "Key (component_id)=(123) is not present" };

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "Database error: foreign key violation",
        expect.objectContaining({
          statusCode: 400,
          errorCode: "FOREIGN_KEY_VIOLATION",
          pgCode: "23503",
        })
      );
    });
  });

  describe("Zod validation error logging", () => {
    it("should log Zod validation errors at warn level", () => {
      const c = createContext("/api/components", "POST");
      const error = {
        issues: [
          { path: ["name"], message: "Required" },
          { path: ["status"], message: "Invalid enum value" },
        ],
      };

      errorResponse(c, error);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "Validation error: name: Required, status: Invalid enum value",
        expect.objectContaining({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          validationErrors: error.issues,
        })
      );
    });
  });

  describe("Unhandled error logging", () => {
    it("should log unhandled errors at error level", () => {
      const c = createContext("/api/test", "GET");
      const error = new Error("Something went wrong");
      error.stack = "Error: Something went wrong\n    at test.ts:1:1";

      errorResponse(c, error);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Unhandled error",
        expect.objectContaining({
          requestId: "test-request-id",
          path: "/api/test",
          method: "GET",
          errorName: "Error",
          stack: expect.stringContaining("Something went wrong"),
        })
      );
    });

    it("should return 500 status for unhandled errors", () => {
      const c = createContext();
      const error = new Error("Unexpected error");

      errorResponse(c, error);

      expect(c.json).toHaveBeenCalledWith(
        { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
        500
      );
    });

    it("should handle non-Error objects gracefully", () => {
      const c = createContext();
      const error = "string error";

      errorResponse(c, error);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Unhandled error",
        expect.objectContaining({
          errorName: "Unknown",
        })
      );
    });
  });
});
