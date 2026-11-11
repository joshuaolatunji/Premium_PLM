import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";

import { createMemo, memoKeys, updateMemo } from "../../service/MemoService";
import { memoAttachmentKeys, uploadMemoAttachments } from "../../service/MemoAttachmentService";
import {
  createMemoReview,
  declinedStep,
  getMemoReview,
  resubmitMemoAfterChanges,
  resumeMemoReview,
  reviewerLabel,
  submitMemo,
} from "../../service/MemoReviewService";
import { getAllUsers, isUserListForbidden } from "../../service/UserService";
import { getCurrentUserId } from "../../apicalls/authStorage";
import type { ApproverInput } from "../../types/approvalTypes";
import { EMPTY_MEMO_FIELDS, MEMO_STATUS } from "../../types/memoTypes";
import type { Memo, MemoFields, MemoReview, MemoReviewResumeMode } from "../../types/memoTypes";
import { EMPTY_APPROVER, approverLevel, approverRowsError } from "../../utils/approvers";
import { richTextToPlain } from "../../utils/richText";
import { isUserActive } from "../../utils/userStatus";
import { clearDraft, moveDraft, useDraftState } from "../../utils/useDraftState";
import ApproverRowsEditor from "../approvals/ApproverRowsEditor";
import DraftRestoredNotice from "../common/DraftRestoredNotice";
import MemoAttachmentsPanel from "./MemoAttachmentsPanel";
import { SHOW_MEMO_ATTACHMENTS } from "../../config/features";
import type { StagedFile } from "./MemoAttachmentsPanel";
import RichTextEditor from "../editor/RichTextEditor";
import ModalShell from "../common/ModalShell";
import SearchableSelect from "../ui/SearchableSelect";
import { notifyError, notifySuccess } from "../../utils/notify";

// The short fields, two to a row: To / Thru, then From / Date.
const SHORT_FIELDS: { key: keyof MemoFields; label: string; type: "text" | "date"; placeholder: string }[] = [
  { key: "to", label: "To", type: "text", placeholder: "e.g. MD/CEO" },
  { key: "thru", label: "Thru", type: "text", placeholder: "e.g. Group Head, Digital Banking" },
  { key: "from", label: "From", type: "text", placeholder: "Requesting department or unit" },
  { key: "date", label: "Date", type: "date", placeholder: "" },
];

function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

// What's missing before the memo can be saved or submitted, or null. The API
// needs these even for a draft.
function missingFields(fields: MemoFields, action: "saving" | "sending"): string | null {
  const missing = [
    !fields.to.trim() && "To",
    !fields.from.trim() && "From",
    !fields.date && "Date",
    !fields.subject.trim() && "Subject",
    !richTextToPlain(fields.details) && "Memo details",
  ].filter(Boolean);

  return missing.length > 0 ? `Fill in ${missing.join(", ")} before ${action}.` : null;
}

interface MemoFormProps {
  // The memo being edited; null for a new one.
  memo: Memo | null;
  // For a new memo on an initiative.
  initiativeId: string | null;
  // Its review, once its reviewers are set (after a reviewer asked for
  // changes, the round they asked in).
  review: MemoReview | null;
  reviewersLoading?: boolean;
}

// After changes, where the review picks up again.
const RESUME_MODES: { value: MemoReviewResumeMode; label: string; hint: string }[] = [
  {
    value: "ResumeFromRequestingReviewer",
    label: "Continue from the reviewer who asked for changes",
    hint: "Approvals already given are kept.",
  },
  { value: "FullRestart", label: "Start again from the first reviewer", hint: "Everyone reviews it again." },
  { value: "ResumeFromSelectedReviewer", label: "Continue from a reviewer you choose", hint: "Earlier approvals are kept." },
];

