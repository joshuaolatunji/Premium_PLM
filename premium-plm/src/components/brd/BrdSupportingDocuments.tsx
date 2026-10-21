import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteDiscoveryAttachment,
  getAttachments,
  openDiscoveryAttachment,
  uploadAttachments,
  type AttachmentTarget,
} from "../../service/ProductDiscoveryService";
import { getInitiativeById } from "../../service/InitiativeService";
import { getProposalByInitiativeId } from "../../service/ProposalService";
import { ApiError } from "../../apicalls/apiClient";
import type { DiscoveryAttachment } from "../../types/discoveryTypes";

// The three documents the PM attaches alongside the BRD. They're uploaded
// against the BRD itself (target ProductProposal + the BRD's id), with
// `label` fixed to the name below — that label is also how an uploaded
// file is matched back to its slot.
const BRD_DOCUMENT_SLOTS = [
  { id: "pid", label: "Product Initiation Document (PID)" },
  { id: "fid", label: "Functional Initiation Document (FID)" },
  { id: "swr", label: "Standard Work Requirement (SWR)" },
] as const;

function errorMessageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// Open/remove for any attachment row in this panel. `onError` lets each
// caller show the message next to the row that failed.
function useAttachmentActions(listKey: readonly unknown[], onError: (message: string) => void) {
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteDiscoveryAttachment(attachmentId),
    onSuccess: () => {
      onError("");
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: (error) => onError(errorMessageFrom(error, "Unable to remove that file. Try again.")),
  });

  const openMutation = useMutation({
    mutationFn: ({ attachmentId, targetWindow }: { attachmentId: string; targetWindow: Window | null }) =>
      openDiscoveryAttachment(attachmentId, targetWindow),
    onSuccess: () => onError(""),
    onError: (error) => onError(errorMessageFrom(error, "Unable to open that file. Try again.")),
  });

  return {
    // Opened synchronously inside the click so the browser treats the new
    // tab as user-initiated (see openDiscoveryAttachment).
    open: (attachmentId: string) => {
      const targetWindow = window.open("", "_blank");
      openMutation.mutate({ attachmentId, targetWindow });
    },
    remove: (attachmentId: string) => removeMutation.mutate(attachmentId),
    isOpening: openMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

interface BrdSupportingDocumentsProps {
  initiativeId: string;
  // True for reviewers, and for the PM once the BRD is submitted — files
  // can be opened, but not uploaded or removed.
  readOnly?: boolean;
}

function BrdSupportingDocuments({ initiativeId, readOnly = false }: BrdSupportingDocumentsProps) {
  // Same query keys the rest of the app uses, so cached data is reused.
  const initiativeQuery = useQuery({
    queryKey: ["product-initiative", initiativeId],
    queryFn: () => getInitiativeById(initiativeId),
  });

  // The BRD these documents attach to. Same key the BRD pages use, so it's
  // already cached — and it refreshes when the PM saves a new draft.
  const proposalQuery = useQuery({
    queryKey: ["product-proposal", initiativeId],
    queryFn: () => getProposalByInitiativeId(initiativeId),
  });

  const proposalId = proposalQuery.data?.id ?? null;
  const projectManagerId = initiativeQuery.data?.projectManagerId ?? null;

  const target: AttachmentTarget | null = proposalId
    ? { type: "ProductProposal", id: proposalId }
    : null;
  // Its own cache entry, separate from the BDO's discovery documents.
  const listKey = ["brd-attachments", proposalId] as const;

  const attachmentsQuery = useQuery({
    queryKey: listKey,
    queryFn: () => getAttachments(target as AttachmentTarget),
    enabled: Boolean(target),
  });

  const attachments = attachmentsQuery.data ?? [];

  // Fallback while get-attachments doesn't return `label`: a file with no
  // label can't be matched to PID/FID/SWR, but if the initiative's PM
  // uploaded it, it's one of these documents — the BDO's own files on the
  // same discovery are excluded because the BDO uploaded them. Listed by
  // file name so reviewers still see (and can open) everything submitted.
  const unmatchedPmFiles = attachments.filter(
    (attachment) =>
      !attachment.label &&
      projectManagerId !== null &&
      attachment.uploadedByUserId === projectManagerId,
  );

  return (
    <section className="dashboard-panel brd-documents">
      <div className="dashboard-panel__header">
        <div>
          <h2>Supporting documents</h2>
          <p>
            {readOnly
              ? "The PID, FID, and SWR submitted with this BRD."
              : "Upload the PID, FID, and SWR for this initiative."}
          </p>
        </div>
      </div>

      {proposalQuery.isLoading ? (
        <p className="brd-documents_message">Loading documents…</p>
      ) : !target && readOnly ? (
        <p className="brd-documents_message">No BRD has been saved for this initiative yet.</p>
      ) : (
        <div className="brd-documents_slots">
          {!target && (
            <p className="brd-documents_locked-note">
              Save the BRD above to enable these uploads.
            </p>
          )}

          {BRD_DOCUMENT_SLOTS.map((slot) => (
            <BrdDocumentSlot
              key={slot.id}
              slotId={slot.id}
              label={slot.label}
              target={target}
              listKey={listKey}
              files={attachments.filter((attachment) => attachment.label === slot.label)}
              readOnly={readOnly}
              // With unmatched PM files around, an empty slot may just mean
              // its file came back unlabeled — so don't claim it's missing.
              canConfirmMissing={unmatchedPmFiles.length === 0}
            />
          ))}

          {unmatchedPmFiles.length > 0 && (
            <UnmatchedDocuments
              listKey={listKey}
              files={unmatchedPmFiles}
              readOnly={readOnly}
            />
          )}
        </div>
      )}
    </section>
  );
}

interface AttachmentRowProps {
  title: string;
  fileName: string;
  onOpen: () => void;
  onRemove?: () => void;
  isBusy: boolean;
}

function AttachmentRow({ title, fileName, onOpen, onRemove, isBusy }: AttachmentRowProps) {
  return (
    <li className="bdo-upload-group">
      <div className="bdo-upload-group_row">
        <span className="bdo-upload-list_icon">
          <FileText size={16} />
        </span>

        <div className="bdo-upload-list_info">
          <span className="bdo-upload-list_name">{title}</span>
          {title !== fileName && <span className="bdo-upload-list_meta">{fileName}</span>}
        </div>

        <button type="button" className="bdo-upload-list_open" onClick={onOpen} disabled={isBusy}>
          Open
        </button>

        {onRemove && (
          <button
            type="button"
            className="bdo-upload-list_remove"
            onClick={onRemove}
            disabled={isBusy}
            aria-label={`Remove ${title}`}
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
}

interface UnmatchedDocumentsProps {
  listKey: readonly unknown[];
  files: DiscoveryAttachment[];
  readOnly: boolean;
}

function UnmatchedDocuments({ listKey, files, readOnly }: UnmatchedDocumentsProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const actions = useAttachmentActions(listKey, setErrorMessage);

  return (
    <div className="brd-documents_slot">
      <span className="brd-documents_slot-title">Uploaded documents</span>

      <ul className="bdo-upload-list">
        {files.map((file) => (
          <AttachmentRow
            key={file.id}
            title={file.fileName}
            fileName={file.fileName}
            onOpen={() => actions.open(file.id)}
            onRemove={readOnly ? undefined : () => actions.remove(file.id)}
            isBusy={actions.isOpening || actions.isRemoving}
          />
        ))}
      </ul>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

interface BrdDocumentSlotProps {
  slotId: string;
  label: string;
  // Null until the BRD has been saved — the slot still shows, but its
  // Choose file / Upload controls stay disabled.
  target: AttachmentTarget | null;
  listKey: readonly unknown[];
  files: DiscoveryAttachment[];
  readOnly: boolean;
  canConfirmMissing: boolean;
}

function BrdDocumentSlot({
  slotId,
  label,
  target,
  listKey,
  files,
  readOnly,
  canConfirmMissing,
}: BrdDocumentSlotProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const actions = useAttachmentActions(listKey, setErrorMessage);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachments(target as AttachmentTarget, [file], [label]),
    onSuccess: () => {
      setSelectedFile(null);
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: (error) => {
      setErrorMessage(errorMessageFrom(error, "Unable to upload that file. Try again."));
    },
  });

  // Reviewers only see a slot once there's something to show in it.
  if (readOnly && files.length === 0 && !canConfirmMissing) {
    return null;
  }

  const labelId = `brd-doc-${slotId}-label`;
  const fileId = `brd-doc-${slotId}-file`;

  return (
    <div className="brd-documents_slot">
      {files.length > 0 ? (
        <ul className="bdo-upload-list">
          {files.map((file) => (
            <AttachmentRow
              key={file.id}
              title={label}
              fileName={file.fileName}
              onOpen={() => actions.open(file.id)}
              onRemove={readOnly ? undefined : () => actions.remove(file.id)}
              isBusy={actions.isOpening || actions.isRemoving}
            />
          ))}
        </ul>
      ) : readOnly ? (
        <p className="brd-documents_message">{label}: not uploaded.</p>
      ) : null}

      {!readOnly && (
        <div className="brd-documents_form">
          <div className="form-field">
            <label htmlFor={labelId}>File name</label>
            <input id={labelId} type="text" placeholder=" " value={label} readOnly disabled />
          </div>

          <div className="form-field">
            <label htmlFor={fileId}>File</label>
            <input
              id={fileId}
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
            <div className="bdo-file-picker">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!target || uploadMutation.isPending}
                title={!target ? "Save the BRD first" : undefined}
              >
                Choose file
              </button>
              <span className="bdo-file-picker_name">
                {selectedFile ? selectedFile.name : "No file chosen"}
              </span>
            </div>
          </div>

          <button
            type="button"
            // Red once a file is chosen (ready to upload); stays the
            // neutral disabled style until then.
            className={`button ${selectedFile ? "button--primary" : "button--secondary"} brd-documents_upload`}
            onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
            disabled={!target || !selectedFile || uploadMutation.isPending}
            title={!target ? "Save the BRD first" : undefined}
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default BrdSupportingDocuments;
