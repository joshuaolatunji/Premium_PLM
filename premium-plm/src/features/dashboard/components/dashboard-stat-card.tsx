import { cn } from "cn";

import type { StatTone } from "../types";

/**
 * Kept as a total `Record` so an unsupported tone is a compile error rather
 * than silently unstyled text.
 */
const DESCRIPTION_TONES: Record<StatTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-destructive-text",
};

export interface DashboardStatCardProps {
  label: string;
  value: number;
  description: string;
  descriptionType: StatTone;
}

export function DashboardStatCard({
  label,
  value,
  description,
  descriptionType,
}: DashboardStatCardProps) {
  return (
    <article className="min-w-0 rounded-lg border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>

      <p className="my-3 text-[2rem] leading-none font-bold text-foreground">
        {value}
      </p>

      <p
        className={cn(
          "text-[0.8125rem] font-medium leading-relaxed",
          DESCRIPTION_TONES[descriptionType],
        )}
      >
        {description}
      </p>
    </article>
  );
}
