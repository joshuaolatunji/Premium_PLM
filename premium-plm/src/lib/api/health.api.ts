import { isApiError } from "@/lib/api/errors";
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

/**
 * The one endpoint that skips the `{ isSuccessful, data }` envelope — it returns
 * `statusCode` inline, so it must not go through `unwrap`.
 */
export interface HealthStatus {
  statusCode: number;
  status: string;
  message: string;
  service: string;
  timestamp: string;
}

export type HealthProbe =
  | { reachability: "online"; health: HealthStatus }
  | { reachability: "reachable"; httpStatus: number }
  | { reachability: "unreachable" };

/**
 * Separates "the server answered" from "the server could not be reached": any
 * HTTP response, including 404 or 500, proves the API is up. Collapsing both
 * into `null` is what made a wrong probe path render as an outage.
 */
export async function checkApiHealth(): Promise<HealthProbe> {
  try {
    const health = await apiClient.get<HealthStatus>(endpoints.health, {
      timeoutMs: 5_000,
    });

    return { reachability: "online", health };
  } catch (error) {
    if (isApiError(error) && !error.isNetworkError) {
      return { reachability: "reachable", httpStatus: error.status };
    }

    return { reachability: "unreachable" };
  }
}
