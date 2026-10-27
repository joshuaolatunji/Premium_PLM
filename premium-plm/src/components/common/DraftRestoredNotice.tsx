interface DraftRestoredNoticeProps {
  // When the restored edits were last typed (ISO).
  savedAt: string | null;
  onDiscard: () => void;
  // What to do to keep them, e.g. "Save the BRD to keep them."
  keepHint?: string;
}

// Shown at the top of a form whose unsaved edits were brought back from this
// device (see utils/useDraftState.ts).
function DraftRestoredNotice({ savedAt, onDiscard, keepHint = "Save to keep them." }: DraftRestoredNoticeProps) {
  if (!savedAt) {
    return null;
  }

  const when = new Date(savedAt).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="document-draft-note" role="status">
      <p>
        <strong>Restored your unsaved changes</strong> from {when}. {keepHint}
      </p>

      <button type="button" className="button button--secondary" onClick={onDiscard}>
        Discard changes
      </button>
    </div>
  );
}

export default DraftRestoredNotice;
