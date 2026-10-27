import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getProductInitiatives } from "../../service/InitiativeService";
import { approvalKeys, getAllWorkflows, getMyPendingApprovals } from "../../service/ApprovalWorkflowService";
import { ApiError } from "../../apicalls/apiClient";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import ApprovalQueue from "../../dashboardcomponents/ApprovalQueue";
import type { ApprovalQueueItem } from "../../types/dashboardTypes";
import { DOCUMENT_META, DOCUMENT_TYPES } from "../../types/documentTypes";
import type { ApprovalWorkflow } from "../../types/approvalTypes";
import {
  currentStageFor,
  deriveStatus,
  priorityBadgeClass,
  priorityLabel,
  stageBadgeClass,
  STATUS_LABEL,
} from "../../utils/initiativeStatus";
import {
  currentTimestamp,
  daysSince,
  documentStatusLabel,
  useInitiativeDocuments,
} from "../../utils/documentStatus";
import { formatDate } from "../../utils/ticketStatus";

// The Executive Director's oversight: how every initiative is progressing
// through documentation, sign-off and delivery — and anything waiting for
// their own signature. Read-only apart from signing.
function ExecutiveDashboard() {
  const navigate = useNavigate();
  const now = currentTimestamp();

  const initiativesQuery = useQuery({
    queryKey: ["product-initiatives"],
    queryFn: getProductInitiatives,
  });

  const pendingQuery = useQuery({
    queryKey: approvalKeys.pending,
    queryFn: getMyPendingApprovals,
  });

  // M14 — simulated from the workflows recorded on this browser.
  const workflowsQuery = useQuery({
    queryKey: approvalKeys.all,
    queryFn: getAllWorkflows,
  });

  const initiatives = useMemo(() => initiativesQuery.data ?? [], [initiativesQuery.data]);
  const { documentsFor, discoveryStatusFor, isLoading: documentsLoading } = useInitiativeDocuments(
    initiatives.map((initiative) => initiative.id),
  );
  const workflows = workflowsQuery.data ?? [];

  const rows = initiatives.map((initiative, index) => {
    const documents = documentsFor(index);
    const initiativeWorkflows = workflows.filter((workflow) => workflow.initiativeId === initiative.id);
    // The newest workflow per document type.
    const latest = new Map<string, ApprovalWorkflow>();

    initiativeWorkflows.forEach((workflow) => {
      if (!latest.has(workflow.documentType)) {
        latest.set(workflow.documentType, workflow);
      }
    });

    return {
      initiative,
      documents,
      stage: currentStageFor(discoveryStatusFor(index), documents),
      timeline: deriveStatus(initiative),
      approvedDocuments: DOCUMENT_TYPES.filter((type) => documents[type]?.status === "Approved").length,
      signedDocuments: [...latest.values()].filter((workflow) => workflow.status === "Approved").length,
      signingDocuments: [...latest.values()].filter((workflow) => workflow.status === "InProgress").length,
    };
  });

  const pending = pendingQuery.data ?? [];
  const queueItems: ApprovalQueueItem[] = pending.map((item) => {
    const initiative = initiatives.find((entry) => entry.id === item.initiativeId);

    return {
      key: `${item.workflowId}:${item.stepId}`,
      initiativeId: item.initiativeId ?? "",
      initiative: item.initiativeName ?? initiative?.projectName ?? "Initiative",
      documentLabel: item.documentType ?? "Document",
      priority: initiative ? priorityLabel(initiative.priority) : "—",
      priorityValue: initiative?.priority ?? 0,
      submittedBy: "the Product Manager",
      submittedDate: formatDate(item.sentAt),
      daysWaiting: daysSince(item.sentAt, now),
      reviewPath: `/dashboard/approvals/${item.workflowId}/${item.stepId}`,
    };
  });

  const atRisk = rows.filter((row) => row.timeline.status === "at-risk" || row.timeline.status === "overdue").length;
  const inDelivery = rows.filter((row) => row.stage === "Product Development").length;
  const fullySigned = rows.reduce((total, row) => total + row.signedDocuments, 0);
  const forbidden = initiativesQuery.error instanceof ApiError && initiativesQuery.error.status === 403;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Executive overview</p>

          <h1 className="dashboard-title">Executive overview</h1>

          <p className="dashboard-subtitle">
            Progress across every initiative, and the documents waiting for your signature.
          </p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Portfolio summary">
        <DashboardStatCard
          stat={{
            label: "Initiatives",
            value: initiatives.length,
            description: `${inDelivery} in product development`,
            descriptionType: "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "At risk or overdue",
            value: atRisk,
            description: atRisk > 0 ? "Final 20% of the timeline, or past it" : "Everything on track",
            descriptionType: atRisk > 0 ? "danger" : "success",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Documents fully signed",
            value: fullySigned,
            description: `${rows.reduce((total, row) => total + row.signingDocuments, 0)} collecting signatures`,
            descriptionType: "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Awaiting your signature",
            value: pending.length,
            description: pending.length > 0 ? "See the queue below" : "Nothing waiting",
            descriptionType: pending.length > 0 ? "warning" : "success",
          }}
          onClick={() => navigate("/dashboard/approvals")}
        />
      </section>

      <ApprovalQueue
        items={queueItems}
        onReview={(item) => navigate(item.reviewPath)}
        description="Documents waiting for your signature, oldest first."
      />

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Portfolio progress</h2>
            <p>Documentation, sign-off and timeline for each initiative.</p>
          </div>
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Priority</th>
                <th>Stage</th>
                <th>Documents</th>
                <th>Signed off</th>
                <th>Timeline</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {(initiativesQuery.isLoading || documentsLoading) && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    Loading the portfolio…
                  </td>
                </tr>
              )}

              {initiativesQuery.isError && (
                <tr>
                  <td colSpan={7} className="initiatives-empty initiatives-empty--error">
                    {forbidden
                      ? "Your role can't read the initiative list yet (gaps file M20)."
                      : "Couldn't load the initiatives. Try refreshing the page."}
                  </td>
                </tr>
              )}

              {!initiativesQuery.isLoading &&
                rows.map((row) => (
                  <tr key={row.initiative.id}>
                    <td>
                      <div className="initiative-cell">
                        <strong title={row.initiative.projectName}>{row.initiative.projectName}</strong>
                        <span>{row.initiative.description}</span>
                      </div>
                    </td>
                    <td>
                      <span className={priorityBadgeClass(row.initiative.priority)}>
                        {priorityLabel(row.initiative.priority)}
                      </span>
                    </td>
                    <td>
                      <span className={stageBadgeClass(row.stage)}>{row.stage}</span>
                    </td>
                    <td>
                      <div className="document-chips" aria-label={`${row.approvedDocuments} of 4 documents approved`}>
                        {DOCUMENT_TYPES.map((type) => (
                          <span
                            key={type}
                            className={`document-chip document-chip--${row.documents[type]?.status ?? "none"}`}
                            title={`${DOCUMENT_META[type].name}: ${documentStatusLabel(row.documents[type]?.status)}`}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {row.signedDocuments} of 4
                      {row.signingDocuments > 0 && <span className="cell-note"> · {row.signingDocuments} signing</span>}
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${row.timeline.status}`}>
                        {STATUS_LABEL[row.timeline.status]}
                      </span>
                      {row.timeline.daysLeft !== null && (
                        <span className="cell-note">
                          {" "}
                          {row.timeline.daysLeft < 0
                            ? `${Math.abs(row.timeline.daysLeft)}d over`
                            : `${row.timeline.daysLeft}d left`}
                        </span>
                      )}
                    </td>
                    <td className="brd-reviews-actions">
                      <button
                        type="button"
                        className="table-action table-action--dark"
                        onClick={() => navigate(`/dashboard/initiatives/${row.initiative.id}`)}
                      >
                        View initiative
                      </button>
                    </td>
                  </tr>
                ))}

              {!initiativesQuery.isLoading && !initiativesQuery.isError && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="initiatives-empty">
                    No initiatives yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mock-data-notice">
          "Signed off" counts the sign-offs recorded on this browser until the backend can list workflows
          (gaps file M14).
        </p>
      </section>
    </div>
  );
}

export default ExecutiveDashboard;
