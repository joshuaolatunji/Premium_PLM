import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2, UploadCloud, X } from "lucide-react";
import { sileo } from "sileo";

import {
  attachmentName,
  deleteMemoAttachment,
  formatFileSize,
  getMemoAttachments,
  memoAttachmentKeys,
  openMemoAttachment,
} from "../../service/MemoAttachmentService";
import type { MemoAttachment } from "../../service/MemoAttachmentService";
import { formatDate } from "../../utils/ticketStatus";
import { FileBadge } from "./MemoAttachmentsList";

// A file chosen in this session, uploaded when the memo is next saved or sent.
export interface StagedFile {
  id: string;
  file: File;
  label: string;
}

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg";
const MAX_BYTES = 25 * 1024 * 1024;

function nameWithoutExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

interface MemoAttachmentsPanelProps {
  // The saved memo, when it has been saved; null for a new one.
  memoId: string | null;
  staged: StagedFile[];
  setStaged: (update: (current: StagedFile[]) => StagedFile[]) => void;
  // Upload progress while the memo is being saved, 0–100, or null.
  progress: number | null;
  disabled: boolean;
}

// The attachments step of the memo form: files already on the memo (open or
// remove), a drop zone, and the files waiting to go up with the next save,
// each with a name the author can change. Files can't be kept as a draft,
// so they're uploaded with the memo.
function MemoAttachmentsPanel({ memoId, staged, setStaged, progress, disabled }: MemoAttachmentsPanelProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const savedQuery = useQuery({
    queryKey: memoAttachmentKeys.one(memoId ?? ""),
    queryFn: () => getMemoAttachments(memoId as string),
    enabled: Boolean(memoId),
    retry: false,
  });
  const saved = savedQuery.data ?? [];

  const removeMutation = useMutation({
    mutationFn: deleteMemoAttachment,
    onSuccess: async () => {
      setConfirmingId(null);
      sileo.success({ title: "File removed" });
      await queryClient.invalidateQueries({ queryKey: memoAttachmentKeys.one(memoId ?? "") });
    },
    onError: () => sileo.error({ title: "Couldn't remove the file", description: "Try again." }),
  });

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = [...list];
    const tooBig = files.filter((file) => file.size > MAX_BYTES);
    const fresh = files.filter(
      (file) =>
        file.size <= MAX_BYTES &&
        !staged.some((item) => item.file.name === file.name && item.file.size === file.size),
    );

    if (tooBig.length > 0) {
      sileo.warning({
        title: tooBig.length === 1 ? "File too large" : "Files too large",
        description: `${tooBig.map((file) => file.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 25 MB and wasn't added.`,
      });
    }
    setStaged((current) => [
      ...current,
      ...fresh.map((file) => ({ id: crypto.randomUUID(), file, label: nameWithoutExtension(file.name) })),
    ]);
  }

  async function open(item: MemoAttachment) {
    try {
      await openMemoAttachment(item.id, window.open("", "_blank"));
    } catch {
      sileo.error({ title: "Couldn't open the file", description: `"${attachmentName(item)}". Try again.` });
    }
  }

  const uploading = progress !== null;
  const total = saved.length + staged.length;

  return (
    <section className="dashboard-panel initiative-detail-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>
            Attachments
            {total > 0 && <span className="memo-attach__count">{total}</span>}
          </h2>
          <p>Supporting files for the reviewers and signers: quotes, reports, schedules or images. Optional.</p>
        </div>
      </div>

      <div className="proposal-section">
        <div
          className={["memo-dropzone", dragging ? "memo-dropzone--active" : "", disabled ? "memo-dropzone--disabled" : ""]
            .filter(Boolean)
            .join(" ")}
          // The whole zone opens the file picker, not just the "browse" link.
          onClick={(event) => {
            if (!disabled && event.target === event.currentTarget) inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) addFiles(event.dataTransfer.files);
          }}
        >
          <span className="memo-dropzone__icon" aria-hidden="true">
            <UploadCloud size={26} strokeWidth={1.7} />
          </span>

          <p className="memo-dropzone__title">
            {dragging ? "Drop to attach" : "Drag files here, or"}{" "}
            {!dragging && (
              <button type="button" className="memo-dropzone__browse" onClick={() => inputRef.current?.click()} disabled={disabled}>
                browse your computer
              </button>
            )}
          </p>
          <p className="memo-dropzone__hint">PDF, Word, Excel, PowerPoint, text or images · up to 25 MB each</p>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {staged.length > 0 && (
          <div className="memo-attach__group">
            <p className="memo-attach__group-title">
              {uploading ? `Uploading ${staged.length} ${staged.length === 1 ? "file" : "files"}…` : "Ready to upload"}
              <span>{uploading ? `${progress}%` : "Uploaded when you save or send the memo"}</span>
            </p>

            {uploading && (
              <span className="memo-attach__progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </span>
            )}

            <ul className="memo-attach__list">
              {staged.map((item) => (
                <li key={item.id} className="memo-attach__item memo-attach__item--staged">
                  <FileBadge name={item.file.name} />

                  <span className="memo-attach__meta memo-attach__meta--edit">
                    <label className="sr-only" htmlFor={`memo-attach-${item.id}`}>
                      Name for {item.file.name}
                    </label>
                    <input
                      id={`memo-attach-${item.id}`}
                      type="text"
                      value={item.label}
                      placeholder={nameWithoutExtension(item.file.name)}
                      disabled={disabled}
                      onChange={(event) =>
                        setStaged((current) =>
                          current.map((row) => (row.id === item.id ? { ...row, label: event.target.value } : row)),
                        )
                      }
                    />
                    <span>
                      {item.file.name} · {formatFileSize(item.file.size)}
                    </span>
                  </span>

                  <button
                    type="button"
                    className="memo-attach__icon-button"
                    aria-label={`Remove ${item.file.name}`}
                    disabled={disabled}
                    onClick={() => setStaged((current) => current.filter((row) => row.id !== item.id))}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {memoId && (savedQuery.isError || saved.length > 0) && (
          <div className="memo-attach__group">
            <p className="memo-attach__group-title">
              Attached
              <span>Saved with the memo</span>
            </p>

            {savedQuery.isError ? (
              <p className="mock-data-notice">
                {savedQuery.error instanceof Error ? savedQuery.error.message : "Couldn't load the attachments."}
              </p>
            ) : (
              <ul className="memo-attach__list">
                {saved.map((item) => (
                  <li key={item.id} className="memo-attach__item">
                    <FileBadge name={item.fileName} />

                    <span className="memo-attach__meta">
                      <strong title={attachmentName(item)}>{attachmentName(item)}</strong>
                      <span>
                        {[item.label ? item.fileName : null, formatFileSize(item.size), item.uploadedAt && formatDate(item.uploadedAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>

                    {confirmingId === item.id ? (
                      <span className="memo-attach__confirm">
                        <span>Remove this file?</span>
                        <button type="button" className="table-action table-action--dark" onClick={() => setConfirmingId(null)} disabled={removeMutation.isPending}>
                          Keep
                        </button>
                        <button type="button" className="table-action table-action--premium" onClick={() => removeMutation.mutate(item.id)} disabled={removeMutation.isPending}>
                          {removeMutation.isPending ? "Removing…" : "Remove"}
                        </button>
                      </span>
                    ) : (
                      <span className="memo-attach__actions">
                        <button type="button" className="table-action table-action--dark" onClick={() => void open(item)}>
                          <ExternalLink size={14} aria-hidden="true" />
                          Open
                        </button>
                        <button
                          type="button"
                          className="memo-attach__icon-button"
                          aria-label={`Remove ${attachmentName(item)}`}
                          disabled={disabled}
                          onClick={() => setConfirmingId(item.id)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default MemoAttachmentsPanel;
