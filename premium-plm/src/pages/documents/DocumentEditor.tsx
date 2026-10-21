import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { getInitiativeById } from "../../service/InitiativeService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { getInitiativeDocuments, saveDocument, submitDocument } from "../../service/DocumentService";
import { getCurrentUserId, getStoredUser } from "../../apicalls/authStorage";
import { DOCUMENT_META, EMPTY_OVERVIEW, documentTypeFromSlug } from "../../types/documentTypes";
import type {
  DocumentOverview,
  DocumentType,
  ProductDocument,
  SaveDocumentRequest,
} from "../../types/documentTypes";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
  documentsQueryKey,
  isEditable,
  EMPTY_DOCUMENTS,
} from "../../utils/documentStatus";
import { richTextToPlain } from "../../utils/richText";
import { printDocument } from "../../utils/printDocument";
import { documentEditorPath, documentHubPath } from "../../utils/documentRoutes";
import { capitalize } from "../../utils/text";
import BackLink from "../../components/common/BackLink";
import DocumentTabs from "../../components/documents/DocumentTabs";
import DocumentReadOnlyView from "../../components/documents/DocumentReadOnlyView";
import RichTextEditor from "../../components/editor/RichTextEditor";

const OVERVIEW_FIELDS: { key: keyof DocumentOverview; label: string }[] = [
  { key: "author", label: "Author" },
  { key: "sponsor", label: "Sponsor" },
  { key: "userGroup", label: "User group" },
  { key: "productManager", label: "Product manager" },
];

interface DocumentFormProps {
  initiativeId: string;
  initiativeName: string;
  type: DocumentType;
  document: ProductDocument | null;
  // Kept by the parent so "Saved" survives the form being re-created from
  // the newly saved document.
  statusMessage: string;
  onStatusMessage: (message: string) => void;
}

