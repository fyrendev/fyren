import type { Context } from "hono";

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
  if (error instanceof AppError) {
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

  console.error("Unhandled error:", error);
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
