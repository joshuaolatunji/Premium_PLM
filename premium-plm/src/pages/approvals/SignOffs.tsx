import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { approvalKeys, getWorkflowPage } from "../../service/ApprovalWorkflowService";
import { getProductInitiatives } from "../../service/InitiativeService";
import { getStoredUser } from "../../apicalls/authStorage";
import { API_WORKFLOW_STATUSES } from "../../types/approvalTypes";
import type { ApiWorkflowStatus, WorkflowFilters, WorkflowPage } from "../../types/approvalTypes";
import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";
import { resolvePrimaryRole } from "../../utils/roleRouting";
import { documentEditorPath, documentReviewPath } from "../../utils/documentRoutes";
import { backState } from "../../utils/navigation";
import { formatDate } from "../../utils/ticketStatus";

type Row = WorkflowPage["workflows"][number];

const STATUS_LABELS: Record<ApiWorkflowStatus, string> = {
  Draft: "Draft",
  PreparingSubmission: "Preparing",
  PendingApproval: "Pending approval",
  InProgress: "In progress",
  Approved: "Fully signed",
  Rejected: "Rejected",
  Cancelled: "Cancelled",
};

function statusOf(row: Row): ApiWorkflowStatus | null {
  return API_WORKFLOW_STATUSES.find((status) => status.toLowerCase() === row.apiStatus.toLowerCase()) ?? null;
}

function statusBadgeClass(status: ApiWorkflowStatus | null): string {
  switch (status) {
    case "Approved":
      return "status-badge status-badge--approved";
    case "PendingApproval":
    case "InProgress":
      return "status-badge status-badge--brd-under-review";
    case "Rejected":
    case "Cancelled":
      return "status-badge status-badge--bdo-documentation-rejected";
    case "Draft":
    case "PreparingSubmission":
      return "status-badge status-badge--brd-drafting";
    default:
      return "status-badge status-badge--not-started";
  }
}

// Who has it now, while it's out for signatures.
function withText(row: Row): string {
  if (row.status !== "InProgress") {
    return "—";
  }

  if (row.currentApproverName && row.currentApproverRole) {
    return `${row.currentApproverName} (${row.currentApproverRole})`;
  }

  return row.currentApproverName ?? row.currentApproverRole ?? "—";
}

function dateText(value: string | null): string {
  return value ? formatDate(value) : "—";
}

// The filters live in the address, so a refresh, Back or a shared link
// keeps them.
function readFilters(params: URLSearchParams): WorkflowFilters {
  const status = API_WORKFLOW_STATUSES.find((value) => value === params.get("status"));
  const documentType = DOCUMENT_TYPES.find((value) => value === params.get("type"));

  return {
    status,
    documentType,
    initiativeId: params.get("initiative") || undefined,
    fromDate: params.get("from") || undefined,
    toDate: params.get("to") || undefined,
  };
}

const FILTER_PARAMS: Record<keyof WorkflowFilters, string> = {
  status: "status",
  documentType: "type",
  initiativeId: "initiative",
  fromDate: "from",
  toDate: "to",
};

