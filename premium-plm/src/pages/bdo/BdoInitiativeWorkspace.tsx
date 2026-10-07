import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, FileText, Link2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import {
  addDiscoveryWorkflowLink,
  createDiscovery,
  deleteDiscoveryAttachment,
  getDiscoveryAttachments,
  getDiscoveryByInitiativeId,
  getDiscoveryWorkflowLinks,
  openDiscoveryAttachment,
  resubmitDiscovery,
  submitDiscovery,
  updateDiscovery,
  uploadDiscoveryAttachments,
} from "../../service/ProductDiscoveryService";
import { getAllUsers } from "../../service/UserService";
import { ApiError } from "../../apicalls/apiClient";
import { EMPTY_DISCOVERY_FORM } from "../../types/discoveryTypes";
import type { DiscoveryFormFields, ProductDiscovery } from "../../types/discoveryTypes";
import { capitalize } from "../../utils/text";
import { isAwaitingGroupHeadDecision } from "../../utils/initiativeStatus";
import BdoSubmittedPanel from "../../components/bdo/BdoSubmittedPanel";

function BdoInitiativeWorkspace() {
  const { initiativeId } = useParams<{ initiativeId: string }>();
  const navigate = useNavigate();

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", initiativeId],
    queryFn: () => getInitiativeById(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", initiativeId],
    queryFn: () => getDiscoveryByInitiativeId(initiativeId as string),
    enabled: Boolean(initiativeId),
  });

  if (initiativeQuery.isLoading || discoveryQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading workspace…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data || !initiativeId) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/bdo" className="text-button">
          <ArrowLeft size={15} />
          Back to BDO workspace
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative. It may not exist, or you may not
          have access to it.
        </p>
      </div>
    );
  }

  if (discoveryQuery.isError) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/bdo" className="text-button">
          <ArrowLeft size={15} />
          Back to BDO workspace
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load the discovery document for this initiative. Try
          refreshing the page.
        </p>
      </div>
    );
  }

  const initiative = initiativeQuery.data;

  return (
    <BdoInitiativeWorkspaceForm
      key={initiativeId}
      initiativeId={initiativeId}
      initiativeName={initiative.projectName}
      initialDiscovery={discoveryQuery.data ?? null}
      onNavigateAway={() => navigate("/dashboard/bdo")}
      onViewInitiative={() => navigate(`/dashboard/initiatives/${initiativeId}`)}
    />
  );
}

interface BdoInitiativeWorkspaceFormProps {
  initiativeId: string;
  initiativeName: string;
  initialDiscovery: ProductDiscovery | null;
  onNavigateAway: () => void;
  onViewInitiative: () => void;
}

