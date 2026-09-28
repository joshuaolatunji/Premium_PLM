import { useEffect, useState } from "react";

import { dashboardRepository } from "@/features/dashboard/api/dashboard.repository";
import type { DashboardSnapshot } from "@/features/dashboard/types";

export interface DashboardDataState {
  data: DashboardSnapshot | null;
  isLoading: boolean;
  errorMessage: string;
}

/**
 * Loads the dashboard snapshot. Kept as a plain hook rather than pulling in a
 * data-fetching library — there is one request, it happens once on mount, and
 * the repository boundary is where caching policy should live.
 */
export function useDashboardData(): DashboardDataState {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    void dashboardRepository
      .getSnapshot()
      .then((snapshot) => {
        if (active) {
          setData(snapshot);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the dashboard.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { data, isLoading, errorMessage };
}
