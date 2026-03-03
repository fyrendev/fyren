import type { Context } from "hono";
import { logger } from "./logging";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(404, message, code);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(401, message, code);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(403, message, code);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", code = "VALIDATION_ERROR") {
    super(400, message, code);
    this.name = "ValidationError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", code = "BAD_REQUEST") {
    super(400, message, code);
    this.name = "BadRequestError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", code = "CONFLICT") {
    super(409, message, code);
    this.name = "ConflictError";
  }
}

export function errorResponse(c: Context, error: unknown) {
  const requestId = c.get("requestId");
  const path = c.req.path;
  const method = c.req.method;

  if (error instanceof AppError) {
    // Log application errors (4xx) at warn level for visibility
    logger.warn(`${error.name}: ${error.message}`, {
      requestId,
      path,
      method,
      statusCode: error.statusCode,
      errorCode: error.code,
      errorName: error.name,
    });
    return c.json(
      {
        error: {
          message: error.message,
          code: error.code,
        },
      },
      error.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Handle Postgres errors
  if (error && typeof error === "object" && "code" in error) {
    const pgError = error as { code: string; detail?: string };

    // Unique constraint violation
    if (pgError.code === "23505") {
      logger.warn("Database conflict: unique constraint violation", {
        requestId,
        path,
        method,
        statusCode: 409,
        errorCode: "CONFLICT",
        pgCode: pgError.code,
        detail: pgError.detail,
      });
      return c.json(
        {
          error: {
            message: pgError.detail || "Resource already exists",
            code: "CONFLICT",
          },
        },
        409
      );
    }

    // Foreign key violation
    if (pgError.code === "23503") {
      logger.warn("Database error: foreign key violation", {
        requestId,
        path,
        method,
        statusCode: 400,
        errorCode: "FOREIGN_KEY_VIOLATION",
        pgCode: pgError.code,
        detail: pgError.detail,
      });
      return c.json(
        {
          error: {
            message: pgError.detail || "Referenced resource not found",
            code: "FOREIGN_KEY_VIOLATION",
          },
        },
        400
      );
    }
  }

  // Handle Zod validation errors
  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as { issues: Array<{ message: string; path: string[] }> };
    const message = zodError.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    logger.warn(`Validation error: ${message}`, {
      requestId,
      path,
      method,
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      validationErrors: zodError.issues,
    });
    return c.json(
      {
        error: {
          message,
          code: "VALIDATION_ERROR",
        },
      },
      400
    );
  }

  logger.error("Unhandled error", {
    requestId,
    errorName: error instanceof Error ? error.name : "Unknown",
    stack: error instanceof Error ? error.stack : undefined,
    path,
    method,
  });
  return c.json(
    {
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    },
    500
  );
}
