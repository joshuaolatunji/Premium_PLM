import { ChevronRight } from "lucide-react";

import { PriorityBadge } from "@/components/common/priority-badge";
import { pluralise } from "@/lib/format";
import { cn } from "cn";

import { DashboardPanel, TextLinkButton } from "./dashboard-panel";
import type { BRDQueueItem } from "../types";

/** Waiting longer than this breaches the review SLA. */
const SLA_DAYS = 3;

export interface BRDApprovalQueueProps {
  items: BRDQueueItem[];
}

export function BRDApprovalQueue({ items }: BRDApprovalQueueProps) {
  return (
    <DashboardPanel
      title="BRD approval queue"
      description="Proposals waiting for your decision."
      action={
        <TextLinkButton>
          View all
          <ChevronRight aria-hidden="true" />
        </TextLinkButton>
      }
      bleed
    >
      <ul className="divide-y">
        {items.map((item) => {
          const isBreached = item.daysWaiting > SLA_DAYS;

          return (
            <li key={item.id} className="p-5 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {item.initiative}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.owner}
                  </p>
                </div>

                <PriorityBadge priority={item.priority} className="shrink-0" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Submitted {item.submittedDate}</span>

                <span
                  className={cn(
                    "font-medium",
                    isBreached && "font-semibold text-destructive-text",
                  )}
                >
                  {pluralise(item.daysWaiting, "day")} waiting
                </span>
              </div>

              <button
                type="button"
                className="mt-2.5 inline-flex items-center gap-0.5 text-[0.8125rem] font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Review BRD
                <ChevronRight aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
