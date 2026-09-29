import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import {
  createDiscovery,
  getDiscoveryByInitiativeId,
  updateDiscovery,
} from "../../service/ProductDiscoveryService";
import {
  getBdoRejection,
  getDesignScreens,
  getLogicFlowDocuments,
  getSubmissionStatus,
  removeDesignScreen,
  removeLogicFlowDocument,
  submitBdoDocumentation,
  uploadDesignScreen,
  uploadLogicFlowDocument,
} from "../../mocks/bdoDocumentsMock";
import { ApiError } from "../../apicalls/apiClient";
import { EMPTY_DISCOVERY_FORM } from "../../types/discoveryTypes";
import type { DiscoveryFormFields, ProductDiscovery } from "../../types/discoveryTypes";
import UploadedFileList from "../../components/bdo/UploadedFileList";
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
  const logicFlowInputRef = useRef<HTMLInputElement>(null);
  const designScreenInputRef = useRef<HTMLInputElement>(null);

  const [discoveryId, setDiscoveryId] = useState<string | null>(
    initialDiscovery?.id ?? null,
  );
  const [form, setForm] = useState<DiscoveryFormFields>(
    initialDiscovery ?? EMPTY_DISCOVERY_FORM,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function updateField<K extends keyof DiscoveryFormFields>(
    key: K,
    value: DiscoveryFormFields[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const logicFlowQuery = useQuery({
    queryKey: ["bdo-logic-flow", initiativeId],
    queryFn: () => getLogicFlowDocuments(initiativeId),
  });

  const designScreensQuery = useQuery({
    queryKey: ["bdo-design-screens", initiativeId],
    queryFn: () => getDesignScreens(initiativeId),
  });

  const submissionStatusQuery = useQuery({
    queryKey: ["bdo-submission-status", initiativeId],
    queryFn: () => getSubmissionStatus(initiativeId),
  });

  const rejectionQuery = useQuery({
    queryKey: ["bdo-rejection", initiativeId],
    queryFn: () => getBdoRejection(initiativeId),
  });

  const submissionStatus = submissionStatusQuery.data ?? "NotStarted";
  // Locked while awaiting a decision or once approved — editing shouldn't
  // be possible until the Group Head has responded. A rejection unlocks it
  // again so the BDO can fix and resubmit.
  const isLocked =
    submissionStatus === "SubmittedForApproval" || submissionStatus === "Approved";

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

  const uploadLogicFlowMutation = useMutation({
    mutationFn: (file: File) => uploadLogicFlowDocument(initiativeId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bdo-logic-flow", initiativeId] });
    },
  });

  const removeLogicFlowMutation = useMutation({
    mutationFn: (fileId: string) => removeLogicFlowDocument(initiativeId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bdo-logic-flow", initiativeId] });
    },
  });

  const uploadDesignScreenMutation = useMutation({
    mutationFn: (file: File) => uploadDesignScreen(initiativeId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bdo-design-screens", initiativeId] });
    },
  });

  const removeDesignScreenMutation = useMutation({
    mutationFn: (fileId: string) => removeDesignScreen(initiativeId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bdo-design-screens", initiativeId] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitBdoDocumentation(initiativeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bdo-submission-status", initiativeId],
      });
      queryClient.invalidateQueries({ queryKey: ["bdo-rejection", initiativeId] });
      setHasSubmitted(true);
    },
    onError: () => {
      setErrorMessage("Unable to submit documentation for approval. Try again.");
    },
  });

  const logicFlowFiles = logicFlowQuery.data ?? [];
  const designScreenFiles = designScreensQuery.data ?? [];

  const canSubmit =
    Boolean(discoveryId) && logicFlowFiles.length > 0 && designScreenFiles.length > 0;

  const isBusy =
    saveDiscoveryMutation.isPending ||
    uploadLogicFlowMutation.isPending ||
    uploadDesignScreenMutation.isPending ||
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
    <div className="dashboard-page">
      <Link to="/dashboard/bdo" className="text-button">
        <ArrowLeft size={15} />
        Back to {initiativeName}
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / BDO workspace / {initiativeName}
          </p>

          <h1 className="dashboard-title">{initiativeName}</h1>

          <p className="dashboard-subtitle">
            Prepare the product discovery, logic flow, and design screens
            documentation, then submit for Group Head approval.
          </p>
        </div>

        <div className="dashboard-header__actions">
          {!isLocked && (
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
          )}
        </div>
      </header>

      <p className="mock-data-notice">
        Document uploads and submission status here are temporary, local-only
        data until the real endpoints are ready — they reset if you reload
        the page.
      </p>

      {submissionStatus === "SubmittedForApproval" && (
        <p className="brd-status-message" role="status">
          Submitted — awaiting the Group Head's decision.
        </p>
      )}

      {submissionStatus === "Approved" && (
        <p className="brd-status-message" role="status">
          Approved by the Group Head. The Project Manager has been notified
          and can begin BRD preparation.
        </p>
      )}

      {submissionStatus === "Rejected" && rejectionQuery.data && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by the Group Head:</strong> {rejectionQuery.data.comment}
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

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Product discovery</h2>
            <p>Real, saved to the initiative directly.</p>
          </div>

          {!isLocked && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => saveDiscoveryMutation.mutate()}
              disabled={isBusy}
            >
              {saveDiscoveryMutation.isPending ? "Saving…" : "Save discovery"}
            </button>
          )}
        </div>

        <div className="proposal-section">
          <div className="form-field">
            <label htmlFor="businessLogic">Business logic</label>
            <textarea
              id="businessLogic"
              rows={3}
              disabled={isLocked}
              value={form.businessLogic}
              onChange={(event) => updateField("businessLogic", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="customerJourney">Customer journey</label>
            <textarea
              id="customerJourney"
              rows={3}
              disabled={isLocked}
              value={form.customerJourney}
              onChange={(event) => updateField("customerJourney", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="userFlow">User flow</label>
            <textarea
              id="userFlow"
              rows={3}
              disabled={isLocked}
              value={form.userFlow}
              onChange={(event) => updateField("userFlow", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="businessProcess">Business process</label>
            <textarea
              id="businessProcess"
              rows={3}
              disabled={isLocked}
              value={form.businessProcess}
              onChange={(event) => updateField("businessProcess", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="assumptions">Assumptions</label>
            <textarea
              id="assumptions"
              rows={3}
              disabled={isLocked}
              value={form.assumptions}
              onChange={(event) => updateField("assumptions", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Logic flow document</h2>
            <p>Mocked — no real upload endpoint yet.</p>
          </div>

          {!isLocked && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => logicFlowInputRef.current?.click()}
              disabled={uploadLogicFlowMutation.isPending}
            >
              {uploadLogicFlowMutation.isPending ? "Uploading…" : "Upload file"}
            </button>
          )}

          <input
            ref={logicFlowInputRef}
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadLogicFlowMutation.mutate(file);
              event.target.value = "";
            }}
          />
        </div>

        <div className="bdo-upload-section">
          <UploadedFileList
            files={logicFlowFiles}
            emptyLabel="No logic flow document uploaded yet."
            onRemove={
              isLocked ? undefined : (fileId) => removeLogicFlowMutation.mutate(fileId)
            }
            isRemoving={removeLogicFlowMutation.isPending}
          />
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Design screens documentation</h2>
            <p>Mocked — no real upload endpoint yet. Supports multiple files.</p>
          </div>

          {!isLocked && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => designScreenInputRef.current?.click()}
              disabled={uploadDesignScreenMutation.isPending}
            >
              {uploadDesignScreenMutation.isPending ? "Uploading…" : "Upload file"}
            </button>
          )}

          <input
            ref={designScreenInputRef}
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadDesignScreenMutation.mutate(file);
              event.target.value = "";
            }}
          />
        </div>

        <div className="bdo-upload-section">
          <UploadedFileList
            files={designScreenFiles}
            emptyLabel="No design screens uploaded yet."
            onRemove={
              isLocked ? undefined : (fileId) => removeDesignScreenMutation.mutate(fileId)
            }
            isRemoving={removeDesignScreenMutation.isPending}
          />
        </div>
      </section>
    </div>
  );
}

export default BdoInitiativeWorkspace;
