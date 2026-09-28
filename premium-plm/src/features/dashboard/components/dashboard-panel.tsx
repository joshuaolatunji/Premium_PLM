import type { ReactNode } from "react";

interface DashboardPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Rendered flush with the panel edges — tables and lists use this. */
  bleed?: boolean;
  children: ReactNode;
  className?: string;
}

export function DashboardPanel({
  title,
  description,
  action,
  bleed = false,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-lg border bg-card ${className ?? ""}`}
    >
      <header className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground">{title}</h2>

          {description ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className={bleed ? "" : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}

export function TextLinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap text-primary transition-colors hover:text-primary-hover"
    >
      {children}
    </button>
  );
}
