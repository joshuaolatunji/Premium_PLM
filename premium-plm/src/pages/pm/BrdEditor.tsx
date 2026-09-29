import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInitiativeById } from "../../service/InitiativeService";
import {
  createProposal,
  getProposalByInitiativeId,
  resubmitProposal,
  updateProposal,
} from "../../service/ProposalService";
import { downloadBrdPdf } from "../../service/PdfService";
import {
  getBrdBdoLegStatus,
  getBrdBdoRejection,
  submitBrdToBdo,
} from "../../mocks/brdBdoReviewMock";
import BrdSubmittedPanel from "../../components/brd/BrdSubmittedPanel";
import BrdReadOnlyView from "../../components/brd/BrdReadOnlyView";
import { brdStatusBadgeClass } from "../../utils/brdStatus";
import { ApiError } from "../../apicalls/apiClient";
import {
  EMPTY_PROPOSAL_FORM,
  REQUIREMENT_CATEGORY_VALUES,
  REQUIREMENT_PRIORITY_VALUES,
} from "../../types/proposalTypes";
import type {
  ProductProposal,
  ProductProposalFunctionality,
  ProductProposalUserGroup,
  ProductRequirement,
  ProposalFormFields,
} from "../../types/proposalTypes";

function nextSequence(items: { sequence: number }[]) {
  return items.length ? Math.max(...items.map((item) => item.sequence)) + 1 : 1;
}

// Explicitly whitelists the editable fields rather than destructuring out
// the read-only ones. The real response carries several fields beyond what
// UpdateProductProposalDto accepts (status, version, createdBy, timestamps,
// ...) — since that DTO has additionalProperties: false, spreading any of
// them back into an update payload risks the request being rejected.
function formFieldsFromProposal(proposal: ProductProposal): ProposalFormFields {
  return {
    author: proposal.author,
    userGroup: proposal.userGroup,
    sponsor: proposal.sponsor,
    projectManager: proposal.projectManager,
    introduction: proposal.introduction,
    businessObjective: proposal.businessObjective,
    businessPurpose: proposal.businessPurpose,
    objectivesAndGoals: proposal.objectivesAndGoals,
    targetCustomers: proposal.targetCustomers,
    productPurpose: proposal.productPurpose,
    newApplicationDevelopment: proposal.newApplicationDevelopment,
    replacementOfExistingApplication: proposal.replacementOfExistingApplication,
    rfpOrRfq: proposal.rfpOrRfq,
    needStatement: proposal.needStatement,
    affects: proposal.affects,
    impact: proposal.impact,
    successfulSolution: proposal.successfulSolution,
    projectScope: proposal.projectScope,
    processFlowAsIs: proposal.processFlowAsIs,
    processFlowToBe: proposal.processFlowToBe,
    minimumAmount: proposal.minimumAmount,
    maximumAmount: proposal.maximumAmount,
    tenureInMonths: proposal.tenureInMonths,
    repaymentFrequency: proposal.repaymentFrequency,
    proposedInterestRate: proposal.proposedInterestRate,
    expectedBenefits: proposal.expectedBenefits,
    functionalities: proposal.functionalities ?? [],
    userGroups: proposal.userGroups ?? [],
    requirements: proposal.requirements ?? [],
  };
}

