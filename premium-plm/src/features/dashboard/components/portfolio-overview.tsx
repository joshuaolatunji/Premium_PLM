import { ChevronRight } from "lucide-react";

import { PriorityBadge } from "@/components/common/priority-badge";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDaysLeft } from "@/lib/format";
import { cn } from "cn";

import { DashboardPanel, TextLinkButton } from "./dashboard-panel";
import type { PortfolioInitiative } from "../types";

const EMPTY_VALUE = "—";

function DaysLeft({ days }: { days: number | null }) {
  const label = formatDaysLeft(days);

  if (label === null) {
    return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;
  }

  return (
    <span
      className={cn(
        "font-medium whitespace-nowrap",
        days !== null && days < 0
          ? "font-semibold text-destructive-text"
          : "text-foreground",
      )}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table — sm and up                                                          */
/* -------------------------------------------------------------------------- */

function PortfolioTable({ initiatives }: { initiatives: PortfolioInitiative[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-xs">Initiative</TableHead>
            <TableHead className="text-xs">Priority</TableHead>
            <TableHead className="text-xs">Current stage</TableHead>
            <TableHead className="text-xs">Owner</TableHead>
            <TableHead className="text-xs">Progress</TableHead>
            <TableHead className="text-xs">Days left</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-right text-xs">
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {initiatives.map((initiative) => (
            <TableRow key={initiative.id}>
              <TableCell>
                <div className="flex min-w-36 flex-col gap-0.5">
                  <span className="font-semibold text-foreground">
                    {initiative.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {initiative.reference}
                  </span>
                </div>
              </TableCell>

              <TableCell>
                <PriorityBadge priority={initiative.priority} />
              </TableCell>

              <TableCell className="text-[0.8125rem]">
                {initiative.currentStage}
              </TableCell>

              <TableCell className="text-[0.8125rem]">
                {initiative.owner}
              </TableCell>

              <TableCell>
                <ProgressBar
                  value={initiative.progress}
                  label={initiative.name}
                />
              </TableCell>

              <TableCell className="text-[0.8125rem]">
                <DaysLeft days={initiative.daysLeft} />
              </TableCell>

              <TableCell>
                <StatusBadge status={initiative.status} />
              </TableCell>

              <TableCell className="text-right">
                <Button variant="outline" size="sm">
                  {initiative.action}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cards — below sm, where eight columns cannot fit                          */
/* -------------------------------------------------------------------------- */

function PortfolioCards({ initiatives }: { initiatives: PortfolioInitiative[] }) {
  return (
    <ul className="divide-y">
      {initiatives.map((initiative) => (
        <li key={initiative.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {initiative.name}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {initiative.reference}
              </p>
            </div>

            <StatusBadge status={initiative.status} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={initiative.priority} />

            <span className="text-xs text-muted-foreground">
              {initiative.currentStage}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="mt-0.5 font-medium">{initiative.owner}</dd>
            </div>

            <div>
              <dt className="text-muted-foreground">Days left</dt>
              <dd className="mt-0.5 font-medium">
                <DaysLeft days={initiative.daysLeft} />
              </dd>
            </div>

            <div className="col-span-2">
              <dt className="text-muted-foreground">Progress</dt>
              <dd className="mt-1">
                <ProgressBar
                  value={initiative.progress}
                  label={initiative.name}
                />
              </dd>
            </div>
          </dl>

          <Button variant="outline" size="sm" className="mt-3 w-full">
            {initiative.action}
            <ChevronRight aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

export interface PortfolioOverviewProps {
  initiatives: PortfolioInitiative[];
}

export function PortfolioOverview({ initiatives }: PortfolioOverviewProps) {
  return (
    <DashboardPanel
      title="Portfolio overview"
      description="All active initiatives across the product lifecycle."
      action={
        <TextLinkButton>
          View all
          <ChevronRight aria-hidden="true" />
        </TextLinkButton>
      }
      bleed
    >
      <div className="hidden sm:block">
        <PortfolioTable initiatives={initiatives} />
      </div>

      <div className="sm:hidden">
        <PortfolioCards initiatives={initiatives} />
      </div>
    </DashboardPanel>
  );
}
