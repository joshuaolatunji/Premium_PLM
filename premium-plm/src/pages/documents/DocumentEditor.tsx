import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Sparkles } from "lucide-react";

import { getInitiativeById } from "../../service/InitiativeService";
import { getDiscoveryByInitiativeId } from "../../service/ProductDiscoveryService";
import { getInitiativeDocuments, saveDocument, submitDocument } from "../../service/DocumentService";
import { generateDocumentDescription, isAiAvailable } from "../../service/AiService";
import { getCurrentUserId, getStoredUser } from "../../apicalls/authStorage";
import type { ProductInitiative } from "../../types/initiativeTypes";
import type { ProductDiscovery } from "../../types/discoveryTypes";
import { priorityLabel } from "../../utils/initiativeStatus";
import { resolvePrimaryRole } from "../../utils/roleRouting";
import ApprovalWorkflowPanel from "../../components/approvals/ApprovalWorkflowPanel";
import { DOCUMENT_META, EMPTY_OVERVIEW, documentTypeFromSlug } from "../../types/documentTypes";
import type {
  DocumentOverview,
  DocumentType,
  ProductDocument,
  SaveDocumentRequest,
} from "../../types/documentTypes";
import {
  documentStatusClass,
  documentStatusText,
  documentsQueryKey,
  isEditable,
  EMPTY_DOCUMENTS,
} from "../../utils/documentStatus";
import { richTextToPlain } from "../../utils/richText";
import { useDraftState } from "../../utils/useDraftState";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";
import { downloadDocument, previewDocument } from "../../utils/printDocument";
import { documentEditorPath, documentHubPath } from "../../utils/documentRoutes";
import { capitalize } from "../../utils/text";
import BackLink from "../../components/common/BackLink";
import DocumentTabs from "../../components/documents/DocumentTabs";
import DocumentPager from "../../components/documents/DocumentPager";
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
  // What "Generate with AI" writes from, along with the Overview.
  initiative: ProductInitiative;
  discovery: ProductDiscovery | null;
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
  initiative,
  discovery,
  type,
  document,
  statusMessage,
  onStatusMessage,
}: DocumentFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = getCurrentUserId() ?? "";

  // Starts from what's on the server (or, for a new document, the PM's own
  // name filled in). Unsaved edits are kept on this device until saved —
  // see useDraftState.
  const [form, setForm, draft] = useDraftState<SaveDocumentRequest>(`document:${initiativeId}:${type}`, () => {
    if (document) {
      return { overview: document.overview, description: document.description };
    }

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
      draft.markSaved();
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
      draft.markSaved();
      setConfirmingSubmit(false);
      setErrorMessage("");
      await refresh();
    },
    onError: (error) => {
      setConfirmingSubmit(false);
      setErrorMessage(error instanceof Error ? error.message : `Couldn't submit the ${type}.`);
    },
  });

  // "Generate with AI": a first draft of the Description from the initiative,
  // the BDO's discovery notes and this Overview. Replacing existing text
  // asks first; either way, Undo in the editor brings the old text back.
  const [confirmingAi, setConfirmingAi] = useState(false);
  const aiAvailable = isAiAvailable();

  const aiMutation = useMutation({
    mutationFn: () =>
      generateDocumentDescription({
        type,
        initiative: {
          projectName: initiative.projectName,
          description: initiative.description,
          priority: priorityLabel(initiative.priority),
          timelineDays: initiative.timelineDays ?? null,
        },
        discovery: discovery ? { businessLogic: discovery.businessLogic ?? "", userFlow: discovery.userFlow ?? "" } : null,
        overview: form.overview,
      }),
    onSuccess: (html) => {
      setConfirmingAi(false);
      setErrorMessage("");
      updateDescription(html);
      onStatusMessage(`${type} description drafted with AI. Read it through and edit it before saving; Undo brings back the previous text.`);
    },
    onError: (error) => {
      setConfirmingAi(false);
      setErrorMessage(error instanceof Error ? error.message : "Couldn't generate a description. Try again.");
    },
  });

  function startAi() {
    setErrorMessage("");

    if (richTextToPlain(form.description)) {
      setConfirmingAi(true);
    } else {
      aiMutation.mutate();
    }
  }

  const isBusy = saveMutation.isPending || submitMutation.isPending || aiMutation.isPending;

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

  const returned = document?.status === "Rejected";
  // Why it was returned (the API doesn't say who by yet, so reviewer is often null).
  const decision = returned ? document?.lastDecision : null;

  return (
    <>
      <DraftRestoredNotice
        savedAt={draft.restoredAt}
        onDiscard={draft.discard}
        keepHint={`Save the ${type} to keep them.`}
      />

      {returned && (
        <div className="document-returned-note" role="status">
          <strong>
            {decision?.reviewer
              ? `Returned by the ${decision.reviewer === "BDO" ? "Business Development Officer" : "Group Head"}`
              : "Returned for changes"}
          </strong>
          <p>
            {decision?.comment ||
              "A reviewer sent this back for changes. Make the updates they asked for, then resubmit it."}
          </p>
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
            disabled={aiMutation.isPending}
            toolbarAction={
              <button
                type="button"
                className="rte-ai-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={startAi}
                disabled={!aiAvailable || isBusy}
                title={
                  aiAvailable
                    ? `Write a first draft from the initiative, the BDO's notes and the ${type} Overview`
                    : "Generate with AI isn't set up yet"
                }
              >
                <Sparkles size={16} aria-hidden="true" />
                {aiMutation.isPending ? "Generating…" : "Generate with AI"}
              </button>
            }
          />

          {aiMutation.isPending && (
            <p className="ai-note" role="status">
              Writing a first draft of the {type} description… this can take up to half a minute.
            </p>
          )}

          {confirmingAi && (
            <div className="ai-confirm" role="alertdialog" aria-label="Replace the description?">
              <p>
                <strong>Replace the current description?</strong> The AI draft replaces what's in the box
                now. You can bring it back with Undo.
              </p>

              <div className="brd-reviews-actions">
                <button type="button" className="button button--secondary" onClick={() => setConfirmingAi(false)}>
                  Cancel
                </button>
                <button type="button" className="button button--primary" onClick={() => aiMutation.mutate()}>
                  <Sparkles size={16} aria-hidden="true" />
                  Replace with AI draft
                </button>
              </div>
            </div>
          )}
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
            <>
              <button
                type="button"
                className="button button--dark"
                onClick={() => void previewDocument(document, initiativeName)}
                disabled={isBusy}
                title={isDirty ? "Shows the last saved version" : undefined}
              >
                <Eye size={17} aria-hidden="true" />
                Preview
              </button>

              <button
                type="button"
                className="button button--dark"
                onClick={() => void downloadDocument(document, initiativeName)}
                disabled={isBusy}
                title={isDirty ? "Downloads the last saved version" : undefined}
              >
                <Download size={17} aria-hidden="true" />
                Download {type}
              </button>
            </>
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

      <DocumentPager current={type} pathFor={(tabType) => documentEditorPath(initiativeId, tabType)} />

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
    // Documents can only exist once the BDO's documentation is approved —
    // asking earlier would only return 404s.
    enabled: Boolean(id) && discoveryQuery.data?.status === "Approved",
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

          <h1 className="dashboard-title">
            {initiative.projectName} {type}
          </h1>

          <p className="dashboard-subtitle initiative-detail-badges">
            <span>{DOCUMENT_META[type].name}</span>
            <span className={documentStatusClass(document)}>
              {documentStatusText(document)}
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
          initiative={initiative}
          discovery={discoveryQuery.data ?? null}
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
              {document.signOff && !document.signOff.complete
                ? `This ${type} has been approved and is out for sign-off.`
                : document.status === "Approved"
                  ? `This ${type} has been approved.`
                  : document.status === "Cancelled"
                    ? `This ${type} has been cancelled.`
                    : `This ${type} is with the ${document.status === "PendingGroupHeadReview" ? "Group Head" : "BDO"} for review and is read-only until a decision is made.`}
            </p>

            {document.status === "Approved" && (
              <ApprovalWorkflowPanel
                // Each document has its own sign-off: a fresh panel per document.
                key={document.id}
                document={document}
                initiativeName={initiative.projectName}
                canManage={resolvePrimaryRole(getStoredUser()?.roles ?? []) === "ProjectManager"}
              />
            )}

            <DocumentReadOnlyView
              document={document}
              initiativeName={initiative.projectName}
            />

            <DocumentPager current={type} pathFor={(tabType) => documentEditorPath(initiativeId, tabType)} />
          </>
        )
      )}
    </div>
  );
}

export default DocumentEditor;
