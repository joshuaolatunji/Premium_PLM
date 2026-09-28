import {
  Check,
  ChevronRight,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "cn";

import { DashboardPanel, TextLinkButton } from "./dashboard-panel";
import type { ActivityTone, GovernanceActivity } from "../types";

const TONE_PRESENTATION: Record<ActivityTone, { Icon: LucideIcon; chip: string }> =
  {
    success: { Icon: Check, chip: "bg-success-soft text-success-text" },
    info: { Icon: Info, chip: "bg-info-soft text-info-text" },
    warning: { Icon: TriangleAlert, chip: "bg-warning-soft text-warning-text" },
    danger: { Icon: X, chip: "bg-destructive-soft text-destructive-text" },
  };

export interface RecentGovernanceActivityProps {
  activities: GovernanceActivity[];
}

export function RecentGovernanceActivity({
  activities,
}: RecentGovernanceActivityProps) {
  return (
    <DashboardPanel
      title="Recent governance activity"
      description="Latest decisions and lifecycle events."
      action={
        <TextLinkButton>
          Audit trail
          <ChevronRight aria-hidden="true" />
        </TextLinkButton>
      }
      bleed
    >
      <ul className="divide-y">
        {activities.map((activity) => {
          const { Icon, chip } = TONE_PRESENTATION[activity.type];

          return (
            <li
              key={activity.id}
              className="flex items-start gap-3.5 p-4 sm:px-6"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  chip,
                )}
              >
                <Icon className="size-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] font-medium leading-relaxed text-foreground">
                  {activity.action}
                </p>

                <p className="mt-0.5 text-xs font-semibold">
                  {activity.initiative}
                </p>

                <p className="mt-1 flex flex-wrap items-center gap-1 text-[0.6875rem] text-muted-foreground">
                  <span>{activity.role}</span>
                  <span aria-hidden="true">·</span>
                  <time>{activity.timestamp}</time>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
