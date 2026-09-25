const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
        const message =
            data && typeof data === "object" && "message" in data
                ? String((data as { message?: unknown }).message)
                : "Something went wrong";

        throw new ApiError(message, response.status, data);
    }

    return data as T;
}