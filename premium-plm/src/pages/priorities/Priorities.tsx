import { useMemo, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getProductInitiatives, updateInitiativePriority } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { ApiError } from "../../apicalls/apiClient";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";
import { deriveStatus, STATUS_LABEL } from "../../utils/initiativeStatus";

interface PendingMove {
  initiativeId: string;
  projectName: string;
  fromPriority: number;
  toPriority: number;
}

function tierLabel(value: number) {
  return INITIATIVE_PRIORITIES.find((entry) => entry.value === value)?.label ?? `P${value}`;
}

function Priorities() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [dragError, setDragError] = useState("");
  const [dragStatus, setDragStatus] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  function managerName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return usersQuery.data?.find((user) => user.userId === id)?.userName ?? "Unassigned";
  }

  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  // Grouped by priority tier, most urgent (soonest deadline) first within
  // each tier. There's no separate rank field in the API to persist a
  // custom order within a tier, only the tier itself.
  const columns = useMemo(() => {
    const groups = new Map<number, ProductInitiative[]>(
      INITIATIVE_PRIORITIES.map((priority) => [priority.value, []]),
    );

    initiatives.forEach((initiative) => {
      const bucket = groups.get(initiative.priority);
      if (bucket) {
        bucket.push(initiative);
      }
    });

    groups.forEach((bucket) => {
      bucket.sort((a, b) => {
        const aDays = deriveStatus(a).daysLeft;
        const bDays = deriveStatus(b).daysLeft;

        if (aDays === null) return 1;
        if (bDays === null) return -1;
        return aDays - bDays;
      });
    });

    return groups;
  }, [initiatives]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      await updateInitiativePriority(id, priority);
      // Wait for the refetch itself (not just fire-and-forget invalidation)
      // so the board is already showing the new grouping by the time the
      // confirm bar closes — otherwise a successful move can look like
      // nothing happened for a moment.
      await queryClient.invalidateQueries({ queryKey: ["product-initiatives"] });
    },
    onSuccess: (_data, variables) => {
      setPendingMove(null);
      setDragError("");
      setDragStatus(`Priority updated to ${tierLabel(variables.priority)}.`);
    },
    onError: (error) => {
      setDragStatus("");
      setDragError(
        error instanceof ApiError
          ? error.message
          : "Unable to update this initiative's priority.",
      );
    },
  });

  function handleDragStart(event: DragEvent<HTMLDivElement>, initiative: ProductInitiative) {
    event.dataTransfer.setData("text/plain", initiative.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(initiative.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetPriority: number) {
    event.preventDefault();

    const initiativeId = event.dataTransfer.getData("text/plain");
    const initiative = initiatives.find((entry) => entry.id === initiativeId);
    setDraggingId(null);

    if (!initiative || initiative.priority === targetPriority) {
      return;
    }

    setDragError("");
    setDragStatus("");
    setPendingMove({
      initiativeId: initiative.id,
      projectName: initiative.projectName,
      fromPriority: initiative.priority,
      toPriority: targetPriority,
    });
  }

  function confirmMove() {
    if (!pendingMove) return;
    moveMutation.mutate({ id: pendingMove.initiativeId, priority: pendingMove.toPriority });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Priorities</p>

          <h1 className="dashboard-title">Manage priorities</h1>

          <p className="dashboard-subtitle">
            Drag an initiative into a different column to change its priority
            tier. Rank drives the BRD review queue.
          </p>
        </div>
      </header>

      {pendingMove && (
        <section className="priorities-confirm-bar" role="alertdialog" aria-label="Confirm priority change">
          <span>
            Move <strong>{pendingMove.projectName}</strong> from{" "}
            <strong>{tierLabel(pendingMove.fromPriority)}</strong> to{" "}
            <strong>{tierLabel(pendingMove.toPriority)}</strong>? This updates
            its priority immediately.
          </span>

          <div className="priorities-confirm-bar_actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setPendingMove(null)}
              disabled={moveMutation.isPending}
            >
              Cancel
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={confirmMove}
              disabled={moveMutation.isPending}
            >
              {moveMutation.isPending ? "Updating…" : "Confirm"}
            </button>
          </div>
        </section>
      )}

      {dragStatus && (
        <p className="brd-status-message" role="status">
          {dragStatus}
        </p>
      )}

      {dragError && (
        <p className="form-error" role="alert">
          {dragError}
        </p>
      )}

      {initiativesQuery.isLoading && (
        <p className="initiatives-empty">Loading initiatives…</p>
      )}

      {initiativesQuery.isError && (
        <p className="initiatives-empty initiatives-empty--error">
          Couldn't load initiatives. Try refreshing the page.
        </p>
      )}

      {!initiativesQuery.isLoading && !initiativesQuery.isError && (
        <div className="priorities-board">
          {INITIATIVE_PRIORITIES.map((priority) => {
            const bucket = columns.get(priority.value) ?? [];

            return (
              <div
                key={priority.value}
                className="priorities-column"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, priority.value)}
              >
                <div className="priorities-column_header">
                  <span className={`priorities-column_rank priorities-column_rank--${priority.value}`}>
                    #{priority.value}
                  </span>
                  <span className="priorities-column_title">{priority.label}</span>
                  <span className="priorities-column_count">{bucket.length}</span>
                </div>

                <div className="priorities-column_body">
                  {bucket.length === 0 && (
                    <p className="priorities-column_empty">Drop an initiative here</p>
                  )}

                  {bucket.map((initiative) => {
                    const { status, daysLeft } = deriveStatus(initiative);

                    return (
                      <div
                        key={initiative.id}
                        className={
                          draggingId === initiative.id
                            ? "priorities-card priorities-card--dragging"
                            : "priorities-card"
                        }
                        draggable
                        onDragStart={(event) => handleDragStart(event, initiative)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(`/dashboard/initiatives/${initiative.id}`)}
                        role="button"
                        tabIndex={0}
                      >
                        <strong>{initiative.projectName}</strong>
                        <span className="priorities-card_manager">
                          {managerName(initiative.projectManagerId)}
                        </span>

                        <div className="priorities-card_footer">
                          <span className={`status-badge status-badge--${status}`}>
                            {STATUS_LABEL[status]}
                          </span>

                          {daysLeft !== null && (
                            <span className={daysLeft < 0 ? "days-left days-left--overdue" : "days-left"}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Priorities;
