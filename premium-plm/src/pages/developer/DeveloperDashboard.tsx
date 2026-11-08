import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { getMyTasks } from "../../service/TicketService";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import type { DashboardStat } from "../../types/dashboardTypes";
import type { DeveloperTask } from "../../types/ticketTypes";
import { currentTimestamp } from "../../utils/documentStatus";
import { formatDate, isTaskWorkable, taskStatusBadgeClass, taskStatusLabel } from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";

import MemoStatCards from "../../components/memos/MemoStatCards";

// Each card filters the task list to the tasks it counts; clicking it again
// (or "Clear filter") shows them all.
type CardFilter = "to-start" | "working" | "in-review" | "overdue";

// The developer's tasks from their Lead Engineers, from the live API.
function DeveloperDashboard() {
  const navigate = useNavigate();
  const now = currentTimestamp();
  const [cardFilter, setCardFilter] = useState<CardFilter | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["developer-tasks"],
    queryFn: getMyTasks,
  });

  const tasks = tasksQuery.data ?? [];
  const isOverdue = (targetDate: string | null, done: boolean) =>
    !done && Boolean(targetDate) && new Date(targetDate as string).getTime() < now - 24 * 60 * 60 * 1000;

  function matches(task: DeveloperTask, filter: CardFilter): boolean {
    switch (filter) {
      case "to-start":
        return task.status === "Assigned";
      case "working":
        return task.status === "InProgress" || task.status === "ReworkRequested";
      case "in-review":
        return task.status === "Submitted" || task.status === "UnderReview";
      case "overdue":
        return isOverdue(task.targetDate, !isTaskWorkable(task.status));
    }
  }

  const count = (filter: CardFilter) => tasks.filter((task) => matches(task, filter)).length;
  const toStart = count("to-start");
  const overdue = count("overdue");

  const statCards: { key: CardFilter; stat: DashboardStat }[] = [
    {
      key: "to-start",
      stat: {
        label: "To start",
        value: toStart,
        description: toStart > 0 ? "Newly assigned" : "Nothing new",
        descriptionType: toStart > 0 ? "warning" : "neutral",
      },
    },
    {
      key: "working",
      stat: {
        label: "In progress",
        value: count("working"),
        description: "Including any returned to you",
        descriptionType: "neutral",
      },
    },
    {
      key: "in-review",
      stat: {
        label: "Awaiting review",
        value: count("in-review"),
        description: "Submitted to your Lead Engineer",
        descriptionType: "neutral",
      },
    },
    {
      key: "overdue",
      stat: {
        label: "Overdue",
        value: overdue,
        description: overdue > 0 ? "Past their target date" : "All on time",
        descriptionType: overdue > 0 ? "danger" : "success",
      },
    },
  ];

  const activeCardLabel = statCards.find((card) => card.key === cardFilter)?.stat.label ?? null;
  const shownTasks = cardFilter ? tasks.filter((task) => matches(task, cardFilter)) : tasks;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Tasks</p>

          <h1 className="dashboard-title">Developer workspace</h1>

          <p className="dashboard-subtitle">Tasks assigned to you, and everything you need to work on them.</p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Your tasks">
        {statCards.map(({ key, stat }) => (
          <DashboardStatCard
            key={key}
            stat={stat}
            isActive={cardFilter === key}
            onClick={() => setCardFilter((current) => (current === key ? null : key))}
          />
        ))}
        <MemoStatCards />
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Your tasks</h2>
            <p>{activeCardLabel ? `Filtered by "${activeCardLabel}".` : "Every task your Lead Engineers have assigned to you."}</p>
          </div>

          {activeCardLabel && (
            <button type="button" className="text-button" onClick={() => setCardFilter(null)}>
              Clear filter
              <X size={15} />
            </button>
          )}
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Ticket</th>
                <th>Priority</th>
                <th>Target date</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {tasksQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    Loading your tasks…
                  </td>
                </tr>
              )}

              {tasksQuery.isError && (
                <tr>
                  <td colSpan={6} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your tasks. Try refreshing the page.
                  </td>
                </tr>
              )}

              {shownTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className="initiative-cell">
                      <strong title={task.title}>{task.title}</strong>
                      <span>{task.description}</span>
                    </div>
                  </td>

                  <td>{task.ticketTitle ?? "—"}</td>

                  <td>
                    <span className={priorityBadgeClass(task.priority)}>{priorityLabel(task.priority)}</span>
                  </td>

                  <td>
                    {formatDate(task.targetDate)}
                    {isOverdue(task.targetDate, !isTaskWorkable(task.status)) && (
                      <span className="cell-note cell-note--alert"> · overdue</span>
                    )}
                  </td>

                  <td>
                    <span className={taskStatusBadgeClass(task.status)}>{taskStatusLabel(task.status)}</span>
                  </td>

                  <td className="brd-reviews-actions">
                    <button
                      type="button"
                      className={
                        isTaskWorkable(task.status)
                          ? "table-action table-action--premium"
                          : "table-action table-action--dark"
                      }
                      onClick={() => navigate(`/dashboard/developer/tasks/${task.id}`)}
                    >
                      {task.status === "Assigned"
                        ? "Start"
                        : task.status === "ReworkRequested"
                          ? "Fix & resubmit"
                          : task.status === "InProgress"
                            ? "Work on it"
                            : "View"}
                    </button>
                  </td>
                </tr>
              ))}

              {!tasksQuery.isLoading && !tasksQuery.isError && shownTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    {cardFilter ? "No tasks match this filter." : "No tasks are assigned to you yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default DeveloperDashboard;
