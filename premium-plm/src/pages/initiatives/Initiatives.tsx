import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getProductInitiatives,
  updateInitiativePriority,
} from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { ApiError } from "../../apicalls/apiClient";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";
import CreateInitiativeModal from "../../dashboardcomponents/CreateInitiativeModal";
import { deriveStatus, priorityLabel, STATUS_LABEL } from "../../utils/initiativeStatus";

function toCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadInitiativesCsv(
  rows: ProductInitiative[],
  managerName: (id: string | null) => string,
) {
  const header = [
    "Initiative",
    "Priority",
    "Project manager",
    "Status",
    "Days left",
    "Extensions used",
    "Extensions remaining",
  ];

  const lines = rows.map((initiative) => {
    const { status, daysLeft } = deriveStatus(initiative);

    return [
      initiative.projectName,
      priorityLabel(initiative.priority),
      managerName(initiative.projectManagerId),
      STATUS_LABEL[status],
      daysLeft === null ? "" : String(daysLeft),
      String(initiative.timelineExtensionCount),
      String(initiative.extensionsRemaining),
    ]
      .map(toCsvValue)
      .join(",");
  });

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `initiatives-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function Initiatives() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPriority, setBulkPriority] = useState(3);
  const [bulkError, setBulkError] = useState("");

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    (usersQuery.data ?? []).forEach((user) => map.set(user.userId, user.userName));
    return map;
  }, [usersQuery.data]);

  function managerName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return userNameById.get(id) ?? "Unassigned";
  }

  // react-query keeps a stable `data` reference across renders that don't
  // change it, but `?? []` would create a fresh array every render — memoize
  // so the filters below don't recompute on every keystroke elsewhere.
  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  // Filter options are drawn from managers actually assigned to an
  // initiative, rather than every user with the role — a PM with nothing
  // assigned isn't a useful filter.
  const managerOptions = useMemo(() => {
    const ids = new Set(
      initiatives
        .map((initiative) => initiative.projectManagerId)
        .filter((id): id is string => id !== null),
    );

    return Array.from(ids)
      .map((id) => ({ id, name: userNameById.get(id) ?? "Unassigned" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initiatives, userNameById]);

  const filtered = useMemo(() => {
    return initiatives.filter((initiative) => {
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matches =
          initiative.projectName.toLowerCase().includes(term) ||
          initiative.description.toLowerCase().includes(term);

        if (!matches) {
          return false;
        }
      }

      if (
        priorityFilter !== "all" &&
        String(initiative.priority) !== priorityFilter
      ) {
        return false;
      }

      if (
        managerFilter !== "all" &&
        initiative.projectManagerId !== managerFilter
      ) {
        return false;
      }

      if (statusFilter !== "all") {
        const { status } = deriveStatus(initiative);

        if (status !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [initiatives, search, priorityFilter, managerFilter, statusFilter]);

  const hasActiveFilters =
    Boolean(search) ||
    priorityFilter !== "all" ||
    managerFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setPriorityFilter("all");
    setManagerFilter("all");
    setStatusFilter("all");
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (filtered.length > 0 && current.size === filtered.length) {
        return new Set();
      }

      return new Set(filtered.map((initiative) => initiative.id));
    });
  }

  const bulkPriorityMutation = useMutation({
    mutationFn: async ({ ids, priority }: { ids: string[]; priority: number }) => {
      await Promise.all(ids.map((id) => updateInitiativePriority(id, priority)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-initiatives"] });
      setSelectedIds(new Set());
      setBulkError("");
    },
    onError: (error) => {
      setBulkError(
        error instanceof ApiError
          ? error.message
          : "Unable to update priority for the selected initiatives.",
      );
    },
  });

  function handleBulkPriorityApply() {
    setBulkError("");
    bulkPriorityMutation.mutate({
      ids: Array.from(selectedIds),
      priority: bulkPriority,
    });
  }

  function handleExportCsv() {
    const rows = filtered.filter((initiative) => selectedIds.has(initiative.id));
    downloadInitiativesCsv(rows, managerName);
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Initiatives</p>

          <h1 className="dashboard-title">Initiatives</h1>

          <p className="dashboard-subtitle">
            {initiativesQuery.isLoading
              ? "Loading initiatives…"
              : `${initiatives.length} initiative${
                  initiatives.length === 1 ? "" : "s"
                } in your group`}
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={17} strokeWidth={2} />
            <span>New initiative</span>
          </button>
        </div>
      </header>

      <section className="initiatives-toolbar" aria-label="Filter initiatives">
        <div className="initiatives-search">
          <Search size={16} />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or description"
          />
        </div>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>

          {INITIATIVE_PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </select>

        <select
          value={managerFilter}
          onChange={(event) => setManagerFilter(event.target.value)}
          aria-label="Filter by project manager"
        >
          <option value="all">All project managers</option>

          {managerOptions.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="on-track">On track</option>
          <option value="at-risk">At risk</option>
          <option value="overdue">Overdue</option>
          <option value="not-started">Not started</option>
        </select>

        {hasActiveFilters && (
          <button type="button" className="text-button" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </section>

      {selectedCount > 0 && (
        <section className="initiatives-bulk-bar">
          <span>
            {selectedCount} initiative{selectedCount === 1 ? "" : "s"} selected
          </span>

          <div className="initiatives-bulk-bar_actions">
            <select
              value={bulkPriority}
              onChange={(event) => setBulkPriority(Number(event.target.value))}
              aria-label="New priority for selected initiatives"
            >
              {INITIATIVE_PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="button button--secondary"
              onClick={handleBulkPriorityApply}
              disabled={bulkPriorityMutation.isPending}
            >
              {bulkPriorityMutation.isPending
                ? "Applying…"
                : "Change priority"}
            </button>

            <button
              type="button"
              className="button button--secondary"
              onClick={handleExportCsv}
            >
              Export CSV
            </button>

            <button
              type="button"
              className="text-button"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        </section>
      )}

      {bulkError && (
        <p className="form-error" role="alert">
          {bulkError}
        </p>
      )}

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    ref={(element) => {
                      if (element) {
                        element.indeterminate =
                          selectedCount > 0 && selectedCount < filtered.length;
                      }
                    }}
                    checked={filtered.length > 0 && selectedCount === filtered.length}
                    onChange={toggleAll}
                    aria-label="Select all initiatives"
                  />
                </th>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Project manager</th>
                <th>Days left</th>
                <th>Extensions</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {initiativesQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="initiatives-empty">
                    Loading initiatives…
                  </td>
                </tr>
              )}

              {initiativesQuery.isError && (
                <tr>
                  <td colSpan={8} className="initiatives-empty initiatives-empty--error">
                    Couldn't load initiatives. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!initiativesQuery.isLoading &&
                !initiativesQuery.isError &&
                filtered.map((initiative) => {
                  const { status, daysLeft } = deriveStatus(initiative);
                  const totalExtensions =
                    initiative.timelineExtensionCount +
                    initiative.extensionsRemaining;

                  return (
                    <tr key={initiative.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(initiative.id)}
                          onChange={() => toggleRow(initiative.id)}
                          aria-label={`Select ${initiative.projectName}`}
                        />
                      </td>

                      <td>
                        <div className="initiative-cell">
                          <strong>{initiative.projectName}</strong>
                          <span>{initiative.id.slice(0, 8)}</span>
                        </div>
                      </td>

                      <td>
                        <span className="priority-badge">
                          {priorityLabel(initiative.priority)}
                        </span>
                      </td>

                      <td>{managerName(initiative.projectManagerId)}</td>

                      <td>
                        {daysLeft === null ? (
                          <span className="portfolio-empty-value">—</span>
                        ) : (
                          <span
                            className={
                              daysLeft < 0
                                ? "days-left days-left--overdue"
                                : "days-left"
                            }
                          >
                            {daysLeft < 0
                              ? `${Math.abs(daysLeft)}d overdue`
                              : `${daysLeft}d`}
                          </span>
                        )}
                      </td>

                      <td>
                        {initiative.timelineExtensionCount} of {totalExtensions}
                      </td>

                      <td>
                        <span className={`status-badge status-badge--${status}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() =>
                            navigate(`/dashboard/initiatives/${initiative.id}`)
                          }
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!initiativesQuery.isLoading &&
                !initiativesQuery.isError &&
                filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="initiatives-empty">
                      {initiatives.length === 0
                        ? "No initiatives yet. Create one to get started."
                        : "No initiatives match your filters."}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen && (
        <CreateInitiativeModal onClose={() => setIsCreateOpen(false)} />
      )}
    </div>
  );
}

export default Initiatives;