// Fetches the initiative + its BRD (if any), then hands off to the actual
// editor. Keying the editor by initiativeId means it mounts fresh whenever
// you navigate to a different initiative's BRD, so its form state can be
// initialized directly from the loaded data — no effect-based hydration
// needed.
function BrdEditor() {
  const { id } = useParams<{ id: string }>();

  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", id],
    queryFn: () => getInitiativeById(id as string),
    enabled: Boolean(id),
  });

  const proposalQuery = useQuery({
    queryKey: ["product-proposal", id],
    queryFn: () => getProposalByInitiativeId(id as string),
    enabled: Boolean(id),
  });

  if (initiativeQuery.isLoading || proposalQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="initiatives-empty">Loading BRD…</p>
      </div>
    );
  }

  if (initiativeQuery.isError || !initiativeQuery.data || !id) {
    return (
      <div className="dashboard-page">
        <Link to="/dashboard/my-work" className="text-button">
          <ArrowLeft size={15} />
          Back to my work
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative. It may not exist, or you may not have
          access to it.
        </p>
      </div>
    );
  }

  if (proposalQuery.isError) {
    return (
      <div className="dashboard-page">
        <Link to={`/dashboard/initiatives/${id}`} className="text-button">
          <ArrowLeft size={15} />
          Back to {initiativeQuery.data.projectName}
        </Link>

        <p className="initiatives-empty initiatives-empty--error initiative-detail-message">
          Couldn't load this initiative's BRD. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <BrdEditorForm
      key={id}
      initiativeId={id}
      initiativeName={initiativeQuery.data.projectName}
      initialProposal={proposalQuery.data ?? null}
    />
  );
}

interface BrdEditorFormProps {
  initiativeId: string;
  initiativeName: string;
  initialProposal: ProductProposal | null;
}

