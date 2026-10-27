import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  approvalKeys,
  fetchFinalSignedPdf,
  fetchReviewPdf,
  getMyApprovalHistory,
  getMyPendingApprovals,
} from "../../service/ApprovalWorkflowService";
import { openPdfInTab } from "../../service/PdfService";
import DashboardStatCard from "../../dashboardcomponents/DashboardStatCard";
import { DOCUMENT_META } from "../../types/documentTypes";
import type { DocumentType } from "../../types/documentTypes";
import { currentTimestamp, daysSince } from "../../utils/documentStatus";
import { formatDate } from "../../utils/ticketStatus";

function documentName(type: DocumentType | null) {
  return type ? DOCUMENT_META[type].name : "Document";
}

// Everyone a Product Manager can pick as an approver lands here: the
// documents waiting for their signature, and the ones they've already
// signed or rejected.
function MyApprovals() {
  const navigate = useNavigate();
  const [pdfError, setPdfError] = useState("");

  const pendingQuery = useQuery({
    queryKey: approvalKeys.pending,
    queryFn: getMyPendingApprovals,
  });

  const historyQuery = useQuery({
    queryKey: approvalKeys.history,
    queryFn: getMyApprovalHistory,
  });

  const pending = pendingQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const now = currentTimestamp();

  function openPdf(load: () => Promise<Blob>) {
    setPdfError("");
    const tab = window.open("", "_blank");

    openPdfInTab(load, tab).catch((error: unknown) => {
      console.error(error);
      setPdfError("Couldn't load the PDF from the server. Try again shortly.");
    });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Approvals</p>

          <h1 className="dashboard-title">Approvals</h1>

          <p className="dashboard-subtitle">Documents sent to you for sign-off, and the ones you've already decided.</p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Approvals summary">
        <DashboardStatCard
          stat={{
            label: "Awaiting your signature",
            value: pending.length,
            description: pending.length > 0 ? "Oldest first below" : "Nothing waiting",
            descriptionType: pending.length > 0 ? "warning" : "success",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Signed by you",
            value: history.filter((row) => row.step.status === "Signed").length,
            description: "All time",
            descriptionType: "neutral",
          }}
        />
        <DashboardStatCard
          stat={{
            label: "Rejected by you",
            value: history.filter((row) => row.step.status === "Rejected").length,
            description: "Sent back to the Product Manager",
            descriptionType: "neutral",
          }}
        />
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Awaiting your signature</h2>
            <p>Each document reaches you once everyone before you in the order has signed.</p>
          </div>
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Initiative</th>
                <th>Signing as</th>
                <th>Your turn</th>
                <th>Waiting</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {pendingQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    Loading your approvals…
                  </td>
                </tr>
              )}

              {pendingQuery.isError && (
                <tr>
                  <td colSpan={6} className="initiatives-empty initiatives-empty--error">
                    Couldn't load your approvals. Try refreshing the page.
                  </td>
                </tr>
              )}

              {[...pending]
                .sort((a, b) => (a.sentAt ?? "").localeCompare(b.sentAt ?? ""))
                .map((item) => (
                  <tr key={`${item.workflowId}:${item.stepId}`}>
                    <td>
                      <div className="initiative-cell">
                        <strong title={documentName(item.documentType)}>
                          {item.documentType ?? "Document"} · {documentName(item.documentType)}
                        </strong>
                        <span>Approved by the Group Head</span>
                      </div>
                    </td>
                    <td>{item.initiativeName ?? "—"}</td>
                    <td>{item.approverRole ?? "—"}</td>
                    <td>
                      {item.sequence && item.totalSteps ? `${item.sequence} of ${item.totalSteps}` : "—"}
                    </td>
                    <td>
                      {item.sentAt ? `${daysSince(item.sentAt, now)} day${daysSince(item.sentAt, now) === 1 ? "" : "s"}` : "—"}
                    </td>
                    <td className="brd-reviews-actions">
                      <button
                        type="button"
                        className="table-action table-action--premium"
                        onClick={() => navigate(`/dashboard/approvals/${item.workflowId}/${item.stepId}`)}
                      >
                        Review &amp; sign
                      </button>
                    </td>
                  </tr>
                ))}

              {!pendingQuery.isLoading && !pendingQuery.isError && pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    Nothing is waiting for your signature.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Your past decisions</h2>
            <p>Recorded on this browser until the backend lists them (gaps file M15).</p>
          </div>
        </div>

        {pdfError && (
          <p className="form-error" role="alert">
            {pdfError}
          </p>
        )}

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Initiative</th>
                <th>Decision</th>
                <th>Date</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {history.map(({ workflow, step }) => (
                <tr key={`${workflow.id}:${step.id}`}>
                  <td>
                    <div className="initiative-cell">
                      <strong>{workflow.documentType} · {documentName(workflow.documentType)}</strong>
                      <span>Signed as {step.approverRole}</span>
                    </div>
                  </td>
                  <td>{workflow.initiativeName}</td>
                  <td>
                    <span
                      className={
                        step.status === "Signed"
                          ? "status-badge status-badge--approved"
                          : "status-badge status-badge--overdue"
                      }
                    >
                      {step.status === "Signed" ? "Signed" : "Rejected"}
                    </span>
                  </td>
                  <td>{formatDate(step.decidedAt)}</td>
                  <td className="brd-reviews-actions">
                    <button
                      type="button"
                      className="table-action table-action--dark"
                      onClick={() =>
                        openPdf(() =>
                          workflow.status === "Approved" ? fetchFinalSignedPdf(workflow.id) : fetchReviewPdf(workflow.id),
                        )
                      }
                    >
                      View PDF
                    </button>
                  </td>
                </tr>
              ))}

              {!historyQuery.isLoading && history.length === 0 && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
                    You haven't signed or rejected anything yet.
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

export default MyApprovals;
