import { useEffect, useState } from "react";

import { checkApiHealth, type HealthStatus } from "@/lib/api/health.api";

/**
 * `unreachable` is reserved for genuine transport failures — DNS, TLS, CORS or
 * timeout. A 404 or 500 means the API answered, so it is reported as
 * `degraded`, not `offline`.
 */
export type ApiReachability = "checking" | "online" | "degraded" | "unreachable";

export interface ApiHealthState {
  status: ApiReachability;
  health: HealthStatus | null;
  /** Non-null when the API answered with something other than 2xx. */
  httpStatus: number | null;
}

/**
 * Probes the API once on mount. Render free-tier instances cold-start for tens
 * of seconds, so this lets the UI say "connecting" instead of showing a
 * generic connection error.
 */
export function useApiHealth(): ApiHealthState {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [status, setStatus] = useState<ApiReachability>("checking");
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    void checkApiHealth().then((result) => {
      if (!active) {
        return;
      }

      if (result.reachability === "online") {
        setHealth(result.health);
        setStatus("online");
        return;
      }

      if (result.reachability === "reachable") {
        setHttpStatus(result.httpStatus);
        setStatus("degraded");
        return;
      }

      setStatus("unreachable");
    });

    return () => {
      active = false;
    };
  }, []);

  return { status, health, httpStatus };
}
