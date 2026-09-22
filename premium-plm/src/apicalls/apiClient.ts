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

    const data = await response.json();

    if (!response.ok) {
        throw new ApiError(
            data.message || "Something went wrong",
            response.status,
            data,
        );
    }

    return data;
}