// The editable form — Overview, then Description, then the Save and Submit
// bars. Keyed by the saved document in the parent, so it starts from the
// latest saved values whenever its status changes.
function DocumentForm({
  initiativeId,
  initiativeName,
  type,
  document,
  statusMessage,
  onStatusMessage,
}: DocumentFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = getCurrentUserId() ?? "";

  const [form, setForm] = useState<SaveDocumentRequest>(() => {
    if (document) {
      return { overview: document.overview, description: document.description };
    }

    // A new document starts with the PM's own name filled in.
    const myName = capitalize(getStoredUser()?.userName ?? "");
    return { overview: { ...EMPTY_OVERVIEW, author: myName, productManager: myName }, description: "" };
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const isDirty =
    !document ||
    JSON.stringify(form) !== JSON.stringify({ overview: document.overview, description: document.description });

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: documentsQueryKey(initiativeId) });
  }

  const saveMutation = useMutation({
    mutationFn: () => saveDocument(initiativeId, type, form, userId),
    onSuccess: async () => {
      setErrorMessage("");
      onStatusMessage(`${type} saved.`);
      await refresh();
    },
    onError: (error) => {
      onStatusMessage("");
      setErrorMessage(error instanceof Error ? error.message : `Couldn't save the ${type}.`);
    },
  });

  // Submitting saves the latest changes first, so nothing typed is lost.
  const submitMutation = useMutation({
    mutationFn: async () => {
      await saveDocument(initiativeId, type, form, userId);
      return submitDocument(initiativeId, type);
    },
    onSuccess: async () => {
      setConfirmingSubmit(false);
      setErrorMessage("");
      await refresh();
    },
    onError: (error) => {
      setConfirmingSubmit(false);
      setErrorMessage(error instanceof Error ? error.message : `Couldn't submit the ${type}.`);
    },
  });

  const isBusy = saveMutation.isPending || submitMutation.isPending;

  function updateOverview(key: keyof DocumentOverview, value: string) {
    onStatusMessage("");
    setForm((current) => ({ ...current, overview: { ...current.overview, [key]: value } }));
  }

  function updateDescription(html: string) {
    onStatusMessage("");
    setForm((current) => ({ ...current, description: html }));
  }

  function startSubmit() {
    if (!richTextToPlain(form.description)) {
      setErrorMessage(`Write the ${type} description before submitting.`);
      return;
    }

    setErrorMessage("");
    setConfirmingSubmit(true);
  }

  const returned = document?.status === "Rejected" ? document.lastDecision : null;

  return (
    <>
      {returned && (
        <div className="document-returned-note" role="status">
          <strong>
            Returned by the {returned.reviewer === "BDO" ? "Business Development Officer" : "Group Head"}
          </strong>
          <p>{returned.comment || "No reason was given."}</p>
        </div>
      )}

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>{type} Overview</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field-row">
            {OVERVIEW_FIELDS.slice(0, 2).map((field) => (
              <div className="form-field" key={field.key}>
                <label htmlFor={`doc-${field.key}`}>{field.label}</label>
                <input
                  placeholder=" "
                  id={`doc-${field.key}`}
                  type="text"
                  value={form.overview[field.key]}
                  onChange={(event) => updateOverview(field.key, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="form-field-row">
            {OVERVIEW_FIELDS.slice(2).map((field) => (
              <div className="form-field" key={field.key}>
                <label htmlFor={`doc-${field.key}`}>{field.label}</label>
                <input
                  placeholder=" "
                  id={`doc-${field.key}`}
                  type="text"
                  value={form.overview[field.key]}
                  onChange={(event) => updateOverview(field.key, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="form-field">
            <label htmlFor="doc-introduction">Introduction</label>
            <textarea
              placeholder=" "
              id="doc-introduction"
              rows={3}
              value={form.overview.introduction}
              onChange={(event) => updateOverview("introduction", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Description</h2>
            <p>Use the toolbar to format headings, lists, highlights, links and more.</p>
          </div>
        </div>

        <div className="proposal-section">
          <RichTextEditor
            id="doc-description"
            ariaLabel={`${type} description`}
            value={form.description}
            onChange={updateDescription}
            placeholder={`Describe the ${DOCUMENT_META[type].name.toLowerCase()}…`}
          />
        </div>
      </section>

      <div className="bdo-action-bar bdo-action-bar--static">
        <div>
          <p className="bdo-action-bar_hint">
            {document ? `${type} saved. Save again after any changes.` : `Save your ${type} as a draft at any time.`}
          </p>

          {statusMessage && (
            <p className="brd-status-message" role="status">
              {statusMessage}
            </p>
          )}

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="brd-reviews-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => navigate(`/dashboard/initiatives/${initiativeId}`)}
          >
            Cancel
          </button>

          <button
            type="button"
            className="button button--dark"
            onClick={() => saveMutation.mutate()}
            disabled={isBusy || !isDirty}
          >
            {saveMutation.isPending ? "Saving…" : `Save ${type}`}
          </button>

          {document && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => printDocument(document, initiativeName)}
              disabled={isBusy}
              title={isDirty ? "Downloads the last saved version" : undefined}
            >
              <Download size={17} aria-hidden="true" />
              Download {type}
            </button>
          )}
        </div>
      </div>

      <div className="bdo-action-bar bdo-action-bar--static brd-submit-bar">
        <p className="bdo-action-bar_hint">
          {returned
            ? `Made the changes asked for? Resubmit the ${type} for review.`
            : `When the ${type} is complete, submit it to the Business Development Officer for review.`}
        </p>

        <button type="button" className="button button--primary" onClick={startSubmit} disabled={isBusy}>
          {submitMutation.isPending ? "Submitting…" : returned ? "Resubmit for review" : "Submit for review"}
        </button>
      </div>

      {confirmingSubmit && (
        <div className="modal-overlay" role="presentation" onClick={() => !isBusy && setConfirmingSubmit(false)}>
          <div
            className="modal-panel modal-panel--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-submit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="doc-submit-title">{returned ? "Resubmit for review" : "Submit for review"}</h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                This saves your latest changes and sends the {type} to the Business Development
                Officer. You won't be able to edit it while it's being reviewed.
              </p>
            </div>

            <div className="modal-panel_footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setConfirmingSubmit(false)}
                disabled={isBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={() => submitMutation.mutate()}
                disabled={isBusy}
              >
                {isBusy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// PM's page for one initiative's PID / FRD / BRD / SWR. Editable while it's
// a draft or has been returned; read-only while it's with a reviewer or
// once approved.
function DocumentEditor() {
  const { id, docType } = useParams<{ id: string; docType: string }>();
  const [statusMessage, setStatusMessage] = useState("");
  const type = documentTypeFromSlug(docType);
  const initiativeId = id as string;

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(initiativeId),
    enabled: Boolean(id),
  });

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", id],
    queryFn: () => getDiscoveryByInitiativeId(initiativeId),
    enabled: Boolean(id),
  });

  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(id),
    queryFn: () => getInitiativeDocuments(initiativeId),
    enabled: Boolean(id),
  });

  const listPath = type ? documentHubPath(type) : "/dashboard/my-work";
  const back = <BackLink fallbackTo={listPath} fallbackLabel={type ? `Back to ${type}s` : "Back to my work"} />;

  if (!type) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiative-detail-message">This document type doesn't exist.</p>
      </div>
    );
  }

  if (initiativeQuery.isLoading || discoveryQuery.isLoading || documentsQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading {type}…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data || documentsQuery.isError) {
    return (
      <div className="dashboard-page">
        {back}
        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this {type}. Try refreshing the page.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;
  const document = documents[type];
  const bdoDocsApproved = discoveryQuery.data?.status === "Approved";
  const editable = isEditable(document);

  return (
    <div className="dashboard-page">
      {back}

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / {type}s / {initiative.projectName}
          </p>

          <h1 className="dashboard-title">{DOCUMENT_META[type].name}</h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span>{initiative.projectName}</span>
            <span className={documentStatusBadgeClass(document?.status)}>
              {documentStatusLabel(document?.status)}
            </span>
            {document && document.version > 0 && <span className="brd-version-tag">v{document.version}</span>}
          </p>
        </div>
      </header>

      <DocumentTabs
        documents={documents}
        pathFor={(tabType) => documentEditorPath(initiativeId, tabType)}
      />

      {!bdoDocsApproved ? (
        <p className="initiatives-empty initiative-detail-message">
          The {type} can be started once the Group Head approves the BDO's documentation for this
          initiative.
        </p>
      ) : editable ? (
        <DocumentForm
          key={`${type}-${document?.status ?? "new"}`}
          initiativeId={initiativeId}
          initiativeName={initiative.projectName}
          type={type}
          document={document}
          // Only this document's own "saved" message, not one from another tab.
          statusMessage={statusMessage.startsWith(`${type} `) ? statusMessage : ""}
          onStatusMessage={setStatusMessage}
        />
      ) : (
        document && (
          <>
            <p className="initiatives-empty initiative-detail-message">
              {document.status === "Approved"
                ? `This ${type} has been approved.`
                : `This ${type} is ${documentStatusLabel(document.status).toLowerCase()} for review and is read-only until a decision is made.`}
            </p>

            <DocumentReadOnlyView
              document={document}
              onDownload={() => printDocument(document, initiative.projectName)}
            />
          </>
        )
      )}
    </div>
  );
}

export default DocumentEditor;
