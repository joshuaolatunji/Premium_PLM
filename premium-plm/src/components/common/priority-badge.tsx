import { Badge } from "@/components/ui/badge";
import { cn } from "cn";


const RANK_STYLES: Record<string, string> = {
  "1": "bg-destructive-soft text-destructive-text",
  "2": "bg-warning-soft text-warning-text",
  "3": "bg-info-soft text-info-text",
  "4": "bg-muted text-muted-foreground",
};

export interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const rank = priority.replace("#", "").trim();

  return (
    <Badge
      variant="ghost"
      className={cn(
        "h-auto rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        RANK_STYLES[rank] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {priority}
    </Badge>
  );
}
