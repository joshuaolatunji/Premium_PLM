import { AlertTriangle, Ban, Clock3, type LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "cn";

import { DashboardPanel } from "./dashboard-panel";
import type { AtRiskInitiative, InitiativeStatus } from "../types";

/** Icon and chip tone per status, as a total record. */
const STATUS_PRESENTATION: Record<
  InitiativeStatus,
  { Icon: LucideIcon; chip: string }
> = {
  Overdue: { Icon: Clock3, chip: "bg-destructive-soft text-destructive-text" },
  "At Risk": { Icon: AlertTriangle, chip: "bg-warning-soft text-warning-text" },
  Blocked: { Icon: Ban, chip: "bg-muted text-muted-foreground" },
  "On Track": { Icon: AlertTriangle, chip: "bg-success-soft text-success-text" },
  "Not Started": { Icon: AlertTriangle, chip: "bg-muted text-muted-foreground" },
};

export interface AtRiskInitiativesProps {
  initiatives: AtRiskInitiative[];
}

export function AtRiskInitiatives({ initiatives }: AtRiskInitiativesProps) {
  return (
    <DashboardPanel
      title="At-risk & overdue"
      description="Initiatives requiring management attention."
      action={
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-destructive-soft px-2.5 text-[0.8125rem] font-bold text-destructive-text">
          {initiatives.length}
          <span className="sr-only">initiatives</span>
        </span>
      }
      bleed
    >
      <ul className="divide-y">
        {initiatives.map((initiative) => {
          const { Icon, chip } = STATUS_PRESENTATION[initiative.status];

          return (
            <li key={initiative.id} className="flex items-start gap-3.5 p-5 sm:px-6">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  chip,
                )}
              >
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {initiative.name}
                  </h3>

                  <StatusBadge
                    status={initiative.status}
                    className="shrink-0"
                  />
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {initiative.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
