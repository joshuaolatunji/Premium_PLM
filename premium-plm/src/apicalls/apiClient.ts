import { clearAuthSession } from "./authStorage";

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

export async function apiClient<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const { token, headers, ...requestOptions } = options;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...requestOptions,
        headers: {
            "Content-Type": "application/json",
            ...headers,
            ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                }
                : {}),
        },
    });

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

        const message =
            data && typeof data === "object" && "message" in data
                ? String((data as { message?: unknown }).message)
                : "Something went wrong";

        throw new ApiError(message, response.status, data);
    }

    return data as T;
}