function BrdEditorForm({
  initiativeId,
  initiativeName,
  initialProposal,
}: BrdEditorFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [proposalId, setProposalId] = useState<string | null>(
    initialProposal?.id ?? null,
  );
  const [form, setForm] = useState<ProposalFormFields>(() =>
    initialProposal ? formFieldsFromProposal(initialProposal) : EMPTY_PROPOSAL_FORM,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"submit" | "resubmit" | null>(null);
  const [submittedAction, setSubmittedAction] = useState<"submit" | "resubmit" | null>(
    null,
  );

  // Reflects the BRD as it was when this page loaded — status/version can
  // change server-side after a submit/resubmit, but we don't get an
  // updated copy back from those endpoints (undocumented response shape),
  // so this doesn't try to guess a new value after those actions.
  const proposalStatus = initialProposal?.status ?? null;
  const proposalVersion = initialProposal?.version ?? null;

  // Mocked — the real submit-for-review endpoint has no concept of a BDO
  // leg. "Submit for review" below lands here first; only once the BDO
  // approves does it call the real endpoint (see mocks/brdBdoReviewMock.ts),
  // so the real `proposalStatus` above stays "Draft" until then.
  const bdoLegQuery = useQuery({
    queryKey: ["brd-bdo-leg", initiativeId],
    queryFn: () => getBrdBdoLegStatus(initiativeId),
    enabled: Boolean(initiativeId),
  });

  const bdoRejectionQuery = useQuery({
    queryKey: ["brd-bdo-rejection", initiativeId],
    queryFn: () => getBrdBdoRejection(initiativeId),
    enabled: Boolean(initiativeId),
  });

  const bdoLegStatus = bdoLegQuery.data ?? null;

  function updateField<K extends keyof ProposalFormFields>(
    key: K,
    value: ProposalFormFields[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (proposalId) {
        await updateProposal(proposalId, {
          projectName: initiativeName,
          ...form,
        });
        return proposalId;
      }

      const created = await createProposal({
        productInitiativeId: initiativeId,
        ...form,
      });

      if (created?.id) {
        return created.id;
      }

      // The create endpoint's response schema is undocumented — if it
      // didn't hand back an id, look it up the same way the read view does.
      const refetched = await getProposalByInitiativeId(initiativeId);

      if (refetched?.id) {
        return refetched.id;
      }

      throw new Error(
        "The BRD was saved, but its id couldn't be confirmed. Refresh the page to continue editing it.",
      );
    },
    onSuccess: (savedProposalId) => {
      setProposalId(savedProposalId);
      setStatusMessage("Draft saved.");
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: ["product-proposal", initiativeId] });
    },
    onError: (error) => {
      setStatusMessage("");
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to save this BRD.",
      );
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitBrdToBdo(initiativeId),
    onSuccess: () => {
      setErrorMessage("");
      setPendingAction(null);
      setSubmittedAction("submit");
      queryClient.invalidateQueries({ queryKey: ["brd-bdo-leg", initiativeId] });
      queryClient.invalidateQueries({ queryKey: ["brd-bdo-rejection", initiativeId] });
    },
    onError: (error) => {
      setPendingAction(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to submit this BRD for review.",
      );
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: () => resubmitProposal(proposalId as string),
    onSuccess: () => {
      setErrorMessage("");
      setPendingAction(null);
      setSubmittedAction("resubmit");
      queryClient.invalidateQueries({ queryKey: ["product-proposal", initiativeId] });
    },
    onError: (error) => {
      setPendingAction(null);
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to resubmit this BRD.",
      );
    },
  });

  function confirmPendingAction() {
    if (pendingAction === "submit") {
      submitMutation.mutate();
    } else if (pendingAction === "resubmit") {
      resubmitMutation.mutate();
    }
  }

  const downloadPdfMutation = useMutation({
    mutationFn: () => downloadBrdPdf(initiativeId, initiativeName),
    onSuccess: () => {
      setErrorMessage("");
    },
    onError: () => {
      setErrorMessage("Unable to download the BRD PDF. Try again.");
    },
  });

  const isBusy =
    saveMutation.isPending ||
    submitMutation.isPending ||
    resubmitMutation.isPending ||
    downloadPdfMutation.isPending;

  const submitLabel = bdoLegStatus === "RejectedByBdo" ? "Resend to BDO" : "Submit for review";

  // ---- Functionalities ----
  function addFunctionality() {
    setForm((current) => ({
      ...current,
      functionalities: [
        ...current.functionalities,
        { sequence: nextSequence(current.functionalities), functionality: "", description: "" },
      ],
    }));
  }

  function updateFunctionality(index: number, patch: Partial<ProductProposalFunctionality>) {
    setForm((current) => ({
      ...current,
      functionalities: current.functionalities.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function removeFunctionality(index: number) {
    setForm((current) => ({
      ...current,
      functionalities: current.functionalities.filter((_, i) => i !== index),
    }));
  }

  // ---- User groups ----
  function addUserGroup() {
    setForm((current) => ({
      ...current,
      userGroups: [
        ...current.userGroups,
        {
          sequence: nextSequence(current.userGroups),
          userClass: "",
          description: "",
          roleFunction: "",
        },
      ],
    }));
  }

  function updateUserGroup(index: number, patch: Partial<ProductProposalUserGroup>) {
    setForm((current) => ({
      ...current,
      userGroups: current.userGroups.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function removeUserGroup(index: number) {
    setForm((current) => ({
      ...current,
      userGroups: current.userGroups.filter((_, i) => i !== index),
    }));
  }

  // ---- Requirements ----
  function addRequirement() {
    setForm((current) => ({
      ...current,
      requirements: [
        ...current.requirements,
        {
          sequence: nextSequence(current.requirements),
          category: REQUIREMENT_CATEGORY_VALUES[0],
          requirement: "",
          priority: REQUIREMENT_PRIORITY_VALUES[0],
          comments: "",
        },
      ],
    }));
  }

  function updateRequirement(index: number, patch: Partial<ProductRequirement>) {
    setForm((current) => ({
      ...current,
      requirements: current.requirements.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function removeRequirement(index: number) {
    setForm((current) => ({
      ...current,
      requirements: current.requirements.filter((_, i) => i !== index),
    }));
  }

  if (submittedAction) {
    return (
      <div className="dashboard-page">
        <BrdSubmittedPanel
          initiativeName={initiativeName}
          wasResubmission={submittedAction === "resubmit"}
          onBackToWork={() => navigate("/dashboard/my-work")}
          onViewInitiative={() => navigate(`/dashboard/initiatives/${initiativeId}`)}
        />
      </div>
    );
  }

  // Mocked leg: while the BDO is deciding, the real proposal is still
  // "Draft" (submit-for-review hasn't been called yet), so editing must be
  // blocked here separately from the real-status branch below.
  if (initialProposal && bdoLegStatus === "PendingBdoReview") {
    return (
      <div className="dashboard-page">
        <Link to={`/dashboard/initiatives/${initiativeId}`} className="text-button">
          <ArrowLeft size={15} />
          Back to {initiativeName}
        </Link>

        <header className="dashboard-header initiative-detail-header">
          <div className="dashboard-header__content">
            <p className="dashboard-breadcrumb">
              PremiumPLM / Initiatives / {initiativeName} / BRD
            </p>

            <h1 className="dashboard-title">Business Requirements Document</h1>

            <p className="dashboard-subtitle">
              This BRD has been sent to the Business Development Officer and
              is read-only until they decide.
            </p>

            <p className="dashboard-subtitle initiative-detail-badges">
              <span className="status-badge status-badge--not-started">
                Awaiting BDO review
              </span>
            </p>
          </div>
        </header>

        <BrdReadOnlyView proposal={initialProposal} />
      </div>
    );
  }

  // Once a BRD has left "Draft" it's been submitted for review, so editing
  // (Save draft / Submit for review) no longer applies — show the same
  // read-only view Group Head reviewers see instead. We don't know the
  // exact set of non-Draft status strings, so this is deliberately "any
  // status other than Draft", not just a specific "submitted" value.
  if (initialProposal && proposalStatus !== "Draft") {
    return (
      <div className="dashboard-page">
        <Link to={`/dashboard/initiatives/${initiativeId}`} className="text-button">
          <ArrowLeft size={15} />
          Back to {initiativeName}
        </Link>

        <header className="dashboard-header initiative-detail-header">
          <div className="dashboard-header__content">
            <p className="dashboard-breadcrumb">
              PremiumPLM / Initiatives / {initiativeName} / BRD
            </p>

            <h1 className="dashboard-title">Business Requirements Document</h1>

            <p className="dashboard-subtitle">
              This BRD has been submitted and is read-only until a decision
              is recorded.
            </p>

            <p className="dashboard-subtitle initiative-detail-badges">
              <span className={brdStatusBadgeClass(proposalStatus ?? "")}>
                {proposalStatus}
              </span>
              {proposalVersion && (
                <span className="brd-version-tag">v{proposalVersion}</span>
              )}
            </p>
          </div>

          <div className="dashboard-header__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => downloadPdfMutation.mutate()}
              disabled={downloadPdfMutation.isPending}
            >
              {downloadPdfMutation.isPending ? "Preparing PDF…" : "Download PDF"}
            </button>

            {proposalStatus !== "Approved" && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => setPendingAction("resubmit")}
                disabled={resubmitMutation.isPending}
              >
                {resubmitMutation.isPending ? "Resubmitting…" : "Resubmit for review"}
              </button>
            )}
          </div>
        </header>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <BrdReadOnlyView proposal={initialProposal} />

        {pendingAction === "resubmit" && (
          <div
            className="modal-overlay"
            role="presentation"
            onClick={() => !resubmitMutation.isPending && setPendingAction(null)}
          >
            <div
              className="modal-panel modal-panel--compact"
              role="dialog"
              aria-modal="true"
              aria-labelledby="brd-resubmit-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-panel_header">
                <h2 id="brd-resubmit-title">Resubmit for review</h2>
              </div>

              <div className="modal-panel_body">
                <p className="brd-confirm-copy">
                  This resubmits the BRD for another review.
                </p>
              </div>

              <div className="modal-panel_footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setPendingAction(null)}
                  disabled={resubmitMutation.isPending}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => resubmitMutation.mutate()}
                  disabled={resubmitMutation.isPending}
                >
                  {resubmitMutation.isPending ? "Working…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Link to={`/dashboard/initiatives/${initiativeId}`} className="text-button">
        <ArrowLeft size={15} />
        Back to {initiativeName}
      </Link>

      <header className="dashboard-header initiative-detail-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">
            PremiumPLM / Initiatives / {initiativeName} / BRD
          </p>

          <h1 className="dashboard-title">Business Requirements Document</h1>

          <p className="dashboard-subtitle">
            {proposalId
              ? "Editing the saved draft for this initiative."
              : "No BRD exists for this initiative yet — fill in what you can and save a draft."}
          </p>

          {proposalStatus && (
            <p className="dashboard-subtitle initiative-detail-badges">
              <span className={brdStatusBadgeClass(proposalStatus ?? "")}>
                {proposalStatus}
              </span>
              {proposalVersion && (
                <span className="brd-version-tag">v{proposalVersion}</span>
              )}
            </p>
          )}
        </div>

        <div className="dashboard-header__actions">
          {proposalId && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => downloadPdfMutation.mutate()}
              disabled={isBusy}
            >
              {downloadPdfMutation.isPending ? "Preparing PDF…" : "Download PDF"}
            </button>
          )}

          <button
            type="button"
            className="button button--secondary"
            onClick={() => saveMutation.mutate()}
            disabled={isBusy}
          >
            {saveMutation.isPending ? "Saving…" : "Save draft"}
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={() => setPendingAction("submit")}
            disabled={!proposalId || isBusy}
            title={!proposalId ? "Save a draft first" : undefined}
          >
            {submitMutation.isPending ? "Submitting…" : submitLabel}
          </button>
        </div>
      </header>

      {bdoLegStatus === "RejectedByBdo" && bdoRejectionQuery.data && (
        <div className="bdo-rejection-notice">
          <strong>Rejected by the BDO:</strong> {bdoRejectionQuery.data.comment}
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
            <h2>Overview</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="author">Author</label>
              <input
                id="author"
                type="text"
                value={form.author}
                onChange={(event) => updateField("author", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="sponsor">Sponsor</label>
              <input
                id="sponsor"
                type="text"
                value={form.sponsor}
                onChange={(event) => updateField("sponsor", event.target.value)}
              />
            </div>
          </div>

          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="userGroup">User group</label>
              <input
                id="userGroup"
                type="text"
                value={form.userGroup}
                onChange={(event) => updateField("userGroup", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="projectManager">Project manager</label>
              <input
                id="projectManager"
                type="text"
                value={form.projectManager}
                onChange={(event) => updateField("projectManager", event.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="introduction">Introduction</label>
            <textarea
              id="introduction"
              rows={3}
              value={form.introduction}
              onChange={(event) => updateField("introduction", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Business case</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field">
            <label htmlFor="businessObjective">Business objective</label>
            <textarea
              id="businessObjective"
              rows={2}
              value={form.businessObjective}
              onChange={(event) => updateField("businessObjective", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="businessPurpose">Business purpose</label>
            <textarea
              id="businessPurpose"
              rows={2}
              value={form.businessPurpose}
              onChange={(event) => updateField("businessPurpose", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="objectivesAndGoals">Objectives and goals</label>
            <textarea
              id="objectivesAndGoals"
              rows={2}
              value={form.objectivesAndGoals}
              onChange={(event) => updateField("objectivesAndGoals", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="targetCustomers">Target customers</label>
            <textarea
              id="targetCustomers"
              rows={2}
              value={form.targetCustomers}
              onChange={(event) => updateField("targetCustomers", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="productPurpose">Product purpose</label>
            <textarea
              id="productPurpose"
              rows={2}
              value={form.productPurpose}
              onChange={(event) => updateField("productPurpose", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="needStatement">Need statement</label>
            <textarea
              id="needStatement"
              rows={2}
              value={form.needStatement}
              onChange={(event) => updateField("needStatement", event.target.value)}
            />
          </div>

          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="affects">Affects</label>
              <input
                id="affects"
                type="text"
                value={form.affects}
                onChange={(event) => updateField("affects", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="impact">Impact</label>
              <input
                id="impact"
                type="text"
                value={form.impact}
                onChange={(event) => updateField("impact", event.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="successfulSolution">Successful solution</label>
            <textarea
              id="successfulSolution"
              rows={2}
              value={form.successfulSolution}
              onChange={(event) => updateField("successfulSolution", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Classification</h2>
          </div>
        </div>

        <div className="proposal-section proposal-checkbox-group">
          <label className="proposal-checkbox">
            <input
              type="checkbox"
              checked={form.newApplicationDevelopment}
              onChange={(event) =>
                updateField("newApplicationDevelopment", event.target.checked)
              }
            />
            New application development
          </label>

          <label className="proposal-checkbox">
            <input
              type="checkbox"
              checked={form.replacementOfExistingApplication}
              onChange={(event) =>
                updateField("replacementOfExistingApplication", event.target.checked)
              }
            />
            Replacement of existing application
          </label>

          <label className="proposal-checkbox">
            <input
              type="checkbox"
              checked={form.rfpOrRfq}
              onChange={(event) => updateField("rfpOrRfq", event.target.checked)}
            />
            RFP or RFQ
          </label>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Scope &amp; process</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field">
            <label htmlFor="projectScope">Project scope</label>
            <textarea
              id="projectScope"
              rows={2}
              value={form.projectScope}
              onChange={(event) => updateField("projectScope", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="processFlowAsIs">Process flow — as is</label>
            <textarea
              id="processFlowAsIs"
              rows={2}
              value={form.processFlowAsIs}
              onChange={(event) => updateField("processFlowAsIs", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="processFlowToBe">Process flow — to be</label>
            <textarea
              id="processFlowToBe"
              rows={2}
              value={form.processFlowToBe}
              onChange={(event) => updateField("processFlowToBe", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Financials</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="minimumAmount">Minimum amount</label>
              <input
                id="minimumAmount"
                type="number"
                value={form.minimumAmount}
                onChange={(event) =>
                  updateField("minimumAmount", Number(event.target.value))
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="maximumAmount">Maximum amount</label>
              <input
                id="maximumAmount"
                type="number"
                value={form.maximumAmount}
                onChange={(event) =>
                  updateField("maximumAmount", Number(event.target.value))
                }
              />
            </div>
          </div>

          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="tenureInMonths">Tenure (months)</label>
              <input
                id="tenureInMonths"
                type="number"
                value={form.tenureInMonths}
                onChange={(event) =>
                  updateField("tenureInMonths", Number(event.target.value))
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="proposedInterestRate">Proposed interest rate (%)</label>
              <input
                id="proposedInterestRate"
                type="number"
                step="0.01"
                value={form.proposedInterestRate}
                onChange={(event) =>
                  updateField("proposedInterestRate", Number(event.target.value))
                }
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="repaymentFrequency">Repayment frequency</label>
            <input
              id="repaymentFrequency"
              type="text"
              value={form.repaymentFrequency}
              onChange={(event) => updateField("repaymentFrequency", event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="expectedBenefits">Expected benefits</label>
            <textarea
              id="expectedBenefits"
              rows={2}
              value={form.expectedBenefits}
              onChange={(event) => updateField("expectedBenefits", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Functionalities</h2>
            <p>What the product needs to do.</p>
          </div>
        </div>

        <div className="proposal-subtable-wrapper">
          <table className="proposal-subtable">
            <thead>
              <tr>
                <th>#</th>
                <th>Functionality</th>
                <th>Description</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {form.functionalities.map((row, index) => (
                <tr key={index}>
                  <td>{row.sequence}</td>
                  <td>
                    <input
                      type="text"
                      value={row.functionality}
                      onChange={(event) =>
                        updateFunctionality(index, { functionality: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) =>
                        updateFunctionality(index, { description: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="proposal-subtable-remove"
                      onClick={() => removeFunctionality(index)}
                      aria-label="Remove functionality"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}

              {form.functionalities.length === 0 && (
                <tr>
                  <td colSpan={4} className="initiatives-empty">
                    No functionalities added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button type="button" className="text-button proposal-subtable-add" onClick={addFunctionality}>
          + Add functionality
        </button>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>User groups</h2>
            <p>Who uses this product, and how.</p>
          </div>
        </div>

        <div className="proposal-subtable-wrapper">
          <table className="proposal-subtable">
            <thead>
              <tr>
                <th>#</th>
                <th>User class</th>
                <th>Description</th>
                <th>Role / function</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {form.userGroups.map((row, index) => (
                <tr key={index}>
                  <td>{row.sequence}</td>
                  <td>
                    <input
                      type="text"
                      value={row.userClass}
                      onChange={(event) =>
                        updateUserGroup(index, { userClass: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) =>
                        updateUserGroup(index, { description: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.roleFunction}
                      onChange={(event) =>
                        updateUserGroup(index, { roleFunction: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="proposal-subtable-remove"
                      onClick={() => removeUserGroup(index)}
                      aria-label="Remove user group"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}

              {form.userGroups.length === 0 && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
                    No user groups added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button type="button" className="text-button proposal-subtable-add" onClick={addUserGroup}>
          + Add user group
        </button>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Requirements</h2>
            <p>
              Category and priority are undocumented numeric codes in the
              API — shown as plain numbers until the API publishes their
              meaning.
            </p>
          </div>
        </div>

        <div className="proposal-subtable-wrapper">
          <table className="proposal-subtable">
            <thead>
              <tr>
                <th>#</th>
                <th>Category</th>
                <th>Requirement</th>
                <th>Priority</th>
                <th>Comments</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {form.requirements.map((row, index) => (
                <tr key={index}>
                  <td>{row.sequence}</td>
                  <td>
                    <select
                      value={row.category}
                      onChange={(event) =>
                        updateRequirement(index, { category: Number(event.target.value) })
                      }
                    >
                      {REQUIREMENT_CATEGORY_VALUES.map((value) => (
                        <option key={value} value={value}>
                          Category {value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.requirement}
                      onChange={(event) =>
                        updateRequirement(index, { requirement: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={row.priority}
                      onChange={(event) =>
                        updateRequirement(index, { priority: Number(event.target.value) })
                      }
                    >
                      {REQUIREMENT_PRIORITY_VALUES.map((value) => (
                        <option key={value} value={value}>
                          Priority {value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.comments}
                      onChange={(event) =>
                        updateRequirement(index, { comments: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="proposal-subtable-remove"
                      onClick={() => removeRequirement(index)}
                      aria-label="Remove requirement"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}

              {form.requirements.length === 0 && (
                <tr>
                  <td colSpan={6} className="initiatives-empty">
                    No requirements added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button type="button" className="text-button proposal-subtable-add" onClick={addRequirement}>
          + Add requirement
        </button>
      </section>

      <div className="proposal-bottom-actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => navigate(`/dashboard/initiatives/${initiativeId}`)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="button button--secondary"
          onClick={() => saveMutation.mutate()}
          disabled={isBusy}
        >
          {saveMutation.isPending ? "Saving…" : "Save draft"}
        </button>

        <button
          type="button"
          className="button button--primary"
          onClick={() => setPendingAction("submit")}
          disabled={!proposalId || isBusy}
        >
          {submitMutation.isPending ? "Submitting…" : submitLabel}
        </button>
      </div>

      {pendingAction && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => !isBusy && setPendingAction(null)}
        >
          <div
            className="modal-panel modal-panel--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="brd-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="brd-confirm-title">
                {pendingAction === "submit" ? "Submit for review" : "Resubmit for review"}
              </h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                {pendingAction === "submit"
                  ? "This sends the BRD to the Business Development Officer for the first review."
                  : "This resubmits the BRD for another review."}
              </p>
            </div>

            <div className="modal-panel_footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setPendingAction(null)}
                disabled={isBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={confirmPendingAction}
                disabled={isBusy}
              >
                {isBusy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrdEditor;
