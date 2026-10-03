import { useMemo, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { getProductInitiatives, updateInitiativePriority } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { ApiError } from "../../apicalls/apiClient";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";
import { currentStageFor, deriveStatus, stageBadgeClass } from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";

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

    return capitalize(
      usersQuery.data?.find((user) => user.userId === id)?.userName ?? "Unassigned",
    );
  }

  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  // One proposal + one discovery lookup per initiative, run in parallel —
  // same N+1 pattern already used for the full org-wide list on the
  // Dashboard, Audit Trail, and Initiatives pages. Needed so each card's
  // stage badge matches the same "current stage" shown everywhere else.
  const proposalQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-proposal", initiative.id],
      queryFn: () => getProposalByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const stageById = useMemo(() => {
    const map = new Map<string, string>();

    initiatives.forEach((initiative, index) => {
      const bdoSubmissionStatus = discoveryQueries[index]?.data?.status ?? "NotStarted";
      const proposal = proposalQueries[index]?.data ?? null;
      map.set(initiative.id, currentStageFor(bdoSubmissionStatus, proposal));
    });

    return map;
  }, [initiatives, proposalQueries, discoveryQueries]);

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
    mutationFn: ({ id, priority }: { id: string; priority: number }) =>
      updateInitiativePriority(id, priority),
    // Optimistic: the board updates the instant you confirm, from data we
    // already have, instead of waiting on a second network round trip
    // (a full refetch) before the confirm bar can close.
    onMutate: async ({ id, priority }) => {
      await queryClient.cancelQueries({ queryKey: ["product-initiatives"] });

      const previous = queryClient.getQueryData<ProductInitiative[]>([
        "product-initiatives",
      ]);

      queryClient.setQueryData<ProductInitiative[]>(["product-initiatives"], (current) =>
        current?.map((initiative) =>
          initiative.id === id ? { ...initiative, priority } : initiative,
        ),
      );

      return { previous };
    },
    // No onSuccess needed — confirmMove() below already closes the bar and
    // shows the success message the instant you click Confirm, rather than
    // waiting on this real request (which can be slow on a cold backend
    // instance). onError rolls back to the exact prior snapshot and
    // reports a failure if the real request eventually fails, even though
    // the bar's already closed.
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["product-initiatives"], context.previous);
      }

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

    // Deferred on purpose: setDraggingId re-renders this exact card (its
    // class changes to show the "dragging" style) — doing that
    // synchronously, in the same tick the browser is still picking the
    // element up as a native drag source, is enough for some browsers to
    // abandon the drag entirely. Letting the browser finish starting the
    // drag first avoids that.
    setTimeout(() => setDraggingId(initiative.id), 0);
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

    const { initiativeId, toPriority } = pendingMove;
    moveMutation.mutate({ id: initiativeId, priority: toPriority });

    // Close immediately and show success from the optimistic update above —
    // don't make the user sit watching a spinner for the real request,
    // which can be slow on a cold backend instance. onError still corrects
    // this (rollback + error banner) if that request eventually fails.
    setPendingMove(null);
    setDragError("");
    setDragStatus(`Priority updated to ${tierLabel(toPriority)}.`);
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
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setPendingMove(null)}
        >
          <div
            className="modal-panel modal-panel--compact"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="priority-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="priority-confirm-title">Confirm priority change</h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                Move <strong>{pendingMove.projectName}</strong> from{" "}
                <strong>{tierLabel(pendingMove.fromPriority)}</strong> to{" "}
                <strong>{tierLabel(pendingMove.toPriority)}</strong>? This
                updates its priority immediately.
              </p>
            </div>

            <div className="modal-panel_footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setPendingMove(null)}
              >
                Cancel
              </button>

              <button type="button" className="button button--primary" onClick={confirmMove}>
                Confirm
              </button>
            </div>
          </div>
        </div>
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

      {(initiativesQuery.isLoading ||
        proposalQueries.some((query) => query.isLoading) ||
        discoveryQueries.some((query) => query.isLoading)) && (
        <p className="initiatives-empty">Loading initiatives…</p>
      )}

      {!initiativesQuery.isLoading &&
        (initiativesQuery.isError ||
          proposalQueries.some((query) => query.isError) ||
          discoveryQueries.some((query) => query.isError)) && (
          <p className="initiatives-empty initiatives-empty--error">
            Couldn't load initiatives. Try refreshing the page.
          </p>
        )}

      {!initiativesQuery.isLoading &&
        !initiativesQuery.isError &&
        !proposalQueries.some((query) => query.isLoading || query.isError) &&
        !discoveryQueries.some((query) => query.isLoading || query.isError) && (
        <div className="priorities-board">
          {INITIATIVE_PRIORITIES.map((priority) => {
            const bucket = columns.get(priority.value) ?? [];

            return (
              <div
                key={priority.value}
                className="priorities-column"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
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
                    const { daysLeft } = deriveStatus(initiative);
                    const stage = stageById.get(initiative.id) ?? "BDO Documentation Drafting";

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
                          <span className={stageBadgeClass(stage)}>{stage}</span>

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
