import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:mb-9 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="text-[1.375rem] font-bold tracking-tight text-foreground sm:text-[1.5rem]">
          {title}
        </h1>

        {description ? (
          <div className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-col gap-2.5 min-[480px]:flex-row">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
