import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getMyTasks } from "../../service/TicketService";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import { currentTimestamp } from "../../utils/documentStatus";
import { formatDate, isTaskWorkable, taskStatusBadgeClass, taskStatusLabel } from "../../utils/ticketStatus";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";

// The developer's tasks from their Lead Engineers, from the live API.
function DeveloperDashboard() {
  const navigate = useNavigate();
  const now = currentTimestamp();

  const tasksQuery = useQuery({
    queryKey: ["developer-tasks"],
    queryFn: getMyTasks,
  });

  const tasks = tasksQuery.data ?? [];
  const isOverdue = (targetDate: string | null, done: boolean) =>
    !done && Boolean(targetDate) && new Date(targetDate as string).getTime() < now - 24 * 60 * 60 * 1000;

  const toStart = tasks.filter((task) => task.status === "Assigned").length;
  const working = tasks.filter((task) => task.status === "InProgress" || task.status === "ReworkRequested").length;
  const inReview = tasks.filter((task) => task.status === "Submitted" || task.status === "UnderReview").length;
  const overdue = tasks.filter((task) => isOverdue(task.targetDate, !isTaskWorkable(task.status))).length;

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
        <DashboardStatCard
          stat={{
            label: "To start",
            value: toStart,
            description: toStart > 0 ? "Newly assigned" : "Nothing new",
            descriptionType: toStart > 0 ? "warning" : "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "In progress",
            value: working,
            description: "Including any returned to you",
            descriptionType: "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Awaiting review",
            value: inReview,
            description: "Submitted to your Lead Engineer",
            descriptionType: "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Overdue",
            value: overdue,
            description: overdue > 0 ? "Past their target date" : "All on time",
            descriptionType: overdue > 0 ? "danger" : "success",
          }}
        />
      </section>

      <section className="dashboard-panel">
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

              {tasks.map((task) => (
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

              {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    No tasks are assigned to you yet.
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