// Every sign-off workflow, for the Product Manager (who sets them up) and the
// Group Head, to follow. The server filters and pages the list; each row
// opens the document, where its sign-off panel shows the signatures.
function SignOffs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const pageNumber = Math.max(1, Number(searchParams.get("page")) || 1);
  const isGroupHead = resolvePrimaryRole(getStoredUser()?.roles ?? []) === "GroupHead";

  const datesInvalid = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);
  const hasFilters = Object.values(filters).some(Boolean);

  const workflowsQuery = useQuery({
    queryKey: approvalKeys.page(filters, pageNumber),
    queryFn: () => getWorkflowPage(filters, pageNumber),
    enabled: !datesInvalid,
    placeholderData: keepPreviousData,
  });

  // Names for the initiative filter (shared with the other initiative lists).
  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const page = workflowsQuery.data;
  const rows = page?.workflows ?? [];

  // Changing a filter starts again from the first page.
  function setFilter(key: keyof WorkflowFilters, value: string) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(FILTER_PARAMS[key], value);
    } else {
      next.delete(FILTER_PARAMS[key]);
    }

    next.delete("page");
    setSearchParams(next);
  }

  function goToPage(number: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(number));
    setSearchParams(next);
  }

  function openDocument(row: Row) {
    if (!row.documentType) {
      return;
    }

    const path = isGroupHead
      ? documentReviewPath("GroupHead", row.documentType, row.initiativeId)
      : documentEditorPath(row.initiativeId, row.documentType);

    navigate(path, { state: backState("Back to sign-offs") });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Sign-offs</p>

          <h1 className="dashboard-title">Sign-offs</h1>

          <p className="dashboard-subtitle">
            Every document sent for sign-off, and where each one stands. Open one to see its approvers and
            signatures.
          </p>
        </div>
      </header>

      <section className="sign-offs-filters" aria-label="Filter sign-offs">
        <div className="sign-offs-filters_field">
          <label htmlFor="sign-offs-status">Status</label>
          <select
            id="sign-offs-status"
            value={filters.status ?? ""}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {API_WORKFLOW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="sign-offs-type">Document</label>
          <select
            id="sign-offs-type"
            value={filters.documentType ?? ""}
            onChange={(event) => setFilter("documentType", event.target.value)}
          >
            <option value="">All documents</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="sign-offs-filters_field sign-offs-filters_field--wide">
          <label htmlFor="sign-offs-initiative">Initiative</label>
          <select
            id="sign-offs-initiative"
            value={filters.initiativeId ?? ""}
            onChange={(event) => setFilter("initiativeId", event.target.value)}
          >
            <option value="">All initiatives</option>
            {(initiativesQuery.data ?? []).map((initiative) => (
              <option key={initiative.id} value={initiative.id}>
                {initiative.projectName}
              </option>
            ))}
          </select>
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="sign-offs-from">Created from</label>
          <input
            id="sign-offs-from"
            type="date"
            value={filters.fromDate ?? ""}
            max={filters.toDate}
            onChange={(event) => setFilter("fromDate", event.target.value)}
          />
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="sign-offs-to">Created to</label>
          <input
            id="sign-offs-to"
            type="date"
            value={filters.toDate ?? ""}
            min={filters.fromDate}
            onChange={(event) => setFilter("toDate", event.target.value)}
          />
        </div>

        {hasFilters && (
          <button type="button" className="button button--dark" onClick={() => setSearchParams({})}>
            Clear filters
          </button>
        )}
      </section>

      <section className="dashboard-panel">
        {datesInvalid && (
          <p className="initiatives-empty initiatives-empty--error">
            The "Created from" date is after the "Created to" date.
          </p>
        )}

        {!datesInvalid && workflowsQuery.isLoading && <p className="initiatives-empty">Loading sign-offs…</p>}

        {!datesInvalid && workflowsQuery.isError && (
          <p className="initiatives-empty initiatives-empty--error">
            Couldn't load the sign-offs. Try refreshing the page.
          </p>
        )}

        {!datesInvalid && page && (
          <>
            <div className="portfolio-table-wrapper">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Initiative</th>
                    <th>Document</th>
                    <th>Status</th>
                    <th>Signed</th>
                    <th>With</th>
                    <th>Sent</th>
                    <th>Completed</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const status = statusOf(row);
                    const type: DocumentType | null = row.documentType;

                    return (
                      <tr key={row.id}>
                        <td>
                          <strong title={row.initiativeName ?? undefined}>{row.initiativeName ?? "—"}</strong>
                        </td>
                        <td title={type ? DOCUMENT_META[type].name : undefined}>
                          {type ?? "—"}
                          {row.documentVersion ? <span className="brd-version-tag"> v{row.documentVersion}</span> : null}
                        </td>
                        <td>
                          <span className={statusBadgeClass(status)}>
                            {status ? STATUS_LABELS[status] : row.apiStatus || "—"}
                          </span>
                        </td>
                        <td className="sign-offs_count">
                          {row.signedSteps} of {row.totalSteps}
                        </td>
                        <td>{withText(row)}</td>
                        <td className="sign-offs_date">{dateText(row.submittedAt)}</td>
                        <td className="sign-offs_date">{dateText(row.completedAt)}</td>
                        <td className="brd-reviews-actions">
                          <button
                            type="button"
                            className="table-action table-action--dark"
                            onClick={() => openDocument(row)}
                            disabled={!type}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="initiatives-empty">
                        {hasFilters ? "No sign-offs match these filters." : "No documents have been sent for sign-off yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="sign-offs-pager">
                <button
                  type="button"
                  className="button button--dark"
                  onClick={() => goToPage(pageNumber - 1)}
                  disabled={!page.hasPreviousPage || workflowsQuery.isFetching}
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                  Previous
                </button>

                <span>
                  Page {page.pageNumber} of {page.totalPages} · {page.totalCount} sign-offs
                </span>

                <button
                  type="button"
                  className="button button--dark"
                  onClick={() => goToPage(pageNumber + 1)}
                  disabled={!page.hasNextPage || workflowsQuery.isFetching}
                >
                  Next
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default SignOffs;
