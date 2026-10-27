import { clearAuthSession, hasValidSession } from "./authStorage";
import { rememberReturnPath } from "../utils/sessionReturn";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ApiRequestOptions extends RequestInit {
    token?: string;
}

export class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(
        message: string,
        status: number,
        data: unknown,
    ) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

// Without this, a dead connection (e.g. the free-tier backend cold-starting
// or briefly unreachable) relies on the browser's own default timeout —
// often 60s+ — before anything fails. Combined with React Query's default
// retries, a page could look frozen on "Loading…" for well over a minute.
// This isn't a 401/session-expiry case (no response ever comes back to
// read a status from), so it's handled as its own distinct failure mode.
const REQUEST_TIMEOUT_MS = 20_000;

// The most useful explanation available for a failed request. Prefers the
// server's own text — the API envelope's `message`, or the `detail` /
// `title` of an ASP.NET problem-details body — and otherwise says what the
// status code means, rather than a bare "Something went wrong" that hides
// whether it was a permissions problem, a missing record, or a server bug.
function errorMessageFor(status: number, data: unknown): string {
    if (typeof data === "string" && data.trim() && !data.trim().startsWith("<")) {
        return data.trim();
    }

    if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;

        for (const key of ["message", "detail", "title", "error"]) {
            const value = record[key];

            if (typeof value === "string" && value.trim()) {
                return value;
            }
        }
    }

    switch (status) {
        case 400:
            return "The server couldn't accept this request (400). Check the details and try again.";
        case 403:
            return "You don't have permission to do this (403).";
        case 404:
            return "The server couldn't find this item or action (404).";
        case 409:
            return "This conflicts with the item's current state (409). Refresh and try again.";
        case 413:
            return "This file is too large for the server to accept (413).";
        default:
            return status >= 500
                ? `The server ran into an error (${status}). Try again, or contact support if it keeps happening.`
                : `Something went wrong (${status}).`;
    }
}

export async function apiClient<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const { token, headers, ...requestOptions } = options;

    // An authenticated call made after the token has expired is never sent:
    // the user is signed out and sent to login straight away. Without this,
    // the outcome depended on the server replying with a 401 — and if the
    // request failed outright instead, pages just showed "couldn't load".
    if (token && !hasValidSession()) {
        rememberReturnPath();
        clearAuthSession();
        window.location.replace("/login");
        throw new ApiError("Your session has expired. Please sign in again.", 401, null);
    }

    // FormData bodies (file uploads) need the browser to set its own
    // Content-Type with the multipart boundary — setting "application/json"
    // on top of it breaks the upload.
    const isFormData =
        typeof FormData !== "undefined" && requestOptions.body instanceof FormData;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...requestOptions,
            signal: timeoutController.signal,
            headers: {
                ...(isFormData ? {} : { "Content-Type": "application/json" }),
                ...headers,
                ...(token
                    ? {
                        Authorization: `Bearer ${token}`,
                    }
                    : {}),
            },
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new ApiError("The server took too long to respond. Try again.", 0, null);
        }

        throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0, null);
    } finally {
        clearTimeout(timeoutId);
    }

    // Some endpoints (e.g. a bare 200/204 with no response body) return an
    // empty payload. Reading as text first avoids response.json() throwing
    // "Unexpected end of JSON input" when there's nothing to parse.
    const rawBody = await response.text();
    let data: unknown = null;

    if (rawBody) {
        try {
            data = JSON.parse(rawBody);
        } catch {
            if (response.ok) {
                throw new ApiError(
                    "Received an unexpected response from the server.",
                    response.status,
                    rawBody,
                );
            }
        }
    }

    if (!response.ok) {
        // A 401 on a request that carried a token means the session itself
        // is invalid (expired or revoked) — every page was otherwise left
        // showing its own generic "couldn't load" message with no way out
        // except a manual re-login. Requests with no token (e.g. the login
        // call itself) reach here on bad credentials, not an expired
        // session, so they're left alone to show their own error message.
        if (response.status === 401 && token) {
            clearAuthSession();
            window.location.href = "/login";
        }

        throw new ApiError(errorMessageFor(response.status, data), response.status, data);
    }

    return data as T;
}