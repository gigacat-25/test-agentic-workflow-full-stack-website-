// ============================================================
// Custom error classes for structured API error responses
// ============================================================

/**
 * Application-level error with HTTP status code and machine-readable code.
 * All API errors should use this (or its factory functions) for consistency.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  /**
   * Convert to a JSON-serializable error response body.
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

// -----------------------------------------------------------------
// Factory functions
// -----------------------------------------------------------------

export function badRequest(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(message, 400, 'BAD_REQUEST', details);
}

export function unauthorized(message: string = 'Unauthorized'): AppError {
  return new AppError(message, 401, 'UNAUTHORIZED');
}

export function forbidden(message: string = 'Forbidden'): AppError {
  return new AppError(message, 403, 'FORBIDDEN');
}

export function notFound(message: string = 'Resource not found'): AppError {
  return new AppError(message, 404, 'NOT_FOUND');
}

export function conflict(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(message, 409, 'CONFLICT', details);
}

export function internalError(message: string = 'Internal server error'): AppError {
  return new AppError(message, 500, 'INTERNAL_ERROR');
}
