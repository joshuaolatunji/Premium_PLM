import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

import type { InitiativeStatus } from "@/features/dashboard/types";

const STATUS_STYLES: Record<InitiativeStatus, string> = {
  "On Track": "bg-success-soft text-success-text",
  "At Risk": "bg-warning-soft text-warning-text",
  Overdue: "bg-destructive-soft text-destructive-text",
  Blocked: "bg-muted text-muted-foreground",
  "Not Started": "bg-muted text-muted-foreground",
};

export interface StatusBadgeProps {
  status: InitiativeStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="ghost"
      className={cn(
        "h-auto rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </Badge>
  );
}
