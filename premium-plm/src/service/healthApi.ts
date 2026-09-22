import {apiClient} from "../../src/apicalls/apiClient";

export interface HealthResponse {
    status: string;
    service: string;
    timestamp: string;
}

export function checkApiHealth() {
    return apiClient<HealthResponse>("/health", {
        method:"GET",
        cache: "no-store",
    });
}