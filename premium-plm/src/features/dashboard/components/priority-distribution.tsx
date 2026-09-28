import { cn } from "cn";

import { DashboardPanel } from "./dashboard-panel";
import type { PriorityDistributionItem } from "../types";

/**
 * Colour is keyed by rank, not by array position, so reordering the data
 * cannot change the meaning of a bar.
 */
const RANK_BAR_STYLES: Record<string, string> = {
  "1": "bg-destructive",
  "2": "bg-warning",
  "3": "bg-info",
  "4": "bg-muted-foreground",
};

const RANK_TEXT_STYLES: Record<string, string> = {
  "1": "text-destructive-text",
  "2": "text-warning-text",
  "3": "text-info-text",
  "4": "text-muted-foreground",
};

export interface PriorityDistributionProps {
  items: PriorityDistributionItem[];
}

export function PriorityDistribution({
  items,
}: PriorityDistributionProps) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <DashboardPanel title="Priority distribution">
      <ul className="flex flex-col gap-6">
        {items.map((item) => {
          const rank = item.priority.replace("#", "").trim();
          const percentage = total === 0 ? 0 : (item.count / total) * 100;

          return (
            <li key={item.priority}>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <span className="inline-flex items-baseline gap-2 text-sm font-semibold">
                  <span
                    className={cn(
                      "text-[0.8125rem] font-semibold",
                      RANK_TEXT_STYLES[rank],
                    )}
                  >
                    {item.priority}
                  </span>
                  {item.label}
                </span>

                <span className="text-[0.8125rem] font-medium text-info-text">
                  {item.count}
                </span>
              </div>

              <div
                role="img"
                aria-label={`${item.label}: ${item.count} of ${total}`}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    RANK_BAR_STYLES[rank],
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