function BdoInitiativeWorkspaceForm({
  initiativeId,
  initiativeName,
  initialDiscovery,
  onNavigateAway,
  onViewInitiative,
}: BdoInitiativeWorkspaceFormProps) {
  const queryClient = useQueryClient();
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [discoveryId, setDiscoveryId] = useState<string | null>(
    initialDiscovery?.id ?? null,
  );
  const [form, setForm] = useState<DiscoveryFormFields>(
    initialDiscovery ?? EMPTY_DISCOVERY_FORM,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Auto-dismisses the "Discovery document saved." message rather than
  // leaving it sitting on screen indefinitely.
  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = setTimeout(() => setStatusMessage(""), 30_000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");

  function updateField<K extends keyof DiscoveryFormFields>(
    key: K,
    value: DiscoveryFormFields[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const attachmentsQuery = useQuery({
    queryKey: ["discovery-attachments", discoveryId],
    queryFn: () => getDiscoveryAttachments(discoveryId as string),
    enabled: Boolean(discoveryId),
  });

  const workflowLinksQuery = useQuery({
    queryKey: ["discovery-workflow-links", discoveryId],
    queryFn: () => getDiscoveryWorkflowLinks(discoveryId as string),
    enabled: Boolean(discoveryId),
  });

  // Same query key the parent's discoveryQuery already populated, so this
  // reads the cached record immediately with no extra loading flash, and
  // picks up fresh data once saveDiscoveryMutation/submitMutation
  // invalidate it.
  const discoveryStatusQuery = useQuery({
    queryKey: ["product-discovery", initiativeId],
    queryFn: () => getDiscoveryByInitiativeId(initiativeId),
    enabled: Boolean(initiativeId),
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  function reviewerName(userId: string | null) {
    if (!userId) {
      return "the Group Head";
    }

    return capitalize(
      usersQuery.data?.find((user) => user.userId === userId)?.userName ?? "the Group Head",
    );
  }

  // "NotStarted" is our own placeholder for "no discovery record exists
  // yet". "Submitted", "Rejected", and "Approved" are confirmed live.
  const submissionStatus = discoveryStatusQuery.data?.status ?? "NotStarted";
  // Locked while awaiting a decision or once approved — editing shouldn't
  // be possible until the Group Head has responded. A rejection unlocks it
  // again so the BDO can fix and resubmit.
  const isLocked = isAwaitingGroupHeadDecision(submissionStatus) || submissionStatus === "Approved";

  const saveDiscoveryMutation = useMutation({
    mutationFn: async () => {
      if (discoveryId) {
        await updateDiscovery(initiativeId, form);
        return discoveryId;
      }

      const created = await createDiscovery({
        productInitiativeId: initiativeId,
        ...form,
      });

      if (created?.id) {
        return created.id;
      }

      const refetched = await getDiscoveryByInitiativeId(initiativeId);
      return refetched?.id ?? null;
    },
    onSuccess: (savedId) => {
      setDiscoveryId(savedId);
      setStatusMessage("Discovery document saved.");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["product-discovery", initiativeId] });
    },
    onError: (error) => {
      setStatusMessage("");
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to save the discovery document.",
      );
    },
  });

  const uploadAttachmentsMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadDiscoveryAttachments(discoveryId as string, files, setUploadProgress),
    onSuccess: () => {
      setUploadProgress(null);
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["discovery-attachments", discoveryId] });
    },
    onError: (error) => {
      setUploadProgress(null);
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to upload that file. Try again.",
      );
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteDiscoveryAttachment(attachmentId),
    onSuccess: () => {
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["discovery-attachments", discoveryId] });
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to remove that attachment. Try again.",
      );
    },
  });

  const openAttachmentMutation = useMutation({
    mutationFn: ({ attachmentId, targetWindow }: { attachmentId: string; targetWindow: Window | null }) =>
      openDiscoveryAttachment(attachmentId, targetWindow),
    onSuccess: () => setErrorMessage(""),
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to open that attachment. Try again.",
      );
    },
  });

  // Opened synchronously in the click handler (before the mutation's first
  // await) so browsers still treat it as a user-gesture-triggered window,
  // not a blocked popup.
  function handleOpenAttachment(attachmentId: string) {
    const targetWindow = window.open("", "_blank");
    openAttachmentMutation.mutate({ attachmentId, targetWindow });
  }

  const addLinkMutation = useMutation({
    mutationFn: () =>
      addDiscoveryWorkflowLink(discoveryId as string, {
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        description: linkDescription.trim(),
      }),
    onSuccess: () => {
      setLinkTitle("");
      setLinkUrl("");
      setLinkDescription("");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["discovery-workflow-links", discoveryId] });
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to add that link. Try again.",
      );
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (submissionStatus === "Rejected") {
        await resubmitDiscovery(discoveryId as string);
      } else {
        await submitDiscovery(discoveryId as string);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-discovery", initiativeId] });
      setHasSubmitted(true);
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to submit documentation for approval. Try again.",
      );
    },
  });

  const attachments = attachmentsQuery.data ?? [];
  const workflowLinks = workflowLinksQuery.data ?? [];

  const canSubmit =
    Boolean(discoveryId) && attachments.length > 0 && workflowLinks.length > 0;

  // What's still missing before submission, in the order the steps appear.
  const missingSteps = [
    !discoveryId && "save the discovery document",
    attachments.length === 0 && "upload a document",
    workflowLinks.length === 0 && "add a design link",
  ].filter((step): step is string => Boolean(step));

  // Progress strip: each step is done once its part is in place, and the
  // first undone step is the one the BDO is on.
  const steps = [
    { label: "Discovery", done: Boolean(discoveryId) },
    { label: "Documents", done: attachments.length > 0 },
    { label: "Design links", done: workflowLinks.length > 0 },
    { label: "Submit", done: isLocked },
  ];
  const currentStepIndex = steps.findIndex((step) => !step.done);

  const isBusy =
    saveDiscoveryMutation.isPending ||
    uploadAttachmentsMutation.isPending ||
    addLinkMutation.isPending ||
    submitMutation.isPending;

  if (hasSubmitted) {
    return (
      <div className="dashboard-page">
        <BdoSubmittedPanel
          initiativeName={initiativeName}
          onBackToWork={onNavigateAway}
          onViewInitiative={onViewInitiative}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-page bdo-workspace">
      <Link to="/dashboard/bdo" className="text-button">
        <ArrowLeft size={15} />
        Back to BDO workspace
      </Link>

      <header className="bdo-workspace-header">
        <div className="bdo-workspace-header_text">
          <p className="dashboard-breadcrumb">
            PremiumPLM / BDO workspace / {initiativeName}
          </p>

          <h1 className="dashboard-title">{initiativeName}</h1>

          <p className="dashboard-subtitle">
            Prepare the product discovery, attachments, and design links,
            then submit for Group Head approval.
          </p>
        </div>

        <ol className="bdo-steps" aria-label="Progress">
          {steps.map((step, index) => {
            const stateClass = step.done
              ? "bdo-step--done"
              : index === currentStepIndex
                ? "bdo-step--current"
                : "";

            return (
              <li key={step.label} className={`bdo-step ${stateClass}`}>
                <span className="bdo-step_marker">
                  {step.done ? <Check size={13} /> : index + 1}
                </span>
                <span className="bdo-step_label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      {isAwaitingGroupHeadDecision(submissionStatus) && (
        <p className="brd-status-message" role="status">
          Submitted — awaiting the Group Head's decision.
        </p>
      )}

      {submissionStatus === "Approved" && (
        <p className="brd-status-message" role="status">
          Approved by {reviewerName(discoveryStatusQuery.data?.reviewedByUserId ?? null)}. The
          Project Manager has been notified and can begin BRD preparation.
        </p>
      )}

      {submissionStatus === "Rejected" && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by {reviewerName(discoveryStatusQuery.data?.reviewedByUserId ?? null)}:</strong>{" "}
          {discoveryStatusQuery.data?.reviewComment || "No comment was provided."} Revise your
          documentation and resubmit.
        </div>
      )}

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

      <section className="dashboard-panel bdo-card">
        <div className="bdo-card_header">
          <h2>Product discovery</h2>
          <p>Describe the product. Changes are saved to the initiative directly.</p>
        </div>

        <div className="bdo-fields-grid">
          <div className="form-field">
            <label htmlFor="businessLogic">Business logic</label>
            <textarea
              id="businessLogic"
              rows={5}
              disabled={isLocked}
              value={form.businessLogic}
              onChange={(event) => updateField("businessLogic", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="customerJourney">Customer journey</label>
            <textarea
              id="customerJourney"
              rows={5}
              disabled={isLocked}
              value={form.customerJourney}
              onChange={(event) => updateField("customerJourney", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="userFlow">User flow</label>
            <textarea
              id="userFlow"
              rows={5}
              disabled={isLocked}
              value={form.userFlow}
              onChange={(event) => updateField("userFlow", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="businessProcess">Business process</label>
            <textarea
              id="businessProcess"
              rows={5}
              disabled={isLocked}
              value={form.businessProcess}
              onChange={(event) => updateField("businessProcess", event.target.value)}
            />
          </div>

          <div className="form-field bdo-field--wide">
            <label htmlFor="assumptions">Assumptions</label>
            <textarea
              id="assumptions"
              rows={4}
              disabled={isLocked}
              value={form.assumptions}
              onChange={(event) => updateField("assumptions", event.target.value)}
            />
          </div>
        </div>

        {!isLocked && (
          <div className="bdo-card_footer">
            <p className="bdo-card_hint">
              {discoveryId
                ? "Saved to this initiative. Save again after you edit."
                : "Save to create the discovery document for this initiative."}
            </p>

            <button
              type="button"
              className="button button--primary"
              onClick={() => saveDiscoveryMutation.mutate()}
              disabled={isBusy}
            >
              {discoveryId
                ? saveDiscoveryMutation.isPending ? "Saving…" : "Save discovery"
                : saveDiscoveryMutation.isPending ? "Creating…" : "Create discovery"}
            </button>
          </div>
        )}
      </section>

      <section className="dashboard-panel bdo-card">
        <div className="bdo-card_header">
          <h2>Documents</h2>
          <p>Logic flow document and any other supporting files.</p>
        </div>

        {uploadProgress !== null && (
          <div className="bdo-upload-progress">
            <div className="bdo-upload-progress_track">
              <span
                className="bdo-upload-progress_fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="bdo-upload-progress_label">Uploading… {uploadProgress}%</span>
          </div>
        )}

        <div className="bdo-upload-section">
          {attachments.length === 0 ? (
            <p className="bdo-upload-empty">No documents uploaded yet.</p>
          ) : (
            <ul className="bdo-upload-list">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="bdo-upload-list_item">
                  <span className="bdo-upload-list_icon">
                    <FileText size={16} />
                  </span>

                  <div className="bdo-upload-list_info">
                    <span className="bdo-upload-list_name">{attachment.fileName}</span>
                  </div>

                  <button
                    type="button"
                    className="bdo-upload-list_open"
                    onClick={() => handleOpenAttachment(attachment.id)}
                    disabled={openAttachmentMutation.isPending}
                  >
                    Open
                  </button>

                  {!isLocked && (
                    <button
                      type="button"
                      className="bdo-upload-list_remove"
                      onClick={() => removeAttachmentMutation.mutate(attachment.id)}
                      disabled={removeAttachmentMutation.isPending}
                      aria-label={`Remove ${attachment.fileName}`}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            if (files.length > 0) uploadAttachmentsMutation.mutate(files);
            event.target.value = "";
          }}
        />

        {!isLocked && (
          <div className="bdo-card_footer">
            <p className="bdo-card_hint">
              {discoveryId
                ? "Accepted: any file type. Upload as many as you need."
                : "Save the discovery document first."}
            </p>

            <button
              type="button"
              className="button button--secondary"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={uploadAttachmentsMutation.isPending || !discoveryId}
              title={!discoveryId ? "Save discovery first" : undefined}
            >
              {uploadAttachmentsMutation.isPending ? "Uploading…" : "Upload files"}
            </button>
          </div>
        )}
      </section>

      <section className="dashboard-panel bdo-card">
        <div className="bdo-card_header">
          <h2>Design links</h2>
          <p>Links to design screens or other resources.</p>
        </div>

        <div className="bdo-upload-section">
          {workflowLinks.length === 0 ? (
            <p className="bdo-upload-empty">No links added yet.</p>
          ) : (
            <ul className="bdo-upload-list">
              {workflowLinks.map((link) => (
                <li key={link.id} className="bdo-upload-list_item">
                  <span className="bdo-upload-list_icon">
                    <Link2 size={16} />
                  </span>

                  <div className="bdo-upload-list_info">
                    <span className="bdo-upload-list_name">{link.title}</span>
                    {link.description && (
                      <span className="bdo-upload-list_meta">{link.description}</span>
                    )}
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bdo-upload-list_open"
                  >
                    Open link
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isLocked && (
          <div className="bdo-link-form">
            <div className="bdo-fields-grid">
              <div className="form-field">
                <label htmlFor="linkTitle">Title</label>
                <input
                  id="linkTitle"
                  type="text"
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  placeholder="e.g. Design screens (Figma)"
                />
              </div>

              <div className="form-field">
                <label htmlFor="linkUrl">URL</label>
                <input
                  id="linkUrl"
                  type="url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="form-field bdo-field--wide">
                <label htmlFor="linkDescription">Description</label>
                <input
                  id="linkDescription"
                  type="text"
                  value={linkDescription}
                  onChange={(event) => setLinkDescription(event.target.value)}
                  placeholder="Briefly describe this link"
                />
              </div>
            </div>

            <div className="bdo-card_footer">
              <p className="bdo-card_hint">
                {discoveryId
                  ? "Add a link, then it appears in the list above."
                  : "Save the discovery document first."}
              </p>

              <button
                type="button"
                className="button button--secondary"
                onClick={() => addLinkMutation.mutate()}
                disabled={
                  addLinkMutation.isPending || !linkTitle.trim() || !linkUrl.trim() || !discoveryId
                }
              >
                {addLinkMutation.isPending ? "Submitting…" : "Submit link"}
              </button>
            </div>
          </div>
        )}
      </section>

      {!isLocked && (
        <div className="bdo-action-bar">
          <p className="bdo-action-bar_hint">
            {canSubmit
              ? "Everything is in place. Submit when you're ready."
              : `Still needed: ${missingSteps.join(", ")}.`}
          </p>

          <button
            type="button"
            className="button button--primary"
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || isBusy}
            title={!canSubmit ? "Save discovery and upload both document types first" : undefined}
          >
            {submitMutation.isPending
              ? "Submitting…"
              : submissionStatus === "Rejected"
                ? "Resubmit for approval"
                : "Submit for approval"}
          </button>
        </div>
      )}
    </div>
  );
}

export default BdoInitiativeWorkspace;
