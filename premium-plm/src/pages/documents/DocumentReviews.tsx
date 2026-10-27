import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getMyAssignedInitiatives, getProductInitiatives } from "../../service/InitiativeService";
import { getAllUsers } from "../../service/UserService";
import { getCurrentUserId } from "../../apicalls/authStorage";
import { DOCUMENT_META, documentTypeFromSlug } from "../../types/documentTypes";
import type { DocumentReviewer, ProductDocument } from "../../types/documentTypes";
import type { ProductInitiative } from "../../types/initiativeTypes";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
  useInitiativeDocuments,
} from "../../utils/documentStatus";
import { documentReviewPath } from "../../utils/documentRoutes";
import { priorityBadgeClass, priorityLabel } from "../../utils/initiativeStatus";
import { downloadDocument, previewDocument } from "../../utils/printDocument";
import { capitalize } from "../../utils/text";
import { backState } from "../../utils/navigation";

function formatShortDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface DocumentReviewsProps {
  reviewer: DocumentReviewer;
}

type Row = { initiative: ProductInitiative; document: ProductDocument };

// "PID Reviews", "FRD Reviews", "BRD Reviews", "SWR Reviews" — for the Group
// Head (every initiative) and the BDO (their own initiatives). Top: what's
// waiting for this reviewer. Below: what they've already passed on.
function DocumentReviews({ reviewer }: DocumentReviewsProps) {
  const { docType } = useParams<{ docType: string }>();
  const type = documentTypeFromSlug(docType);
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();
  const isBdo = reviewer === "BDO";

  // Group Head sees every initiative; the BDO only the ones assigned to them
  // (same endpoint and safety-net filter as the BDO dashboard).
  const initiativesQuery = useQuery({
    queryKey: isBdo ? ["product-initiatives-my-assigned"] : ["product-initiatives"],
    queryFn: isBdo ? getMyAssignedInitiatives : getProductInitiatives,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const initiatives = useMemo(
    () =>
      (initiativesQuery.data ?? []).filter((initiative) => !isBdo || initiative.bdoId === currentUserId),
    [initiativesQuery.data, isBdo, currentUserId],
  );

  const documents = useInitiativeDocuments(initiatives.map((initiative) => initiative.id));

  if (!type) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">This document type doesn't exist.</p>
      </div>
    );
  }

  const isLoading = initiativesQuery.isLoading || documents.isLoading;
  const hasError = initiativesQuery.isError || documents.isError;

  function managerName(id: string | null) {
    if (!id) {
      return "Unassigned";
    }

    return capitalize(usersQuery.data?.find((user) => user.userId === id)?.userName ?? "Unassigned");
  }

  const waitingStatus = isBdo ? "PendingBDOReview" : "PendingGroupHeadReview";
  // The BDO's "reviewed" list is everything they've forwarded (now with the
  // Group Head, or approved); the Group Head's is what they've approved.
  const doneStatuses = isBdo ? ["PendingGroupHeadReview", "Approved"] : ["Approved"];

  const awaiting: Row[] = [];
  const done: Row[] = [];

  if (!isLoading && !hasError) {
    initiatives.forEach((initiative, index) => {
      const document = documents.documentsFor(index)[type];

      if (document?.status === waitingStatus) {
        awaiting.push({ initiative, document });
      } else if (document && doneStatuses.includes(document.status)) {
        done.push({ initiative, document });
      }
    });
  }

  const pageTitle = `${type} Reviews`;

  function openReview(initiativeId: string) {
    navigate(documentReviewPath(reviewer, type!, initiativeId), { state: backState(`Back to ${pageTitle}`) });
  }

  function renderRows(rows: Row[], mode: "awaiting" | "done", emptyText: string) {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={6} className="initiatives-empty">
            Loading {type}s…
          </td>
        </tr>
      );
    }

    if (hasError) {
      return (
        <tr>
          <td colSpan={6} className="initiatives-empty initiatives-empty--error">
            Couldn't load {type}s. Try refreshing the page.
          </td>
        </tr>
      );
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="initiatives-empty">
            {emptyText}
          </td>
        </tr>
      );
    }

    return rows.map(({ initiative, document }) => (
      <tr key={initiative.id}>
        <td>
          <div className="initiative-cell">
            <strong title={initiative.projectName}>{initiative.projectName}</strong>
            <span>{initiative.id.slice(0, 8)}</span>
          </div>
        </td>

        <td>
          <span className={priorityBadgeClass(initiative.priority)}>{priorityLabel(initiative.priority)}</span>
        </td>

        <td>{managerName(initiative.projectManagerId)}</td>

        <td>{formatShortDate(document.submittedAt)}</td>

        <td>
          <span className={documentStatusBadgeClass(document.status)}>{documentStatusLabel(document.status)}</span>{" "}
          <span className="brd-version-tag">v{document.version}</span>
        </td>

        <td className="brd-reviews-actions">
          <button
            type="button"
            className="table-action table-action--premium table-action--wide"
            onClick={() => openReview(initiative.id)}
          >
            {mode === "awaiting" ? "Review" : "View"}
          </button>

          {mode === "done" && (
            <>
              <button
                type="button"
                className="table-action table-action--dark"
                onClick={() => void previewDocument(document, initiative.projectName)}
              >
                Preview
              </button>

              <button
                type="button"
                className="table-action table-action--dark"
                onClick={() => void downloadDocument(document, initiative.projectName)}
              >
                Download
              </button>
            </>
          )}
        </td>
      </tr>
    ));
  }

  const head = (
    <thead>
      <tr>
        <th>Initiative</th>
        <th>Priority</th>
        <th>Product manager</th>
        <th>Submitted</th>
        <th>{type} status</th>
        <th>
          <span className="sr-only">Action</span>
        </th>
      </tr>
    </thead>
  );

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / {pageTitle}</p>

          <h1 className="dashboard-title">{pageTitle}</h1>

          <p className="dashboard-subtitle">
            {DOCUMENT_META[type].name}s{" "}
            {isBdo ? "submitted by Product Managers on your initiatives" : "forwarded by the BDO"}, awaiting
            your decision.
          </p>
        </div>
      </header>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Awaiting your review</h2>
          </div>
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            {head}
            <tbody>{renderRows(awaiting, "awaiting", `No ${type}s are currently awaiting your review.`)}</tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>{isBdo ? `${type}s you've reviewed` : `Approved ${type}s`}</h2>
            <p>
              {isBdo
                ? `${type}s you've approved and forwarded to the Group Head.`
                : `${type}s you've already approved. View one, or download it.`}
            </p>
          </div>
        </div>

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            {head}
            <tbody>
              {renderRows(done, "done", isBdo ? `You haven't forwarded any ${type}s yet.` : `No ${type}s have been approved yet.`)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default DocumentReviews;
