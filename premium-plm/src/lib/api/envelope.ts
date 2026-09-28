import { ApiError, extractMessage } from "./errors";

/**
 * The API wraps most responses in this envelope.
 */
export interface ApiEnvelope<TData> {
  statusCode: number;
  isSuccessful: boolean;
  message: string;
  data: TData;
}

export function isApiEnvelope<TData>(
  value: unknown,
): value is ApiEnvelope<TData> {
  return (
    typeof value === "object" &&
    value !== null &&
    "isSuccessful" in value &&
    typeof (value as ApiEnvelope<TData>).isSuccessful === "boolean"
  );
}

/**
 * Unwraps `{ isSuccessful, data }` and throws on business-level failure, so a
 * service function either resolves to `TData` or throws an `ApiError` and pages
 * only need a `try/catch`.
 */
export function unwrap<TData>(response: unknown): TData {
  if (!isApiEnvelope<TData>(response)) {
    throw new ApiError(
      "The server returned an unexpected response.",
      0,
      response,
    );
  }

  if (!response.isSuccessful) {
    throw new ApiError(
      extractMessage(response, "The request could not be completed."),
      response.statusCode || 0,
      response,
    );
  }

  return response.data;
}
