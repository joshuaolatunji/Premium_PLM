import { isApiError } from "@/lib/api/errors";
import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

/**
 * `GET /api/health` is the one endpoint that does **not** use the standard
 * `{ isSuccessful, data }` envelope — it returns `statusCode` directly and
 * carries the payload inline:
 *
 * ```json
 * { "statusCode": 200, "status": "healthy", "message": "...",
 *   "service": "PremiumPLM API", "timestamp": "2026-09-28T11:58:57.1461128Z" }
 * ```
 *
 * So it is deliberately not passed through `unwrap`, which would reject it for
 * lacking `isSuccessful`.
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
 * Connectivity probe used to warm up the API on first load.
 *
 * Distinguishes "the server answered" from "the server could not be reached",
 * because any HTTP response — including a 404 or a 500 — proves the API is up.
 * Collapsing those into a single `null` is what made an incorrect probe path
 * render as "we cannot reach the service" when the service was reachable and
 * healthy the whole time.
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
