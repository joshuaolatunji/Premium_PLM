import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getProductInitiatives,
  updateInitiativePriority,
} from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { ApiError } from "../../apicalls/apiClient";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";
import {
  currentStageFor,
  deriveStatus,
  priorityBadgeClass,
  priorityLabel,
  stageBadgeClass,
  timelineElapsedPercent,
} from "../../utils/initiativeStatus";
import { capitalize } from "../../utils/text";
import { useInitiativeDocuments } from "../../utils/documentStatus";

// Every value currentStageFor() can return, in pipeline order — backs both
// the status filter dropdown and the CSV export.
const ALL_STAGES = [
  "BDO Documentation Drafting",
  "Awaiting GH Documentation Approval",
  "BDO Documentation Rejected",
  "Product Documentation",
  "Documents Awaiting BDO Review",
  "Documents Under GH Review",
  "Product Development",
];

function formatCreatedDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadInitiativesCsv(
  rows: ProductInitiative[],
  managerName: (id: string | null) => string,
  stageFor: (initiativeId: string) => string,
) {
  const header = [
    "Initiative",
    "Priority",
    "Product manager",
    "Current stage",
    "Days left",
  ];

  const lines = rows.map((initiative) => {
    const { daysLeft } = deriveStatus(initiative);

    return [
      initiative.projectName,
      priorityLabel(initiative.priority),
      managerName(initiative.projectManagerId),
      stageFor(initiative.id),
      daysLeft === null ? "" : String(daysLeft),
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

  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);

  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setSearch(urlQuery);
  }
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
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

  const initiatives = useMemo(
    () => initiativesQuery.data ?? [],
    [initiativesQuery.data],
  );

  // One documents + one discovery lookup per initiative, run in parallel —
  // same N+1 pattern already used for the full org-wide list on the
  // Dashboard and Audit Trail pages. Needed so "current stage" can be
  // computed and filtered on consistently with every other page.
  const documents = useInitiativeDocuments(initiatives.map((initiative) => initiative.id));

  const discoveryQueries = useQueries({
    queries: initiatives.map((initiative) => ({
      queryKey: ["product-discovery", initiative.id],
      queryFn: () => getDiscoveryByInitiativeId(initiative.id),
      enabled: Boolean(initiative.id),
    })),
  });

  const stagesLoading =
    documents.isLoading ||
    discoveryQueries.some((query) => query.isLoading);
  const stagesError =
    documents.isError ||
    discoveryQueries.some((query) => query.isError);

  const stageById = useMemo(() => {
    const map = new Map<string, string>();

    initiatives.forEach((initiative, index) => {
      const bdoSubmissionStatus = discoveryQueries[index]?.data?.status ?? "NotStarted";
      map.set(initiative.id, currentStageFor(bdoSubmissionStatus, documents.documentsFor(index)));
    });

    return map;
  }, [initiatives, documents, discoveryQueries]);

  function stageFor(initiativeId: string) {
    return stageById.get(initiativeId) ?? "BDO Documentation Drafting";
  }

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    (usersQuery.data ?? []).forEach((user) => map.set(user.userId, user.userName));
    return map;
  }, [usersQuery.data]);

  function managerName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return capitalize(userNameById.get(id) ?? "Unassigned");
  }

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
    const direction = sortOrder === "newest" ? 1 : -1;

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

      if (statusFilter !== "all" && stageById.get(initiative.id) !== statusFilter) {
        return false;
      }

      return true;
    }).sort(
      (a, b) =>
        direction * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
  }, [initiatives, search, priorityFilter, managerFilter, statusFilter, stageById, sortOrder]);

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
    downloadInitiativesCsv(rows, managerName, stageFor);
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
            onClick={() =>
              navigate("/dashboard/initiatives/new", { state: { from: "/dashboard/initiatives" } })
            }
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
          aria-label="Filter by product manager"
        >
          <option value="all">All product managers</option>

          {managerOptions.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by current stage"
        >
          <option value="all">All stages</option>

          {ALL_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>

        <select
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
          aria-label="Sort initiatives by creation date"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>

        {hasActiveFilters && (
          <button type="button" className="text-button" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </section>

      {selectedCount > 0 && (
        <section className="initiatives-bulk-bar">
          <span className="initiatives-bulk-bar_count">
            <strong>{selectedCount}</strong> initiative{selectedCount === 1 ? "" : "s"} selected
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
              className="button button--primary"
              onClick={handleBulkPriorityApply}
              disabled={bulkPriorityMutation.isPending}
            >
              {bulkPriorityMutation.isPending
                ? "Applying…"
                : "Change priority"}
            </button>

            <button
              type="button"
              className="button button--dark"
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
                <th>Created</th>
                <th>Priority</th>
                <th>Product manager</th>
                <th>Timeline elapsed</th>
                <th>Days left</th>
                <th>Current stage</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {(initiativesQuery.isLoading || stagesLoading) && (
                <tr>
                  <td colSpan={9} className="initiatives-empty">
                    Loading initiatives…
                  </td>
                </tr>
              )}

              {!initiativesQuery.isLoading && (initiativesQuery.isError || stagesError) && (
                <tr>
                  <td colSpan={9} className="initiatives-empty initiatives-empty--error">
                    Couldn't load initiatives. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!initiativesQuery.isLoading &&
                !stagesLoading &&
                !initiativesQuery.isError &&
                !stagesError &&
                filtered.map((initiative) => {
                  const { daysLeft } = deriveStatus(initiative);
                  const elapsedPct = timelineElapsedPercent(initiative);
                  const stage = stageFor(initiative.id);

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
                          <strong title={initiative.projectName}>{initiative.projectName}</strong>
                          <span>{initiative.id.slice(0, 8)}</span>
                        </div>
                      </td>

                      <td>{formatCreatedDate(initiative.createdAt)}</td>

                      <td>
                        <span className={priorityBadgeClass(initiative.priority)}>
                          {priorityLabel(initiative.priority)}
                        </span>
                      </td>

                      <td>{managerName(initiative.projectManagerId)}</td>

                      <td>
                        {elapsedPct !== null ? (
                          <div className="progress-cell">
                            <div
                              className="progress-track"
                              role="progressbar"
                              aria-label={`${initiative.projectName} timeline elapsed`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={elapsedPct}
                            >
                              <span className="progress-fill" style={{ width: `${elapsedPct}%` }} />
                            </div>

                            <span>{elapsedPct}%</span>
                          </div>
                        ) : (
                          <span className="portfolio-empty-value">—</span>
                        )}
                      </td>

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
                        <span className={stageBadgeClass(stage)}>{stage}</span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="table-action table-action--premium"
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
                !stagesLoading &&
                !initiativesQuery.isError &&
                !stagesError &&
                filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="initiatives-empty">
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
    </div>
  );
}

export default Initiatives;