// Writing a memo: To, Thru, From, Date and Subject, then the Memo details,
// any attachments, and the reviewers it goes to, in order. Saved as a draft
// at any time, then sent for review. After a reviewer asks for changes, its
// author edits it and sends it again to the same reviewers, with a note of
// what changed, choosing where the review picks up. Who signs it is chosen
// once every reviewer has approved it (MemoSignOffPanel).
function MemoForm({ memo, initiativeId, review, reviewersLoading = false }: MemoFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const declined = declinedStep(review);
  // A reviewer asked for changes: it goes back to the same reviewers.
  const isResend = Boolean(declined);
  // An old memo the Group Head sent back, before reviewers.
  const groupHeadAsked = !declined && memo?.status === MEMO_STATUS.changesRequested;
  const [resumeMode, setResumeMode] = useState<MemoReviewResumeMode>("ResumeFromRequestingReviewer");
  const [resumeFrom, setResumeFrom] = useState(1);

  const draftId = memo?.id ?? `new:${initiativeId ?? "standalone"}`;
  const draftKey = `memo:${draftId}`;
  const reviewersDraftKey = `memo-reviewers:${draftId}`;
  const revisionDraftKey = `memo-revision:${memo?.id}`;
  const [revisionComment, setRevisionComment] = useDraftState(revisionDraftKey, "");
  const [fields, setFields, draft] = useDraftState<MemoFields>(draftKey, () =>
    memo
      ? { to: memo.to, thru: memo.thru, from: memo.from, date: memo.date, subject: memo.subject, details: memo.details }
      : { ...EMPTY_MEMO_FIELDS, date: today() },
  );
  const [reviewers, setReviewers, reviewersDraft] = useDraftState<ApproverInput[]>(reviewersDraftKey, [EMPTY_APPROVER]);

  // Files chosen here go up right after the memo is saved (they can't be
  // kept as a draft), and before it's sent for review.
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Anyone active can review it, whatever their role, except its author.
  const myId = getCurrentUserId();
  const usersQuery = useQuery({ queryKey: ["plm-users"], queryFn: getAllUsers, enabled: !isResend });
  const directory = (usersQuery.data ?? []).filter((user) => isUserActive(user) && user.userId !== myId);
  const directoryUnavailable = usersQuery.isError || (usersQuery.isSuccess && isUserListForbidden());

  function update(key: keyof MemoFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function refresh(saved: Memo) {
    await queryClient.invalidateQueries({ queryKey: memoKeys.all });
    draft.markSaved(fields);

    // A new memo gets its own address, so a refresh keeps it open; the
    // "new memo" draft is done with, and the unsent reviewers move with it.
    if (!memo) {
      clearDraft(draftKey);
      moveDraft(reviewersDraftKey, `memo-reviewers:${saved.id}`);
      navigate(`/dashboard/memos/${saved.id}`, { replace: true });
    }
  }

  // The memo as saved by the latest save or send, so a failure after saving
  // still moves a new memo to its own page (pressing Send again mustn't
  // create a second one).
  const savedRef = useRef<Memo | null>(null);

  async function save(): Promise<Memo> {
    savedRef.current = null;
    const saved = memo ? await updateMemo(memo, fields) : await createMemo(fields, initiativeId);
    savedRef.current = saved;

    if (staged.length > 0) {
      setUploadProgress(0);
      try {
        await uploadMemoAttachments(
          saved.id,
          staged.map((item) => item.file),
          staged.map((item) => item.label.trim() || item.file.name),
          setUploadProgress,
        );
        setStaged([]);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Try again.";
        throw new Error(`The memo was saved, but its attachments weren't uploaded. ${reason}`, { cause: error });
      } finally {
        setUploadProgress(null);
        await queryClient.invalidateQueries({ queryKey: memoAttachmentKeys.one(saved.id) });
      }
    }

    return saved;
  }

  const saveMutation = useMutation({
    mutationFn: save,
    onSuccess: async (saved) => {
      setErrorMessage("");
      notifySuccess({ title: "Memo saved", description: "Save again after any changes." });
      await refresh(saved);
    },
    onError: async (error) => {
      setErrorMessage(notifyError("Couldn't save the memo", error));
      if (savedRef.current) {
        await refresh(savedRef.current);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const saved = await save();

      if (isResend && review) {
        const comment = revisionComment.trim();
        await resubmitMemoAfterChanges(saved.id, comment);
        // Resubmitting may already restart the review; if not, pick it up
        // where the author chose.
        const after = await getMemoReview(review.workflowId);
        if (after?.status === "Declined") {
          await resumeMemoReview(saved.id, resumeMode, resumeFrom, comment);
        }
        return saved;
      }

      // The API wants the memo submitted first, then its reviewers set
      // ("The memo must be submitted before a reviewer workflow can be
      // created"). A retry after a half-finished attempt skips whichever
      // step already went through.
      if (/draft/i.test(saved.status)) {
        await submitMemo(saved.id);
      }
      if (!saved.reviewerWorkflowId) {
        await createMemoReview(saved.id, reviewers);
      }
      return saved;
    },
    onSuccess: async (sent) => {
      setConfirming(false);
      setErrorMessage("");
      clearDraft(revisionDraftKey);
      reviewersDraft.markSaved();
      clearDraft(reviewersDraftKey);
      notifySuccess({
        title: isResend ? "Sent for review again" : "Sent for review",
        description: "Your reviewers have been asked to review it.",
      });
      await refresh(sent);
    },
    onError: async (error) => {
      setConfirming(false);
      setErrorMessage(notifyError("Couldn't send the memo for review", error));
      // Some steps may have gone through; show the memo as it now stands.
      if (savedRef.current) {
        await refresh(savedRef.current);
      }
    },
  });

  function startSubmit() {
    const problem = missingFields(fields, "sending") ?? (isResend ? null : approverRowsError(reviewers, "reviewer"));
    setErrorMessage(problem ?? "");
    setConfirming(!problem);
  }

  function startSave() {
    const problem = missingFields(fields, "saving");

    if (problem) {
      setErrorMessage(problem);
      return;
    }

    saveMutation.mutate();
  }

  const isBusy = saveMutation.isPending || submitMutation.isPending;

  return (
    <>
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.discard} keepHint="Save the memo to keep them." />

      {declined ? (
        <div className="document-returned-note" role="status">
          <strong>
            {reviewerLabel(declined)}
            {declined.reviewerRole ? ` (${declined.reviewerRole})` : ""} asked for changes
          </strong>
          <p>{declined.comment || "No reason was given."}</p>
        </div>
      ) : (
        groupHeadAsked && (
          <div className="document-returned-note" role="status">
            <strong>The Group Head asked for changes</strong>
            <p>{memo?.groupHeadReview?.comment || "Make the changes asked for, then send it for review."}</p>
          </div>
        )
      )}

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Memo</h2>
            <p>Who it's for, who it's from, and what it's about.</p>
          </div>
        </div>

        <div className="proposal-section">
          {[SHORT_FIELDS.slice(0, 2), SHORT_FIELDS.slice(2)].map((row, rowIndex) => (
            <div className="form-field-row" key={rowIndex}>
              {row.map((field) => (
                <div className="form-field" key={field.key}>
                  <label htmlFor={`memo-${field.key}`}>{field.label}</label>
                  <input
                    id={`memo-${field.key}`}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={fields[field.key]}
                    onChange={(event) => update(field.key, event.target.value)}
                    disabled={isBusy}
                  />
                </div>
              ))}
            </div>
          ))}

          <div className="form-field">
            <label htmlFor="memo-subject">Subject</label>
            <input
              id="memo-subject"
              type="text"
              placeholder="What the memo is about"
              value={fields.subject}
              onChange={(event) => update("subject", event.target.value)}
              disabled={isBusy}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Memo Details</h2>
            <p>Use the toolbar to format headings, lists, highlights, links and more.</p>
          </div>
        </div>

        <div className="proposal-section">
          <RichTextEditor
            id="memo-details"
            ariaLabel="Memo details"
            value={fields.details}
            onChange={(html) => update("details", html)}
            placeholder="Write the memo…"
            disabled={isBusy}
          />
        </div>
      </section>

      {/* Off until the backend accepts memo attachments (gap M37). */}
      {SHOW_MEMO_ATTACHMENTS && (
        <MemoAttachmentsPanel
          memoId={memo?.id ?? null}
          staged={staged}
          setStaged={setStaged}
          progress={uploadProgress}
          disabled={isBusy}
        />
      )}

      <section className="dashboard-panel initiative-detail-panel approval-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Reviewers</h2>
            <p>
              {isResend
                ? "It goes back to the same reviewers. When you send it, choose where the review picks up."
                : "Who reviews the memo before it's signed, in order. Each approves it before it moves to the next; once they all have, you choose who signs it."}
            </p>
          </div>
        </div>

        {isResend && review ? (
          <div className="proposal-section">
            <ol className="approver-confirm-list">
              {review.steps.map((step) => (
                <li key={step.id}>
                  <strong>{approverLevel(step.sequence, "reviewer")}:</strong>{" "}
                  {step.reviewerName
                    ? `${step.reviewerName}${step.reviewerRole ? ` (${step.reviewerRole})` : ""}`
                    : step.reviewerRole || reviewerLabel(step)}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <div className="proposal-section">
              <DraftRestoredNotice
                savedAt={reviewersDraft.restoredAt}
                onDiscard={reviewersDraft.discard}
                keepHint="Send the memo for review to keep them."
              />

              {directoryUnavailable && (
                <div className="document-returned-note" role="alert">
                  <strong>Couldn't load the staff list</strong>
                  <p>
                    {usersQuery.isError
                      ? "The staff list didn't load, so reviewers can't be chosen. Refresh the page to try again."
                      : "Your account isn't allowed to read the staff list, so reviewers can't be chosen. Ask an administrator to check your role."}
                  </p>
                </div>
              )}

              <ApproverRowsEditor
                rows={reviewers}
                setRows={setReviewers}
                users={directory}
                usersLoading={usersQuery.isLoading}
                disabled={directoryUnavailable || isBusy}
                idPrefix="memo-reviewer"
                noun="reviewer"
              />
            </div>

            <div className="approval-panel_actions">
              <button
                type="button"
                className="button button--dark"
                onClick={() => setReviewers((current) => [...current, EMPTY_APPROVER])}
                disabled={directoryUnavailable || isBusy}
              >
                <Plus size={17} aria-hidden="true" />
                Add {approverLevel(reviewers.length + 1, "reviewer")}
              </button>
            </div>
          </>
        )}
      </section>

      <div className="bdo-action-bar bdo-action-bar--static">
        <div>
          <p className="bdo-action-bar_hint">
            {isResend
              ? "Make the changes, then send it for review again with a note of what changed."
              : "Save a draft at any time, then send it to the reviewers above."}
          </p>

          {errorMessage && !confirming && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="brd-reviews-actions">
          <button type="button" className="button button--secondary" onClick={() => navigate(-1)} disabled={isBusy}>
            Cancel
          </button>

          <button type="button" className="button button--dark" onClick={startSave} disabled={isBusy}>
            {saveMutation.isPending ? "Saving…" : "Save draft"}
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={startSubmit}
            disabled={isBusy || (!isResend && directoryUnavailable) || (isResend && reviewersLoading)}
          >
            <Send size={17} aria-hidden="true" />
            {isResend ? "Send again for review" : "Send for review"}
          </button>
        </div>
      </div>

      <ModalShell
        open={Boolean(confirming)}
        onClose={() => setConfirming(false)}
        busy={isBusy}
        labelledBy="memo-submit-title"
        className="modal-panel--compact"
      >
        <div className="modal-panel_header">
          <h2 id="memo-submit-title">{isResend ? "Send again for review" : "Send for review"}</h2>
        </div>

        <div className="modal-panel_body">
          {isResend && review ? (
            <fieldset className="memo-resubmit-modes">
              <legend>Where should the review pick up?</legend>

              {RESUME_MODES.map((option) => (
                <label key={option.value} className="memo-resubmit-mode">
                  <input
                    type="radio"
                    name="memo-resume-mode"
                    value={option.value}
                    checked={resumeMode === option.value}
                    onChange={() => setResumeMode(option.value)}
                    disabled={isBusy}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}

              {resumeMode === "ResumeFromSelectedReviewer" && (
                <div className="form-field">
                  <label htmlFor="memo-resume-from">Continue from</label>
                  <SearchableSelect
                    id="memo-resume-from"
                    value={resumeFrom}
                    onChange={(event) => setResumeFrom(Number(event.target.value))}
                    disabled={isBusy}
                  >
                    {review.steps.map((step) => (
                      <option
                        key={step.id}
                        value={step.sequence}
                        data-description={[approverLevel(step.sequence, "reviewer"), step.reviewerName && step.reviewerRole]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        {step.reviewerName || step.reviewerRole || reviewerLabel(step)}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              )}
            </fieldset>
          ) : (
            <>
              <p className="brd-confirm-copy">
                The memo goes to these reviewers in this order. Each approves it before it moves to the next. It's
                read-only while it's in review.
              </p>

              <ol className="approver-confirm-list">
                {reviewers.map((row, index) => (
                  <li key={index}>
                    <strong>{approverLevel(index + 1, "reviewer")}:</strong> {row.name} ({row.role})
                  </li>
                ))}
              </ol>
            </>
          )}

          {staged.length > 0 && (
            <p className="brd-confirm-copy">
              {staged.length === 1 ? "1 new attachment is" : `${staged.length} new attachments are`} uploaded with it.
            </p>
          )}

          {isResend && (
            <div className="form-field">
              <label htmlFor="memo-revision-comment">What changed</label>
              <textarea
                id="memo-revision-comment"
                rows={3}
                placeholder="e.g. Added the cost breakdown the reviewer asked for"
                value={revisionComment}
                onChange={(event) => setRevisionComment(event.target.value)}
                disabled={isBusy}
              />
            </div>
          )}

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="modal-panel_footer">
          <button type="button" className="button button--secondary" onClick={() => setConfirming(false)} disabled={isBusy}>
            Cancel
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={() => submitMutation.mutate()}
            disabled={isBusy || (isResend && !revisionComment.trim())}
          >
            {submitMutation.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </ModalShell>
    </>
  );
}

export default MemoForm;
