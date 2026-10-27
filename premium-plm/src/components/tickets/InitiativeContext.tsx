import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getInitiativeDocuments } from "../../service/DocumentService";
import {
  getDiscoveryAttachments,
  getDiscoveryByInitiativeId,
  getDiscoveryWorkflowLinks,
  openDiscoveryAttachment,
} from "../../service/ProductDiscoveryService";
import { ApiError } from "../../apicalls/apiClient";
import { documentsQueryKey, EMPTY_DOCUMENTS } from "../../utils/documentStatus";
import DocumentsViewer from "../documents/DocumentsViewer";

interface InitiativeContextProps {
  initiativeId: string;
  initiativeName: string;
}

// Everything an engineer needs to know about the initiative behind a ticket:
// the approved documents, the BDO's discovery notes, attachments and design
// links. Shared by the Lead Engineer's and the Developer's pages.
function InitiativeContext({ initiativeId, initiativeName }: InitiativeContextProps) {
  const [errorMessage, setErrorMessage] = useState("");

  const discoveryQuery = useQuery({
    queryKey: ["product-discovery", initiativeId],
    queryFn: () => getDiscoveryByInitiativeId(initiativeId),
  });

  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(initiativeId),
    queryFn: () => getInitiativeDocuments(initiativeId),
    // Documents can only exist once the BDO's documentation is approved —
    // asking earlier would only return 404s.
    enabled: discoveryQuery.data?.status === "Approved",
  });

  const discoveryId = discoveryQuery.data?.id ?? null;

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

  const openAttachmentMutation = useMutation({
    mutationFn: ({ attachmentId, targetWindow }: { attachmentId: string; targetWindow: Window | null }) =>
      openDiscoveryAttachment(attachmentId, targetWindow),
    onSuccess: () => setErrorMessage(""),
    onError: (error) => {
      setErrorMessage(error instanceof ApiError ? error.message : "Unable to open that attachment. Try again.");
    },
  });

  // Opened synchronously in the click handler (before the mutation's first
  // await) so browsers still treat it as a user-gesture-triggered window,
  // not a blocked popup.
  function handleOpenAttachment(attachmentId: string) {
    const targetWindow = window.open("", "_blank");
    openAttachmentMutation.mutate({ attachmentId, targetWindow });
  }

  const discovery = discoveryQuery.data;
  const attachments = attachmentsQuery.data ?? [];
  const workflowLinks = workflowLinksQuery.data ?? [];

  return (
    <>
      <DocumentsViewer documents={documentsQuery.data ?? EMPTY_DOCUMENTS} initiativeName={initiativeName} />

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Product discovery</h2>
          </div>
        </div>

        {discovery ? (
          <div className="initiative-detail-grid">
            <div>
              <span className="initiative-detail-grid_label">Description</span>
              <span className="initiative-detail-grid_value brd-readonly-value">{discovery.businessLogic || "—"}</span>
            </div>

            <div>
              <span className="initiative-detail-grid_label">User flow</span>
              <span className="initiative-detail-grid_value brd-readonly-value">{discovery.userFlow || "—"}</span>
            </div>
          </div>
        ) : (
          <p className="initiatives-empty">
            {discoveryQuery.isLoading ? "Loading…" : "No discovery document was saved."}
          </p>
        )}
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Attachments</h2>
          </div>
        </div>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="bdo-upload-section">
          {attachments.length === 0 ? (
            <p className="bdo-upload-empty">No attachments were uploaded.</p>
          ) : (
            <ul className="bdo-upload-list">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="bdo-upload-list_item">
                  <div className="bdo-upload-list_info">
                    <span className="bdo-upload-list_name">{attachment.label ?? attachment.fileName}</span>
                  </div>

                  <button
                    type="button"
                    className="bdo-upload-list_open"
                    onClick={() => handleOpenAttachment(attachment.id)}
                    disabled={openAttachmentMutation.isPending}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Design links</h2>
          </div>
        </div>

        <div className="bdo-upload-section">
          {workflowLinks.length === 0 ? (
            <p className="bdo-upload-empty">No links were added.</p>
          ) : (
            <ul className="bdo-upload-list">
              {workflowLinks.map((link) => (
                <li key={link.id} className="bdo-upload-list_item">
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.title}
                  </a>
                  {link.description && <span className="bdo-upload-list_meta">{link.description}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

export default InitiativeContext;
