import { env } from "@/lib/config/env";

import { ApiError, extractMessage } from "./errors";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type QueryValue = string | number | boolean | undefined | null;

export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  /** Abort signal — pass through from a component that can unmount. */
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted. `0` disables the timeout. */
  timeoutMs?: number;
  /**
   * Whether to attach the session token. Defaults to `true`; public endpoints
   * such as login opt out explicitly.
   */
  authenticated?: boolean;
  query?: QueryParams;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Supplied by the auth session. Returning `null` means "unauthenticated". */
  getToken: () => string | null;
  /** Invoked once when the API rejects the token, so the app can react. */
  onUnauthorized?: () => void;
  defaultTimeoutMs?: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function buildUrl(
  baseUrl: string,
  path: string,
  query?: QueryParams,
): string {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  if (!query) {
    return url;
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  const qs = search.toString();

  return qs ? `${url}?${qs}` : url;
}

/**
 * Never assumes JSON. Calling `response.json()` blindly threw on `204` and on
 * the HTML error pages proxies return, masking the real HTTP problem.
 */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("json")) {
    const text = await response.text().catch(() => "");

    return text || undefined;
  }

  return response.json().catch(() => undefined);
}

function createSignal(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();

  let timedOut = false;

  const onExternalAbort = () => controller.abort(external?.reason);

  if (external) {
    if (external.aborted) {
      controller.abort(external.reason);
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }

      external?.removeEventListener("abort", onExternalAbort);
    },
    didTimeout: () => timedOut,
  };
}

/* -------------------------------------------------------------------------- */
/*  Client                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_TIMEOUT_MS = 30_000;

async function request<T>(
  config: ApiClientConfig,
  method: string,
  path: string,
  options: RequestOptions & {
    body?: unknown;
    query?: QueryParams;
    authenticated?: boolean;
  } = {},
): Promise<T> {
  const {
    body,
    query,
    signal: externalSignal,
    timeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    authenticated = true,
  } = options;

  const headers = new Headers();

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  const token = authenticated ? config.getToken() : null;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const { signal, cleanup, didTimeout } = createSignal(
    externalSignal,
    timeoutMs,
  );

  let response: Response;

  try {
    response = await fetch(buildUrl(config.baseUrl, path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (didTimeout()) {
      throw new ApiError(
        "The request timed out. Please check your connection and try again.",
        0,
        undefined,
      );
    }

    if (externalSignal?.aborted) {
      throw cause;
    }

    throw new ApiError(
      "Unable to reach the server. Please check your connection and try again.",
      0,
      undefined,
    );
  } finally {
    cleanup();
  }

  const data = await readBody(response);

  if (!response.ok) {
    if (response.status === 401 && token) {
      config.onUnauthorized?.();
    }

    throw new ApiError(
      extractMessage(data, defaultMessageFor(response.status)),
      response.status,
      data,
    );
  }

  return data as T;
}

function defaultMessageFor(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have access to this resource.";
  if (status === 404) return "The requested resource was not found.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";

  return "Something went wrong. Please try again.";
}

export function createApiClient(config: ApiClientConfig) {
  return {
    /** Public read. */
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(config, "GET", path, { ...options, authenticated: false }),

    /** Authenticated read. */
    getAuthenticated: <T>(path: string, options?: RequestOptions) =>
      request<T>(config, "GET", path, options),

    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(config, "POST", path, { ...options, body }),

    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(config, "PUT", path, { ...options, body }),

    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(config, "PATCH", path, { ...options, body }),

    /**
     * DELETE with a request body. `fetch` permits this and ASP.NET binds a
     * `[FromBody]` parameter on a DELETE action, which is what
     * `PLMAdmin/remove_user_role` expects.
     */
    delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(config, "DELETE", path, { ...options, body }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Process-wide client. Auth wiring is attached in `app/api-client.ts`. */
export const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  getToken: () => null,
});

/**
 * Re-binds the auth dependencies of the shared client. Called once during
 * bootstrap so that no call site has to pass a token by hand.
 */
export function configureApiClient(overrides: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}): ApiClient {
  return Object.assign(
    apiClient,
    createApiClient({
      baseUrl: env.apiBaseUrl,
      getToken: overrides.getToken,
      onUnauthorized: overrides.onUnauthorized,
    }),
  );
}
