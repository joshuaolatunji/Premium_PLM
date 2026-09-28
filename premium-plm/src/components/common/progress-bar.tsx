import { Progress } from "@/components/ui/progress";
import { cn } from "cn";

export interface ProgressBarProps {
  /** 0–100, or `null` when the metric is not tracked. */
  value: number | null;
  label: string;
  className?: string;
}

const EMPTY_VALUE = "—";

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  if (value === null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {EMPTY_VALUE}
      </span>
    );
  }

  return (
    <div className={cn("flex min-w-24 items-center gap-2", className)}>
      <Progress
        value={value}
        aria-label={`${label} progress`}
        className="w-20 flex-nowrap"
      />

      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}
