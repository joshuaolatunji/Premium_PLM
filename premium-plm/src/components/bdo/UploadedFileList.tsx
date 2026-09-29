import { Trash2 } from "lucide-react";

import type { MockUploadedFile } from "../../types/bdoDocumentTypes";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadedFileListProps {
  files: MockUploadedFile[];
  emptyLabel: string;
  // Omit to render a read-only list (e.g. the Group Head's review view) —
  // the remove button only appears when this is provided.
  onRemove?: (fileId: string) => void;
  isRemoving?: boolean;
}

function UploadedFileList({
  files,
  emptyLabel,
  onRemove,
  isRemoving,
}: UploadedFileListProps) {
  if (files.length === 0) {
    return <p className="bdo-upload-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="bdo-upload-list">
      {files.map((file) => (
        <li key={file.id} className="bdo-upload-list_item">
          <a href={file.objectUrl} target="_blank" rel="noreferrer">
            {file.fileName}
          </a>

          <span className="bdo-upload-list_meta">{formatFileSize(file.fileSize)}</span>

          {onRemove && (
            <button
              type="button"
              className="bdo-upload-list_remove"
              onClick={() => onRemove(file.id)}
              disabled={isRemoving}
              aria-label={`Remove ${file.fileName}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default UploadedFileList;
