/** Raised when the API responds with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  /** True for transport-level failures: offline, DNS, CORS, timeout. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Best-effort extraction of a human-readable message from an unknown payload.
 * Handles both the `{ message }` envelope and plain `{ error }` / string bodies.
 */
export function extractMessage(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "title"]) {
      const value = record[key];

      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return fallback;
}
